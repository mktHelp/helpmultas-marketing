-- 0068_distribution_posts.sql — aba "Distribuição" (Tráfego Pago): planilha de
-- posts impulsionados, com investimento, seguidores ganhos e classificação.

create table if not exists distribution_posts (
  id uuid primary key default gen_random_uuid(),
  active boolean not null default true,
  unit text not null default '',
  unit_name text not null default '',
  boost_start date,
  boost_end date,
  nomenclature text not null default '',
  post_link text not null default '',
  investment numeric(12,2),
  test_days int,
  daily_value numeric(12,2),
  post_category text not null default '' check (post_category in ('', 'bom', 'medio', 'ruim')),
  followers_before int,
  followers_after int,
  paid_followers int,
  cost_per_follower numeric(12,2),
  format text not null default '',
  what_is text not null default '',
  pillar text not null default '',
  row_color text not null default '',
  sort_order int not null default 0,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_distribution_posts_sort on distribution_posts(sort_order, created_at);

alter table distribution_posts enable row level security;
drop policy if exists "distribution_posts_all" on distribution_posts;
create policy "distribution_posts_all" on distribution_posts for all
  using (public.is_internal_user()) with check (public.is_internal_user());

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'distribution_posts') then
    alter publication supabase_realtime add table distribution_posts;
  end if;
end $$;

drop trigger if exists set_distribution_posts_updated_at on distribution_posts;
create trigger set_distribution_posts_updated_at
  before update on distribution_posts
  for each row execute function set_updated_at();
