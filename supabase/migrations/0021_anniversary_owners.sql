-- 0021_anniversary_owners.sql — vincula colaboradores da plataforma como
-- responsáveis por postar o story de cada aniversário (de vida ou de casa).

create table birthday_owners (
  birthday_id uuid not null references birthdays(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  primary key (birthday_id, profile_id)
);

create table work_anniversary_owners (
  work_anniversary_id uuid not null references work_anniversaries(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  primary key (work_anniversary_id, profile_id)
);

create index idx_birthday_owners_profile on birthday_owners(profile_id);
create index idx_work_anniversary_owners_profile on work_anniversary_owners(profile_id);

alter table birthday_owners enable row level security;
alter table work_anniversary_owners enable row level security;

create policy "birthday_owners_select" on birthday_owners for select using (auth.uid() is not null);
create policy "birthday_owners_insert" on birthday_owners for insert with check (auth.uid() is not null);
create policy "birthday_owners_delete" on birthday_owners for delete using (auth.uid() is not null);

create policy "work_anniversary_owners_select" on work_anniversary_owners for select using (auth.uid() is not null);
create policy "work_anniversary_owners_insert" on work_anniversary_owners for insert with check (auth.uid() is not null);
create policy "work_anniversary_owners_delete" on work_anniversary_owners for delete using (auth.uid() is not null);

NOTIFY pgrst, 'reload schema';
