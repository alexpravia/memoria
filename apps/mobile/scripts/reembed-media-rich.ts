// Re-embed every non-hidden photo with RICH text (description + AI tags +
// identified people names) instead of the description alone.
//
// Why: the original pipeline embedded only `media.description`, so a photo
// tagged ["beach","sunset"] was NOT retrievable by a "beach photo" query when
// the prose description never said "beach". photoProcessing.ts now embeds the
// rich blob going forward; this script backfills photos imported before that
// change. Safe to re-run (it simply recomputes and overwrites the embedding).
//
// Usage (from `memoria-app/`):
//   SUPABASE_URL=https://<project>.supabase.co \
//   SUPABASE_SERVICE_KEY=<service_role_key> \
//   tsx scripts/reembed-media-rich.ts
//
// Mirrors buildPhotoEmbedText() in src/lib/photoProcessing.ts. Kept inline so
// the script stays self-contained (importing the lib would pull in the RN
// Supabase singleton, which needs EXPO_PUBLIC_* env this script does not set).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const BATCH_SIZE = 50;

/** Mirror of src/lib/photoProcessing.ts:buildPhotoEmbedText. Keep in sync. */
function buildPhotoEmbedText(
  description: string | null | undefined,
  tags: string[] | null | undefined,
  peopleNames: string[] | null | undefined
): string {
  const tagsText = Array.isArray(tags)
    ? tags.map((t) => String(t).trim()).filter(Boolean).join(", ")
    : "";
  const peopleText = Array.isArray(peopleNames)
    ? peopleNames.map((n) => String(n).trim()).filter(Boolean).join(", ")
    : "";
  return [(description ?? "").trim(), tagsText, peopleText]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(". ");
}

/** ai_tags is stored as jsonb; normalize to a string[] defensively. */
function normalizeTags(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((t) => String(t)).filter(Boolean);
  return [];
}

async function fetchEmbeddings(
  client: SupabaseClient,
  texts: string[]
): Promise<number[][]> {
  const { data, error } = await client.functions.invoke("embed", {
    body: { texts },
  });
  if (error) throw new Error(`embed function failed: ${error.message}`);
  const parsed = typeof data === "string" ? JSON.parse(data) : data;
  if (!Array.isArray(parsed?.embeddings)) {
    throw new Error(`embed returned no embeddings: ${JSON.stringify(parsed)}`);
  }
  return parsed.embeddings as number[][];
}

/** Map each media id -> the names of people tagged in it (verified or not). */
async function fetchPeopleNames(
  client: SupabaseClient,
  mediaIds: string[]
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (mediaIds.length === 0) return map;

  const { data, error } = await client
    .from("media_people")
    .select("media_id, people:person_id ( full_name )")
    .in("media_id", mediaIds);

  if (error) {
    console.warn(`  ! could not load people tags: ${error.message}`);
    return map;
  }

  for (const row of (data as any[]) ?? []) {
    const name: string | undefined = row?.people?.full_name;
    if (!name) continue;
    const list = map.get(row.media_id) ?? [];
    list.push(name);
    map.set(row.media_id, list);
  }
  return map;
}

async function main(): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error(
      "Refusing to run: set SUPABASE_URL and SUPABASE_SERVICE_KEY in env."
    );
    process.exit(1);
  }

  const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log("── Re-embedding non-hidden photos with rich text ──────────");

  const { data: rows, error } = await client
    .from("media")
    .select("id, description, ai_tags")
    .eq("file_type", "photo")
    .neq("verification_status", "hidden");

  if (error) {
    console.error(`  ✗ select failed: ${error.message}`);
    process.exit(1);
  }

  const candidates = ((rows as any[]) ?? []);
  if (candidates.length === 0) {
    console.log("  ✓ nothing to re-embed");
    return;
  }
  console.log(`  ${candidates.length} photos to re-embed`);

  let embedded = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const slice = candidates.slice(i, i + BATCH_SIZE);
    const peopleByMedia = await fetchPeopleNames(
      client,
      slice.map((r) => r.id)
    );

    const texts = slice.map((r) =>
      buildPhotoEmbedText(
        r.description,
        normalizeTags(r.ai_tags),
        peopleByMedia.get(r.id) ?? []
      )
    );

    // Rows with no description, tags, or people produce empty text — skip them
    // (embedding empty text is meaningless and the embed fn would reject it).
    const embedIdx: number[] = [];
    const embedTexts: string[] = [];
    texts.forEach((t, j) => {
      if (t) {
        embedIdx.push(j);
        embedTexts.push(t);
      } else {
        skipped += 1;
      }
    });

    if (embedTexts.length === 0) continue;

    let embeddings: number[][];
    try {
      embeddings = await fetchEmbeddings(client, embedTexts);
    } catch (err: any) {
      console.error(`  ✗ batch ${i / BATCH_SIZE} embed failed: ${err.message}`);
      failed += embedTexts.length;
      continue;
    }

    for (let k = 0; k < embedIdx.length; k++) {
      const row = slice[embedIdx[k]];
      const embedding = embeddings[k];
      if (!embedding) {
        failed += 1;
        continue;
      }
      const { error: upErr } = await client
        .from("media")
        .update({
          embedding,
          embedding_text: embedTexts[k],
          embedding_updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      if (upErr) {
        console.error(`  ✗ update media/${row.id}: ${upErr.message}`);
        failed += 1;
      } else {
        embedded += 1;
      }
    }

    console.log(
      `  • progress ${Math.min(i + BATCH_SIZE, candidates.length)}/${candidates.length}`
    );
  }

  console.log(
    `\n✅ Re-embed complete: ${embedded} embedded, ${skipped} skipped (empty), ${failed} failed`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
