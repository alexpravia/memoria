/**
 * Browser autoplay unlock for the kiosk.
 *
 * Browsers block audio (HTMLAudioElement.play, AudioContext) until a user
 * gesture has occurred in the page. tts-web.ts plays via `new Audio()`, so
 * before any TTS we must run this unlock inside a real gesture handler
 * (see AudioUnlockGate). After unlock the home greeting can speak freely.
 *
 * All functions are browser-guarded and never throw — a failed optional
 * step (Fullscreen, Wake Lock) must not block audio.
 */

const UNLOCK_KEY = "memoria-audio-unlocked";

// 44-byte, zero-sample silent WAV. Playing it through an HTMLAudioElement
// during the gesture primes the same code path tts-web uses.
const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=";

let audioCtx: AudioContext | null = null;
let wakeLock: WakeLockSentinel | null = null;

function getCtor(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext ??
    null
  );
}

/** Returns the shared AudioContext, creating it if needed. May be null. */
export function getAudioContext(): AudioContext | null {
  if (audioCtx) return audioCtx;
  const Ctor = getCtor();
  if (!Ctor) return null;
  try {
    audioCtx = new Ctor();
  } catch {
    audioCtx = null;
  }
  return audioCtx;
}

export function isAudioUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(UNLOCK_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Must be called from within a user-gesture handler. Resumes the
 * AudioContext, plays a silent buffer through both AudioContext and an
 * HTMLAudioElement, primes speechSynthesis, then best-effort requests
 * Fullscreen + a screen Wake Lock for kiosk mode.
 */
export async function unlockAudio(): Promise<void> {
  if (typeof window === "undefined") return;

  // 1. AudioContext resume + 1-frame silent buffer.
  try {
    const ctx = getAudioContext();
    if (ctx) {
      if (ctx.state === "suspended") await ctx.resume();
      const buffer = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(ctx.destination);
      src.start(0);
    }
  } catch (e) {
    console.warn("unlockAudio: AudioContext step failed", e);
  }

  // 2. Prime the HTMLAudioElement path that tts-web actually uses.
  try {
    const a = new Audio(SILENT_WAV);
    a.muted = true;
    await a.play().catch(() => {});
    a.pause();
  } catch {
    /* ignore */
  }

  // 3. Prime + cancel speechSynthesis (the tts-web fallback path).
  try {
    if ("speechSynthesis" in window) {
      const u = new SpeechSynthesisUtterance("");
      window.speechSynthesis.speak(u);
      window.speechSynthesis.cancel();
    }
  } catch {
    /* ignore */
  }

  // 4. Kiosk niceties — best effort, never block.
  try {
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) {
      await el.requestFullscreen().catch(() => {});
    }
  } catch {
    /* ignore */
  }
  await acquireWakeLock();

  try {
    sessionStorage.setItem(UNLOCK_KEY, "1");
  } catch {
    /* ignore */
  }
}

async function acquireWakeLock(): Promise<void> {
  try {
    if ("wakeLock" in navigator) {
      wakeLock = await (
        navigator as Navigator & {
          wakeLock: { request(type: "screen"): Promise<WakeLockSentinel> };
        }
      ).wakeLock
        .request("screen")
        .catch(() => null as unknown as WakeLockSentinel);
    }
  } catch {
    /* ignore */
  }
}

// Re-acquire the wake lock when the tab becomes visible again (the OS drops
// it on tab switch / screen off).
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && isAudioUnlocked()) {
      void acquireWakeLock();
    }
  });
}

/**
 * Short confirmation tone. `start` = rising blip when the mic opens,
 * `stop` = lower blip when it closes. No-op until audio is unlocked.
 */
export function playEarcon(kind: "start" | "stop" = "start"): void {
  try {
    const ctx = getAudioContext();
    if (!ctx || ctx.state !== "running") return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    osc.type = "sine";
    osc.frequency.setValueAtTime(kind === "start" ? 660 : 440, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    osc.start(now);
    osc.stop(now + 0.2);
  } catch {
    /* ignore */
  }
}
