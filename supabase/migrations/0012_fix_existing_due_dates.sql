-- 0012_fix_existing_due_dates.sql
-- One-time backfill for the timezone bug fixed in the app: every due_date
-- saved so far was stored as UTC midnight of the intended day, which reads
-- back (and compares against "now") as the *previous* calendar day for
-- Brazil-timezone users. This re-anchors each one to 23:59:59 in
-- America/Sao_Paulo on that same intended day, matching what the app now
-- writes for new/edited dates. Safe to run once; running it again on
-- already-fixed rows would push them another day later, so only run this
-- single time.

update tasks
set due_date = ((due_date at time zone 'UTC')::date::text || ' 23:59:59')::timestamp at time zone 'America/Sao_Paulo'
where due_date is not null;
