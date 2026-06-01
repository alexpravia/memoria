import { describe, it, expect } from "vitest";
import {
  voiceReducer,
  initialVoiceState,
  matchNavIntent,
  matchBriefingCommand,
  type VoiceState,
  type VoiceEvent,
} from "./machine";

/** Drive a sequence of events through the reducer from a starting state. */
function run(start: VoiceState, ...events: VoiceEvent[]): VoiceState {
  return events.reduce(voiceReducer, start);
}

describe("voiceReducer — happy path", () => {
  it("starts idle", () => {
    expect(initialVoiceState.phase).toBe("idle");
    expect(initialVoiceState.generation).toBe(0);
  });

  it("idle + WAKE → wake (and clears prior turn state)", () => {
    const dirty: VoiceState = {
      ...initialVoiceState,
      answer: "old",
      photos: ["x"],
      error: "boom",
    };
    const s = voiceReducer(dirty, { type: "WAKE" });
    expect(s.phase).toBe("wake");
    expect(s.answer).toBe("");
    expect(s.photos).toEqual([]);
    expect(s.error).toBeNull();
  });

  it("wake + LISTEN_START → listening", () => {
    const s = run(initialVoiceState, { type: "WAKE" }, { type: "LISTEN_START" });
    expect(s.phase).toBe("listening");
  });

  it("listening + TRANSCRIPT → thinking with transcript", () => {
    const s = run(
      initialVoiceState,
      { type: "WAKE" },
      { type: "LISTEN_START" },
      { type: "TRANSCRIPT", text: "  who is my daughter  " }
    );
    expect(s.phase).toBe("thinking");
    expect(s.transcript).toBe("who is my daughter");
  });

  it("thinking + RESPONSE → speaking with answer + photos", () => {
    const s = run(
      initialVoiceState,
      { type: "WAKE" },
      { type: "LISTEN_START" },
      { type: "TRANSCRIPT", text: "show me a photo" },
      { type: "RESPONSE", answer: "Here she is.", photos: ["u1"] }
    );
    expect(s.phase).toBe("speaking");
    expect(s.answer).toBe("Here she is.");
    expect(s.photos).toEqual(["u1"]);
  });

  it("speaking + SPEAK_DONE → idle", () => {
    const s = run(
      initialVoiceState,
      { type: "WAKE" },
      { type: "LISTEN_START" },
      { type: "TRANSCRIPT", text: "hi" },
      { type: "RESPONSE", answer: "Hello." },
      { type: "SPEAK_DONE" }
    );
    expect(s.phase).toBe("idle");
  });

  it("the full happy path never bumps generation (race-guard invariant)", () => {
    const s = run(
      initialVoiceState,
      { type: "WAKE" },
      { type: "LISTEN_START" },
      { type: "TRANSCRIPT", text: "hi" },
      { type: "RESPONSE", answer: "Hello." },
      { type: "SPEAK_DONE" }
    );
    expect(s.generation).toBe(0);
  });
});

describe("voiceReducer — abandonment & race guard", () => {
  it("listening + SILENCE_TIMEOUT → idle and bumps generation", () => {
    const s = run(
      initialVoiceState,
      { type: "WAKE" },
      { type: "LISTEN_START" },
      { type: "SILENCE_TIMEOUT" }
    );
    expect(s.phase).toBe("idle");
    expect(s.generation).toBe(1);
  });

  it("listening + empty TRANSCRIPT → idle and bumps generation", () => {
    const s = run(
      initialVoiceState,
      { type: "WAKE" },
      { type: "LISTEN_START" },
      { type: "TRANSCRIPT", text: "   " }
    );
    expect(s.phase).toBe("idle");
    expect(s.generation).toBe(1);
  });

  it("CANCEL from any phase → idle and bumps generation", () => {
    for (const ev of [
      { type: "WAKE" } as const,
      { type: "LISTEN_START" } as const,
      { type: "TRANSCRIPT", text: "hi" } as const,
    ]) {
      const before = run(initialVoiceState, { type: "WAKE" }, { type: "LISTEN_START" });
      const mid = voiceReducer(before, ev);
      const s = voiceReducer(mid, { type: "CANCEL" });
      expect(s.phase).toBe("idle");
      expect(s.generation).toBe(mid.generation + 1);
    }
  });

  it("CANCEL during thinking bumps generation so a stale RESPONSE is droppable", () => {
    const thinking = run(
      initialVoiceState,
      { type: "WAKE" },
      { type: "LISTEN_START" },
      { type: "TRANSCRIPT", text: "hi" }
    );
    expect(thinking.phase).toBe("thinking");
    const startedGen = thinking.generation; // hook captures this when calling askAssistant
    const cancelled = voiceReducer(thinking, { type: "CANCEL" });
    expect(cancelled.generation).not.toBe(startedGen);
    // A late RESPONSE arriving in idle is itself a no-op anyway:
    const afterStale = voiceReducer(cancelled, {
      type: "RESPONSE",
      answer: "stale",
    });
    expect(afterStale.phase).toBe("idle");
    expect(afterStale.answer).toBe("");
  });
});

