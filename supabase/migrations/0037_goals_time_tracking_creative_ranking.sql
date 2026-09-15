-- 0037_goals_time_tracking_creative_ranking.sql
-- Three additions requested together: editable goals (company/area/person),
-- performance metrics on creatives so "top ads" can be ranked by CTR
-- instead of just a manual yes/no flag, and (via the app UI only, no schema
-- change needed) surfacing the existing tasks.estimated_minutes /
-- actual_minutes columns that were already in the schema but never had a
-- UI. All editable through the app, and all readable by Helpinho's tools.

-- ============================================================
-- GOALS
-- ============================================================
create type goal_scope as enum ('company', 'area', 'user');
create type goal_metric as enum ('tasks_completed', 'on_time_rate');

create table goals (
  id uuid primary key default gen_random_uuid(),
  scope goal_scope not null,
  area_id uuid references areas(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  metric goal_metric not null default 'tasks_completed',
  target_value numeric not null check (target_value > 0),
  period_start date not null,
  period_end date not null,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint goals_area_requires_area_id check (scope <> 'area' or area_id is not null),
  constraint goals_user_requires_user_id check (scope <> 'user' or user_id is not null),
  constraint goals_period_valid check (period_end >= period_start)
);

create index idx_goals_scope on goals(scope, period_start, period_end);

alter table goals enable row level security;

create policy "goals_select_all" on goals for select using (auth.uid() is not null);
create policy "goals_insert_manager" on goals for insert with check (is_manager_or_admin());
create policy "goals_update_manager" on goals for update using (is_manager_or_admin());
create policy "goals_delete_manager" on goals for delete using (is_manager_or_admin());

create trigger set_goals_updated_at
  before update on goals
  for each row execute function set_updated_at();

alter publication supabase_realtime add table goals;

-- ============================================================
-- CREATIVE PERFORMANCE METRICS (for the top-ads ranking)
-- ============================================================
alter table creatives add column impressions bigint not null default 0;
alter table creatives add column clicks bigint not null default 0;
alter table creatives add column spend numeric(12,2) not null default 0;
alter table creatives add column conversions int not null default 0;

-- Generated so every read (including the AI's own queries) sees a
-- consistent value without every caller re-deriving the division/guard.
alter table creatives add column ctr numeric(6,4) generated always as (
  case when impressions > 0 then round(clicks::numeric / impressions, 4) else 0 end
) stored;
