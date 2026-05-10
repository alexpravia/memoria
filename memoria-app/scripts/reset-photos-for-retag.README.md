# reset-photos-for-retag

Bulk-reset every non-hidden, http(s)-hosted photo for a single user back to
`verification_status='pending'`, clear `ai_tags` and `description`, and ensure
a pending `flag_queue` row exists for each one.

This forces the AI re-tagger (the `process-photo` Edge Function, triggered when
the co-user opens the Flag Queue / Review screen) to re-process the entire
photo library from scratch.

## When to use

- After improving the vision prompt or face-matching logic and you want every
  existing photo re-described with the new pipeline.
- After a bad batch of AI tags landed and you want a clean slate for one user.
- After importing or migrating a user's library and tags look stale.

Hidden rows (`verification_status='hidden'`, e.g. legacy `file://` URLs) are
left alone — use `repair-broken-photos.ts` for those first.

## Commands

Run from `memoria-app/`.

Dry-run (shows what would be reset, no writes):

```bash
SUPABASE_URL=https://<project>.supabase.co \
SUPABASE_SERVICE_KEY=<service_role_key> \
npx tsx scripts/reset-photos-for-retag.ts --user <user_id>
```

Apply (actually resets rows + ensures flag_queue entries):

```bash
SUPABASE_URL=https://<project>.supabase.co \
SUPABASE_SERVICE_KEY=<service_role_key> \
npx tsx scripts/reset-photos-for-retag.ts --user <user_id> --apply
```

The script is idempotent — re-running with `--apply` is a no-op once every
row is already `pending` with cleared metadata and a pending flag entry.

## ⚠️ Cost warning

After this runs, the AI re-tagger will fire once per photo (vision call +
embedding). For libraries with hundreds of photos this is a non-trivial
OpenAI bill. Confirm the user/library size before applying, and consider
running on a single test user first.
