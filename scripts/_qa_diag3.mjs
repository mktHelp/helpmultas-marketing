import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
config({ path: ".env.local" });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const { data: statuses } = await supabase.from("task_statuses").select("*");
const doneKeys = new Set(statuses.filter(s => s.is_done).map(s => s.key));
console.log("done keys:", [...doneKeys]);

const { data: tasks } = await supabase.from("tasks").select("id, title, status, completed_at, created_at").is("deleted_at", null);
const brokenOnes = tasks.filter(t => doneKeys.has(t.status) && !t.completed_at);
console.log("tasks marked done but missing completed_at:", brokenOnes.length);
console.log(brokenOnes);
