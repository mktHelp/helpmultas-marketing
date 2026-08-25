/**
 * Wipes demo/operational data so the system is clean to start real use.
 * Keeps: areas, categories, tags, task_templates (base configuration).
 * Deletes: tasks (and everything hanging off them via cascade), projects,
 * campaigns, activity_logs, and the 8 seed demo user accounts (auth + profile).
 * Never touches any other user account.
 *
 *   npm run clear-demo
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

const DEMO_EMAILS = [
  "ana.costa@helpmultas.com",
  "rafael.nogueira@helpmultas.com",
  "camila.duarte@helpmultas.com",
  "lucas.ferreira@helpmultas.com",
  "juliana.prado@helpmultas.com",
  "thiago.almeida@helpmultas.com",
  "beatriz.lima@helpmultas.com",
  "pedro.santos@helpmultas.com",
];

async function main() {
  console.log("Deleting tasks (cascades checklists, comments, attachments, tags, dependencies, notifications)...");
  const { error: tasksErr, count: tasksCount } = await supabase
    .from("tasks")
    .delete({ count: "exact" })
    .not("id", "is", null);
  if (tasksErr) throw tasksErr;
  console.log(`  - ${tasksCount ?? 0} tasks deleted`);

  console.log("Deleting projects...");
  const { error: projectsErr, count: projectsCount } = await supabase
    .from("projects")
    .delete({ count: "exact" })
    .not("id", "is", null);
  if (projectsErr) throw projectsErr;
  console.log(`  - ${projectsCount ?? 0} projects deleted`);

  console.log("Deleting campaigns...");
  const { error: campaignsErr, count: campaignsCount } = await supabase
    .from("campaigns")
    .delete({ count: "exact" })
    .not("id", "is", null);
  if (campaignsErr) throw campaignsErr;
  console.log(`  - ${campaignsCount ?? 0} campaigns deleted`);

  console.log("Deleting any leftover activity logs...");
  const { error: logsErr, count: logsCount } = await supabase
    .from("activity_logs")
    .delete({ count: "exact" })
    .not("id", "is", null);
  if (logsErr) throw logsErr;
  console.log(`  - ${logsCount ?? 0} activity log entries deleted`);

  console.log("Deleting any leftover notifications...");
  const { error: notifErr, count: notifCount } = await supabase
    .from("notifications")
    .delete({ count: "exact" })
    .not("id", "is", null);
  if (notifErr) throw notifErr;
  console.log(`  - ${notifCount ?? 0} notifications deleted`);

  console.log("\nDeleting demo user accounts...");
  const { data: existing } = await supabase.auth.admin.listUsers();
  for (const email of DEMO_EMAILS) {
    const user = existing.users.find((u) => u.email === email);
    if (!user) {
      console.log(`  - ${email} not found, skipping`);
      continue;
    }
    const { error } = await supabase.auth.admin.deleteUser(user.id);
    if (error) throw error;
    console.log(`  - Deleted ${email}`);
  }

  console.log("\nDone. Kept: areas, categories, tags, task_templates, and any non-demo user accounts.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
