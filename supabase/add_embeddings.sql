-- Memoria — add pgvector embeddings to the four core "memory" tables.
-- Idempotent: safe to re-run.

create extension if not exists vector;

-- ─── Embedding columns ──────────────────────────────────────────────
alter table media        add column if not exists embedding vector(1536);
alter table media        add column if not exists embedding_text text;
alter table media        add column if not exists embedding_updated_at timestamptz;

alter table life_facts   add column if not exists embedding vector(1536);
alter table life_facts   add column if not exists embedding_text text;
alter table life_facts   add column if not exists embedding_updated_at timestamptz;

alter table people       add column if not exists embedding vector(1536);
alter table people       add column if not exists embedding_text text;
alter table people       add column if not exists embedding_updated_at timestamptz;

alter table events       add column if not exists embedding vector(1536);
alter table events       add column if not exists embedding_text text;
alter table events       add column if not exists embedding_updated_at timestamptz;

-- ─── IVFFlat indexes (cosine distance) ──────────────────────────────
create index if not exists media_embedding_idx
  on media using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index if not exists life_facts_embedding_idx
  on life_facts using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index if not exists people_embedding_idx
  on people using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index if not exists events_embedding_idx
  on events using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- ─── Unified search RPC ─────────────────────────────────────────────
-- Returns rows with a `kind` discriminator so callers can route results
-- to the right UI / context bucket.
create or replace function match_memories(
  p_user_id uuid,
  p_query_embedding vector(1536),
  p_match_count int default 10,
  p_kinds text[] default array['media','life_facts','people','events']
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
  -- media
  select 'media'::text, m.id,
         coalesce(m.description, '')::text,
         1 - (m.embedding <=> p_query_embedding) as similarity,
         jsonb_build_object('file_url', m.file_url, 'taken_at', m.taken_at, 'ai_tags', m.ai_tags) as metadata
  from media m
  where m.user_id = p_user_id
    and m.embedding is not null
    and m.verification_status = 'verified'
    and 'media' = any(p_kinds)
  union all
  select 'life_facts'::text, lf.id,
         lf.fact::text,
         1 - (lf.embedding <=> p_query_embedding),
         jsonb_build_object('category', lf.category)
  from life_facts lf
  where lf.user_id = p_user_id
    and lf.embedding is not null
    and 'life_facts' = any(p_kinds)
  union all
  select 'people'::text, p.id,
         (p.full_name || ' (' || p.relationship || ')')::text,
         1 - (p.embedding <=> p_query_embedding),
         jsonb_build_object('relationship', p.relationship, 'photo_url', p.photo_url, 'key_facts', p.key_facts)
  from people p
  where p.user_id = p_user_id
    and p.embedding is not null
    and 'people' = any(p_kinds)
  union all
  select 'events'::text, e.id,
         (e.title || coalesce(' — ' || e.description, ''))::text,
         1 - (e.embedding <=> p_query_embedding),
         jsonb_build_object('event_date', e.event_date, 'event_type', e.event_type)
  from events e
  where e.user_id = p_user_id
    and e.embedding is not null
    and 'events' = any(p_kinds)
  order by similarity desc
  limit p_match_count;
$$;
