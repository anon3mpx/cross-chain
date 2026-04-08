// ─────────────────────────────────────────────────────────
// EMPX Cross Chain VPS — Rail Selector Service
// Determines the optimal rail + settlement token for a given route.
// All logic is in-memory — <1ms per call, no I/O.
// ─────────────────────────────────────────────────────────

import { Rail, RailConfig, RailScore, SettlementToken, ChainConfig, CHAIN_ID } from '../types';

const PLUGIN_ID = {
  CCTP_V2:      '0xb148ea5f936a28661e11743b1650193f1b14a2322b9541503bf6815a84a1a6e9',
  AXELAR_V1:    '0xdee0b34b74b60e53553685c32477090103c2b806eb925a8cd000efa92bef3e8b',
  LZ_V2:        '0xc472efb7b9a986e1446d8bf9dec51e88548a1d8eb4a0810e6424d97a878d34fc',
  VIA_LABS_V1:  '0x3c09500df72dbac855e61899e0dd4420addc8367cb7a5f60906b5450d7a71687',
  WORMHOLE_V2:  '0xfdd3e68657787c00343d96c11d1cd189fa4dfe5f52999861b06e9f8e99ea902f',
  THORCHAIN_V1: '0x390774707b6ae71a0ce31d10394e70b6ac75b3b62ec4db96c9672cafd1b516c9',
} as const;

// ── Static rail configs ────────────────────────────────────────────────────────
export const RAIL_CONFIGS: Record<Rail, RailConfig> = {
  // ── Messaging rails ────────────────────────────────────────────────────────
  [Rail.CCTP]: {
    rail: Rail.CCTP, railType: 'messaging', fee: 0, etaSeconds: 25,
    supportsUSDC: true,  supportsUSDT: false, supportsETH: false,
    supportsBTC: false,  supportsSOL: false,
    nativeUSDC: true, reliabilityScore: 0.997, pluginId: PLUGIN_ID.CCTP_V2,
    requiresNativeAddr: false,
  },
  [Rail.VIA_LABS]: {
    rail: Rail.VIA_LABS, railType: 'messaging', fee: 0.25, etaSeconds: 180,
    supportsUSDC: true,  supportsUSDT: true,  supportsETH: true,
    supportsBTC: false,  supportsSOL: false,
    nativeUSDC: true, reliabilityScore: 0.985, pluginId: PLUGIN_ID.VIA_LABS_V1,
    requiresNativeAddr: false,
  },
  [Rail.AXELAR]: {
    rail: Rail.AXELAR, railType: 'messaging', fee: 0.50, etaSeconds: 90,
    supportsUSDC: true,  supportsUSDT: true,  supportsETH: true,
    supportsBTC: false,  supportsSOL: false,
    nativeUSDC: false, reliabilityScore: 0.992, pluginId: PLUGIN_ID.AXELAR_V1,
    requiresNativeAddr: false,
  },
  [Rail.LAYERZERO]: {
    rail: Rail.LAYERZERO, railType: 'messaging', fee: 0.35, etaSeconds: 120,
    supportsUSDC: true,  supportsUSDT: true,  supportsETH: true,
    supportsBTC: false,  supportsSOL: false,
    nativeUSDC: false, reliabilityScore: 0.990, pluginId: PLUGIN_ID.LZ_V2,
    requiresNativeAddr: false,
  },
  [Rail.WORMHOLE]: {
    rail: Rail.WORMHOLE, railType: 'messaging', fee: 0.40, etaSeconds: 60,
    supportsUSDC: true,  supportsUSDT: false, supportsETH: true,
    supportsBTC: false,  supportsSOL: true,
    nativeUSDC: false, reliabilityScore: 0.988, pluginId: PLUGIN_ID.WORMHOLE_V2,
    requiresNativeAddr: false,
  },
  // ── Liquidity rails ────────────────────────────────────────────────────────
  [Rail.THORCHAIN]: {
    rail: Rail.THORCHAIN, railType: 'liquidity', fee: 0, feeSlippagePct: 0.2, etaSeconds: 60,
    supportsUSDC: true,  supportsUSDT: false, supportsETH: true,
    supportsBTC: true,   supportsSOL: true,   // THORChain added SOL
    nativeUSDC: false, reliabilityScore: 0.975, pluginId: PLUGIN_ID.THORCHAIN_V1,
    requiresNativeAddr: true,   // BTC/SOL/DOGE destinations need native address
  },
};

