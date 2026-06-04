-- Memoria — document uploads + the "Write About Them" narrative.
-- Idempotent: safe to re-run.
--
-- Two new RAG sources, both CHUNKED (unlike the four core tables, which embed a
-- single vector on the row). A document or a narrative is one logical source
-- that splits into many embedded chunks, so each gets a parent table + a
-- *_chunks table. Both new kinds ('documents', 'narrative') are folded into the
-- match_memories and match_memories_hybrid RPCs and added to their default kind
-- lists, so Memo uses them automatically.
--
-- "narrative" is the co-user's freeform stream-of-consciousness about the
-- patient — the same role a context .md file plays for an LLM. It carries the
-- emotional intelligence the structured tables can't.

create extension if not exists vector;

-- ─── Immutable FTS builder for chunk text (hybrid lexical arm) ───────
-- Same rationale as add_hybrid_search.sql: a STORED generated column needs a
-- provably IMMUTABLE expression, and the 'english' regconfig coercion is only
-- STABLE on its own. Wrap it. Input is the raw chunk text.
create or replace function memoria_chunk_fts(p_text text)
returns tsvector language sql immutable as $$
  select to_tsvector('english', coalesce(p_text, ''));
$$;

-- ─── Documents ──────────────────────────────────────────────────────
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade not null,
  file_url text not null,
  file_name text,
  file_type text,                       -- mime type or extension hint
  byte_size bigint,
  summary text,                         -- short AI summary, shown in the co-user list
  processing_status text default 'pending'
    check (processing_status in ('pending','processing','processed','failed','hidden')),
  error text,                           -- failure detail when status='failed'
  created_at timestamptz default now(),
  processed_at timestamptz
);
create index if not exists documents_user_idx on documents (user_id);

create table if not exists document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references documents(id) on delete cascade not null,
  user_id uuid references users(id) on delete cascade not null,
  chunk_index int not null,
  text text not null,
  embedding vector(1536),
  fts tsvector generated always as (memoria_chunk_fts(text)) stored,
  created_at timestamptz default now()
);
create index if not exists document_chunks_doc_idx  on document_chunks (document_id);
create index if not exists document_chunks_user_idx on document_chunks (user_id);
create index if not exists document_chunks_fts_idx  on document_chunks using gin (fts);
-- HNSW (not IVFFlat) for the chunk tables: they grow incrementally and stay
-- small per-user, where IVFFlat's fixed lists hurt recall (rows hide in
-- unprobed lists). HNSW has no such failure mode and needs no rebuild as the
-- table grows. Mixing index types per-table is fine — each serves its own scan.
create index if not exists document_chunks_embedding_idx
  on document_chunks using hnsw (embedding vector_cosine_ops);

-- ─── Narrative ("Write About Them") ─────────────────────────────────
-- One narrative per user (unique), fully editable. Re-saving re-chunks and
-- re-embeds (the Edge Function deletes old chunks first).
create table if not exists user_narratives (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade not null unique,
  raw_text text not null default '',
  updated_at timestamptz default now(),
  created_at timestamptz default now()
);

create table if not exists narrative_chunks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade not null,
  chunk_index int not null,
  text text not null,
  embedding vector(1536),
  fts tsvector generated always as (memoria_chunk_fts(text)) stored,
  created_at timestamptz default now()
);
create index if not exists narrative_chunks_user_idx on narrative_chunks (user_id);
create index if not exists narrative_chunks_fts_idx  on narrative_chunks using gin (fts);
create index if not exists narrative_chunks_embedding_idx
  on narrative_chunks using hnsw (embedding vector_cosine_ops);

-- ─── RLS ────────────────────────────────────────────────────────────
-- Mirror the established co-user pattern (fix_rls_policies.sql): a co-user can
-- manage rows for their linked patient; a patient can manage their own. The
-- processing Edge Functions use the service role and bypass RLS entirely —
-- these policies govern client (kiosk/mobile) reads + the co-user's edits.
alter table documents       enable row level security;
alter table document_chunks enable row level security;
alter table user_narratives enable row level security;
alter table narrative_chunks enable row level security;

-- documents
drop policy if exists "couser_self_all_documents" on documents;
create policy "couser_self_all_documents" on documents
  for all
  using (
    user_id in (select user_id from co_users where auth_id = auth.uid())
    or user_id = auth.uid()
  )
  with check (
    user_id in (select user_id from co_users where auth_id = auth.uid())
    or user_id = auth.uid()
  );

-- document_chunks (scoped through user_id, same rule)
drop policy if exists "couser_self_all_document_chunks" on document_chunks;
create policy "couser_self_all_document_chunks" on document_chunks
  for all
  using (
    user_id in (select user_id from co_users where auth_id = auth.uid())
    or user_id = auth.uid()
  )
  with check (
    user_id in (select user_id from co_users where auth_id = auth.uid())
    or user_id = auth.uid()
  );

-- user_narratives
drop policy if exists "couser_self_all_narratives" on user_narratives;
create policy "couser_self_all_narratives" on user_narratives
  for all
  using (
    user_id in (select user_id from co_users where auth_id = auth.uid())
    or user_id = auth.uid()
  )
  with check (
    user_id in (select user_id from co_users where auth_id = auth.uid())
    or user_id = auth.uid()
  );

-- narrative_chunks
drop policy if exists "couser_self_all_narrative_chunks" on narrative_chunks;
create policy "couser_self_all_narrative_chunks" on narrative_chunks
  for all
  using (
    user_id in (select user_id from co_users where auth_id = auth.uid())
    or user_id = auth.uid()
  )
  with check (
    user_id in (select user_id from co_users where auth_id = auth.uid())
    or user_id = auth.uid()
  );

