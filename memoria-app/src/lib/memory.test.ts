// Unit tests for the persistent assistant memory client (Phase D).
//
// Mirrors the mocking pattern in `sensitivity.test.ts`: a chainable
// stand-in for the Supabase query builder records what calls happened
// so we can assert against them. We do NOT exercise the database here —
// integration coverage lives in tests/integration/memory.test.ts.

import { beforeEach, describe, expect, it, vi } from "vitest";

interface QueryRecord {
  table: string;
  selects: string[];
  filters: Array<{ op: string; col: string; val: unknown }>;
  orders: Array<{ col: string; opts: any }>;
  limitArg?: number;
  inserted?: unknown;
  updated?: unknown;
  deleted: boolean;
}

interface MockState {
  queries: QueryRecord[];
  // The next query result returned by .single() (insert/update path).
  nextSingleData: unknown;
  // The next query result returned when the chain is awaited terminally.
  nextResult: { data: unknown; error: unknown };
}

const state: MockState = {
  queries: [],
  nextSingleData: null,
  nextResult: { data: [], error: null },
};

function makeChain(table: string): any {
  const rec: QueryRecord = {
    table,
    selects: [],
    filters: [],
    orders: [],
    deleted: false,
  };
  state.queries.push(rec);

  const chain: any = {
    select: (cols: string) => {
      rec.selects.push(cols);
      return chain;
    },
    eq: (col: string, val: unknown) => {
      rec.filters.push({ op: "eq", col, val });
      return chain;
    },
    neq: (col: string, val: unknown) => {
      rec.filters.push({ op: "neq", col, val });
      return chain;
    },
    in: (col: string, val: unknown) => {
      rec.filters.push({ op: "in", col, val });
      return chain;
    },
    ilike: (col: string, val: unknown) => {
      rec.filters.push({ op: "ilike", col, val });
      return chain;
    },
    order: (col: string, opts: any) => {
      rec.orders.push({ col, opts });
      return chain;
    },
    limit: (n: number) => {
      rec.limitArg = n;
      return Promise.resolve(state.nextResult);
    },
    insert: (values: unknown) => {
      rec.inserted = values;
      return chain;
    },
    update: (values: unknown) => {
      rec.updated = values;
      return chain;
    },
    delete: () => {
      rec.deleted = true;
      return chain;
    },
    single: () =>
      Promise.resolve({
        data: state.nextSingleData,
        error: (state.nextResult as any).error,
      }),
    then: (onF: any, onR: any) =>
      Promise.resolve(state.nextResult).then(onF, onR),
  };
  return chain;
}

vi.mock("./supabase", () => ({
  supabase: {
    from: (table: string) => makeChain(table),
  },
}));

import {
  rememberAboutUser,
  recallAboutUser,
  listMemoriesForCoUser,
  updateMemoryStatus,
  deleteMemory,
} from "./memory";

beforeEach(() => {
  state.queries = [];
  state.nextSingleData = null;
  state.nextResult = { data: [], error: null };
});

// ─── rememberAboutUser ──────────────────────────────────────────────

