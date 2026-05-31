// Client-side TTS wrapper.
//
// Replaces direct `expo-speech` usage in the user-facing screens with a
// higher-quality OpenAI TTS pipeline (default voice: `nova` — warm,
// female, calming — important for elderly users). All audio is fetched
// through the Supabase `tts` Edge Function and cached on disk so repeat
// playback (replays, common briefing slides) is instant.
//
// If the Edge Function is unreachable, fails, or takes longer than
// 5 seconds we fall back to `expo-speech` so the user is never left in
// silence. The public API mirrors the small slice of `expo-speech` we
// actually used: `speak`, `stop`, `isSpeaking`, plus a few wrapper-only
// helpers (`prewarm`, `clearCache`).

// `expo-file-system` ships transitively via `expo` (it's a direct
// dependency of the `expo` package) but isn't listed at the top of this
// app's package.json. Metro / Expo's autolinking resolves it at
// runtime, but TypeScript can't see it from user-land code. The
// ambient declaration below is a type-only shim — same pattern Wave 1
// used for `expo-image-manipulator`. Vitest test files use `vi.mock`
// to provide the implementation; production uses the real native
// module. If the module fails to load at runtime (extremely
// unexpected) the wrapper falls back to `expo-speech` so the user is
// never silent.
// @ts-ignore — type-only shim until expo-file-system is hoisted
import * as FileSystem from "expo-file-system/legacy";
import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import type { AudioPlayer, AudioStatus } from "expo-audio";
import * as Speech from "expo-speech";
import { supabase } from "./supabase";

const fileSystemAvailable =
  !!FileSystem && typeof (FileSystem as any).cacheDirectory === "string";

// ─── Configuration ──────────────────────────────────────────────────

const DEFAULT_VOICE = "nova";
const DEFAULT_MODEL = "tts-1";
const FETCH_TIMEOUT_MS = 5000;
const MAX_CACHE_ENTRIES = 50;
// Soft on-disk budget (tracked best-effort via entry count rather than
// per-file byte size — average TTS clip ≈ 30–80KB so 50 entries ≈ 4MB).
const CACHE_DIR = fileSystemAvailable ? `${(FileSystem as any).cacheDirectory}tts/` : "";
const CACHE_INDEX_PATH = `${CACHE_DIR}cache_index.json`;

// Mirror the hardcoded values in `./supabase.ts`. The Supabase client
// doesn't expose its URL/anon key publicly, and supabase-js's
// `functions.invoke` mishandles binary responses (it tries to JSON-
// parse the audio bytes), so we POST to the Edge Function endpoint
// directly with `fetch` and need the credentials here.
const SUPABASE_URL = "https://zpxyqomebbjadqvgpapw.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_zuXXnzGR2Ba-JsL3awTQsQ_JyoQQZVC";

// ─── Module state ───────────────────────────────────────────────────

let currentPlayer: AudioPlayer | null = null;
// True from the moment `speak()` is invoked until the audio (or
// fallback Speech.speak) finishes / is stopped.
let isSpeakingFlag = false;
let cacheIndex: Record<string, { last_used_at: number }> = {};
let cacheLoaded = false;
let audioModeConfigured = false;

interface SpeakOpts {
  voice?: string;
  model?: string;
  onDone?: () => void;
}

// ─── Public API ─────────────────────────────────────────────────────

export async function speak(text: string, opts: SpeakOpts = {}): Promise<void> {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return;

  const voice = opts.voice ?? DEFAULT_VOICE;
  const model = opts.model ?? DEFAULT_MODEL;

  // Always stop whatever's currently playing before starting a new clip.
  await stop();
  isSpeakingFlag = true;

  try {
    const uri = await getOrFetchAudio(trimmed, voice, model);
    await playFile(uri, opts.onDone);
  } catch (err) {
    console.warn("tts.speak: falling back to expo-speech:", err);
    fallbackSpeak(trimmed, opts.onDone);
  }
}

