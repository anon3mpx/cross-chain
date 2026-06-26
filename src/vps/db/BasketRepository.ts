import type { Pool } from 'pg';
import type { BasketExecutionPlan } from '../services/BasketQuoteEngine';
import type { BasketQuote, IntentBasket } from '../core/IntentBasket';
import { toDbJson } from './json';

export interface BasketRecord {
  basketId: string;
  mode: IntentBasket['mode'];
  basket: IntentBasket;
  quote?: BasketQuote;
  executionPlan?: BasketExecutionPlan;
  userAddress?: string;
  partnerId?: string;
  integratorId?: string;
  agentId?: string;
  routeSource?: string;
  createdAt: number;
  updatedAt: number;
}

export interface BasketRepository {
  upsertQuote(input: {
    basketId: string;
    basket: IntentBasket;
    quote: BasketQuote;
    userAddress?: string;
    partnerId?: string;
    integratorId?: string;
    agentId?: string;
    routeSource?: string;
  }): Promise<BasketRecord>;
  attachExecutionPlan(basketId: string, executionPlan: BasketExecutionPlan): Promise<BasketRecord | null>;
  get(basketId: string): Promise<BasketRecord | null>;
}

export class InMemoryBasketRepository implements BasketRepository {
  private readonly records = new Map<string, BasketRecord>();

  async upsertQuote(input: {
    basketId: string;
    basket: IntentBasket;
    quote: BasketQuote;
    userAddress?: string;
    partnerId?: string;
    integratorId?: string;
    agentId?: string;
    routeSource?: string;
  }): Promise<BasketRecord> {
    const current = this.records.get(input.basketId);
    const now = Date.now();
    const record: BasketRecord = {
      basketId: input.basketId,
      mode: input.basket.mode,
      basket: input.basket,
      quote: input.quote,
      executionPlan: current?.executionPlan,
      userAddress: input.userAddress ?? current?.userAddress,
      partnerId: input.partnerId ?? current?.partnerId,
      integratorId: input.integratorId ?? current?.integratorId,
      agentId: input.agentId ?? current?.agentId,
      routeSource: input.routeSource ?? current?.routeSource,
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
    };
    this.records.set(input.basketId, record);
    return record;
  }

  async attachExecutionPlan(basketId: string, executionPlan: BasketExecutionPlan): Promise<BasketRecord | null> {
    const current = this.records.get(basketId);
    if (!current) return null;
    const updated: BasketRecord = {
      ...current,
      executionPlan,
      updatedAt: Date.now(),
    };
    this.records.set(basketId, updated);
    return updated;
  }

  async get(basketId: string): Promise<BasketRecord | null> {
    return this.records.get(basketId) ?? null;
  }
}

export class PostgresBasketRepository implements BasketRepository {
  constructor(private readonly pool: Pool) {}

  async upsertQuote(input: {
    basketId: string;
    basket: IntentBasket;
    quote: BasketQuote;
    userAddress?: string;
    partnerId?: string;
    integratorId?: string;
    agentId?: string;
    routeSource?: string;
  }): Promise<BasketRecord> {
    const result = await this.pool.query(
      `INSERT INTO intent_baskets (
         basket_id, mode, basket_payload, quote_payload, execution_plan,
         user_address, partner_id, integrator_id, agent_id, route_source
       ) VALUES (
         $1, $2, $3::jsonb, $4::jsonb, NULL,
         $5, $6, $7, $8, $9
       )
       ON CONFLICT (basket_id) DO UPDATE SET
         mode = EXCLUDED.mode,
         basket_payload = EXCLUDED.basket_payload,
         quote_payload = EXCLUDED.quote_payload,
         user_address = COALESCE(EXCLUDED.user_address, intent_baskets.user_address),
         partner_id = COALESCE(EXCLUDED.partner_id, intent_baskets.partner_id),
         integrator_id = COALESCE(EXCLUDED.integrator_id, intent_baskets.integrator_id),
         agent_id = COALESCE(EXCLUDED.agent_id, intent_baskets.agent_id),
         route_source = COALESCE(EXCLUDED.route_source, intent_baskets.route_source),
         updated_at = NOW()
       RETURNING *`,
      [
        input.basketId,
        input.basket.mode,
        JSON.stringify(toDbJson(input.basket)),
        JSON.stringify(toDbJson(input.quote)),
        input.userAddress ?? null,
        input.partnerId ?? null,
        input.integratorId ?? null,
        input.agentId ?? null,
        input.routeSource ?? null,
      ],
    );
    return rowToBasketRecord(result.rows[0]);
  }

  async attachExecutionPlan(basketId: string, executionPlan: BasketExecutionPlan): Promise<BasketRecord | null> {
    const result = await this.pool.query(
      `UPDATE intent_baskets
       SET execution_plan = $2::jsonb,
           updated_at = NOW()
       WHERE basket_id = $1
       RETURNING *`,
      [basketId, JSON.stringify(toDbJson(executionPlan))],
    );
    if (result.rowCount === 0) return null;
    return rowToBasketRecord(result.rows[0]);
  }

  async get(basketId: string): Promise<BasketRecord | null> {
    const result = await this.pool.query(
      `SELECT * FROM intent_baskets WHERE basket_id = $1`,
      [basketId],
    );
    if (result.rowCount === 0) return null;
    return rowToBasketRecord(result.rows[0]);
  }
}

function rowToBasketRecord(row: Record<string, unknown>): BasketRecord {
  return {
    basketId: String(row.basket_id),
    mode: String(row.mode) as IntentBasket['mode'],
    basket: row.basket_payload as IntentBasket,
    quote: row.quote_payload as BasketQuote | undefined,
    executionPlan: row.execution_plan as BasketExecutionPlan | undefined,
    userAddress: typeof row.user_address === 'string' ? row.user_address : undefined,
    partnerId: typeof row.partner_id === 'string' ? row.partner_id : undefined,
    integratorId: typeof row.integrator_id === 'string' ? row.integrator_id : undefined,
    agentId: typeof row.agent_id === 'string' ? row.agent_id : undefined,
    routeSource: typeof row.route_source === 'string' ? row.route_source : undefined,
    createdAt: new Date(String(row.created_at)).getTime(),
    updatedAt: new Date(String(row.updated_at)).getTime(),
  };
}
