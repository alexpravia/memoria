-- Memoria — conversations + messages tables for the agentic assistant (Phase B).
-- Idempotent: safe to re-run.

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade not null,
  started_at timestamptz default now(),
  ended_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade not null,
  role text not null check (role in ('user','assistant','tool','system')),
  content text,
  tool_calls jsonb,
  tool_call_id text,
  tool_name text,
  created_at timestamptz default now()
);

create index if not exists messages_conversation_idx
  on messages(conversation_id, created_at);

-- ─── RLS ────────────────────────────────────────────────────────────
-- Mirrors the pattern in supabase/fix_rls_policies.sql: co-user can act
-- on behalf of their linked patient, and the patient can act on their
-- own rows. messages inherit access via their parent conversation.

alter table conversations enable row level security;
alter table messages       enable row level security;

drop policy if exists "co_user_manages_patient_conversations" on conversations;
create policy "co_user_manages_patient_conversations" on conversations
  for all using (
    exists (
      select 1 from co_users
      where co_users.user_id = conversations.user_id
        and co_users.auth_id = auth.uid()
    )
  );

drop policy if exists "user_manages_own_conversations" on conversations;
create policy "user_manages_own_conversations" on conversations
  for all using (
    exists (
      select 1 from users
      where users.id = conversations.user_id
        and users.auth_id = auth.uid()
    )
  );

drop policy if exists "messages_follow_conversation" on messages;
create policy "messages_follow_conversation" on messages
  for all using (
    exists (
      select 1 from conversations c
      where c.id = messages.conversation_id
        and (
          exists (
            select 1 from co_users
            where co_users.user_id = c.user_id
              and co_users.auth_id = auth.uid()
          )
          or exists (
            select 1 from users
            where users.id = c.user_id
              and users.auth_id = auth.uid()
          )
        )
    )
  );
