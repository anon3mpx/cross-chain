import { getAddress } from 'ethers';
import { OfferSet, QuoteResult, Rail, SettlementToken, CHAIN_ID } from '../../types';
import { THORChainQuoteRequest } from './THORChainQuoteWorker';
import { getSettlementTokenAddress } from '../../config/contracts';
import { getChainConfig } from '../../config/chains';

const NON_EVM_CHAINS = new Set<number>([
  CHAIN_ID.BTC,
  CHAIN_ID.DOGE,
  CHAIN_ID.SOL,
  CHAIN_ID.LTC,
  CHAIN_ID.BCH,
  CHAIN_ID.COSMOS,
  CHAIN_ID.DOT,
]);

const THORCHAIN_POOL_TTL_MS = 60_000;
const THORCHAIN_AMOUNT_DECIMALS = 8;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const NATIVE_PLACEHOLDERS = new Set([
  ZERO_ADDRESS,
  '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
]);
const THORCHAIN_EVM_CHAIN_ALIASES: Record<number, string> = {
  [CHAIN_ID.ETH]: 'ETH',
  [CHAIN_ID.BSC]: 'BSC',
  [CHAIN_ID.AVAX]: 'AVAX',
  [CHAIN_ID.BASE]: 'BASE',
  [CHAIN_ID.ARB]: 'ARB',
  [CHAIN_ID.OP]: 'OP',
  [CHAIN_ID.POLYGON]: 'MATIC',
};

interface THORChainPoolAsset {
  asset: string;
  decimals?: number;
}

interface ResolvedTHORChainAsset {
  asset: string;
  decimals: number;
}

let cachedPools: { expiresAt: number; assets: THORChainPoolAsset[] } | null = null;

export function resetTHORChainQuotePolicyCacheForTests(): void {
  cachedPools = null;
}

export interface BuildTHORChainQuoteRequestInput {
  amountIn: bigint;
  srcChainId: number;
  dstChainId: number;
  destinationAddress?: string;
  refundAddress?: string;
  routeAssetAlias: string;
  sourceTokenAddress?: string;
  destinationTokenAddress?: string;
  tokenIn: string;
  tokenOut: string;
}

export async function buildTHORChainQuoteRequest(
  input: BuildTHORChainQuoteRequestInput,
): Promise<THORChainQuoteRequest | null> {
  if (!isSupportedRouteAssetAlias(input.routeAssetAlias)) return null;
  return buildTHORChainQuoteRequestFromPair({
    amountIn: input.amountIn,
    srcChainId: input.srcChainId,
    dstChainId: input.dstChainId,
    tokenIn: input.sourceTokenAddress ?? input.tokenIn,
    tokenOut: input.destinationTokenAddress ?? input.tokenOut,
    destinationAddress: input.destinationAddress,
    refundAddress: input.refundAddress,
  });
}

export interface BuildTHORChainQuoteRequestFromPairInput {
  amountIn: bigint;
  srcChainId: number;
  dstChainId: number;
  tokenIn: string;
  tokenOut: string;
  destinationAddress?: string;
  refundAddress?: string;
}

export async function buildTHORChainQuoteRequestFromPair(
  input: BuildTHORChainQuoteRequestFromPairInput,
): Promise<THORChainQuoteRequest | null> {
  const [fromAsset, toAsset] = await Promise.all([
    resolveTHORChainAsset(input.srcChainId, input.tokenIn),
    resolveTHORChainAsset(input.dstChainId, input.tokenOut),
  ]);
  if (!fromAsset || !toAsset) return null;

  return {
    amountIn: input.amountIn,
    srcChainId: input.srcChainId,
    dstChainId: input.dstChainId,
    tokenIn: input.tokenIn,
    tokenOut: input.tokenOut,
    fromAsset: fromAsset.asset,
    toAsset: toAsset.asset,
    amountInThorchain: toTHORChainAmount(input.amountIn, fromAsset.decimals),
    fromAssetDecimals: fromAsset.decimals,
    toAssetDecimals: toAsset.decimals,
    destinationAddress: normalizeDestinationAddress(input.dstChainId, input.destinationAddress),
    refundAddress: normalizeRefundAddress(input.srcChainId, input.refundAddress),
  };
}

