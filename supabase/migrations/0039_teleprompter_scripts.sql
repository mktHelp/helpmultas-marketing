-- 0039_teleprompter_scripts.sql
-- Banco interno de roteiros para a aba de Teleprompter.

create table teleprompter_scripts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null default '',
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_teleprompter_scripts_updated_at
  before update on teleprompter_scripts
  for each row execute function set_updated_at();

alter table teleprompter_scripts enable row level security;

create policy "teleprompter_scripts_select" on teleprompter_scripts for select using (auth.uid() is not null);
create policy "teleprompter_scripts_insert" on teleprompter_scripts for insert with check (auth.uid() is not null);
create policy "teleprompter_scripts_update" on teleprompter_scripts for update using (auth.uid() is not null);
create policy "teleprompter_scripts_delete" on teleprompter_scripts for delete using (auth.uid() is not null);
