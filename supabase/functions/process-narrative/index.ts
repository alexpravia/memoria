// Supabase Edge Function: process-narrative
//
// The "Write About Them" pipeline. A co-user dumps freeform prose about the
// patient; this function does two things:
//   1. RAG: upsert the raw narrative, re-chunk it, embed each chunk, and store
//      the chunks in narrative_chunks so Memo can retrieve them (kind:
//      'narrative'). This is the patient's context "md file".
//   2. Extraction: pull structured SUGGESTIONS out of the prose (people, life
//      facts, events, sensitivity hints) and return them for the co-user to
//      review. Nothing is written to the core tables here — the co-user accepts
//      or rejects each suggestion in the UI. Safety rule: AI never populates
//      patient-facing tables without human review.
//
// Request:  { user_id: string, raw_text: string }
// Response: { ok, chunk_count, suggestions: { people, life_facts, events, sensitivity_hints } }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const LLM_API_URL =
  Deno.env.get("LLM_API_URL") || "https://api.openai.com/v1/chat/completions";
const LLM_API_KEY = Deno.env.get("LLM_API_KEY") || "";
const LLM_MODEL = Deno.env.get("LLM_MODEL") || "gpt-4o-mini";

const EMBEDDING_API_URL =
  Deno.env.get("EMBEDDING_API_URL") || "https://api.openai.com/v1/embeddings";
const EMBEDDING_API_KEY =
  Deno.env.get("EMBEDDING_API_KEY") || Deno.env.get("LLM_API_KEY") || "";
const EMBEDDING_MODEL =
  Deno.env.get("EMBEDDING_MODEL") || "text-embedding-3-small";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const MAX_TEXT_CHARS = 50_000; // bound cost; ~12k tokens of prose
const TARGET_CHUNK_CHARS = 500;
const MAX_CHUNKS = 80;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

