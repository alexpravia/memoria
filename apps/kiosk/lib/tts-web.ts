/**
 * Browser TTS wrapper — drop-in replacement for apps/mobile/src/lib/tts.ts
 *
 * Public API is IDENTICAL: speak, stop, isSpeaking, prewarm, clearCache,
 * _cacheKey, SpeakOpts. Only the internals differ:
 *   expo-audio       → HTMLAudioElement
 *   expo-file-system → Cache API (persistent) + in-memory LRU index
 *   expo-speech      → window.speechSynthesis
 *
 * Autoplay policy note: browsers block audio until a user gesture has
 * occurred in the session. The AudioUnlockGate component (W2) performs
 * a gesture-driven unlock before any TTS is attempted.
 */

import { supabase } from "@memoria/core";

// ─── Configuration ────────────────────────────────────────────────────

const DEFAULT_VOICE = "nova";
const DEFAULT_MODEL = "tts-1";
const FETCH_TIMEOUT_MS = 5000;
const MAX_CACHE_ENTRIES = 50;
const CACHE_NAME = "memoria-tts-v1";

// Resolved from env at runtime; hardcoded fallback for local demo.
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://zpxyqomebbjadqvgpapw.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "sb_publishable_zuXXnzGR2Ba-JsL3awTQsQ_JyoQQZVC";

// ─── Types ────────────────────────────────────────────────────────────

export interface SpeakOpts {
  voice?: string;
  model?: string;
  onDone?: () => void;
}

// ─── Module state ─────────────────────────────────────────────────────

let currentAudio: HTMLAudioElement | null = null;
let isSpeakingFlag = false;
// In-memory LRU index: cacheKey → last_used_at timestamp.
// The actual audio bytes live in the Cache API (persists across reloads).
const cacheIndex = new Map<string, number>();

// ─── Public API ───────────────────────────────────────────────────────

export async function speak(text: string, opts: SpeakOpts = {}): Promise<void> {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return;

  const voice = opts.voice ?? DEFAULT_VOICE;
  const model = opts.model ?? DEFAULT_MODEL;

  await stop();
  isSpeakingFlag = true;

  try {
    const blobUrl = await getOrFetchAudio(trimmed, voice, model);
    await playBlobUrl(blobUrl, trimmed, opts.onDone);
  } catch (err) {
    console.warn("tts-web.speak: falling back to speechSynthesis:", err);
    fallbackSpeak(trimmed, opts.onDone);
  }
}

export async function stop(): Promise<void> {
  isSpeakingFlag = false;

  if (currentAudio) {
    const audio = currentAudio;
    currentAudio = null;
    audio.pause();
    audio.src = "";
  }

  try {
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
}

export function isSpeaking(): boolean {
  return isSpeakingFlag;
}

export async function prewarm(
  text: string | undefined | null,
  opts: SpeakOpts = {}
): Promise<void> {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return;
  const voice = opts.voice ?? DEFAULT_VOICE;
  const model = opts.model ?? DEFAULT_MODEL;
  try {
    await getOrFetchAudio(trimmed, voice, model);
  } catch (err) {
    console.warn("tts-web.prewarm failed:", err);
  }
}

export async function clearCache(): Promise<void> {
  cacheIndex.clear();
  if (typeof caches !== "undefined") {
    try {
      await caches.delete(CACHE_NAME);
    } catch (err) {
      console.warn("tts-web.clearCache failed:", err);
    }
  }
}

// ─── Cache key ────────────────────────────────────────────────────────

function djb2Hex(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

export function _cacheKey(text: string, voice: string, model: string): string {
  return djb2Hex(`${voice}::${model}::${text}`);
}

// ─── Network ──────────────────────────────────────────────────────────

async function fetchTTSAudio(
  text: string,
  voice: string,
  model: string
): Promise<ArrayBuffer> {
  // Use supabase session token when available; fall back to anon key.
  // supabase-js's functions.invoke parses every response as JSON — we POST
  // directly to keep the binary audio bytes intact (same pattern as mobile).
  const session = (await supabase.auth.getSession()).data.session;
  const accessToken = session?.access_token ?? SUPABASE_ANON_KEY;

  const ctrl = new AbortController();
  const timeoutId = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);

  try {
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/tts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ text, voice, model }),
      signal: ctrl.signal,
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      throw new Error(`TTS HTTP ${resp.status}: ${errText.slice(0, 200)}`);
    }

    const ab = await resp.arrayBuffer();
    if (!ab || ab.byteLength === 0) throw new Error("TTS returned zero bytes");
    return ab;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─── Cache + fetch orchestration ─────────────────────────────────────

