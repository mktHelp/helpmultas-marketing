-- 0009_task_soft_delete.sql
-- "Delete" on a task now moves it to a recoverable trash (deleted_at set)
-- instead of removing the row outright. Permanent deletion is still
-- available (and still gated to managers/admins by the existing
-- tasks_delete_manager RLS policy) but is now a separate, explicit action.

alter table tasks add column deleted_at timestamptz;
create index idx_tasks_deleted on tasks(deleted_at);
