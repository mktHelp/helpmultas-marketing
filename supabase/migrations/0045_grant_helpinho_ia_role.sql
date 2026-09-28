-- 0045_grant_helpinho_ia_role.sql
-- 0044 granted the social tables to anon/authenticated/service_role, but
-- the n8n workflow actually connects to Postgres directly as a dedicated
-- custom role (helpinho_ia), not one of those — so it still hit
-- "permission denied for table social_accounts". That role must have been
-- granted access table-by-table when it was set up, since it already works
-- fine against tasks/goals/profiles/etc.
--
-- Grant it access to every table that exists today, and set a default
-- privilege so any table created by future migrations grants it access
-- automatically too — the whole point of giving the assistant a free-SQL
-- tool is that it can query *any* table without us remembering to wire up
-- grants one by one every time.

grant select, insert, update, delete on all tables in schema public to helpinho_ia;
grant usage on schema public to helpinho_ia;
grant usage, select on all sequences in schema public to helpinho_ia;

alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to helpinho_ia;
alter default privileges for role postgres in schema public
  grant usage, select on sequences to helpinho_ia;
