// Phase B unit tests for the askAssistant client wrapper.
//
// All intelligence lives server-side in the `ask-assistant` Edge
// Function now; this thin client just invokes it, parses the response,
// and threads `conversationId`. The pre-Phase-B `getUserContext`
// keyword-filter tests have been removed (function no longer exists).

import { beforeEach, describe, expect, it, vi } from "vitest";

interface InvokeResult {
  data: unknown;
  error: { message: string } | null;
}

const invokeMock = vi.fn<
  (fn: string, opts: { body: unknown }) => Promise<InvokeResult>
>();

vi.mock("./supabase", () => ({
  supabase: {
    functions: {
      invoke: (fn: string, opts: { body: unknown }) => invokeMock(fn, opts),
    },
  },
}));

import { askAssistant } from "./assistant";

beforeEach(() => {
  invokeMock.mockReset();
});

describe("askAssistant", () => {
  it("returns the error envelope when the Edge Function returns error", async () => {
    invokeMock.mockResolvedValueOnce({
      data: null,
      error: { message: "boom" },
    });
    const out = await askAssistant("user-1", "hi", "conv-7");
    expect(out.error).toBe("boom");
    expect(out.answer).toBe("");
    expect(out.conversationId).toBe("conv-7");
  });

  it("returns the error envelope when the Edge Function returns no data", async () => {
    invokeMock.mockResolvedValueOnce({ data: null, error: null });
    const out = await askAssistant("user-1", "hi");
    expect(out.error).toBe("No data returned");
    expect(out.answer).toBe("");
  });

  it("parses string-typed responses (some Edge runtimes return text)", async () => {
    invokeMock.mockResolvedValueOnce({
      data: JSON.stringify({
        answer: "Hello!",
        conversationId: "conv-1",
      }),
      error: null,
    });
    const out = await askAssistant("user-1", "hello");
    expect(out.answer).toBe("Hello!");
    expect(out.conversationId).toBe("conv-1");
    expect(out.photos).toBeUndefined();
    expect(out.error).toBeUndefined();
  });

  it("maps the photos array through when present", async () => {
    invokeMock.mockResolvedValueOnce({
      data: {
        answer: "Here are your beach photos.",
        conversationId: "conv-1",
        photos: ["https://x/1.jpg", "https://x/2.jpg"],
      },
      error: null,
    });
    const out = await askAssistant("user-1", "show me beach photos");
    expect(out.photos).toEqual(["https://x/1.jpg", "https://x/2.jpg"]);
  });

  it("propagates conversationId from server, falling back to passed-in id", async () => {
    invokeMock.mockResolvedValueOnce({
      data: { answer: "ok", conversationId: "conv-new" },
      error: null,
    });
    const out = await askAssistant("user-1", "hi", "conv-old");
    expect(out.conversationId).toBe("conv-new");
    // Verify the conversationId was forwarded in the request body.
    expect(invokeMock).toHaveBeenCalledWith("ask-assistant", {
      body: { userId: "user-1", question: "hi", conversationId: "conv-old" },
    });
  });

  it("falls back to the passed-in conversationId when server omits it", async () => {
    invokeMock.mockResolvedValueOnce({
      data: { answer: "ok" },
      error: null,
    });
    const out = await askAssistant("user-1", "hi", "conv-fallback");
    expect(out.conversationId).toBe("conv-fallback");
  });
});
