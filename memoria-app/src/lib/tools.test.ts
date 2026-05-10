// Phase B unit tests for tool definitions and handlers.
//
// Goals:
//   1. Validate the shape of every TOOL_DEFINITION (JSON-Schema basics).
//   2. Confirm there is a TOOL_HANDLERS entry for every tool name.
//   3. Drive each handler with a mocked Supabase client and confirm it
//      builds the right query / returns the expected envelope.
//   4. Confirm `search_memories` and `get_life_facts(topic)` go through
//      `searchMemories` from `./embeddings` (mocked here).

import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mock embeddings.ts + memory.ts BEFORE importing tools.ts ───────
const searchMemoriesMock = vi.fn();
vi.mock("./embeddings", () => ({
  searchMemories: (...args: unknown[]) => searchMemoriesMock(...args),
}));

// Phase D wired the real memory client into the `remember_about_user`
// and `recall_about_user` handlers. Memory-specific behaviour is
// covered in `memory.test.ts`; here we just mock the lib so the tool
// handlers can be exercised in isolation.
const rememberAboutUserMock = vi.fn();
const recallAboutUserMock = vi.fn();
vi.mock("./memory", () => ({
  rememberAboutUser: (...args: unknown[]) => rememberAboutUserMock(...args),
  recallAboutUser: (...args: unknown[]) => recallAboutUserMock(...args),
}));

import { TOOL_DEFINITIONS, TOOL_HANDLERS, type ToolHandlerContext } from "./tools";

// ─── Tiny Supabase chain mock used for direct-table handlers ────────
interface QueryRecord {
  table: string;
  selects: string[];
  filters: Array<{ op: string; col: string; val: unknown }>;
  orderArgs?: { col: string; opts: any };
  limitArg?: number;
  result: { data: unknown; error: unknown };
  inserted?: unknown;
  singleData?: unknown;
}

let lastQuery: QueryRecord | null = null;
let nextResult: { data: unknown; error: unknown } = { data: [], error: null };
let nextSingleData: unknown = null;

function makeChain(table: string): any {
  const rec: QueryRecord = {
    table,
    selects: [],
    filters: [],
    result: nextResult,
  };
  lastQuery = rec;

  const chain: any = {
    select: (cols: string) => {
      rec.selects.push(cols);
      return chain;
    },
    eq: (col: string, val: unknown) => {
      rec.filters.push({ op: "eq", col, val });
      return chain;
    },
    ilike: (col: string, val: unknown) => {
      rec.filters.push({ op: "ilike", col, val });
      return chain;
    },
    gte: (col: string, val: unknown) => {
      rec.filters.push({ op: "gte", col, val });
      return chain;
    },
    lte: (col: string, val: unknown) => {
      rec.filters.push({ op: "lte", col, val });
      return chain;
    },
    in: (col: string, val: unknown) => {
      rec.filters.push({ op: "in", col, val });
      return chain;
    },
    order: (col: string, opts: any) => {
      rec.orderArgs = { col, opts };
      return chain;
    },
    limit: (n: number) => {
      rec.limitArg = n;
      return Promise.resolve(rec.result);
    },
    insert: (values: unknown) => {
      rec.inserted = values;
      return chain;
    },
    single: () =>
      Promise.resolve({
        data: nextSingleData,
        error: rec.result.error,
      }),
    then: (onF: any, onR: any) =>
      Promise.resolve(rec.result).then(onF, onR),
  };
  return chain;
}

function makeCtx(): ToolHandlerContext {
  return {
    userId: "user-1",
    supabase: { from: (table: string) => makeChain(table) },
  };
}

beforeEach(() => {
  searchMemoriesMock.mockReset();
  rememberAboutUserMock.mockReset();
  recallAboutUserMock.mockReset();
  lastQuery = null;
  nextResult = { data: [], error: null };
  nextSingleData = null;
});

