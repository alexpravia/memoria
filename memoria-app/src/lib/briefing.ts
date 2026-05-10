// AI-orchestrated morning briefing client (Phase E).
//
// Companion to `briefings` (see supabase/briefings.sql) and the
// `generate-briefing` Edge Function. The briefing is generated overnight
// by the co-user and approved before delivery; the user's BriefingScreen
// reads the approved row at mount time and falls back to the legacy
// procedural builder if no briefing exists.
//
// ─── Fail policy ────────────────────────────────────────────────────
// `getTodaysBriefing` and `resolveSlidePhotos` are READ-PATH helpers and
// never throw — they return null / unmodified slides on any error. The
// write helpers (`approveBriefing`, `updateSlide`, `reorderSlides`,
// `markDelivered`) return a result envelope so the co-user UI can show
// an error message but never crash.

import { supabase } from "./supabase";

// ─── Slide schema (single source of truth) ──────────────────────────

export type SlideKind =
  | "greeting"
  | "fact"
  | "person"
  | "memory_photo"
  | "event"
  | "reassurance"
  | "pinned_note";

export const SLIDE_KINDS: SlideKind[] = [
  "greeting",
  "fact",
  "person",
  "memory_photo",
  "event",
  "reassurance",
  "pinned_note",
];

export interface BriefingSlide {
  kind: SlideKind;
  title: string;
  body: string;
  tts_text: string;
  photo_id?: string;
  photo_url?: string;
  duration_ms?: number;
}

export type BriefingStatus = "draft" | "approved" | "delivered" | "failed";

export interface Briefing {
  id: string;
  user_id: string;
  briefing_date: string;
  slides: BriefingSlide[];
  status: BriefingStatus;
}

// ─── Validators ─────────────────────────────────────────────────────

// Matches both bare URLs and bracketed/raw forms.
const URL_RE = /\b(?:https?:\/\/|www\.)\S+/i;
// Conservative UUID v1-v5 detector.
const UUID_RE =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;

export type ValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Validates a single briefing slide's shape.
 *
 * NOTE: `photo_id` is intentionally not type-checked; resolveSlidePhotos /
 * consumers must handle non-string values defensively. The model
 * occasionally emits `photo_id` as `null`, `""`, `[]`, `{}`, a number, or
 * a boolean instead of a UUID string; rejecting those would fail an
 * otherwise well-formed briefing. The `generate-briefing` Edge Function
 * sanitizes/strips the field before persistence.
 */
export function validateSlide(slide: any): ValidationResult {
  if (!slide || typeof slide !== "object") {
    return { ok: false, reason: "slide must be an object" };
  }
  const { kind, title, body, tts_text } = slide;

  if (typeof kind !== "string" || !(SLIDE_KINDS as string[]).includes(kind)) {
    return { ok: false, reason: `unknown slide kind: ${String(kind)}` };
  }
  if (typeof title !== "string" || title.trim().length === 0) {
    return { ok: false, reason: "slide.title is required" };
  }
  if (typeof body !== "string" || body.trim().length === 0) {
    return { ok: false, reason: "slide.body is required" };
  }
  if (typeof tts_text !== "string" || tts_text.trim().length === 0) {
    return { ok: false, reason: "slide.tts_text is required" };
  }
  if (URL_RE.test(tts_text)) {
    return { ok: false, reason: "slide.tts_text must not contain URLs" };
  }
  if (UUID_RE.test(tts_text)) {
    return { ok: false, reason: "slide.tts_text must not contain raw IDs" };
  }
  return { ok: true };
}

