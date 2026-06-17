create table if not exists partners (
  id text primary key,
  api_key_hash text not null unique,
  api_key_prefix text not null unique,
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