// ── Chain → supported rails ────────────────────────────────────────────────────
// Liquidity rails (THORCHAIN) can source FROM any EVM chain they're deployed on.
// Non-EVM destination chains are handled by liquidity rails only.
// Alt-L2 chains that lack a direct rail to the destination will be routed via
// a hub chain by RouteBuilder — they still need entries here for leg-1 of the hop.
export const CHAIN_RAILS: Record<number, Rail[]> = {
  // ── Tier-1 EVM: full rail coverage ──────────────────────────────────────
  1:     [Rail.CCTP, Rail.AXELAR, Rail.LAYERZERO, Rail.VIA_LABS, Rail.THORCHAIN],
  10:    [Rail.CCTP, Rail.AXELAR, Rail.LAYERZERO, Rail.VIA_LABS, Rail.THORCHAIN],
  42161: [Rail.CCTP, Rail.AXELAR, Rail.LAYERZERO, Rail.VIA_LABS, Rail.THORCHAIN],
  8453:  [Rail.CCTP, Rail.AXELAR, Rail.LAYERZERO, Rail.VIA_LABS, Rail.THORCHAIN],  // BASE confirmed live on THORChain
  137:   [Rail.CCTP, Rail.AXELAR, Rail.LAYERZERO, Rail.VIA_LABS],
  43114: [Rail.CCTP, Rail.AXELAR, Rail.LAYERZERO, Rail.VIA_LABS, Rail.THORCHAIN],  // AVAX confirmed live
  56:    [Rail.AXELAR, Rail.LAYERZERO, Rail.VIA_LABS, Rail.THORCHAIN],              // BSC confirmed live
  // ── Aggregator-deployed expansion chains ─────────────────────────────────
  369:   [Rail.AXELAR, Rail.LAYERZERO, Rail.VIA_LABS],                              // PulseChain
  143:   [Rail.AXELAR, Rail.LAYERZERO, Rail.VIA_LABS],                              // Monad
  146:   [Rail.AXELAR, Rail.LAYERZERO, Rail.VIA_LABS],                              // Sonic
  1329:  [Rail.AXELAR, Rail.LAYERZERO, Rail.VIA_LABS],                              // Sei
  80094: [Rail.AXELAR, Rail.LAYERZERO, Rail.VIA_LABS],                              // Berachain
  30:    [Rail.AXELAR, Rail.LAYERZERO, Rail.VIA_LABS],                              // Rootstock
  10001: [Rail.AXELAR, Rail.LAYERZERO, Rail.VIA_LABS],                              // EthPOW
  999:   [Rail.AXELAR, Rail.LAYERZERO, Rail.VIA_LABS],                              // HyperEVM
  // ── Tier-2 EVM alt-L2: partial coverage (hub-hop candidates) ────────────
  // These chains can reach major rails via Via Labs, Axelar or LayerZero
  // but may lack CCTP or THORChain. RouteBuilder will route via a hub when needed.
  59144:  [Rail.AXELAR, Rail.LAYERZERO, Rail.VIA_LABS],   // Linea
  5000:   [Rail.AXELAR, Rail.LAYERZERO, Rail.VIA_LABS],   // Mantle
  34443:  [Rail.AXELAR, Rail.LAYERZERO, Rail.VIA_LABS],   // Mode
  81457:  [Rail.AXELAR, Rail.LAYERZERO, Rail.VIA_LABS],   // Blast
  534352: [Rail.LAYERZERO, Rail.VIA_LABS],                 // Scroll
  324:    [Rail.AXELAR, Rail.LAYERZERO, Rail.VIA_LABS],   // zkSync Era
  1101:   [Rail.AXELAR, Rail.LAYERZERO, Rail.VIA_LABS],   // Polygon zkEVM
  7777777:[Rail.LAYERZERO, Rail.VIA_LABS],                 // Zora
  1284:   [Rail.AXELAR, Rail.LAYERZERO, Rail.VIA_LABS],   // Moonbeam
  42220:  [Rail.AXELAR, Rail.LAYERZERO, Rail.VIA_LABS],   // Celo
  // ── Non-EVM destinations — liquidity rails only ──────────────────────────
  [CHAIN_ID.BTC]:    [Rail.THORCHAIN],
  [CHAIN_ID.SOL]:    [Rail.THORCHAIN, Rail.WORMHOLE, Rail.CCTP],  // CCTP v2 on Solana (domain 5)
  [CHAIN_ID.DOGE]:   [Rail.THORCHAIN],
  [CHAIN_ID.LTC]:    [Rail.THORCHAIN],
  [CHAIN_ID.BCH]:    [Rail.THORCHAIN],
  [CHAIN_ID.COSMOS]: [Rail.THORCHAIN, Rail.AXELAR],
};

export class RailSelector {

