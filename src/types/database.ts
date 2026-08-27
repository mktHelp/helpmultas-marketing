// Hand-authored types matching supabase/migrations/*.sql.
// Once the project is linked, replace with:
//   npx supabase gen types typescript --project-id <id> > src/types/database.ts

export type UserRole = "master" | "gestor" | "membro";
export type TaskPriority = "baixa" | "media" | "alta" | "urgente";
// Task stages ("etapas") are user-managed data (see task_statuses table /
// Settings > Etapas), not a fixed set - any string key defined there is valid.
export type TaskStatus = string;
export type ProjectStatus = "planejamento" | "em_andamento" | "pausado" | "concluido" | "cancelado";
export type CampaignStatus = "planejamento" | "ativa" | "pausada" | "encerrada";
export type ContentType =
  | "reels"
  | "stories"
  | "feed"
  | "carrossel"
  | "youtube"
  | "blog"
  | "email"
  | "whatsapp"
  | "anuncio"
  | "landing_page";
export type RecurrenceFreq = "diaria" | "semanal" | "quinzenal" | "mensal";
export type NotificationType =
  | "task_assigned"
  | "due_soon"
  | "overdue"
  | "mentioned"
  | "content_approved"
  | "content_rejected"
  | "comment_added"
  | "status_changed";

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  role: UserRole;
  department: string | null;
  job_title: string | null;
  phone: string | null;
  preferences: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Area {
  id: string;
  name: string;
  description: string | null;
  color: string;
  sort_order: number;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  area_id: string | null;
  created_at: string;
}

export interface TaskStatusRow {
  id: string;
  key: string;
  label: string;
  color: string;
  sort_order: number;
  is_active: boolean;
  is_default: boolean;
  is_done: boolean;
  is_cancelled: boolean;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  owner_id: string | null;
  status: ProjectStatus;
  priority: TaskPriority;
  start_date: string | null;
  end_date: string | null;
  progress: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface Campaign {
  id: string;
  name: string;
  description: string | null;
  objective: string | null;
  owner_id: string | null;
  budget: number | null;
  status: CampaignStatus;
  start_date: string | null;
  end_date: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface TaskTemplate {
  id: string;
  name: string;
  description: string | null;
  area_id: string | null;
  content_type: ContentType | null;
  checklist_items: { title: string; sort_order: number }[];
  created_by: string | null;
  created_at: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  project_id: string | null;
  campaign_id: string | null;
  area_id: string | null;
  category_id: string | null;
  content_type: ContentType | null;
  created_by: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  start_date: string | null;
  due_date: string | null;
  completed_at: string | null;
  estimated_minutes: number | null;
  actual_minutes: number | null;
  briefing: string | null;
  script_notes: string | null;
  caption: string | null;
  cta: string | null;
  publish_at: string | null;
  is_recurring: boolean;
  recurrence_freq: RecurrenceFreq | null;
  recurrence_source_id: string | null;
  template_id: string | null;
  is_archived: boolean;
  archived_at: string | null;
  archived_by: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskWithRelations extends Task {
  assignees?: Pick<Profile, "id" | "full_name" | "avatar_url">[];
  creator?: Pick<Profile, "id" | "full_name" | "avatar_url"> | null;
  archiver?: Pick<Profile, "id" | "full_name" | "avatar_url"> | null;
  deleter?: Pick<Profile, "id" | "full_name" | "avatar_url"> | null;
  project?: Pick<Project, "id" | "name"> | null;
  campaign?: Pick<Campaign, "id" | "name"> | null;
  area?: Pick<Area, "id" | "name" | "color"> | null;
  category?: Pick<Category, "id" | "name"> | null;
  tags?: Tag[];
  checklists?: TaskChecklistItem[];
  comments_count?: number;
  attachments_count?: number;
}

export interface TaskChecklistItem {
  id: string;
  task_id: string;
  title: string;
  completed: boolean;
  sort_order: number;
  created_at: string;
}

export interface TaskComment {
  id: string;
  task_id: string;
  user_id: string | null;
  content: string;
  created_at: string;
  updated_at: string;
  author?: Pick<Profile, "id" | "full_name" | "avatar_url"> | null;
}

export interface TaskAttachment {
  id: string;
  task_id: string;
  user_id: string | null;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  task_id: string | null;
  read_at: string | null;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  user?: Pick<Profile, "id" | "full_name" | "avatar_url"> | null;
}

// Minimal Database generic so createBrowserClient/createServerClient type-check.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;