describe("voiceReducer — barge-in & wake-while-speaking", () => {
  const speaking = run(
    initialVoiceState,
    { type: "WAKE" },
    { type: "LISTEN_START" },
    { type: "TRANSCRIPT", text: "tell me a story" },
    { type: "RESPONSE", answer: "Once upon a time…" }
  );

  it("speaking + BARGE_IN → listening, bumps generation, clears transcript", () => {
    const s = voiceReducer(speaking, { type: "BARGE_IN" });
    expect(s.phase).toBe("listening");
    expect(s.generation).toBe(speaking.generation + 1);
    expect(s.transcript).toBe("");
  });

  it("a SPEAK_DONE after BARGE_IN is ignored (would be from the stopped TTS)", () => {
    const barged = voiceReducer(speaking, { type: "BARGE_IN" });
    const s = voiceReducer(barged, { type: "SPEAK_DONE" });
    expect(s.phase).toBe("listening"); // unchanged
  });

  it("speaking + WAKE is ignored (nova audio must not retrigger wake word)", () => {
    const s = voiceReducer(speaking, { type: "WAKE" });
    expect(s).toBe(speaking); // same reference — true no-op
  });
});

describe("voiceReducer — error path", () => {
  it("ERROR from any phase → error, bumps generation", () => {
    const thinking = run(
      initialVoiceState,
      { type: "WAKE" },
      { type: "LISTEN_START" },
      { type: "TRANSCRIPT", text: "hi" }
    );
    const s = voiceReducer(thinking, { type: "ERROR", message: "network" });
    expect(s.phase).toBe("error");
    expect(s.error).toBe("network");
    expect(s.generation).toBe(thinking.generation + 1);
  });

  it("error + SPEAK_DONE → idle and clears error (after fallback is spoken)", () => {
    const errored = voiceReducer(initialVoiceState, {
      type: "ERROR",
      message: "x",
    });
    const s = voiceReducer(errored, { type: "SPEAK_DONE" });
    expect(s.phase).toBe("idle");
    expect(s.error).toBeNull();
  });
});

describe("voiceReducer — invalid events are no-ops", () => {
  it("idle ignores non-WAKE events", () => {
    expect(voiceReducer(initialVoiceState, { type: "LISTEN_START" })).toBe(
      initialVoiceState
    );
    expect(
      voiceReducer(initialVoiceState, { type: "TRANSCRIPT", text: "hi" })
    ).toBe(initialVoiceState);
    expect(voiceReducer(initialVoiceState, { type: "SPEAK_DONE" })).toBe(
      initialVoiceState
    );
  });

  it("thinking ignores WAKE / LISTEN_START", () => {
    const thinking = run(
      initialVoiceState,
      { type: "WAKE" },
      { type: "LISTEN_START" },
      { type: "TRANSCRIPT", text: "hi" }
    );
    expect(voiceReducer(thinking, { type: "WAKE" })).toBe(thinking);
    expect(voiceReducer(thinking, { type: "LISTEN_START" })).toBe(thinking);
  });
});

describe("matchNavIntent", () => {
  it("routes briefing phrases", () => {
    expect(matchNavIntent("Start my day")).toBe("/briefing");
    expect(matchNavIntent("can we begin my day please")).toBe("/briefing");
    expect(matchNavIntent("morning briefing!")).toBe("/briefing");
  });
  it("routes home phrases", () => {
    expect(matchNavIntent("go home")).toBe("/");
    expect(matchNavIntent("home")).toBe("/");
  });
  it("does NOT intercept identity questions (no kiosk /emergency screen)", () => {
    // "who am I?" should reach Memo, not navigate to a dead route.
    expect(matchNavIntent("Who am I?")).toBeNull();
    expect(matchNavIntent("who i am")).toBeNull();
  });
  it("returns null for ordinary questions", () => {
    expect(matchNavIntent("who is my daughter")).toBeNull();
    expect(matchNavIntent("what did I do yesterday")).toBeNull();
    expect(matchNavIntent("")).toBeNull();
  });
});

describe("matchBriefingCommand", () => {
  it("matches next/again/stop families", () => {
    expect(matchBriefingCommand("next please")).toBe("next");
    expect(matchBriefingCommand("can you say that again")).toBe("again");
    expect(matchBriefingCommand("stop")).toBe("stop");
    expect(matchBriefingCommand("pause for a moment")).toBe("stop");
  });
  it("returns null when no command word is present", () => {
    expect(matchBriefingCommand("who is that")).toBeNull();
  });
});
