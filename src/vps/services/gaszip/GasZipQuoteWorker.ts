import { getChainConfig } from '../../config/chains';
import { DestinationGasRequest, QuoteRequest } from '../../types';
import { GasZipClient, type GasZipClientLike } from './GasZipClient';

const DEFAULT_DIRECT_DEPOSIT_ADDRESS = '0x391E7C679d29bD940d63be94AD22A25d25b5A604';
const DEFAULT_EXPIRY_SECONDS = 90;
const NATIVE_TOKEN_ALIASES = new Set([
  '0x0000000000000000000000000000000000000000',
  '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
]);

export interface GasZipQuoteResult {
  srcChainId: number;
  dstChainId: number;
  recipient: string;
  requestedAmountWei: string;
  expectedAmountWei: string;
  sourceValueWei: string;
  expiresAt: number;
  directDepositAddress: string;
  calldata: string;
  sourceSymbol: string;
  destinationSymbol: string;
  providerFeeUsd: number;
  settlementTimeSeconds: number;
}

export interface GasZipQuoteWorkerOptions {
  enabled?: boolean;
  directDepositAddress?: string;
  expirySeconds?: number;
}

export class GasZipQuoteWorker {
  private readonly client: GasZipClientLike;
  private readonly enabled: boolean;
  private readonly directDepositAddress: string;
  private readonly expirySeconds: number;

  constructor(
    client: GasZipClientLike = new GasZipClient(),
    options: GasZipQuoteWorkerOptions = {},
  ) {
    this.client = client;
    this.enabled = options.enabled ?? this._readBoolEnv('ENABLE_GASZIP_DIRECT_DEPOSIT', false);
    this.directDepositAddress = options.directDepositAddress
      ?? process.env.GASZIP_DIRECT_DEPOSIT_ADDRESS
      ?? DEFAULT_DIRECT_DEPOSIT_ADDRESS;
    this.expirySeconds = options.expirySeconds ?? DEFAULT_EXPIRY_SECONDS;
  }

  async quoteDirectDeposit(input: QuoteRequest): Promise<GasZipQuoteResult | null> {
    if (!this.enabled) return null;

    const gasRequest = this._pickGasRequest(input.destinationGas, input.dstChainId);
    if (!gasRequest) return null;
    if (!this._isNativeTokenLike(input.tokenIn) || !this._isNativeTokenLike(input.tokenOut)) return null;

    const srcChain = getChainConfig(input.srcChainId);
    const dstChain = getChainConfig(input.dstChainId);
    if (!srcChain?.isEVM || !dstChain) return null;

    const recipient = gasRequest.recipient ?? input.nativeDstAddress ?? input.userAddress;
    if (!recipient) return null;

    const chains = await this.client.listChains();
    const sourceChain = chains.chains.find((chain) => chain.chain === input.srcChainId);
    const destinationChain = chains.chains.find((chain) => chain.chain === input.dstChainId);
    if (!sourceChain || !destinationChain) return null;

    const quoteReverse = await this.client.getQuoteReverse(
      input.srcChainId,
      gasRequest.amountWei,
      input.dstChainId,
    );

    const sourceValueWei = String(Math.max(0, Math.trunc(quoteReverse.required)));
    const calldataQuote = await this.client.getCalldataQuote(
      input.srcChainId,
      sourceValueWei,
      [input.dstChainId],
      { to: recipient, from: input.userAddress },
    );

    const outbound = calldataQuote.quotes.find((quote) => quote.chain === input.dstChainId);
    if (!outbound) return null;

    return {
      srcChainId: input.srcChainId,
      dstChainId: input.dstChainId,
      recipient,
      requestedAmountWei: gasRequest.amountWei,
      expectedAmountWei: outbound.expected,
      sourceValueWei,
      expiresAt: Math.floor(Date.now() / 1000) + this.expirySeconds,
      directDepositAddress: this.directDepositAddress,
      calldata: calldataQuote.calldata,
      sourceSymbol: sourceChain.symbol,
      destinationSymbol: destinationChain.symbol,
      providerFeeUsd: 0,
      settlementTimeSeconds: Math.max(1, Math.ceil(Number(outbound.speed) || 0)),
    };
  }

  private _pickGasRequest(
    requests: DestinationGasRequest[] | undefined,
    dstChainId: number,
  ): DestinationGasRequest | null {
    if (!requests || requests.length === 0) return null;
    const match = requests.find((request) =>
      (request.provider === undefined || request.provider === 'gaszip')
      && request.chainId === dstChainId,
    );
    return match ?? null;
  }

  private _isNativeTokenLike(value: string): boolean {
    return NATIVE_TOKEN_ALIASES.has(value.trim().toLowerCase());
  }

  private _readBoolEnv(name: string, fallback: boolean): boolean {
    const raw = process.env[name];
    if (!raw) return fallback;
    const normalized = raw.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    return fallback;
  }
}
