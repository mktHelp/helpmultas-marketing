-- 0023_project_creatives.sql — aba "Criativos" dentro de um projeto: uma
-- tabela estilo planilha (nome, unidade, quem entregou, data de entrega,
-- link do criativo) editável em tempo real por vários usuários.

create table project_creatives (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null default '',
  unit text not null default '',
  delivered_by uuid references profiles(id) on delete set null,
  delivered_at date,
  link text not null default '',
  sort_order int not null default 0,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_project_creatives_project on project_creatives(project_id);

alter table project_creatives enable row level security;

create policy "project_creatives_select" on project_creatives for select using (auth.uid() is not null);
create policy "project_creatives_insert" on project_creatives for insert with check (auth.uid() is not null);
create policy "project_creatives_update" on project_creatives for update using (auth.uid() is not null);
create policy "project_creatives_delete" on project_creatives for delete using (auth.uid() is not null);

create trigger set_project_creatives_updated_at
  before update on project_creatives
  for each row execute function set_updated_at();

alter publication supabase_realtime add table project_creatives;
