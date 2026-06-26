# Partner Onboarding And API Keys Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make partner onboarding production-ready by replacing process-local API key registration with durable partner records, aligned tier metadata, admin tier management, and a dedicated Partner API OpenAPI document.

**Architecture:** Keep `partners.empx.io` as the partner-only surface and keep `crosschain.empx.io` focused on app/internal StatusAPI routes. Registration remains public, operational `/partner/*` routes remain protected by `x-api-key`, partner state moves behind a repository interface with Postgres persistence when available and an in-memory fallback for tests/local development. Public tier metadata and partner API documentation become separate from the existing non-partner `openapi.json`.

**Tech Stack:** TypeScript, Node.js, Express, Postgres via `pg`, native `node:test`, static OpenAPI 3.0 JSON, Docker/Caddy partner service split.

---

## Product Constraint

- Do not build or depend on a partner dashboard, signup UI, or separate registration interface in this phase.
- Partner onboarding is API-first: partners call `POST /partner/register` directly from docs, Postman/cURL, or an internal ops script.
- Tier upgrades are ops/admin driven through authenticated admin endpoints and direct partner communication.
- `partner.openapi.json` is a machine-readable contract for SDK consumers, Postman imports, partner docs, and internal ops tooling; it is not a public Swagger UI requirement.

## Current State

- `POST /partner/register` exists in `src/vps/api/PartnerAPI.ts` and returns `apiKey`, `webhookSecret`, tier, and limits.
- `ApiKeyManager` stores partners, rate-limit counters, and rebates in process-local `Map` instances in `src/vps/services/ApiKeyManager.ts`.
- `buildRuntime()` creates `new ApiKeyManager()` when `enablePartnerApi` is true, so partner keys are lost on service restart.
- `PartnerTier` currently has `FREE`, `GROWTH`, `PARTNER`, and `ENTERPRISE` with defaults in `ApiKeyManager`.
- `docs/partner-integration-guide.md` uses `Public` and `Hobbyist`, which is out of sync with the code and README tier names.
- `openapi.json` explicitly documents non-partner StatusAPI/AdminAPI routes and intentionally excludes `/partner/*`.
- The SDK now defaults to `https://partners.empx.io`, so partner docs and OpenAPI must treat that host as canonical.

## Missing Pieces

- Durable partner registry for API keys, webhook secrets, allowed origins, payout address, active status, and tier.
- API key hashing at rest. The plaintext API key should be shown only once at registration.
- Webhook secret hashing or encrypted storage policy. Current in-memory plaintext is acceptable only for local development.
- Admin or ops flow to update tier, activate/deactivate a partner, set allowed origins, and rotate keys/secrets.
- Public `GET /partner/tiers` endpoint so docs, OpenAPI, SDK examples, and internal ops tooling pull from the same product model.
- Dedicated `partner.openapi.json` for `https://partners.empx.io`.
- Tests proving registration survives process-manager recreation when backed by Postgres.
- Docs alignment across README, partner guide, and service split plan.

## File Structure

- Create `src/vps/db/PartnerRepository.ts`: repository interface and partner row types.
- Create `src/vps/db/PostgresPartnerRepository.ts`: Postgres-backed partner persistence.
- Create `src/vps/db/InMemoryPartnerRepository.ts`: local/test implementation with the same interface.
- Create `src/vps/db/migrations/20260617_add_partner_api_keys.sql`: add durable `partners` storage.
- Modify `src/vps/services/ApiKeyManager.ts`: accept a repository, hash API keys, keep rate-limit counters in memory for now, and expose async methods.
- Modify `src/vps/api/PartnerAPI.ts`: add `GET /partner/tiers`, make register async, add clear response contracts.
- Modify `src/vps/api/AdminAPI.ts`: add admin partner management endpoints under `/admin/partners/*`.
- Modify `src/vps/app/runtime.ts`: build Postgres or in-memory partner repository based on existing Postgres availability.
- Create `partner.openapi.json`: partner-only OpenAPI spec for `https://partners.empx.io`.
- Modify `README.md` and `docs/partner-integration-guide.md`: align tier names and registration URL.
- Create `tests/vps/partner-onboarding.test.ts`: registration, tiers, auth, persistence, and admin tier changes.
- Update `tests/vps/partner-api-service-split.test.ts`: verify partner OpenAPI and tiers are served only by partner service if serving static docs is added.

---

