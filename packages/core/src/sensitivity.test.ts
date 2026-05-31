// Unit tests for the sensitivity classifier client.
//
// Mocks the Supabase client AND the `check-sensitivity` Edge Function so
// these tests verify the LIB CODE (batching, caching, fail-open, hash
// stability) — NOT the LLM's classification quality. Quality is covered
// by `tests/evals/sensitivity-judgment.eval.json`.

import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mock state ─────────────────────────────────────────────────────

interface UpsertCall {
  table: string;
  rows: Array<Record<string, unknown>>;
  options: Record<string, unknown> | undefined;
}

interface InvokeCall {
  fn: string;
  body: unknown;
}

interface MockState {
  // Tables holding rows the next read query will return.
  tables: Record<string, Array<Record<string, unknown>>>;
  upsertCalls: UpsertCall[];
  upsertError: { message: string } | null;
  invokeCalls: InvokeCall[];
  invokeImpl: (
    fn: string,
    body: unknown
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
}

const state: MockState = {
  tables: {},
  upsertCalls: [],
  upsertError: null,
  invokeCalls: [],
  invokeImpl: async () => ({ data: { decisions: [] }, error: null }),
};

// A chainable "select query" builder. Each call returns `this` until a
// terminal awaits the chain (PromiseLike) or `.maybeSingle()` runs.
interface SelectChain extends PromiseLike<{ data: unknown; error: null }> {
  eq: (col: string, val: unknown) => SelectChain;
  in: (col: string, val: unknown) => SelectChain;
  order: (...args: unknown[]) => SelectChain;
  limit: (...args: unknown[]) => SelectChain;
  maybeSingle: () => Promise<{ data: unknown; error: null }>;
  single: () => Promise<{ data: unknown; error: null }>;
}

interface FilterSpec {
  column: string;
  value: unknown;
  op: "eq" | "in";
}

function makeSelectChain(table: string): SelectChain {
  const filters: FilterSpec[] = [];

  const apply = (): Array<Record<string, unknown>> => {
    let rows = state.tables[table] ?? [];
    for (const f of filters) {
      if (f.op === "eq") {
        rows = rows.filter((r) => r[f.column] === f.value);
      } else if (f.op === "in") {
        const set = new Set(f.value as unknown[]);
        rows = rows.filter((r) => set.has(r[f.column]));
      }
    }
    return rows;
  };

  const chain: SelectChain = {
    eq: (col: string, val: unknown) => {
      filters.push({ column: col, value: val, op: "eq" });
      return chain;
    },
    in: (col: string, val: unknown) => {
      filters.push({ column: col, value: val, op: "in" });
      return chain;
    },
    order: () => chain,
    limit: () => chain,
    maybeSingle: () =>
      Promise.resolve({ data: apply()[0] ?? null, error: null }),
    single: () =>
      Promise.resolve({ data: apply()[0] ?? null, error: null }),
    then: (onFulfilled, onRejected) =>
      Promise.resolve({ data: apply(), error: null }).then(
        onFulfilled,
        onRejected
      ),
  };
  return chain;
}

vi.mock("./supabase", () => ({
  supabase: {
    from: (table: string) => ({
      select: (_cols?: string) => makeSelectChain(table),
      upsert: (
        rows: Array<Record<string, unknown>>,
        options?: Record<string, unknown>
      ) => {
        state.upsertCalls.push({ table, rows, options });
        return Promise.resolve({ data: rows, error: state.upsertError });
      },
    }),
    functions: {
      invoke: (fn: string, opts: { body: unknown }) => {
        state.invokeCalls.push({ fn, body: opts.body });
        return state.invokeImpl(fn, opts.body);
      },
    },
  },
}));

// Import AFTER the mock is registered.
import {
  classifyItems,
  getOrClassify,
  isAllowed,
  ruleSetHash,
  type SensitivityRule,
  type SensitivityItem,
} from "./sensitivity";

beforeEach(() => {
  state.tables = {};
  state.upsertCalls = [];
  state.upsertError = null;
  state.invokeCalls = [];
  state.invokeImpl = async () => ({ data: { decisions: [] }, error: null });
});

// ─── Test fixtures ──────────────────────────────────────────────────

const RULE_A: SensitivityRule = {
  id: "rule-a",
  filter_type: "intent",
  intent_text: "avoid the hospital",
};
const RULE_B: SensitivityRule = {
  id: "rule-b",
  filter_type: "intent",
  intent_text: "avoid Mom's death",
};
const RULE_C: SensitivityRule = {
  id: "rule-c",
  filter_type: "topic",
  filter_value: "divorce",
};

// ─── ruleSetHash ────────────────────────────────────────────────────

describe("ruleSetHash", () => {
  it("is stable for the same rules in different orders", () => {
    const h1 = ruleSetHash([RULE_A, RULE_B, RULE_C]);
    const h2 = ruleSetHash([RULE_C, RULE_A, RULE_B]);
    const h3 = ruleSetHash([RULE_B, RULE_C, RULE_A]);
    expect(h1).toBe(h2);
    expect(h2).toBe(h3);
  });

  it("changes when a rule's intent_text changes", () => {
    const before = ruleSetHash([RULE_A, RULE_B]);
    const after = ruleSetHash([
      { ...RULE_A, intent_text: "avoid the doctor's office" },
      RULE_B,
    ]);
    expect(before).not.toBe(after);
  });

  it("changes when a rule is added or removed", () => {
    const a = ruleSetHash([RULE_A]);
    const b = ruleSetHash([RULE_A, RULE_B]);
    expect(a).not.toBe(b);
  });

  it("returns a stable sentinel for empty rule sets", () => {
    expect(ruleSetHash([])).toBe(ruleSetHash([]));
  });
});

// ─── classifyItems ──────────────────────────────────────────────────

describe("classifyItems", () => {
  it("returns an empty map and skips invoke when items is empty", async () => {
    const out = await classifyItems("user-1", [], [RULE_A]);
    expect(out.size).toBe(0);
    expect(state.invokeCalls).toHaveLength(0);
  });

  it("batches items into requests of at most 50", async () => {
    const items: SensitivityItem[] = Array.from({ length: 73 }, (_, i) => ({
      id: `item-${i}`,
      kind: "media",
      text: `text ${i}`,
    }));

    state.invokeImpl = async (_fn, body) => {
      const reqItems = (body as { items: Array<{ id: string }> }).items;
      // Each request must respect the 50-item cap.
      expect(reqItems.length).toBeLessThanOrEqual(50);
      return {
        data: {
          decisions: reqItems.map((it) => ({ id: it.id, allow: true })),
        },
        error: null,
      };
    };

    const out = await classifyItems("user-1", items, [RULE_A]);
    expect(state.invokeCalls).toHaveLength(2); // 50 + 23
    expect(out.size).toBe(73);
    for (const it of items) {
      expect(out.get(it.id)?.allow).toBe(true);
    }
  });

  it("persists decisions to sensitivity_decisions with the correct rule_set_hash", async () => {
    const items: SensitivityItem[] = [
      { id: "i1", kind: "media", text: "ER visit" },
      { id: "i2", kind: "life_facts", text: "loves gardening" },
    ];
    state.invokeImpl = async () => ({
      data: {
        decisions: [
          { id: "i1", allow: false, blocked_by_rule_id: "rule-a", reason: "hospital reference" },
          { id: "i2", allow: true },
        ],
      },
      error: null,
    });

    const out = await classifyItems("user-1", items, [RULE_A]);
    expect(out.get("i1")).toEqual({
      allow: false,
      blocked_by_rule_id: "rule-a",
      reason: "hospital reference",
    });
    expect(out.get("i2")).toEqual({ allow: true });

    expect(state.upsertCalls).toHaveLength(1);
    const call = state.upsertCalls[0];
    expect(call.table).toBe("sensitivity_decisions");
    expect(call.rows).toHaveLength(2);
    const expectedHash = ruleSetHash([RULE_A]);
    for (const row of call.rows) {
      expect(row.user_id).toBe("user-1");
      expect(row.rule_set_hash).toBe(expectedHash);
    }
    const r1 = call.rows.find((r) => r.item_id === "i1")!;
    expect(r1.allow).toBe(false);
    expect(r1.blocked_by_rule_id).toBe("rule-a");
    expect(r1.item_kind).toBe("media");
    const r2 = call.rows.find((r) => r.item_id === "i2")!;
    expect(r2.allow).toBe(true);
    expect(r2.blocked_by_rule_id).toBeNull();
    expect(call.options).toEqual({
      onConflict: "user_id,item_kind,item_id,rule_set_hash",
    });
  });

  it("returns an empty map and logs when classifier returns malformed JSON", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    state.invokeImpl = async () => ({
      data: "this is not valid json {{{",
      error: null,
    });

    const out = await classifyItems(
      "user-1",
      [{ id: "i1", kind: "media", text: "x" }],
      [RULE_A]
    );
    expect(out.size).toBe(0);
    expect(state.upsertCalls).toHaveLength(0);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("returns an empty map when the edge function errors", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    state.invokeImpl = async () => ({ data: null, error: { message: "boom" } });
    const out = await classifyItems(
      "user-1",
      [{ id: "i1", kind: "media", text: "x" }],
      [RULE_A]
    );
    expect(out.size).toBe(0);
    expect(state.upsertCalls).toHaveLength(0);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

// ─── getOrClassify ──────────────────────────────────────────────────

describe("getOrClassify", () => {
  it("skips items already in cache (with matching rule_set_hash)", async () => {
    const items: SensitivityItem[] = [
      { id: "i1", kind: "media", text: "x" },
      { id: "i2", kind: "media", text: "y" },
    ];
    const hash = ruleSetHash([RULE_A]);
    state.tables.sensitivity_decisions = [
      {
        user_id: "user-1",
        item_id: "i1",
        item_kind: "media",
        rule_set_hash: hash,
        allow: false,
        blocked_by_rule_id: "rule-a",
        reason: "cached block",
      },
      {
        user_id: "user-1",
        item_id: "i2",
        item_kind: "media",
        rule_set_hash: hash,
        allow: true,
        blocked_by_rule_id: null,
        reason: null,
      },
    ];

    const out = await getOrClassify("user-1", items, [RULE_A]);
    expect(state.invokeCalls).toHaveLength(0); // entirely from cache
    expect(out.get("i1")).toEqual({
      allow: false,
      blocked_by_rule_id: "rule-a",
      reason: "cached block",
    });
    expect(out.get("i2")).toEqual({ allow: true });
  });

  it("re-classifies when rule_set_hash differs", async () => {
    const items: SensitivityItem[] = [{ id: "i1", kind: "media", text: "x" }];
    state.tables.sensitivity_decisions = [
      {
        user_id: "user-1",
        item_id: "i1",
        item_kind: "media",
        rule_set_hash: "stale-hash-from-old-rules",
        allow: false,
        blocked_by_rule_id: null,
        reason: null,
      },
    ];

    state.invokeImpl = async () => ({
      data: { decisions: [{ id: "i1", allow: true }] },
      error: null,
    });

    const out = await getOrClassify("user-1", items, [RULE_A]);
    expect(state.invokeCalls).toHaveLength(1);
    expect(out.get("i1")?.allow).toBe(true);
  });

  it("only classifies missing items, mixing cache + fresh results", async () => {
    const items: SensitivityItem[] = [
      { id: "cached", kind: "media", text: "x" },
      { id: "fresh", kind: "media", text: "y" },
    ];
    const hash = ruleSetHash([RULE_A]);
    state.tables.sensitivity_decisions = [
      {
        user_id: "user-1",
        item_id: "cached",
        item_kind: "media",
        rule_set_hash: hash,
        allow: true,
        blocked_by_rule_id: null,
        reason: null,
      },
    ];

    state.invokeImpl = async (_fn, body) => {
      const reqItems = (body as { items: Array<{ id: string }> }).items;
      expect(reqItems).toHaveLength(1);
      expect(reqItems[0].id).toBe("fresh");
      return {
        data: { decisions: [{ id: "fresh", allow: false, blocked_by_rule_id: "rule-a" }] },
        error: null,
      };
    };

    const out = await getOrClassify("user-1", items, [RULE_A]);
    expect(out.get("cached")?.allow).toBe(true);
    expect(out.get("fresh")?.allow).toBe(false);
  });
});

// ─── isAllowed ──────────────────────────────────────────────────────

describe("isAllowed", () => {
  it("returns true when the user has no rules (fail-open)", async () => {
    state.tables.sensitivity_filters = [];
    const ok = await isAllowed("user-1", "media", "item-1");
    expect(ok).toBe(true);
  });

  it("returns true (with warning) when no decision exists for the item", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    state.tables.sensitivity_filters = [
      {
        user_id: "user-1",
        id: RULE_A.id,
        filter_type: RULE_A.filter_type,
        intent_text: RULE_A.intent_text,
        filter_value: null,
        person_id: null,
        start_date: null,
        end_date: null,
      },
    ];
    state.tables.sensitivity_decisions = []; // no decision for item-1
    const ok = await isAllowed("user-1", "media", "item-1");
    expect(ok).toBe(true);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("returns false when the cached decision says block", async () => {
    state.tables.sensitivity_filters = [
      {
        user_id: "user-1",
        id: RULE_A.id,
        filter_type: RULE_A.filter_type,
        intent_text: RULE_A.intent_text,
        filter_value: null,
        person_id: null,
        start_date: null,
        end_date: null,
      },
    ];
    const hash = ruleSetHash([RULE_A]);
    state.tables.sensitivity_decisions = [
      {
        user_id: "user-1",
        item_kind: "media",
        item_id: "item-1",
        rule_set_hash: hash,
        allow: false,
      },
    ];
    const ok = await isAllowed("user-1", "media", "item-1");
    expect(ok).toBe(false);
  });

  it("returns true when the cached decision says allow", async () => {
    state.tables.sensitivity_filters = [
      {
        user_id: "user-1",
        id: RULE_A.id,
        filter_type: RULE_A.filter_type,
        intent_text: RULE_A.intent_text,
        filter_value: null,
        person_id: null,
        start_date: null,
        end_date: null,
      },
    ];
    const hash = ruleSetHash([RULE_A]);
    state.tables.sensitivity_decisions = [
      {
        user_id: "user-1",
        item_kind: "media",
        item_id: "item-1",
        rule_set_hash: hash,
        allow: true,
      },
    ];
    const ok = await isAllowed("user-1", "media", "item-1");
    expect(ok).toBe(true);
  });
});