export function shouldCacheOfferSet(offerSet: OfferSet): boolean {
  return offerSet.offers.every((offer) => offer.executionMode !== 'provider_direct' && offer.rail !== Rail.THORCHAIN);
}

export function shouldReuseCachedOfferSet(offerSet: OfferSet): boolean {
  return shouldCacheOfferSet(offerSet);
}

export function isQuoteCacheable(quote: QuoteResult): boolean {
  return quote.rail !== Rail.THORCHAIN && quote.rail !== Rail.GASZIP && !quote.layerZeroValueTransferApiQuoteId;
}

async function resolveTHORChainAsset(chainId: number, token: string): Promise<ResolvedTHORChainAsset | null> {
  const notation = normalizeNotation(token);
  if (notation) return resolveNotationAsset(notation);

  const nativeAlias = nativeChainAlias(chainId);
  if (nativeAlias) {
    const poolAsset = await resolvePoolAssetByTokenId(nativeAlias, token);
    if (poolAsset) return poolAsset;

    const nativeAsset = nativeChainAsset(chainId, token);
    if (nativeAsset) return nativeAsset;
    return null;
  }

  const address = normalizeEvmAddress(token);
  if (!address) return null;

  const chain = await resolveThorchainEvmChainAlias(chainId);
  if (!chain) return null;

  if (NATIVE_PLACEHOLDERS.has(address.toLowerCase())) {
    return {
      asset: `${chain}.ETH`,
      decimals: defaultDecimalsForTHORChainAsset(`${chain}.ETH`),
    };
  }

  const configured = await resolveConfiguredEvmAsset(chainId, address);
  if (configured) return configured;

  const poolAsset = await resolvePoolEvmAsset(chain, address);
  if (poolAsset) return poolAsset;

  return null;
}

function nativeChainAlias(chainId: number): string | null {
  if (chainId === CHAIN_ID.BTC) return 'BTC';
  if (chainId === CHAIN_ID.SOL) return 'SOL';
  if (chainId === CHAIN_ID.DOGE) return 'DOGE';
  if (chainId === CHAIN_ID.LTC) return 'LTC';
  if (chainId === CHAIN_ID.BCH) return 'BCH';
  if (chainId === CHAIN_ID.COSMOS) return 'GAIA';
  return null;
}

function nativeChainAsset(chainId: number, token: string): ResolvedTHORChainAsset | null {
  const alias = nativeChainAlias(chainId);
  if (!alias) return null;
  const normalized = token.trim().toUpperCase();
  if (normalized !== alias && normalized !== `${alias}.${alias}`) return null;
  const asset = `${alias}.${alias}`;
  return {
    asset,
    decimals: defaultDecimalsForTHORChainAsset(asset),
  };
}

async function resolveNotationAsset(notation: string): Promise<ResolvedTHORChainAsset> {
  const poolAsset = await findPoolAsset(notation);
  return {
    asset: poolAsset?.asset ?? notation,
    decimals: poolAsset?.decimals ?? defaultDecimalsForTHORChainAsset(notation),
  };
}

async function resolvePoolAssetByTokenId(chain: string, token: string): Promise<ResolvedTHORChainAsset | null> {
  const target = token.trim();
  if (!target) return null;
  const assets = await getTHORChainPoolAssets();
  for (const asset of assets) {
    const parsed = parsePoolTokenAsset(asset.asset);
    if (!parsed) continue;
    if (parsed.chain !== chain) continue;
    if (parsed.tokenId !== target) continue;
    return {
      asset: asset.asset,
      decimals: asset.decimals ?? defaultDecimalsForTHORChainAsset(asset.asset),
    };
  }
  return null;
}

