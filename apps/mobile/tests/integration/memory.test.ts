// Integration test for the persistent assistant memory client (Phase D).
//
// Skips automatically when SUPABASE_TEST_URL / SUPABASE_TEST_SERVICE_KEY
// are not set. Requires `supabase/assistant_memory.sql` to be applied
// to the test project. Run with:
//   SUPABASE_TEST_URL=... SUPABASE_TEST_SERVICE_KEY=... \
//     npm run test:integration

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSupabaseTestClient } from "../helpers/supabase-test-client";
import { requireSupabaseTestCreds } from "../helpers/skip-if-no-creds";
import { seedUser, wipeAll } from "../helpers/seed";

const creds = requireSupabaseTestCreds();
const client = getSupabaseTestClient();

describe("assistant_memory integration", () => {
  let userId: string | null = null;

  beforeAll(async () => {
    if (!creds || !client) return;
    const user = await seedUser(client);
    userId = user!.id;
  });

  afterAll(async () => {
    if (!creds || !client || !userId) return;
    await wipeAll(client, userId);
  });

  it.skipIf(!creds)(
    "rememberAboutUser persists the same recurring_question 3 times",
    async () => {
      const { rememberAboutUser } = await import("@memoria/core");

      const content = "What day is it today?";
      for (let i = 0; i < 3; i++) {
        const out = await rememberAboutUser(
          userId!,
          "recurring_question",
          content,
          2
        );
        expect("id" in out).toBe(true);
      }

      const { data: rows, error } = await client!
        .from("assistant_memory")
        .select("id, kind, content, importance")
        .eq("user_id", userId!)
        .eq("kind", "recurring_question")
        .eq("content", content);

      expect(error).toBeNull();
      expect(rows).toBeTruthy();
      expect(rows!.length).toBe(3);
    },
    30_000
  );

  it.skipIf(!creds)(
    "high-importance memory inserts a flag_queue row",
    async () => {
      const { rememberAboutUser } = await import("@memoria/core");

      const content = "Spouse's name is Marcia, not Maria.";
      const out = await rememberAboutUser(
        userId!,
        "factual_correction",
        content,
        5
      );
      expect("id" in out).toBe(true);
      const memId = (out as { id: string }).id;

      // The flag insert is fire-and-forget; give it a moment to land.
      await new Promise((r) => setTimeout(r, 500));

      const { data: flags, error } = await client!
        .from("flag_queue")
        .select("id, reference_id, description, flag_type")
        .eq("user_id", userId!)
        .eq("reference_id", memId);

      expect(error).toBeNull();
      expect(flags).toBeTruthy();
      expect(flags!.length).toBeGreaterThanOrEqual(1);
      expect(flags![0].description).toContain("Memory to review");
    },
    30_000
  );
});
