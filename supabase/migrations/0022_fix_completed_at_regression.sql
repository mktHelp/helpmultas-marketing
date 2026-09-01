-- 0022_fix_completed_at_regression.sql
-- 0014_track_archive_delete_actor.sql accidentally reverted set_task_completed_at()
-- back to its pre-0006/0010 form while adding archived_by/deleted_by handling:
-- it dropped the INSERT case and hardcoded status = 'concluido' instead of
-- looking up task_statuses.is_done. Since then, any task created directly in
-- a done stage (duplicate, import, quick-add) - or moved into a done stage
-- whose key isn't literally 'concluido' - never got completed_at stamped,
-- so it kept showing up as overdue everywhere (dashboard "Em atraso" count,
-- Kanban cards, task lists) even while sitting in the "Concluído" column.
-- This restores the dynamic INSERT+UPDATE logic and keeps 0014's
-- archived_by/deleted_by handling intact.

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
  select is_done into new_is_done from task_statuses where key = new.status;

  if tg_op = 'INSERT' then
    if coalesce(new_is_done, false) and new.completed_at is null then
      new.completed_at := now();
    end if;
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    select is_done into old_is_done from task_statuses where key = old.status;

    if coalesce(new_is_done, false) and not coalesce(old_is_done, false) then
      new.completed_at := now();
    elsif not coalesce(new_is_done, false) and coalesce(old_is_done, false) then
      new.completed_at := null;
    end if;
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

-- Backfill tasks that are currently in a "done" stage but never got a
-- completion date stamped because of the regression above.
update tasks
set completed_at = coalesce(updated_at, created_at)
where completed_at is null
  and status in (select key from task_statuses where is_done);
