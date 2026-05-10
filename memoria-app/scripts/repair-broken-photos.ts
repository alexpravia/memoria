// Repair (hide) media rows whose file_url points at a local device path
// rather than a Supabase Storage public URL. These rows can't render in the
// app and pollute chat/briefing context.
//
// Usage (from `memoria-app/`):
//   SUPABASE_URL=https://<project>.supabase.co \
//   SUPABASE_SERVICE_KEY=<service_role_key> \
//   npx tsx scripts/repair-broken-photos.ts            # dry-run (default)
//
//   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... \
//   npx tsx scripts/repair-broken-photos.ts --apply    # actually update
//
// Idempotent: only touches rows whose file_url does not start with `http`.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

interface BrokenRow {
  id: string;
  file_url: string;
  taken_at: string | null;
  user_id: string;
}

async function main(): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error(
      "Refusing to run: set SUPABASE_URL and SUPABASE_SERVICE_KEY in env."
    );
    process.exit(1);
  }

  const apply = process.argv.includes("--apply");
  const mode = apply ? "APPLY" : "DRY-RUN";
  console.log(`── repair-broken-photos (${mode}) ──────────────────`);

  const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Fetch ALL non-hidden media rows so we can classify each one as
  // either a non-http URL (legacy file://, etc.) OR a 0-byte upload
  // (HEIC→JPEG conversion failure that left an empty object in
  // Storage). Both fail to render and both crash the vision API.
  const { data, error } = await client
    .from("media")
    .select("id, file_url, taken_at, user_id, verification_status")
    .neq("verification_status", "hidden");

  if (error) {
    console.error(`select failed: ${error.message}`);
    process.exit(1);
  }

  const allRows = ((data as Array<BrokenRow & { verification_status: string }>) ?? []);
  const broken: BrokenRow[] = [];

  for (const row of allRows) {
    const url = row.file_url;
    // Reason 1: not an http(s) URL.
    if (!url || !/^https?:/i.test(url)) {
      broken.push(row);
      continue;
    }
    // Reason 2: http URL but the object is empty (0-byte). HEAD it.
    try {
      const head = await fetch(url, { method: "HEAD" });
      const len = head.headers.get("content-length");
      if (!head.ok || len === "0") {
        broken.push(row);
      }
    } catch {
      // Network errors → treat as broken (better to hide than serve blank).
      broken.push(row);
    }
  }

  if (broken.length === 0) {
    console.log("✓ no broken rows found.");
    process.exit(0);
  }

  let hidden = 0;
  let failed = 0;

  for (const row of broken) {
    console.log(`[BROKEN] id=${row.id} url=${row.file_url}`);

    if (!apply) continue;

    const { error: upErr } = await client
      .from("media")
      .update({ verification_status: "hidden" })
      .eq("id", row.id);

    if (upErr) {
      console.error(`  ✗ update failed: ${upErr.message}`);
      failed += 1;
      continue;
    }
    hidden += 1;

    // Best-effort: clear stale AI metadata so it can't leak into chat /
    // briefing context via search even while the row is hidden.
    const { error: clearErr } = await client
      .from("media")
      .update({ ai_tags: null, description: null })
      .eq("id", row.id);
    if (clearErr) {
      console.warn(`  ⚠ ai_tags/description clear: ${clearErr.message}`);
    }

    // Best-effort: clear pending flag_queue rows referencing this media id.
    const { error: flagErr } = await client
      .from("flag_queue")
      .delete()
      .eq("flag_type", "media")
      .eq("reference_id", row.id)
      .eq("status", "pending");
    if (flagErr) {
      console.warn(`  ⚠ flag_queue cleanup: ${flagErr.message}`);
    }
  }

  console.log("\n── summary ──────────────────────────────────────────");
  console.log(`${broken.length} broken rows found`);
  if (apply) {
    console.log(`${hidden} hidden, ${failed} failed`);
  } else {
    console.log("(dry-run — re-run with --apply to update)");
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
