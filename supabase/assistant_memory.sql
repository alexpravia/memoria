-- Memoria — assistant_memory table for Phase D persistent memory.
-- Idempotent: safe to re-run.
--
-- This table stores observations the assistant has formed about the
-- user across conversations. Co-users review, pin, suppress, or delete
-- entries from the AI Memory screen. RLS mirrors the pattern in
-- supabase/conversations_messages.sql: co-user has full access for the
-- linked patient; the patient may read their own rows.

create table if not exists assistant_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade not null,
  kind text not null check (kind in (
    'observation',
    'preference',
    'recurring_question',
    'emotional_state',
    'factual_correction'
  )),
  content text not null,
  importance int not null default 3 check (importance between 1 and 5),
  source_message_id uuid references messages(id) on delete set null,
  source_conversation_id uuid references conversations(id) on delete set null,
  created_at timestamptz default now(),
  expires_at timestamptz,
  reviewed_by_couser boolean default false,
  status text default 'active' check (status in ('active', 'pinned', 'suppressed'))
);

create index if not exists assistant_memory_user_active_idx
  on assistant_memory(user_id, status, importance desc, created_at desc);

alter table assistant_memory enable row level security;

drop policy if exists "co_user_manages_memory" on assistant_memory;
create policy "co_user_manages_memory" on assistant_memory
  for all using (
    exists (
      select 1 from co_users
      where co_users.user_id = assistant_memory.user_id
        and co_users.auth_id = auth.uid()
    )
  );

drop policy if exists "user_reads_own_memory" on assistant_memory;
create policy "user_reads_own_memory" on assistant_memory
  for select using (
    exists (
      select 1 from users
      where users.id = assistant_memory.user_id
        and users.auth_id = auth.uid()
    )
  );
