import type { SupabaseClient } from "@supabase/supabase-js";
import type { Task, TaskWithRelations, TaskChecklistItem, TaskComment, TaskAttachment, TaskStatus, Tag, Profile } from "@/types/database";

// Explicit `: string` (not a literal type) so the Supabase client's compile-time
// select-string parser doesn't try to statically parse this multi-relation
// embed - which it can't with `Database = any` schemas anyway, and hits a
// parser error on the nested task_assignees(profiles(...)) embed if it tries.
// Full select used by the Kanban/table/detail views (needs tags + checklists).
const TASK_SELECT: string = `
  *,
  creator:profiles!tasks_created_by_fkey(id, full_name, avatar_url),
  archiver:profiles!tasks_archived_by_fkey(id, full_name, avatar_url),
  deleter:profiles!tasks_deleted_by_fkey(id, full_name, avatar_url),
  project:projects(id, name),
  campaign:campaigns(id, name),
  area:areas(id, name, color),
  category:categories(id, name),
  task_assignees(profiles(id, full_name, avatar_url)),
  task_tags(tags(id, name, color)),
  task_checklists(id, task_id, title, completed, sort_order, created_at)
`;

// Lighter select for dashboard/report aggregation, which only reads status,
// priority, dates and area/assignees - task_tags/task_checklists require
// Postgres to compute embedded array subqueries per row and aren't rendered
// there, so skipping them cuts real query cost.
const TASK_SELECT_LIGHT: string = `
  *,
  creator:profiles!tasks_created_by_fkey(id, full_name, avatar_url),
  project:projects(id, name),
  campaign:campaigns(id, name),
  area:areas(id, name, color),
  category:categories(id, name),
  task_assignees(profiles(id, full_name, avatar_url))
`;

interface TaskRow extends Task {
  task_tags?: { tags: Tag }[];
  task_checklists?: TaskChecklistItem[];
  task_assignees?: { profiles: Pick<Profile, "id" | "full_name" | "avatar_url"> }[];
}

function normalize(row: TaskRow): TaskWithRelations {
  return {
    ...row,
    tags: (row.task_tags || []).map((t) => t.tags).filter(Boolean),
    checklists: [...(row.task_checklists || [])].sort((a, b) => a.sort_order - b.sort_order),
    assignees: (row.task_assignees || []).map((a) => a.profiles).filter(Boolean),
  };
}

export interface TaskFilters {
  status?: TaskStatus[];
  assignedTo?: string[];
  areaId?: string[];
  projectId?: string;
  campaignId?: string;
  priority?: string[];
  search?: string;
  dueBefore?: string;
  dueAfter?: string;
  createdFrom?: string;
  createdTo?: string;
  movedFrom?: string;
  movedTo?: string;
  includeArchived?: boolean;
  archivedOnly?: boolean;
  onlyDeleted?: boolean;
  onlyOverdue?: boolean;
  light?: boolean;
}

export async function listTasks(supabase: SupabaseClient, filters: TaskFilters = {}) {
  let query = supabase
    .from("tasks")
    .select(filters.light ? TASK_SELECT_LIGHT : TASK_SELECT)
    .order("due_date", { ascending: true, nullsFirst: false });

  if (filters.onlyDeleted) {
    query = query.not("deleted_at", "is", null);
  } else {
    query = query.is("deleted_at", null);
    if (filters.archivedOnly) query = query.eq("is_archived", true);
    else if (!filters.includeArchived) query = query.eq("is_archived", false);
  }

  if (filters.status?.length) query = query.in("status", filters.status);
  if (filters.assignedTo?.length) {
    const { data: assigned } = await supabase.from("task_assignees").select("task_id").in("user_id", filters.assignedTo);
    const ids = Array.from(new Set((assigned || []).map((a) => a.task_id)));
    query = query.in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  }
  if (filters.areaId?.length) query = query.in("area_id", filters.areaId);
  if (filters.projectId) query = query.eq("project_id", filters.projectId);
  if (filters.campaignId) query = query.eq("campaign_id", filters.campaignId);
  if (filters.priority?.length) query = query.in("priority", filters.priority);
  if (filters.search) query = query.ilike("title", `%${filters.search}%`);
  if (filters.dueBefore) query = query.lte("due_date", filters.dueBefore);
  if (filters.dueAfter) query = query.gte("due_date", filters.dueAfter);
  if (filters.createdFrom) query = query.gte("created_at", filters.createdFrom);
  if (filters.createdTo) query = query.lte("created_at", filters.createdTo);
  if (filters.movedFrom || filters.movedTo) {
    let moveQuery = supabase.from("activity_logs").select("entity_id").eq("entity_type", "task").eq("action", "status_changed");
    if (filters.movedFrom) moveQuery = moveQuery.gte("created_at", filters.movedFrom);
    if (filters.movedTo) moveQuery = moveQuery.lte("created_at", filters.movedTo);
    const { data: moved } = await moveQuery;
    const ids = Array.from(new Set((moved || []).map((m) => m.entity_id)));
    query = query.in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  }
  if (filters.onlyOverdue) {
    query = query.lt("due_date", new Date().toISOString()).is("completed_at", null);
  }

  const { data, error } = await query;
  if (error) throw error;
  return ((data as unknown as TaskRow[]) || []).map(normalize);
}

