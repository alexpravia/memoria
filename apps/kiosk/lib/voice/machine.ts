/**
 * Pure voice-loop state machine for the Memoria kiosk.
 *
 * No React, no DOM, no timers — just (state, event) => state. Every side
 * effect (TTS, STT, askAssistant, navigation, earcons, timers) lives in
 * useVoiceLoop. Keeping this reducer pure makes the tricky concurrency
 * rules unit-testable in isolation:
 *
 *   • barge-in:        a tap/PTT while SPEAKING abandons the answer and
 *                      re-opens the mic.
 *   • race guard:      `generation` bumps whenever the current turn is
 *                      abandoned (cancel / barge-in / silence / error /
 *                      empty transcript). In-flight async work (an
 *                      askAssistant call, a TTS playback) captures the
 *                      generation it began under and is dropped on
 *                      resolution if it no longer matches — so a stale
 *                      response can never be spoken after the user moves on.
 *   • wake-while-speak: a WAKE event is ignored in the SPEAKING phase so
 *                      nova's own audio can't retrigger "Hey Memo". The
 *                      hook adds a time-based post-speak debounce on top.
 *
 * The happy path (wake → listen → think → speak → idle) leaves `generation`
 * untouched; this is the invariant the hook's race guard relies on.
 */

export type VoicePhase =
  | "idle"
  | "wake"
  | "listening"
  | "thinking"
  | "speaking"
  | "error";

export interface VoiceState {
  phase: VoicePhase;
  /** Bumps on every turn abandonment. See module docstring. */
  generation: number;
  /** Last final transcript routed to the assistant (for display/debug). */
  transcript: string;
  /** Latest assistant answer being spoken (for display). */
  answer: string;
  /** Photos attached to the latest answer. */
  photos: string[];
  /** Last error message, set only while phase === "error". */
  error: string | null;
}

export const initialVoiceState: VoiceState = {
  phase: "idle",
  generation: 0,
  transcript: "",
  answer: "",
  photos: [],
  error: null,
};

export type VoiceEvent =
  | { type: "WAKE" } // wake word detected OR push-to-talk
  | { type: "LISTEN_START" } // STT engine began capturing
  | { type: "TRANSCRIPT"; text: string } // final transcript ready
  | { type: "SILENCE_TIMEOUT" } // no speech for ~8s
  | { type: "RESPONSE"; answer: string; photos?: string[] } // askAssistant resolved
  | { type: "SPEAK_DONE" } // TTS finished (or fallback done)
  | { type: "BARGE_IN" } // tap / PTT while speaking
  | { type: "CANCEL" } // hard reset to idle
  | { type: "ERROR"; message: string };

export function voiceReducer(state: VoiceState, event: VoiceEvent): VoiceState {
  // CANCEL and ERROR are valid from any phase and always abandon the turn.
  if (event.type === "CANCEL") {
    return {
      ...state,
      phase: "idle",
      generation: state.generation + 1,
      transcript: "",
      error: null,
    };
  }
  if (event.type === "ERROR") {
    return {
      ...state,
      phase: "error",
      generation: state.generation + 1,
      error: event.message,
    };
  }

  switch (state.phase) {
    case "idle":
      if (event.type === "WAKE") {
        return {
          ...state,
          phase: "wake",
          transcript: "",
          answer: "",
          photos: [],
          error: null,
        };
      }
      return state;

    case "wake":
      if (event.type === "LISTEN_START") {
        return { ...state, phase: "listening" };
      }
      return state;

    case "listening":
      if (event.type === "TRANSCRIPT") {
        const text = event.text.trim();
        if (!text) {
          // Empty/whitespace transcript — treat as silence, abandon turn.
          return { ...state, phase: "idle", generation: state.generation + 1 };
        }
        return { ...state, phase: "thinking", transcript: text };
      }
      if (event.type === "SILENCE_TIMEOUT") {
        return { ...state, phase: "idle", generation: state.generation + 1 };
      }
      return state;

    case "thinking":
      if (event.type === "RESPONSE") {
        return {
          ...state,
          phase: "speaking",
          answer: event.answer,
          photos: event.photos ?? [],
        };
      }
      return state;

    case "speaking":
      if (event.type === "SPEAK_DONE") {
        return { ...state, phase: "idle" };
      }
      if (event.type === "BARGE_IN") {
        // Abandon the current answer, bump generation so a late SPEAK_DONE
        // (or any in-flight work) is ignored, and re-open the mic.
        return {
          ...state,
          phase: "listening",
          generation: state.generation + 1,
          transcript: "",
        };
      }
      // WAKE is intentionally ignored while speaking — nova's own audio must
      // not retrigger the wake word. Barge-in happens via tap/PTT only.
      return state;

    case "error":
      if (event.type === "SPEAK_DONE") {
        return { ...state, phase: "idle", error: null };
      }
      return state;

    default:
      return state;
  }
}

// ─── Navigation intents ──────────────────────────────────────────────
//
// Matched on the raw transcript BEFORE the LLM is ever called, so spoken
// commands like "start my day" route instantly and for free. Pure so it
// can be unit-tested alongside the reducer.

export type NavIntent = "/briefing" | "/";

export function matchNavIntent(transcript: string): NavIntent | null {
  const t = transcript.toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
  if (!t) return null;

  if (
    t.includes("start my day") ||
    t.includes("start the day") ||
    t.includes("begin my day") ||
    t.includes("morning briefing") ||
    t.includes("good morning memo")
  ) {
    return "/briefing";
  }
  if (
    t.includes("go home") ||
    t.includes("take me home") ||
    t.includes("home screen") ||
    t === "home"
  ) {
    return "/";
  }
  // NOTE: "who am I?" intentionally does NOT route anywhere — there is no
  // kiosk /emergency screen yet, and for this audience letting Memo answer
  // an identity question warmly is better than a dead route. Re-add an
  // "/emergency" intent here once that screen exists.
  return null;
}

// ─── Briefing voice commands ─────────────────────────────────────────

export type BriefingCommand = "next" | "again" | "stop";

export function matchBriefingCommand(transcript: string): BriefingCommand | null {
  const t = transcript.toLowerCase();
  if (/\b(next|forward|continue|keep going|skip)\b/.test(t)) return "next";
  if (/\b(again|repeat|replay|one more time|say that again)\b/.test(t)) return "again";
  if (/\b(stop|pause|wait|hold on|quiet)\b/.test(t)) return "stop";
  return null;
}
