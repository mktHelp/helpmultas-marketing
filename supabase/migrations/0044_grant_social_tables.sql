-- 0044_grant_social_tables.sql
-- social_accounts / social_follower_snapshots (added in 0041) never got the
-- table-level GRANTs that every other table in this schema picked up
-- automatically from the project's default privileges — RLS policies alone
-- don't grant access, they only filter rows once a GRANT already lets the
-- role touch the table. That's why direct Postgres clients (e.g. the n8n
-- workflow, which connects straight to the database instead of going
-- through PostgREST) get "permission denied for table social_accounts"
-- instead of the RLS policies just filtering rows.

grant select, insert, update, delete on social_accounts to anon, authenticated, service_role;
grant select, insert, update, delete on social_follower_snapshots to anon, authenticated, service_role;
