-- 0049_meta_ads.sql — sincronização somente-leitura do Gerenciador de
-- Anúncios da Meta, exibida na aba "Gerenciador de Anúncios" em /expansao.
--
-- Todas as tabelas abaixo são escritas apenas pelo job de sync (via service
-- role, que ignora RLS) — usuários autenticados só têm policy de select.
-- O sync busca apenas campanhas com effective_status = ACTIVE; quando uma
-- campanha sincronizada anteriormente deixa de aparecer nesse filtro, o job
-- marca active_in_meta = false em vez de apagar (mantém histórico, some da
-- UI por padrão).

create table meta_ad_accounts (
  id uuid primary key default gen_random_uuid(),
  meta_account_id text not null unique,
  name text not null default '',
  currency text not null default '',
  timezone_name text not null default '',
  status text not null default '',
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table meta_campaigns (
  id uuid primary key default gen_random_uuid(),
  meta_campaign_id text not null unique,
  account_id uuid not null references meta_ad_accounts(id) on delete cascade,
  name text not null default '',
  objective text not null default '',
  status text not null default '',
  active_in_meta boolean not null default true,
  daily_budget numeric,
  lifetime_budget numeric,
  start_time timestamptz,
  stop_time timestamptz,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_meta_campaigns_account on meta_campaigns(account_id);

create table meta_ad_sets (
  id uuid primary key default gen_random_uuid(),
  meta_adset_id text not null unique,
  campaign_id uuid not null references meta_campaigns(id) on delete cascade,
  name text not null default '',
  status text not null default '',
  optimization_goal text not null default '',
  billing_event text not null default '',
  daily_budget numeric,
  start_time timestamptz,
  end_time timestamptz,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_meta_ad_sets_campaign on meta_ad_sets(campaign_id);

create table meta_ads (
  id uuid primary key default gen_random_uuid(),
  meta_ad_id text not null unique,
  adset_id uuid not null references meta_ad_sets(id) on delete cascade,
  name text not null default '',
  status text not null default '',
  effective_status text not null default '',
  creative_meta_id text not null default '',
  preview_link text not null default '',
  thumbnail_url text not null default '',
  -- Cruzamento com a planilha de criativos (tabela "creatives"). Preenchido
  -- pelo job de sync via matching automático (nome/link) ou manualmente.
  matched_creative_id uuid references creatives(id) on delete set null,
  matched_by text,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_meta_ads_adset on meta_ads(adset_id);
create index idx_meta_ads_matched_creative on meta_ads(matched_creative_id);

create table meta_ad_insights (
  id uuid primary key default gen_random_uuid(),
  ad_id uuid not null references meta_ads(id) on delete cascade,
  date date not null,
  spend numeric not null default 0,
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  reach bigint not null default 0,
  frequency numeric,
  ctr numeric,
  cpc numeric,
  cpm numeric,
  actions jsonb not null default '[]'::jsonb,
  synced_at timestamptz not null default now(),
  unique (ad_id, date)
);

create index idx_meta_ad_insights_ad on meta_ad_insights(ad_id);
create index idx_meta_ad_insights_date on meta_ad_insights(date);

create table meta_sync_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running',
  entities_synced jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now()
);

create trigger set_meta_ad_accounts_updated_at
  before update on meta_ad_accounts
  for each row execute function set_updated_at();

create trigger set_meta_campaigns_updated_at
  before update on meta_campaigns
  for each row execute function set_updated_at();

create trigger set_meta_ad_sets_updated_at
  before update on meta_ad_sets
  for each row execute function set_updated_at();

create trigger set_meta_ads_updated_at
  before update on meta_ads
  for each row execute function set_updated_at();

-- ============================================================
-- RLS: qualquer usuário autenticado (time interno ou expansão) só lê.
-- Escrita é feita pelo job de sync com a service role, que ignora RLS.
-- meta_sync_runs é detalhe operacional: só o time interno acessa.
-- ============================================================
alter table meta_ad_accounts enable row level security;
alter table meta_campaigns enable row level security;
alter table meta_ad_sets enable row level security;
alter table meta_ads enable row level security;
alter table meta_ad_insights enable row level security;
alter table meta_sync_runs enable row level security;

create policy "meta_ad_accounts_select" on meta_ad_accounts for select using (auth.uid() is not null);
create policy "meta_campaigns_select" on meta_campaigns for select using (auth.uid() is not null);
create policy "meta_ad_sets_select" on meta_ad_sets for select using (auth.uid() is not null);
create policy "meta_ads_select" on meta_ads for select using (auth.uid() is not null);
create policy "meta_ad_insights_select" on meta_ad_insights for select using (auth.uid() is not null);

create policy "meta_sync_runs_select" on meta_sync_runs for select using (public.is_internal_user());

alter publication supabase_realtime add table meta_campaigns;
alter publication supabase_realtime add table meta_ad_sets;
alter publication supabase_realtime add table meta_ads;
alter publication supabase_realtime add table meta_ad_insights;
