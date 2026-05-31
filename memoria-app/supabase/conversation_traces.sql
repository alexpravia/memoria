-- Memoria — conversation_traces (Phase 2C). Idempotent: safe to re-run.
--
-- A lightweight audit trail of every tool call the assistant makes: which tool,
-- a summary of args and result, and how long it took. This is the substrate for
-- observability/debugging ("the patient asked X, Memo retrieved Y, said Z") and
-- the SRE-style incident discipline the LLM plan calls for. Written by the
-- ask-assistant Edge Function under the service-role key (bypasses RLS); the
-- policies below govern co-user/patient READ access for future dashboards.

create table if not exists conversation_traces (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade,
  user_id uuid references users(id) on delete cascade not null,
  tool_name text not null,
  args_summary text,
  result_summary text,
  duration_ms int,
  created_at timestamptz default now()
);

create index if not exists conversation_traces_conv_idx
  on conversation_traces(conversation_id, created_at);
create index if not exists conversation_traces_user_idx
  on conversation_traces(user_id, created_at desc);

alter table conversation_traces enable row level security;

-- Co-user: full control over their linked patient's traces.
drop policy if exists conversation_traces_couser_all on conversation_traces;
create policy conversation_traces_couser_all on conversation_traces
  for all
  using (
    exists (
      select 1 from co_users
      where co_users.user_id = conversation_traces.user_id
        and co_users.auth_id = auth.uid()
    )
  );

-- Patient: read-only access to their own traces.
drop policy if exists conversation_traces_user_select on conversation_traces;
create policy conversation_traces_user_select on conversation_traces
  for select
  using (
    exists (
      select 1 from users
      where users.id = conversation_traces.user_id
        and users.auth_id = auth.uid()
    )
  );
