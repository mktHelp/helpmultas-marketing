-- 0032_fix_assistant_conversation_rls_recursion.sql
-- 0031 gave assistant_conversations and assistant_conversation_members
-- policies that each query the other table (owner check <-> membership
-- check), which Postgres reports as "infinite recursion detected in
-- policy for relation assistant_conversations". Break the cycle with a
-- SECURITY DEFINER helper, owned by a bypassrls role, that reads
-- assistant_conversation_members without re-triggering its own RLS —
-- only assistant_conversations' policies go through it, so
-- assistant_conversation_members' policy can keep querying
-- assistant_conversations normally without looping back.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'assistant_rls_helper') then
    create role assistant_rls_helper nologin bypassrls;
  end if;
end
$$;

grant assistant_rls_helper to postgres;
grant usage, create on schema public to assistant_rls_helper;

create or replace function public.user_is_conversation_member(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from assistant_conversation_members m
    where m.conversation_id = p_conversation_id and m.user_id = auth.uid()
  );
$$;

alter function public.user_is_conversation_member(uuid) owner to assistant_rls_helper;
revoke all on function public.user_is_conversation_member(uuid) from public;
grant execute on function public.user_is_conversation_member(uuid) to authenticated;

drop policy "assistant_conversations_select_own" on assistant_conversations;
create policy "assistant_conversations_select_own" on assistant_conversations for select using (
  user_id = auth.uid() or public.user_is_conversation_member(id)
);

drop policy "assistant_conversations_update_own" on assistant_conversations;
create policy "assistant_conversations_update_own" on assistant_conversations for update using (
  user_id = auth.uid() or public.user_is_conversation_member(id)
);
