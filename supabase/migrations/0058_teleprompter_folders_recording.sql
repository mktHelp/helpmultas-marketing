-- 0058_teleprompter_folders_recording.sql
-- Teleprompter: roteiros organizados em pastas, com data de gravação e check
-- de "gravado". Roteiros marcados como gravados saem da lista de pendentes
-- (continuam acessíveis na aba "Gravados"). O texto continua em `content`
-- (puro, usado pelo teleprompter) e a versão formatada do editor tipo
-- Google Docs fica em `content_html`.

create table teleprompter_folders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null default '#fcbf00',
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table teleprompter_scripts
  add column folder_id uuid references teleprompter_folders(id) on delete set null,
  add column content_html text,
  add column record_date date,
  add column is_recorded boolean not null default false,
  add column recorded_at timestamptz;

create index idx_teleprompter_scripts_folder on teleprompter_scripts(folder_id);
create index idx_teleprompter_scripts_pending on teleprompter_scripts(is_recorded, record_date);

alter table teleprompter_folders enable row level security;

create policy "teleprompter_folders_select" on teleprompter_folders for select using (auth.uid() is not null);
create policy "teleprompter_folders_insert" on teleprompter_folders for insert with check (auth.uid() is not null);
create policy "teleprompter_folders_update" on teleprompter_folders for update using (auth.uid() is not null);
create policy "teleprompter_folders_delete" on teleprompter_folders for delete using (auth.uid() is not null);

grant select, insert, update, delete on teleprompter_folders to authenticated, service_role;