// ─── 1. TOOL_DEFINITIONS shape ──────────────────────────────────────
describe("TOOL_DEFINITIONS", () => {
  it("has at least one tool", () => {
    expect(TOOL_DEFINITIONS.length).toBeGreaterThan(0);
  });

  it("every entry is a valid JSON-schema-shaped tool", () => {
    for (const def of TOOL_DEFINITIONS) {
      expect(typeof def.name).toBe("string");
      expect(def.name.length).toBeGreaterThan(0);
      expect(typeof def.description).toBe("string");
      expect(def.description.length).toBeGreaterThan(0);
      expect(typeof def.parameters).toBe("object");
      expect((def.parameters as any).type).toBe("object");
      expect(typeof (def.parameters as any).properties).toBe("object");
      const required = (def.parameters as any).required;
      if (required !== undefined) {
        expect(Array.isArray(required)).toBe(true);
        for (const key of required) {
          expect((def.parameters as any).properties[key]).toBeDefined();
        }
      }
    }
  });

  it("includes the Phase B + D tool set", () => {
    const names = TOOL_DEFINITIONS.map((d) => d.name).sort();
    expect(names).toEqual(
      [
        "flag_for_co_user",
        "get_life_facts",
        "get_person",
        "get_user_profile",
        "list_events",
        "recall_about_user",
        "remember_about_user",
        "search_memories",
      ].sort()
    );
  });
});

describe("TOOL_HANDLERS coverage", () => {
  it("provides a handler for every defined tool", () => {
    for (const def of TOOL_DEFINITIONS) {
      expect(typeof TOOL_HANDLERS[def.name]).toBe("function");
    }
  });
});

// ─── 2. search_memories ─────────────────────────────────────────────
describe("search_memories handler", () => {
  it("calls searchMemories with the right args (default limit/kinds)", async () => {
    searchMemoriesMock.mockResolvedValueOnce([
      { kind: "media", id: "m1", text_snippet: "beach", similarity: 0.9, metadata: { file_url: "u" } },
    ]);
    const out = await TOOL_HANDLERS.search_memories({ query: "beach" }, makeCtx());
    expect(searchMemoriesMock).toHaveBeenCalledTimes(1);
    expect(searchMemoriesMock).toHaveBeenCalledWith("user-1", "beach", { limit: 5 });
    expect(out.results).toHaveLength(1);
  });

  it("respects custom kinds and limit (clamped to max 10)", async () => {
    searchMemoriesMock.mockResolvedValueOnce([]);
    await TOOL_HANDLERS.search_memories(
      { query: "garden", kinds: ["media"], limit: 99 },
      makeCtx()
    );
    expect(searchMemoriesMock).toHaveBeenCalledWith("user-1", "garden", {
      limit: 10,
      kinds: ["media"],
    });
  });

  it("returns { error } for empty query", async () => {
    const out = await TOOL_HANDLERS.search_memories({ query: "  " }, makeCtx());
    expect(out.error).toBeTruthy();
    expect(searchMemoriesMock).not.toHaveBeenCalled();
  });

  it("falls back to a single recent verified photo when caller omits limit", async () => {
    searchMemoriesMock.mockResolvedValueOnce([]);
    nextResult = {
      data: [
        { id: "m1", file_url: "u1", description: "d", taken_at: null, ai_tags: [] },
      ],
      error: null,
    };
    const out = await TOOL_HANDLERS.search_memories(
      { query: "show me a photo" },
      makeCtx()
    );
    expect(lastQuery!.table).toBe("media");
    expect(lastQuery!.filters).toContainEqual({
      op: "eq",
      col: "verification_status",
      val: "verified",
    });
    expect(lastQuery!.limitArg).toBe(1);
    expect(out.results).toHaveLength(1);
    expect(out.fallback).toBe("recent_verified");
  });

  it("honours an explicit caller limit on the fallback path", async () => {
    searchMemoriesMock.mockResolvedValueOnce([]);
    nextResult = {
      data: [
        { id: "m1", file_url: "u1", description: "", taken_at: null, ai_tags: [] },
        { id: "m2", file_url: "u2", description: "", taken_at: null, ai_tags: [] },
        { id: "m3", file_url: "u3", description: "", taken_at: null, ai_tags: [] },
      ],
      error: null,
    };
    await TOOL_HANDLERS.search_memories(
      { query: "photos", limit: 3 },
      makeCtx()
    );
    expect(lastQuery!.limitArg).toBe(3);
  });
});