export async function getTask(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase.from("tasks").select(TASK_SELECT).eq("id", id).single();
  if (error) throw error;
  return normalize(data as unknown as TaskRow);
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  project_id?: string | null;
  campaign_id?: string | null;
  area_id?: string | null;
  category_id?: string | null;
  content_type?: string | null;
  created_by: string;
  status?: TaskStatus;
  priority?: string;
  start_date?: string | null;
  due_date?: string | null;
  estimated_minutes?: number | null;
  is_recurring?: boolean;
  recurrence_freq?: string | null;
  template_id?: string | null;
  tagIds?: string[];
  assigneeIds?: string[];
  checklistItems?: string[];
}

export async function createTask(supabase: SupabaseClient, input: CreateTaskInput) {
  const { tagIds, assigneeIds, checklistItems, ...taskFields } = input;
  const { data, error } = await supabase.from("tasks").insert(taskFields).select().single();
  if (error) throw error;
  const task = data as Task;

  if (tagIds?.length) {
    await supabase.from("task_tags").insert(tagIds.map((tag_id) => ({ task_id: task.id, tag_id })));
  }
  if (assigneeIds?.length) {
    await supabase.from("task_assignees").insert(assigneeIds.map((user_id) => ({ task_id: task.id, user_id })));
  }
  if (checklistItems?.length) {
    await supabase.from("task_checklists").insert(
      checklistItems.map((title, i) => ({ task_id: task.id, title, sort_order: i }))
    );
  }

  return task;
}

export async function updateTask(supabase: SupabaseClient, id: string, patch: Partial<Task>) {
  const { data, error } = await supabase.from("tasks").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data as Task;
}

export async function moveTaskStatus(supabase: SupabaseClient, id: string, status: TaskStatus) {
  return updateTask(supabase, id, { status });
}

export async function archiveTask(supabase: SupabaseClient, id: string, archived = true) {
  return updateTask(supabase, id, { is_archived: archived, archived_at: archived ? new Date().toISOString() : null });
}

