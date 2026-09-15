-- 0034_fix_assistant_rls_helper_no_auth_call.sql
-- 0033 tried granting assistant_rls_helper access to schema auth so
-- user_is_conversation_member could call auth.uid() internally, but that
-- still failed in production ("permission denied for schema auth") —
-- Supabase manages that schema and the custom grant likely didn't stick.
-- Avoid the problem entirely: pass the user id in as a parameter (computed
-- by the caller, which already has legitimate access to auth.uid()) so the
-- security definer function never touches schema auth itself.

drop function if exists public.user_is_conversation_member(uuid) cascade;

create or replace function public.user_is_conversation_member(p_conversation_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from assistant_conversation_members m
    where m.conversation_id = p_conversation_id and m.user_id = p_user_id
  );
$$;

alter function public.user_is_conversation_member(uuid, uuid) owner to assistant_rls_helper;
revoke all on function public.user_is_conversation_member(uuid, uuid) from public;
grant execute on function public.user_is_conversation_member(uuid, uuid) to authenticated;

-- cascade above already dropped these two policies along with the old
-- function signature; recreate them against the new one.
create policy "assistant_conversations_select_own" on assistant_conversations for select using (
  user_id = auth.uid() or public.user_is_conversation_member(id, auth.uid())
);

create policy "assistant_conversations_update_own" on assistant_conversations for update using (
  user_id = auth.uid() or public.user_is_conversation_member(id, auth.uid())
);
