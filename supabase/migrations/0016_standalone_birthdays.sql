-- 0016_standalone_birthdays.sql — Aniversários passam a ser uma lista própria
-- (nome + data + fotos), não vinculada a quem tem login na plataforma.

create table birthdays (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  birth_date date not null,
  notes text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table birthday_photos rename column profile_id to birthday_id;
alter table birthday_photos drop constraint if exists birthday_photos_profile_id_fkey;
alter table birthday_photos
  add constraint birthday_photos_birthday_id_fkey foreign key (birthday_id) references birthdays(id) on delete cascade;

alter table birthdays enable row level security;

create policy "birthdays_select" on birthdays for select using (auth.uid() is not null);
create policy "birthdays_insert" on birthdays for insert with check (auth.uid() is not null);
create policy "birthdays_update" on birthdays for update using (auth.uid() is not null);
create policy "birthdays_delete" on birthdays for delete using (auth.uid() is not null);
