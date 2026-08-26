-- 0011_enable_realtime.sql
-- Adds the tables the app now listens to live (Supabase Realtime Postgres
-- Changes) to the `supabase_realtime` publication. Without this, the
-- WebSocket subscriptions in useRealtimeChanges() never receive events -
-- RLS still applies as normal on top of this (a user only gets change
-- events for rows they're allowed to SELECT).

alter publication supabase_realtime add table tasks;
alter publication supabase_realtime add table task_assignees;
alter publication supabase_realtime add table task_comments;
alter publication supabase_realtime add table task_checklists;
alter publication supabase_realtime add table task_attachments;
alter publication supabase_realtime add table projects;
alter publication supabase_realtime add table campaigns;
alter publication supabase_realtime add table profiles;
