"use client";
/**
 * useVoiceLoop — binds the pure voice state machine (machine.ts) to the
 * browser side effects: STT (stt.ts), wake word (wakeword.ts), TTS
 * (tts-web.ts), the assistant (askAssistant), navigation, and earcons.
 *
 * Concurrency rules enforced here (the reducer makes them testable; this
 * hook makes them real):
 *   • Race guard — every async side effect (askAssistant, tts.speak)
 *     captures `state.generation` at launch and compares against the live
 *     value (stateRef) on resolution. A stale result is dropped, never
 *     spoken. The reducer bumps generation on cancel/barge-in/silence/error.
 *   • Barge-in — a tap/PTT while SPEAKING dispatches BARGE_IN; the SPEAKING
 *     effect's cleanup stops TTS as we leave the phase.
 *   • Wake-while-speaking — the wake word is paused for the whole non-idle
 *     turn and only re-armed after a post-speak debounce, so nova's own
 *     audio can't trigger "Hey Memo".
 *   • Nav intents — matched on the transcript before the LLM is called.
 */

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { askAssistant, useAuth } from "@memoria/core";
import * as tts from "@/lib/tts-web";
import { playEarcon } from "@/lib/audio-unlock";
import { useAudioUnlocked } from "@/components/AudioUnlockGate";
import {
  initialVoiceState,
  matchNavIntent,
  voiceReducer,
  type VoicePhase,
} from "./machine";
import { createStt, isSttSupported, type SttHandle } from "./stt";
import { createWakeWord, type WakeWordHandle } from "./wakeword";

const SILENCE_MS = 8000;
const POST_SPEAK_DEBOUNCE_MS = 900;
const THINK_TIMEOUT_MS = 20000;
const ERROR_FALLBACK =
  "Sorry, I didn't quite catch that. Tap the circle and try again.";
const MIC_DENIED_MESSAGE =
  "I can't hear you — the microphone is blocked. Please allow microphone access in your browser settings.";

type TimerRef = React.MutableRefObject<ReturnType<typeof setTimeout> | null>;

function clearTimer(ref: TimerRef): void {
  if (ref.current) {
    clearTimeout(ref.current);
    ref.current = null;
  }
}

// Space is the PTT key, but it must not be hijacked when the user is typing
// OR when a focusable control is focused (buttons/links use Space/Enter to
// activate — including the VoiceOrb itself, which would otherwise both
// activate and fire onTalk). Checks both the event target and activeElement.
function shouldIgnoreSpace(target: EventTarget | null): boolean {
  const candidates: Array<HTMLElement | null> = [
    target as HTMLElement | null,
    typeof document !== "undefined"
      ? (document.activeElement as HTMLElement | null)
      : null,
  ];
  for (const el of candidates) {
    if (!el || !el.tagName) continue;
    const tag = el.tagName.toUpperCase();
    if (
      tag === "INPUT" ||
      tag === "TEXTAREA" ||
      tag === "BUTTON" ||
      tag === "A" ||
      tag === "SELECT"
    ) {
      return true;
    }
    if (el.isContentEditable === true) return true;
    if (el.getAttribute?.("role") === "button") return true;
  }
  return false;
}

export interface VoiceLoopApi {
  phase: VoicePhase;
  transcript: string;
  partial: string;
  answer: string;
  photos: string[];
  error: string | null;
  /** Context-sensitive tap/PTT: start a turn, barge-in, or cancel. */
  onTalk: () => void;
  sttSupported: boolean;
  wakeWordEnabled: boolean;
}

