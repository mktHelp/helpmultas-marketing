-- 0042_social_follower_history.sql
-- The follower snapshots are now fed automatically every 15 minutes (n8n
-- polling the Instagram Graph API), so "one row per account per day" no
-- longer fits — we need full intraday history. Switches the table to a
-- timestamped series; snapshot_date is kept (as a plain column, kept in
-- sync by trigger — a generated column here fails because casting
-- timestamptz -> date depends on the session timezone, so Postgres won't
-- accept it as immutable) so day-level grouping stays cheap to query.

alter table social_follower_snapshots add column captured_at timestamptz not null default now();
alter table social_follower_snapshots add column media_count int;

update social_follower_snapshots set captured_at = snapshot_date::timestamptz where captured_at is null;

alter table social_follower_snapshots drop constraint if exists social_follower_snapshots_account_id_snapshot_date_key;

create or replace function set_social_snapshot_date()
returns trigger as $$
begin
  new.snapshot_date := new.captured_at::date;
  return new;
end;
$$ language plpgsql;

create trigger set_social_snapshot_date_trigger
  before insert or update of captured_at on social_follower_snapshots
  for each row execute function set_social_snapshot_date();

update social_follower_snapshots set snapshot_date = captured_at::date;

create index idx_social_follower_snapshots_account_captured
  on social_follower_snapshots(account_id, captured_at desc);

drop index if exists idx_social_follower_snapshots_account_date;

-- Ties an account to the Instagram username the automated poller reports,
-- so the ingest endpoint can match "helpmultasfranchising" -> the right row
-- without the caller needing to know our internal account_id.
alter table social_accounts add column if not exists ig_username text unique;

update social_accounts set ig_username = 'helpmultasfranchising'
  where label = 'Help Multas Franchising';
