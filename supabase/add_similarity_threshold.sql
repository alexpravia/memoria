-- Memoria — add a minimum-similarity threshold to match_memories (Phase 2A).
--
-- Why: dense vector search always returns *something*. A sunset photo at 0.31
-- cosine similarity surfacing for "what is my name" is noise that confuses the
-- assistant. Callers that want precision now pass a floor (the agentic
-- search_memories tool passes 0.65); callers that want raw recall omit it.
--
-- Backward compatible: the new 5th parameter defaults to 0.0 (no filtering),
-- so existing 4-arg named calls — src/lib/embeddings.ts and the assistant
-- Edge Function — keep working unchanged until they opt in.
--
-- Idempotent: safe to re-run.

-- Adding a parameter changes the function signature. `create or replace` alone
-- would leave the old 4-arg overload in place, making 4-arg named calls
-- ambiguous ("function match_memories is not unique"). Drop it first.
drop function if exists match_memories(uuid, vector, int, text[]);

create or replace function match_memories(
  p_user_id uuid,
  p_query_embedding vector(1536),
  p_match_count int default 10,
  p_kinds text[] default array['media','life_facts','people','events'],
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
  -- Wrap the per-kind UNION in a subquery so the computed `similarity` alias is
  -- available to a single outer WHERE/ORDER/LIMIT. The first branch names all
  -- five output columns; later branches map positionally.
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
  ) results
  where results.similarity >= p_min_similarity
  order by results.similarity desc
  limit p_match_count;
$$;
