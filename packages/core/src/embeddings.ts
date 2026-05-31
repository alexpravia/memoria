// Embeddings + semantic memory search.
//
// Thin client over the `embed` Edge Function and the `match_memories` RPC
// added in `supabase/add_embeddings.sql`. Designed to be safe for
// fire-and-forget calls from screen save handlers — write-path helpers
// never throw and never block the user.

import { supabase } from "./supabase";

export type EmbeddingKind = "media" | "life_facts" | "people" | "events";

export interface MemoryMatch {
  kind: EmbeddingKind;
  id: string;
  text_snippet: string;
  similarity: number;
  metadata: Record<string, any>;
}

interface EmbedResponse {
  embedding?: number[];
  error?: string;
}

interface EmbedBatchResponse {
  embeddings?: number[][];
  error?: string;
}

/** Embed a single piece of text. Throws on failure. */
export async function embed(text: string): Promise<number[]> {
  const { data, error } = await supabase.functions.invoke("embed", {
    body: { text },
  });

  if (error) {
    throw new Error(error.message || "embed function failed");
  }

  const parsed: EmbedResponse =
    typeof data === "string" ? JSON.parse(data) : data;

  if (!parsed?.embedding || !Array.isArray(parsed.embedding)) {
    throw new Error(parsed?.error || "embed returned no embedding");
  }

  return parsed.embedding;
}

/** Embed many texts at once. Throws on failure. */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const { data, error } = await supabase.functions.invoke("embed", {
    body: { texts },
  });

  if (error) {
    throw new Error(error.message || "embed function failed");
  }

  const parsed: EmbedBatchResponse =
    typeof data === "string" ? JSON.parse(data) : data;

  if (!parsed?.embeddings || !Array.isArray(parsed.embeddings)) {
    throw new Error(parsed?.error || "embed returned no embeddings");
  }

  return parsed.embeddings;
}

/**
 * Embed `text` and persist it to the row identified by (table, id).
 *
 * Never throws — returns `{ ok: false, error }` on any failure so callers
 * can fire-and-forget without try/catch. The user-facing save flow must
 * never break because an embedding call failed.
 */
export async function embedAndStore(
  table: EmbeddingKind,
  id: string,
  text: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!text || !text.trim()) {
      return { ok: false, error: "empty text" };
    }

    const embedding = await embed(text);

    const { error } = await supabase
      .from(table)
      .update({
        embedding,
        embedding_text: text,
        embedding_updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || "embedAndStore failed" };
  }
}

export interface SearchMemoriesOpts {
  limit?: number;
  kinds?: EmbeddingKind[];
  /**
   * Minimum cosine similarity (0..1) a row must clear to be returned. Defaults
   * to 0 (no filtering) to preserve raw recall for callers like the eval
   * harness. The agentic assistant passes a higher floor to cut noise.
   */
  minSimilarity?: number;
}

const DEFAULT_KINDS: EmbeddingKind[] = [
  "media",
  "life_facts",
  "people",
  "events",
];

/**
 * Embed `query` and search across the user's memory with `match_memories`.
 * Returns an empty array on any failure (logged) so callers can degrade
 * gracefully.
 */
export async function searchMemories(
  userId: string,
  query: string,
  opts: SearchMemoriesOpts = {}
): Promise<MemoryMatch[]> {
  const limit = opts.limit ?? 10;
  const kinds = opts.kinds ?? DEFAULT_KINDS;
  const minSimilarity = opts.minSimilarity ?? 0;

  try {
    const queryEmbedding = await embed(query);

    const { data, error } = await supabase.rpc("match_memories", {
      p_user_id: userId,
      p_query_embedding: queryEmbedding,
      p_match_count: limit,
      p_kinds: kinds,
      p_min_similarity: minSimilarity,
    });

    if (error) {
      console.warn("searchMemories rpc failed:", error.message);
      return [];
    }

    if (!data) return [];

    return (data as any[]).map((row) => ({
      kind: row.kind as EmbeddingKind,
      id: row.id as string,
      text_snippet: (row.text_snippet ?? "") as string,
      similarity: Number(row.similarity ?? 0),
      metadata:
        row.metadata && typeof row.metadata === "object" ? row.metadata : {},
    }));
  } catch (err: any) {
    console.warn("searchMemories failed:", err?.message);
    return [];
  }
}
