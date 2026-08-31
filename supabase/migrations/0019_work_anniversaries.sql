-- 0019_work_anniversaries.sql — "Aniversário de casa" (tempo de empresa),
-- separado do aniversário de vida, e notificação automática diária pra
-- toda a equipe quando é o dia de um aniversário (de vida ou de casa).
-- Run 0018_anniversary_notification_types.sql BEFORE this file.

create table work_anniversaries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  hire_date date not null,
  notes text,
  created_by uuid references profiles(id) on delete set null,
  last_notified_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table work_anniversary_photos (
  id uuid primary key default gen_random_uuid(),
  work_anniversary_id uuid not null references work_anniversaries(id) on delete cascade,
  uploaded_by uuid references profiles(id) on delete set null,
  file_name text not null,
  file_path text not null,
  file_type text,
  file_size bigint,
  created_at timestamptz not null default now()
);

create index idx_work_anniversary_photos_wa on work_anniversary_photos(work_anniversary_id);

alter table work_anniversaries enable row level security;
alter table work_anniversary_photos enable row level security;

create policy "work_anniversaries_select" on work_anniversaries for select using (auth.uid() is not null);
create policy "work_anniversaries_insert" on work_anniversaries for insert with check (auth.uid() is not null);
create policy "work_anniversaries_update" on work_anniversaries for update using (auth.uid() is not null);
create policy "work_anniversaries_delete" on work_anniversaries for delete using (auth.uid() is not null);

create policy "work_anniversary_photos_select" on work_anniversary_photos for select using (auth.uid() is not null);
create policy "work_anniversary_photos_insert" on work_anniversary_photos for insert with check (auth.uid() is not null);
create policy "work_anniversary_photos_delete" on work_anniversary_photos for delete using (auth.uid() is not null);

-- Reuses the same 'birthday-photos' storage bucket/policies from migration 0015.

alter table birthdays add column last_notified_on date;

-- ============================================================
-- DAILY NOTIFICATION: notifies every active team member when a
-- birthday or work anniversary falls on today.
-- ============================================================
create or replace function public.notify_todays_anniversaries()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  yrs int;
begin
  for r in
    select * from birthdays
    where birth_month = extract(month from current_date)
      and birth_day = extract(day from current_date)
      and last_notified_on is distinct from current_date
  loop
    insert into notifications (user_id, type, title, message)
    select id, 'birthday', 'Aniversário hoje: ' || r.name,
      'Hoje é aniversário de ' || r.name || '! Não esqueça de postar no story. 🎂'
    from profiles where is_active = true;

    update birthdays set last_notified_on = current_date where id = r.id;
  end loop;

  for r in
    select * from work_anniversaries
    where extract(month from hire_date) = extract(month from current_date)
      and extract(day from hire_date) = extract(day from current_date)
      and last_notified_on is distinct from current_date
  loop
    yrs := extract(year from age(current_date, r.hire_date));
    insert into notifications (user_id, type, title, message)
    select id, 'work_anniversary', 'Aniversário de casa: ' || r.name,
      r.name || ' completa ' || yrs || ' ano(s) de empresa hoje! 🎉'
    from profiles where is_active = true;

    update work_anniversaries set last_notified_on = current_date where id = r.id;
  end loop;
end;
$$;

create extension if not exists pg_cron with schema extensions;

select cron.schedule(
  'daily-anniversary-notifications',
  '0 11 * * *', -- 08:00 America/Sao_Paulo
  $$select public.notify_todays_anniversaries();$$
);

NOTIFY pgrst, 'reload schema';
