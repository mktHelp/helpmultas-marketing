-- 0029_assistant_conversations.sql
-- Splits assistant chat history into separate conversations per user ("abas"
-- in the UI), so people can start a new thread or reopen an old one instead
-- of a single running history.

create table assistant_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null default 'Nova conversa',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_assistant_conversations_user on assistant_conversations(user_id, updated_at desc);

alter table assistant_conversations enable row level security;

create policy "assistant_conversations_select_own" on assistant_conversations for select using (user_id = auth.uid());
create policy "assistant_conversations_insert_own" on assistant_conversations for insert with check (user_id = auth.uid());
create policy "assistant_conversations_update_own" on assistant_conversations for update using (user_id = auth.uid());
create policy "assistant_conversations_delete_own" on assistant_conversations for delete using (user_id = auth.uid());

-- Backfill: give every user with existing messages a single conversation
-- holding their prior history, so nothing already saved is lost.
insert into assistant_conversations (id, user_id, title, created_at, updated_at)
select gen_random_uuid(), user_id, 'Conversas anteriores', min(created_at), max(created_at)
from assistant_messages
group by user_id;

alter table assistant_messages add column conversation_id uuid references assistant_conversations(id) on delete cascade;

update assistant_messages m
set conversation_id = c.id
from assistant_conversations c
where c.user_id = m.user_id and c.title = 'Conversas anteriores';

alter table assistant_messages alter column conversation_id set not null;

create index idx_assistant_messages_conversation on assistant_messages(conversation_id, created_at);

-- Bump the conversation's updated_at whenever a message is added, so the
-- conversation list can be ordered by recent activity.
create or replace function public.touch_assistant_conversation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update assistant_conversations set updated_at = now() where id = new.conversation_id;
  return new;
end;
$$;

revoke execute on function public.touch_assistant_conversation() from public, anon, authenticated;

create trigger trg_touch_assistant_conversation
after insert on assistant_messages
for each row execute function public.touch_assistant_conversation();
