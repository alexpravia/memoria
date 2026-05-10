// Reset every non-hidden http(s) photo for a user back to
// verification_status='pending', clear ai_tags + description, and
// ensure a pending flag_queue row exists. Used to force the AI
// re-tagger (process-photo) to re-process the entire library.
//
// Usage (from `memoria-app/`):
//   SUPABASE_URL=https://<project>.supabase.co \
//   SUPABASE_SERVICE_KEY=<service_role_key> \
//   npx tsx scripts/reset-photos-for-retag.ts --user <user_id>            # dry-run
//
//   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... \
//   npx tsx scripts/reset-photos-for-retag.ts --user <user_id> --apply    # actually update
//
// Idempotent: safe to re-run.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

interface PhotoRow {
  id: string;
  file_url: string;
}

function printUsage(): void {
  console.error(
    "Usage: npx tsx scripts/reset-photos-for-retag.ts --user <user_id> [--apply]"
  );
}

function parseUserId(argv: string[]): string | null {
  const idx = argv.indexOf("--user");
  if (idx === -1) return null;
  const value = argv[idx + 1];
  if (!value || value.startsWith("--")) return null;
  return value;
}

async function main(): Promise<void> {
  const userId = parseUserId(process.argv);
  if (!userId) {
    printUsage();
    process.exit(1);
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error(
      "Refusing to run: set SUPABASE_URL and SUPABASE_SERVICE_KEY in env."
    );
    process.exit(1);
  }

  const apply = process.argv.includes("--apply");
  const mode = apply ? "APPLY" : "DRY-RUN";
  console.log(`── reset-photos-for-retag (${mode}) ────────────────`);
  console.log(`user_id=${userId}`);

  const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await client
    .from("media")
    .select("id, file_url")
    .eq("user_id", userId)
    .eq("file_type", "photo")
    .neq("verification_status", "hidden")
    .ilike("file_url", "http%");

  if (error) {
    console.error(`select failed: ${error.message}`);
    process.exit(1);
  }

  const photos: PhotoRow[] = (data as PhotoRow[]) ?? [];

  if (photos.length === 0) {
    console.log("✓ no photos found.");
    process.exit(0);
  }

  for (const row of photos) {
    console.log(`[RESET] id=${row.id} url=${row.file_url}`);
  }

  if (!apply) {
    console.log("\n── summary ──────────────────────────────────────────");
    console.log(`${photos.length} photos found`);
    console.log("(dry-run — re-run with --apply to update)");
    process.exit(0);
  }

  const ids = photos.map((p) => p.id);

  const { error: updErr } = await client
    .from("media")
    .update({
      verification_status: "pending",
      ai_tags: null,
      description: null,
    })
    .in("id", ids);

  if (updErr) {
    console.error(`bulk update failed: ${updErr.message}`);
    process.exit(1);
  }

  let reset = 0;
  let failed = 0;

  for (const id of ids) {
    const { data: existing, error: selErr } = await client
      .from("flag_queue")
      .select("id")
      .eq("reference_id", id)
      .eq("flag_type", "media")
      .eq("status", "pending")
      .maybeSingle();

    if (selErr) {
      console.warn(`  ⚠ flag_queue lookup id=${id}: ${selErr.message}`);
      failed += 1;
      continue;
    }

    if (!existing) {
      const { error: insErr } = await client.from("flag_queue").insert({
        user_id: userId,
        flag_type: "media",
        reference_id: id,
        description: "Reset for AI re-tagging",
        status: "pending",
      });
      if (insErr) {
        console.warn(`  ⚠ flag_queue insert id=${id}: ${insErr.message}`);
        failed += 1;
        continue;
      }
    }
    reset += 1;
  }

  console.log("\n── summary ──────────────────────────────────────────");
  console.log(`${photos.length} photos found`);
  console.log(`${reset} reset, ${failed} failed`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
