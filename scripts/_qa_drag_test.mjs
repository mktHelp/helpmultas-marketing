import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
config({ path: ".env.local" });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const email = "qa-drag-test@helpmultas.com";
const password = "QaDragTest@2026";

const { data: existing } = await supabase.auth.admin.listUsers();
const already = existing.users.find(u => u.email === email);
if (already) await supabase.auth.admin.deleteUser(already.id);

const { data, error } = await supabase.auth.admin.createUser({
  email, password, email_confirm: true,
  user_metadata: { full_name: "QA Drag Test", role: "master" }
});
if (error) throw error;

const { data: task, error: taskErr } = await supabase.from("tasks").insert({
  title: "QA - teste de arraste (pode ignorar)",
  created_by: data.user.id,
  status: "backlog",
  priority: "baixa",
}).select().single();
if (taskErr) throw taskErr;

console.log("user_id:", data.user.id);
console.log("task_id:", task.id);
