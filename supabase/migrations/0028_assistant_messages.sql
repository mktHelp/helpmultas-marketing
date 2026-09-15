-- 0028_assistant_messages.sql
-- Per-user chat history for the Helpinho assistant (previously kept only in
-- n8n's in-memory buffer window, lost on refresh and shared across devices).

create table assistant_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index idx_assistant_messages_user on assistant_messages(user_id, created_at);

alter table assistant_messages enable row level security;

create policy "assistant_messages_select_own" on assistant_messages for select using (user_id = auth.uid());
create policy "assistant_messages_insert_own" on assistant_messages for insert with check (user_id = auth.uid());
create policy "assistant_messages_delete_own" on assistant_messages for delete using (user_id = auth.uid());
