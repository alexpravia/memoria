// Preference signals — implicit co-user feedback captured for a future
// Memoria-specific fine-tune (Phase 2D).
//
// Every co-user action that implies "this output was good/bad" (pinning,
// suppressing, deleting a memory; approving, regenerating, pruning a briefing)
// is logged here. This is pure, non-blocking data collection: `logPreferenceSignal`
// is fire-and-forget and never throws, mirroring the rememberAboutUser pattern
// in memory.ts. A logging failure must never surface to the co-user or block
// the primary mutation.

import { supabase } from "./supabase";

export type PreferenceSignalType =
  | "memory_pinned"
  | "memory_unpinned"
  | "memory_suppressed"
  | "memory_restored"
  | "memory_deleted"
  | "briefing_approved"
  | "briefing_regenerated"
  | "briefing_slide_deleted"
  | "briefing_slide_edited";

export interface PreferenceSignalInput {
  userId: string;
  signalType: PreferenceSignalType;
  coUserId?: string | null;
  /** Row this signal is about (memory id, briefing id, …). */
  referenceId?: string | null;
  /** Snapshot of the content acted on (captured BEFORE a delete). */
  content?: string | null;
  /** Prior value, for edit/transition signals. */
  previousContent?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Fire-and-forget log of an implicit co-user preference signal. Never awaited,
 * never throws. Returns void so call sites can invoke it inline without async
 * ceremony: `logPreferenceSignal({ ... })`.
 */
export function logPreferenceSignal(input: PreferenceSignalInput): void {
  if (!input?.userId || !input?.signalType) return;

  const row = {
    user_id: input.userId,
    co_user_id: input.coUserId ?? null,
    signal_type: input.signalType,
    reference_id: input.referenceId ?? null,
    content: input.content ?? null,
    previous_content: input.previousContent ?? null,
    metadata: input.metadata ?? null,
  };

  supabase
    .from("preference_signals")
    .insert(row)
    .then((res) => {
      if (res?.error) {
        console.warn(
          "logPreferenceSignal: insert failed:",
          res.error.message
        );
      }
    });
}
