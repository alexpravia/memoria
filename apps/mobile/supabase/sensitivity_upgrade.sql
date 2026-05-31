-- Memoria — Phase C: semantic sensitivity classification.
-- Adds intent rules to `sensitivity_filters` and a per-item decision
-- cache so the LLM classifier only runs when (item, rule_set) is new.
-- Idempotent: safe to re-run.

-- ─── Extensions ─────────────────────────────────────────────────────
create extension if not exists vector;

-- ─── sensitivity_filters: intent_text + intent_embedding ────────────
alter table sensitivity_filters
  add column if not exists intent_text text;

alter table sensitivity_filters
  add column if not exists intent_embedding vector(1536);

-- Allow filter_type='intent' alongside the existing values.
alter table sensitivity_filters
  drop constraint if exists sensitivity_filters_filter_type_check;
alter table sensitivity_filters
  add constraint sensitivity_filters_filter_type_check
  check (filter_type in ('person', 'topic', 'time_period', 'intent'));

-- Intent rules don't have a meaningful filter_value, so relax the NOT NULL.
alter table sensitivity_filters
  alter column filter_value drop not null;

-- ─── sensitivity_decisions: per-item classifier cache ───────────────
create table if not exists sensitivity_decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade not null,
  item_kind text not null check (item_kind in ('media', 'life_facts', 'people', 'events')),
  item_id uuid not null,
  rule_set_hash text not null,
  allow boolean not null,
  blocked_by_rule_id uuid references sensitivity_filters(id) on delete set null,
  reason text,
  decided_at timestamptz default now(),
  unique (user_id, item_kind, item_id, rule_set_hash)
);

create index if not exists sensitivity_decisions_lookup
  on sensitivity_decisions(user_id, item_kind, item_id);

create index if not exists sensitivity_decisions_rule_set
  on sensitivity_decisions(user_id, rule_set_hash);

-- ─── RLS: mirror the co-user pattern from fix_rls_policies.sql ──────
alter table sensitivity_decisions enable row level security;

drop policy if exists "co_users_select_sensitivity_decisions" on sensitivity_decisions;
create policy "co_users_select_sensitivity_decisions" on sensitivity_decisions
  for select
  using (
    user_id in (select user_id from co_users where auth_id = auth.uid())
    or user_id = auth.uid()
  );

drop policy if exists "co_users_insert_sensitivity_decisions" on sensitivity_decisions;
create policy "co_users_insert_sensitivity_decisions" on sensitivity_decisions
  for insert
  with check (
    user_id in (select user_id from co_users where auth_id = auth.uid())
    or user_id = auth.uid()
  );

drop policy if exists "co_users_update_sensitivity_decisions" on sensitivity_decisions;
create policy "co_users_update_sensitivity_decisions" on sensitivity_decisions
  for update
  using (
    user_id in (select user_id from co_users where auth_id = auth.uid())
    or user_id = auth.uid()
  )
  with check (
    user_id in (select user_id from co_users where auth_id = auth.uid())
    or user_id = auth.uid()
  );

drop policy if exists "co_users_delete_sensitivity_decisions" on sensitivity_decisions;
create policy "co_users_delete_sensitivity_decisions" on sensitivity_decisions
  for delete
  using (
    user_id in (select user_id from co_users where auth_id = auth.uid())
    or user_id = auth.uid()
  );
