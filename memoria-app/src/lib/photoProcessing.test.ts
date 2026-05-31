// Unit tests for the pure photo-embedding-text helper.
//
// photoProcessing.ts imports ./supabase and ./embeddings at module load, so we
// mock both (same pattern as embeddings.test.ts) to keep this a pure unit test
// with no network / Supabase singleton side effects.

import { describe, expect, it, vi } from "vitest";

vi.mock("./supabase", () => ({
  supabase: {
    from: () => ({}),
    functions: { invoke: async () => ({ data: null, error: null }) },
  },
}));

vi.mock("./embeddings", () => ({
  embedAndStore: async () => ({ ok: true }),
}));

import { buildPhotoEmbedText } from "./photoProcessing";

describe("buildPhotoEmbedText", () => {
  it("folds description, tags, and people names into one searchable string", () => {
    const out = buildPhotoEmbedText(
      "Two people smiling at dinner",
      ["beach", "sunset"],
      ["Maria"]
    );
    expect(out).toBe("Two people smiling at dinner. beach, sunset. Maria");
  });

  it("includes tags even when the description omits them (the core bug fix)", () => {
    const out = buildPhotoEmbedText("A warm afternoon by the water", ["beach"], []);
    expect(out).toContain("beach");
  });

  it("drops empty segments and never leaves dangling separators", () => {
    expect(buildPhotoEmbedText("Just a sunset", [], [])).toBe("Just a sunset");
    expect(buildPhotoEmbedText("", ["garden"], [])).toBe("garden");
    expect(buildPhotoEmbedText("", [], ["Sarah"])).toBe("Sarah");
  });

  it("filters falsy / blank tags and names", () => {
    const out = buildPhotoEmbedText(
      "Birthday party",
      ["cake", "", "  "],
      ["", "Robert"]
    );
    expect(out).toBe("Birthday party. cake. Robert");
  });

  it("returns an empty string when there is nothing to embed", () => {
    expect(buildPhotoEmbedText(null, null, null)).toBe("");
    expect(buildPhotoEmbedText("   ", [], [])).toBe("");
    expect(buildPhotoEmbedText(undefined, undefined, undefined)).toBe("");
  });
});
