-- 0076_expansion_playbook.sql
-- Área da Expansão: (1) links das reuniões gravadas no Drive e (2) pastas com
-- roteiros e reuniões do processo comercial. Visíveis a qualquer usuário logado,
-- inclusive o papel "expansao" (por isso NÃO recebem a policy internal_users_only).

create table expansion_meeting_links (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  url text not null,
  meeting_date date,
  notes text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table expansion_folders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null default '#fcbf00',
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table expansion_docs (
  id uuid primary key default gen_random_uuid(),
  folder_id uuid references expansion_folders(id) on delete cascade,
  kind text not null default 'roteiro' check (kind in ('roteiro', 'reuniao')),
  title text not null,
  content text not null default '',
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_expansion_docs_folder on expansion_docs(folder_id);

alter table expansion_meeting_links enable row level security;
alter table expansion_folders enable row level security;
alter table expansion_docs enable row level security;

do $$
declare t text;
begin
  foreach t in array array['expansion_meeting_links', 'expansion_folders', 'expansion_docs'] loop
    execute format('create policy "%1$s_select" on %1$s for select using (auth.uid() is not null)', t);
    execute format('create policy "%1$s_insert" on %1$s for insert with check (auth.uid() is not null)', t);
    execute format('create policy "%1$s_update" on %1$s for update using (auth.uid() is not null)', t);
    execute format('create policy "%1$s_delete" on %1$s for delete using (auth.uid() is not null)', t);
    execute format('grant select, insert, update, delete on %I to authenticated, service_role', t);
  end loop;
end $$;
