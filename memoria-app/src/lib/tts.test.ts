// Unit tests for the OpenAI TTS wrapper.
//
// We mock `expo-audio`, `expo-file-system/legacy`, `expo-speech`, the
// supabase client, and `global.fetch` so the wrapper can be exercised
// in pure Node without actually loading native modules.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mock state (mutated per test) ──────────────────────────────────

interface FsState {
  files: Map<string, { contents: string; isDirectory: boolean }>;
  writeCalls: Array<{ uri: string; encoding?: string }>;
  deleteCalls: string[];
  makeDirCalls: string[];
}

const fs: FsState = {
  files: new Map(),
  writeCalls: [],
  deleteCalls: [],
  makeDirCalls: [],
};

interface PlayerState {
  uri: string;
  finishHandler?: (s: { isLoaded: boolean; didJustFinish: boolean }) => void;
  played: boolean;
  paused: boolean;
  removed: boolean;
}
const playerInstances: PlayerState[] = [];

const audioState = {
  setAudioModeCalls: 0,
};

const speechState = {
  speakCalls: [] as Array<{ text: string; opts: any }>,
  stopCalls: 0,
};

interface FetchResponseShape {
  ok: boolean;
  status: number;
  body: ArrayBuffer | string; // string used to simulate error body
}

const fetchState = {
  calls: [] as Array<{ url: string; init?: any }>,
  // Default: return a non-empty audio buffer.
  impl: async (_url: string, _init?: any): Promise<FetchResponseShape> => ({
    ok: true,
    status: 200,
    body: makeAudioBuffer(),
  }),
};

// ─── Mocks ──────────────────────────────────────────────────────────

vi.mock("expo-file-system/legacy", () => {
  const cacheDirectory = "file:///cache/";
  return {
    cacheDirectory,
    EncodingType: { Base64: "base64", UTF8: "utf8" },
    getInfoAsync: vi.fn(async (uri: string) => {
      const entry = fs.files.get(uri);
      return entry
        ? { exists: true, isDirectory: entry.isDirectory, uri }
        : { exists: false, isDirectory: false };
    }),
    makeDirectoryAsync: vi.fn(async (uri: string) => {
      fs.makeDirCalls.push(uri);
      fs.files.set(uri, { contents: "", isDirectory: true });
    }),
    readAsStringAsync: vi.fn(async (uri: string) => {
      const entry = fs.files.get(uri);
      if (!entry) throw new Error(`No such file: ${uri}`);
      return entry.contents;
    }),
    writeAsStringAsync: vi.fn(async (uri: string, contents: string, opts?: any) => {
      fs.writeCalls.push({ uri, encoding: opts?.encoding });
      fs.files.set(uri, { contents, isDirectory: false });
    }),
    deleteAsync: vi.fn(async (uri: string) => {
      fs.deleteCalls.push(uri);
      // Remove the entry plus anything beneath it (directory delete).
      for (const key of Array.from(fs.files.keys())) {
        if (key === uri || key.startsWith(uri)) fs.files.delete(key);
      }
    }),
  };
});

vi.mock("expo-audio", () => {
  return {
    setAudioModeAsync: vi.fn(async () => {
      audioState.setAudioModeCalls++;
    }),
    createAudioPlayer: vi.fn((source: { uri: string }) => {
      const inst: PlayerState = {
        uri: source.uri,
        played: false,
        paused: false,
        removed: false,
      };
      playerInstances.push(inst);
      const player = {
        play: vi.fn(() => {
          inst.played = true;
        }),
        pause: vi.fn(() => {
          inst.paused = true;
        }),
        remove: vi.fn(() => {
          inst.removed = true;
        }),
        addListener: vi.fn((event: string, cb: any) => {
          if (event === "playbackStatusUpdate") {
            inst.finishHandler = cb;
          }
        }),
      };
      return player;
    }),
  };
});

vi.mock("expo-speech", () => ({
  speak: vi.fn((text: string, opts: any) => {
    speechState.speakCalls.push({ text, opts });
    // Auto-fire onDone synchronously for assertion convenience.
    opts?.onDone?.();
  }),
  stop: vi.fn(() => {
    speechState.stopCalls++;
  }),
}));

