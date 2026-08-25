-- 0008_task_multiple_assignees.sql
-- Replaces the single tasks.assigned_to column with a task_assignees join
-- table so a task can have more than one responsible person.

create table task_assignees (
  task_id uuid not null references tasks(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (task_id, user_id)
);

create index idx_task_assignees_user on task_assignees(user_id);
create index idx_task_assignees_task on task_assignees(task_id);

-- Preserve whoever was already assigned under the old single-assignee column.
insert into task_assignees (task_id, user_id)
select id, assigned_to from tasks where assigned_to is not null
on conflict do nothing;

alter table task_assignees enable row level security;

create policy "task_assignees_select_all" on task_assignees for select using (auth.uid() is not null);
create policy "task_assignees_write_all" on task_assignees for insert with check (auth.uid() is not null);
create policy "task_assignees_delete_all" on task_assignees for delete using (auth.uid() is not null);

-- A task can now be edited by anyone who is *any* of its assignees, not just
-- a single one.
drop policy if exists "tasks_update_scoped" on tasks;
create policy "tasks_update_scoped" on tasks for update using (
  is_manager_or_admin()
  or created_by = auth.uid()
  or exists (select 1 from task_assignees ta where ta.task_id = tasks.id and ta.user_id = auth.uid())
);

-- Assignment activity/notifications move from the tasks.assigned_to trigger
-- to their own trigger on task_assignees (fires once per person added/removed).
create or replace function public.log_assignment_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  t tasks%rowtype;
begin
  if tg_op = 'INSERT' then
    select * into t from tasks where id = new.task_id;

    insert into activity_logs (user_id, action, entity_type, entity_id, metadata)
    values (auth.uid(), 'assigned', 'task', new.task_id, jsonb_build_object('user_id', new.user_id, 'title', t.title));

    if new.user_id <> t.created_by then
      insert into notifications (user_id, type, title, message, task_id)
      values (new.user_id, 'task_assigned', 'Nova tarefa atribuída', 'Você recebeu a tarefa "' || t.title || '"', new.task_id);
    end if;

  elsif tg_op = 'DELETE' then
    insert into activity_logs (user_id, action, entity_type, entity_id, metadata)
    values (auth.uid(), 'unassigned', 'task', old.task_id, jsonb_build_object('user_id', old.user_id));
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_assignment_activity on task_assignees;
create trigger trg_assignment_activity
  after insert or delete on task_assignees
  for each row execute function log_assignment_activity();

-- log_task_activity() no longer needs to handle assignment (moved above) or
-- reference the now-removed assigned_to column; "approved/back to review"
-- notifications now go out to every current assignee.
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
  end if;

  return new;
end;
$$;

-- Comment notifications now go to every assignee instead of a single one.
create or replace function public.log_comment_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  t tasks%rowtype;
begin
  select * into t from tasks where id = new.task_id;

  insert into activity_logs (user_id, action, entity_type, entity_id, metadata)
  values (new.user_id, 'commented', 'task', new.task_id, jsonb_build_object('comment_id', new.id));

  insert into notifications (user_id, type, title, message, task_id)
  select user_id, 'comment_added', 'Novo comentário', 'Novo comentário na tarefa "' || t.title || '"', new.task_id
  from task_assignees
  where task_id = new.task_id and user_id <> new.user_id;

  return new;
end;
$$;

alter table tasks drop column assigned_to;
