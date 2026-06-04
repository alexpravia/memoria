-- Phase E — AI-orchestrated morning briefings.
--
-- A `briefings` row stores ONE day's slide deck for ONE user. The
-- co-user generates and approves the briefing (typically the night
-- before); the user reads it the next morning.
--
-- Idempotent: safe to re-run.

create table if not exists briefings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade not null,
  briefing_date date not null,
  slides jsonb not null,
  status text default 'draft' check (status in ('draft','approved','delivered','failed')),
  generated_at timestamptz default now(),
  approved_by uuid references co_users(id),
  approved_at timestamptz,
  delivered_at timestamptz,
  generation_error text,
  unique (user_id, briefing_date)
);

create index if not exists briefings_user_date_idx on briefings(user_id, briefing_date desc);

alter table briefings enable row level security;

drop policy if exists "co_user_manages_briefings" on briefings;
create policy "co_user_manages_briefings" on briefings
  for all using (
    exists (select 1 from co_users where co_users.user_id = briefings.user_id and co_users.auth_id = auth.uid())
  );

drop policy if exists "user_reads_own_briefings" on briefings;
create policy "user_reads_own_briefings" on briefings
  for select using (
    exists (select 1 from users where users.id = briefings.user_id and users.auth_id = auth.uid())
  );