export async function stop(): Promise<void> {
  isSpeakingFlag = false;
  // Stop both audio sources — either could be active depending on
  // whether the most recent `speak()` succeeded or fell back.
  if (currentPlayer) {
    const p = currentPlayer;
    currentPlayer = null;
    try {
      p.pause();
    } catch {
      /* ignore */
    }
    try {
      p.remove();
    } catch {
      /* ignore */
    }
  }
  try {
    Speech.stop();
  } catch {
    /* ignore */
  }
}

export function isSpeaking(): boolean {
  return isSpeakingFlag;
}

// Fire-and-forget warm-up: fetch + cache audio for an upcoming line
// without playing it. Used by `BriefingScreen` to pre-fetch slide N+1
// while slide N is reading.
export async function prewarm(text: string | undefined | null, opts: SpeakOpts = {}): Promise<void> {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return;
  const voice = opts.voice ?? DEFAULT_VOICE;
  const model = opts.model ?? DEFAULT_MODEL;
  try {
    await getOrFetchAudio(trimmed, voice, model);
  } catch (err) {
    // Prewarm failures are non-fatal — the live `speak()` call will
    // either succeed on retry or fall back to expo-speech.
    console.warn("tts.prewarm failed:", err);
  }
}

export async function clearCache(): Promise<void> {
  cacheIndex = {};
  cacheLoaded = false;
  if (!fileSystemAvailable) return;
  try {
    await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true });
  } catch (err) {
    console.warn("tts.clearCache failed:", err);
  }
}

// ─── Cache helpers ──────────────────────────────────────────────────

function djb2Hex(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    // (hash * 33) ^ char — classic djb2 xor variant
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

export function _cacheKey(text: string, voice: string, model: string): string {
  return djb2Hex(`${voice}::${model}::${text}`);
}

async function ensureCacheDir(): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(CACHE_DIR);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
    }
  } catch (err) {
    console.warn("tts: ensureCacheDir failed:", err);
  }
}

async function loadCacheIndex(): Promise<void> {
  if (cacheLoaded) return;
  cacheLoaded = true;
  try {
    const info = await FileSystem.getInfoAsync(CACHE_INDEX_PATH);
    if (info.exists) {
      const raw = await FileSystem.readAsStringAsync(CACHE_INDEX_PATH);
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        cacheIndex = parsed as Record<string, { last_used_at: number }>;
      }
    }
  } catch {
    cacheIndex = {};
  }
}

async function persistCacheIndex(): Promise<void> {
  try {
    await ensureCacheDir();
    await FileSystem.writeAsStringAsync(CACHE_INDEX_PATH, JSON.stringify(cacheIndex));
  } catch (err) {
    console.warn("tts: persistCacheIndex failed:", err);
  }
}

async function evictIfNeeded(): Promise<void> {
  const entries = Object.entries(cacheIndex);
  if (entries.length <= MAX_CACHE_ENTRIES) return;
  // LRU: drop oldest by `last_used_at` until we're back under the cap.
  entries.sort((a, b) => a[1].last_used_at - b[1].last_used_at);
  const overflow = entries.length - MAX_CACHE_ENTRIES;
  for (let i = 0; i < overflow; i++) {
    const [hash] = entries[i];
    try {
      await FileSystem.deleteAsync(`${CACHE_DIR}${hash}.mp3`, { idempotent: true });
    } catch {
      /* ignore */
    }
    delete cacheIndex[hash];
  }
}

// ─── Network ────────────────────────────────────────────────────────

async function fetchTTSAudio(
  text: string,
  voice: string,
  model: string
): Promise<ArrayBuffer> {
  // supabase-js's `functions.invoke` parses every response as JSON, so
  // the binary audio bytes returned by the `tts` Edge Function come
  // back as `null`. We POST to the Edge Function URL directly to keep
  // the response intact. The session access token (or the public anon
  // key, when no user is signed in) authorizes the call exactly the
  // way `supabase.functions.invoke` would.
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
    if (!ab || ab.byteLength === 0) {
      throw new Error("TTS returned zero bytes");
    }
    return ab;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Minimal base64 encoder. React Native's `btoa` is not guaranteed to
// exist in every JS engine we ship to, and depending on `Buffer` is
// even shakier. Manual encoding keeps this file dependency-free.
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = "";
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const a = bytes[i], b = bytes[i + 1], c = bytes[i + 2];
    out += chars[a >> 2];
    out += chars[((a & 0x03) << 4) | (b >> 4)];
    out += chars[((b & 0x0f) << 2) | (c >> 6)];
    out += chars[c & 0x3f];
  }
  if (i < bytes.length) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    out += chars[a >> 2];
    out += chars[((a & 0x03) << 4) | (b >> 4)];
    if (i + 1 < bytes.length) {
      out += chars[(b & 0x0f) << 2];
      out += "=";
    } else {
      out += "==";
    }
  }
  return out;
}

