// "Write About Them" — the co-user's freeform narrative about the patient.
//
// Companion to `user_narratives` / `narrative_chunks` (see
// supabase/add_documents_and_narratives.sql) and the `process-narrative` Edge
// Function. The co-user writes prose; the Edge Function chunks + embeds it for
// RAG (kind 'narrative') and extracts structured SUGGESTIONS (people, life
// facts, events, sensitivity hints) for the co-user to review and accept.
//
// ─── Fail policy ────────────────────────────────────────────────────
// `getNarrative` is a READ-PATH helper and never throws (returns "" on error).
// `saveNarrative` invokes the Edge Function and returns a result envelope so
// the co-user UI can show an error but never crash.

import { supabase } from "./supabase";

// Each field mirrors a core table the suggestion can be promoted into. The
// shapes are intentionally loose strings so the review UI can edit before
// committing — nothing here is written to a core table without co-user action.
export interface NarrativePersonSuggestion {
  name: string;
  relationship: string | null;
  notes: string | null;
}

export interface NarrativeLifeFactSuggestion {
  fact: string;
  category: string | null;
}

export interface NarrativeEventSuggestion {
  title: string;
  description: string | null;
  event_type: "one_time" | "recurring" | "routine";
  recurrence_rule: string | null;
}

export interface NarrativeSensitivitySuggestion {
  intent_text: string;
  filter_type: "person" | "topic" | "time_period";
}

export interface NarrativeSuggestions {
  people: NarrativePersonSuggestion[];
  life_facts: NarrativeLifeFactSuggestion[];
  events: NarrativeEventSuggestion[];
  sensitivity_hints: NarrativeSensitivitySuggestion[];
}

export interface SaveNarrativeResult {
  ok: boolean;
  chunkCount?: number;
  suggestions?: NarrativeSuggestions;
  error?: string;
}

const EMPTY_SUGGESTIONS: NarrativeSuggestions = {
  people: [],
  life_facts: [],
  events: [],
  sensitivity_hints: [],
};

/** Read the patient's current narrative text. Returns "" on any error/none. */
export async function getNarrative(userId: string): Promise<string> {
  try {
    const { data, error } = await supabase
      .from("user_narratives")
      .select("raw_text")
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !data) return "";
    return typeof data.raw_text === "string" ? data.raw_text : "";
  } catch {
    return "";
  }
}

/**
 * Save + process the narrative: re-chunks, re-embeds, and returns extracted
 * suggestions for review. The raw text is persisted regardless; suggestions
 * are best-effort (empty array if extraction failed).
 */
export async function saveNarrative(
  userId: string,
  rawText: string
): Promise<SaveNarrativeResult> {
  try {
    const { data, error } = await supabase.functions.invoke(
      "process-narrative",
      { body: { user_id: userId, raw_text: rawText } }
    );
    if (error) {
      return { ok: false, error: error.message };
    }
    const parsed = typeof data === "string" ? JSON.parse(data) : data;
    if (!parsed || parsed.error) {
      return { ok: false, error: parsed?.error ?? "empty response" };
    }
    return {
      ok: true,
      chunkCount: Number(parsed.chunk_count ?? 0),
      suggestions: (parsed.suggestions as NarrativeSuggestions) ?? EMPTY_SUGGESTIONS,
    };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "saveNarrative threw" };
  }
}
