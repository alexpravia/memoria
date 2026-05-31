// Supabase Edge Function: ask-assistant (Phase B — agentic).
//
// Replaces the previous "stuff all context into the system prompt"
// approach with an OpenAI-style tool-calling loop. Tool definitions are
// kept in sync with `src/lib/tools.ts` (canonical TypeScript source);
// they are duplicated here because Deno cannot load the React Native
// Supabase singleton chain that file imports.
//
// Service-role key is used inside this function ONLY for tool handlers
// (so handlers can read across users / write flag_queue rows). The key
// is NEVER returned to the client. The `tool_trace` we ship back is
// sanitized: tool name + brief summary, no raw rows.
//
// Behaviour:
//  - Input:  { userId, question, conversationId? }
//  - Creates a conversation row if no id is supplied.
//  - Persists the user message, runs up to 5 tool/LLM round-trips,
//    then persists the final assistant message.
//  - Returns { answer, conversationId, photos?, tool_trace }.

import { createClient } from "npm:@supabase/supabase-js@2";

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
const SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
  Deno.env.get("SERVICE_ROLE_KEY") ||
  "";

const MAX_TOOL_LOOPS = 5;
const HISTORY_WINDOW = 10;
// 2A: cosine-similarity floor for the agentic search_memories tool. Below this,
// a dense match is noise that confuses the assistant. The recent-verified-photo
// fallback still covers the legitimately-empty case. Topic filters in
// get_life_facts intentionally use 0 (raw recall).
const SEARCH_MIN_SIMILARITY = 0.65;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are Memo, a warm, gentle memory companion for someone with memory difficulties.

RULES:
- NEVER write URLs, file paths, [markdown links], or raw IDs in your answer. The app shows photos automatically when you call search_memories. Just say "Here is a photo of …" — the picture appears for the user.
- Use the provided tools to look up information. Never make things up.
- If a tool returns no results, say "I don't have that information yet. Your helper can add it for you."
- Keep answers short, clear, reassuring. Use simple language.
- Speak in second person ("You", "Your"). Be warm and kind.
- When the user asks about photos or memories — even vaguely (e.g. "show me a picture", "show me anything") — ALWAYS call search_memories with kinds:['media'].
- For singular requests ("a photo", "a picture", "a memory"): use limit:1.
- For plural requests ("photos", "pictures", "show me my family"): use limit:3-5.
- Use a broad query like "photo" if they didn't specify a topic, or a more specific query when they did (e.g. "Christmas", "garden").
- When asked about a person, use get_person.
- Never mention tools, filtering, or that information is hidden.
- For sensitive emotional situations, you may call flag_for_co_user.`;

// ─── Tool schemas (mirror of src/lib/tools.ts:TOOL_DEFINITIONS) ─────
// Keep this in sync with the canonical file. The Phase B unit tests
// validate the canonical version's shape; manual review keeps this
// duplicate aligned.
const TOOL_DEFINITIONS = [
  {
    name: "search_memories",
    description:
      "Semantic search across the user's photos, life facts, people, and events. Use this when looking up things by meaning rather than exact name.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Natural-language search query." },
        kinds: {
          type: "array",
          items: {
            type: "string",
            enum: ["media", "life_facts", "people", "events"],
          },
        },
        limit: { type: "integer", minimum: 1, maximum: 10 },
      },
      required: ["query"],
    },
  },
  {
    name: "get_person",
    description:
      "Look up a person in the user's life by exact id or by name (case-insensitive partial match).",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        id: { type: "string" },
      },
    },
  },
  {
    name: "list_events",
    description:
      "List the user's events within an optional date range. Useful for 'what's on my calendar tomorrow', 'what did I do last week'.",
    parameters: {
      type: "object",
      properties: {
        from: { type: "string", description: "ISO date inclusive lower bound." },
        to: { type: "string", description: "ISO date inclusive upper bound." },
        type: { type: "string", enum: ["one_time", "recurring", "routine"] },
        limit: { type: "integer", minimum: 1, maximum: 50 },
      },
    },
  },
  {
    name: "get_life_facts",
    description:
      "Return key identity facts about the user. If `topic` is provided, semantic-filter to facts related to that topic.",
    parameters: {
      type: "object",
      properties: { topic: { type: "string" } },
    },
  },
  {
    name: "get_user_profile",
    description:
      "Return the user's basic profile: full name, location, date of birth, cognitive level.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "remember_about_user",
    description:
      "Persist a new fact, observation, or preference learned about the user. Use sparingly.",
    parameters: {
      type: "object",
      properties: {
        kind: {
          type: "string",
          enum: [
            "observation",
            "preference",
            "recurring_question",
            "emotional_state",
            "factual_correction",
          ],
        },
        content: { type: "string" },
        importance: { type: "integer", minimum: 1, maximum: 5 },
      },
      required: ["kind", "content"],
    },
  },
  {
    name: "recall_about_user",
    description:
      "Recall things you have noted about this user previously. Use when you suspect there is helpful context from prior conversations (mood, recurring questions, preferences, corrections).",
    parameters: {
      type: "object",
      properties: {
        topic: { type: "string" },
        limit: { type: "number", default: 5 },
        kinds: {
          type: "array",
          items: {
            type: "string",
            enum: [
              "observation",
              "preference",
              "recurring_question",
              "emotional_state",
              "factual_correction",
            ],
          },
        },
      },
    },
  },
  {
    name: "flag_for_co_user",
    description:
      "Raise a concern for the user's helper to review. Reserved for genuine needs.",
    parameters: {
      type: "object",
      properties: {
        reason: { type: "string" },
        severity: { type: "string", enum: ["low", "medium", "high"] },
      },
      required: ["reason", "severity"],
    },
  },
];

// ─── Helpers ────────────────────────────────────────────────────────

async function embedQuery(text: string): Promise<number[]> {
  if (!EMBEDDING_API_KEY) throw new Error("Embedding API key not configured");
  const r = await fetch(EMBEDDING_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${EMBEDDING_API_KEY}`,
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: text }),
  });
  if (!r.ok) throw new Error(`embed failed: ${await r.text()}`);
  const j = await r.json();
  const emb = j?.data?.[0]?.embedding;
  if (!Array.isArray(emb)) throw new Error("embed returned no vector");
  return emb;
}