-- ════════════════════════════════════════════════════════════════════
-- Extend the retrieval RPCs with the two new chunked kinds.
-- Both keep their existing signatures (so all callers keep working) and only
-- gain two UNION arms + the new kinds in their default p_kinds list.
-- ════════════════════════════════════════════════════════════════════

-- ─── match_memories (dense) ─────────────────────────────────────────
create or replace function match_memories(
  p_user_id uuid,
  p_query_embedding vector(1536),
  p_match_count int default 10,
  p_kinds text[] default array['media','life_facts','people','events','documents','narrative'],
  p_min_similarity float default 0.0
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
  select * from (
    -- media
    select 'media'::text as kind, m.id as id,
           coalesce(m.description, '')::text as text_snippet,
           1 - (m.embedding <=> p_query_embedding) as similarity,
           jsonb_build_object('file_url', m.file_url, 'taken_at', m.taken_at, 'ai_tags', m.ai_tags) as metadata
    from media m
    where m.user_id = p_user_id
      and m.embedding is not null
      and m.verification_status = 'verified'
      and 'media' = any(p_kinds)
    union all
    -- life_facts
    select 'life_facts'::text, lf.id,
           lf.fact::text,
           1 - (lf.embedding <=> p_query_embedding),
           jsonb_build_object('category', lf.category)
    from life_facts lf
    where lf.user_id = p_user_id
      and lf.embedding is not null
      and 'life_facts' = any(p_kinds)
    union all
    -- people
    select 'people'::text, p.id,
           (p.full_name || ' (' || p.relationship || ')')::text,
           1 - (p.embedding <=> p_query_embedding),
           jsonb_build_object('relationship', p.relationship, 'photo_url', p.photo_url, 'key_facts', p.key_facts)
    from people p
    where p.user_id = p_user_id
      and p.embedding is not null
      and 'people' = any(p_kinds)
    union all
    -- events
    select 'events'::text, e.id,
           (e.title || coalesce(' — ' || e.description, ''))::text,
           1 - (e.embedding <=> p_query_embedding),
           jsonb_build_object('event_date', e.event_date, 'event_type', e.event_type)
    from events e
    where e.user_id = p_user_id
      and e.embedding is not null
      and 'events' = any(p_kinds)
    union all
    -- documents (chunked)
    select 'documents'::text, dc.id,
           dc.text::text,
           1 - (dc.embedding <=> p_query_embedding),
           jsonb_build_object('document_id', dc.document_id, 'file_name', d.file_name, 'chunk_index', dc.chunk_index)
    from document_chunks dc
    join documents d on d.id = dc.document_id
    where dc.user_id = p_user_id
      and dc.embedding is not null
      and d.processing_status = 'processed'
      and 'documents' = any(p_kinds)
    union all
    -- narrative (chunked)
    select 'narrative'::text, nc.id,
           nc.text::text,
           1 - (nc.embedding <=> p_query_embedding),
           jsonb_build_object('chunk_index', nc.chunk_index)
    from narrative_chunks nc
    where nc.user_id = p_user_id
      and nc.embedding is not null
      and 'narrative' = any(p_kinds)
  ) results
  where results.similarity >= p_min_similarity
  order by results.similarity desc
  limit p_match_count;
$$;

-- ─── match_memories_hybrid (dense + lexical RRF) ────────────────────
create or replace function match_memories_hybrid(
  p_user_id uuid,
  p_query_embedding vector(1536),
  p_query_text text,
  p_match_count int default 10,
  p_kinds text[] default array['media','life_facts','people','events','documents','narrative'],
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
      union all
      select 'documents'::text, dc.id, dc.text::text,
             1 - (dc.embedding <=> p_query_embedding),
             jsonb_build_object('document_id', dc.document_id, 'file_name', d.file_name, 'chunk_index', dc.chunk_index)
      from document_chunks dc
      join documents d on d.id = dc.document_id
      where dc.user_id = p_user_id and dc.embedding is not null
        and d.processing_status = 'processed' and 'documents' = any(p_kinds)
        and (1 - (dc.embedding <=> p_query_embedding)) >= p_min_similarity
      union all
      select 'narrative'::text, nc.id, nc.text::text,
             1 - (nc.embedding <=> p_query_embedding),
             jsonb_build_object('chunk_index', nc.chunk_index)
      from narrative_chunks nc
      where nc.user_id = p_user_id and nc.embedding is not null
        and 'narrative' = any(p_kinds)
        and (1 - (nc.embedding <=> p_query_embedding)) >= p_min_similarity
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
      union all
      select 'documents'::text, dc.id, dc.text::text,
             ts_rank(dc.fts, websearch_to_tsquery('english', p_query_text)),
             jsonb_build_object('document_id', dc.document_id, 'file_name', d.file_name, 'chunk_index', dc.chunk_index)
      from document_chunks dc
      join documents d on d.id = dc.document_id
      where dc.user_id = p_user_id and d.processing_status = 'processed'
        and 'documents' = any(p_kinds)
        and dc.fts @@ websearch_to_tsquery('english', p_query_text)
      union all
      select 'narrative'::text, nc.id, nc.text::text,
             ts_rank(nc.fts, websearch_to_tsquery('english', p_query_text)),
             jsonb_build_object('chunk_index', nc.chunk_index)
      from narrative_chunks nc
      where nc.user_id = p_user_id and 'narrative' = any(p_kinds)
        and nc.fts @@ websearch_to_tsquery('english', p_query_text)
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
  order by
    coalesce(1.0 / (p_rrf_k + d.rnk), 0) + coalesce(1.0 / (p_rrf_k + x.rnk), 0) desc
  limit p_match_count;
$$;