describe("rememberAboutUser", () => {
  it("inserts the expected row and returns the new id", async () => {
    state.nextSingleData = { id: "mem-1" };
    const out = await rememberAboutUser(
      "user-1",
      "preference",
      "loves rain",
      3,
      "msg-1",
      "conv-1"
    );
    expect(out).toEqual({ id: "mem-1" });

    // First query is the assistant_memory insert.
    const q = state.queries[0];
    expect(q.table).toBe("assistant_memory");
    const row = q.inserted as Record<string, unknown>;
    expect(row.user_id).toBe("user-1");
    expect(row.kind).toBe("preference");
    expect(row.content).toBe("loves rain");
    expect(row.importance).toBe(3);
    expect(row.source_message_id).toBe("msg-1");
    expect(row.source_conversation_id).toBe("conv-1");
    // Preferences never expire.
    expect(row.expires_at).toBeNull();
  });

  it("clamps out-of-range importance into [1,5]", async () => {
    state.nextSingleData = { id: "mem-2" };
    await rememberAboutUser("user-1", "observation", "noticed thing", 99);
    const row = state.queries[0].inserted as Record<string, unknown>;
    expect(row.importance).toBe(5);

    state.queries = [];
    state.nextSingleData = { id: "mem-3" };
    await rememberAboutUser("user-1", "observation", "noticed thing", 0);
    const row2 = state.queries[0].inserted as Record<string, unknown>;
    expect(row2.importance).toBe(1);
  });

  it("inserts a flag_queue row when importance >= 4", async () => {
    state.nextSingleData = { id: "mem-flag" };
    const out = await rememberAboutUser(
      "user-1",
      "factual_correction",
      "spouse name is Marcia not Maria",
      5
    );
    expect(out).toEqual({ id: "mem-flag" });
    // Wait a microtask for the fire-and-forget flag insert to land.
    await new Promise((r) => setTimeout(r, 0));

    const flagQuery = state.queries.find((q) => q.table === "flag_queue");
    expect(flagQuery).toBeTruthy();
    const flag = flagQuery!.inserted as Record<string, unknown>;
    expect(flag.user_id).toBe("user-1");
    expect(flag.flag_type).toBe("journal");
    expect(flag.reference_id).toBe("mem-flag");
    expect(String(flag.description)).toContain(
      "Memory to review: spouse name is Marcia not Maria"
    );
  });

  it("does NOT insert a flag_queue row when importance < 4", async () => {
    state.nextSingleData = { id: "mem-low" };
    await rememberAboutUser("user-1", "observation", "low value note", 2);
    await new Promise((r) => setTimeout(r, 0));
    expect(state.queries.find((q) => q.table === "flag_queue")).toBeUndefined();
  });

  it("sets expires_at correctly per kind", async () => {
    const cases: Array<{ kind: any; days: number | null }> = [
      { kind: "observation", days: 30 },
      { kind: "emotional_state", days: 7 },
      { kind: "recurring_question", days: 90 },
      { kind: "preference", days: null },
      { kind: "factual_correction", days: null },
    ];
    for (const { kind, days } of cases) {
      state.queries = [];
      state.nextSingleData = { id: "mem-x" };
      const before = Date.now();
      await rememberAboutUser("user-1", kind, "x", 3);
      const after = Date.now();

      const row = state.queries[0].inserted as Record<string, unknown>;
      if (days === null) {
        expect(row.expires_at).toBeNull();
      } else {
        const ts = new Date(row.expires_at as string).getTime();
        const min = before + days * 24 * 60 * 60 * 1000;
        const max = after + days * 24 * 60 * 60 * 1000;
        expect(ts).toBeGreaterThanOrEqual(min);
        expect(ts).toBeLessThanOrEqual(max);
      }
    }
  });

  it("returns { error } when the insert fails", async () => {
    state.nextResult = { data: null, error: { message: "db down" } };
    const out = await rememberAboutUser(
      "user-1",
      "observation",
      "x",
      2
    );
    expect(out).toEqual({ error: "db down" });
  });

  it("returns { error } when content is blank", async () => {
    const out = await rememberAboutUser("user-1", "preference", "   ", 3);
    expect("error" in out).toBe(true);
    expect(state.queries).toHaveLength(0);
  });
});

// ─── recallAboutUser ────────────────────────────────────────────────