// ─── Cache + fetch orchestration ────────────────────────────────────

async function getOrFetchAudio(
  text: string,
  voice: string,
  model: string
): Promise<string> {
  if (!fileSystemAvailable) {
    // Without FileSystem we have nowhere to write the audio for
    // playback. The caller will catch this and fall back to
    // `expo-speech` so the user is never left in silence.
    throw new Error("FileSystem unavailable — cannot cache TTS audio");
  }
  await loadCacheIndex();
  await ensureCacheDir();

  const key = _cacheKey(text, voice, model);
  const path = `${CACHE_DIR}${key}.mp3`;

  // Cache hit: confirm the file still exists on disk before trusting it.
  if (cacheIndex[key]) {
    const info = await FileSystem.getInfoAsync(path);
    if (info.exists) {
      cacheIndex[key].last_used_at = Date.now();
      // Fire-and-forget index save so playback isn't blocked on disk I/O.
      persistCacheIndex();
      return path;
    }
    // Stale index entry; drop it and re-fetch.
    delete cacheIndex[key];
  }

  const ab = await fetchTTSAudio(text, voice, model);
  const b64 = arrayBufferToBase64(ab);
  await FileSystem.writeAsStringAsync(path, b64, {
    encoding: (FileSystem as any).EncodingType?.Base64 ?? "base64",
  });

  cacheIndex[key] = { last_used_at: Date.now() };
  await evictIfNeeded();
  await persistCacheIndex();
  return path;
}

// ─── Playback ───────────────────────────────────────────────────────

async function configureAudioMode(): Promise<void> {
  if (audioModeConfigured) return;
  try {
    await setAudioModeAsync({
      // Critical for elderly users who may have the iPhone silent
      // switch flipped on without realizing — without this, the
      // briefing plays no sound.
      playsInSilentMode: true,
      shouldPlayInBackground: false,
    });
    audioModeConfigured = true;
  } catch (err) {
    console.warn("tts: setAudioModeAsync failed:", err);
  }
}

async function playFile(uri: string, onDone?: () => void): Promise<void> {
  await configureAudioMode();

  // `createAudioPlayer` returns a manually-managed player (we own
  // calling `.remove()`). The hooks-based API would only fit inside a
  // React component, but this wrapper has to work from non-component
  // call sites too (briefing scheduler, prewarm, assistant).
  const player = createAudioPlayer({ uri });
  currentPlayer = player;

  player.addListener("playbackStatusUpdate", (status: AudioStatus) => {
    if (!status.isLoaded) return;
    if (status.didJustFinish) {
      isSpeakingFlag = false;
      // Only clear the module-level reference if it still points at
      // this player (a newer `speak()` may have replaced it).
      if (currentPlayer === player) {
        currentPlayer = null;
      }
      // Best-effort cleanup; ignore failures.
      try {
        player.remove();
      } catch {
        /* ignore */
      }
      onDone?.();
    }
  });

  player.play();
}

function fallbackSpeak(text: string, onDone?: () => void): void {
  // Mirror the previous expo-speech configuration so pacing/voice are
  // close to what the briefing/assistant screens used before.
  Speech.speak(text, {
    language: "en",
    rate: 0.85,
    onDone: () => {
      isSpeakingFlag = false;
      onDone?.();
    },
    onStopped: () => {
      isSpeakingFlag = false;
    },
    onError: () => {
      isSpeakingFlag = false;
    },
  });
}
