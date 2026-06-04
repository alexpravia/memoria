-- Memoria — hybrid (dense + lexical) retrieval via Reciprocal Rank Fusion.
-- Phase 2B. Idempotent: safe to re-run.
--
-- Why: dense vector search is great for meaning ("happy memories") but weak at
-- exact tokens — names ("Maria"), dates ("Christmas 2023"), tags. BM25-style
-- full-text search nails those. We run both and fuse the rankings with RRF
-- (parameter-free, robust), so each arm covers the other's blind spot. All in
-- Postgres — no external search service.
--
-- The dense arm honors an optional p_min_similarity floor (Phase 2A) so weak
-- dense noise is cut; the lexical arm is exact-match by nature so it is NOT
-- floored — a keyword hit always counts.

-- IMPORTANT (run this first): adding a STORED generated column rewrites the
-- table, which rebuilds ALL of its indexes — including the 1536-dim IVFFlat
-- vector index on media. That rebuild needs ~61MB, but Supabase defaults
-- maintenance_work_mem to 32MB and pgvector aborts with SQLSTATE 54000. Raising
-- it for this session fixes it. maintenance_work_mem is a USERSET GUC (allowed
-- from the SQL editor) and reverts when the session disconnects. Keep this as
-- the FIRST statement so it applies to the ALTERs below.
set maintenance_work_mem = '256MB';

-- ─── Immutable FTS builders ─────────────────────────────────────────
-- A STORED generated column requires a provably IMMUTABLE expression. Postgres
-- treats several pieces we need as merely STABLE — the text→regconfig coercion
-- of the 'english' literal, array_to_string (it may call element output funcs),
-- and jsonb→text — so a raw to_tsvector(...) expression is rejected with 42P17.
-- They are all genuinely deterministic, so we wrap each table's expression in a
-- SQL function declared IMMUTABLE; Postgres trusts that marking for the
-- generated column. Inputs are the RAW columns, so nothing stable leaks into
-- the generated expression itself.
create or replace function memoria_media_fts(p_description text, p_ai_tags jsonb)
returns tsvector language sql immutable as $$
  select to_tsvector('english',
    coalesce(p_description, '') || ' ' || coalesce(p_ai_tags::text, ''));
$$;

create or replace function memoria_life_facts_fts(p_fact text)
returns tsvector language sql immutable as $$
  select to_tsvector('english', coalesce(p_fact, ''));
$$;

create or replace function memoria_people_fts(
  p_full_name text, p_relationship text, p_key_facts text[], p_emotional_notes text
) returns tsvector language sql immutable as $$
  select to_tsvector('english',
    coalesce(p_full_name, '') || ' ' ||
    coalesce(p_relationship, '') || ' ' ||
    coalesce(array_to_string(p_key_facts, ' '), '') || ' ' ||
    coalesce(p_emotional_notes, ''));
$$;

create or replace function memoria_events_fts(p_title text, p_description text)
returns tsvector language sql immutable as $$
  select to_tsvector('english',
    coalesce(p_title, '') || ' ' || coalesce(p_description, ''));
$$;

-- ─── Generated tsvector columns ─────────────────────────────────────
-- media folds in ai_tags (jsonb → text → tag words get tokenized).
alter table media add column if not exists fts tsvector
  generated always as (memoria_media_fts(description, ai_tags)) stored;

alter table life_facts add column if not exists fts tsvector
  generated always as (memoria_life_facts_fts(fact)) stored;

-- people folds in name, relationship, key_facts (text[]) and emotional_notes.
alter table people add column if not exists fts tsvector
  generated always as (
    memoria_people_fts(full_name, relationship, key_facts, emotional_notes)
  ) stored;

alter table events add column if not exists fts tsvector
  generated always as (memoria_events_fts(title, description)) stored;

create index if not exists media_fts_idx      on media      using gin(fts);
create index if not exists life_facts_fts_idx on life_facts using gin(fts);
create index if not exists people_fts_idx     on people     using gin(fts);
create index if not exists events_fts_idx     on events     using gin(fts);

