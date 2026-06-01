/**
 * Web Speech API (SpeechRecognition) wrapper.
 *
 * Strategy per the W2 spec:
 *   • Push-to-talk is the default (continuous: false). The recognizer
 *     auto-finalizes on end-of-speech, which is the most reliable mode.
 *   • Continuous is opt-in for hands-free wake-word turns.
 *   • Safari exposes webkitSpeechRecognition but its continuous mode is
 *     unreliable → forced to push-to-talk.
 *   • Firefox has no SpeechRecognition → isSttSupported() is false and the
 *     UI falls back to the text input.
 *
 * Browser-guarded; safe to import on the server (no work at module load).
 */

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: (() => void) | null;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
}

function getCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSttSupported(): boolean {
  return getCtor() !== null;
}

function isSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  return /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent);
}

export interface SttCallbacks {
  onStart?: () => void;
  onPartial?: (text: string) => void;
  onFinal?: (text: string) => void;
  /** Recognizer ended on its own without producing any final transcript. */
  onNoSpeech?: () => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
}

export interface SttOptions {
  continuous?: boolean;
  lang?: string;
}

export interface SttHandle {
  /** Begin a capture session. */
  start(): void;
  /** Stop capturing and finalize whatever was heard (fires onFinal). */
  stop(): void;
  /** Cancel capturing and discard the transcript (no onFinal). */
  abort(): void;
  readonly supported: boolean;
}

// Only one SpeechRecognition may hold the mic at a time across the whole
// app (e.g. the home voice loop and the assistant page's mic button). Track
// the active instance globally and abort any stragglers before starting a
// new capture, so navigating between screens can't orphan a recognizer.
let activeRec: SpeechRecognitionLike | null = null;

export function createStt(cb: SttCallbacks, opts: SttOptions = {}): SttHandle {
  const Ctor = getCtor();
  let rec: SpeechRecognitionLike | null = null;
  let finalText = "";
  let aborted = false;

  function start(): void {
    if (!Ctor) {
      cb.onError?.("unsupported");
      return;
    }
    // Tear down any prior instance (this handle's or another's) first.
    if (rec) {
      try {
        rec.abort();
      } catch {
        /* ignore */
      }
      rec = null;
    }
    if (activeRec) {
      try {
        activeRec.abort();
      } catch {
        /* ignore */
      }
      activeRec = null;
    }
    finalText = "";
    aborted = false;

    const r = new Ctor();
    r.lang = opts.lang ?? "en-US";
    r.interimResults = true;
    r.maxAlternatives = 1;
    r.continuous = isSafari() ? false : opts.continuous ?? false;

    r.onstart = () => cb.onStart?.();
    r.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        const transcript = result[0]?.transcript ?? "";
        if (result.isFinal) finalText += transcript;
        else interim += transcript;
      }
      if (interim) cb.onPartial?.(interim);
    };
    r.onerror = (e) => cb.onError?.(e?.error ?? "stt-error");
    r.onend = () => {
      const text = finalText.trim();
      if (!aborted) {
        if (text) cb.onFinal?.(text);
        else cb.onNoSpeech?.();
      }
      cb.onEnd?.();
      if (rec === r) rec = null;
      if (activeRec === r) activeRec = null;
    };

    rec = r;
    activeRec = r;
    try {
      r.start();
    } catch (err) {
      // start() throws if called while already running; surface it.
      cb.onError?.(err instanceof Error ? err.message : "start-failed");
    }
  }

  function stop(): void {
    try {
      rec?.stop();
    } catch {
      /* ignore */
    }
  }

  function abort(): void {
    aborted = true;
    finalText = "";
    try {
      rec?.abort();
    } catch {
      /* ignore */
    }
    if (activeRec === rec) activeRec = null;
  }

  return { start, stop, abort, supported: Ctor !== null };
}
