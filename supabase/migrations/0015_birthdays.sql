-- 0015_birthdays.sql — Área de Aniversários

alter table profiles add column if not exists birth_date date;

create table birthday_photos (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  uploaded_by uuid references profiles(id) on delete set null,
  file_name text not null,
  file_path text not null,
  file_type text,
  file_size bigint,
  created_at timestamptz not null default now()
);

create index idx_birthday_photos_profile on birthday_photos(profile_id);

alter table birthday_photos enable row level security;

create policy "birthday_photos_select"
  on birthday_photos for select
  using (auth.uid() is not null);

create policy "birthday_photos_insert"
  on birthday_photos for insert
  with check (auth.uid() is not null);

create policy "birthday_photos_delete"
  on birthday_photos for delete
  using (auth.uid() is not null);

-- Storage bucket for birthday photos
insert into storage.buckets (id, name, public)
values ('birthday-photos', 'birthday-photos', false)
on conflict (id) do nothing;

create policy "birthday_photos_storage_select"
  on storage.objects for select
  using (bucket_id = 'birthday-photos' and auth.uid() is not null);

create policy "birthday_photos_storage_insert"
  on storage.objects for insert
  with check (bucket_id = 'birthday-photos' and auth.uid() is not null);

create policy "birthday_photos_storage_delete"
  on storage.objects for delete
  using (bucket_id = 'birthday-photos' and auth.uid() is not null);
