// Backfill embeddings for existing rows that don't yet have one.
//
// Usage (from `memoria-app/`):
//   SUPABASE_URL=https://<project>.supabase.co \
//   SUPABASE_SERVICE_KEY=<service_role_key> \
//   tsx scripts/backfill-embeddings.ts
//
// Idempotent: only processes rows where `embedding IS NULL`.
// See backfill-embeddings.README.md for cost notes.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const BATCH_SIZE = 50;

interface TableSpec {
  table: "media" | "life_facts" | "people" | "events";
  selectColumns: string;
  buildText: (row: any) => string;
  filter?: (row: any) => boolean;
}

const TABLES: TableSpec[] = [
  {
    table: "media",
    selectColumns: "id, description",
    buildText: (r) => (r.description || "").trim(),
    filter: (r) => Boolean(r.description && String(r.description).trim()),
  },
  {
    table: "life_facts",
    selectColumns: "id, fact",
    buildText: (r) => (r.fact || "").trim(),
    filter: (r) => Boolean(r.fact && String(r.fact).trim()),
  },
  {
    table: "people",
    selectColumns: "id, full_name, relationship, key_facts, emotional_notes",
    buildText: (r) =>
      [
        r.full_name,
        r.relationship,
        Array.isArray(r.key_facts) ? r.key_facts.join(" ") : "",
        r.emotional_notes || "",
      ]
        .filter(Boolean)
        .join(" ")
        .trim(),
    filter: (r) => Boolean(r.full_name),
  },
  {
    table: "events",
    selectColumns: "id, title, description",
    buildText: (r) => `${r.title} ${r.description ?? ""}`.trim(),
    filter: (r) => Boolean(r.title),
  },
];

async function fetchEmbeddings(
  client: SupabaseClient,
  texts: string[]
): Promise<number[][]> {
  const { data, error } = await client.functions.invoke("embed", {
    body: { texts },
  });
  if (error) {
    throw new Error(`embed function failed: ${error.message}`);
  }
  const parsed = typeof data === "string" ? JSON.parse(data) : data;
  if (!Array.isArray(parsed?.embeddings)) {
    throw new Error(`embed function returned no embeddings: ${JSON.stringify(parsed)}`);
  }
  return parsed.embeddings as number[][];
}

async function backfillTable(
  client: SupabaseClient,
  spec: TableSpec
): Promise<void> {
  console.log(`\n── Backfilling ${spec.table} ──────────────────────────────`);

  const { data: rows, error } = await client
    .from(spec.table)
    .select(spec.selectColumns)
    .is("embedding", null);

  if (error) {
    console.error(`  ✗ select failed: ${error.message}`);
    return;
  }

  const candidates: any[] = ((rows as any[]) ?? []).filter((r) =>
    spec.filter ? spec.filter(r) : true
  );
  if (candidates.length === 0) {
    console.log(`  ✓ nothing to backfill`);
    return;
  }
  console.log(`  ${candidates.length} rows to embed`);

  let embedded = 0;
  let failed = 0;

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const slice = candidates.slice(i, i + BATCH_SIZE);
    const texts = slice.map((r) => spec.buildText(r));

    let embeddings: number[][];
    try {
      embeddings = await fetchEmbeddings(client, texts);
    } catch (err: any) {
      console.error(`  ✗ batch ${i / BATCH_SIZE} embed failed: ${err.message}`);
      failed += slice.length;
      continue;
    }

    for (let j = 0; j < slice.length; j++) {
      const row = slice[j];
      const embedding = embeddings[j];
      if (!embedding) {
        failed += 1;
        continue;
      }
      const { error: upErr } = await client
        .from(spec.table)
        .update({
          embedding,
          embedding_text: texts[j],
          embedding_updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      if (upErr) {
        console.error(`  ✗ update ${spec.table}/${row.id}: ${upErr.message}`);
        failed += 1;
      } else {
        embedded += 1;
      }
    }

    console.log(`  • progress ${Math.min(i + BATCH_SIZE, candidates.length)}/${candidates.length}`);
  }

  console.log(`  done: ${embedded} embedded, ${failed} failed`);
}

async function main(): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("Refusing to run: set SUPABASE_URL and SUPABASE_SERVICE_KEY in env.");
    process.exit(1);
  }

  const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  for (const spec of TABLES) {
    await backfillTable(client, spec);
  }

  console.log("\n✅ Backfill complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