  /// @notice Select the best rail + settlement token for a given chain pair.
  /// @param srcChainId Source EVM chain ID
  /// @param dstChainId Destination EVM chain ID
  /// @param dstChain   Destination chain config (to check nativeStable preference)
  /// @param amountUSD  Transfer amount in USD (affects fee weight)
  /// @param urgency    'fast' | 'normal' — shifts speed vs cost weighting
  /// @returns Ranked list of rail options (best first), or empty if no route
  selectRail(
    srcChainId: number,
    dstChainId: number,
    dstChain: ChainConfig,
    amountUSD: number,
    urgency: 'fast' | 'normal' = 'normal',
  ): RailScore[] {
    const srcRails = new Set(CHAIN_RAILS[srcChainId] ?? []);
    const dstRails = new Set(CHAIN_RAILS[dstChainId] ?? []);

    // Only rails that serve BOTH chains
    const candidates = [...srcRails].filter(r => dstRails.has(r));
    if (candidates.length === 0) return [];

    const scores: RailScore[] = candidates.map(rail => {
      const config = RAIL_CONFIGS[rail];
      const settlementToken = this._pickSettlementToken(rail, config, dstChain);
      const requiresTokenHop = settlementToken !== SettlementToken.USDC || !config.nativeUSDC;

      return {
        rail,
        config,
        settlementToken,
        requiresTokenHop,
        score: this._scoreRail(config, settlementToken, amountUSD, urgency),
      };
    });

    // Sort descending by score
    return scores.sort((a, b) => b.score - a.score);
  }

  /// @notice Pick the most appropriate settlement token for a given rail + destination.
  private _pickSettlementToken(
    rail: Rail,
    config: RailConfig,
    dstChain: ChainConfig,
  ): SettlementToken {
    // Native BTC/SOL destinations — settlement IS the native asset
    if (dstChain.chainId === CHAIN_ID.BTC  && config.supportsBTC) return SettlementToken.BTC;
    if (dstChain.chainId === CHAIN_ID.SOL  && config.supportsSOL) return SettlementToken.SOL;
    if (dstChain.chainId === CHAIN_ID.DOGE) return SettlementToken.ETH; // THORChain uses ETH→DOGE
    // Destination prefers USDT (e.g. Plasma, Tron-adjacent)
    if (dstChain.nativeStable === SettlementToken.USDT && config.supportsUSDT) return SettlementToken.USDT;
    // CCTP: USDC only
    if (rail === Rail.CCTP) return SettlementToken.USDC;
    // Default preference: USDC > ETH
    if (config.supportsUSDC) return SettlementToken.USDC;
    if (config.supportsETH)  return SettlementToken.ETH;
    return SettlementToken.USDC;
  }

  // ── TODO: Implement your scoring logic here ────────────────────────────────
  //
  // This is the heart of the rail selector. It decides which rail wins when
  // multiple options are available for the same chain pair.
  //
  // Parameters you have:
  //   config      - Rail config (fee, etaSeconds, nativeUSDC, reliabilityScore)
  //   token       - Which settlement token was chosen
  //   amountUSD   - Transfer size in USD
  //   urgency     - 'fast' or 'normal'
  //
  // Things to consider:
  //   - At small amounts (<$50), fee dominates → CCTP always wins
  //   - At large amounts (>$10k), reliability matters more than $0.25 fee diff
  //   - 'fast' urgency should heavily penalize slow rails (etaSeconds weight)
  //   - Native USDC (CCTP) should get a bonus — no wrapped token risk
  //   - Wrapped stablecoins (axlUSDC) carry smart contract risk → small penalty
  //   - reliabilityScore historical data should factor in (SLA protection)
  //
  // Return a number — higher is better. No fixed range required.
  //
  _scoreRail(
    config: RailConfig,
    token: SettlementToken,
    amountUSD: number,
    urgency: 'fast' | 'normal',
  ): number {
    // ── Weights shift based on urgency ─────────────────────────────────────
    const costWeight  = urgency === 'fast' ? 0.4 : 1.8;
    const speedWeight = urgency === 'fast' ? 2.5 : 0.6;

    // ── Cost score: fee as a fraction of transfer size ─────────────────────
    // At $10 transfer, $0.25 fee = 2.5% — painful. At $1000, it's 0.025% — irrelevant.
    // We normalise so cost only dominates on small transfers.
    const feePct   = config.fee / Math.max(amountUSD, 1);  // 0–1 range on small txs
    const costScore = 1 / (feePct + 0.001);                // higher = cheaper relative to amount

    // ── Speed score: inverse ETA (etaSeconds is already chain-aware via estimateFee) ──
    const speedScore = 1000 / config.etaSeconds;

    // ── Native USDC bonus: avoid wrapped token risk (axlUSDC has depegged before) ──
    const nativeBonus = (config.nativeUSDC && token === SettlementToken.USDC) ? 1.30 : 1.0;

    // ── Reliability amplifier: doubles in weight above $5k (SLA protection) ─
    const reliabilityWeight = amountUSD > 5_000 ? config.reliabilityScore ** 3 : config.reliabilityScore;

    return (costScore * costWeight + speedScore * speedWeight) * reliabilityWeight * nativeBonus;
  }
}
