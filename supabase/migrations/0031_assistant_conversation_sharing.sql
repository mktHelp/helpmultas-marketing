-- 0031_assistant_conversation_sharing.sql
-- Lets a conversation's owner share it with other teammates, turning a
-- 1:1 chat with Helpinho into a small group thread. Sharing notifies the
-- added person the same way task assignment does.

alter type notification_type add value if not exists 'conversation_shared';

alter table notifications add column conversation_id uuid references assistant_conversations(id) on delete cascade;

create table assistant_conversation_members (
  conversation_id uuid not null references assistant_conversations(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  added_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index idx_assistant_conversation_members_user on assistant_conversation_members(user_id);

alter table assistant_conversation_members enable row level security;

-- Members can see their own membership rows; the owner can see everyone's
-- (so the UI can list who a conversation is shared with).
create policy "assistant_conversation_members_select" on assistant_conversation_members for select using (
  user_id = auth.uid()
  or exists (select 1 from assistant_conversations c where c.id = conversation_id and c.user_id = auth.uid())
);

-- Only the conversation's owner can add members.
create policy "assistant_conversation_members_insert" on assistant_conversation_members for insert with check (
  exists (select 1 from assistant_conversations c where c.id = conversation_id and c.user_id = auth.uid())
);

-- The owner can remove anyone; a member can remove themselves ("leave").
create policy "assistant_conversation_members_delete" on assistant_conversation_members for delete using (
  user_id = auth.uid()
  or exists (select 1 from assistant_conversations c where c.id = conversation_id and c.user_id = auth.uid())
);

-- Conversations: owner keeps full control, members can read/post but not
-- rename or delete the conversation itself (they can "leave" instead, via
-- the members table policy above).
drop policy "assistant_conversations_select_own" on assistant_conversations;
create policy "assistant_conversations_select_own" on assistant_conversations for select using (
  user_id = auth.uid()
  or exists (select 1 from assistant_conversation_members m where m.conversation_id = id and m.user_id = auth.uid())
);

drop policy "assistant_conversations_update_own" on assistant_conversations;
create policy "assistant_conversations_update_own" on assistant_conversations for update using (
  user_id = auth.uid()
  or exists (select 1 from assistant_conversation_members m where m.conversation_id = id and m.user_id = auth.uid())
);

-- Messages: visibility and posting follow conversation membership instead
-- of "who wrote it", so everyone in a shared conversation sees the whole
-- thread (previously each user only ever saw their own messages).
drop policy "assistant_messages_select_own" on assistant_messages;
create policy "assistant_messages_select_own" on assistant_messages for select using (
  exists (
    select 1 from assistant_conversations c
    where c.id = conversation_id
      and (
        c.user_id = auth.uid()
        or exists (select 1 from assistant_conversation_members m where m.conversation_id = c.id and m.user_id = auth.uid())
      )
  )
);

drop policy "assistant_messages_insert_own" on assistant_messages;
create policy "assistant_messages_insert_own" on assistant_messages for insert with check (
  user_id = auth.uid()
  and exists (
    select 1 from assistant_conversations c
    where c.id = conversation_id
      and (
        c.user_id = auth.uid()
        or exists (select 1 from assistant_conversation_members m where m.conversation_id = c.id and m.user_id = auth.uid())
      )
  )
);