// Paragraph-first, sentence-fallback chunker. Keeps semantic units intact and
// only splits a paragraph when it exceeds the target size.
function chunkText(text: string): string[] {
  const clean = text.replace(/\r\n/g, "\n").trim();
  if (!clean) return [];

  const paras = clean
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  for (const para of paras) {
    if (para.length <= TARGET_CHUNK_CHARS) {
      chunks.push(para);
      continue;
    }
    const sentences = para.match(/[^.!?]+[.!?]+|\S[^.!?]*$/g) ?? [para];
    let buf = "";
    for (const s of sentences) {
      const candidate = (buf + " " + s).trim();
      if (candidate.length > TARGET_CHUNK_CHARS && buf) {
        chunks.push(buf.trim());
        buf = s.trim();
      } else {
        buf = candidate;
      }
    }
    if (buf.trim()) chunks.push(buf.trim());
  }
  return chunks.slice(0, MAX_CHUNKS);
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const res = await fetch(EMBEDDING_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${EMBEDDING_API_KEY}`,
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: texts }),
  });
  if (!res.ok) {
    throw new Error(`Embedding API error: ${await res.text()}`);
  }
  const data = await res.json();
  const items: Array<{ embedding: number[] }> = Array.isArray(data?.data)
    ? data.data
    : [];
  return items.map((it) => it.embedding);
}

// JSON-schema for the extraction call (Structured Outputs, strict). Optional
// fields are nullable rather than omitted, as strict mode requires.
const EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    people: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          relationship: { type: ["string", "null"] },
          notes: { type: ["string", "null"] },
        },
        required: ["name", "relationship", "notes"],
        additionalProperties: false,
      },
    },
    life_facts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          fact: { type: "string" },
          category: { type: ["string", "null"] },
        },
        required: ["fact", "category"],
        additionalProperties: false,
      },
    },
    events: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: ["string", "null"] },
          event_type: { type: "string", enum: ["one_time", "recurring", "routine"] },
          recurrence_rule: { type: ["string", "null"] },
        },
        required: ["title", "description", "event_type", "recurrence_rule"],
        additionalProperties: false,
      },
    },
    sensitivity_hints: {
      type: "array",
      items: {
        type: "object",
        properties: {
          intent_text: { type: "string" },
          filter_type: { type: "string", enum: ["person", "topic", "time_period"] },
        },
        required: ["intent_text", "filter_type"],
        additionalProperties: false,
      },
    },
  },
  required: ["people", "life_facts", "events", "sensitivity_hints"],
  additionalProperties: false,
};

const EMPTY_SUGGESTIONS = {
  people: [],
  life_facts: [],
  events: [],
  sensitivity_hints: [],
};

async function extractSuggestions(rawText: string) {
  const systemPrompt =
    "You extract structured facts from a caregiver's freeform notes about a " +
    "person with memory loss, for a memory-care app called Memoria. " +
    "Extract ONLY information explicitly stated or strongly implied. Never " +
    "invent. The caregiver will review every suggestion before anything is " +
    "saved, so prefer precision over recall.\n\n" +
    "- people: anyone mentioned with a relationship to the patient. " +
    "relationship is a short phrase ('daughter', 'late husband', 'neighbor'). " +
    "notes captures emotional/contextual detail.\n" +
    "- life_facts: durable facts about the patient (career, hobbies, origins, " +
    "preferences). category is a short label or null.\n" +
    "- events: routines or dated happenings. Use event_type 'routine' for " +
    "regular habits ('Sunday Italian dinner'), 'recurring' for repeating dated " +
    "events, 'one_time' otherwise. recurrence_rule is a short hint " +
    "('weekly:sunday', 'daily') or null.\n" +
    "- sensitivity_hints: anything the caregiver signals to be careful about or " +
    "avoid (a deceased person, an upsetting topic, a hard time period). " +
    "filter_type is person, topic, or time_period. intent_text describes what " +
    "to avoid in plain language.";

  const res = await fetch(LLM_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LLM_API_KEY}`,
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: rawText },
      ],
      temperature: 0.1,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "narrative_extraction",
          strict: true,
          schema: EXTRACTION_SCHEMA,
        },
      },
    }),
  });

  if (!res.ok) {
    // Extraction is best-effort: the RAG storage already succeeded, so don't
    // fail the whole request. Return empty suggestions.
    console.warn("extraction LLM error:", await res.text());
    return EMPTY_SUGGESTIONS;
  }

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content || "";
  try {
    const parsed = JSON.parse(raw);
    return {
      people: Array.isArray(parsed.people) ? parsed.people : [],
      life_facts: Array.isArray(parsed.life_facts) ? parsed.life_facts : [],
      events: Array.isArray(parsed.events) ? parsed.events : [],
      sensitivity_hints: Array.isArray(parsed.sensitivity_hints)
        ? parsed.sensitivity_hints
        : [],
    };
  } catch {
    return EMPTY_SUGGESTIONS;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const body = await req.json();
    const userId: string | undefined =
      typeof body?.user_id === "string" ? body.user_id : undefined;
    let rawText: string =
      typeof body?.raw_text === "string" ? body.raw_text : "";

    if (!userId) {
      return json({ error: "user_id is required" }, 400);
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return json({ error: "Supabase service credentials not configured" }, 500);
    }
    if (!LLM_API_KEY || !EMBEDDING_API_KEY) {
      return json({ error: "AI keys not configured" }, 500);
    }

    if (rawText.length > MAX_TEXT_CHARS) {
      rawText = rawText.slice(0, MAX_TEXT_CHARS);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 1. Upsert the raw narrative (one row per user).
    const { error: upsertErr } = await supabase
      .from("user_narratives")
      .upsert(
        {
          user_id: userId,
          raw_text: rawText,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
    if (upsertErr) {
      return json({ error: `narrative upsert failed: ${upsertErr.message}` }, 500);
    }

    // 2. Re-chunk: delete old chunks, insert fresh ones with embeddings.
    const { error: delErr } = await supabase
      .from("narrative_chunks")
      .delete()
      .eq("user_id", userId);
    if (delErr) {
      return json({ error: `chunk reset failed: ${delErr.message}` }, 500);
    }

    const chunks = chunkText(rawText);
    let chunkCount = 0;

    if (chunks.length > 0) {
      let embeddings: number[][];
      try {
        embeddings = await embedBatch(chunks);
      } catch (e) {
        return json({ error: (e as Error).message }, 502);
      }

      const rows = chunks.map((text, i) => ({
        user_id: userId,
        chunk_index: i,
        text,
        embedding: embeddings[i] ?? null,
      }));

      const { error: insErr } = await supabase
        .from("narrative_chunks")
        .insert(rows);
      if (insErr) {
        return json({ error: `chunk insert failed: ${insErr.message}` }, 500);
      }
      chunkCount = rows.length;
    }

    // 3. Extract structured suggestions (best-effort, never blocks RAG storage).
    const suggestions = rawText.trim()
      ? await extractSuggestions(rawText)
      : EMPTY_SUGGESTIONS;

    return json({ ok: true, chunk_count: chunkCount, suggestions });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
