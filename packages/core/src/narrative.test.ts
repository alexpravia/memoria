// Unit tests for the narrative ("Write About Them") client lib.
// Mocks Supabase using the same pattern as embeddings.test.ts.

import { beforeEach, describe, expect, it } from "vitest";
import { vi } from "vitest";

interface MockState {
  selectResult: { data: unknown; error: { message: string } | null };
  invokeResult: { data: unknown; error: { message: string } | null };
  invokeCalls: Array<{ fn: string; body: unknown }>;
}

const state: MockState = {
  selectResult: { data: null, error: null },
  invokeResult: { data: null, error: null },
  invokeCalls: [],
};

vi.mock("./supabase", () => ({
  supabase: {
    from: (_table: string) => ({
      select: (_cols: string) => ({
        eq: (_col: string, _val: unknown) => ({
          maybeSingle: () => Promise.resolve(state.selectResult),
        }),
      }),
    }),
    functions: {
      invoke: (fn: string, opts: { body: unknown }) => {
        state.invokeCalls.push({ fn, body: opts.body });
        return Promise.resolve(state.invokeResult);
      },
    },
  },
}));

import { getNarrative, saveNarrative } from "./narrative";

beforeEach(() => {
  state.selectResult = { data: null, error: null };
  state.invokeResult = { data: null, error: null };
  state.invokeCalls = [];
});

describe("getNarrative", () => {
  it("returns the stored raw_text when present", async () => {
    state.selectResult = { data: { raw_text: "Mom loves gardening." }, error: null };
    expect(await getNarrative("user-1")).toBe("Mom loves gardening.");
  });

  it("returns empty string when there is no narrative row", async () => {
    state.selectResult = { data: null, error: null };
    expect(await getNarrative("user-1")).toBe("");
  });

  it("returns empty string (does not throw) on error", async () => {
    state.selectResult = { data: null, error: { message: "db down" } };
    expect(await getNarrative("user-1")).toBe("");
  });
});

describe("saveNarrative", () => {
  it("passes user_id + raw_text to the Edge Function", async () => {
    state.invokeResult = {
      data: { ok: true, chunk_count: 3, suggestions: { people: [], life_facts: [], events: [], sensitivity_hints: [] } },
      error: null,
    };
    await saveNarrative("user-9", "some prose");
    expect(state.invokeCalls).toHaveLength(1);
    expect(state.invokeCalls[0].fn).toBe("process-narrative");
    expect(state.invokeCalls[0].body).toEqual({
      user_id: "user-9",
      raw_text: "some prose",
    });
  });

  it("returns the suggestions envelope on success", async () => {
    state.invokeResult = {
      data: {
        ok: true,
        chunk_count: 2,
        suggestions: {
          people: [{ name: "Maria", relationship: "daughter", notes: null }],
          life_facts: [],
          events: [],
          sensitivity_hints: [],
        },
      },
      error: null,
    };
    const res = await saveNarrative("user-1", "Maria is my daughter.");
    expect(res.ok).toBe(true);
    expect(res.chunkCount).toBe(2);
    expect(res.suggestions?.people[0].name).toBe("Maria");
  });

  it("returns {ok:false} (does not throw) when the function errors", async () => {
    state.invokeResult = { data: null, error: { message: "boom" } };
    const res = await saveNarrative("user-1", "text");
    expect(res.ok).toBe(false);
    expect(res.error).toContain("boom");
  });

  it("returns {ok:false} when the function payload carries an error", async () => {
    state.invokeResult = { data: { error: "bad input" }, error: null };
    const res = await saveNarrative("user-1", "text");
    expect(res.ok).toBe(false);
    expect(res.error).toContain("bad input");
  });
});
