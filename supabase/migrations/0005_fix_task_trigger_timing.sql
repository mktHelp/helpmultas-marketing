-- 0005_fix_task_trigger_timing.sql
-- Fixes trg_task_activity: it ran BEFORE INSERT/UPDATE and tried to insert into
-- activity_logs/notifications referencing the task's own id, which doesn't exist
-- yet at that point (FK violation on notifications_task_id_fkey / similar).
-- Splits it into a BEFORE trigger (only sets completed_at, mutates NEW) and an
-- AFTER trigger (writes to other tables, once the task row is committed).

create or replace function public.set_task_completed_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status
     and new.status = 'concluido' and old.status <> 'concluido' then
    new.completed_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_task_before_write on tasks;
create trigger trg_task_before_write
  before update on tasks
  for each row execute function set_task_completed_at();

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

    if new.assigned_to is not null and new.assigned_to <> new.created_by then
      insert into notifications (user_id, type, title, message, task_id)
      values (new.assigned_to, 'task_assigned', 'Nova tarefa atribuída', 'Você recebeu a tarefa "' || new.title || '"', new.id);
    end if;

  elsif tg_op = 'UPDATE' then
    if new.status is distinct from old.status then
      insert into activity_logs (user_id, action, entity_type, entity_id, metadata)
      values (auth.uid(), 'status_changed', 'task', new.id,
        jsonb_build_object('from', old.status, 'to', new.status, 'title', new.title));

      if new.status = 'aprovado' and new.assigned_to is not null then
        insert into notifications (user_id, type, title, message, task_id)
        values (new.assigned_to, 'content_approved', 'Conteúdo aprovado', 'Sua tarefa "' || new.title || '" foi aprovada', new.id);
      elsif new.status = 'em_revisao' and old.status = 'aprovado' and new.assigned_to is not null then
        insert into notifications (user_id, type, title, message, task_id)
        values (new.assigned_to, 'content_rejected', 'Conteúdo voltou para revisão', 'Sua tarefa "' || new.title || '" voltou para revisão', new.id);
      end if;
    end if;

    if new.assigned_to is distinct from old.assigned_to then
      insert into activity_logs (user_id, action, entity_type, entity_id, metadata)
      values (auth.uid(), 'reassigned', 'task', new.id,
        jsonb_build_object('from', old.assigned_to, 'to', new.assigned_to, 'title', new.title));

      if new.assigned_to is not null then
        insert into notifications (user_id, type, title, message, task_id)
        values (new.assigned_to, 'task_assigned', 'Nova tarefa atribuída', 'Você recebeu a tarefa "' || new.title || '"', new.id);
      end if;
    end if;

    if new.due_date is distinct from old.due_date then
      insert into activity_logs (user_id, action, entity_type, entity_id, metadata)
      values (auth.uid(), 'due_date_changed', 'task', new.id,
        jsonb_build_object('from', old.due_date, 'to', new.due_date, 'title', new.title));
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_task_activity on tasks;
create trigger trg_task_activity
  after insert or update on tasks
  for each row execute function log_task_activity();
