// Phase B — tool definitions + handlers for the agentic assistant.
//
// This file is the canonical TypeScript definition of the tools the LLM
// can call. The Edge Function at `supabase/functions/ask-assistant/`
// keeps a Deno-side mirror of `TOOL_DEFINITIONS` (it can't import this
// file at runtime because Deno can't load `src/lib/supabase.ts` /
// `embeddings.ts`). Keep the schemas in sync — Phase B verification
// includes a unit test that checks they have valid JSON-Schema shape.
//
// Phase D will replace the `remember_about_user` STUB and add a
// `recall_about_user` tool. The structure here is intentionally easy
// to extend: add a `TOOL_DEFINITIONS` entry + a matching handler.

import { searchMemories, type EmbeddingKind } from "./embeddings";
import {
  rememberAboutUser,
  recallAboutUser,
  type MemoryKind,
} from "./memory";

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: object; // JSON Schema
}

export interface ToolHandlerContext {
  userId: string;
  // Server-side Supabase client (service role inside the Edge Function,
  // mocked client in unit tests). Typed as `any` so this file does not
  // depend on `@supabase/supabase-js` at module load — keeps it easy
  // for both Deno and Node test runtimes to import.
  supabase: any;
}

export type ToolHandler = (
  args: any,
  ctx: ToolHandlerContext
) => Promise<any>;

// ─── Tool schemas ───────────────────────────────────────────────────
// Shape is OpenAI-compatible: each entry is wrapped as
// `{ type: "function", function: <definition> }` at the call site.

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "search_memories",
    description:
      "Semantic search across the user's photos, life facts, people, and events. Use this when looking up things by meaning rather than exact name (e.g. 'show me beach photos', 'what do I love about my garden').",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Natural-language search query.",
        },
        kinds: {
          type: "array",
          items: {
            type: "string",
            enum: ["media", "life_facts", "people", "events"],
          },
          description:
            "Optional restriction of memory kinds to search. Defaults to all kinds.",
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 10,
          description: "Maximum number of results (default 5, hard max 10).",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_person",
    description:
      "Look up a person in the user's life by exact id or by name (case-insensitive partial match). Returns their relationship and key facts.",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Person's name (partial match allowed).",
        },
        id: { type: "string", description: "Person's UUID, if known." },
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
        from: {
          type: "string",
          description: "ISO date (inclusive lower bound).",
        },
        to: {
          type: "string",
          description: "ISO date (inclusive upper bound).",
        },
        type: {
          type: "string",
          enum: ["one_time", "recurring", "routine"],
          description: "Filter by event type.",
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 50,
          description: "Maximum number of events to return (default 20).",
        },
      },
    },
  },
  {
    name: "get_life_facts",
    description:
      "Return key identity facts about the user. If `topic` is provided, semantic-filter to facts related to that topic.",
    parameters: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          description:
            "Optional topic to filter facts (e.g. 'work', 'family').",
        },
      },
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
      "Persist a new fact, observation, or preference learned about the user during the conversation. Use sparingly — only for clearly useful, durable information.",
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
          description:
            "Category of memory. Pick the most specific that applies.",
        },
        content: {
          type: "string",
          description: "The thing to remember, as a short sentence.",
        },
        importance: {
          type: "integer",
          minimum: 1,
          maximum: 5,
          description:
            "Importance from 1 (trivial) to 5 (critical). Memories with importance >= 4 will be flagged for the co-user to review.",
        },
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
        topic: {
          type: "string",
          description: "Optional topic substring to filter by.",
        },
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
      "Raise a concern for the user's helper to review (e.g. distress, safety worry, repeated confusion). Do not over-use; reserved for genuine needs.",
    parameters: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description: "Short description of why this needs attention.",
        },
        severity: {
          type: "string",
          enum: ["low", "medium", "high"],
          description: "Urgency of the flag.",
        },
      },
      required: ["reason", "severity"],
    },
  },
];

// ─── Tool handlers ──────────────────────────────────────────────────
// Each handler must be DEFENSIVE: never throw, always return either a
// useful result object or `{ error: "..." }`. The agent loop turns
// errors back into a tool message so the LLM can recover.

