// Seed a handful of test photos into Supabase Storage + the `media` table
// so a developer can verify photo display end-to-end without re-importing
// from a device.
//
// Usage (from `memoria-app/`):
//   SUPABASE_URL=https://<project>.supabase.co \
//   SUPABASE_SERVICE_KEY=<service_role_key> \
//   npx tsx scripts/seed-test-photos.ts --user-id <uuid>
//
// Uploads ~5 JPEGs from picsum.photos to `photos/{userId}/seed-{i}-{ts}.jpg`
// and inserts a verified `media` row for each.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const SEEDS: { seed: string; description: string }[] = [
  { seed: "memoria1", description: "A peaceful landscape at sunset." },
  { seed: "memoria2", description: "A scenic moment by the water." },
  { seed: "memoria3", description: "A quiet street on a calm afternoon." },
  { seed: "memoria4", description: "A warm view of trees in soft light." },
  { seed: "memoria5", description: "An open sky over distant hills." },
];

function getUserIdArg(): string | null {
  const idx = process.argv.indexOf("--user-id");
  if (idx === -1 || idx === process.argv.length - 1) return null;
  return process.argv[idx + 1];
}

async function main(): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error(
      "Refusing to run: set SUPABASE_URL and SUPABASE_SERVICE_KEY in env."
    );
    process.exit(1);
  }

  const userId = getUserIdArg();
  if (!userId) {
    console.error("Refusing to run: pass --user-id <UUID>.");
    console.error("  Find it in Supabase Dashboard → Table Editor → users.id");
    process.exit(1);
  }

  const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(`── seed-test-photos for user ${userId} ────────────`);

  const ts = Date.now();
  let seeded = 0;

  for (let i = 0; i < SEEDS.length; i++) {
    const { seed, description } = SEEDS[i];
    const sourceUrl = `https://picsum.photos/seed/${seed}/1024/768`;

    let bytes: ArrayBuffer;
    try {
      const res = await fetch(sourceUrl);
      if (!res.ok) {
        throw new Error(`fetch ${sourceUrl} -> ${res.status}`);
      }
      bytes = await res.arrayBuffer();
    } catch (err: any) {
      console.error(`  ✗ download failed (${seed}): ${err.message}`);
      continue;
    }

    const storagePath = `${userId}/seed-${i + 1}-${ts}.jpg`;
    const { error: uploadError } = await client.storage
      .from("photos")
      .upload(storagePath, new Uint8Array(bytes), {
        contentType: "image/jpeg",
        upsert: false,
      });
    if (uploadError) {
      console.error(`  ✗ upload failed (${seed}): ${uploadError.message}`);
      continue;
    }

    const { data: urlData } = client.storage
      .from("photos")
      .getPublicUrl(storagePath);

    const publicUrl = urlData.publicUrl;
    if (!publicUrl || !publicUrl.startsWith("http")) {
      console.error(`  ✗ no public URL for ${storagePath}`);
      continue;
    }

    const { error: insertError } = await client.from("media").insert({
      user_id: userId,
      file_url: publicUrl,
      file_type: "photo",
      description,
      verification_status: "verified",
      taken_at: new Date().toISOString(),
      ai_tags: ["test", "seed"],
    });
    if (insertError) {
      console.error(`  ✗ insert failed (${seed}): ${insertError.message}`);
      continue;
    }

    console.log(`[SEEDED] ${publicUrl}`);
    seeded += 1;
  }

  console.log(
    `\n✅ Seeded ${seeded} test photo${seeded === 1 ? "" : "s"} for user ${userId}`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