function makeHandlers(supabase: any, userId: string) {
  async function semanticSearch(
    query: string,
    kinds: string[] | undefined,
    limit: number,
    minSimilarity = 0
  ) {
    const queryEmbedding = await embedQuery(query);
    // 2B: hybrid retrieval — dense (meaning) fused with lexical/BM25 (exact
    // names, dates, tags) via RRF. minSimilarity floors only the dense arm; an
    // exact keyword hit always counts. Same return shape as match_memories.
    const { data, error } = await supabase.rpc("match_memories_hybrid", {
      p_user_id: userId,
      p_query_embedding: queryEmbedding,
      p_query_text: query,
      p_match_count: limit,
      p_kinds: kinds ?? ["media", "life_facts", "people", "events"],
      p_min_similarity: minSimilarity,
    });
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{
      kind: string;
      id: string;
      text_snippet: string;
      similarity: number;
      metadata: Record<string, any>;
    }>;
  }

  return {
    search_memories: async (args: any) => {
      try {
        const query = String(args?.query ?? "").trim();
        if (!query) return { error: "query is required" };
        const callerLimit = args?.limit;
        const limit = Math.min(Math.max(Number(callerLimit ?? 5), 1), 10);
        // Fallback default is 1 so a vague "show me a photo" doesn't dump
        // every verified photo on the user. If the caller explicitly
        // asked for more, honour their (clamped) value.
        const fallbackLimit = callerLimit !== undefined ? limit : 1;
        const kinds =
          Array.isArray(args?.kinds) && args.kinds.length > 0
            ? (args.kinds as string[])
            : undefined;
        const results = await semanticSearch(
          query,
          kinds,
          limit,
          SEARCH_MIN_SIMILARITY
        );

        // Fallback: if RAG returned 0 and caller wants media (or any kind),
        // fall back to recent verified photos. Handles two cases:
        //   1. Embeddings haven't been backfilled yet.
        //   2. Generic queries like "show me anything".
        const wantsMedia = !kinds || kinds.includes("media");
        if (results.length === 0 && wantsMedia) {
          const { data } = await supabase
            .from("media")
            .select("id, file_url, description, taken_at, ai_tags")
            .eq("user_id", userId)
            .eq("verification_status", "verified")
            .order("taken_at", { ascending: false, nullsFirst: false })
            .limit(fallbackLimit);
          if (data && data.length > 0) {
            return {
              results: data.map((m: any) => ({
                kind: "media",
                id: m.id,
                text_snippet: m.description ?? "",
                similarity: 0,
                metadata: {
                  file_url: m.file_url,
                  taken_at: m.taken_at,
                  ai_tags: m.ai_tags,
                },
              })),
              fallback: "recent_verified",
            };
          }
        }

        return { results };
      } catch (err: any) {
        return { error: err?.message ?? "search_memories failed" };
      }
    },

    get_person: async (args: any) => {
      try {
        const name = args?.name ? String(args.name).trim() : "";
        const id = args?.id ? String(args.id).trim() : "";
        if (!name && !id) return { error: "name or id is required" };

        let query = supabase
          .from("people")
          .select(
            "id, full_name, relationship, key_facts, emotional_notes, photo_url"
          )
          .eq("user_id", userId);

        if (id) query = query.eq("id", id);
        else query = query.ilike("full_name", `%${name}%`);

        const { data, error } = await query.limit(5);
        if (error) return { error: error.message };
        return { people: data ?? [] };
      } catch (err: any) {
        return { error: err?.message ?? "get_person failed" };
      }
    },

    list_events: async (args: any) => {
      try {
        const from = args?.from ? String(args.from) : null;
        const to = args?.to ? String(args.to) : null;
        const type = args?.type ? String(args.type) : null;
        const limit = Math.min(Math.max(Number(args?.limit ?? 20), 1), 50);

        let query = supabase
          .from("events")
          .select("id, title, description, event_date, event_type")
          .eq("user_id", userId);

        if (from) query = query.gte("event_date", from);
        if (to) query = query.lte("event_date", to);
        if (type) query = query.eq("event_type", type);

        const { data, error } = await query
          .order("event_date", { ascending: true })
          .limit(limit);
        if (error) return { error: error.message };
        return { events: data ?? [] };
      } catch (err: any) {
        return { error: err?.message ?? "list_events failed" };
      }
    },

    get_life_facts: async (args: any) => {
      try {
        const topic = args?.topic ? String(args.topic).trim() : "";
        if (topic) {
          const matches = await semanticSearch(topic, ["life_facts"], 10);
          return {
            facts: matches.map((m) => ({
              id: m.id,
              fact: m.text_snippet,
              similarity: m.similarity,
            })),
          };
        }
        const { data, error } = await supabase
          .from("life_facts")
          .select("id, fact, category")
          .eq("user_id", userId)
          .order("display_order");
        if (error) return { error: error.message };
        return { facts: data ?? [] };
      } catch (err: any) {
        return { error: err?.message ?? "get_life_facts failed" };
      }
    },

    get_user_profile: async (_args: any) => {
      try {
        const { data, error } = await supabase
          .from("users")
          .select("full_name, location, date_of_birth, cognitive_level")
          .eq("id", userId)
          .single();
        if (error) return { error: error.message };
        return { profile: data };
      } catch (err: any) {
        return { error: err?.message ?? "get_user_profile failed" };
      }
    },

    remember_about_user: async (args: any) => {
      // Phase D: persist to assistant_memory and (if importance >= 4)
      // drop a row in flag_queue so the co-user reviews it. Mirrors
      // src/lib/memory.ts:rememberAboutUser.
      try {
        const allowed = [
          "observation",
          "preference",
          "recurring_question",
          "emotional_state",
          "factual_correction",
        ];
        const kind = String(args?.kind ?? "").trim();
        const content = String(args?.content ?? "").trim();
        if (!content) return { error: "content is required" };
        if (!allowed.includes(kind)) {
          return { error: `kind must be one of: ${allowed.join(", ")}` };
        }

        const importanceRaw = Number(args?.importance ?? 3);
        const importance = Math.max(
          1,
          Math.min(5, Number.isFinite(importanceRaw) ? Math.round(importanceRaw) : 3)
        );

        const DAY_MS = 24 * 60 * 60 * 1000;
        const expiryDays: Record<string, number | null> = {
          observation: 30,
          emotional_state: 7,
          recurring_question: 90,
          preference: null,
          factual_correction: null,
        };
        const days = expiryDays[kind];
        const expires_at =
          days === null || days === undefined
            ? null
            : new Date(Date.now() + days * DAY_MS).toISOString();

        const row: Record<string, unknown> = {
          user_id: userId,
          kind,
          content,
          importance,
          expires_at,
        };
        if (typeof args?.sourceMessageId === "string") {
          row.source_message_id = args.sourceMessageId;
        }
        if (typeof args?.sourceConvId === "string") {
          row.source_conversation_id = args.sourceConvId;
        }

        const { data, error } = await supabase
          .from("assistant_memory")
          .insert(row)
          .select("id")
          .single();
        if (error) return { error: error.message };
        const id = data?.id as string | undefined;
        if (!id) return { error: "insert returned no id" };

        if (importance >= 4) {
          // Fire-and-forget — never block the conversation loop on
          // flag insert failures.
          supabase
            .from("flag_queue")
            .insert({
              user_id: userId,
              flag_type: "journal",
              reference_id: id,
              description: `Memory to review: ${content}`,
            })
            .then((res: any) => {
              if (res?.error) {
                console.warn(
                  "remember_about_user: flag_queue insert failed:",
                  res.error.message
                );
              }
            });
        }

        return { remembered: true, id };
      } catch (err: any) {
        return { error: err?.message ?? "remember_about_user failed" };
      }
    },

    recall_about_user: async (args: any) => {
      // Phase D: read top-N active memories. Mirrors
      // src/lib/memory.ts:recallAboutUser.
      try {
        const limitRaw = Number(args?.limit ?? 5);
        const limit = Math.max(
          1,
          Math.min(50, Number.isFinite(limitRaw) ? limitRaw : 5)
        );
        const topic = args?.topic ? String(args.topic).trim() : "";
        const kinds = Array.isArray(args?.kinds) && args.kinds.length > 0
          ? (args.kinds as string[])
          : null;

        let q = supabase
          .from("assistant_memory")
          .select(
            "id, kind, content, importance, created_at, expires_at, status, reviewed_by_couser"
          )
          .eq("user_id", userId)
          .neq("status", "suppressed");

        if (kinds) q = q.in("kind", kinds);
        if (topic) q = q.ilike("content", `%${topic}%`);

        const { data, error } = await q
          .order("status", { ascending: true })
          .order("importance", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(limit);
        if (error) return { error: error.message };
        return { memories: data ?? [] };
      } catch (err: any) {
        return { error: err?.message ?? "recall_about_user failed" };
      }
    },

    flag_for_co_user: async (args: any) => {
      try {
        const reason = String(args?.reason ?? "").trim();
        if (!reason) return { error: "reason is required" };
        const severity = ["low", "medium", "high"].includes(args?.severity)
          ? args.severity
          : "medium";

        const { data, error } = await supabase
          .from("flag_queue")
          .insert({
            user_id: userId,
            flag_type: "journal",
            reference_id: userId,
            description: `[severity:${severity}] ${reason}`,
          })
          .select("id")
          .single();
        if (error) return { error: error.message };
        return { flagged: true, queue_id: data?.id ?? null, severity };
      } catch (err: any) {
        return { error: err?.message ?? "flag_for_co_user failed" };
      }
    },
  } as Record<string, (args: any) => Promise<any>>;
}

function summarizeToolResult(name: string, result: any): string {
  if (result?.error) return `error: ${result.error}`;
  if (name === "search_memories")
    return `${result?.results?.length ?? 0} results`;
  if (name === "get_person") return `${result?.people?.length ?? 0} people`;
  if (name === "list_events") return `${result?.events?.length ?? 0} events`;
  if (name === "get_life_facts") return `${result?.facts?.length ?? 0} facts`;
  if (name === "get_user_profile") return result?.profile ? "ok" : "missing";
  if (name === "remember_about_user")
    return result?.remembered ? `remembered (${result?.id ?? "?"})` : "no-op";
  if (name === "recall_about_user")
    return `${result?.memories?.length ?? 0} memories`;
  if (name === "flag_for_co_user")
    return result?.flagged ? `flagged (${result?.queue_id})` : "no-op";
  return "ok";
}

// ─── 1D: Dynamic tool selection ─────────────────────────────────────
// Offering all 8 tools on every turn adds decision noise and tokens for
// simple questions ("What is my name?" sees the photo-search tool). We
// narrow the toolset for clearly-typed questions and fall back to the full
// set for anything ambiguous, so we never strand the model without a tool
// it actually needs. Conservative on purpose: only narrow on strong signals.
function selectTools(question: string): typeof TOOL_DEFINITIONS {
  const q = (question || "").toLowerCase();
  // Always offer the write/safety tools. Even on a narrowed turn the user may
  // simultaneously express a preference to remember ("show my photos, I love
  // the beach") or a safety concern to flag ("show me a photo, my chest hurts"),
  // and those must never be stranded. We only narrow the READ tools.
  const ALWAYS = ["remember_about_user", "flag_for_co_user"];
  const byName = (names: string[]) =>
    TOOL_DEFINITIONS.filter(
      (t) => names.includes(t.name) || ALWAYS.includes(t.name)
    );

  const isPhoto =
    /\b(photo|photos|picture|pictures|pic|pics|image|images)\b|show me|look at/.test(
      q
    );
  const isCalendar =
    /\b(today|tonight|tomorrow|yesterday|schedule|appointment|appointments|calendar|event|events|plans?|week|weekend)\b/.test(
      q
    );
  const isIdentity =
    /\bmy name\b|who am i|where do i live|where am i|how old|my age|birthday|born|my address/.test(
      q
    );

  // Photo/person lookups: keep get_person so "show me a photo of Maria" works.
  if (isPhoto) return byName(["search_memories", "get_person", "recall_about_user"]);
  if (isCalendar)
    return byName(["list_events", "get_user_profile", "recall_about_user"]);
  if (isIdentity)
    return byName(["get_user_profile", "get_life_facts", "recall_about_user"]);
  return TOOL_DEFINITIONS;
}

// ─── 1E: Tool result size limits ────────────────────────────────────
// Long tool results (a 600-word key_facts, 10 events, 30 life facts) bloat
// the context window across the tool loop and worsen "lost in the middle".
// We clamp the bulky fields before injecting into context AND persisting, so
// the trimmed shape stays consistent when history is replayed next turn.
const MAX_SNIPPET_CHARS = 500;

function truncate(s: string, max: number): string {
  if (typeof s !== "string") return s;
  return s.length > max ? s.slice(0, max) + "…" : s;
}

function clampToolResult(name: string, result: any): any {
  if (!result || typeof result !== "object" || result.error) return result;
  try {
    if (name === "search_memories" && Array.isArray(result.results)) {
      // Trim only text_snippet; metadata.file_url MUST stay intact (photos).
      return {
        ...result,
        results: result.results.map((r: any) => ({
          ...r,
          text_snippet: truncate(String(r?.text_snippet ?? ""), MAX_SNIPPET_CHARS),
        })),
      };
    }
    if (name === "get_life_facts" && Array.isArray(result.facts)) {
      return {
        ...result,
        facts: result.facts.slice(0, 30).map((f: any) => ({
          ...f,
          fact: truncate(String(f?.fact ?? ""), MAX_SNIPPET_CHARS),
        })),
      };
    }
    if (name === "list_events" && Array.isArray(result.events)) {
      return {
        ...result,
        events: result.events.slice(0, 20).map((e: any) => ({
          ...e,
          title: truncate(String(e?.title ?? ""), 120),
          description: truncate(String(e?.description ?? ""), 200),
        })),
      };
    }
    if (name === "get_person" && Array.isArray(result.people)) {
      return {
        ...result,
        people: result.people.map((p: any) => ({
          ...p,
          key_facts: Array.isArray(p?.key_facts)
            ? p.key_facts.slice(0, 10).map((k: any) => truncate(String(k), 200))
            : truncate(String(p?.key_facts ?? ""), MAX_SNIPPET_CHARS),
          emotional_notes: truncate(String(p?.emotional_notes ?? ""), MAX_SNIPPET_CHARS),
        })),
      };
    }
    if (name === "recall_about_user" && Array.isArray(result.memories)) {
      return {
        ...result,
        memories: result.memories.slice(0, 20).map((m: any) => ({
          ...m,
          content: truncate(String(m?.content ?? ""), MAX_SNIPPET_CHARS),
        })),
      };
    }
  } catch {
    return result;
  }
  return result;
}

// ─── 3A: grounding evidence extraction ──────────────────────────────
// Pull the human-readable factual content out of a tool result so the
// groundedness checker can verify the final answer against it. We deliberately
// exclude structural noise (file_urls, ids) and keep only asserted facts.
function extractGroundingText(name: string, result: any): string[] {
  if (!result || typeof result !== "object" || result.error) return [];
  const out: string[] = [];
  try {
    if (name === "search_memories" && Array.isArray(result.results)) {
      for (const r of result.results) {
        if (r?.text_snippet) out.push(String(r.text_snippet));
      }
    } else if (name === "get_person" && Array.isArray(result.people)) {
      for (const p of result.people) {
        const facts = Array.isArray(p?.key_facts)
          ? p.key_facts.join("; ")
          : p?.key_facts ?? "";
        out.push(
          [p?.full_name, p?.relationship, facts, p?.emotional_notes]
            .filter(Boolean)
            .join(" — ")
        );
      }
    } else if (name === "get_life_facts" && Array.isArray(result.facts)) {
      for (const f of result.facts) if (f?.fact) out.push(String(f.fact));
    } else if (name === "list_events" && Array.isArray(result.events)) {
      for (const e of result.events) {
        out.push(
          [e?.title, e?.description, e?.event_date].filter(Boolean).join(" — ")
        );
      }
    } else if (name === "recall_about_user" && Array.isArray(result.memories)) {
      for (const m of result.memories) if (m?.content) out.push(String(m.content));
    } else if (name === "get_user_profile" && result.profile) {
      const p = result.profile;
      out.push(
        [p?.full_name, p?.location, p?.date_of_birth].filter(Boolean).join(" — ")
      );
    }
  } catch {
    // best-effort extraction
  }
  return out.filter((s) => s && s.trim());
}

// Safe replacements when a check suppresses an answer. Both are intentionally
// grounded + non-sensitive so they never re-trigger a downstream check.
const UNGROUNDED_FALLBACK =
  "I want to be sure I only share what I know for certain. Let me check with your helper about that.";
const SENSITIVE_FALLBACK =
  "I don't have something to share about that right now. Your helper can help with it.";

// 3A: ask a cheap, deterministic LLM pass whether the answer is supported by
// the retrieved evidence. Fails OPEN — a checker error must never block a
// legitimate answer (it would degrade the experience for no safety gain).
async function isAnswerGrounded(
  answer: string,
  evidence: string[]
): Promise<boolean> {
  try {
    const ev = evidence
      .slice(0, 12)
      .map((s, i) => `(${i + 1}) ${s}`)
      .join("\n");
    const res = await fetch(LLM_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LLM_API_KEY}`,
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: [
          {
            role: "system",
            content:
              "You check whether an assistant's answer is grounded in retrieved evidence. " +
              "Reply with exactly one word. Say GROUNDED if every specific factual claim " +
              "(names, dates, relationships, events, places) in the answer is supported by the " +
              "evidence. Say UNGROUNDED if the answer states a specific fact not present in the " +
              "evidence. General warmth, reassurance, or asking the user a question counts as GROUNDED.",
          },
          {
            role: "user",
            content: `Evidence:\n${ev}\n\nAnswer:\n"${answer}"\n\nOne word: GROUNDED or UNGROUNDED.`,
          },
        ],
        max_tokens: 4,
        temperature: 0,
      }),
    });
    if (!res.ok) return true; // fail-open
    const data = await res.json();
    const verdict = String(data.choices?.[0]?.message?.content ?? "")
      .trim()
      .toUpperCase();
    return !verdict.startsWith("UNGROUNDED");
  } catch {
    return true; // fail-open
  }
}

// 3B: re-run the sensitivity classifier on the GENERATED answer (Memo can
// synthesize sensitive content from non-sensitive fragments). Skips when the
// user has no avoid-rules. Fails OPEN, matching the project's read-path policy.
async function isAnswerAllowed(
  supabase: any,
  userId: string,
  answer: string
): Promise<boolean> {
  try {
    const { data: rules, error } = await supabase
      .from("sensitivity_filters")
      .select(
        "id, filter_type, intent_text, filter_value, person_id, start_date, end_date"
      )
      .eq("user_id", userId);
    if (error || !Array.isArray(rules) || rules.length === 0) return true;

    const res = await fetch(`${SUPABASE_URL}/functions/v1/check-sensitivity`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        apikey: SERVICE_ROLE_KEY,
      },
      body: JSON.stringify({
        items: [{ id: "generated-answer", kind: "media", text: answer }],
        rules: rules.map((r: any) => ({
          id: r.id,
          intent_text: r.intent_text ?? r.filter_value ?? "",
          filter_type: r.filter_type,
          filter_value: r.filter_value ?? undefined,
        })),
      }),
    });
    if (!res.ok) return true; // fail-open
    const data = await res.json();
    const decisions = data?.decisions;
    if (!Array.isArray(decisions) || decisions.length === 0) return true;
    return decisions[0]?.allow !== false;
  } catch {
    return true; // fail-open
  }
}

interface DBMessage {
  role: "user" | "assistant" | "tool" | "system";
  content: string | null;
  tool_calls: any | null;
  tool_call_id: string | null;
  tool_name: string | null;
  created_at: string;
}

function dbToOpenAIMessage(m: DBMessage): any {
  if (m.role === "tool") {
    return {
      role: "tool",
      tool_call_id: m.tool_call_id,
      name: m.tool_name,
      content: m.content ?? "",
    };
  }
  if (m.role === "assistant") {
    const out: any = { role: "assistant", content: m.content ?? "" };
    if (m.tool_calls) out.tool_calls = m.tool_calls;
    return out;
  }
  return { role: m.role, content: m.content ?? "" };
}

// ─── Main handler ───────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const { userId, question, conversationId: incomingConvId } =
      await req.json();

    if (!userId || !question) {
      return jsonResponse({ error: "userId and question are required" }, 400);
    }
    if (!LLM_API_KEY) return jsonResponse({ error: "LLM API key not configured" }, 500);
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return jsonResponse({ error: "Supabase service credentials not configured" }, 500);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 1. Resolve conversation.
    let conversationId = incomingConvId ?? null;
    if (!conversationId) {
      const { data, error } = await supabase
        .from("conversations")
        .insert({ user_id: userId })
        .select("id")
        .single();
      if (error) return jsonResponse({ error: `conversation create: ${error.message}` }, 500);
      conversationId = data!.id;
    }

    // 2. Persist the user message.
    {
      const { error } = await supabase.from("messages").insert({
        conversation_id: conversationId,
        role: "user",
        content: question,
      });
      if (error) return jsonResponse({ error: `user message insert: ${error.message}` }, 500);
    }

    // 3. Load history (last N messages, oldest-first).
    const { data: historyRows, error: histErr } = await supabase
      .from("messages")
      .select("role, content, tool_calls, tool_call_id, tool_name, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(HISTORY_WINDOW);
    if (histErr) return jsonResponse({ error: `history load: ${histErr.message}` }, 500);

    const history = ((historyRows ?? []) as DBMessage[])
      .slice()
      .reverse();

    // Phase D: hydrate top-5 active memories so the assistant has prior
    // context. Pinned rows surface first, then importance, then recency.
    // Failures here must NOT block the conversation — log and skip.
    let memoryRows: Array<{
      kind: string;
      content: string;
      importance: number;
      status: string;
    }> = [];
    try {
      const { data: memData, error: memErr } = await supabase
        .from("assistant_memory")
        .select("kind, content, importance, status")
        .eq("user_id", userId)
        .neq("status", "suppressed")
        .order("status", { ascending: true })
        .order("importance", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(5);
      if (memErr) {
        console.warn("ask-assistant: memory hydrate failed:", memErr.message);
      } else {
        memoryRows = (memData ?? []) as typeof memoryRows;
      }
    } catch (memHydrateErr: any) {
      console.warn("ask-assistant: memory hydrate threw:", memHydrateErr?.message);
    }

    const memoryBlock =
      memoryRows.length > 0
        ? `Things you remember about this user (from prior conversations, may inform but do not blindly repeat):\n${memoryRows
            .map(
              (m) =>
                `- [importance:${m.importance}] [${m.kind}] ${m.content}`
            )
            .join("\n")}`
        : null;

    const messages: any[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...(memoryBlock ? [{ role: "system", content: memoryBlock }] : []),
      ...history.map(dbToOpenAIMessage),
    ];

    const handlers = makeHandlers(supabase, userId);
    const photos: string[] = [];
    const tool_trace: Array<{ name: string; summary: string }> = [];
    // 3A: accumulate the factual evidence retrieved across the tool loop so the
    // final answer can be verified against it before it reaches the user.
    const groundingContext: string[] = [];

    // 1D: narrow the toolset to what this question actually needs.
    const activeTools = selectTools(question);

    let finalAnswer = "";

    for (let iter = 0; iter < MAX_TOOL_LOOPS; iter++) {
      const llmRes = await fetch(LLM_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${LLM_API_KEY}`,
        },
        body: JSON.stringify({
          model: LLM_MODEL,
          messages,
          tools: activeTools.map((t) => ({ type: "function", function: t })),
          tool_choice: "auto",
          max_tokens: 600,
          temperature: 0.5,
        }),
      });

      if (!llmRes.ok) {
        const errorText = await llmRes.text();
        return jsonResponse({ error: `LLM error: ${errorText}` }, 502);
      }

      const data = await llmRes.json();
      const msg = data.choices?.[0]?.message;
      if (!msg) {
        finalAnswer = "I'm not sure how to answer that.";
        break;
      }

      const toolCalls = msg.tool_calls;

      if (Array.isArray(toolCalls) && toolCalls.length > 0) {
        // Append the assistant tool-call message to context AND persist.
        messages.push({
          role: "assistant",
          content: msg.content ?? "",
          tool_calls: toolCalls,
        });
        await supabase.from("messages").insert({
          conversation_id: conversationId,
          role: "assistant",
          content: msg.content ?? "",
          tool_calls: toolCalls,
        });

        // Execute every tool call, append + persist tool messages.
        for (const call of toolCalls) {
          const name: string = call?.function?.name ?? "";
          let parsedArgs: any = {};
          try {
            parsedArgs = call?.function?.arguments
              ? JSON.parse(call.function.arguments)
              : {};
          } catch {
            parsedArgs = {};
          }

          const handler = handlers[name];
          let result: any;
          const toolStartedAt = Date.now();
          if (!handler) {
            result = { error: `unknown tool: ${name}` };
          } else {
            result = await handler(parsedArgs);
          }
          const toolDurationMs = Date.now() - toolStartedAt;

          // Pull any media file_urls into the photos array.
          if (name === "search_memories" && Array.isArray(result?.results)) {
            for (const r of result.results) {
              const url = r?.metadata?.file_url;
              if (r?.kind === "media" && typeof url === "string" && !photos.includes(url)) {
                photos.push(url);
              }
            }
          }

          // 3A: collect factual evidence for the post-generation grounding check.
          groundingContext.push(...extractGroundingText(name, result));

          const summary = summarizeToolResult(name, result);
          tool_trace.push({ name, summary });

          // 2C: persist a lightweight trace row for observability/debugging.
          // Never let tracing failures break the conversation loop.
          try {
            await supabase.from("conversation_traces").insert({
              conversation_id: conversationId,
              user_id: userId,
              tool_name: name,
              args_summary: JSON.stringify(parsedArgs ?? {}).slice(0, 500),
              result_summary: summary,
              duration_ms: toolDurationMs,
            });
          } catch (_traceErr) {
            // swallow — traces are best-effort
          }

          // 1E: clamp bulky fields before they enter context / persistence.
          const toolMsgContent = JSON.stringify(clampToolResult(name, result));
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            name,
            content: toolMsgContent,
          });
          await supabase.from("messages").insert({
            conversation_id: conversationId,
            role: "tool",
            content: toolMsgContent,
            tool_call_id: call.id,
            tool_name: name,
          });
        }

        // Continue the loop so the LLM can use the tool results.
        continue;
      }

      // Plain text answer — defer persistence until AFTER the safety checks so
      // a suppressed answer never leaks into stored history (or back into the
      // context window on the next turn).
      finalAnswer = msg.content || "I'm not sure how to answer that.";
      break;
    }

    if (!finalAnswer) {
      finalAnswer =
        "I'm having trouble finding an answer right now. Please try again.";
    }

    // Track whether a gate suppressed the answer — if so we also withhold the
    // photos that were gathered for the original (rejected) response.
    let suppressed = false;

    // ─── 3A: post-generation groundedness gate ──────────────────────
    // A hallucinated family fact told to someone with dementia is a safety
    // issue, not a UX nit. Only runs when we actually retrieved evidence.
    if (finalAnswer && groundingContext.length > 0) {
      const grounded = await isAnswerGrounded(finalAnswer, groundingContext);
      if (!grounded) {
        finalAnswer = UNGROUNDED_FALLBACK;
        suppressed = true;
        try {
          await supabase.from("flag_queue").insert({
            user_id: userId,
            flag_type: "journal",
            reference_id: userId,
            description:
              "[groundedness] Memo suppressed a possibly-ungrounded answer. Please review the conversation.",
          });
        } catch (_e) {
          // best-effort flag; never block the response
        }
      }
    }

    // ─── 3B: output sensitivity gate ────────────────────────────────
    // Catch sensitive content Memo may have synthesized from non-sensitive
    // fragments. Skip when the answer is already the safe groundedness fallback.
    if (!suppressed) {
      const allowed = await isAnswerAllowed(supabase, userId, finalAnswer);
      if (!allowed) {
        finalAnswer = SENSITIVE_FALLBACK;
        suppressed = true;
      }
    }

    // Persist the final (possibly-redacted) assistant message exactly once.
    await supabase.from("messages").insert({
      conversation_id: conversationId,
      role: "assistant",
      content: finalAnswer,
    });

    return jsonResponse({
      answer: finalAnswer,
      conversationId,
      ...(photos.length > 0 && !suppressed ? { photos } : {}),
      tool_trace,
    });
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}