vi.mock("./supabase", () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: null } }),
    },
  },
}));

// Module under test — imported AFTER the mocks above are registered.
import * as tts from "./tts";

// ─── Helpers ────────────────────────────────────────────────────────

function makeAudioBuffer(): ArrayBuffer {
  // Tiny non-empty buffer; contents don't matter for these tests.
  const u8 = new Uint8Array([1, 2, 3, 4, 5, 6]);
  return u8.buffer;
}

function flushMicrotasks(): Promise<void> {
  return new Promise((r) => setImmediate(r));
}

// ─── Setup / teardown ───────────────────────────────────────────────

beforeEach(async () => {
  fs.files.clear();
  fs.writeCalls.length = 0;
  fs.deleteCalls.length = 0;
  fs.makeDirCalls.length = 0;
  playerInstances.length = 0;
  audioState.setAudioModeCalls = 0;
  speechState.speakCalls.length = 0;
  speechState.stopCalls = 0;
  fetchState.calls.length = 0;
  fetchState.impl = async () => ({
    ok: true,
    status: 200,
    body: makeAudioBuffer(),
  });

  // Install the global fetch mock used by tts.fetchTTSAudio.
  (global as any).fetch = vi.fn(async (url: string, init?: any) => {
    fetchState.calls.push({ url, init });
    const result = await fetchState.impl(url, init);
    const bodyIsBuffer = result.body instanceof ArrayBuffer;
    return {
      ok: result.ok,
      status: result.status,
      arrayBuffer: async () => (bodyIsBuffer ? (result.body as ArrayBuffer) : new ArrayBuffer(0)),
      text: async () => (bodyIsBuffer ? "" : (result.body as string)),
    };
  });

  // Reset the wrapper's cached state.
  await tts.clearCache();
  // Stop should reset isSpeaking / detach any sound from a prior test.
  await tts.stop();
});

afterEach(() => {
  vi.useRealTimers();
});

// ─── Tests ──────────────────────────────────────────────────────────