// ─── 3. get_person ──────────────────────────────────────────────────
describe("get_person handler", () => {
  it("looks up by id when id is supplied", async () => {
    nextResult = { data: [{ id: "p1", full_name: "Sarah" }], error: null };
    const out = await TOOL_HANDLERS.get_person({ id: "p1" }, makeCtx());
    expect(lastQuery!.table).toBe("people");
    const filters = lastQuery!.filters;
    expect(filters).toContainEqual({ op: "eq", col: "user_id", val: "user-1" });
    expect(filters).toContainEqual({ op: "eq", col: "id", val: "p1" });
    expect(out.people).toEqual([{ id: "p1", full_name: "Sarah" }]);
  });

  it("falls back to ilike on full_name when only name is supplied", async () => {
    nextResult = { data: [{ id: "p2", full_name: "Maria" }], error: null };
    await TOOL_HANDLERS.get_person({ name: "maria" }, makeCtx());
    const filters = lastQuery!.filters;
    expect(filters).toContainEqual({ op: "ilike", col: "full_name", val: "%maria%" });
  });

  it("returns { error } when neither name nor id is supplied", async () => {
    const out = await TOOL_HANDLERS.get_person({}, makeCtx());
    expect(out.error).toBeTruthy();
  });
});

// ─── 4. list_events ─────────────────────────────────────────────────
describe("list_events handler", () => {
  it("applies date bounds and type filter and orders ascending", async () => {
    nextResult = { data: [{ id: "e1" }], error: null };
    await TOOL_HANDLERS.list_events(
      { from: "2026-05-01", to: "2026-05-31", type: "one_time", limit: 5 },
      makeCtx()
    );
    expect(lastQuery!.table).toBe("events");
    const filters = lastQuery!.filters;
    expect(filters).toContainEqual({ op: "eq", col: "user_id", val: "user-1" });
    expect(filters).toContainEqual({ op: "gte", col: "event_date", val: "2026-05-01" });
    expect(filters).toContainEqual({ op: "lte", col: "event_date", val: "2026-05-31" });
    expect(filters).toContainEqual({ op: "eq", col: "event_type", val: "one_time" });
    expect(lastQuery!.orderArgs).toEqual({
      col: "event_date",
      opts: { ascending: true },
    });
    expect(lastQuery!.limitArg).toBe(5);
  });

  it("works with no date bounds and clamps limit", async () => {
    nextResult = { data: [], error: null };
    await TOOL_HANDLERS.list_events({ limit: 999 }, makeCtx());
    expect(lastQuery!.limitArg).toBe(50);
  });
});

// ─── 5. get_life_facts ──────────────────────────────────────────────
describe("get_life_facts handler", () => {
  it("returns all facts when no topic", async () => {
    nextResult = { data: [{ id: "f1", fact: "loves jazz" }], error: null };
    const out = await TOOL_HANDLERS.get_life_facts({}, makeCtx());
    expect(searchMemoriesMock).not.toHaveBeenCalled();
    expect(lastQuery!.table).toBe("life_facts");
    expect(out.facts).toEqual([{ id: "f1", fact: "loves jazz" }]);
  });

  it("uses semantic search when topic is provided", async () => {
    searchMemoriesMock.mockResolvedValueOnce([
      { kind: "life_facts", id: "f2", text_snippet: "married 1972", similarity: 0.7, metadata: {} },
    ]);
    const out = await TOOL_HANDLERS.get_life_facts({ topic: "marriage" }, makeCtx());
    expect(searchMemoriesMock).toHaveBeenCalledWith("user-1", "marriage", {
      kinds: ["life_facts"],
      limit: 10,
    });
    expect(out.facts).toEqual([
      { id: "f2", fact: "married 1972", similarity: 0.7 },
    ]);
  });
});

