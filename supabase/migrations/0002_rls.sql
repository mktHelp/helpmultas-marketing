-- 0002_rls.sql — Row Level Security

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================
create or replace function public.current_role()
returns user_role
language sql
security definer
stable
set search_path = public
as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select role = 'master' from profiles where id = auth.uid()), false);
$$;

create or replace function public.is_manager_or_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select role in ('master', 'gestor') from profiles where id = auth.uid()), false);
$$;

-- ============================================================
-- ENABLE RLS
-- ============================================================
alter table profiles enable row level security;
alter table areas enable row level security;
alter table categories enable row level security;
alter table projects enable row level security;
alter table campaigns enable row level security;
alter table tags enable row level security;
alter table task_templates enable row level security;
alter table tasks enable row level security;
alter table task_tags enable row level security;
alter table task_dependencies enable row level security;
alter table task_checklists enable row level security;
alter table task_comments enable row level security;
alter table task_attachments enable row level security;
alter table notifications enable row level security;
alter table activity_logs enable row level security;
alter table view_preferences enable row level security;

-- ============================================================
-- PROFILES
-- ============================================================
create policy "profiles_select_all" on profiles for select using (auth.uid() is not null);
create policy "profiles_update_own" on profiles for update using (id = auth.uid() or is_admin());
create policy "profiles_insert_admin" on profiles for insert with check (is_admin() or id = auth.uid());
create policy "profiles_delete_admin" on profiles for delete using (is_admin());

-- ============================================================
-- AREAS / CATEGORIES / TAGS (read all, write manager+)
-- ============================================================
create policy "areas_select_all" on areas for select using (auth.uid() is not null);
create policy "areas_write_manager" on areas for insert with check (is_manager_or_admin());
create policy "areas_update_manager" on areas for update using (is_manager_or_admin());
create policy "areas_delete_admin" on areas for delete using (is_admin());

create policy "categories_select_all" on categories for select using (auth.uid() is not null);
create policy "categories_write_manager" on categories for insert with check (is_manager_or_admin());
create policy "categories_update_manager" on categories for update using (is_manager_or_admin());
create policy "categories_delete_admin" on categories for delete using (is_admin());

create policy "tags_select_all" on tags for select using (auth.uid() is not null);
create policy "tags_write_all" on tags for insert with check (auth.uid() is not null);
create policy "tags_update_manager" on tags for update using (is_manager_or_admin());
create policy "tags_delete_admin" on tags for delete using (is_admin());

-- ============================================================
-- PROJECTS / CAMPAIGNS (read all, write manager+, delete admin)
-- ============================================================
create policy "projects_select_all" on projects for select using (auth.uid() is not null);
create policy "projects_insert_manager" on projects for insert with check (is_manager_or_admin());
create policy "projects_update_manager" on projects for update using (is_manager_or_admin());
create policy "projects_delete_admin" on projects for delete using (is_admin());

create policy "campaigns_select_all" on campaigns for select using (auth.uid() is not null);
create policy "campaigns_insert_manager" on campaigns for insert with check (is_manager_or_admin());
create policy "campaigns_update_manager" on campaigns for update using (is_manager_or_admin());
create policy "campaigns_delete_admin" on campaigns for delete using (is_admin());

-- ============================================================
-- TASK TEMPLATES
-- ============================================================
create policy "templates_select_all" on task_templates for select using (auth.uid() is not null);
create policy "templates_write_all" on task_templates for insert with check (auth.uid() is not null);
create policy "templates_update_own_or_manager" on task_templates for update using (created_by = auth.uid() or is_manager_or_admin());
create policy "templates_delete_manager" on task_templates for delete using (is_manager_or_admin());

-- ============================================================
-- TASKS
-- everyone authenticated can read (team-wide visibility, common in small marketing teams)
-- any authenticated user can create a task
-- membro can only update tasks they are assigned to or created; manager/admin can update any
-- only manager/admin can delete
-- ============================================================
create policy "tasks_select_all" on tasks for select using (auth.uid() is not null);

create policy "tasks_insert_all" on tasks for insert with check (auth.uid() is not null);

create policy "tasks_update_scoped" on tasks for update using (
  is_manager_or_admin() or assigned_to = auth.uid() or created_by = auth.uid()
);

create policy "tasks_delete_manager" on tasks for delete using (is_manager_or_admin());

create policy "task_tags_select_all" on task_tags for select using (auth.uid() is not null);
create policy "task_tags_write_all" on task_tags for insert with check (auth.uid() is not null);
create policy "task_tags_delete_all" on task_tags for delete using (auth.uid() is not null);

create policy "task_deps_select_all" on task_dependencies for select using (auth.uid() is not null);
create policy "task_deps_write_all" on task_dependencies for insert with check (auth.uid() is not null);
create policy "task_deps_delete_all" on task_dependencies for delete using (auth.uid() is not null);

create policy "checklist_select_all" on task_checklists for select using (auth.uid() is not null);
create policy "checklist_write_all" on task_checklists for insert with check (auth.uid() is not null);
create policy "checklist_update_all" on task_checklists for update using (auth.uid() is not null);
create policy "checklist_delete_all" on task_checklists for delete using (auth.uid() is not null);

create policy "comments_select_all" on task_comments for select using (auth.uid() is not null);
create policy "comments_insert_own" on task_comments for insert with check (user_id = auth.uid());
create policy "comments_update_own" on task_comments for update using (user_id = auth.uid() or is_admin());
create policy "comments_delete_own" on task_comments for delete using (user_id = auth.uid() or is_admin());

create policy "attachments_select_all" on task_attachments for select using (auth.uid() is not null);
create policy "attachments_insert_own" on task_attachments for insert with check (user_id = auth.uid());
create policy "attachments_delete_own" on task_attachments for delete using (user_id = auth.uid() or is_manager_or_admin());

-- ============================================================
-- NOTIFICATIONS (own only)
-- ============================================================
create policy "notifications_select_own" on notifications for select using (user_id = auth.uid());
create policy "notifications_insert_all" on notifications for insert with check (auth.uid() is not null);
create policy "notifications_update_own" on notifications for update using (user_id = auth.uid());
create policy "notifications_delete_own" on notifications for delete using (user_id = auth.uid());

-- ============================================================
-- ACTIVITY LOGS (managers see all, members see their own)
-- ============================================================
create policy "activity_select_scoped" on activity_logs for select using (
  is_manager_or_admin() or user_id = auth.uid()
);
create policy "activity_insert_all" on activity_logs for insert with check (auth.uid() is not null);

-- ============================================================
-- VIEW PREFERENCES (own only)
-- ============================================================
create policy "view_prefs_all_own" on view_preferences for all using (user_id = auth.uid()) with check (user_id = auth.uid());
