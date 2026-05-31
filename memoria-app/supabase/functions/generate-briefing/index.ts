// Supabase Edge Function: generate-briefing
//
// AI-orchestrated daily briefings (Phase E). Called by the co-user
// preview screen (and overnight by the human ops process; cron is out
// of scope for Phase E).
//
// Input:  { userId: string, date?: "YYYY-MM-DD" }
// Output: { briefing: { id, user_id, briefing_date, slides, status } }
//         or { error: string, briefing?: { ... status: 'failed' } }
//
// Behavior:
//   1. Service-role client gathers profile, today's events, top
//      assistant memories, sensitivity rules, and a candidate photo
//      pool in parallel.
//   2. Filters the photo pool against cached sensitivity decisions.
//      (Cache-only here — TODO: invoke check-sensitivity for misses.)
//   3. Prompts gpt-4o-mini in JSON mode for 6-12 ordered slides.
//   4. Validates server-side. If invalid, retries once with a
//      corrective message; if still invalid, persists status='failed'
//      with `generation_error` and returns an error envelope.
//   5. On success upserts onConflict (user_id, briefing_date) and
//      returns the row with status='draft'.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const LLM_API_URL =
  Deno.env.get("LLM_API_URL") ||
  "https://api.openai.com/v1/chat/completions";
const LLM_API_KEY = Deno.env.get("LLM_API_KEY") || "";
const LLM_MODEL = Deno.env.get("LLM_MODEL") || "gpt-4o-mini";
// Briefings generate asynchronously (co-user preview / overnight), so we can
// afford a stronger, slower model here than the latency-critical assistant.
// Falls back to LLM_MODEL when unset, preserving the single-model default and
// the project's provider-agnostic env contract.
const BRIEFING_LLM_MODEL = Deno.env.get("BRIEFING_LLM_MODEL") || LLM_MODEL;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SLIDE_KINDS = [
  "greeting",
  "fact",
  "person",
  "memory_photo",
  "event",
  "reassurance",
  "pinned_note",
];

const URL_RE = /\b(?:https?:\/\/|www\.)\S+/i;
const UUID_RE =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;

// Strict JSON Schema for the slide deck. Structured Outputs guarantees the
// `{ slides: [...] }` shape and per-slide field/enum validity, so the model can
// no longer emit malformed JSON that sends a whole briefing to status 'failed'.
// NOTE: this does NOT replace validateSlides — strict mode cannot enforce the
// 6–12 count, non-empty-after-trim, no-URL/UUID-in-tts_text, or photo_id pool
// membership. `photo_id` is nullable (strict mode requires every property in
// `required`); validateSlides already strips null/empty photo_id.
const BRIEFING_DECK_SCHEMA = {
  name: "briefing_deck",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["slides"],
    properties: {
      slides: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["kind", "title", "body", "tts_text", "photo_id"],
          properties: {
            kind: { type: "string", enum: SLIDE_KINDS },
            title: { type: "string" },
            body: { type: "string" },
            tts_text: { type: "string" },
            photo_id: { type: ["string", "null"] },
          },
        },
      },
    },
  },
};

interface Slide {
  kind: string;
  title: string;
  body: string;
  tts_text: string;
  photo_id?: string;
}

function validateSlides(
  slides: any,
  candidatePhotoIds: string[]
): { ok: true; slides: Slide[] } | { ok: false; reason: string } {
  if (!Array.isArray(slides)) {
    return { ok: false, reason: "slides must be a JSON array" };
  }
  if (slides.length < 6 || slides.length > 12) {
    return {
      ok: false,
      reason: `slide count out of range: ${slides.length} (expected 6-12)`,
    };
  }
  const pool = new Set(candidatePhotoIds);
  for (let i = 0; i < slides.length; i++) {
    const s = slides[i];
    if (!s || typeof s !== "object") {
      return { ok: false, reason: `slide ${i} must be an object` };
    }
    // Normalize: the model occasionally emits photo_id as something
    // other than a non-empty string — null, "", [], {}, a number, a
    // boolean, etc. All of those mean "no photo". Strip the field so
    // downstream code can rely on `photo_id` being either undefined
    // or a real id.
    const pid = (s as any).photo_id;
    if (pid !== undefined && (typeof pid !== "string" || pid.length === 0)) {
      delete (s as any).photo_id;
    }
    if (typeof s.kind !== "string" || !SLIDE_KINDS.includes(s.kind)) {
      return { ok: false, reason: `slide ${i}: unknown kind ${s.kind}` };
    }
    if (typeof s.title !== "string" || !s.title.trim()) {
      return { ok: false, reason: `slide ${i}: title is required` };
    }
    if (typeof s.body !== "string" || !s.body.trim()) {
      return { ok: false, reason: `slide ${i}: body is required` };
    }
    if (typeof s.tts_text !== "string" || !s.tts_text.trim()) {
      return { ok: false, reason: `slide ${i}: tts_text is required` };
    }
    if (URL_RE.test(s.tts_text)) {
      return { ok: false, reason: `slide ${i}: tts_text must not contain URLs` };
    }
    if (UUID_RE.test(s.tts_text)) {
      return {
        ok: false,
        reason: `slide ${i}: tts_text must not contain raw IDs`,
      };
    }
    if (s.photo_id !== undefined) {
      // Sanitization above guarantees s.photo_id is a non-empty string here.
      if (pool.size > 0 && !pool.has(s.photo_id)) {
        return {
          ok: false,
          reason: `slide ${i}: photo_id ${s.photo_id} not in candidate pool`,
        };
      }
    }
  }
  return { ok: true, slides: slides as Slide[] };
}

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

