-- 0010_fix_completed_at_on_insert.sql
-- set_task_completed_at() only ran on UPDATE, so a task created directly in
-- a "done" stage (e.g. via duplicate, import, or just picking that status
-- in the create form) never got completed_at set - which crashed dashboard
-- stats that assumed every done-status task has one. Also backfills the
-- rows this already happened to.

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

  return new;
end;
$$;

drop trigger if exists trg_task_before_write on tasks;
create trigger trg_task_before_write
  before insert or update on tasks
  for each row execute function set_task_completed_at();

-- Backfill existing tasks that are in a "done" stage but never got a
-- completion date (use created_at as the best available estimate).
update tasks
set completed_at = created_at
where completed_at is null
  and status in (select key from task_statuses where is_done);
