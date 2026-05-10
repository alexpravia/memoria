# backfill-embeddings

One-shot script that fills in `embedding`, `embedding_text`, and
`embedding_updated_at` for any rows in `media`, `life_facts`, `people`,
or `events` that don't yet have an embedding.

Idempotent — only touches rows where `embedding IS NULL`. Re-running is
safe.

## Prerequisites

1. The migration in `supabase/add_embeddings.sql` has been applied to
   the target database.
2. The `embed` Edge Function (`supabase/functions/embed/`) is deployed
   and reachable, with `EMBEDDING_API_KEY` (or `LLM_API_KEY`) set in
   the function's environment.
3. You have the project's **service-role** key handy.

## Run

```bash
cd memoria-app
SUPABASE_URL=https://<your-project>.supabase.co \
SUPABASE_SERVICE_KEY=<service_role_key> \
npx tsx scripts/backfill-embeddings.ts
```

Output looks like:

```
── Backfilling media ─────────────────────────────
  42 rows to embed
  • progress 42/42
  done: 42 embedded, 0 failed
── Backfilling life_facts ────────────────────────
  ✓ nothing to backfill
...
✅ Backfill complete.
```

## Cost

The script uses `text-embedding-3-small` (the default of the `embed`
Edge Function), priced at **~$0.02 per 1M tokens** as of mid-2026.

A typical Memoria record is 20–80 tokens. For 1,000 rows averaging
50 tokens that is ~$0.001 — essentially free. Even a heavy backfill of
100,000 rows costs only a few cents.

The script batches up to 50 rows per Edge Function call to keep
round-trips low while staying well under the function's hard cap of
100 texts per call.

## Resuming after a failure

Re-run the same command. Rows that were successfully embedded are
skipped (the `IS NULL` filter excludes them), so only the remaining
rows will be processed.