function buildSystemPrompt(name: string): string {
  return [
    `You produce daily morning briefings for a person with memory difficulties named ${name}.`,
    "",
    "Inputs: their profile, today's date and events, things you remember about them, a pool of photos referenced by ID.",
    "",
    "Return ONLY a JSON object of the form { \"slides\": [...] } containing 6 to 12 slides. No prose, no markdown.",
    "",
    "Each slide:",
    "{ \"kind\": \"<greeting|fact|person|memory_photo|event|reassurance|pinned_note>\",",
    "  \"title\": \"short title\",",
    "  \"body\": \"what shows on screen\",",
    "  \"tts_text\": \"what is read aloud (warm, complete sentences, no URLs, no raw IDs)\",",
    "  \"photo_id\": \"<OPTIONAL — only include when you have a real string id from the candidate pool. If you don't have one, OMIT the field entirely. NEVER return null, empty string, an array, an object, a number, or a boolean for this field.>\" }",
    "",
    "Order: lead with most grounding content for THIS user TODAY. If a difficult appointment is today, ground them with that early but warmly. If recent memories suggest anxiety, open softer. End with reassurance.",
    "",
    "Voice: warm, gentle, second-person (\"You\"), short sentences.",
  ].join("\n");
}

function buildUserPrompt(payload: {
  date: string;
  profile: any;
  facts: any[];
  people: any[];
  events: any[];
  memories: any[];
  photos: Array<{ id: string; description?: string | null; tags?: any }>;
  pinnedNotes: any[];
}): string {
  return [
    `Date: ${payload.date}`,
    "",
    "PROFILE:",
    JSON.stringify(payload.profile ?? {}, null, 2),
    "",
    "LIFE FACTS:",
    JSON.stringify(payload.facts, null, 2),
    "",
    "PEOPLE:",
    JSON.stringify(payload.people, null, 2),
    "",
    "TODAY'S EVENTS:",
    JSON.stringify(payload.events, null, 2),
    "",
    "ACTIVE MEMORIES (assistant has noticed):",
    JSON.stringify(payload.memories, null, 2),
    "",
    "PINNED NOTES (things they want to remember):",
    JSON.stringify(payload.pinnedNotes, null, 2),
    "",
    "CANDIDATE PHOTO POOL (photo_id → description):",
    JSON.stringify(payload.photos, null, 2),
    "",
    "Return JSON only.",
  ].join("\n");
}