### Task 1: Add Shared Partner Tier Metadata

**Files:**
- Modify: `src/vps/services/ApiKeyManager.ts`
- Test: `tests/vps/partner-onboarding.test.ts`

- [ ] **Step 1: Write the failing tier metadata test**

Create `tests/vps/partner-onboarding.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { PARTNER_TIER_DEFINITIONS, PartnerTier } from '../../src/vps/services/ApiKeyManager';

test('partner tier definitions match the public product model', () => {
  assert.deepEqual(Object.keys(PARTNER_TIER_DEFINITIONS), [
    PartnerTier.FREE,
    PartnerTier.GROWTH,
    PartnerTier.PARTNER,
    PartnerTier.ENTERPRISE,
  ]);
  assert.equal(PARTNER_TIER_DEFINITIONS.FREE.quotesPerMin, 60);
  assert.equal(PARTNER_TIER_DEFINITIONS.GROWTH.feeShareBps, 1500);
  assert.equal(PARTNER_TIER_DEFINITIONS.PARTNER.sla, '99.5%');
  assert.equal(PARTNER_TIER_DEFINITIONS.ENTERPRISE.maxTxPerDay, 500_000);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --import tsx --test tests/vps/partner-onboarding.test.ts`

Expected: FAIL because `PARTNER_TIER_DEFINITIONS` is not exported.

- [ ] **Step 3: Export canonical tier metadata**

In `src/vps/services/ApiKeyManager.ts`, replace private `TIER_DEFAULTS` usage with exported metadata:

```ts
export const PARTNER_TIER_DEFINITIONS: Record<PartnerTier, {
  feeShareBps: number;
  quotesPerMin: number;
  maxTxPerDay: number;
  sla: string;
  approval: 'self_serve' | 'approval_required' | 'contract_required';
}> = {
  [PartnerTier.FREE]: {
    feeShareBps: 0,
    quotesPerMin: 60,
    maxTxPerDay: 500,
    sla: 'none',
    approval: 'self_serve',
  },
  [PartnerTier.GROWTH]: {
    feeShareBps: 1500,
    quotesPerMin: 300,
    maxTxPerDay: 5_000,
    sla: 'none',
    approval: 'approval_required',
  },
  [PartnerTier.PARTNER]: {
    feeShareBps: 2000,
    quotesPerMin: 600,
    maxTxPerDay: 10_000,
    sla: '99.5%',
    approval: 'contract_required',
  },
  [PartnerTier.ENTERPRISE]: {
    feeShareBps: 3000,
    quotesPerMin: 6_000,
    maxTxPerDay: 500_000,
    sla: '99.9%',
    approval: 'contract_required',
  },
};

const TIER_DEFAULTS: Record<PartnerTier, Pick<PartnerConfig, 'feeShareBps' | 'quotesPerMin' | 'maxTxPerDay'>> =
  Object.fromEntries(Object.entries(PARTNER_TIER_DEFINITIONS).map(([tier, value]) => [
    tier,
    {
      feeShareBps: value.feeShareBps,
      quotesPerMin: value.quotesPerMin,
      maxTxPerDay: value.maxTxPerDay,
    },
  ])) as Record<PartnerTier, Pick<PartnerConfig, 'feeShareBps' | 'quotesPerMin' | 'maxTxPerDay'>>;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --import tsx --test tests/vps/partner-onboarding.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/vps/services/ApiKeyManager.ts tests/vps/partner-onboarding.test.ts
git commit -m "feat(partner): define canonical partner tiers"
```

---

### Task 2: Add Public Partner Tiers Endpoint

**Files:**
- Modify: `src/vps/api/PartnerAPI.ts`
- Test: `tests/vps/partner-onboarding.test.ts`

- [ ] **Step 1: Add the failing endpoint test**

Append to `tests/vps/partner-onboarding.test.ts`:

