# seed-test-photos

Quick way to get ~5 verified photos into a patient's `media` table so you
can sanity-check photo display in chat, briefings, and the Photos screens
**without** importing from a real device.

The script downloads five stable JPEGs from `picsum.photos`, uploads them
to the `photos` Supabase Storage bucket under `{userId}/seed-{i}-{ts}.jpg`,
and inserts a `verification_status='verified'` row in `media` for each one
(tagged `["test", "seed"]` so they're easy to find/remove).

## Prerequisites

- The `photos` bucket exists with the right RLS policies. If unsure, run
  `supabase/ensure_photos_bucket.sql` first.
- Project's **service-role** key (Dashboard → Project Settings → API).
- The patient's `users.id` (UUID).

### Finding the user_id

Supabase Dashboard → **Table Editor** → `users` → copy the `id` of the
patient you want to seed photos for.

## Run

```bash
cd memoria-app
SUPABASE_URL=https://<your-project>.supabase.co \
SUPABASE_SERVICE_KEY=<service_role_key> \
npx tsx scripts/seed-test-photos.ts --user-id <PATIENT_UUID>
```

Output:

```
── seed-test-photos for user 1c6a… ────────────
[SEEDED] https://<project>.supabase.co/storage/v1/object/public/photos/1c6a…/seed-1-1715200000000.jpg
[SEEDED] https://<project>.supabase.co/storage/v1/object/public/photos/1c6a…/seed-2-1715200000000.jpg
…
✅ Seeded 5 test photos for user 1c6a…
```

## Removing the seed data later

In the Supabase SQL Editor:

```sql
-- Remove the media rows
DELETE FROM media
WHERE user_id = '<PATIENT_UUID>'
  AND ai_tags @> '["test", "seed"]'::jsonb;
```

The corresponding storage objects can be deleted from the Dashboard
(**Storage** → `photos` → `{userId}/seed-*.jpg`) or via:

```sql
DELETE FROM storage.objects
WHERE bucket_id = 'photos'
  AND name LIKE '<PATIENT_UUID>/seed-%';
```

## Re-running

Re-running creates a fresh batch (filenames include a timestamp). It will
not collide with prior seeds.
