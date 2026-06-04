-- Memoria — mark a person as a "primary contact".
-- Idempotent: safe to re-run.
--
-- Why: a small number of people (a spouse, a primary caregiver child) matter
-- more than the rest. Primary contacts are always surfaced first in briefings,
-- always included in the emergency card context, and prioritized by the
-- proactive nudge engine ("Your daughter Sarah is coming at 6"). The app layer
-- caps this at 2-3 per patient — the column itself imposes no limit.
--
-- A boolean column with a constant default is a metadata-only change in
-- Postgres 11+ (no table rewrite), so this does not touch the people IVFFlat
-- vector index or the generated fts column.

alter table people add column if not exists is_primary_contact boolean default false;

-- Partial index: we frequently ask "who are this user's primary contacts?"
create index if not exists people_primary_contact_idx
  on people (user_id) where is_primary_contact = true;