```ts
import express from 'express';
import type { AddressInfo } from 'node:net';
import { buildPartnerAPI } from '../../src/vps/api/PartnerAPI';
import { ApiKeyManager } from '../../src/vps/services/ApiKeyManager';
import { IntentEngine } from '../../src/vps/services/IntentEngine';
import { IntentService } from '../../src/vps/services/IntentService';
import { QuoteEngine } from '../../src/vps/services/QuoteEngine';
import { RpcProviderRegistry } from '../../src/vps/services/RpcProviderRegistry';

async function listen(app: express.Express) {
  const server = await new Promise<ReturnType<express.Express['listen']>>((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const address = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    async close() {
      await new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
    },
  };
}

function partnerApp() {
  const app = express();
  app.use(express.json());
  app.use('/partner', buildPartnerAPI(
    new ApiKeyManager(),
    new IntentService(new IntentEngine()),
    new QuoteEngine(undefined, { thorchainQuoteWorker: undefined }),
    new RpcProviderRegistry({ disableFreeRpcs: true }),
  ));
  return app;
}

test('PartnerAPI exposes public tier definitions without an api key', async () => {
  const server = await listen(partnerApp());
  try {
    const res = await fetch(`${server.baseUrl}/partner/tiers`);
    assert.equal(res.status, 200);
    const body = await res.json() as any;
    assert.equal(body.tiers.FREE.quotesPerMin, 60);
    assert.equal(body.tiers.GROWTH.approval, 'approval_required');
  } finally {
    await server.close();
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --import tsx --test tests/vps/partner-onboarding.test.ts`

Expected: FAIL with `404` for `/partner/tiers`.

- [ ] **Step 3: Implement `GET /partner/tiers` before auth middleware**

In `src/vps/api/PartnerAPI.ts`, import `PARTNER_TIER_DEFINITIONS` and add this route before `router.use(requireKey)`:

```ts
router.get('/tiers', (_req: Request, res: Response) => {
  res.json({
    tiers: PARTNER_TIER_DEFINITIONS,
    defaultTier: PartnerTier.FREE,
  });
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --import tsx --test tests/vps/partner-onboarding.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/vps/api/PartnerAPI.ts tests/vps/partner-onboarding.test.ts
git commit -m "feat(partner): expose public tier metadata"
```

---

### Task 3: Introduce Partner Repository Interface And In-Memory Adapter

**Files:**
- Create: `src/vps/db/PartnerRepository.ts`
- Create: `src/vps/db/InMemoryPartnerRepository.ts`
- Modify: `src/vps/services/ApiKeyManager.ts`
- Test: `tests/vps/partner-onboarding.test.ts`

- [ ] **Step 1: Add failing repository-backed registration test**

Append to `tests/vps/partner-onboarding.test.ts`:

```ts
import { InMemoryPartnerRepository } from '../../src/vps/db/InMemoryPartnerRepository';

test('ApiKeyManager can validate a key through the partner repository', async () => {
  const repository = new InMemoryPartnerRepository();
  const manager = new ApiKeyManager({ repository });
  const partner = await manager.registerPartner({
    active: true,
    contactEmail: 'dev@example.com',
    feeShareBps: 0,
    maxTxPerDay: 500,
    name: 'Dev App',
    quotesPerMin: 60,
    tier: PartnerTier.FREE,
  });

  const check = await manager.validateKey(partner.apiKey);
  assert.equal(check.allowed, true);
  if (check.allowed) {
    assert.equal(check.partner.contactEmail, 'dev@example.com');
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --import tsx --test tests/vps/partner-onboarding.test.ts`

Expected: FAIL because `InMemoryPartnerRepository` and async manager constructor support do not exist.

- [ ] **Step 3: Add repository types**

Create `src/vps/db/PartnerRepository.ts`:

```ts
import type { PartnerConfig, PartnerTier } from '../services/ApiKeyManager';

export interface StoredPartner extends Omit<PartnerConfig, 'apiKey' | 'webhookSecret'> {
  id: string;
  apiKeyHash: string;
  apiKeyPrefix: string;
  webhookSecretHash: string;
}

export interface CreatePartnerInput extends Omit<PartnerConfig, 'registeredAt'> {
  id: string;
  apiKeyHash: string;
  apiKeyPrefix: string;
  webhookSecretHash: string;
  registeredAt: number;
}

export interface PartnerRepository {
  createPartner(input: CreatePartnerInput): Promise<StoredPartner>;
  findByApiKeyHash(apiKeyHash: string): Promise<StoredPartner | undefined>;
  findByApiKeyPrefix(apiKeyPrefix: string): Promise<StoredPartner | undefined>;
  updateTier(apiKeyHash: string, tier: PartnerTier): Promise<StoredPartner>;
  setActive(apiKeyHash: string, active: boolean): Promise<StoredPartner>;
}
```

- [ ] **Step 4: Add in-memory repository**

