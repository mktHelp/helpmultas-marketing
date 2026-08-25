-- 0006_dynamic_task_statuses.sql
-- Makes task stages ("etapas") fully manageable from Settings: create, rename,
-- recolor, reorder, activate/deactivate, delete. Replaces the fixed
-- `task_status` enum with a `task_statuses` table that `tasks.status`
-- references by key (text), so new stages can be added without a migration.

create table task_statuses (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  color text not null default '#7c8e98',
  sort_order int not null default 0,
  is_active boolean not null default true,
  is_default boolean not null default false, -- status assigned to new tasks
  is_done boolean not null default false,     -- counts as "completed" for stats
  is_cancelled boolean not null default false,
  created_at timestamptz not null default now()
);

insert into task_statuses (key, label, color, sort_order, is_default, is_done, is_cancelled) values
  ('backlog', 'Backlog', '#7c8e98', 0, true, false, false),
  ('planejamento', 'Planejamento', '#4a6a80', 1, false, false, false),
  ('em_producao', 'Em Produção', '#fcbf00', 2, false, false, false),
  ('em_revisao', 'Em Revisão', '#e0a900', 3, false, false, false),
  ('aprovado', 'Aprovado', '#375367', 4, false, false, false),
  ('publicado', 'Publicado', '#2f8f5b', 5, false, false, false),
  ('concluido', 'Concluído', '#2f8f5b', 6, false, true, false),
  ('pausado', 'Pausado', '#b7c3ca', 7, false, false, false),
  ('cancelado', 'Cancelado', '#c23b3b', 8, false, false, true);

-- Swap tasks.status from the fixed enum to plain text referencing task_statuses.key
alter table tasks alter column status type text using status::text;
alter table tasks alter column status set default 'backlog';
alter table tasks add constraint tasks_status_fkey foreign key (status) references task_statuses(key) on update cascade;

drop type task_status;

-- The old set_task_completed_at() trigger keyed off the literal 'concluido'
-- status. Now that "done" is a user-configurable flag on task_statuses
-- (is_done), completion timestamps should follow that flag instead, so a
-- custom stage marked "Concluído" in Settings behaves the same way.
create or replace function public.set_task_completed_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_is_done boolean;
  old_is_done boolean;
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    select is_done into new_is_done from task_statuses where key = new.status;
    select is_done into old_is_done from task_statuses where key = old.status;

    if coalesce(new_is_done, false) and not coalesce(old_is_done, false) then
      new.completed_at := now();
    elsif not coalesce(new_is_done, false) and coalesce(old_is_done, false) then
      new.completed_at := null;
    end if;
  end if;

  return new;
end;
$$;

alter table task_statuses enable row level security;

create policy "task_statuses_select_all" on task_statuses for select using (auth.uid() is not null);
create policy "task_statuses_write_manager" on task_statuses for insert with check (is_manager_or_admin());
create policy "task_statuses_update_manager" on task_statuses for update using (is_manager_or_admin());
create policy "task_statuses_delete_manager" on task_statuses for delete using (is_manager_or_admin());
