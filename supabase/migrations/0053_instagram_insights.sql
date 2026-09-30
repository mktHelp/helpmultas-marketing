-- 0053_instagram_insights.sql
-- Insights diários dos perfis do Instagram (Graph API, "Insights" do app).
-- Escrita só pela service-role (app/api/instagram/sync); leitura pra qualquer
-- usuário autenticado, igual social_accounts.

alter table social_accounts add column if not exists ig_user_id text;

create table instagram_daily_insights (
  account_id uuid not null references social_accounts(id) on delete cascade,
  date date not null,
  views int not null default 0,
  views_followers int not null default 0,
  views_non_followers int not null default 0,
  -- { "REEL": n, "STORY": n, "POST": n, "VIDEO": n, "AD": n ... }
  views_by_type jsonb not null default '{}'::jsonb,
  reach int not null default 0,
  accounts_engaged int not null default 0,
  total_interactions int not null default 0,
  likes int not null default 0,
  comments int not null default 0,
  shares int not null default 0,
  saves int not null default 0,
  profile_views int not null default 0,
  website_clicks int not null default 0,
  net_followers int not null default 0,
  synced_at timestamptz not null default now(),
  primary key (account_id, date)
);

create index idx_instagram_daily_insights_date on instagram_daily_insights(date desc);

alter table instagram_daily_insights enable row level security;
create policy "instagram_insights_select_all" on instagram_daily_insights
  for select using (auth.uid() is not null);