describe("recallAboutUser", () => {
  it("queries the active memories ordered by status, importance, recency", async () => {
    state.nextResult = {
      data: [
        { id: "m1", kind: "preference", content: "loves rain", importance: 3 },
      ],
      error: null,
    };
    const out = await recallAboutUser("user-1");
    expect(out).toHaveLength(1);

    const q = state.queries[0];
    expect(q.table).toBe("assistant_memory");
    expect(q.filters).toContainEqual({ op: "eq", col: "user_id", val: "user-1" });
    expect(q.filters).toContainEqual({ op: "neq", col: "status", val: "suppressed" });
    // pinned should sort first (alphabetical via ascending: pinned < active)
    expect(q.orders[0]).toEqual({ col: "status", opts: { ascending: true } });
    expect(q.orders[1]).toEqual({
      col: "importance",
      opts: { ascending: false },
    });
    expect(q.orders[2]).toEqual({
      col: "created_at",
      opts: { ascending: false },
    });
    expect(q.limitArg).toBe(5);
  });

  it("uses ILIKE substring match when topic is provided", async () => {
    state.nextResult = { data: [], error: null };
    await recallAboutUser("user-1", { topic: "garden" });
    const q = state.queries[0];
    expect(q.filters).toContainEqual({
      op: "ilike",
      col: "content",
      val: "%garden%",
    });
  });

  it("filters by kinds when provided", async () => {
    state.nextResult = { data: [], error: null };
    await recallAboutUser("user-1", { kinds: ["preference", "observation"] });
    const q = state.queries[0];
    expect(q.filters).toContainEqual({
      op: "in",
      col: "kind",
      val: ["preference", "observation"],
    });
  });

  it("returns [] gracefully on error (and warns)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    state.nextResult = { data: null, error: { message: "boom" } };
    const out = await recallAboutUser("user-1");
    expect(out).toEqual([]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

// ─── listMemoriesForCoUser ──────────────────────────────────────────

describe("listMemoriesForCoUser", () => {
  it("does NOT exclude suppressed rows (full inspector view)", async () => {
    state.nextResult = {
      data: [
        { id: "m1", status: "active" },
        { id: "m2", status: "suppressed" },
      ],
      error: null,
    };
    const out = await listMemoriesForCoUser("user-1");
    expect(out).toHaveLength(2);

    const q = state.queries[0];
    expect(q.filters).toContainEqual({ op: "eq", col: "user_id", val: "user-1" });
    // Crucially, no `neq status suppressed` filter.
    expect(
      q.filters.find((f) => f.op === "neq" && f.col === "status")
    ).toBeUndefined();
  });

  it("returns [] gracefully on error", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    state.nextResult = { data: null, error: { message: "fail" } };
    const out = await listMemoriesForCoUser("user-1");
    expect(out).toEqual([]);
    warn.mockRestore();
  });
});

// ─── updateMemoryStatus ─────────────────────────────────────────────

describe("updateMemoryStatus", () => {
  it("issues an update with the new status and reviewed_by_couser=true", async () => {
    state.nextResult = { data: null, error: null };
    const out = await updateMemoryStatus("mem-1", "pinned");
    expect(out).toEqual({ ok: true });
    const q = state.queries[0];
    expect(q.table).toBe("assistant_memory");
    expect(q.updated).toEqual({ status: "pinned", reviewed_by_couser: true });
    expect(q.filters).toContainEqual({ op: "eq", col: "id", val: "mem-1" });
  });

  it("returns ok:false on error", async () => {
    state.nextResult = { data: null, error: { message: "no" } };
    const out = await updateMemoryStatus("mem-1", "suppressed");
    expect(out).toEqual({ ok: false, error: "no" });
  });
});

// ─── deleteMemory ───────────────────────────────────────────────────

describe("deleteMemory", () => {
  it("deletes the row by id", async () => {
    state.nextResult = { data: null, error: null };
    const out = await deleteMemory("mem-1");
    expect(out).toEqual({ ok: true });
    const q = state.queries[0];
    expect(q.table).toBe("assistant_memory");
    expect(q.deleted).toBe(true);
    expect(q.filters).toContainEqual({ op: "eq", col: "id", val: "mem-1" });
  });

  it("returns ok:false on error", async () => {
    state.nextResult = { data: null, error: { message: "nope" } };
    const out = await deleteMemory("mem-1");
    expect(out).toEqual({ ok: false, error: "nope" });
  });
});