describe("tts.speak", () => {
  it("POSTs to the tts edge function URL with default voice 'nova' and model 'tts-1'", async () => {
    await tts.speak("Hello world");
    expect(fetchState.calls).toHaveLength(1);
    const call = fetchState.calls[0];
    expect(call.url).toMatch(/\/functions\/v1\/tts$/);
    expect(call.init?.method).toBe("POST");
    expect(JSON.parse(call.init?.body)).toEqual({
      text: "Hello world",
      voice: "nova",
      model: "tts-1",
    });
    // Auth headers must be present so the Edge Function accepts the call.
    expect(call.init?.headers?.Authorization).toMatch(/^Bearer /);
    expect(call.init?.headers?.apikey).toBeTruthy();
  });

  it("returns cached audio without re-fetching when the same text is spoken twice", async () => {
    await tts.speak("Hello again");
    await tts.speak("Hello again");
    expect(fetchState.calls).toHaveLength(1);
    // Two playback instances created from the same cached file.
    expect(playerInstances).toHaveLength(2);
    expect(playerInstances[0].uri).toBe(playerInstances[1].uri);
  });

  it("writes cached audio as base64", async () => {
    await tts.speak("Cache me");
    const writes = fs.writeCalls.filter((w) => w.uri.endsWith(".mp3"));
    expect(writes).toHaveLength(1);
    expect(writes[0].encoding).toBe("base64");
  });

  it("falls back to expo-speech when the edge function returns a 5xx error", async () => {
    fetchState.impl = async () => ({
      ok: false,
      status: 503,
      body: "service unavailable",
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await tts.speak("Fallback please");
    expect(speechState.speakCalls).toHaveLength(1);
    expect(speechState.speakCalls[0].text).toBe("Fallback please");
    warn.mockRestore();
  });

  it("falls back to expo-speech when the edge function returns a 0-byte body", async () => {
    fetchState.impl = async () => ({
      ok: true,
      status: 200,
      body: new ArrayBuffer(0),
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await tts.speak("Empty payload fallback");
    expect(speechState.speakCalls).toHaveLength(1);
    expect(speechState.speakCalls[0].text).toBe("Empty payload fallback");
    warn.mockRestore();
  });

  it("falls back to expo-speech when the edge function takes longer than 5 seconds", async () => {
    vi.useFakeTimers();
    // Simulate a request that hangs until aborted by the AbortController.
    (global as any).fetch = vi.fn((_url: string, init?: any) => {
      return new Promise((_resolve, reject) => {
        const signal: AbortSignal | undefined = init?.signal;
        if (signal) {
          signal.addEventListener("abort", () => {
            const err: any = new Error("Aborted");
            err.name = "AbortError";
            reject(err);
          });
        }
      });
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const speakPromise = tts.speak("Slow network");
    await vi.advanceTimersByTimeAsync(5001);
    await speakPromise;
    expect(speechState.speakCalls).toHaveLength(1);
    expect(speechState.speakCalls[0].text).toBe("Slow network");
    warn.mockRestore();
  });

  it("invokes onDone callback when audio finishes", async () => {
    const onDone = vi.fn();
    await tts.speak("Trigger callback", { onDone });
    // Simulate playback completion via the registered status handler.
    const inst = playerInstances[playerInstances.length - 1];
    expect(inst.finishHandler).toBeTypeOf("function");
    inst.finishHandler!({ isLoaded: true, didJustFinish: true });
    await flushMicrotasks();
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

describe("tts.stop", () => {
  it("releases the audio player and stops expo-speech", async () => {
    await tts.speak("Something");
    const inst = playerInstances[playerInstances.length - 1];
    await tts.stop();
    expect(inst.paused).toBe(true);
    expect(inst.removed).toBe(true);
    expect(speechState.stopCalls).toBeGreaterThanOrEqual(1);
  });
});

describe("tts.isSpeaking", () => {
  it("returns true while audio is playing and false after finish", async () => {
    await tts.speak("Status check");
    expect(tts.isSpeaking()).toBe(true);
    const inst = playerInstances[playerInstances.length - 1];
    inst.finishHandler!({ isLoaded: true, didJustFinish: true });
    await flushMicrotasks();
    expect(tts.isSpeaking()).toBe(false);
  });
});

describe("tts.clearCache", () => {
  it("removes the cache directory", async () => {
    await tts.speak("Will be cached");
    fs.deleteCalls.length = 0;
    await tts.clearCache();
    expect(fs.deleteCalls).toContain("file:///cache/tts/");
  });
});

describe("cache key", () => {
  it("is deterministic for the same voice + model + text", () => {
    const a = tts._cacheKey("hello", "nova", "tts-1");
    const b = tts._cacheKey("hello", "nova", "tts-1");
    expect(a).toBe(b);
  });

  it("differs when voice changes", () => {
    const a = tts._cacheKey("hello", "nova", "tts-1");
    const b = tts._cacheKey("hello", "alloy", "tts-1");
    expect(a).not.toBe(b);
  });

  it("differs when model changes", () => {
    const a = tts._cacheKey("hello", "nova", "tts-1");
    const b = tts._cacheKey("hello", "nova", "tts-1-hd");
    expect(a).not.toBe(b);
  });

  it("differs when text changes", () => {
    const a = tts._cacheKey("hello", "nova", "tts-1");
    const b = tts._cacheKey("world", "nova", "tts-1");
    expect(a).not.toBe(b);
  });
});

describe("tts.prewarm", () => {
  it("fetches and caches audio without playing it", async () => {
    await tts.prewarm("Pre-warm me");
    expect(fetchState.calls).toHaveLength(1);
    // No playback instance was created.
    expect(playerInstances).toHaveLength(0);
    // A subsequent speak() reuses the cached file (no new fetch).
    await tts.speak("Pre-warm me");
    expect(fetchState.calls).toHaveLength(1);
  });

  it("is a no-op for empty text", async () => {
    await tts.prewarm("");
    await tts.prewarm(undefined);
    await tts.prewarm(null);
    expect(fetchState.calls).toHaveLength(0);
  });
});
