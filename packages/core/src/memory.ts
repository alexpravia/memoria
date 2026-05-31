// Persistent assistant memory client (Phase D).
//
// Companion to `assistant_memory` (see supabase/assistant_memory.sql).
// The assistant calls `rememberAboutUser` via the `remember_about_user`
// tool to persist observations between conversations and
// `recallAboutUser` via the `recall_about_user` tool to retrieve them.
// The co-user manages stored memories from `AIMemoryScreen` using the
// `listMemoriesForCoUser`, `updateMemoryStatus`, and `deleteMemory`
// helpers below.
//
// ─── Fail policy ────────────────────────────────────────────────────
// `recallAboutUser` and `listMemoriesForCoUser` are READ-PATH helpers.
// They never throw — on any error they log a warning and return [].
// Write-path helpers (`rememberAboutUser`, `updateMemoryStatus`,
// `deleteMemory`) return a result envelope (`{ id }` / `{ ok }` /
// `{ error }`) so callers can decide what to do, but they never throw.
//
// ─── Importance & flag_queue ────────────────────────────────────────
// When a memory is created with importance >= 4 we also drop a row in
// `flag_queue` so the co-user is prompted to review it. The current
// `flag_queue.flag_type` enum has no `memory` value (Phase D doesn't
// modify the schema) so we reuse `journal`, which is the closest fit
// for an assistant-generated text observation. The description carries
// the literal memory content for quick triage.

import { supabase } from "./supabase";

export type MemoryKind =
  | "observation"
  | "preference"
  | "recurring_question"
  | "emotional_state"
  | "factual_correction";

export interface AssistantMemory {
  id: string;
  user_id: string;
  kind: MemoryKind;
  content: string;
  importance: number;
  created_at: string;
  expires_at?: string | null;
  status: "active" | "pinned" | "suppressed";
  reviewed_by_couser: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Default expiry in days per memory kind. `null` means the memory never
 * auto-expires (preferences and factual corrections are durable).
 */
function defaultExpiryDays(kind: MemoryKind): number | null {
  switch (kind) {
    case "observation":
      return 30;
    case "emotional_state":
      return 7;
    case "recurring_question":
      return 90;
    case "preference":
    case "factual_correction":
      return null;
  }
}

function expiresAtFor(kind: MemoryKind, now: Date = new Date()): string | null {
  const days = defaultExpiryDays(kind);
  if (days === null) return null;
  return new Date(now.getTime() + days * DAY_MS).toISOString();
}

// Clamp importance into the 1..5 schema range without throwing on bad input.
function clampImportance(importance: number): number {
  const n = Number.isFinite(importance) ? Math.round(importance) : 3;
  if (n < 1) return 1;
  if (n > 5) return 5;
  return n;
}

// ─── rememberAboutUser ──────────────────────────────────────────────
//
// Inserts a new `assistant_memory` row. When `importance >= 4`, also
// creates a `flag_queue` entry so the co-user reviews high-importance
// memories before they pile up. The flag insert is fire-and-forget —
// failure to flag does not roll back the memory itself.

export async function rememberAboutUser(
  userId: string,
  kind: MemoryKind,
  content: string,
  importance: number,
  sourceMessageId?: string,
  sourceConvId?: string
): Promise<{ id: string } | { error: string }> {
  try {
    const trimmed = (content ?? "").toString().trim();
    if (!trimmed) return { error: "content is required" };
    const importanceClamped = clampImportance(importance);

    const row: Record<string, unknown> = {
      user_id: userId,
      kind,
      content: trimmed,
      importance: importanceClamped,
      expires_at: expiresAtFor(kind),
    };
    if (sourceMessageId) row.source_message_id = sourceMessageId;
    if (sourceConvId) row.source_conversation_id = sourceConvId;

    const { data, error } = await supabase
      .from("assistant_memory")
      .insert(row)
      .select("id")
      .single();

    if (error) return { error: error.message };
    if (!data?.id) return { error: "insert returned no id" };

    if (importanceClamped >= 4) {
      // Fire-and-forget — never block the conversation loop on flag
      // insert failures.
      supabase
        .from("flag_queue")
        .insert({
          user_id: userId,
          flag_type: "journal",
          reference_id: data.id,
          description: `Memory to review: ${trimmed}`,
        })
        .then((res) => {
          if (res?.error) {
            console.warn(
              "rememberAboutUser: flag_queue insert failed:",
              res.error.message
            );
          }
        });
    }

    return { id: data.id as string };
  } catch (err: any) {
    return { error: err?.message ?? "rememberAboutUser failed" };
  }
}

// ─── recallAboutUser ────────────────────────────────────────────────
//
// Returns the most relevant active memories for the user. Pinned rows
// surface first, then by importance desc, then by recency. Suppressed
// rows are filtered out. Topic filtering is a substring `ILIKE` for
// now — semantic recall via embeddings is a Phase 2 polish.

export async function recallAboutUser(
  userId: string,
  opts?: { topic?: string; limit?: number; kinds?: MemoryKind[] }
): Promise<AssistantMemory[]> {
  try {
    const limit = Math.min(Math.max(Number(opts?.limit ?? 5), 1), 50);

    let query = supabase
      .from("assistant_memory")
      .select(
        "id, user_id, kind, content, importance, created_at, expires_at, status, reviewed_by_couser"
      )
      .eq("user_id", userId)
      .neq("status", "suppressed");

    if (opts?.kinds && opts.kinds.length > 0) {
      query = query.in("kind", opts.kinds);
    }

    if (opts?.topic && opts.topic.trim().length > 0) {
      query = query.ilike("content", `%${opts.topic.trim()}%`);
    }

    const { data, error } = await query
      .order("status", { ascending: true }) // 'pinned' < 'active' alphabetically
      .order("importance", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.warn("recallAboutUser: query failed:", error.message);
      return [];
    }
    return (data ?? []) as AssistantMemory[];
  } catch (err: any) {
    console.warn("recallAboutUser: threw:", err?.message);
    return [];
  }
}

// ─── listMemoriesForCoUser ──────────────────────────────────────────
//
// Inspector view for the AI Memory screen — returns ALL memories
// (including suppressed) so the co-user can manage them. Ordered by
// the same precedence as `recallAboutUser`.

export async function listMemoriesForCoUser(
  userId: string
): Promise<AssistantMemory[]> {
  try {
    const { data, error } = await supabase
      .from("assistant_memory")
      .select(
        "id, user_id, kind, content, importance, created_at, expires_at, status, reviewed_by_couser"
      )
      .eq("user_id", userId)
      .order("status", { ascending: true })
      .order("importance", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("listMemoriesForCoUser: query failed:", error.message);
      return [];
    }
    return (data ?? []) as AssistantMemory[];
  } catch (err: any) {
    console.warn("listMemoriesForCoUser: threw:", err?.message);
    return [];
  }
}

// ─── updateMemoryStatus ─────────────────────────────────────────────

export async function updateMemoryStatus(
  memoryId: string,
  status: "active" | "pinned" | "suppressed"
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from("assistant_memory")
      .update({ status, reviewed_by_couser: true })
      .eq("id", memoryId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "updateMemoryStatus failed" };
  }
}

// ─── deleteMemory ───────────────────────────────────────────────────

export async function deleteMemory(
  memoryId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from("assistant_memory")
      .delete()
      .eq("id", memoryId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "deleteMemory failed" };
  }
}
