import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
config({ path: ".env.local" });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const TASK_SELECT = `
  *,
  creator:profiles!tasks_created_by_fkey(id, full_name, avatar_url),
  project:projects(id, name),
  campaign:campaigns(id, name),
  area:areas(id, name, color),
  category:categories(id, name),
  task_assignees(profiles(id, full_name, avatar_url)),
  task_tags(tags(id, name, color)),
  task_checklists(id, task_id, title, completed, sort_order, created_at)
`;

console.log("--- tasks select ---");
const { data: tasks, error: tasksErr } = await supabase.from("tasks").select(TASK_SELECT).is("deleted_at", null).eq("is_archived", false);
console.log("error:", tasksErr);
console.log("count:", tasks?.length);

console.log("--- areas select ---");
const { error: areasErr } = await supabase.from("areas").select("*").order("sort_order");
console.log("error:", areasErr);

console.log("--- profiles select ---");
const { error: profErr } = await supabase.from("profiles").select("*").eq("is_active", true).order("full_name");
console.log("error:", profErr);

console.log("--- task_statuses select ---");
const { error: statusErr } = await supabase.from("task_statuses").select("*").order("sort_order");
console.log("error:", statusErr);