Create `src/vps/db/InMemoryPartnerRepository.ts`:

```ts
import { PARTNER_TIER_DEFINITIONS } from '../services/ApiKeyManager';
import type { PartnerTier } from '../services/ApiKeyManager';
import type { CreatePartnerInput, PartnerRepository, StoredPartner } from './PartnerRepository';

export class InMemoryPartnerRepository implements PartnerRepository {
  private byHash = new Map<string, StoredPartner>();

  async createPartner(input: CreatePartnerInput): Promise<StoredPartner> {
    const { apiKey, webhookSecret, ...stored } = input;
    const partner = stored as StoredPartner;
    this.byHash.set(input.apiKeyHash, partner);
    return partner;
  }

  async findByApiKeyHash(apiKeyHash: string): Promise<StoredPartner | undefined> {
    return this.byHash.get(apiKeyHash);
  }

  async findByApiKeyPrefix(apiKeyPrefix: string): Promise<StoredPartner | undefined> {
    return [...this.byHash.values()].find((partner) => partner.apiKeyPrefix === apiKeyPrefix);
  }

  async updateTier(apiKeyHash: string, tier: PartnerTier): Promise<StoredPartner> {
    const partner = this.mustGet(apiKeyHash);
    const defaults = PARTNER_TIER_DEFINITIONS[tier];
    Object.assign(partner, {
      tier,
      feeShareBps: defaults.feeShareBps,
      quotesPerMin: defaults.quotesPerMin,
      maxTxPerDay: defaults.maxTxPerDay,
    });
    return partner;
  }

  async setActive(apiKeyHash: string, active: boolean): Promise<StoredPartner> {
    const partner = this.mustGet(apiKeyHash);
    partner.active = active;
    return partner;
  }

  private mustGet(apiKeyHash: string): StoredPartner {
    const partner = this.byHash.get(apiKeyHash);
    if (!partner) throw new Error('partner not found');
    return partner;
  }
}
```

- [ ] **Step 5: Make `ApiKeyManager` repository-aware**

Modify `ApiKeyManager` to accept a repository and convert partner key operations to async. Update PartnerAPI and existing tests in the same task so there is one supported API shape.

```ts
export interface ApiKeyManagerOptions {
  repository?: PartnerRepository;
}

export class ApiKeyManager {
  private repository: PartnerRepository;

  constructor(options: ApiKeyManagerOptions = {}) {
    this.repository = options.repository ?? new InMemoryPartnerRepository();
  }

  private _hashSecret(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
  }
}
```

Update `registerPartner()`, `validateKey()`, `checkQuote()`, `checkSubmit()`, `updateTier()`, `deactivate()`, and `reactivate()` to return promises. Update all current PartnerAPI handlers and VPS tests that call these methods to use `await`.

- [ ] **Step 6: Run the test to verify it passes**

Run: `node --import tsx --test tests/vps/partner-onboarding.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/vps/db/PartnerRepository.ts src/vps/db/InMemoryPartnerRepository.ts src/vps/services/ApiKeyManager.ts tests/vps/partner-onboarding.test.ts
git commit -m "feat(partner): add repository-backed api keys"
```

---

### Task 4: Add Postgres Partner Persistence

**Files:**
- Create: `src/vps/db/PostgresPartnerRepository.ts`
- Create: `src/vps/db/migrations/20260617_add_partner_api_keys.sql`
- Modify: `src/vps/app/runtime.ts`
- Test: `tests/vps/partner-onboarding.test.ts`

- [ ] **Step 1: Add the migration**

Add a migration that creates:

```sql
create table if not exists partners (
  id text primary key,
  api_key_hash text not null unique,
  api_key_prefix text not null,
  webhook_secret_hash text not null,
  tier text not null,
  name text not null,
  contact_email text not null,
  fee_share_bps integer not null,
  quotes_per_min integer not null,
  max_tx_per_day integer not null,
  webhook_url text,
  allowed_origins text[] not null default '{}',
  payout_address text,
  active boolean not null default true,
  registered_at bigint not null,
  updated_at bigint not null
);

create index if not exists partners_active_idx on partners(active);
create index if not exists partners_tier_idx on partners(tier);
```

- [ ] **Step 2: Add Postgres repository**

Create `src/vps/db/PostgresPartnerRepository.ts`:

