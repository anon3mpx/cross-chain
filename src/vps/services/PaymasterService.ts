// ─────────────────────────────────────────────────────────
// EMPX-Cross-Chain VPS — Paymaster Service
// Builds EIP-4337 UserOperations for RouterV1.initiateSwap().
// Signs paymasterAndData with the VPS signer key.
// Submits via Pimlico bundler API.
//
// Result: users pay gas in their input token. Zero native gas required.
// ─────────────────────────────────────────────────────────

import { ethers } from 'ethers';
import { QuoteResult } from '../types';

// Pimlico bundler endpoint (per chain)
const PIMLICO_URLS: Record<number, string> = {
  1:     'https://api.pimlico.io/v2/1/rpc',
  42161: 'https://api.pimlico.io/v2/42161/rpc',
  8453:  'https://api.pimlico.io/v2/8453/rpc',
  10:    'https://api.pimlico.io/v2/10/rpc',
  137:   'https://api.pimlico.io/v2/137/rpc',
  43114: 'https://api.pimlico.io/v2/43114/rpc',
  56:    'https://api.pimlico.io/v2/56/rpc',
};

const ENTRYPOINT_V7 = '0x0000000071727De22E5E9d8BAf0edAc6f37da032';

// Token → ETH rates cache (refreshed every 5 min by keeper)
const tokenRateCache = new Map<string, { rate: bigint; ts: number }>();

export interface UserOp {
  sender:               string;
  nonce:                string;
  initCode:             string;
  callData:             string;
  callGasLimit:         string;
  verificationGasLimit: string;
  preVerificationGas:   string;
  maxFeePerGas:         string;
  maxPriorityFeePerGas: string;
  paymasterAndData:     string;
  signature:            string;
}

export interface PaymasterOpts {
  chainId:        number;
  senderAddress:  string;     // User's smart wallet address
  routerV1:       string;     // RouterV1 address on this chain
  paymasterAddr:  string;     // RufloPaymaster address on this chain
  signerKey:      string;     // VPS private key for paymasterAndData signing
  gasToken:       string;     // ERC-20 address user pays gas in
  swapCalldata:   string;     // ABI-encoded RouterV1.initiateSwap() calldata
  pimlicoApiKey:  string;
}

export class PaymasterService {

  // ── Build a complete UserOp for a swap ────────────────────────────────────

  async buildUserOp(opts: PaymasterOpts, quote: QuoteResult): Promise<UserOp> {
    const provider = this._getProvider(opts.chainId, opts.pimlicoApiKey);

    // 1. Get nonce from EntryPoint
    const nonce = await this._getNonce(provider, opts.senderAddress);

    // 2. Estimate gas limits (via eth_estimateUserOperationGas on Pimlico)
    const gasLimits = await this._estimateGas(provider, opts);

    // 3. Get current base fee
    const { maxFeePerGas, maxPriorityFeePerGas } = await this._getFees(provider);

    // 4. Sign paymasterAndData (VPS signer authorises this specific UserOp)
    const expiry         = Math.floor(Date.now() / 1000) + 300; // 5 min validity
    const maxTokenFee    = this._computeMaxTokenFee(gasLimits, maxFeePerGas, opts.gasToken, opts.chainId);
    const paymasterData  = await this._signPaymasterData(
      opts.paymasterAddr, opts.gasToken, maxTokenFee, expiry, opts.signerKey
    );

    // 5. Encode callData: batch approve(paymaster) + initiateSwap()
    const callData = this._encodeMulticall(opts.senderAddress, [
      // Allow Paymaster to pull gasToken for fee
      this._encodeApprove(opts.gasToken, opts.paymasterAddr, maxTokenFee),
      // The actual swap
      { to: opts.routerV1, data: opts.swapCalldata, value: '0x0' },
    ]);

    return {
      sender:               opts.senderAddress,
      nonce:                `0x${nonce.toString(16)}`,
      initCode:             '0x',
      callData,
      callGasLimit:         gasLimits.callGasLimit,
      verificationGasLimit: gasLimits.verificationGasLimit,
      preVerificationGas:   gasLimits.preVerificationGas,
      maxFeePerGas:         `0x${maxFeePerGas.toString(16)}`,
      maxPriorityFeePerGas: `0x${maxPriorityFeePerGas.toString(16)}`,
      paymasterAndData:     paymasterData,
      signature:            '0x', // Filled by user's smart wallet
    };
  }

  // ── Submit UserOp to Pimlico bundler ──────────────────────────────────────

