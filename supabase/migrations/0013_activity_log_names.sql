-- 0013_activity_log_names.sql
-- log_assignment_activity() only stored the assignee's user_id in
-- activity_logs.metadata, so the UI couldn't show a name without an extra
-- lookup per entry. Denormalize the name in at write time instead.

create or replace function public.log_assignment_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  t tasks%rowtype;
  assignee_name text;
begin
  if tg_op = 'INSERT' then
    select * into t from tasks where id = new.task_id;
    select full_name into assignee_name from profiles where id = new.user_id;

    insert into activity_logs (user_id, action, entity_type, entity_id, metadata)
    values (auth.uid(), 'assigned', 'task', new.task_id,
      jsonb_build_object('user_id', new.user_id, 'user_name', assignee_name, 'title', t.title));

    if new.user_id <> t.created_by then
      insert into notifications (user_id, type, title, message, task_id)
      values (new.user_id, 'task_assigned', 'Nova tarefa atribuída', 'Você recebeu a tarefa "' || t.title || '"', new.task_id);
    end if;

  elsif tg_op = 'DELETE' then
    select full_name into assignee_name from profiles where id = old.user_id;

    insert into activity_logs (user_id, action, entity_type, entity_id, metadata)
    values (auth.uid(), 'unassigned', 'task', old.task_id,
      jsonb_build_object('user_id', old.user_id, 'user_name', assignee_name));
  end if;

  return coalesce(new, old);
end;
$$;
