// Phase B integration test for the ask-assistant Edge Function.
//
// Skips automatically when SUPABASE_TEST_URL / SUPABASE_TEST_SERVICE_KEY
// are not set. Run with:
//   SUPABASE_TEST_URL=... SUPABASE_TEST_SERVICE_KEY=... \
//     npm run test:integration
//
// Asserts:
//   - the function creates a conversation and returns its id
//   - user + assistant messages are persisted
//   - "show me beach photos" causes a `search_memories` tool call (the
//     Phase B replacement for the old `[PHOTO:url]` regex)

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseTestClient } from "../helpers/supabase-test-client";
import { requireSupabaseTestCreds } from "../helpers/skip-if-no-creds";
import { seedPhotos, seedUser, wipeAll } from "../helpers/seed";
import { embedAndStore } from "../../src/lib/embeddings";

const creds = requireSupabaseTestCreds();
const adminClient = getSupabaseTestClient();

// A second client used to invoke the function — uses the same service
// role since these tests do not exercise auth. The Edge Function trusts
// `userId` in the request body.
const userFacingClient = creds
  ? createClient(creds.url, creds.serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

describe("ask-assistant integration", () => {
  let userId: string | null = null;
  let photoIds: string[] = [];

  beforeAll(async () => {
    if (!creds || !adminClient) return;
    const user = await seedUser(adminClient, { fullName: "Integration Tester" });
    userId = user!.id;

    photoIds = await seedPhotos(adminClient, userId, [
      "A bright sunny day at the beach with seagulls and umbrellas",
      "Family dinner around the dining room table with candles",
      "Hiking on a mountain trail surrounded by pine trees",
    ]);

    // Embed each photo so search_memories has something to find.
    for (const id of photoIds) {
      const { data } = await adminClient
        .from("media")
        .select("description")
        .eq("id", id)
        .single();
      await embedAndStore("media", id, (data!.description as string) ?? "");
    }
  }, 120_000);

  afterAll(async () => {
    if (!creds || !adminClient || !userId) return;
    await wipeAll(adminClient, userId);
  });

  it.skipIf(!creds)(
    "creates a conversation, persists messages, and returns an answer",
    async () => {
      const { data, error } = await userFacingClient!.functions.invoke(
        "ask-assistant",
        {
          body: { userId, question: "Hello, who am I?" },
        }
      );
      expect(error).toBeNull();
      const parsed = typeof data === "string" ? JSON.parse(data) : data;
      expect(parsed.conversationId).toBeTruthy();
      expect(typeof parsed.answer).toBe("string");
      expect(parsed.answer.length).toBeGreaterThan(0);

      // At least the user message + final assistant message must be there.
      const { data: msgs } = await adminClient!
        .from("messages")
        .select("role")
        .eq("conversation_id", parsed.conversationId);
      expect((msgs ?? []).length).toBeGreaterThanOrEqual(2);
      const roles = (msgs ?? []).map((r: any) => r.role);
      expect(roles).toContain("user");
      expect(roles).toContain("assistant");
    },
    60_000
  );

  it.skipIf(!creds)(
    "'show me beach photos' triggers a search_memories tool call",
    async () => {
      const { data } = await userFacingClient!.functions.invoke(
        "ask-assistant",
        {
          body: { userId, question: "Show me beach photos" },
        }
      );
      const parsed = typeof data === "string" ? JSON.parse(data) : data;
      expect(parsed.conversationId).toBeTruthy();

      const { data: msgs } = await adminClient!
        .from("messages")
        .select("role, tool_name, tool_calls")
        .eq("conversation_id", parsed.conversationId);

      const sawSearchTool =
        (msgs ?? []).some(
          (m: any) => m.role === "tool" && m.tool_name === "search_memories"
        ) ||
        (msgs ?? []).some(
          (m: any) =>
            m.role === "assistant" &&
            Array.isArray(m.tool_calls) &&
            m.tool_calls.some(
              (tc: any) => tc?.function?.name === "search_memories"
            )
        );

      expect(sawSearchTool).toBe(true);
    },
    60_000
  );
});