// ─── 6. get_user_profile ────────────────────────────────────────────
describe("get_user_profile handler", () => {
  it("selects from users.single() with eq id", async () => {
    nextSingleData = {
      full_name: "Test",
      location: "NYC",
      date_of_birth: null,
      cognitive_level: 3,
    };
    const out = await TOOL_HANDLERS.get_user_profile({}, makeCtx());
    expect(lastQuery!.table).toBe("users");
    expect(lastQuery!.filters).toContainEqual({
      op: "eq",
      col: "id",
      val: "user-1",
    });
    expect(out.profile).toEqual(nextSingleData);
  });
});

// ─── 7. remember_about_user (Phase D real handler) ──────────────────
describe("remember_about_user handler", () => {
  it("delegates to rememberAboutUser and returns the new id envelope", async () => {
    rememberAboutUserMock.mockResolvedValueOnce({ id: "mem-1" });
    const out = await TOOL_HANDLERS.remember_about_user(
      { kind: "preference", content: "loves rain", importance: 3 },
      makeCtx()
    );
    expect(rememberAboutUserMock).toHaveBeenCalledWith(
      "user-1",
      "preference",
      "loves rain",
      3,
      undefined,
      undefined
    );
    expect(out).toEqual({ remembered: true, id: "mem-1" });
  });

  it("rejects unknown kind", async () => {
    const out = await TOOL_HANDLERS.remember_about_user(
      { kind: "mood", content: "ok", importance: 3 },
      makeCtx()
    );
    expect(out.error).toBeTruthy();
    expect(rememberAboutUserMock).not.toHaveBeenCalled();
  });

  it("propagates errors from rememberAboutUser", async () => {
    rememberAboutUserMock.mockResolvedValueOnce({ error: "db down" });
    const out = await TOOL_HANDLERS.remember_about_user(
      { kind: "observation", content: "felt tired today", importance: 2 },
      makeCtx()
    );
    expect(out.error).toBe("db down");
  });
});

// ─── 7b. recall_about_user (Phase D) ────────────────────────────────
describe("recall_about_user handler", () => {
  it("calls recallAboutUser with parsed opts", async () => {
    recallAboutUserMock.mockResolvedValueOnce([
      { id: "m1", kind: "preference", content: "loves rain", importance: 3 },
    ]);
    const out = await TOOL_HANDLERS.recall_about_user(
      { topic: "rain", limit: 3, kinds: ["preference"] },
      makeCtx()
    );
    expect(recallAboutUserMock).toHaveBeenCalledWith("user-1", {
      topic: "rain",
      limit: 3,
      kinds: ["preference"],
    });
    expect(Array.isArray(out.memories)).toBe(true);
    expect(out.memories).toHaveLength(1);
  });

  it("uses limit=5 default and omits empty topic", async () => {
    recallAboutUserMock.mockResolvedValueOnce([]);
    await TOOL_HANDLERS.recall_about_user({}, makeCtx());
    expect(recallAboutUserMock).toHaveBeenCalledWith("user-1", { limit: 5 });
  });
});

// ─── 8. flag_for_co_user ────────────────────────────────────────────
describe("flag_for_co_user handler", () => {
  it("inserts a flag_queue row and returns the queue id", async () => {
    nextSingleData = { id: "q1" };
    nextResult = { data: null, error: null };
    const out = await TOOL_HANDLERS.flag_for_co_user(
      { reason: "user sounds distressed", severity: "high" },
      makeCtx()
    );
    expect(lastQuery!.table).toBe("flag_queue");
    expect(lastQuery!.inserted).toMatchObject({
      user_id: "user-1",
      flag_type: "journal",
      reference_id: "user-1",
    });
    const description = (lastQuery!.inserted as any).description as string;
    expect(description).toContain("[severity:high]");
    expect(description).toContain("user sounds distressed");
    expect(out).toEqual({ flagged: true, queue_id: "q1", severity: "high" });
  });

  it("rejects empty reason", async () => {
    const out = await TOOL_HANDLERS.flag_for_co_user(
      { reason: "  ", severity: "low" },
      makeCtx()
    );
    expect(out.error).toBeTruthy();
    expect(lastQuery).toBeNull();
  });
});
