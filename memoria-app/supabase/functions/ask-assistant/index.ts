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
    limit: number
  ) {
    const queryEmbedding = await embedQuery(query);
    const { data, error } = await supabase.rpc("match_memories", {
      p_user_id: userId,
      p_query_embedding: queryEmbedding,
      p_match_count: limit,
      p_kinds: kinds ?? ["media", "life_facts", "people", "events"],
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
        const results = await semanticSearch(query, kinds, limit);

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
          tools: TOOL_DEFINITIONS.map((t) => ({ type: "function", function: t })),
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
          if (!handler) {
            result = { error: `unknown tool: ${name}` };
          } else {
            result = await handler(parsedArgs);
          }

          // Pull any media file_urls into the photos array.
          if (name === "search_memories" && Array.isArray(result?.results)) {
            for (const r of result.results) {
              const url = r?.metadata?.file_url;
              if (r?.kind === "media" && typeof url === "string" && !photos.includes(url)) {
                photos.push(url);
              }
            }
          }

          tool_trace.push({ name, summary: summarizeToolResult(name, result) });

          const toolMsgContent = JSON.stringify(result);
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

      // Plain text answer — persist and exit.
      finalAnswer = msg.content || "I'm not sure how to answer that.";
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        role: "assistant",
        content: finalAnswer,
      });
      break;
    }

    if (!finalAnswer) {
      finalAnswer =
        "I'm having trouble finding an answer right now. Please try again.";
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        role: "assistant",
        content: finalAnswer,
      });
    }

    return jsonResponse({
      answer: finalAnswer,
      conversationId,
      ...(photos.length > 0 ? { photos } : {}),
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
