import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
config({ path: ".env.local" });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
  email: "qa-drag-test@helpmultas.com",
  password: "QaDragTest@2026",
});
console.log("auth error:", authErr);
console.log("user:", authData?.user?.id);

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

console.log("--- tasks select (as authenticated) ---");
const { data: tasks, error: tasksErr } = await supabase.from("tasks").select(TASK_SELECT).is("deleted_at", null).eq("is_archived", false);
console.log("error:", JSON.stringify(tasksErr, null, 2));
console.log("count:", tasks?.length);

console.log("--- profiles select (as authenticated) ---");
const { data: profs, error: profErr } = await supabase.from("profiles").select("*").eq("id", authData?.user?.id).single();
console.log("error:", profErr);
console.log("profile:", profs);