  async submitUserOp(userOp: UserOp, chainId: number, pimlicoApiKey: string): Promise<string> {
    const url = `${PIMLICO_URLS[chainId]}?apikey=${pimlicoApiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1,
        method: 'eth_sendUserOperation',
        params: [userOp, ENTRYPOINT_V7],
      }),
    });
    const { result, error } = await res.json();
    if (error) throw new Error(`Pimlico error: ${error.message}`);
    return result as string; // UserOp hash
  }

  // ── Token rate keeper — update on-chain rates every 5 min ─────────────────

  async updateTokenRates(
    paymasterContract: ethers.Contract,
    tokens: string[],
    priceFn: (token: string) => Promise<number>
  ): Promise<void> {
    const rates: bigint[] = [];
    for (const token of tokens) {
      const priceUSD  = await priceFn(token);   // e.g. 1 USDC = $1.00
      const ethPriceUSD = await priceFn('ETH');
      // rate = tokenWei per 1e18 ethWei = (ethPrice / tokenPrice) * 1e18
      // e.g. USDC: (3000 / 1.0) * 1e18 = 3000e18 USDC wei per ETH
      const rate = BigInt(Math.round((ethPriceUSD / priceUSD) * 1e18));
      rates.push(rate);
      tokenRateCache.set(token, { rate, ts: Date.now() });
    }
    await paymasterContract.setTokenRateBatch(tokens, rates);
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  private async _signPaymasterData(
    paymasterAddr: string,
    token: string,
    maxTokenFee: bigint,
    expiry: number,
    signerKey: string,
  ): Promise<string> {
    // paymasterAndData = paymaster(20) + token(20) + maxFee(32) + sig(65) + expiry(6)
    const signer  = new ethers.Wallet(signerKey);
    const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
      ['address', 'uint256', 'uint48'], [token, maxTokenFee, expiry]
    );
    const digest = ethers.keccak256(encoded);
    const sig    = await signer.signMessage(ethers.getBytes(digest));
    return ethers.concat([paymasterAddr, token, ethers.zeroPadValue(ethers.toBeHex(maxTokenFee), 32), sig, ethers.toBeHex(expiry, 6)]);
  }

  private _computeMaxTokenFee(gasLimits: any, maxFeePerGas: bigint, token: string, chainId: number): bigint {
    const gasTotal  = BigInt(gasLimits.callGasLimit) + BigInt(gasLimits.verificationGasLimit) + BigInt(gasLimits.preVerificationGas);
    const ethCost   = gasTotal * maxFeePerGas * 12n / 10n; // 120% buffer
    const cached    = tokenRateCache.get(`${chainId}:${token}`);
    const rate      = cached?.rate ?? 3000n * 10n ** 18n; // fallback: $3000 ETH
    return (ethCost * rate) / (10n ** 18n);
  }

  private _encodeMulticall(sender: string, calls: { to: string; data: string; value: string }[]): string {
    // Standard ERC-4337 account execute batch
    return new ethers.Interface([
      'function executeBatch(address[] to, uint256[] value, bytes[] data)'
    ]).encodeFunctionData('executeBatch', [
      calls.map(c => c.to),
      calls.map(c => c.value),
      calls.map(c => c.data),
    ]);
  }

  private _encodeApprove(token: string, spender: string, amount: bigint): { to: string; data: string; value: string } {
    return {
      to:    token,
      data:  new ethers.Interface(['function approve(address,uint256)']).encodeFunctionData('approve', [spender, amount]),
      value: '0x0',
    };
  }

  private async _getNonce(provider: ethers.JsonRpcProvider, sender: string): Promise<bigint> {
    const ep = new ethers.Contract(ENTRYPOINT_V7, ['function getNonce(address,uint192) view returns (uint256)'], provider);
    return ep.getNonce(sender, 0);
  }

  private async _estimateGas(provider: ethers.JsonRpcProvider, opts: PaymasterOpts) {
    // Stub — in production use eth_estimateUserOperationGas on Pimlico
    return { callGasLimit: '0x493E0', verificationGasLimit: '0x186A0', preVerificationGas: '0xC350' };
  }

  private async _getFees(provider: ethers.JsonRpcProvider): Promise<{ maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }> {
    const block = await provider.getBlock('latest');
    const baseFee = block?.baseFeePerGas ?? 1_000_000_000n;
    const priority = 1_000_000_000n;
    return { maxFeePerGas: baseFee * 2n + priority, maxPriorityFeePerGas: priority };
  }

  private _getProvider(chainId: number, apiKey: string): ethers.JsonRpcProvider {
    const url = `${PIMLICO_URLS[chainId]}?apikey=${apiKey}`;
    return new ethers.JsonRpcProvider(url);
  }
}
