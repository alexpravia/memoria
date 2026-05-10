// Supabase Edge Function: tts
// Proxies a short text payload to OpenAI's TTS endpoint and returns the
// raw audio bytes. The client-side `src/lib/tts.ts` wrapper handles
// caching and a fallback to `expo-speech` if this function is
// unreachable.

const TTS_API_URL = Deno.env.get("TTS_API_URL") || "https://api.openai.com/v1/audio/speech";
const LLM_API_KEY = Deno.env.get("LLM_API_KEY") || "";
const TTS_MODEL = Deno.env.get("TTS_MODEL") || "tts-1";
const TTS_VOICE = Deno.env.get("TTS_VOICE") || "nova";

const ALLOWED_VOICES = new Set(["alloy", "echo", "fable", "onyx", "nova", "shimmer"]);
const ALLOWED_FORMATS = new Set(["mp3", "opus", "aac", "flac"]);

const MIME_BY_FORMAT: Record<string, string> = {
  mp3: "audio/mpeg",
  opus: "audio/ogg",
  aac: "audio/aac",
  flac: "audio/flac",
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonError(405, "Method not allowed");
  }

  try {
    const { text, voice, model, format } = await req.json();

    if (typeof text !== "string" || text.trim().length === 0) {
      return jsonError(400, "text is required");
    }
    if (text.length > 4000) {
      return jsonError(400, "text exceeds 4000 character limit");
    }
    if (!LLM_API_KEY) {
      return jsonError(500, "LLM API key not configured");
    }

    const chosenVoice = (typeof voice === "string" && voice) || TTS_VOICE;
    if (!ALLOWED_VOICES.has(chosenVoice)) {
      return jsonError(400, `voice must be one of: ${[...ALLOWED_VOICES].join(", ")}`);
    }

    const chosenModel = (typeof model === "string" && model) || TTS_MODEL;

    const chosenFormat = (typeof format === "string" && format) || "mp3";
    if (!ALLOWED_FORMATS.has(chosenFormat)) {
      return jsonError(400, `format must be one of: ${[...ALLOWED_FORMATS].join(", ")}`);
    }

    const upstream = await fetch(TTS_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LLM_API_KEY}`,
      },
      body: JSON.stringify({
        model: chosenModel,
        input: text,
        voice: chosenVoice,
        response_format: chosenFormat,
      }),
    });

    if (!upstream.ok) {
      const errorText = await upstream.text();
      return jsonError(502, `TTS upstream error: ${errorText}`);
    }

    const audio = await upstream.arrayBuffer();
    return new Response(audio, {
      headers: {
        ...CORS_HEADERS,
        "Content-Type": MIME_BY_FORMAT[chosenFormat] || "application/octet-stream",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err) {
    return jsonError(500, (err as Error)?.message || "Unknown error");
  }
});
