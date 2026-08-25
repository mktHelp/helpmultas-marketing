import type { SupabaseClient } from "@supabase/supabase-js";
import type { Task, TaskWithRelations, TaskChecklistItem, TaskComment, TaskAttachment, TaskStatus, Tag } from "@/types/database";

const TASK_SELECT = `
  *,
  assignee:profiles!tasks_assigned_to_fkey(id, full_name, avatar_url),
  creator:profiles!tasks_created_by_fkey(id, full_name, avatar_url),
  project:projects(id, name),
  campaign:campaigns(id, name),
  area:areas(id, name, color),
  category:categories(id, name),
  task_tags(tags(id, name, color)),
  task_checklists(id, task_id, title, completed, sort_order, created_at)
`;

interface TaskRow extends Task {
  task_tags?: { tags: Tag }[];
  task_checklists?: TaskChecklistItem[];
}

function normalize(row: TaskRow): TaskWithRelations {
  return {
    ...row,
    tags: (row.task_tags || []).map((t) => t.tags).filter(Boolean),
    checklists: [...(row.task_checklists || [])].sort((a, b) => a.sort_order - b.sort_order),
  };
}

export interface TaskFilters {
  status?: TaskStatus[];
  assignedTo?: string;
  areaId?: string;
  projectId?: string;
  campaignId?: string;
  priority?: string[];
  search?: string;
  dueBefore?: string;
  dueAfter?: string;
  includeArchived?: boolean;
  onlyOverdue?: boolean;
}

export async function listTasks(supabase: SupabaseClient, filters: TaskFilters = {}) {
  let query = supabase.from("tasks").select(TASK_SELECT).order("due_date", { ascending: true, nullsFirst: false });

  if (!filters.includeArchived) query = query.eq("is_archived", false);
  if (filters.status?.length) query = query.in("status", filters.status);
  if (filters.assignedTo) query = query.eq("assigned_to", filters.assignedTo);
  if (filters.areaId) query = query.eq("area_id", filters.areaId);
  if (filters.projectId) query = query.eq("project_id", filters.projectId);
  if (filters.campaignId) query = query.eq("campaign_id", filters.campaignId);
  if (filters.priority?.length) query = query.in("priority", filters.priority);
  if (filters.search) query = query.ilike("title", `%${filters.search}%`);
  if (filters.dueBefore) query = query.lte("due_date", filters.dueBefore);
  if (filters.dueAfter) query = query.gte("due_date", filters.dueAfter);
  if (filters.onlyOverdue) {
    query = query.lt("due_date", new Date().toISOString()).is("completed_at", null);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(normalize);
}

export async function getTask(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase.from("tasks").select(TASK_SELECT).eq("id", id).single();
  if (error) throw error;
  return normalize(data);
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  project_id?: string | null;
  campaign_id?: string | null;
  area_id?: string | null;
  category_id?: string | null;
  content_type?: string | null;
  assigned_to?: string | null;
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
  checklistItems?: string[];
}

export async function createTask(supabase: SupabaseClient, input: CreateTaskInput) {
  const { tagIds, checklistItems, ...taskFields } = input;
  const { data, error } = await supabase.from("tasks").insert(taskFields).select().single();
  if (error) throw error;
  const task = data as Task;

  if (tagIds?.length) {
    await supabase.from("task_tags").insert(tagIds.map((tag_id) => ({ task_id: task.id, tag_id })));
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

export async function deleteTask(supabase: SupabaseClient, id: string) {
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
    assigned_to: task.assigned_to,
    created_by: userId,
    status: defaultStatusKey,
    priority: task.priority,
    due_date: task.due_date,
    tagIds: task.tags?.map((t) => t.id),
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