export function validateBriefing(
  slides: any[],
  candidatePhotoIds: string[] = []
): ValidationResult {
  if (!Array.isArray(slides)) {
    return { ok: false, reason: "slides must be an array" };
  }
  if (slides.length < 6 || slides.length > 12) {
    return {
      ok: false,
      reason: `slide count out of range: ${slides.length} (expected 6-12)`,
    };
  }
  const pool = new Set(candidatePhotoIds);
  for (let i = 0; i < slides.length; i++) {
    const r = validateSlide(slides[i]);
    if (!r.ok) return { ok: false, reason: `slide ${i}: ${r.reason}` };
    // Pool-membership check is intentionally limited to non-empty
    // strings: non-string `photo_id` values (array, object, number,
    // boolean, null, undefined, '') are tolerated and skipped here.
    // See `validateSlide` JSDoc for rationale.
    const pid: unknown = slides[i].photo_id;
    if (
      typeof pid === "string" &&
      pid.length > 0 &&
      pool.size > 0 &&
      !pool.has(pid)
    ) {
      return {
        ok: false,
        reason: `slide ${i} references photo_id ${pid} not in candidate pool`,
      };
    }
  }
  return { ok: true };
}

// ─── Date helpers ───────────────────────────────────────────────────

function todayISO(): string {
  // YYYY-MM-DD in local time. Briefings are date-keyed by the user's
  // wall-clock day, not UTC.
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ─── generateBriefing ───────────────────────────────────────────────
//
// Calls the `generate-briefing` Edge Function. The function does the
// data gathering, LLM call, validation, and DB insert; the client just
// kicks it off and returns the result.

export async function generateBriefing(
  userId: string,
  date?: string
): Promise<{ briefing: Briefing | null; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke("generate-briefing", {
      body: { userId, date: date ?? todayISO() },
    });
    if (error) {
      return { briefing: null, error: error.message };
    }
    const parsed = typeof data === "string" ? JSON.parse(data) : data;
    if (!parsed) {
      return { briefing: null, error: "empty response" };
    }
    if (parsed.error) {
      return { briefing: parsed.briefing ?? null, error: String(parsed.error) };
    }
    return { briefing: (parsed.briefing as Briefing) ?? null };
  } catch (err: any) {
    return { briefing: null, error: err?.message ?? "generateBriefing threw" };
  }
}

export async function regenerateBriefing(
  userId: string,
  date?: string
): Promise<{ briefing: Briefing | null; error?: string }> {
  // The Edge Function upserts on (user_id, briefing_date). Calling it
  // again overwrites the existing draft (status reset to 'draft').
  return generateBriefing(userId, date);
}

// ─── getTodaysBriefing ──────────────────────────────────────────────
//
// Fetches today's briefing for the user. Only returns rows in
// `approved` or `delivered` status — drafts and failures fall back to
// the procedural builder so the user is never blocked.

export async function getTodaysBriefing(
  userId: string
): Promise<Briefing | null> {
  try {
    const { data, error } = await supabase
      .from("briefings")
      .select("id, user_id, briefing_date, slides, status")
      .eq("user_id", userId)
      .eq("briefing_date", todayISO())
      .in("status", ["approved", "delivered"])
      .maybeSingle();
    if (error) {
      console.warn("getTodaysBriefing: query failed:", error.message);
      return null;
    }
    if (!data) return null;
    return data as Briefing;
  } catch (err: any) {
    console.warn("getTodaysBriefing: threw:", err?.message);
    return null;
  }
}

// ─── getDraftBriefing ───────────────────────────────────────────────
//
// Co-user preview helper — returns the briefing row regardless of
// status so the preview screen can render drafts and failed runs too.

export async function getBriefingForDate(
  userId: string,
  date: string
): Promise<Briefing | null> {
  try {
    const { data, error } = await supabase
      .from("briefings")
      .select("id, user_id, briefing_date, slides, status")
      .eq("user_id", userId)
      .eq("briefing_date", date)
      .maybeSingle();
    if (error) {
      console.warn("getBriefingForDate: query failed:", error.message);
      return null;
    }
    return (data as Briefing) ?? null;
  } catch (err: any) {
    console.warn("getBriefingForDate: threw:", err?.message);
    return null;
  }
}

// ─── approveBriefing ────────────────────────────────────────────────

export async function approveBriefing(
  briefingId: string,
  coUserId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from("briefings")
      .update({
        status: "approved",
        approved_by: coUserId,
        approved_at: new Date().toISOString(),
      })
      .eq("id", briefingId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "approveBriefing failed" };
  }
}

// ─── updateSlide ────────────────────────────────────────────────────
//
// Replaces a single slide in the JSONB array by index. We round-trip
// the array because Postgres jsonb element updates require either a
// full array overwrite or `jsonb_set`; the array overwrite is simpler
// and consistent with how the validator expects to see slides.

