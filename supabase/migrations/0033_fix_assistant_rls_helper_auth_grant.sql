-- 0033_fix_assistant_rls_helper_auth_grant.sql
-- assistant_rls_helper (created in 0032) owns user_is_conversation_member,
-- which calls auth.uid() internally. A freshly created role has no grants
-- on the auth schema by default, so that call failed with "permission
-- denied for schema auth" in production. Grant just enough to call it.

grant usage on schema auth to assistant_rls_helper;
grant execute on function auth.uid() to assistant_rls_helper;
