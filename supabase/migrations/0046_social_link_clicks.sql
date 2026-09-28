-- 0046_social_link_clicks.sql
-- Tracks clicks on outbound WhatsApp links per social profile (e.g. the
-- "link in bio" redirect pages on the landing site), so the follower card
-- can show link engagement alongside follower count. `link_slug` gives the
-- landing site a stable, public-safe identifier to send instead of the raw
-- account uuid.

alter table social_accounts add column link_slug text unique;

create table social_link_clicks (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references social_accounts(id) on delete cascade,
  clicked_at timestamptz not null default now(),
  url text,
  referrer text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index idx_social_link_clicks_account_date
  on social_link_clicks(account_id, clicked_at desc);

alter table social_link_clicks enable row level security;

create policy "social_link_clicks_select_all" on social_link_clicks for select using (auth.uid() is not null);
-- No insert/update/delete policy for regular users: rows are written by the
-- /api/social/link-clicks route using the service-role client, since the
-- landing site has no authenticated Supabase session.

alter publication supabase_realtime add table social_link_clicks;

update social_accounts set link_slug = 'franchising' where label = 'Help Multas Franchising';
