import { redirect } from "next/navigation";
import { getCurrentUserAndProfile } from "@/lib/supabase/get-current-user";

export default async function RootPage() {
  const { user } = await getCurrentUserAndProfile();
  redirect(user ? "/dashboard" : "/login");
}
