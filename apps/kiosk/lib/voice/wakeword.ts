/**
 * "Hey Memo" wake-word detection via the Web Speech API in continuous mode.
 *
 * No dependencies, no account, no model files. Works in Chrome/Edge today;
 * degrades gracefully to push-to-talk in Firefox (no SpeechRecognition).
 *
 * How it works: a continuous SpeechRecognition instance runs in the background
 * while the loop is idle, scanning every interim transcript for the wake
 * phrase. When matched it fires onWake() and restarts cleanly. Chrome
 * auto-terminates recognizers after ~5 minutes, so a restart watchdog keeps
 * it alive indefinitely.
 *
 * Tradeoffs vs Picovoice (documented in future-implementations.md):
 *   - Audio goes to Google's servers (acceptable for a demo)
 *   - Transcript-based so "hey memo" in any utterance triggers it
 *   - Chrome/Edge only (fine for a controlled kiosk)
 *
 * The pause/resume interface is identical to every other wake-word backend so
 * useVoiceLoop is untouched.
 */

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}

function getCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// Acceptable phonetic variants the speech engine might produce for "Hey Memo".
const WAKE_PHRASES = ["hey memo", "hey mamo", "hey damo", "hey nemo"];

function matchesWakePhrase(transcript: string): boolean {
  const t = transcript.toLowerCase().replace(/[^a-z\s]/g, " ").trim();
  return WAKE_PHRASES.some((p) => t.includes(p));
}

export interface WakeWordHandle {
  start(): Promise<void>;
  pause(): void;
  resume(): void;
  release(): Promise<void>;
  readonly enabled: boolean;
}

const disabledHandle: WakeWordHandle = {
  async start() {},
  pause() {},
  resume() {},
  async release() {},
  enabled: false,
};

export interface WakeWordOptions {
  onWake: () => void;
  onError?: (error: string) => void;
}

export async function createWakeWord(
  opts: WakeWordOptions
): Promise<WakeWordHandle> {
  if (typeof window === "undefined") return disabledHandle;

  const Ctor = getCtor();
  if (!Ctor) {
    console.info(
      "[wakeword] SpeechRecognition not available — using push-to-talk. " +
        "Chrome/Edge required for 'Hey Memo' wake word."
    );
    return disabledHandle;
  }

  // Non-null assertion safe: we checked Ctor above and returned early if null.
  const RecCtor = Ctor!;
  let rec: SpeechRecognitionLike | null = null;
  let active = false;
  let released = false;
  let restartTimer: ReturnType<typeof setTimeout> | null = null;

  function clearRestart(): void {
    if (restartTimer) {
      clearTimeout(restartTimer);
      restartTimer = null;
    }
  }

  function startRec(): void {
    if (!active || released) return;

    // Tear down any existing instance first.
    if (rec) {
      try {
        rec.abort();
      } catch {
        /* ignore */
      }
      rec = null;
    }

    const r = new RecCtor();
    r.lang = "en-US";
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;

    r.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const transcript = e.results[i][0]?.transcript ?? "";
        if (matchesWakePhrase(transcript)) {
          // Abort and schedule a clean restart to clear the recognition buffer
          // before the next turn, so the wake phrase itself isn't captured by STT.
          try {
            r.abort();
          } catch {
            /* ignore */
          }
          if (rec === r) rec = null;
          scheduleRestart(300);
          opts.onWake();
          return;
        }
      }
    };

    r.onerror = (e) => {
      if (rec === r) rec = null;
      const err = e?.error ?? "unknown";
      if (err === "not-allowed" || err === "audio-capture") {
        // Mic permission denied — disable wake word, let push-to-talk take over.
        opts.onError?.(err);
        active = false;
        return;
      }
      if (err === "aborted") return; // we aborted it on purpose — no restart
      scheduleRestart(500);
    };

    r.onend = () => {
      if (rec === r) rec = null;
      // Chrome terminates recognizers after ~5 min. Restart to keep listening.
      if (active) scheduleRestart(200);
    };

    rec = r;
    try {
      r.start();
    } catch {
      scheduleRestart(500);
    }
  }

  function scheduleRestart(ms: number): void {
    if (released || !active) return;
    clearRestart();
    restartTimer = setTimeout(startRec, ms);
  }

  return {
    enabled: true,

    async start() {
      active = true;
      startRec();
    },

    pause() {
      active = false;
      clearRestart();
      if (rec) {
        try {
          rec.abort();
        } catch {
          /* ignore */
        }
        rec = null;
      }
    },

    resume() {
      if (released) return;
      active = true;
      startRec();
    },

    async release() {
      released = true;
      active = false;
      clearRestart();
      if (rec) {
        try {
          rec.abort();
        } catch {
          /* ignore */
        }
        rec = null;
      }
    },
  };
}
