// Integration test for the embeddings + RAG search pipeline.
//
// Skips automatically when SUPABASE_TEST_URL / SUPABASE_TEST_SERVICE_KEY
// are not set. Run with:
//   SUPABASE_TEST_URL=... SUPABASE_TEST_SERVICE_KEY=... \
//     npm run test:integration

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSupabaseTestClient } from "../helpers/supabase-test-client";
import { requireSupabaseTestCreds } from "../helpers/skip-if-no-creds";
import { seedPhotos, seedUser, wipeAll } from "../helpers/seed";

const creds = requireSupabaseTestCreds();
const client = getSupabaseTestClient();

describe("embeddings + searchMemories integration", () => {
  let userId: string | null = null;
  let photoIds: string[] = [];

  beforeAll(async () => {
    if (!creds || !client) return;
    const user = await seedUser(client);
    userId = user!.id;
    photoIds = await seedPhotos(client, userId, [
      "A bright sunny day at the beach with seagulls and umbrellas",
      "Family dinner around the dining room table with candles",
      "Garden in spring with tulips and daffodils",
      "Birthday party with balloons and cake",
      "Hiking on a mountain trail surrounded by pine trees",
    ]);
  });

  afterAll(async () => {
    if (!creds || !client || !userId) return;
    await wipeAll(client, userId);
  });

  it.skipIf(!creds)(
    "embedAndStore populates embedding columns of length 1536",
    async () => {
      // Dynamically import so the supabase client used by the lib is the
      // app one — but for the integration test we drive the lib directly,
      // hitting the same Supabase project as `client` via the Edge
      // Function. Confirm via the service-role client that the columns
      // actually got written.
      const { embedAndStore } = await import("../../src/lib/embeddings");

      for (let i = 0; i < photoIds.length; i++) {
        const res = await embedAndStore(
          "media",
          photoIds[i],
          (
            await client!
              .from("media")
              .select("description")
              .eq("id", photoIds[i])
              .single()
          ).data!.description as string
        );
        expect(res.ok).toBe(true);
      }

      const { data: rows, error } = await client!
        .from("media")
        .select("id, embedding")
        .in("id", photoIds);
      expect(error).toBeNull();
      expect(rows).toBeTruthy();
      for (const row of rows!) {
        // pgvector returns the vector as a string like "[0.1,0.2,...]"
        // when fetched through PostgREST. Length-check by parsing.
        const arr =
          typeof row.embedding === "string"
            ? JSON.parse(row.embedding)
            : row.embedding;
        expect(Array.isArray(arr)).toBe(true);
        expect(arr.length).toBe(1536);
      }
    },
    60_000
  );

  it.skipIf(!creds)(
    "searchMemories returns the beach photo in the top 3 for query 'beach'",
    async () => {
      const { searchMemories } = await import("../../src/lib/embeddings");
      const matches = await searchMemories(userId!, "beach", { limit: 3 });
      expect(matches.length).toBeGreaterThan(0);
      const beachPhotoId = photoIds[0];
      const ids = matches.map((m) => m.id);
      expect(ids).toContain(beachPhotoId);
    },
    30_000
  );
});
