-- 0036_grant_rls_helper_members_table.sql
-- user_is_conversation_member (0032/0034) runs as assistant_rls_helper via
-- SECURITY DEFINER, but that role was only ever given schema/function-level
-- access — never a plain GRANT on assistant_conversation_members itself.
-- BYPASSRLS skips row-level policies, not the underlying table grant, so
-- every call failed with "permission denied for table
-- assistant_conversation_members", surfacing as a failure to list
-- conversations at all (the RLS check on assistant_conversations calls
-- this function).

grant select on assistant_conversation_members to assistant_rls_helper;
