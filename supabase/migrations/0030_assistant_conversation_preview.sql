-- 0030_assistant_conversation_preview.sql
-- Adds a preview snippet (subtitle) shown under each conversation's title in
-- the assistant sidebar.

alter table assistant_conversations add column preview text not null default '';