export async function updateSlide(
  briefingId: string,
  index: number,
  updated: BriefingSlide
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("briefings")
      .select("slides")
      .eq("id", briefingId)
      .single();
    if (error) return { ok: false, error: error.message };
    const slides = (data?.slides as BriefingSlide[]) ?? [];
    if (index < 0 || index >= slides.length) {
      return { ok: false, error: `index out of range: ${index}` };
    }
    const next = [...slides];
    next[index] = updated;
    const { error: upErr } = await supabase
      .from("briefings")
      .update({ slides: next })
      .eq("id", briefingId);
    if (upErr) return { ok: false, error: upErr.message };
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "updateSlide failed" };
  }
}

// ─── reorderSlides ──────────────────────────────────────────────────

export async function reorderSlides(
  briefingId: string,
  newOrder: number[]
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("briefings")
      .select("slides")
      .eq("id", briefingId)
      .single();
    if (error) return { ok: false, error: error.message };
    const slides = (data?.slides as BriefingSlide[]) ?? [];
    if (newOrder.length !== slides.length) {
      return {
        ok: false,
        error: `newOrder length ${newOrder.length} != slides length ${slides.length}`,
      };
    }
    const seen = new Set<number>();
    const next: BriefingSlide[] = [];
    for (const idx of newOrder) {
      if (idx < 0 || idx >= slides.length || seen.has(idx)) {
        return { ok: false, error: `invalid index in newOrder: ${idx}` };
      }
      seen.add(idx);
      next.push(slides[idx]);
    }
    const { error: upErr } = await supabase
      .from("briefings")
      .update({ slides: next })
      .eq("id", briefingId);
    if (upErr) return { ok: false, error: upErr.message };
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "reorderSlides failed" };
  }
}

// ─── markDelivered ──────────────────────────────────────────────────

export async function markDelivered(briefingId: string): Promise<void> {
  try {
    await supabase
      .from("briefings")
      .update({
        status: "delivered",
        delivered_at: new Date().toISOString(),
      })
      .eq("id", briefingId);
  } catch (err: any) {
    console.warn("markDelivered: threw:", err?.message);
  }
}

// ─── resolveSlidePhotos ─────────────────────────────────────────────
//
// Looks up `media.file_url` for every slide that carries a photo_id and
// fills in `photo_url`. Slides without a photo_id are returned
// unchanged. On any error the slides come back as-is.
//
// Safety filters (so the user never sees a broken/blank image):
//   • Excludes media rows whose `verification_status='hidden'` at the
//     query level — rows hidden by the co-user or marked broken by the
//     repair script never resolve to a URL.
//   • Drops rows whose `file_url` is not an http(s) URL (e.g. legacy
//     `file://` local URIs that survived earlier imports).
// Slides whose photo_id resolves to a hidden/broken row stay in the
// returned array but with `photo_url` left undefined.

export async function resolveSlidePhotos(
  slides: BriefingSlide[]
): Promise<BriefingSlide[]> {
  try {
    const ids = Array.from(
      new Set(
        slides
          .map((s) => s.photo_id)
          .filter((id): id is string => typeof id === "string" && id.length > 0)
      )
    );
    if (ids.length === 0) return slides;

    const { data, error } = await supabase
      .from("media")
      .select("id, file_url")
      .in("id", ids)
      .neq("verification_status", "hidden");
    if (error) {
      console.warn("resolveSlidePhotos: query failed:", error.message);
      return slides;
    }
    const map = new Map<string, string>();
    for (const row of (data as Array<{ id: string; file_url: string }>) ?? []) {
      if (
        row.file_url &&
        String(row.file_url).toLowerCase().startsWith("http")
      ) {
        map.set(row.id, row.file_url);
      }
    }
    return slides.map((s) => {
      if (!s.photo_id) return s;
      const url = map.get(s.photo_id);
      return url ? { ...s, photo_url: url } : s;
    });
  } catch (err: any) {
    console.warn("resolveSlidePhotos: threw:", err?.message);
    return slides;
  }
}
