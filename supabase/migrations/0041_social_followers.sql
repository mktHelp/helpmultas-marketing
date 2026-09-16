-- 0041_social_followers.sql
-- Daily follower-count tracking for Instagram profiles (personal account +
-- franchising account), entered manually for now. One snapshot per account
-- per day; the dashboard derives day-over-day gain/loss from consecutive
-- snapshots. Schema is intentionally provider-agnostic (platform column)
-- so a future automated source (Meta Graph API poll, etc.) can write into
-- the same table instead of the manual form.

create table social_accounts (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  platform text not null default 'instagram',
  handle text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table social_follower_snapshots (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references social_accounts(id) on delete cascade,
  snapshot_date date not null,
  followers_count int not null check (followers_count >= 0),
  source text not null default 'manual',
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (account_id, snapshot_date)
);

create index idx_social_follower_snapshots_account_date
  on social_follower_snapshots(account_id, snapshot_date desc);

alter table social_accounts enable row level security;
alter table social_follower_snapshots enable row level security;

create policy "social_accounts_select_all" on social_accounts for select using (auth.uid() is not null);
create policy "social_accounts_manage_manager" on social_accounts for all using (is_manager_or_admin()) with check (is_manager_or_admin());

create policy "social_snapshots_select_all" on social_follower_snapshots for select using (auth.uid() is not null);
create policy "social_snapshots_insert_manager" on social_follower_snapshots for insert with check (is_manager_or_admin());
create policy "social_snapshots_update_manager" on social_follower_snapshots for update using (is_manager_or_admin());
create policy "social_snapshots_delete_manager" on social_follower_snapshots for delete using (is_manager_or_admin());

alter publication supabase_realtime add table social_follower_snapshots;

insert into social_accounts (label, platform, handle, sort_order) values
  ('Roberson Alvarenga (pessoal)', 'instagram', null, 1),
  ('Help Multas Franchising', 'instagram', null, 2);