-- ─── Hybrid search RPC ──────────────────────────────────────────────
create or replace function match_memories_hybrid(
  p_user_id uuid,
  p_query_embedding vector(1536),
  p_query_text text,
  p_match_count int default 10,
  p_kinds text[] default array['media','life_facts','people','events'],
  p_min_similarity float default 0.0,
  p_rrf_k int default 60,
  p_pool int default 20
)
returns table (
  kind text,
  id uuid,
  text_snippet text,
  similarity float,
  metadata jsonb
)
language sql stable
as $$
  with dense as (
    select d.kind, d.id, d.text_snippet, d.similarity, d.metadata,
           row_number() over (order by d.similarity desc) as rnk
    from (
      select 'media'::text as kind, m.id as id,
             coalesce(m.description, '')::text as text_snippet,
             1 - (m.embedding <=> p_query_embedding) as similarity,
             jsonb_build_object('file_url', m.file_url, 'taken_at', m.taken_at, 'ai_tags', m.ai_tags) as metadata
      from media m
      where m.user_id = p_user_id and m.embedding is not null
        and m.verification_status = 'verified' and 'media' = any(p_kinds)
        and (1 - (m.embedding <=> p_query_embedding)) >= p_min_similarity
      union all
      select 'life_facts'::text, lf.id, lf.fact::text,
             1 - (lf.embedding <=> p_query_embedding),
             jsonb_build_object('category', lf.category)
      from life_facts lf
      where lf.user_id = p_user_id and lf.embedding is not null
        and 'life_facts' = any(p_kinds)
        and (1 - (lf.embedding <=> p_query_embedding)) >= p_min_similarity
      union all
      select 'people'::text, p.id,
             (p.full_name || ' (' || p.relationship || ')')::text,
             1 - (p.embedding <=> p_query_embedding),
             jsonb_build_object('relationship', p.relationship, 'photo_url', p.photo_url, 'key_facts', p.key_facts)
      from people p
      where p.user_id = p_user_id and p.embedding is not null
        and 'people' = any(p_kinds)
        and (1 - (p.embedding <=> p_query_embedding)) >= p_min_similarity
      union all
      select 'events'::text, e.id,
             (e.title || coalesce(' — ' || e.description, ''))::text,
             1 - (e.embedding <=> p_query_embedding),
             jsonb_build_object('event_date', e.event_date, 'event_type', e.event_type)
      from events e
      where e.user_id = p_user_id and e.embedding is not null
        and 'events' = any(p_kinds)
        and (1 - (e.embedding <=> p_query_embedding)) >= p_min_similarity
      order by similarity desc
      limit p_pool
    ) d
  ),
  lexical as (
    select l.kind, l.id, l.text_snippet, l.metadata,
           row_number() over (order by l.lex_rank desc) as rnk
    from (
      select 'media'::text as kind, m.id as id,
             coalesce(m.description, '')::text as text_snippet,
             ts_rank(m.fts, websearch_to_tsquery('english', p_query_text)) as lex_rank,
             jsonb_build_object('file_url', m.file_url, 'taken_at', m.taken_at, 'ai_tags', m.ai_tags) as metadata
      from media m
      where m.user_id = p_user_id
        and m.verification_status = 'verified' and 'media' = any(p_kinds)
        and m.fts @@ websearch_to_tsquery('english', p_query_text)
      union all
      select 'life_facts'::text, lf.id, lf.fact::text,
             ts_rank(lf.fts, websearch_to_tsquery('english', p_query_text)),
             jsonb_build_object('category', lf.category)
      from life_facts lf
      where lf.user_id = p_user_id and 'life_facts' = any(p_kinds)
        and lf.fts @@ websearch_to_tsquery('english', p_query_text)
      union all
      select 'people'::text, p.id,
             (p.full_name || ' (' || p.relationship || ')')::text,
             ts_rank(p.fts, websearch_to_tsquery('english', p_query_text)),
             jsonb_build_object('relationship', p.relationship, 'photo_url', p.photo_url, 'key_facts', p.key_facts)
      from people p
      where p.user_id = p_user_id and 'people' = any(p_kinds)
        and p.fts @@ websearch_to_tsquery('english', p_query_text)
      union all
      select 'events'::text, e.id,
             (e.title || coalesce(' — ' || e.description, ''))::text,
             ts_rank(e.fts, websearch_to_tsquery('english', p_query_text)),
             jsonb_build_object('event_date', e.event_date, 'event_type', e.event_type)
      from events e
      where e.user_id = p_user_id and 'events' = any(p_kinds)
        and e.fts @@ websearch_to_tsquery('english', p_query_text)
      order by lex_rank desc
      limit p_pool
    ) l
  )
  select
    coalesce(d.kind, x.kind) as kind,
    coalesce(d.id, x.id) as id,
    coalesce(d.text_snippet, x.text_snippet) as text_snippet,
    coalesce(d.similarity, 0)::float as similarity,
    coalesce(d.metadata, x.metadata) as metadata
  from dense d
  full outer join lexical x on d.kind = x.kind and d.id = x.id
  -- Reciprocal Rank Fusion: sum of 1/(k + rank) across the arms a row appears in.
  order by
    coalesce(1.0 / (p_rrf_k + d.rnk), 0) + coalesce(1.0 / (p_rrf_k + x.rnk), 0) desc
  limit p_match_count;
$$;
