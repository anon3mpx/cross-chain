const PROVIDER_DIRECT_REQUIRED_CONSTRAINTS = [
  'intents_rail_check',
  'intents_fallback_rail_check',
  'intent_rail_attempts_rail_check',
] as const;

type PgQueryable = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<{ conname?: string; def?: string }> }>;
};

type ConstraintErrorLike = {
  code?: string;
  constraint?: string;
  message?: string;
};

export function staleProviderDirectRailSchemaMessage(): string {
  return 'Postgres schema is missing provider-direct rail support. Run `npm run db:migrate` against the live database before using Gas.zip or Hyperlane Nexus offers.';
}

export async function assertPostgresRailSchemaCompatibility(client: PgQueryable): Promise<void> {
  const { rows } = await client.query(
    `SELECT conname, pg_get_constraintdef(oid) AS def
     FROM pg_constraint
     WHERE conname = ANY($1)`,
    [PROVIDER_DIRECT_REQUIRED_CONSTRAINTS],
  );

  const defs = new Map<string, string>();
  for (const row of rows) {
    const name = String(row.conname ?? '').trim();
    if (!name) continue;
    defs.set(name, String(row.def ?? ''));
  }

  for (const name of PROVIDER_DIRECT_REQUIRED_CONSTRAINTS) {
    const def = defs.get(name);
    const normalized = def?.toUpperCase() ?? '';
    if (!def || !normalized.includes('GASZIP') || !normalized.includes('HYPERLANE_NEXUS')) {
      throw new Error(staleProviderDirectRailSchemaMessage());
    }
  }
}

export function toFriendlyIntentPersistenceError(
  error: unknown,
  context: { rail?: string | null; fallbackRail?: string | null } = {},
): Error | null {
  const pgError = error as ConstraintErrorLike | null | undefined;
  if (!pgError || pgError.code !== '23514') return null;

  const rail = String(context.rail ?? '').toUpperCase();
  const fallbackRail = String(context.fallbackRail ?? '').toUpperCase();
  const constraint = String(pgError.constraint ?? '').trim();
  const relevantConstraint = PROVIDER_DIRECT_REQUIRED_CONSTRAINTS.includes(constraint as typeof PROVIDER_DIRECT_REQUIRED_CONSTRAINTS[number]);

  if ((rail === 'GASZIP' || rail === 'HYPERLANE_NEXUS' || fallbackRail === 'GASZIP' || fallbackRail === 'HYPERLANE_NEXUS') && relevantConstraint) {
    return new Error(staleProviderDirectRailSchemaMessage());
  }

  return null;
}
