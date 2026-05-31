// Unit tests for the AI-orchestrated briefing client (Phase E).
//
// Mirrors the MockChain pattern in `memory.test.ts`: a chainable
// stand-in for the Supabase query builder records what was called so we
// can assert against it. We do NOT exercise the database here — that's
// covered by `tests/integration/generate-briefing.test.ts`.

import { beforeEach, describe, expect, it, vi } from "vitest";

interface QueryRecord {
  table: string;
  selects: string[];
  filters: Array<{ op: string; col: string; val: unknown }>;
  inserted?: unknown;
  updated?: unknown;
  deleted: boolean;
}

interface MockState {
  queries: QueryRecord[];
  // Per-call queue of single-row results (for chains that end in
  // .single() or .maybeSingle()).
  singleResults: Array<{ data: unknown; error: unknown }>;
  // Per-call queue of terminal-await results.
  results: Array<{ data: unknown; error: unknown }>;
  invokeCalls: Array<{ fn: string; body: unknown }>;
  invokeImpl: (
    fn: string,
    body: unknown
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
}

const state: MockState = {
  queries: [],
  singleResults: [],
  results: [],
  invokeCalls: [],
  invokeImpl: async () => ({ data: null, error: null }),
};

function nextResult(): { data: unknown; error: unknown } {
  return state.results.shift() ?? { data: [], error: null };
}

function nextSingle(): { data: unknown; error: unknown } {
  return state.singleResults.shift() ?? { data: null, error: null };
}

function makeChain(table: string): any {
  const rec: QueryRecord = {
    table,
    selects: [],
    filters: [],
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
    in: (col: string, val: unknown) => {
      rec.filters.push({ op: "in", col, val });
      return chain;
    },
    neq: (col: string, val: unknown) => {
      rec.filters.push({ op: "neq", col, val });
      return chain;
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
    maybeSingle: () => Promise.resolve(nextSingle()),
    single: () => Promise.resolve(nextSingle()),
    then: (onF: any, onR: any) => Promise.resolve(nextResult()).then(onF, onR),
  };
  return chain;
}

vi.mock("./supabase", () => ({
  supabase: {
    from: (table: string) => makeChain(table),
    functions: {
      invoke: (fn: string, opts: { body: unknown }) => {
        state.invokeCalls.push({ fn, body: opts.body });
        return state.invokeImpl(fn, opts.body);
      },
    },
  },
}));

import {
  validateSlide,
  validateBriefing,
  getTodaysBriefing,
  approveBriefing,
  updateSlide,
  reorderSlides,
  markDelivered,
  resolveSlidePhotos,
  generateBriefing,
  SLIDE_KINDS,
  type BriefingSlide,
  type SlideKind,
} from "./briefing";

beforeEach(() => {
  state.queries = [];
  state.singleResults = [];
  state.results = [];
  state.invokeCalls = [];
  state.invokeImpl = async () => ({ data: null, error: null });
});

function makeSlide(overrides: Partial<BriefingSlide> = {}): BriefingSlide {
  return {
    kind: "greeting",
    title: "Good morning",
    body: "It is Tuesday.",
    tts_text: "Good morning. Today is Tuesday.",
    ...overrides,
  };
}

// ─── validateSlide ──────────────────────────────────────────────────

describe("validateSlide", () => {
  it("accepts a well-formed slide for every SlideKind", () => {
    for (const kind of SLIDE_KINDS) {
      const r = validateSlide(makeSlide({ kind: kind as SlideKind }));
      expect(r.ok).toBe(true);
    }
  });

  it("rejects when kind is unknown", () => {
    const r = validateSlide(makeSlide({ kind: "wat" as any }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/unknown slide kind/);
  });

  it("rejects when title is missing", () => {
    const r = validateSlide({ ...makeSlide(), title: "" });
    expect(r.ok).toBe(false);
  });

  it("rejects when body is missing", () => {
    const r = validateSlide({ ...makeSlide(), body: "   " });
    expect(r.ok).toBe(false);
  });

  it("rejects when tts_text is missing", () => {
    const r = validateSlide({ ...makeSlide(), tts_text: "" });
    expect(r.ok).toBe(false);
  });

  it("rejects when tts_text contains a URL", () => {
    const r = validateSlide(
      makeSlide({ tts_text: "Visit https://example.com later" })
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/URL/i);
  });

  it("rejects when tts_text contains a raw UUID", () => {
    const r = validateSlide(
      makeSlide({
        tts_text: "Reference 11111111-2222-3333-4444-555555555555 inline",
      })
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/raw IDs/);
  });

  it("rejects when slide is not an object", () => {
    expect(validateSlide(null).ok).toBe(false);
    expect(validateSlide("nope" as any).ok).toBe(false);
  });

  it("tolerates photo_id: null (treats as no photo)", () => {
    const r = validateSlide({ ...makeSlide(), photo_id: null });
    expect(r.ok).toBe(true);
  });

  it("tolerates photo_id: '' (treats as no photo)", () => {
    const r = validateSlide({ ...makeSlide(), photo_id: "" });
    expect(r.ok).toBe(true);
  });

  // The model occasionally emits non-string photo_id values. The
  // validator tolerates them (treats as "no photo"); resolveSlidePhotos
  // and the Edge Function sanitize before persistence.
  it("tolerates photo_id: [] (array, treated as no photo)", () => {
    const r = validateSlide({ ...makeSlide(), photo_id: [] });
    expect(r.ok).toBe(true);
  });

  it("tolerates photo_id: {} (object, treated as no photo)", () => {
    const r = validateSlide({ ...makeSlide(), photo_id: {} });
    expect(r.ok).toBe(true);
  });

  it("tolerates photo_id: 42 (number, treated as no photo)", () => {
    const r = validateSlide({ ...makeSlide(), photo_id: 42 });
    expect(r.ok).toBe(true);
  });

  it("tolerates photo_id: true (boolean, treated as no photo)", () => {
    const r = validateSlide({ ...makeSlide(), photo_id: true });
    expect(r.ok).toBe(true);
  });
});

// ─── validateBriefing ───────────────────────────────────────────────

describe("validateBriefing", () => {
  it("rejects fewer than 6 slides", () => {
    const slides = Array.from({ length: 5 }, () => makeSlide());
    const r = validateBriefing(slides);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/out of range/);
  });

  it("rejects more than 12 slides", () => {
    const slides = Array.from({ length: 13 }, () => makeSlide());
    const r = validateBriefing(slides);
    expect(r.ok).toBe(false);
  });

  it("accepts a count between 6 and 12", () => {
    const slides = Array.from({ length: 8 }, () => makeSlide());
    expect(validateBriefing(slides).ok).toBe(true);
  });

  it("rejects when a slide carries a photo_id outside the candidate pool", () => {
    const slides = [
      ...Array.from({ length: 5 }, () => makeSlide()),
      makeSlide({ kind: "memory_photo", photo_id: "ghost-id" }),
    ];
    const r = validateBriefing(slides, ["pool-1", "pool-2"]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/not in candidate pool/);
  });

  it("accepts a slide whose photo_id IS in the candidate pool", () => {
    const slides = [
      ...Array.from({ length: 5 }, () => makeSlide()),
      makeSlide({ kind: "memory_photo", photo_id: "pool-1" }),
    ];
    const r = validateBriefing(slides, ["pool-1", "pool-2"]);
    expect(r.ok).toBe(true);
  });

  it("rejects when slides is not an array", () => {
    expect(validateBriefing("nope" as any).ok).toBe(false);
  });

  it("skips pool-membership check when photo_id is non-string (e.g. array)", () => {
    // photo_id: ['abc'] is an array, NOT a string. Even though 'abc' is
    // in the candidate pool, the check is skipped for non-string values
    // and the briefing should validate cleanly.
    const slides = [
      ...Array.from({ length: 5 }, () => makeSlide()),
      makeSlide({
        kind: "memory_photo",
        photo_id: ["abc"] as any,
      }),
    ];
    const r = validateBriefing(slides, ["abc", "def"]);
    expect(r.ok).toBe(true);
  });
});

// ─── getTodaysBriefing ──────────────────────────────────────────────

describe("getTodaysBriefing", () => {
  it("filters by user_id, today's date, and draft/approved/delivered status", async () => {
    state.singleResults.push({
      data: {
        id: "b1",
        user_id: "user-1",
        briefing_date: "2026-05-09",
        slides: [],
        status: "approved",
      },
      error: null,
    });
    const out = await getTodaysBriefing("user-1");
    expect(out).toBeTruthy();
    expect(out?.id).toBe("b1");

    const q = state.queries[0];
    expect(q.table).toBe("briefings");
    expect(q.filters.find((f) => f.col === "user_id")).toEqual({
      op: "eq",
      col: "user_id",
      val: "user-1",
    });
    const dateFilter = q.filters.find((f) => f.col === "briefing_date");
    expect(dateFilter?.op).toBe("eq");
    expect(typeof dateFilter?.val).toBe("string");
    expect(dateFilter?.val).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(q.filters.find((f) => f.col === "status")).toEqual({
      op: "in",
      col: "status",
      val: ["draft", "approved", "delivered"],
    });
  });

  it("returns null on error", async () => {
    state.singleResults.push({ data: null, error: { message: "boom" } });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const out = await getTodaysBriefing("user-1");
    expect(out).toBeNull();
    warn.mockRestore();
  });
});

// ─── approveBriefing ────────────────────────────────────────────────

describe("approveBriefing", () => {
  it("issues an update setting status, approved_by, approved_at", async () => {
    state.results.push({ data: null, error: null });
    const out = await approveBriefing("b1", "co-1");
    expect(out).toEqual({ ok: true });
    const q = state.queries[0];
    expect(q.table).toBe("briefings");
    const u = q.updated as Record<string, unknown>;
    expect(u.status).toBe("approved");
    expect(u.approved_by).toBe("co-1");
    expect(typeof u.approved_at).toBe("string");
    expect(q.filters).toContainEqual({ op: "eq", col: "id", val: "b1" });
  });

  it("returns ok:false on error", async () => {
    state.results.push({ data: null, error: { message: "denied" } });
    const out = await approveBriefing("b1", "co-1");
    expect(out.ok).toBe(false);
    expect(out.error).toBe("denied");
  });
});

// ─── updateSlide ────────────────────────────────────────────────────

describe("updateSlide", () => {
  it("reads the slides array, replaces index, writes back", async () => {
    const original = [makeSlide({ title: "old-0" }), makeSlide({ title: "old-1" })];
    state.singleResults.push({ data: { slides: original }, error: null });
    state.results.push({ data: null, error: null });

    const updated = makeSlide({ title: "new-1" });
    const out = await updateSlide("b1", 1, updated);
    expect(out).toEqual({ ok: true });

    expect(state.queries).toHaveLength(2);
    const writeQuery = state.queries[1];
    expect(writeQuery.table).toBe("briefings");
    const u = writeQuery.updated as Record<string, unknown>;
    const slides = u.slides as BriefingSlide[];
    expect(slides[0].title).toBe("old-0");
    expect(slides[1].title).toBe("new-1");
  });

  it("returns ok:false when index is out of range", async () => {
    state.singleResults.push({
      data: { slides: [makeSlide()] },
      error: null,
    });
    const out = await updateSlide("b1", 5, makeSlide());
    expect(out.ok).toBe(false);
  });
});

// ─── reorderSlides ──────────────────────────────────────────────────

describe("reorderSlides", () => {
  it("reshuffles slides by the given index list", async () => {
    const slides = [
      makeSlide({ title: "A" }),
      makeSlide({ title: "B" }),
      makeSlide({ title: "C" }),
    ];
    state.singleResults.push({ data: { slides }, error: null });
    state.results.push({ data: null, error: null });

    const out = await reorderSlides("b1", [2, 0, 1]);
    expect(out.ok).toBe(true);

    const u = state.queries[1].updated as Record<string, unknown>;
    const next = u.slides as BriefingSlide[];
    expect(next.map((s) => s.title)).toEqual(["C", "A", "B"]);
  });

  it("rejects when newOrder length doesn't match", async () => {
    state.singleResults.push({
      data: { slides: [makeSlide(), makeSlide()] },
      error: null,
    });
    const out = await reorderSlides("b1", [0]);
    expect(out.ok).toBe(false);
  });

  it("rejects when newOrder has duplicates or invalid indices", async () => {
    state.singleResults.push({
      data: { slides: [makeSlide(), makeSlide()] },
      error: null,
    });
    const out = await reorderSlides("b1", [0, 0]);
    expect(out.ok).toBe(false);
  });
});

// ─── markDelivered ──────────────────────────────────────────────────

describe("markDelivered", () => {
  it("sets status='delivered' and delivered_at", async () => {
    state.results.push({ data: null, error: null });
    await markDelivered("b1");
    const q = state.queries[0];
    expect(q.table).toBe("briefings");
    const u = q.updated as Record<string, unknown>;
    expect(u.status).toBe("delivered");
    expect(typeof u.delivered_at).toBe("string");
    expect(q.filters).toContainEqual({ op: "eq", col: "id", val: "b1" });
  });
});

// ─── resolveSlidePhotos ─────────────────────────────────────────────

describe("resolveSlidePhotos", () => {
  it("fills photo_url for slides with photo_id, leaves others alone", async () => {
    state.results.push({
      data: [
        { id: "p1", file_url: "https://cdn.example/p1.jpg" },
        { id: "p2", file_url: "https://cdn.example/p2.jpg" },
      ],
      error: null,
    });
    const slides: BriefingSlide[] = [
      makeSlide({ kind: "greeting" }),
      makeSlide({ kind: "memory_photo", photo_id: "p1" }),
      makeSlide({ kind: "person", photo_id: "p2" }),
      makeSlide({ kind: "fact" }),
    ];
    const out = await resolveSlidePhotos(slides);
    expect(out[0].photo_url).toBeUndefined();
    expect(out[1].photo_url).toBe("https://cdn.example/p1.jpg");
    expect(out[2].photo_url).toBe("https://cdn.example/p2.jpg");
    expect(out[3].photo_url).toBeUndefined();
  });

  it("returns slides unchanged when none have photo_id", async () => {
    const slides = [makeSlide(), makeSlide()];
    const out = await resolveSlidePhotos(slides);
    expect(out).toEqual(slides);
    expect(state.queries).toHaveLength(0);
  });

  it("excludes hidden media rows at the query level (no photo_url filled)", async () => {
    // The .neq('verification_status', 'hidden') filter means hidden
    // rows never come back from Supabase. Simulate that by returning an
    // empty result set, then assert (a) the filter was sent and (b) the
    // referencing slide has no photo_url.
    state.results.push({ data: [], error: null });
    const slides: BriefingSlide[] = [
      makeSlide({ kind: "memory_photo", photo_id: "hidden-1" }),
    ];
    const out = await resolveSlidePhotos(slides);

    expect(out[0].photo_url).toBeUndefined();
    const q = state.queries[0];
    expect(q.table).toBe("media");
    expect(q.filters).toContainEqual({
      op: "neq",
      col: "verification_status",
      val: "hidden",
    });
  });

  it("drops rows whose file_url is not http(s) (e.g. file:// local URIs)", async () => {
    state.results.push({
      data: [
        { id: "p-local", file_url: "file:///var/mobile/Containers/p1.jpg" },
        { id: "p-good", file_url: "https://cdn.example/p2.jpg" },
      ],
      error: null,
    });
    const slides: BriefingSlide[] = [
      makeSlide({ kind: "memory_photo", photo_id: "p-local" }),
      makeSlide({ kind: "memory_photo", photo_id: "p-good" }),
    ];
    const out = await resolveSlidePhotos(slides);

    expect(out[0].photo_url).toBeUndefined();
    expect(out[1].photo_url).toBe("https://cdn.example/p2.jpg");
  });
});

// ─── generateBriefing ───────────────────────────────────────────────

describe("generateBriefing", () => {
  it("returns the briefing on success", async () => {
    state.invokeImpl = async () => ({
      data: {
        briefing: {
          id: "b1",
          user_id: "user-1",
          briefing_date: "2026-05-09",
          slides: [],
          status: "draft",
        },
      },
      error: null,
    });
    const out = await generateBriefing("user-1");
    expect(out.briefing?.id).toBe("b1");
    expect(out.error).toBeUndefined();
    expect(state.invokeCalls[0].fn).toBe("generate-briefing");
  });

  it("returns error gracefully when the Edge Function returns an error envelope", async () => {
    state.invokeImpl = async () => ({
      data: { error: "model returned invalid JSON" },
      error: null,
    });
    const out = await generateBriefing("user-1");
    expect(out.error).toBe("model returned invalid JSON");
    expect(out.briefing).toBeNull();
  });

  it("returns error gracefully when the Edge Function transport fails", async () => {
    state.invokeImpl = async () => ({
      data: null,
      error: { message: "network down" },
    });
    const out = await generateBriefing("user-1");
    expect(out.error).toBe("network down");
    expect(out.briefing).toBeNull();
  });
});
