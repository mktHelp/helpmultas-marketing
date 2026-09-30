-- 0055_instagram_media_audience.sql
-- Mais insights do Instagram: alcance/interações por tipo, posts e stories
-- individuais (pra contar publicações por dia e ranquear conteúdo) e dados
-- de público/perfil. Escrita só pela service-role (api/instagram/sync).

alter table instagram_daily_insights
  add column if not exists reach_followers int not null default 0,
  add column if not exists reach_non_followers int not null default 0,
  add column if not exists reach_by_type jsonb not null default '{}'::jsonb,
  add column if not exists interactions_by_type jsonb not null default '{}'::jsonb,
  add column if not exists replies int not null default 0,
  add column if not exists reposts int not null default 0;

create table if not exists instagram_media (
  account_id uuid not null references social_accounts(id) on delete cascade,
  media_id text not null,
  product_type text not null,          -- FEED | REELS | STORY | AD
  media_type text,                     -- IMAGE | VIDEO | CAROUSEL_ALBUM
  caption text,
  permalink text,
  thumbnail_url text,
  posted_at timestamptz not null,
  post_date date not null,             -- dia em horário de São Paulo
  like_count int not null default 0,
  comments_count int not null default 0,
  reach int not null default 0,
  views int not null default 0,
  shares int not null default 0,
  saves int not null default 0,
  total_interactions int not null default 0,
  replies int not null default 0,
  avg_watch_time_ms int,
  total_watch_time_ms bigint,
  synced_at timestamptz not null default now(),
  primary key (account_id, media_id)
);

create index if not exists idx_instagram_media_account_date
  on instagram_media(account_id, post_date desc);

-- kind: profile | age | gender | city | country
-- data: profile -> objeto; demais -> [{ "key": "25-34", "value": 123 }, ...]
create table if not exists instagram_audience (
  account_id uuid not null references social_accounts(id) on delete cascade,
  kind text not null,
  data jsonb not null,
  synced_at timestamptz not null default now(),
  primary key (account_id, kind)
);

alter table instagram_media enable row level security;
alter table instagram_audience enable row level security;

create policy "instagram_media_select_all" on instagram_media
  for select using (auth.uid() is not null);
create policy "instagram_audience_select_all" on instagram_audience
  for select using (auth.uid() is not null);

-- Execuções do sync com mensagem de progresso em texto natural; o front
-- acompanha via Realtime (card "Sincronizando Instagram"), igual meta_sync_runs.
create table if not exists instagram_sync_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running',
  progress_message text
);

alter table instagram_sync_runs enable row level security;
create policy "instagram_sync_runs_select" on instagram_sync_runs
  for select using (public.is_internal_user());

alter publication supabase_realtime add table instagram_sync_runs;
