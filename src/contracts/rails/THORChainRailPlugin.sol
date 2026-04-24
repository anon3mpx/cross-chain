// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "../interfaces/IRailPlugin.sol";
import "../interfaces/IIntentTypes.sol";

/// @title THORChainRailPlugin — Liquidity rail via THORChain AMM
///
/// @notice Fundamentally different from messaging rails (CCTP, Axelar):
///   - THORChain is an AMM — uses RUNE as intermediate, has price impact
///   - Delivers NATIVELY to destination address: real BTC, real SOL, real ETH
///   - No ReceiverV1 on destination — THORChain nodes send directly to user
///   - VPS monitors THORChain for outbound tx confirmation
///
/// @dev Integration flow on EVM source chains:
///   1. Approve token to THORChain Router
///   2. Call Router.depositWithExpiry(vault, asset, amount, memo, expiry)
///   3. Memo encodes destination chain + asset + address + slippage limit
///   4. THORChain validators observe the deposit, route via RUNE pools, deliver
///
/// Memo format: =:CHAIN.ASSET:DESTADDRESS:LIMIT/STREAMINTERVAL/STREAMQUANTITY
/// Example BTC:  =:BTC.BTC:bc1qrecipient:100000000
/// Example SOL:  =:SOL.SOL:HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH:0
/// Example USDC: =:ETH.USDC-0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48:0xaddr:0
contract THORChainRailPlugin is IRailPlugin, ERC165, Ownable2Step {
    using SafeERC20 for IERC20;

    bytes32 public constant override railId = keccak256("THORCHAIN_V1");

    // THORChain Router on this EVM chain (different per chain — fetched from /inbound_addresses)
    address public thorRouter;

    // chainId => THORChain inbound vault address (updated by VPS keeper from /inbound_addresses)
    mapping(uint32 => address) public inboundVaults;

    // Settlement token addresses on this chain
    address public immutable USDC;
    address public immutable WETH;
    address public immutable USDT;

    // Minimum amounts to avoid dust rejection by THORChain nodes
    uint256 public constant MIN_USDC_AMOUNT = 10e6;  // $10 USDC minimum
    uint256 public constant MIN_ETH_AMOUNT  = 3e15;  // 0.003 ETH minimum

    event THORSwapInitiated(
        bytes32 indexed intentId,
        address asset,
        uint256 amount,
        string  memo,
        uint256 expiry
    );

    error UnsupportedSettlementToken(uint8 token);
    error VaultNotConfigured(uint32 dstChainId);
    error AmountBelowMinimum(uint256 amount, uint256 minimum);

    constructor(address _thorRouter, address _usdc, address _weth, address _usdt, address _owner)
        Ownable(_owner)
    {
        thorRouter = _thorRouter;
        USDC = _usdc;
        WETH = _weth;
        USDT = _usdt;
    }

    // ── IRailPlugin implementation ─────────────────────────────────────────────

    function supportsRoute(uint32 /*srcChainId*/, uint32 dstChainId)
        external view override returns (bool)
    {
        // THORChain supports all EVM chains it's deployed on + BTC + DOGE + LTC + SOL + GAIA
        // Non-EVM chains are identified by special chainIds in our system (see types/index.ts)
        return inboundVaults[dstChainId] != address(0) || _isNativeChain(dstChainId);
    }

    function settlementTokenAddress(uint8 settlementToken)
        external view override returns (address)
    {
        if (settlementToken == uint8(IntentTypes.SettlementToken.USDC)) return USDC;
        if (settlementToken == uint8(IntentTypes.SettlementToken.ETH))  return WETH;
        if (settlementToken == uint8(IntentTypes.SettlementToken.USDT)) return USDT;
        revert UnsupportedSettlementToken(settlementToken);
    }

    function supportsSettlementToken(uint8 settlementToken)
        external pure override returns (bool)
    {
        return settlementToken == uint8(IntentTypes.SettlementToken.USDC)
            || settlementToken == uint8(IntentTypes.SettlementToken.ETH)
            || settlementToken == uint8(IntentTypes.SettlementToken.USDT);
    }

    /// @notice Fee estimate: THORChain charges ~0.1-0.3% slip + dynamic outbound fee.
    ///         VPS fetches live fee from THORChain API before quoting — this is a fallback.
    function estimateFee(uint32 dstChainId, uint256 /*amount*/, uint8 /*settlementToken*/)
        external view override returns (uint256 fee, uint256 eta)
    {
        // ETH ~30s, BTC ~10min (1 confirmation), SOL ~15s
        // Non-EVM native chains use pseudo-chainIds — ETA varies
        if (dstChainId == 0) eta = 600;       // BTC: 1 confirmation ~10min
        else if (dstChainId == 99) eta = 20;   // SOL: ~20s
        else eta = 60;                          // EVM: ~60s THORChain processing
        fee = 0;  // THORChain fee is slippage-based — VPS calculates via API
    }

    /// @notice Execute THORChain deposit on the source EVM chain.
    /// @dev `params.nativeDstAddress` must be set by VPS to the user's destination-chain address.
    ///      For BTC: base58 address. For SOL: base58 pubkey. For EVM: 0x hex address.
    function bridge(IntentTypes.BridgeParams calldata params)
        external payable override returns (bytes32 railTxId)
    {
        address vault = _resolveVault(params.dstChainId);
        uint256 bridgedAmount;

        // Build THORChain memo
        string memory memo = _buildMemo(
            params.dstChainId,
            params.finalRecipient,
            params.nativeDstAddress,  // non-EVM native address (bytes, UTF-8 encoded)
            params.thorAssetIdentifier, // e.g. "BTC.BTC", "SOL.SOL", "ETH.USDC-0xA0B..."
            params.minThorOutput        // limit: minimum output in 8-dec THORChain units
        );

        address asset = params.settlementTokenAddr;

        // USDC/USDT path: approve and call depositWithExpiry
        if (asset != address(0)) {
            if (params.amount < MIN_USDC_AMOUNT) revert AmountBelowMinimum(params.amount, MIN_USDC_AMOUNT);
            IERC20(asset).safeTransferFrom(msg.sender, address(this), params.amount);
            IERC20(asset).forceApprove(thorRouter, params.amount);
            bridgedAmount = params.amount;

            ITHORRouter(thorRouter).depositWithExpiry(
                payable(vault),
                asset,
                params.amount,
                memo,
                block.timestamp + 15 minutes
            );
        } else {
            // Native ETH path
            if (msg.value < MIN_ETH_AMOUNT) revert AmountBelowMinimum(msg.value, MIN_ETH_AMOUNT);
            bridgedAmount = msg.value;
            ITHORRouter(thorRouter).depositWithExpiry{value: msg.value}(
                payable(vault),
                address(0),
                msg.value,
                memo,
                block.timestamp + 15 minutes
            );
        }

        // Rail tx ID: keccak of intentId + block — VPS tracks via THORChain API with this memo
        railTxId = keccak256(abi.encodePacked(params.intentId, block.number));
        emit THORSwapInitiated(params.intentId, asset, bridgedAmount, memo, block.timestamp + 15 minutes);
    }

    // ── Memo construction ──────────────────────────────────────────────────────

    function _buildMemo(
        uint32 dstChainId,
        address evmRecipient,
        bytes calldata nativeDstAddress,
        string calldata thorAsset,
        uint256 minOutput
    ) internal pure returns (string memory) {
        // Native chains: use nativeDstAddress bytes (BTC, SOL, DOGE etc.)
        // EVM chains: use evmRecipient hex string
        string memory destAddr = _isNativeChain(dstChainId)
            ? string(nativeDstAddress)
            : _toHexString(evmRecipient);

        // =:ASSET:DESTADDR:LIMIT  (streaming params omitted for simplicity)
        return string.concat("=:", thorAsset, ":", destAddr, ":", _uint2str(minOutput));
    }

    function _resolveVault(uint32 dstChainId) internal view returns (address vault) {
        vault = inboundVaults[dstChainId];
        // For native chains the vault is the same across all EVM sources
        // Fallback: use the stored ETH vault (THORChain uses one pub key across chains)
        if (vault == address(0)) vault = inboundVaults[1]; // ETH mainnet vault
        if (vault == address(0)) revert VaultNotConfigured(dstChainId);
    }

    /// @notice Returns true for non-EVM chain pseudo-IDs
    function _isNativeChain(uint32 chainId) internal pure returns (bool) {
        return chainId == 0    // BTC
            || chainId == 98   // DOGE
            || chainId == 99   // SOL
            || chainId == 100  // LTC
            || chainId == 101  // BCH
            || chainId == 102; // GAIA (Cosmos)
    }

    // ── Admin ──────────────────────────────────────────────────────────────────

    /// @notice VPS keeper calls this every ~5 min to update vault addresses from /inbound_addresses
    function setInboundVault(uint32 chainId, address vault) external onlyOwner {
        inboundVaults[chainId] = vault;
    }
    function setTHORRouter(address _thorRouter) external onlyOwner {
        thorRouter = _thorRouter;
    }

    function supportsInterface(bytes4 interfaceId)
        public view override(ERC165, IRailPlugin) returns (bool)
    {
        return interfaceId == type(IRailPlugin).interfaceId || super.supportsInterface(interfaceId);
    }

    // ── Utils ──────────────────────────────────────────────────────────────────

    function _toHexString(address addr) internal pure returns (string memory) {
        bytes memory buf = new bytes(42);
        buf[0] = '0'; buf[1] = 'x';
        bytes memory hex_chars = "0123456789abcdef";
        for (uint i = 0; i < 20; i++) {
            buf[2 + i * 2]     = hex_chars[uint8(bytes20(addr)[i]) >> 4];
            buf[2 + i * 2 + 1] = hex_chars[uint8(bytes20(addr)[i]) & 0x0f];
        }
        return string(buf);
    }

    function _uint2str(uint256 n) internal pure returns (string memory) {
        if (n == 0) return "0";
        uint256 tmp = n; uint256 len;
        while (tmp != 0) { len++; tmp /= 10; }
        bytes memory buf = new bytes(len);
        while (n != 0) { buf[--len] = bytes1(uint8(48 + n % 10)); n /= 10; }
        return string(buf);
    }
}

// ── THORChain Router interface (same across all EVM chains) ───────────────────
interface ITHORRouter {
    function depositWithExpiry(
        address payable vault,
        address asset,
        uint256 amount,
        string calldata memo,
        uint256 expiration
    ) external payable;
}
