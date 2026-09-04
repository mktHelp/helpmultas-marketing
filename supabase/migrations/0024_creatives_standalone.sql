-- 0024_creatives_standalone.sql — a planilha de criativos deixa de ser
-- vinculada a um projeto específico e passa a ser uma lista própria,
-- acessível por uma aba dedicada no menu lateral.

alter table project_creatives alter column project_id drop not null;
alter table project_creatives drop constraint if exists project_creatives_project_id_fkey;
alter table project_creatives
  add constraint project_creatives_project_id_fkey foreign key (project_id) references projects(id) on delete set null;

alter table project_creatives rename to creatives;