async function callLLM(messages: any[]): Promise<any> {
  const response = await fetch(LLM_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LLM_API_KEY}`,
    },
    body: JSON.stringify({
      model: BRIEFING_LLM_MODEL,
      messages,
      temperature: 0.7,
      response_format: { type: "json_schema", json_schema: BRIEFING_DECK_SCHEMA },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM error ${response.status}: ${errorText}`);
  }
  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content || "";
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("LLM returned non-JSON content");
  }
  // The model wraps slides in { slides: [...] } per JSON-mode constraint.
  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.slides)) return parsed.slides;
  if (parsed && Array.isArray(parsed.briefing)) return parsed.briefing;
  throw new Error("LLM response missing 'slides' array");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const { userId, date } = await req.json();
    if (!userId || typeof userId !== "string") {
      return new Response(
        JSON.stringify({ error: "userId is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    if (!LLM_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LLM API key not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ error: "Supabase service credentials not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const briefingDate = (date && typeof date === "string") ? date : todayISO();
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // ── Gather context in parallel ─────────────────────────────────
    const dayStart = `${briefingDate}T00:00:00Z`;
    const dayEnd = `${briefingDate}T23:59:59Z`;

    const [
      profileRes,
      factsRes,
      peopleRes,
      eventsRes,
      memoriesRes,
      rulesRes,
      photosRes,
      pinnedNotesRes,
    ] = await Promise.all([
      supabase.from("users").select("*").eq("id", userId).maybeSingle(),
      supabase
        .from("life_facts")
        .select("fact, category, display_order")
        .eq("user_id", userId)
        .order("display_order"),
      supabase
        .from("people")
        .select("id, full_name, relationship, key_facts, emotional_notes")
        .eq("user_id", userId),
      supabase
        .from("events")
        .select("title, description, event_date, event_type")
        .eq("user_id", userId)
        .gte("event_date", dayStart)
        .lte("event_date", dayEnd)
        .order("event_date"),
      supabase
        .from("assistant_memory")
        .select("kind, content, importance, status")
        .eq("user_id", userId)
        .neq("status", "suppressed")
        .order("status", { ascending: true }) // 'pinned' before 'active'
        .order("importance", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("sensitivity_filters")
        .select(
          "id, filter_type, filter_value, person_id, start_date, end_date, intent_text"
        )
        .eq("user_id", userId),
      supabase
        .from("media")
        .select("id, description, ai_tags")
        .eq("user_id", userId)
        .eq("verification_status", "verified")
        .order("taken_at", { ascending: false, nullsFirst: false })
        .limit(20),
      supabase
        .from("pinned_notes")
        .select("content")
        .eq("user_id", userId)
        .eq("is_active", true),
    ]);

    const profile = profileRes.data;
    if (!profile) {
      return new Response(
        JSON.stringify({ error: "user not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const allPhotos = (photosRes.data ?? []) as Array<{
      id: string;
      description: string | null;
      ai_tags: any;
    }>;

    // ── Filter photo pool against cached sensitivity decisions ─────
    // Cache-only: photos without a cached decision are allowed.
    // TODO(phase-E-followup): for misses, invoke `check-sensitivity`
    // here so the briefing pipeline pre-fills the cache instead of
    // relying on prior runs.
    let allowedPhotos = allPhotos;
    if (allPhotos.length > 0 && (rulesRes.data ?? []).length > 0) {
      const { data: decisions } = await supabase
        .from("sensitivity_decisions")
        .select("item_id, allow")
        .eq("user_id", userId)
        .eq("item_kind", "media")
        .in(
          "item_id",
          allPhotos.map((p) => p.id)
        );
      const deny = new Set(
        ((decisions ?? []) as Array<{ item_id: string; allow: boolean }>)
          .filter((d) => d.allow === false)
          .map((d) => d.item_id)
      );
      allowedPhotos = allPhotos.filter((p) => !deny.has(p.id));
    }

    const photoPool = allowedPhotos.map((p) => ({
      id: p.id,
      description: p.description,
      tags: p.ai_tags,
    }));
    const candidatePhotoIds = photoPool.map((p) => p.id);

    // ── Build prompt ───────────────────────────────────────────────
    const systemPrompt = buildSystemPrompt(profile.full_name ?? "this person");
    const userPrompt = buildUserPrompt({
      date: briefingDate,
      profile: {
        full_name: profile.full_name,
        location: profile.location,
        date_of_birth: profile.date_of_birth,
        cognitive_level: profile.cognitive_level,
      },
      facts: factsRes.data ?? [],
      people: peopleRes.data ?? [],
      events: eventsRes.data ?? [],
      memories: memoriesRes.data ?? [],
      photos: photoPool,
      pinnedNotes: pinnedNotesRes.data ?? [],
    });

    // ── Call LLM with one retry on validation failure ──────────────
    const messages: any[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    let slides: Slide[] | null = null;
    let lastReason = "";

    try {
      const first = await callLLM(messages);
      const v = validateSlides(first, candidatePhotoIds);
      if (v.ok) {
        slides = v.slides;
      } else {
        lastReason = v.reason;
        // Retry once with a corrective message.
        const retryMessages = [
          ...messages,
          { role: "assistant", content: JSON.stringify({ slides: first }) },
          {
            role: "user",
            content: `Your previous response failed validation: ${v.reason}. Return a corrected JSON object { "slides": [...] } that satisfies all constraints. Slide count must be between 6 and 12. Every photo_id must be from the candidate pool above.`,
          },
        ];
        const second = await callLLM(retryMessages);
        const v2 = validateSlides(second, candidatePhotoIds);
        if (v2.ok) {
          slides = v2.slides;
        } else {
          lastReason = v2.reason;
        }
      }
    } catch (err: any) {
      lastReason = err?.message ?? "LLM call failed";
    }

    if (!slides) {
      // Persist failure so the co-user UI can surface it.
      const { data: failed } = await supabase
        .from("briefings")
        .upsert(
          {
            user_id: userId,
            briefing_date: briefingDate,
            slides: [],
            status: "failed",
            generation_error: lastReason || "unknown error",
            generated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,briefing_date" }
        )
        .select("id, user_id, briefing_date, slides, status")
        .single();
      return new Response(
        JSON.stringify({
          error: lastReason || "briefing generation failed",
          briefing: failed ?? null,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // ── Persist successful draft ───────────────────────────────────
    const { data: row, error: upErr } = await supabase
      .from("briefings")
      .upsert(
        {
          user_id: userId,
          briefing_date: briefingDate,
          slides,
          status: "draft",
          generated_at: new Date().toISOString(),
          generation_error: null,
        },
        { onConflict: "user_id,briefing_date" }
      )
      .select("id, user_id, briefing_date, slides, status")
      .single();

    if (upErr) {
      return new Response(
        JSON.stringify({ error: `persist failed: ${upErr.message}` }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ briefing: row }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message ?? "generate-briefing threw" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
