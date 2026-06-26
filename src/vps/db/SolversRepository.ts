import type { Pool } from 'pg';

export type SolverType = 'internal' | 'external' | 'third-party';

export interface SolverRecord {
  id: string;
  type: SolverType;
  displayName: string;
  contactEmail?: string;
  capabilities: Record<string, unknown>;
  reliability?: Record<string, unknown>;
  volumeStats?: {
    total: number;
    settled: number;
    failed: number;
    stuck: number;
    successRate: number;
  };
  active: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface SolversRepository {
  upsert(record: Omit<SolverRecord, 'createdAt' | 'updatedAt'>): Promise<SolverRecord>;
  get(id: string): Promise<SolverRecord | null>;
  list(filter?: { type?: SolverType; activeOnly?: boolean }): Promise<SolverRecord[]>;
  listWithStats(filter?: { type?: SolverType; activeOnly?: boolean }, windowMs?: number): Promise<SolverRecord[]>;
  setActive(id: string, active: boolean): Promise<void>;
}

export class PostgresSolversRepository implements SolversRepository {
  constructor(private readonly pool: Pool) {}

  async upsert(input: Omit<SolverRecord, 'createdAt' | 'updatedAt'>): Promise<SolverRecord> {
    const result = await this.pool.query(
      `INSERT INTO solvers (id, type, display_name, contact_email, capabilities, reliability, active)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7)
       ON CONFLICT (id) DO UPDATE SET
         type = EXCLUDED.type,
         display_name = EXCLUDED.display_name,
         contact_email = EXCLUDED.contact_email,
         capabilities = EXCLUDED.capabilities,
         reliability = COALESCE(EXCLUDED.reliability, solvers.reliability),
         active = EXCLUDED.active
       RETURNING *`,
      [
        input.id,
        input.type,
        input.displayName,
        input.contactEmail ?? null,
        JSON.stringify(input.capabilities ?? {}),
        input.reliability ? JSON.stringify(input.reliability) : null,
        input.active,
      ],
    );
    return rowToRecord(result.rows[0]);
  }

  async get(id: string): Promise<SolverRecord | null> {
    const result = await this.pool.query(`SELECT * FROM solvers WHERE id = $1`, [id]);
    if (result.rowCount === 0) return null;
    return rowToRecord(result.rows[0]);
  }

  async list(filter: { type?: SolverType; activeOnly?: boolean } = {}): Promise<SolverRecord[]> {
    const where: string[] = [];
    const params: unknown[] = [];
    if (filter.type) {
      params.push(filter.type);
      where.push(`type = $${params.length}`);
    }
    if (filter.activeOnly) where.push('active = true');
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const result = await this.pool.query(`SELECT * FROM solvers ${clause} ORDER BY type, id`, params);
    return result.rows.map(rowToRecord);
  }

  async listWithStats(
    filter: { type?: SolverType; activeOnly?: boolean } = {},
    windowMs = 30 * 24 * 60 * 60 * 1000,
  ): Promise<SolverRecord[]> {
    const records = await this.list(filter);
    const result = await this.pool.query(
      `WITH win AS (
         SELECT solver_id,
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE status = 'SETTLED')::int AS settled,
                COUNT(*) FILTER (WHERE status = 'FAILED')::int AS failed,
                COUNT(*) FILTER (WHERE status = 'STUCK')::int AS stuck
         FROM route_outcomes
         WHERE observed_at > NOW() - ($1::bigint * INTERVAL '1 millisecond')
           AND solver_id IS NOT NULL
         GROUP BY solver_id
       )
       SELECT * FROM win`,
      [windowMs.toString()],
    );
    const byId = new Map<string, Record<string, unknown>>(result.rows.map((row) => [String(row.solver_id), row]));
    return records.map((record) => {
      const stat = byId.get(record.id);
      return stat
        ? {
            ...record,
            volumeStats: {
              total: Number(stat.total ?? 0),
              settled: Number(stat.settled ?? 0),
              failed: Number(stat.failed ?? 0),
              stuck: Number(stat.stuck ?? 0),
              successRate: Number(stat.total ?? 0) > 0 ? Number(stat.settled ?? 0) / Number(stat.total ?? 0) : 0,
            },
          }
        : record;
    });
  }

  async setActive(id: string, active: boolean): Promise<void> {
    await this.pool.query(`UPDATE solvers SET active = $2 WHERE id = $1`, [id, active]);
  }
}

function rowToRecord(row: Record<string, unknown>): SolverRecord {
  return {
    id: String(row.id),
    type: row.type as SolverType,
    displayName: String(row.display_name),
    contactEmail: typeof row.contact_email === 'string' ? row.contact_email : undefined,
    capabilities: (row.capabilities as Record<string, unknown>) ?? {},
    reliability: (row.reliability as Record<string, unknown>) ?? undefined,
    active: Boolean(row.active),
    createdAt: new Date(String(row.created_at)).getTime(),
    updatedAt: new Date(String(row.updated_at)).getTime(),
  };
}