async function resolveConfiguredEvmAsset(chainId: number, address: string): Promise<ResolvedTHORChainAsset | null> {
  const resolved = address.toLowerCase();
  const chain = await resolveThorchainEvmChainAlias(chainId);
  if (!chain) return null;
  const usdc = getSettlementTokenAddress(chainId, SettlementToken.USDC, Rail.THORCHAIN);
  if (usdc && usdc.toLowerCase() === resolved) {
    const asset = `${chain}.USDC-${address.toUpperCase()}`;
    const poolAsset = await findPoolAsset(asset);
    return {
      asset,
      decimals: poolAsset?.decimals ?? 6,
    };
  }
  const usdt = getSettlementTokenAddress(chainId, SettlementToken.USDT, Rail.THORCHAIN);
  if (usdt && usdt.toLowerCase() === resolved) {
    const asset = `${chain}.USDT-${address.toUpperCase()}`;
    const poolAsset = await findPoolAsset(asset);
    return {
      asset,
      decimals: poolAsset?.decimals ?? 6,
    };
  }
  const weth =
    getSettlementTokenAddress(chainId, SettlementToken.ETH, Rail.THORCHAIN)
    ?? getSettlementTokenAddress(chainId, SettlementToken.WETH, Rail.THORCHAIN);
  if (weth && weth.toLowerCase() === resolved) {
    const asset = `${chain}.ETH`;
    const poolAsset = await findPoolAsset(asset);
    return {
      asset,
      decimals: poolAsset?.decimals ?? defaultDecimalsForTHORChainAsset(asset),
    };
  }
  return null;
}

async function resolvePoolEvmAsset(chain: string, address: string): Promise<ResolvedTHORChainAsset | null> {
  const assets = await getTHORChainPoolAssets();
  const target = address.toLowerCase();
  for (const asset of assets) {
    const parsed = parsePoolEvmAsset(asset.asset);
    if (!parsed) continue;
    if (parsed.chain !== chain) continue;
    if (parsed.address !== target) continue;
    return {
      asset: asset.asset,
      decimals: asset.decimals ?? defaultDecimalsForTHORChainAsset(asset.asset),
    };
  }
  return null;
}

function parsePoolEvmAsset(asset: string): { chain: string; address: string } | null {
  const normalized = asset.trim().toUpperCase();
  const match = normalized.match(/^([A-Z0-9]+)\.[A-Z0-9]+-0X([0-9A-F]{40})$/);
  if (!match) return null;
  return {
    chain: match[1],
    address: `0x${match[2].toLowerCase()}`,
  };
}

function parsePoolTokenAsset(asset: string): { chain: string; tokenId: string } | null {
  const trimmed = asset.trim();
  const match = trimmed.match(/^([A-Za-z0-9]+)\.[A-Za-z0-9]+-(.+)$/);
  if (!match) return null;
  return {
    chain: match[1].toUpperCase(),
    tokenId: match[2],
  };
}

async function findPoolAsset(asset: string): Promise<THORChainPoolAsset | null> {
  const normalized = asset.trim().toUpperCase();
  const assets = await getTHORChainPoolAssets();
  return assets.find((candidate) => candidate.asset.trim().toUpperCase() === normalized) ?? null;
}

