// Integration test for the sensitivity classifier.
//
// Skips automatically when SUPABASE_TEST_URL / SUPABASE_TEST_SERVICE_KEY
// are not set. Requires `supabase/sensitivity_upgrade.sql` to be applied
// to the test project. Run with:
//   SUPABASE_TEST_URL=... SUPABASE_TEST_SERVICE_KEY=... \
//     npm run test:integration

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSupabaseTestClient } from "../helpers/supabase-test-client";
import { requireSupabaseTestCreds } from "../helpers/skip-if-no-creds";
import { seedLifeFacts, seedUser, wipeAll } from "../helpers/seed";

const creds = requireSupabaseTestCreds();
const client = getSupabaseTestClient();

describe("sensitivity classifier integration", () => {
  let userId: string | null = null;
  let factIds: string[] = [];
  let ruleId: string | null = null;

  beforeAll(async () => {
    if (!creds || !client) return;
    const user = await seedUser(client);
    userId = user!.id;
    factIds = await seedLifeFacts(client, userId, [
      "Loves gardening, especially tulips",
      "Visits the hospital every Tuesday for therapy",
    ]);

    const { data: ruleRow, error } = await client
      .from("sensitivity_filters")
      .insert({
        user_id: userId,
        filter_type: "intent",
        filter_value: "avoid the hospital",
        intent_text: "avoid the hospital",
      })
      .select("id")
      .single();
    if (error) throw error;
    ruleId = ruleRow!.id as string;
  });

  afterAll(async () => {
    if (!creds || !client || !userId) return;
    await wipeAll(client, userId);
  });

  it.skipIf(!creds)(
    "getOrClassify persists decisions to sensitivity_decisions",
    async () => {
      const { getOrClassify, ruleSetHash } = await import("@memoria/core");

      const rules = [
        {
          id: ruleId!,
          filter_type: "intent" as const,
          intent_text: "avoid the hospital",
        },
      ];

      const items = factIds.map((id, i) => ({
        id,
        kind: "life_facts" as const,
        text:
          i === 0
            ? "Loves gardening, especially tulips"
            : "Visits the hospital every Tuesday for therapy",
      }));

      const out = await getOrClassify(userId!, items, rules);

      // Decision map should contain entries for both items.
      expect(out.size).toBeGreaterThan(0);

      // Verify the rows landed in sensitivity_decisions.
      const hash = ruleSetHash(rules);
      const { data: rows, error } = await client!
        .from("sensitivity_decisions")
        .select("item_id, allow, rule_set_hash")
        .eq("user_id", userId!)
        .eq("rule_set_hash", hash)
        .in("item_id", factIds);

      expect(error).toBeNull();
      expect(rows).toBeTruthy();
      expect(rows!.length).toBeGreaterThan(0);
      for (const row of rows!) {
        expect(row.rule_set_hash).toBe(hash);
        expect(typeof row.allow).toBe("boolean");
      }
    },
    60_000
  );
});
