-- 0020_fix_log_task_activity_assigned_to.sql
-- Migration 0014 accidentally reverted log_task_activity() to a pre-0008
-- version that references tasks.assigned_to, a column 0008 removed in favor
-- of the task_assignees join table. Every task insert/update has been
-- failing with `record "new" has no field "assigned_to"` since 0014 ran.
-- This restores 0008's assignee-aware logic and keeps 0014's archived_by/
-- deleted_by activity logging.

create or replace function public.log_task_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into activity_logs (user_id, action, entity_type, entity_id, metadata)
    values (new.created_by, 'created', 'task', new.id, jsonb_build_object('title', new.title));

  elsif tg_op = 'UPDATE' then
    if new.status is distinct from old.status then
      insert into activity_logs (user_id, action, entity_type, entity_id, metadata)
      values (auth.uid(), 'status_changed', 'task', new.id,
        jsonb_build_object('from', old.status, 'to', new.status, 'title', new.title));

      if new.status = 'aprovado' then
        insert into notifications (user_id, type, title, message, task_id)
        select user_id, 'content_approved', 'Conteúdo aprovado', 'A tarefa "' || new.title || '" foi aprovada', new.id
        from task_assignees where task_id = new.id;
      elsif new.status = 'em_revisao' and old.status = 'aprovado' then
        insert into notifications (user_id, type, title, message, task_id)
        select user_id, 'content_rejected', 'Conteúdo voltou para revisão', 'A tarefa "' || new.title || '" voltou para revisão', new.id
        from task_assignees where task_id = new.id;
      end if;
    end if;

    if new.due_date is distinct from old.due_date then
      insert into activity_logs (user_id, action, entity_type, entity_id, metadata)
      values (auth.uid(), 'due_date_changed', 'task', new.id,
        jsonb_build_object('from', old.due_date, 'to', new.due_date, 'title', new.title));
    end if;

    if new.is_archived is distinct from old.is_archived then
      insert into activity_logs (user_id, action, entity_type, entity_id, metadata)
      values (auth.uid(), case when new.is_archived then 'archived' else 'unarchived' end, 'task', new.id,
        jsonb_build_object('title', new.title));
    end if;

    if new.deleted_at is distinct from old.deleted_at then
      insert into activity_logs (user_id, action, entity_type, entity_id, metadata)
      values (auth.uid(), case when new.deleted_at is not null then 'deleted' else 'restored' end, 'task', new.id,
        jsonb_build_object('title', new.title));
    end if;
  end if;

  return new;
end;
$$;

NOTIFY pgrst, 'reload schema';
