import type { ExecutionContext } from '../core/ExecutionContext';
import type { IntentBasket, BasketQuote, BasketExecutionPlan } from '../core/IntentBasket';
import { BasketQuoteEngine } from './BasketQuoteEngine';
import { WalletScanner } from './WalletScanner';

export interface WalletLiquidationRequest {
  wallet: string;
  chainIds: number[];
  target: {
    chainId: number;
    token: string;
    recipient?: string;
    nativeAddress?: string;
  };
  tokensByChain?: Record<number, string[]>;
  minBalanceWei?: string;
  slippageBps?: number;
}

export interface WalletLiquidationQuote {
  basket: IntentBasket;
  quote: BasketQuote;
  scan: Awaited<ReturnType<WalletScanner['scan']>>;
}

export class WalletLiquidator {
  constructor(
    private readonly scanner: WalletScanner,
    private readonly basketQuoteEngine: BasketQuoteEngine,
  ) {}

  async quote(
    request: WalletLiquidationRequest,
    ctx: ExecutionContext,
  ): Promise<WalletLiquidationQuote | { error: string }> {
    const basket = await this.buildBasket(request, ctx);
    if ('error' in basket) return basket;
    const quote = await this.basketQuoteEngine.quote(basket.basket, ctx);
    if ('error' in quote) return quote;
    return {
      basket: basket.basket,
      quote,
      scan: basket.scan,
    };
  }

  async execute(
    request: WalletLiquidationRequest,
    attribution: {
      partnerApiKey?: string;
      partnerId?: string;
      integratorId?: string;
      agentId?: string;
      solverId?: string;
      routeSource?: 'partner-api' | 'agent-sdk' | 'external-solver' | 'ui' | 'internal';
    },
    ctx: ExecutionContext,
    options: { mode?: 'sequential' | 'multicall' } = {},
  ): Promise<{ basket: IntentBasket; plan: BasketExecutionPlan } | { error: string }> {
    const built = await this.buildBasket(request, ctx);
    if ('error' in built) return built;
    const plan = await this.basketQuoteEngine.executeBasket(
      built.basket,
      request.wallet,
      attribution,
      ctx,
      { basketId: built.basket.basketId, mode: options.mode },
    );
    if ('error' in plan) return plan;
    return { basket: built.basket, plan };
  }

  private async buildBasket(
    request: WalletLiquidationRequest,
    ctx: ExecutionContext,
  ): Promise<{ basket: IntentBasket; scan: Awaited<ReturnType<WalletScanner['scan']>> } | { error: string }> {
    const scan = await this.scanner.scan({
      wallet: request.wallet,
      chainIds: request.chainIds,
      tokensByChain: request.tokensByChain,
    }, ctx);

    const minBalance = request.minBalanceWei && /^\d+$/.test(request.minBalanceWei)
      ? BigInt(request.minBalanceWei)
      : 0n;
    const inputs = scan.balances
      .filter((balance) => BigInt(balance.balance) > minBalance)
      .map((balance) => ({
        chainId: balance.chainId,
        token: balance.token,
        decimals: balance.decimals,
        amount: balance.balance,
        wallet: request.wallet,
      }));

    if (inputs.length === 0) {
      return { error: 'wallet scan found no balances eligible for liquidation' };
    }

    return {
      scan,
      basket: {
        basketId: undefined,
        mode: 'wallet-liquidator',
        inputs,
        outputs: [{
          chainId: request.target.chainId,
          token: request.target.token,
          recipient: request.target.recipient ?? request.wallet,
          nativeAddress: request.target.nativeAddress,
        }],
        constraints: {
          slippageBps: request.slippageBps ?? 50,
        },
      },
    };
  }
}
