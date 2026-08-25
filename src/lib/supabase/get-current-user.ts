import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

/**
 * `supabase.auth.getUser()` makes a network round-trip to Supabase Auth on
 * every call (by design - it revalidates the JWT server-side instead of
 * trusting the cookie). Both the (app) layout and most pages need the
 * current user/profile, so without memoization every navigation pays for
 * that round-trip twice (once in the layout, once in the page) plus two
 * profile lookups. React's `cache()` dedupes calls with the same arguments
 * within a single request/render pass, so this now only runs once.
 */
export const getCurrentUserAndProfile = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null, profile: null };

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  return { user, profile: profile as Profile | null };
});
