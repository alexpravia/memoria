-- Memoria — preference_signals (Phase 2D). Idempotent: safe to re-run.
--
-- Implicit co-user feedback captured as training data for a future
-- Memoria-specific fine-tune. Every time a co-user pins/suppresses/deletes one
-- of Memo's memories, or approves / regenerates / prunes a briefing, that is a
-- preference signal about what is good vs. bad output. We log it now (cheap)
-- so the dataset exists later. Pure data collection — no UI, no user impact.
--
-- Written from the app under the co-user's anon/publishable key, so RLS must
-- permit the authenticated co-user to INSERT/READ their linked patient's rows.

create table if not exists preference_signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade not null,
  co_user_id uuid references co_users(id) on delete set null,
  signal_type text not null check (signal_type in (
    'memory_pinned',
    'memory_unpinned',
    'memory_suppressed',
    'memory_restored',
    'memory_deleted',
    'briefing_approved',
    'briefing_regenerated',
    'briefing_slide_deleted',
    'briefing_slide_edited'
  )),
  reference_id uuid,
  content text,
  previous_content text,
  metadata jsonb,
  created_at timestamptz default now()
);

create index if not exists preference_signals_user_idx
  on preference_signals(user_id, created_at desc);
create index if not exists preference_signals_type_idx
  on preference_signals(user_id, signal_type);

alter table preference_signals enable row level security;

-- Co-user: full access to their linked patient's signals (USING also governs
-- INSERT here since no separate WITH CHECK is given — matches the project's
-- conversations/assistant_memory FOR ALL convention).
drop policy if exists preference_signals_couser_all on preference_signals;
create policy preference_signals_couser_all on preference_signals
  for all
  using (
    exists (
      select 1 from co_users
      where co_users.user_id = preference_signals.user_id
        and co_users.auth_id = auth.uid()
    )
  );
