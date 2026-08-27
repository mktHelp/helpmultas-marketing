-- 0014_track_archive_delete_actor.sql
-- Archiving/deleting a task never recorded *who* did it - only archived_at
-- and deleted_at timestamps existed. Add actor columns, populate them from
-- auth.uid() in the same before-write trigger that already stamps
-- completed_at, and log activity_logs entries so the change shows up in the
-- task's history timeline too.

alter table tasks add column archived_by uuid references profiles(id) on delete set null;
alter table tasks add column deleted_by uuid references profiles(id) on delete set null;

create or replace function public.set_task_completed_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Runs BEFORE the write so it can only mutate NEW; it must not touch other
  -- tables here because NEW's row does not exist/commit in `tasks` yet.
  if tg_op = 'UPDATE' and new.status is distinct from old.status
     and new.status = 'concluido' and old.status <> 'concluido' then
    new.completed_at := now();
  end if;

  if tg_op = 'UPDATE' and new.is_archived is distinct from old.is_archived then
    new.archived_by := case when new.is_archived then auth.uid() else null end;
  end if;

  if tg_op = 'UPDATE' and new.deleted_at is distinct from old.deleted_at then
    new.deleted_by := case when new.deleted_at is not null then auth.uid() else null end;
  end if;

  return new;
end;
$$;

create or replace function public.log_task_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Runs AFTER the write, so NEW.id is guaranteed to exist in `tasks` and can
  -- safely be referenced by activity_logs/notifications foreign keys.
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
