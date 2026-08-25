-- 0007_security_hardening.sql
-- Addresses two warnings from the Supabase Database Linter.

-- 1) function_search_path_mutable: every other function created in this
-- project explicitly sets search_path; this one was missed.
alter function public.set_updated_at() set search_path = public;

-- 2) security_definer_function_executable: Postgres/PostgREST exposes every
-- function in the `public` schema as an RPC endpoint by default, so these
-- internal helper/trigger functions show up as directly callable even though
-- the app never calls them that way.
--
-- The five below only ever run as trigger bodies (declared `returns trigger`)
-- - Postgres fires trigger functions as part of the DML operation regardless
-- of the querying role's EXECUTE grant, so revoking EXECUTE here has no
-- effect on the triggers themselves, it only removes the direct-call RPC
-- surface.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.log_checklist_activity() from public, anon, authenticated;
revoke execute on function public.log_comment_activity() from public, anon, authenticated;
revoke execute on function public.log_task_activity() from public, anon, authenticated;
revoke execute on function public.set_task_completed_at() from public, anon, authenticated;

-- current_role()/is_admin()/is_manager_or_admin() are read internally by RLS
-- policies while evaluating a query as the `authenticated` role, so that
-- grant must stay - revoking it would break every policy that calls them.
-- Anonymous/public callers have no legitimate reason to invoke them directly.
revoke execute on function public.current_role() from public, anon;
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.is_manager_or_admin() from public, anon;
