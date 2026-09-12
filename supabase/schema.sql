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