async function getOrFetchAudio(
  text: string,
  voice: string,
  model: string
): Promise<string> {
  const key = _cacheKey(text, voice, model);
  const cacheUrl = `/tts-cache/${key}`;

  // Try persistent Cache API first.
  if (typeof caches !== "undefined") {
    try {
      const cache = await caches.open(CACHE_NAME);
      const hit = await cache.match(cacheUrl);
      if (hit) {
        const ab = await hit.arrayBuffer();
        cacheIndex.set(key, Date.now());
        return URL.createObjectURL(new Blob([ab], { type: "audio/mpeg" }));
      }
    } catch {
      /* Cache API unavailable — proceed to fetch */
    }
  }

  const ab = await fetchTTSAudio(text, voice, model);

  // Store in Cache API.
  if (typeof caches !== "undefined") {
    try {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(
        cacheUrl,
        new Response(ab.slice(0), { headers: { "Content-Type": "audio/mpeg" } })
      );
    } catch {
      /* ignore — playback still works without caching */
    }
  }

  cacheIndex.set(key, Date.now());
  await evictIfNeeded();

  return URL.createObjectURL(new Blob([ab], { type: "audio/mpeg" }));
}

async function evictIfNeeded(): Promise<void> {
  if (cacheIndex.size <= MAX_CACHE_ENTRIES) return;
  const sorted = [...cacheIndex.entries()].sort((a, b) => a[1] - b[1]);
  const overflow = sorted.length - MAX_CACHE_ENTRIES;
  if (typeof caches !== "undefined") {
    try {
      const cache = await caches.open(CACHE_NAME);
      for (let i = 0; i < overflow; i++) {
        const [k] = sorted[i];
        await cache.delete(`/tts-cache/${k}`);
        cacheIndex.delete(k);
      }
    } catch {
      for (let i = 0; i < overflow; i++) cacheIndex.delete(sorted[i][0]);
    }
  } else {
    for (let i = 0; i < overflow; i++) cacheIndex.delete(sorted[i][0]);
  }
}

// ─── Playback ─────────────────────────────────────────────────────────

async function playBlobUrl(
  blobUrl: string,
  textForFallback: string,
  onDone?: () => void
): Promise<void> {
  const audio = new Audio(blobUrl);
  currentAudio = audio;

  const cleanup = () => {
    URL.revokeObjectURL(blobUrl);
    if (currentAudio === audio) currentAudio = null;
    isSpeakingFlag = false;
  };

  audio.addEventListener(
    "ended",
    () => {
      cleanup();
      onDone?.();
    },
    { once: true }
  );

  try {
    await audio.play();
  } catch (err) {
    cleanup();
    console.warn(
      "tts-web: HTMLAudioElement.play() blocked (autoplay policy?), falling back to speechSynthesis:",
      err
    );
    isSpeakingFlag = true;
    fallbackSpeak(textForFallback, onDone);
  }
}

// ─── Fallback: window.speechSynthesis ────────────────────────────────

function fallbackSpeak(text: string, onDone?: () => void): void {
  if (typeof speechSynthesis === "undefined") {
    isSpeakingFlag = false;
    onDone?.();
    return;
  }

  isSpeakingFlag = true;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.85;

  // Prefer an online English voice that sounds closest to nova.
  const voices = speechSynthesis.getVoices();
  const voice =
    voices.find((v) => v.lang.startsWith("en") && !v.localService) ??
    voices.find((v) => v.lang.startsWith("en"));
  if (voice) utterance.voice = voice;

  const done = () => {
    isSpeakingFlag = false;
    onDone?.();
  };
  utterance.onend = done;
  utterance.onerror = done;

  speechSynthesis.speak(utterance);
}
