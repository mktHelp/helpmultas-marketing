-- Help Multas Marketing Task Management System
-- 0001_schema.sql — core tables

create extension if not exists "pgcrypto";

-- ============================================================
-- ENUM TYPES
-- ============================================================
create type user_role as enum ('master', 'gestor', 'membro');
create type task_priority as enum ('baixa', 'media', 'alta', 'urgente');
create type task_status as enum (
  'backlog', 'planejamento', 'em_producao', 'em_revisao',
  'aprovado', 'publicado', 'concluido', 'pausado', 'cancelado'
);
create type project_status as enum ('planejamento', 'em_andamento', 'pausado', 'concluido', 'cancelado');
create type campaign_status as enum ('planejamento', 'ativa', 'pausada', 'encerrada');
create type content_type as enum (
  'reels', 'stories', 'feed', 'carrossel', 'youtube', 'blog',
  'email', 'whatsapp', 'anuncio', 'landing_page'
);
create type recurrence_freq as enum ('diaria', 'semanal', 'quinzenal', 'mensal');
create type notification_type as enum (
  'task_assigned', 'due_soon', 'overdue', 'mentioned',
  'content_approved', 'content_rejected', 'comment_added', 'status_changed'
);

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  avatar_url text,
  role user_role not null default 'membro',
  department text,
  job_title text,
  phone text,
  preferences jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- AREAS & CATEGORIES
-- ============================================================
create table areas (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  color text not null default '#243746',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  area_id uuid references areas(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- PROJECTS & CAMPAIGNS
-- ============================================================
create table projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  owner_id uuid references profiles(id) on delete set null,
  status project_status not null default 'planejamento',
  priority task_priority not null default 'media',
  start_date date,
  end_date date,
  progress smallint not null default 0 check (progress between 0 and 100),
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  objective text,
  owner_id uuid references profiles(id) on delete set null,
  budget numeric(12,2),
  status campaign_status not null default 'planejamento',
  start_date date,
  end_date date,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- TAGS
-- ============================================================
create table tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null default '#4a6a80',
  created_at timestamptz not null default now()
);

-- ============================================================
-- TASK TEMPLATES
-- ============================================================
create table task_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  area_id uuid references areas(id) on delete set null,
  content_type content_type,
  checklist_items jsonb not null default '[]'::jsonb, -- [{title, sort_order}]
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- TASKS
-- ============================================================
create table tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  project_id uuid references projects(id) on delete set null,
  campaign_id uuid references campaigns(id) on delete set null,
  area_id uuid references areas(id) on delete set null,
  category_id uuid references categories(id) on delete set null,
  content_type content_type,
  assigned_to uuid references profiles(id) on delete set null,
  created_by uuid references profiles(id) on delete set null,
  status task_status not null default 'backlog',
  priority task_priority not null default 'media',
  start_date date,
  due_date timestamptz,
  completed_at timestamptz,
  estimated_minutes int,
  actual_minutes int,
  -- content-production specific fields
  briefing text,
  script_notes text,
  caption text,
  cta text,
  publish_at timestamptz,
  -- recurrence
  is_recurring boolean not null default false,
  recurrence_freq recurrence_freq,
  recurrence_source_id uuid references tasks(id) on delete set null,
  template_id uuid references task_templates(id) on delete set null,
  is_archived boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_tasks_assigned_to on tasks(assigned_to);
create index idx_tasks_status on tasks(status);
create index idx_tasks_due_date on tasks(due_date);
create index idx_tasks_project on tasks(project_id);
create index idx_tasks_campaign on tasks(campaign_id);
create index idx_tasks_area on tasks(area_id);
create index idx_tasks_archived on tasks(is_archived);

create table task_tags (
  task_id uuid references tasks(id) on delete cascade,
  tag_id uuid references tags(id) on delete cascade,
  primary key (task_id, tag_id)
);

create table task_dependencies (
  task_id uuid references tasks(id) on delete cascade,
  depends_on_task_id uuid references tasks(id) on delete cascade,
  primary key (task_id, depends_on_task_id),
  check (task_id <> depends_on_task_id)
);

create table task_checklists (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  title text not null,
  completed boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index idx_checklist_task on task_checklists(task_id);

create table task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  user_id uuid references profiles(id) on delete set null,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_comments_task on task_comments(task_id);

create table task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  user_id uuid references profiles(id) on delete set null,
  file_name text not null,
  file_path text not null,
  file_type text,
  file_size bigint,
  created_at timestamptz not null default now()
);

create index idx_attachments_task on task_attachments(task_id);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  type notification_type not null,
  title text not null,
  message text not null,
  task_id uuid references tasks(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_notifications_user on notifications(user_id, read_at);

-- ============================================================
-- ACTIVITY LOGS (audit)
-- ============================================================
create table activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_activity_entity on activity_logs(entity_type, entity_id);
create index idx_activity_user on activity_logs(user_id);

-- ============================================================
-- USER VIEW PREFERENCES (per-page: table/kanban/calendar/list)
-- ============================================================
create table view_preferences (
  user_id uuid references profiles(id) on delete cascade,
  view_key text not null,
  view_type text not null default 'table',
  primary key (user_id, view_key)
);
