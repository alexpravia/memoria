// Unit tests for the embeddings client lib.
// Mocks Supabase using the same pattern as `src/lib/assistant.test.ts`.

import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mock state ──────────────────────────────────────────────────────
interface UpdateCall {
  table: string;
  values: Record<string, unknown>;
  eqColumn: string;
  eqValue: unknown;
}

interface RpcCall {
  fn: string;
  args: Record<string, unknown>;
}

interface MockState {
  updateCalls: UpdateCall[];
  rpcCalls: RpcCall[];
  rpcResult: { data: unknown; error: { message: string } | null };
  invokeImpl: (
    fn: string,
    opts: { body: unknown }
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
  updateError: { message: string } | null;
}

const state: MockState = {
  updateCalls: [],
  rpcCalls: [],
  rpcResult: { data: [], error: null },
  invokeImpl: async () => ({ data: { embedding: [] }, error: null }),
  updateError: null,
};

vi.mock("./supabase", () => ({
  supabase: {
    from: (table: string) => ({
      update: (values: Record<string, unknown>) => ({
        eq: (eqColumn: string, eqValue: unknown) => {
          state.updateCalls.push({ table, values, eqColumn, eqValue });
          return Promise.resolve({ data: null, error: state.updateError });
        },
      }),
    }),
    rpc: (fn: string, args: Record<string, unknown>) => {
      state.rpcCalls.push({ fn, args });
      return Promise.resolve(state.rpcResult);
    },
    functions: {
      invoke: (fn: string, opts: { body: unknown }) => state.invokeImpl(fn, opts),
    },
  },
}));

// Import after the mock is registered.
import { embedAndStore, searchMemories } from "./embeddings";

beforeEach(() => {
  state.updateCalls = [];
  state.rpcCalls = [];
  state.rpcResult = { data: [], error: null };
  state.updateError = null;
  state.invokeImpl = async () => ({
    data: { embedding: new Array(1536).fill(0.1) },
    error: null,
  });
});

describe("embedAndStore", () => {
  it("builds a correct UPDATE call for each table", async () => {
    for (const table of ["media", "life_facts", "people", "events"] as const) {
      state.updateCalls = [];
      const res = await embedAndStore(table, "row-id-1", "some text");
      expect(res.ok).toBe(true);
      expect(state.updateCalls).toHaveLength(1);
      const call = state.updateCalls[0];
      expect(call.table).toBe(table);
      expect(call.eqColumn).toBe("id");
      expect(call.eqValue).toBe("row-id-1");
      expect(Array.isArray(call.values.embedding)).toBe(true);
      expect((call.values.embedding as number[]).length).toBe(1536);
      expect(call.values.embedding_text).toBe("some text");
      expect(typeof call.values.embedding_updated_at).toBe("string");
    }
  });

  it("returns {ok:false} (does not throw) when embed function fails", async () => {
    state.invokeImpl = async () => ({
      data: null,
      error: { message: "boom" },
    });

    const res = await embedAndStore("media", "row-id-2", "text");
    expect(res.ok).toBe(false);
    expect(res.error).toContain("boom");
    // No update should have been attempted.
    expect(state.updateCalls).toHaveLength(0);
  });

  it("returns {ok:false} (does not throw) when the UPDATE fails", async () => {
    state.updateError = { message: "db down" };
    const res = await embedAndStore("people", "row-id-3", "text");
    expect(res.ok).toBe(false);
    expect(res.error).toContain("db down");
  });

  it("returns {ok:false} for empty text without invoking the function", async () => {
    let invoked = 0;
    state.invokeImpl = async () => {
      invoked += 1;
      return { data: { embedding: [] }, error: null };
    };
    const res = await embedAndStore("life_facts", "row-id-4", "   ");
    expect(res.ok).toBe(false);
    expect(invoked).toBe(0);
  });
});

describe("searchMemories", () => {
  it("builds correct RPC call with default limit and kinds", async () => {
    await searchMemories("user-1", "beach");
    expect(state.rpcCalls).toHaveLength(1);
    const call = state.rpcCalls[0];
    expect(call.fn).toBe("match_memories");
    expect(call.args.p_user_id).toBe("user-1");
    expect(call.args.p_match_count).toBe(10);
    expect(call.args.p_kinds).toEqual([
      "media",
      "life_facts",
      "people",
      "events",
    ]);
    expect(Array.isArray(call.args.p_query_embedding)).toBe(true);
  });

  it("builds correct RPC call with custom limit and kinds", async () => {
    await searchMemories("user-2", "garden", {
      limit: 3,
      kinds: ["media", "people"],
    });
    expect(state.rpcCalls).toHaveLength(1);
    expect(state.rpcCalls[0].args.p_match_count).toBe(3);
    expect(state.rpcCalls[0].args.p_kinds).toEqual(["media", "people"]);
  });

  it("returns [] gracefully when RPC returns null", async () => {
    state.rpcResult = { data: null, error: null };
    const out = await searchMemories("user-3", "anything");
    expect(out).toEqual([]);
  });

  it("returns [] gracefully when RPC returns an error", async () => {
    state.rpcResult = { data: null, error: { message: "rpc error" } };
    const out = await searchMemories("user-3", "anything");
    expect(out).toEqual([]);
  });

  it("returns [] when the embed call itself fails", async () => {
    state.invokeImpl = async () => ({
      data: null,
      error: { message: "embed boom" },
    });
    const out = await searchMemories("user-3", "anything");
    expect(out).toEqual([]);
    // RPC should never have been called.
    expect(state.rpcCalls).toHaveLength(0);
  });

  it("maps RPC rows to the MemoryMatch type", async () => {
    state.rpcResult = {
      data: [
        {
          kind: "media",
          id: "m1",
          text_snippet: "beach photo",
          similarity: 0.88,
          metadata: { file_url: "https://x/y.jpg", taken_at: null, ai_tags: ["beach"] },
        },
        {
          kind: "people",
          id: "p1",
          text_snippet: "Sarah (daughter)",
          similarity: 0.75,
          metadata: { relationship: "daughter" },
        },
      ],
      error: null,
    };

    const out = await searchMemories("user-4", "who was at the beach");
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({
      kind: "media",
      id: "m1",
      text_snippet: "beach photo",
      similarity: 0.88,
      metadata: { file_url: "https://x/y.jpg", taken_at: null, ai_tags: ["beach"] },
    });
    expect(out[1].kind).toBe("people");
    expect(out[1].id).toBe("p1");
    expect(out[1].text_snippet).toBe("Sarah (daughter)");
  });
});
