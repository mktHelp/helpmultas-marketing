-- 0003_functions_triggers.sql

-- ============================================================
-- Auto-create a profile row whenever a new auth user is created.
-- role defaults to 'membro' unless raw_user_meta_data.role is set
-- (used by the first-master bootstrap script).
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role, department, job_title)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'membro'),
    new.raw_user_meta_data->>'department',
    new.raw_user_meta_data->>'job_title'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- updated_at maintenance
-- ============================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at before update on profiles for each row execute function set_updated_at();
create trigger trg_projects_updated_at before update on projects for each row execute function set_updated_at();
create trigger trg_campaigns_updated_at before update on campaigns for each row execute function set_updated_at();
create trigger trg_tasks_updated_at before update on tasks for each row execute function set_updated_at();
create trigger trg_comments_updated_at before update on task_comments for each row execute function set_updated_at();

-- ============================================================
-- Task change auditing + notifications
-- ============================================================
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
  end if;

  return new;
end;
$$;

drop trigger if exists trg_task_activity on tasks;
create trigger trg_task_activity
  after insert or update on tasks
  for each row execute function log_task_activity();

-- comment notification
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

  if t.assigned_to is not null and t.assigned_to <> new.user_id then
    insert into notifications (user_id, type, title, message, task_id)
    values (t.assigned_to, 'comment_added', 'Novo comentário', 'Novo comentário na tarefa "' || t.title || '"', new.task_id);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_comment_activity on task_comments;
create trigger trg_comment_activity
  after insert on task_comments
  for each row execute function log_comment_activity();

-- checklist completion logging
create or replace function public.log_checklist_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.completed is distinct from old.completed and new.completed then
    insert into activity_logs (user_id, action, entity_type, entity_id, metadata)
    values (auth.uid(), 'checklist_completed', 'task', new.task_id, jsonb_build_object('item', new.title));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_checklist_activity on task_checklists;
create trigger trg_checklist_activity
  after update on task_checklists
  for each row execute function log_checklist_activity();

-- ============================================================
-- Storage bucket for task attachments
-- ============================================================
insert into storage.buckets (id, name, public)
values ('task-attachments', 'task-attachments', false)
on conflict (id) do nothing;

create policy "attachments_storage_select"
  on storage.objects for select
  using (bucket_id = 'task-attachments' and auth.uid() is not null);

create policy "attachments_storage_insert"
  on storage.objects for insert
  with check (bucket_id = 'task-attachments' and auth.uid() is not null);

create policy "attachments_storage_delete"
  on storage.objects for delete
  using (bucket_id = 'task-attachments' and auth.uid() is not null);
