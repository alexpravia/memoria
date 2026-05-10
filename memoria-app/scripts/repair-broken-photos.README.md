# repair-broken-photos

One-shot script that finds `media` rows whose `file_url` is a local device
path (`file:///...`, `ph://...`, `/var/...`) instead of a Supabase Storage
public URL, and **hides** them so they don't appear in chat or briefings.

These rows usually come from older imports where the upload silently failed
and the local URI was inserted instead. They can't render anywhere except
on the original device.

## What it does

For each row where `file_url` does not start with `http`:

1. Print `[BROKEN] id={id} url={url}`.
2. (`--apply` only) `UPDATE media SET verification_status='hidden'`.
3. (`--apply` only) Best-effort: delete pending `flag_queue` entries that
   reference the row (`flag_type='media' AND reference_id=id`).

Rows are **not deleted** — hiding them is reversible from the Supabase
Dashboard if needed.

## Prerequisites

- Project's **service-role** key (Dashboard → Project Settings → API).
- Network access to your Supabase project.

## Run

```bash
cd memoria-app

# Dry-run first (default):
SUPABASE_URL=https://<your-project>.supabase.co \
SUPABASE_SERVICE_KEY=<service_role_key> \
npx tsx scripts/repair-broken-photos.ts

# Then apply:
SUPABASE_URL=https://<your-project>.supabase.co \
SUPABASE_SERVICE_KEY=<service_role_key> \
npx tsx scripts/repair-broken-photos.ts --apply
```

Output looks like:

```
── repair-broken-photos (DRY-RUN) ──────────────────
[BROKEN] id=abc-… url=file:///var/mobile/Media/DCIM/130APPLE/IMG_0994.HEIC
[BROKEN] id=def-… url=ph://…

── summary ──────────────────────────────────────────
2 broken rows found
(dry-run — re-run with --apply to update)
```

## Idempotency

Re-running is safe. After `--apply` the affected rows have
`verification_status='hidden'`, so they no longer appear in the broken
selection on subsequent runs (only the `file_url` check matters; it still
matches them, but updating again is a no-op).