```ts
import type { Pool } from 'pg';
import { PARTNER_TIER_DEFINITIONS } from '../services/ApiKeyManager';
import type { PartnerTier } from '../services/ApiKeyManager';
import type { CreatePartnerInput, PartnerRepository, StoredPartner } from './PartnerRepository';

export class PostgresPartnerRepository implements PartnerRepository {
  constructor(private readonly pool: Pool) {}

  async createPartner(input: CreatePartnerInput): Promise<StoredPartner> {
    const now = Date.now();
    const result = await this.pool.query(`
      insert into partners (
        id, api_key_hash, api_key_prefix, webhook_secret_hash, tier, name, contact_email,
        fee_share_bps, quotes_per_min, max_tx_per_day, webhook_url, allowed_origins,
        payout_address, active, registered_at, updated_at
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      returning *
    `, [
      input.id,
      input.apiKeyHash,
      input.apiKeyPrefix,
      input.webhookSecretHash,
      input.tier,
      input.name,
      input.contactEmail,
      input.feeShareBps,
      input.quotesPerMin,
      input.maxTxPerDay,
      input.webhookUrl ?? null,
      input.allowedOrigins ?? [],
      input.payoutAddress ?? null,
      input.active,
      input.registeredAt,
      now,
    ]);
    return rowToPartner(result.rows[0]);
  }

  async findByApiKeyHash(apiKeyHash: string): Promise<StoredPartner | undefined> {
    const result = await this.pool.query('select * from partners where api_key_hash = $1', [apiKeyHash]);
    return result.rows[0] ? rowToPartner(result.rows[0]) : undefined;
  }

  async findByApiKeyPrefix(apiKeyPrefix: string): Promise<StoredPartner | undefined> {
    const result = await this.pool.query('select * from partners where api_key_prefix = $1', [apiKeyPrefix]);
    return result.rows[0] ? rowToPartner(result.rows[0]) : undefined;
  }

  async updateTier(apiKeyHash: string, tier: PartnerTier): Promise<StoredPartner> {
    const defaults = PARTNER_TIER_DEFINITIONS[tier];
    const result = await this.pool.query(`
      update partners
      set tier = $2, fee_share_bps = $3, quotes_per_min = $4, max_tx_per_day = $5, updated_at = $6
      where api_key_hash = $1
      returning *
    `, [apiKeyHash, tier, defaults.feeShareBps, defaults.quotesPerMin, defaults.maxTxPerDay, Date.now()]);
    if (!result.rows[0]) throw new Error('partner not found');
    return rowToPartner(result.rows[0]);
  }

  async setActive(apiKeyHash: string, active: boolean): Promise<StoredPartner> {
    const result = await this.pool.query(
      'update partners set active = $2, updated_at = $3 where api_key_hash = $1 returning *',
      [apiKeyHash, active, Date.now()],
    );
    if (!result.rows[0]) throw new Error('partner not found');
    return rowToPartner(result.rows[0]);
  }
}

function rowToPartner(row: any): StoredPartner {
  return {
    id: row.id,
    apiKeyHash: row.api_key_hash,
    apiKeyPrefix: row.api_key_prefix,
    webhookSecretHash: row.webhook_secret_hash,
    tier: row.tier,
    name: row.name,
    contactEmail: row.contact_email,
    feeShareBps: row.fee_share_bps,
    quotesPerMin: row.quotes_per_min,
    maxTxPerDay: row.max_tx_per_day,
    webhookUrl: row.webhook_url ?? undefined,
    allowedOrigins: row.allowed_origins ?? [],
    payoutAddress: row.payout_address ?? undefined,
    active: row.active,
    registeredAt: Number(row.registered_at),
  };
}
```

- [ ] **Step 3: Wire runtime**

In `src/vps/app/runtime.ts`, use `PostgresPartnerRepository` when `postgres?.pool` exists, otherwise use `InMemoryPartnerRepository`.

- [ ] **Step 4: Run migration and focused tests**

Run: `npm run db:migrate`

Expected: migration completes when `DATABASE_URL` is configured, or the command reports missing DB config in local environments.

Run: `node --import tsx --test tests/vps/partner-onboarding.test.ts tests/vps/partner-api-phase4.test.ts tests/vps/partner-api-phase5.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/vps/db/PostgresPartnerRepository.ts src/vps/app/runtime.ts tests/vps/partner-onboarding.test.ts
git commit -m "feat(partner): persist partner api keys"
```

---

### Task 5: Add Admin Partner Lifecycle Endpoints

**Files:**
- Modify: `src/vps/api/AdminAPI.ts`
- Modify: `src/vps/app/http.ts`
- Modify: `src/vps/app/runtime.ts`
- Test: `tests/vps/partner-admin.test.ts`

- [ ] **Step 1: Write failing admin tests**

Create `tests/vps/partner-admin.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { buildAdminAPI } from '../../src/vps/api/AdminAPI';
import { InMemoryPartnerRepository } from '../../src/vps/db/InMemoryPartnerRepository';
import { ApiKeyManager, PartnerTier } from '../../src/vps/services/ApiKeyManager';
import { IntentEngine } from '../../src/vps/services/IntentEngine';
import { IntentService } from '../../src/vps/services/IntentService';

async function listen(app: express.Express) {
  const server = await new Promise<ReturnType<express.Express['listen']>>((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const address = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    async close() {
      await new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
    },
  };
}

test('admin partner lifecycle endpoints require x-admin-key and update tier/activity', async () => {
  const previous = process.env.VPS_ADMIN_API_KEY;
  process.env.VPS_ADMIN_API_KEY = 'x'.repeat(32);
  const repository = new InMemoryPartnerRepository();
  const keyManager = new ApiKeyManager({ repository });
  const partner = await keyManager.registerPartner({
    active: true,
    contactEmail: 'ops@example.com',
    feeShareBps: 0,
    maxTxPerDay: 500,
    name: 'Ops Partner',
    quotesPerMin: 60,
    tier: PartnerTier.FREE,
  });
  const apiKeyPrefix = partner.apiKey.slice(0, 12);

  const app = express();
  app.use(express.json());
  app.use('/admin', buildAdminAPI(
    new IntentService(new IntentEngine()),
    undefined,
    undefined,
    { partnerRepository: repository },
  ));

  const server = await listen(app);
  try {
    const unauthorized = await fetch(`${server.baseUrl}/admin/partners/${apiKeyPrefix}/tier`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tier: 'GROWTH' }),
    });
    assert.equal(unauthorized.status, 401);

    const headers = {
      'x-admin-key': process.env.VPS_ADMIN_API_KEY!,
      'content-type': 'application/json',
    };
    const tierRes = await fetch(`${server.baseUrl}/admin/partners/${apiKeyPrefix}/tier`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ tier: 'GROWTH' }),
    });
    assert.equal(tierRes.status, 200);
    const tierBody = await tierRes.json() as any;
    assert.equal(tierBody.partner.tier, 'GROWTH');
    assert.equal(tierBody.partner.apiKey, undefined);

    const deactivateRes = await fetch(`${server.baseUrl}/admin/partners/${apiKeyPrefix}/deactivate`, {
      method: 'POST',
      headers,
    });
    assert.equal(deactivateRes.status, 200);
    const check = await keyManager.validateKey(partner.apiKey);
    assert.deepEqual(check, { allowed: false, reason: 'INACTIVE' });
  } finally {
    await server.close();
    if (previous === undefined) delete process.env.VPS_ADMIN_API_KEY;
    else process.env.VPS_ADMIN_API_KEY = previous;
  }
});
```

- [ ] **Step 2: Implement admin endpoints**

Add endpoints under the existing admin auth path:

```ts
POST /admin/partners/:apiKeyPrefix/tier
POST /admin/partners/:apiKeyPrefix/deactivate
POST /admin/partners/:apiKeyPrefix/reactivate
POST /admin/partners/:apiKeyPrefix/allowed-origins
```

Each endpoint should resolve by `apiKeyPrefix`, never require plaintext API keys in admin requests, and return redacted partner records.

Extend `buildAdminAPI()` with an options object:

```ts
export interface AdminApiOptions {
  partnerRepository?: PartnerRepository;
}

export function buildAdminAPI(
  intentService: IntentService,
  reliability?: ReliabilityRepository,
  oracle?: NativeUsdOracle,
  options: AdminApiOptions = {},
): express.Router {
  const partnerRepository = options.partnerRepository;
  // existing routes remain unchanged
}
```

Admin partner route behavior:

```ts
router.post('/partners/:apiKeyPrefix/tier', async (req: Request, res: Response) => {
  if (!partnerRepository) return res.status(503).json({ error: 'PARTNER_REPOSITORY_DISABLED' });
  const partner = await partnerRepository.findByApiKeyPrefix(req.params.apiKeyPrefix);
  if (!partner) return res.status(404).json({ error: 'PARTNER_NOT_FOUND' });
  const tier = req.body.tier as PartnerTier;
  if (!Object.values(PartnerTier).includes(tier)) return res.status(400).json({ error: 'INVALID_TIER' });
  const updated = await partnerRepository.updateTier(partner.apiKeyHash, tier);
  res.json({ partner: redactPartner(updated) });
});

router.post('/partners/:apiKeyPrefix/deactivate', async (req: Request, res: Response) => {
  if (!partnerRepository) return res.status(503).json({ error: 'PARTNER_REPOSITORY_DISABLED' });
  const partner = await partnerRepository.findByApiKeyPrefix(req.params.apiKeyPrefix);
  if (!partner) return res.status(404).json({ error: 'PARTNER_NOT_FOUND' });
  const updated = await partnerRepository.setActive(partner.apiKeyHash, false);
  res.json({ partner: redactPartner(updated) });
});

router.post('/partners/:apiKeyPrefix/reactivate', async (req: Request, res: Response) => {
  if (!partnerRepository) return res.status(503).json({ error: 'PARTNER_REPOSITORY_DISABLED' });
  const partner = await partnerRepository.findByApiKeyPrefix(req.params.apiKeyPrefix);
  if (!partner) return res.status(404).json({ error: 'PARTNER_NOT_FOUND' });
  const updated = await partnerRepository.setActive(partner.apiKeyHash, true);
  res.json({ partner: redactPartner(updated) });
});
```

Use this redaction helper in `AdminAPI.ts`:

```ts
function redactPartner(partner: StoredPartner): Record<string, unknown> {
  const { apiKeyHash, webhookSecretHash, ...safe } = partner;
  return safe;
}
```

- [ ] **Step 3: Run admin tests**

Run: `node --import tsx --test tests/vps/partner-admin.test.ts`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/vps/api/AdminAPI.ts src/vps/app/http.ts src/vps/app/runtime.ts tests/vps/partner-admin.test.ts
git commit -m "feat(partner): add admin partner lifecycle"
```

---

### Task 6: Add Dedicated Partner OpenAPI Spec

**Files:**
- Create: `partner.openapi.json`
- Modify: `docs/partner-integration-guide.md`
- Test: `tests/vps/partner-openapi.test.ts`

- [ ] **Step 1: Write OpenAPI validation test**

Create `tests/vps/partner-openapi.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('partner.openapi.json documents only the partner domain and partner routes', () => {
  const spec = JSON.parse(readFileSync('partner.openapi.json', 'utf8'));
  assert.equal(spec.openapi, '3.0.3');
  assert.equal(spec.servers[0].url, 'https://partners.empx.io');
  assert.ok(spec.paths['/partner/register']);
  assert.ok(spec.paths['/partner/tiers']);
  assert.ok(spec.paths['/partner/quote']);
  assert.ok(spec.paths['/partner/quote/select']);
  assert.ok(spec.paths['/partner/intent/{intentId}']);
  assert.ok(spec.paths['/partner/intent/{intentId}/submitted']);
  assert.equal(spec.paths['/api/v1/health'], undefined);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --import tsx --test tests/vps/partner-openapi.test.ts`

Expected: FAIL because `partner.openapi.json` does not exist.

- [ ] **Step 3: Create `partner.openapi.json`**

Create an OpenAPI 3.0.3 spec with:

- `servers[0].url = "https://partners.empx.io"`;
- `securitySchemes.PartnerApiKey` using `apiKey` in header `x-api-key`;
- unauthenticated routes: `/partner/register`, `/partner/tiers`;
- authenticated routes: `/partner/quote`, `/partner/quote/select`, `/partner/intent/{intentId}`, `/partner/intent/{intentId}/submitted`, `/partner/rebates`, `/partner/withdraw`, `/partner/webhook/test`, `/partner/swap-single-chain`;
- route descriptions that match the live PartnerAPI behavior.

- [ ] **Step 4: Run OpenAPI validation test**

Run: `node --import tsx --test tests/vps/partner-openapi.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add partner.openapi.json tests/vps/partner-openapi.test.ts docs/partner-integration-guide.md
git commit -m "docs(partner): add partner openapi specification"
```

---

### Task 7: Align Partner Docs And README

**Files:**
- Modify: `README.md`
- Modify: `docs/partner-integration-guide.md`
- Modify: `docs/ops/partner-api-service-split-and-websocket-plan.md`

- [ ] **Step 1: Update tier names**

Replace `Public` and `Hobbyist` in partner docs with:

| Tier | Quotes/min | Intents/day | Fee Rebate | SLA | Access |
|---|---:|---:|---:|---|---|
| FREE | 60 | 500 | 0% | none | Self-serve registration |
| GROWTH | 300 | 5,000 | 15% | none | Approval or paid growth plan |
| PARTNER | 600 | 10,000 | 20% | 99.5% | Revenue-share agreement |
| ENTERPRISE | 6,000 | 500,000 | 30% | 99.9% | Custom contract |

- [ ] **Step 2: Document current key flow**

Add this flow to the partner guide:

```text
1. Call POST https://partners.empx.io/partner/register with name and contactEmail.
2. Store apiKey and webhookSecret from the response. They are shown once.
3. Send x-api-key on all operational /partner/* requests.
4. Request GROWTH/PARTNER/ENTERPRISE upgrade through an ops contact; admins apply approved changes through `/admin/partners/*`.
```

- [ ] **Step 3: Document persistence expectations**

Add a short operational note:

```text
Production partner API keys are stored durably. Local development can use the in-memory repository and will lose keys on restart.
```

- [ ] **Step 4: Run docs scan**

Run: `rg -n "Public|Hobbyist|api\\.ruflo\\.io|ruflo.io/developers" README.md docs/partner-integration-guide.md docs/ops/partner-api-service-split-and-websocket-plan.md`

Expected: no stale partner tier names or old partner registration host remain unless quoted as legacy context.

- [ ] **Step 5: Commit**

```bash
git add README.md docs/partner-integration-guide.md docs/ops/partner-api-service-split-and-websocket-plan.md
git commit -m "docs(partner): align onboarding and tiers"
```

---

### Task 8: Final Verification

**Files:**
- No new files.

- [ ] **Step 1: Run focused partner tests**

Run:

```bash
node --import tsx --test \
  tests/vps/partner-onboarding.test.ts \
  tests/vps/partner-openapi.test.ts \
  tests/vps/partner-api-service-split.test.ts \
  tests/vps/partner-api-phase4.test.ts \
  tests/vps/partner-api-phase5.test.ts \
  tests/vps/empx-cross-chain-sdk.test.ts
```

Expected: all tests pass.

- [ ] **Step 2: Validate generated service config**

Run:

```bash
docker compose -f config/docker/docker-compose.yml config
docker compose -f config/docker/docker-compose.testnet.yml config
```

Expected: both commands exit 0 and still include separate `api` and `partner-api` services.

- [ ] **Step 3: Update graph**

Run: `graphify update .`

Expected: graph rebuild completes and updates `graphify-out`.

- [ ] **Step 4: Commit verification updates**

```bash
git add graphify-out README.md docs partner.openapi.json
git commit -m "chore(partner): refresh docs graph"
```

---

## Acceptance Checklist

- [ ] `POST /partner/register` returns one-time plaintext `apiKey` and `webhookSecret`.
- [ ] API keys are stored hashed, not plaintext.
- [ ] Partner records survive partner API service restart when Postgres is configured.
- [ ] Local/test mode still works without Postgres through `InMemoryPartnerRepository`.
- [ ] `GET /partner/tiers` is public and reflects `FREE`, `GROWTH`, `PARTNER`, `ENTERPRISE`.
- [ ] Operational `/partner/*` endpoints require `x-api-key`.
- [ ] Admin/ops can upgrade, deactivate, reactivate, and configure partner origins without plaintext API keys.
- [ ] `partner.openapi.json` documents only partner routes and uses `https://partners.empx.io`.
- [ ] Existing `openapi.json` remains non-partner StatusAPI/AdminAPI focused.
- [ ] README and partner guide use the same tier names and partner domain.
- [ ] Focused tests and Docker config validation pass.

## Deliberate Non-Goals

- Building the partner dashboard UI.
- Building a public partner registration interface.
- Billing provider integration for paid Growth/Enterprise plans.
- Sending real payout transactions from `/partner/withdraw`.
- Replacing in-memory rate-limit counters with Redis. That can be done after durable key storage.
- Serving Swagger UI publicly. Keep Swagger/UI access internal unless a product decision says otherwise.
