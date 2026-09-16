-- 0040_goals_recurring.sql
-- Some goals (e.g. "1 story per day") never end — they restart every day
-- forever. Adds is_recurring; a recurring goal has no period_end and its
-- progress is computed for "today" instead of the stored period.

alter table goals add column is_recurring boolean not null default false;
alter table goals alter column period_end drop not null;

alter table goals drop constraint goals_period_valid;
alter table goals add constraint goals_period_valid check (
  (is_recurring and period_end is null)
  or (not is_recurring and period_end is not null and period_end >= period_start)
);