export function useVoiceLoop(): VoiceLoopApi {
  const [state, dispatch] = useReducer(voiceReducer, initialVoiceState);
  const { userId, session } = useAuth();
  const router = useRouter();
  const unlocked = useAudioUnlocked();

  const uid = userId ?? session?.user?.id ?? null;

  const [partial, setPartial] = useState("");
  const [sttSupported, setSttSupported] = useState(false);
  const [wakeWordEnabled, setWakeWordEnabled] = useState(false);

  // Refs always reflect the latest value for use inside async callbacks /
  // effects without re-subscribing. Assigned during render (safe for refs).
  const stateRef = useRef(state);
  stateRef.current = state;
  const uidRef = useRef(uid);
  uidRef.current = uid;
  const routerRef = useRef(router);
  routerRef.current = router;
  const unlockedRef = useRef(unlocked);
  unlockedRef.current = unlocked;

  const conversationIdRef = useRef<string | undefined>(undefined);
  const sttRef = useRef<SttHandle | null>(null);
  const wakeRef = useRef<WakeWordHandle | null>(null);
  const micActiveRef = useRef(false);
  const silenceRef: TimerRef = useRef(null);
  const debounceRef: TimerRef = useRef(null);
  const thinkRef: TimerRef = useRef(null);

  // ── STT engine (created once) ──────────────────────────────────────
  useEffect(() => {
    setSttSupported(isSttSupported());

    const stt = createStt(
      {
        onStart: () => {
          micActiveRef.current = true;
          dispatch({ type: "LISTEN_START" });
        },
        onPartial: (text) => setPartial(text),
        onFinal: (text) => {
          // Navigation intents short-circuit the LLM entirely.
          const intent = matchNavIntent(text);
          if (intent) {
            dispatch({ type: "CANCEL" });
            routerRef.current?.push(intent);
            return;
          }
          dispatch({ type: "TRANSCRIPT", text });
        },
        onNoSpeech: () => {
          micActiveRef.current = false;
          const phase = stateRef.current.phase;
          if (phase === "listening") dispatch({ type: "SILENCE_TIMEOUT" });
          else if (phase === "wake") dispatch({ type: "CANCEL" });
        },
        onEnd: () => {
          micActiveRef.current = false;
        },
        onError: (err) => {
          // 'no-speech' / 'aborted' are benign — let the silence timer or
          // an explicit cancel handle them.
          if (err === "no-speech" || err === "aborted") return;
          if (
            err === "not-allowed" ||
            err === "service-not-allowed" ||
            err === "audio-capture"
          ) {
            // Mic permission/hardware denied — stop advertising voice and
            // speak an actionable message instead of a misleading retry.
            setSttSupported(false);
            if (stateRef.current.phase !== "idle") {
              dispatch({ type: "ERROR", message: "mic-denied" });
            }
            return;
          }
          if (stateRef.current.phase !== "idle") {
            dispatch({ type: "ERROR", message: err });
          }
        },
      },
      { continuous: false }
    );
    sttRef.current = stt;

    return () => {
      try {
        stt.abort();
      } catch {
        /* ignore */
      }
    };
  }, []);

  // ── Wake word (created once; armed after unlock) ───────────────────
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const handle = await createWakeWord({
        onWake: () => {
          // Defense-in-depth: start() is already gated on unlock, but never
          // begin a turn whose TTS would be blocked by the autoplay policy.
          if (stateRef.current.phase === "idle" && unlockedRef.current) {
            dispatch({ type: "WAKE" });
          }
        },
        onError: () => setWakeWordEnabled(false),
      });
      if (cancelled) {
        void handle.release();
        return;
      }
      wakeRef.current = handle;
      setWakeWordEnabled(handle.enabled);
      if (handle.enabled && unlockedRef.current) {
        await handle.start();
      }
    })();

    return () => {
      cancelled = true;
      void wakeRef.current?.release();
    };
  }, []);

  // Start the wake word the moment audio is unlocked (so the mic-permission
  // prompt follows the user's first gesture).
  useEffect(() => {
    if (unlocked && wakeRef.current?.enabled) {
      void wakeRef.current.start();
    }
  }, [unlocked]);

  // A new authenticated user must not inherit the prior user's thread.
  useEffect(() => {
    conversationIdRef.current = undefined;
  }, [uid]);

  // ── Phase-driven side effects ──────────────────────────────────────
  useEffect(() => {
    const phase = state.phase;
    const generation = state.generation;

    // Wake word is silenced for the entire active turn.
    if (phase !== "idle") wakeRef.current?.pause();
    if (phase !== "listening") setPartial("");

    switch (phase) {
      case "wake": {
        // Silence any idle-phase TTS (e.g. the home greeting) before the mic
        // opens, so nova's own audio can't bleed into SpeechRecognition.
        void tts.stop();
        playEarcon("start");
        micActiveRef.current = false;
        sttRef.current?.start();
        return;
      }

      case "listening": {
        // Barge-in jumps straight here without passing through "wake".
        if (!micActiveRef.current) sttRef.current?.start();
        clearTimer(silenceRef);
        silenceRef.current = setTimeout(() => {
          if (stateRef.current.phase === "listening") {
            sttRef.current?.abort();
            dispatch({ type: "SILENCE_TIMEOUT" });
          }
        }, SILENCE_MS);
        return () => clearTimer(silenceRef);
      }

      case "thinking": {
        const myGen = generation;
        const question = state.transcript;
        // Watchdog: a hung / cold-start askAssistant must not strand the kiosk
        // in "Thinking…" with the wake word paused. Fall back to the error
        // path (speaks a fallback, returns to idle, re-arms the wake word).
        clearTimer(thinkRef);
        thinkRef.current = setTimeout(() => {
          if (
            myGen === stateRef.current.generation &&
            stateRef.current.phase === "thinking"
          ) {
            dispatch({ type: "ERROR", message: "assistant-timeout" });
          }
        }, THINK_TIMEOUT_MS);
        void (async () => {
          let currentUid = uidRef.current;
          if (!currentUid) {
            // Auth may still be settling (session set before the memoria
            // userId loads). Give it a moment rather than abandoning a real
            // question with a confusing spoken error.
            await new Promise((r) => setTimeout(r, 400));
            if (myGen !== stateRef.current.generation) return;
            currentUid = uidRef.current;
          }
          if (!currentUid) {
            // Genuinely not signed in — return to idle silently.
            dispatch({ type: "CANCEL" });
            return;
          }
          const resp = await askAssistant(
            currentUid,
            question,
            conversationIdRef.current
          );
          if (myGen !== stateRef.current.generation) return; // stale — drop
          if (resp.conversationId) conversationIdRef.current = resp.conversationId;
          if (resp.error && !resp.answer) {
            dispatch({ type: "ERROR", message: resp.error });
            return;
          }
          dispatch({
            type: "RESPONSE",
            answer: resp.answer,
            photos: resp.photos,
          });
        })();
        return () => clearTimer(thinkRef);
      }

      case "speaking": {
        const myGen = generation;
        void tts.speak(state.answer, {
          onDone: () => {
            if (myGen === stateRef.current.generation) {
              dispatch({ type: "SPEAK_DONE" });
            }
          },
        });
        return () => {
          void tts.stop();
        };
      }

      case "error": {
        const myGen = generation;
        const message =
          state.error === "mic-denied" ? MIC_DENIED_MESSAGE : ERROR_FALLBACK;
        void tts.speak(message, {
          onDone: () => {
            if (myGen === stateRef.current.generation) {
              dispatch({ type: "SPEAK_DONE" });
            }
          },
        });
        return () => {
          void tts.stop();
        };
      }

      case "idle":
      default: {
        sttRef.current?.abort();
        micActiveRef.current = false;
        clearTimer(debounceRef);
        if (unlockedRef.current && wakeRef.current?.enabled) {
          // Re-arm the wake word, but never while TTS is still audible — a
          // tail of nova audio could otherwise retrigger "Hey Memo".
          const armWake = () => {
            if (!unlockedRef.current || !wakeRef.current?.enabled) return;
            if (tts.isSpeaking()) {
              debounceRef.current = setTimeout(armWake, 300);
            } else {
              wakeRef.current.resume();
            }
          };
          debounceRef.current = setTimeout(armWake, POST_SPEAK_DEBOUNCE_MS);
        }
        return () => clearTimer(debounceRef);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.generation]);

  // ── Public tap / PTT handler ───────────────────────────────────────
  const onTalk = useCallback(() => {
    if (!unlockedRef.current) return;
    const phase = stateRef.current.phase;
    switch (phase) {
      case "idle":
        dispatch({ type: "WAKE" });
        break;
      case "speaking":
        dispatch({ type: "BARGE_IN" });
        break;
      case "wake":
      case "listening":
        sttRef.current?.abort();
        dispatch({ type: "CANCEL" });
        break;
      case "thinking":
        dispatch({ type: "CANCEL" });
        break;
      default:
        break;
    }
  }, []);

  // Spacebar mirrors the tap target (skips when typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" && !shouldIgnoreSpace(e.target)) {
        e.preventDefault();
        onTalk();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onTalk]);

  return {
    phase: state.phase,
    transcript: state.transcript,
    partial,
    answer: state.answer,
    photos: state.photos,
    error: state.error,
    onTalk,
    sttSupported,
    wakeWordEnabled,
  };
}
