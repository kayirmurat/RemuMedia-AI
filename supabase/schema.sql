-- RemuMedia AI — Faz 2 Supabase şeması.
-- Supabase Dashboard > SQL Editor içine yapıştırıp "Run" ile çalıştır.

create table if not exists workflows (
  id text primary key,
  topic text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  steps jsonb not null default '{}'::jsonb,
  context jsonb not null default '{}'::jsonb
);

create table if not exists artifacts (
  id text primary key,
  workflow_id text not null references workflows(id) on delete cascade,
  type text not null,
  parent_artifact_id text,
  created_at timestamptz not null default now(),
  provider text,
  model text,
  status text not null,
  cost numeric not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  path text not null
);

create index if not exists artifacts_workflow_id_idx on artifacts(workflow_id);

-- Faz 7 — platform hesap bağlama + yayınlama.
-- Tokenlar sadece sunucu tarafında (service_role key ile) okunuyor/yazılıyor,
-- dashboard'un diğer tabloları gibi client'a hiç expose edilmiyor.
create table if not exists platform_connections (
  platform text primary key, -- 'youtube' | 'instagram' | 'tiktok'
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  account_name text,
  account_id text,
  extra jsonb not null default '{}'::jsonb,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists publications (
  id uuid primary key default gen_random_uuid(),
  workflow_id text not null references workflows(id) on delete cascade,
  platform text not null,
  status text not null default 'pending', -- 'pending' | 'published' | 'failed'
  remote_id text,
  remote_url text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists publications_workflow_id_idx on publications(workflow_id);