async function getTHORChainPoolAssets(): Promise<THORChainPoolAsset[]> {
  const now = Date.now();
  if (cachedPools && cachedPools.expiresAt > now) return cachedPools.assets;

  try {
    const baseUrl = (process.env.THORCHAIN_BASE_URL ?? 'https://thornode.thorchain.network').replace(/\/$/, '');
    const response = await fetch(`${baseUrl}/thorchain/pools`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return [];
    const data = await response.json() as unknown;
    if (!Array.isArray(data)) return [];

    const assets = data
      .map((row) => {
        if (!row || typeof row !== 'object') return null;
        const record = row as Record<string, unknown>;
        const status = String(record.status ?? '').toLowerCase();
        if (status.length > 0 && status !== 'available') return null;
        const asset = String(record.asset ?? '').trim();
        if (!asset) return null;
        const decimals = parseDecimals(record.nativeDecimal ?? record.native_decimal ?? record.decimals);
        return {
          asset,
          decimals,
        };
      })
      .filter((asset): asset is THORChainPoolAsset => asset !== null);

    cachedPools = {
      assets,
      expiresAt: now + THORCHAIN_POOL_TTL_MS,
    };
    return assets;
  } catch {
    return [];
  }
}

function parseDecimals(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return Math.floor(parsed);
}

function isSupportedRouteAssetAlias(routeAssetAlias: string): boolean {
  switch (routeAssetAlias.trim().toUpperCase()) {
    case 'USDC':
    case 'USDT':
    case 'ETH':
    case 'WETH':
    case 'ETH.ETH':
    case 'BTC':
    case 'BTC.BTC':
    case 'SOL':
    case 'SOL.SOL':
      return true;
    default:
      return false;
  }
}

async function resolveThorchainEvmChainAlias(chainId: number): Promise<string | null> {
  const override = process.env[`CHAIN_${chainId}_THORCHAIN_CHAIN_ALIAS`]?.trim();
  if (override) return override.toUpperCase();

  const staticAlias = THORCHAIN_EVM_CHAIN_ALIASES[chainId];
  if (staticAlias) return staticAlias;

  const assets = await getTHORChainPoolAssets();
  const addresses = new Set<string>();
  for (const token of [SettlementToken.USDC, SettlementToken.USDT, SettlementToken.ETH] as const) {
    const addr = getSettlementTokenAddress(chainId, token, Rail.THORCHAIN)
      ?? getSettlementTokenAddress(chainId, token);
    if (addr) addresses.add(addr.toLowerCase());
  }
  if (addresses.size === 0) return null;

  const score = new Map<string, number>();
  for (const asset of assets) {
    const parsed = parsePoolEvmAsset(asset.asset);
    if (!parsed) continue;
    if (!addresses.has(parsed.address)) continue;
    score.set(parsed.chain, (score.get(parsed.chain) ?? 0) + 1);
  }
  if (score.size === 0) return null;

  return [...score.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

function normalizeDestinationAddress(
  chainId: number,
  destinationAddress?: string,
): string | undefined {
  if (!destinationAddress) return undefined;
  const trimmed = destinationAddress.trim();
  if (!trimmed) return undefined;

  if (!isKnownEvmChain(chainId)) return trimmed;

  try {
    return getAddress(trimmed);
  } catch {
    return undefined;
  }
}

function normalizeRefundAddress(
  chainId: number,
  refundAddress?: string,
): string | undefined {
  if (!refundAddress) return undefined;
  const trimmed = refundAddress.trim();
  if (!trimmed) return undefined;

  if (!isKnownEvmChain(chainId)) return trimmed;

  try {
    return getAddress(trimmed);
  } catch {
    return undefined;
  }
}

function normalizeNotation(token?: string): string | null {
  if (!token) return null;
  const trimmed = token.trim();
  if (!trimmed || !trimmed.includes('.')) return null;
  const dash = trimmed.indexOf('-');
  if (dash < 0) return trimmed.toUpperCase();
  return `${trimmed.slice(0, dash).toUpperCase()}-${trimmed.slice(dash + 1)}`;
}

function normalizeEvmAddress(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    return getAddress(value.trim().replace(/^0X/, '0x'));
  } catch {
    return undefined;
  }
}

function isEvmChain(chainId: number): boolean {
  return !NON_EVM_CHAINS.has(chainId);
}

function isKnownEvmChain(chainId: number): boolean {
  const chain = getChainConfig(chainId);
  return chain?.isEVM ?? false;
}

function toTHORChainAmount(amount: bigint, nativeDecimals: number): bigint {
  if (nativeDecimals === THORCHAIN_AMOUNT_DECIMALS) return amount;
  if (nativeDecimals > THORCHAIN_AMOUNT_DECIMALS) {
    return amount / (10n ** BigInt(nativeDecimals - THORCHAIN_AMOUNT_DECIMALS));
  }
  return amount * (10n ** BigInt(THORCHAIN_AMOUNT_DECIMALS - nativeDecimals));
}

function defaultDecimalsForTHORChainAsset(asset: string): number {
  const normalized = asset.trim().toUpperCase();
  if (normalized.includes('.USDC-') || normalized.endsWith('.USDC')) return 6;
  if (normalized.includes('.USDT-') || normalized.endsWith('.USDT')) return 6;
  if (normalized.startsWith('BTC.')) return 8;
  if (normalized.startsWith('DOGE.')) return 8;
  if (normalized.startsWith('LTC.')) return 8;
  if (normalized.startsWith('BCH.')) return 8;
  if (normalized.startsWith('SOL.')) return 9;
  return 18;
}