export const TOOL_HANDLERS: Record<string, ToolHandler> = {
  search_memories: async (args, ctx) => {
    try {
      const query = String(args?.query ?? "").trim();
      if (!query) return { error: "query is required" };
      const callerLimit = args?.limit;
      const limit = Math.min(Math.max(Number(callerLimit ?? 5), 1), 10);
      // Fallback default is 1 so a vague "show me a photo" doesn't dump
      // every verified photo on the user. If the caller explicitly asked
      // for more, honour their (clamped) value.
      const fallbackLimit = callerLimit !== undefined ? limit : 1;
      const kinds: EmbeddingKind[] | undefined =
        Array.isArray(args?.kinds) && args.kinds.length > 0
          ? (args.kinds as EmbeddingKind[])
          : undefined;
      const results = await searchMemories(ctx.userId, query, {
        limit,
        ...(kinds ? { kinds } : {}),
      });

      // Fallback: if RAG returned nothing AND the caller wants media (or any kind),
      // fall back to the user's most recent verified photos. This covers two cases:
      //   1. Embeddings haven't been backfilled yet (so match_memories returns 0).
      //   2. The user asked something generic like "show me a picture of anything".
      const wantsMedia = !kinds || kinds.includes("media");
      if (results.length === 0 && wantsMedia) {
        const { data } = await ctx.supabase
          .from("media")
          .select("id, file_url, description, taken_at, ai_tags")
          .eq("user_id", ctx.userId)
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

  get_person: async (args, ctx) => {
    try {
      const name = args?.name ? String(args.name).trim() : "";
      const id = args?.id ? String(args.id).trim() : "";
      if (!name && !id) return { error: "name or id is required" };

      let query = ctx.supabase
        .from("people")
        .select(
          "id, full_name, relationship, key_facts, emotional_notes, photo_url"
        )
        .eq("user_id", ctx.userId);

      if (id) {
        query = query.eq("id", id);
      } else {
        query = query.ilike("full_name", `%${name}%`);
      }

      const { data, error } = await query.limit(5);
      if (error) return { error: error.message };
      return { people: data ?? [] };
    } catch (err: any) {
      return { error: err?.message ?? "get_person failed" };
    }
  },

  list_events: async (args, ctx) => {
    try {
      const from = args?.from ? String(args.from) : null;
      const to = args?.to ? String(args.to) : null;
      const type = args?.type ? String(args.type) : null;
      const limit = Math.min(Math.max(Number(args?.limit ?? 20), 1), 50);

      let query = ctx.supabase
        .from("events")
        .select("id, title, description, event_date, event_type")
        .eq("user_id", ctx.userId);

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

  get_life_facts: async (args, ctx) => {
    try {
      const topic = args?.topic ? String(args.topic).trim() : "";

      if (topic) {
        const matches = await searchMemories(ctx.userId, topic, {
          kinds: ["life_facts"],
          limit: 10,
        });
        return {
          facts: matches.map((m) => ({
            id: m.id,
            fact: m.text_snippet,
            similarity: m.similarity,
          })),
        };
      }

      const { data, error } = await ctx.supabase
        .from("life_facts")
        .select("id, fact, category")
        .eq("user_id", ctx.userId)
        .order("display_order");

      if (error) return { error: error.message };
      return { facts: data ?? [] };
    } catch (err: any) {
      return { error: err?.message ?? "get_life_facts failed" };
    }
  },

  get_user_profile: async (_args, ctx) => {
    try {
      const { data, error } = await ctx.supabase
        .from("users")
        .select("full_name, location, date_of_birth, cognitive_level")
        .eq("id", ctx.userId)
        .single();
      if (error) return { error: error.message };
      return { profile: data };
    } catch (err: any) {
      return { error: err?.message ?? "get_user_profile failed" };
    }
  },

  remember_about_user: async (args, ctx) => {
    try {
      const kind = String(args?.kind ?? "").trim() as MemoryKind;
      const content = String(args?.content ?? "").trim();
      if (!content) return { error: "content is required" };
      const allowed: MemoryKind[] = [
        "observation",
        "preference",
        "recurring_question",
        "emotional_state",
        "factual_correction",
      ];
      if (!allowed.includes(kind)) {
        return { error: `kind must be one of: ${allowed.join(", ")}` };
      }
      const importance = Number(args?.importance ?? 3);
      const sourceMessageId =
        typeof args?.sourceMessageId === "string" ? args.sourceMessageId : undefined;
      const sourceConvId =
        typeof args?.sourceConvId === "string" ? args.sourceConvId : undefined;

      const result = await rememberAboutUser(
        ctx.userId,
        kind,
        content,
        importance,
        sourceMessageId,
        sourceConvId
      );
      if ("error" in result) return { error: result.error };
      return { remembered: true, id: result.id };
    } catch (err: any) {
      return { error: err?.message ?? "remember_about_user failed" };
    }
  },

  recall_about_user: async (args, ctx) => {
    try {
      const topic = args?.topic ? String(args.topic).trim() : "";
      const limit = Number.isFinite(Number(args?.limit))
        ? Number(args.limit)
        : 5;
      const kinds: MemoryKind[] | undefined =
        Array.isArray(args?.kinds) && args.kinds.length > 0
          ? (args.kinds as MemoryKind[])
          : undefined;

      const memories = await recallAboutUser(ctx.userId, {
        ...(topic ? { topic } : {}),
        limit,
        ...(kinds ? { kinds } : {}),
      });
      return { memories };
    } catch (err: any) {
      return { error: err?.message ?? "recall_about_user failed" };
    }
  },

  flag_for_co_user: async (args, ctx) => {
    try {
      const reason = String(args?.reason ?? "").trim();
      if (!reason) return { error: "reason is required" };
      const severity = ["low", "medium", "high"].includes(args?.severity)
        ? args.severity
        : "medium";

      // `flag_queue.reference_id` is NOT NULL but has no FK — use the
      // user id so RLS policies still pass and the row stays valid.
      const { data, error } = await ctx.supabase
        .from("flag_queue")
        .insert({
          user_id: ctx.userId,
          flag_type: "journal",
          reference_id: ctx.userId,
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
};
