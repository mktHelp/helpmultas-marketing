-- 0035_grant_assistant_conversation_members.sql
-- assistant_conversation_members (0031) never got the baseline table grants
-- that other tables receive automatically, so authenticated users hit
-- "permission denied for table assistant_conversation_members" even though
-- RLS would have allowed the read. Grants are checked before RLS.

grant select, insert, delete on assistant_conversation_members to authenticated;