// Soft delete: moves the task to the trash (Configurações... err, /trash page)
// instead of removing it, so it can be restored. Permanent removal is a
// separate, explicit action.
export async function deleteTask(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from("tasks").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function restoreTask(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from("tasks").update({ deleted_at: null }).eq("id", id);
  if (error) throw error;
}

export async function permanentlyDeleteTask(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw error;
}

export async function duplicateTask(
  supabase: SupabaseClient,
  task: TaskWithRelations,
  userId: string,
  defaultStatusKey: string
) {
  const newTask = await createTask(supabase, {
    title: `${task.title} (cópia)`,
    description: task.description || undefined,
    project_id: task.project_id,
    campaign_id: task.campaign_id,
    area_id: task.area_id,
    category_id: task.category_id,
    content_type: task.content_type,
    created_by: userId,
    status: defaultStatusKey,
    priority: task.priority,
    due_date: task.due_date,
    tagIds: task.tags?.map((t) => t.id),
    assigneeIds: task.assignees?.map((a) => a.id),
    checklistItems: task.checklists?.map((c) => c.title),
  });
  return newTask;
}

export async function setTaskTags(supabase: SupabaseClient, taskId: string, tagIds: string[]) {
  await supabase.from("task_tags").delete().eq("task_id", taskId);
  if (tagIds.length) {
    await supabase.from("task_tags").insert(tagIds.map((tag_id) => ({ task_id: taskId, tag_id })));
  }
}

export async function setTaskAssignees(supabase: SupabaseClient, taskId: string, userIds: string[]) {
  // Diff against the current set instead of delete-all + insert-all, which
  // fired an "unassigned" + "assigned" activity log entry for every single
  // assignee (even ones that didn't actually change) on every edit.
  const { data: current } = await supabase.from("task_assignees").select("user_id").eq("task_id", taskId);
  const currentIds = new Set((current || []).map((r) => r.user_id));
  const nextIds = new Set(userIds);

  const toRemove = [...currentIds].filter((id) => !nextIds.has(id));
  const toAdd = [...nextIds].filter((id) => !currentIds.has(id));

  if (toRemove.length) {
    await supabase.from("task_assignees").delete().eq("task_id", taskId).in("user_id", toRemove);
  }
  if (toAdd.length) {
    await supabase.from("task_assignees").insert(toAdd.map((user_id) => ({ task_id: taskId, user_id })));
  }
}

// ------------------------- Checklist -------------------------
export async function addChecklistItem(supabase: SupabaseClient, taskId: string, title: string, sortOrder: number) {
  const { data, error } = await supabase
    .from("task_checklists")
    .insert({ task_id: taskId, title, sort_order: sortOrder })
    .select()
    .single();
  if (error) throw error;
  return data as TaskChecklistItem;
}

export async function toggleChecklistItem(supabase: SupabaseClient, id: string, completed: boolean) {
  const { data, error } = await supabase.from("task_checklists").update({ completed }).eq("id", id).select().single();
  if (error) throw error;
  return data as TaskChecklistItem;
}

export async function deleteChecklistItem(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from("task_checklists").delete().eq("id", id);
  if (error) throw error;
}

// ------------------------- Comments -------------------------
export async function listComments(supabase: SupabaseClient, taskId: string) {
  const { data, error } = await supabase
    .from("task_comments")
    .select("*, author:profiles(id, full_name, avatar_url)")
    .eq("task_id", taskId)
    .order("created_at");
  if (error) throw error;
  return data as TaskComment[];
}

export async function addComment(supabase: SupabaseClient, taskId: string, userId: string, content: string) {
  const { data, error } = await supabase
    .from("task_comments")
    .insert({ task_id: taskId, user_id: userId, content })
    .select("*, author:profiles(id, full_name, avatar_url)")
    .single();
  if (error) throw error;
  return data as TaskComment;
}

// ------------------------- Attachments -------------------------
export async function listAttachments(supabase: SupabaseClient, taskId: string) {
  const { data, error } = await supabase
    .from("task_attachments")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at");
  if (error) throw error;
  return data as TaskAttachment[];
}

export async function uploadAttachment(supabase: SupabaseClient, taskId: string, userId: string, file: File) {
  const path = `${taskId}/${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabase.storage.from("task-attachments").upload(path, file);
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from("task_attachments")
    .insert({
      task_id: taskId,
      user_id: userId,
      file_name: file.name,
      file_path: path,
      file_type: file.type,
      file_size: file.size,
    })
    .select()
    .single();
  if (error) throw error;
  return data as TaskAttachment;
}

export async function getAttachmentUrl(supabase: SupabaseClient, path: string) {
  const { data, error } = await supabase.storage.from("task-attachments").createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteAttachment(supabase: SupabaseClient, id: string, path: string) {
  await supabase.storage.from("task-attachments").remove([path]);
  const { error } = await supabase.from("task_attachments").delete().eq("id", id);
  if (error) throw error;
}

// ------------------------- Activity -------------------------
export async function listTaskActivity(supabase: SupabaseClient, taskId: string) {
  const { data, error } = await supabase
    .from("activity_logs")
    .select("*, user:profiles(id, full_name, avatar_url)")
    .eq("entity_type", "task")
    .eq("entity_id", taskId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}
