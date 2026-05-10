import { supabase } from "./supabase";
import { embedAndStore } from "./embeddings";

interface ProcessedPhoto {
  mediaId: string;
  description: string;
  tags: string[];
  people_identified: Array<{ name: string; confidence: string }>;
  needs_review: boolean;
  review_reason: string | null;
}

const CONFIDENCE_MAP: Record<string, number> = {
  high: 0.9,
  medium: 0.7,
  low: 0.3,
};

async function upsertPendingFlag(
  mediaId: string,
  userId: string,
  description: string
): Promise<void> {
  const { data: existingFlag } = await supabase
    .from("flag_queue")
    .select("id")
    .eq("reference_id", mediaId)
    .eq("flag_type", "media")
    .eq("status", "pending")
    .maybeSingle();

  if (existingFlag) return;

  await supabase.from("flag_queue").insert({
    user_id: userId,
    flag_type: "media",
    reference_id: mediaId,
    description,
    status: "pending",
  });
}

export async function processPhoto(
  mediaId: string,
  photoUrl: string,
  userId: string
): Promise<ProcessedPhoto | null> {
  // Guard: refuse to send non-http URLs to the vision API. Hide the
  // row instead so it disappears from gallery + flag queue.
  if (!photoUrl || typeof photoUrl !== "string" || !photoUrl.toLowerCase().startsWith("http")) {
    console.warn(`processPhoto: skipping ${mediaId}, non-http file_url: ${photoUrl}`);
    await supabase
      .from("media")
      .update({ verification_status: "hidden" })
      .eq("id", mediaId);
    // Best-effort: clear pending flag rows for this media id.
    await supabase
      .from("flag_queue")
      .delete()
      .eq("flag_type", "media")
      .eq("reference_id", mediaId)
      .eq("status", "pending");
    return null;
  }

  // Fetch user's people list for face matching context
  const { data: peopleData } = await supabase
    .from("people")
    .select("id, full_name, relationship, photo_url")
    .eq("user_id", userId);

  const people = peopleData || [];

  // Call the process-photo Edge Function
  const { data, error } = await supabase.functions.invoke("process-photo", {
    body: {
      photoUrl,
      mediaId,
      people: people.map((p) => ({
        name: p.full_name,
        relationship: p.relationship,
        photo_url: p.photo_url,
      })),
    },
  });

  if (error || !data) {
    console.warn(`AI processing failed for media ${mediaId}:`, error?.message || "No data returned");

    await supabase
      .from("media")
      .update({ verification_status: "pending" })
      .eq("id", mediaId);

    await upsertPendingFlag(
      mediaId,
      userId,
      `AI processing failed: ${error?.message || "No response from model"}`
    );

    return null;
  }

  const result: ProcessedPhoto =
    typeof data === "string" ? JSON.parse(data) : data;
  result.mediaId = mediaId;

  // Update media row with description and tags.
  //
  // Auto-verify a photo when:
  //   - the model didn't flag it for review, AND
  //   - any people it claims to identify are all high-confidence.
  //
  // Photos with NO people (landscapes, scenery, objects, pets) auto-verify
  // as long as `needs_review === false`. Previously these were stuck at
  // pending because the old check required `people_identified.length > 0`,
  // which sent every people-less photo to the review queue.
  const peopleAreOk =
    result.people_identified.length === 0 ||
    result.people_identified.every((p) => p.confidence === "high");
  const verificationStatus =
    peopleAreOk && !result.needs_review ? "verified" : "pending";

  const { error: mediaUpdateError } = await supabase
    .from("media")
    .update({
      description: result.description,
      ai_tags: result.tags,
      verification_status: verificationStatus,
    })
    .eq("id", mediaId);

  if (mediaUpdateError) {
    console.warn(`Failed to update media ${mediaId}:`, mediaUpdateError.message);
    await upsertPendingFlag(mediaId, userId, `Could not update analyzed photo metadata: ${mediaUpdateError.message}`);
    return result;
  }

  // Fire-and-forget: embed the AI description so this photo is searchable.
  // Failures here MUST NOT regress the photo pipeline reliability hardening.
  if (result.description) {
    void embedAndStore("media", mediaId, result.description);
  }

  // Link identified people via media_people junction table
  for (const identified of result.people_identified) {
    const match = people.find(
      (p) => p.full_name.toLowerCase() === identified.name.toLowerCase()
    );
    if (match) {
      const { error: mediaPeopleError } = await supabase.from("media_people").upsert({
        media_id: mediaId,
        person_id: match.id,
        ai_confidence: CONFIDENCE_MAP[identified.confidence] ?? 0.3,
        verified: false,
      });

      if (mediaPeopleError) {
        console.warn(`Failed to link person ${match.id} to media ${mediaId}:`, mediaPeopleError.message);
      }
    }
  }

  // Every pending photo must have a queue item so co-users can review it.
  if (verificationStatus === "pending") {
    const reason = result.needs_review
      ? `AI flagged: ${result.review_reason || "Needs manual review"}`
      : "Photo is pending verification. Please review and approve.";
    await upsertPendingFlag(mediaId, userId, reason);
  }

  return result;
}

export async function processPhotos(
  photos: Array<{ mediaId: string; photoUrl: string }>,
  userId: string,
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  for (let i = 0; i < photos.length; i++) {
    try {
      await processPhoto(photos[i].mediaId, photos[i].photoUrl, userId);
    } catch (err: any) {
      console.warn(`Failed to process photo ${photos[i].mediaId}:`, err.message);
    }
    onProgress?.(i + 1, photos.length);
  }
}

export async function reprocessPendingPhotos(userId: string): Promise<{ processed: number; failed: number }> {
  const { data: pendingPhotos, error } = await supabase
    .from("media")
    .select("id, file_url")
    .eq("user_id", userId)
    .eq("file_type", "photo")
    .eq("verification_status", "pending");

  if (error || !pendingPhotos) {
    return { processed: 0, failed: 0 };
  }

  let processed = 0;
  let failed = 0;

  for (const media of pendingPhotos) {
    try {
      const result = await processPhoto(media.id, media.file_url, userId);
      if (result) processed += 1;
      else failed += 1;
    } catch {
      failed += 1;
    }
  }

  return { processed, failed };
}

export async function reprocessAllPhotos(userId: string): Promise<{ processed: number; failed: number }> {
  // Pick every non-hidden photo with an http URL. Reset to pending
  // and clear stale AI metadata so the new vision prompt gets to
  // tag from scratch.
  const { data: photos, error } = await supabase
    .from("media")
    .select("id, file_url")
    .eq("user_id", userId)
    .eq("file_type", "photo")
    .neq("verification_status", "hidden")
    .ilike("file_url", "http%");

  if (error || !photos) {
    return { processed: 0, failed: 0 };
  }

  // Bulk reset (one update per row to keep RLS tight; could be a
  // single .in() update too if RLS allows it). Use .in() to do this
  // in a single round trip:
  if (photos.length > 0) {
    const ids = photos.map((p) => p.id);
    await supabase
      .from("media")
      .update({
        verification_status: "pending",
        ai_tags: null,
        description: null,
      })
      .in("id", ids);
  }

  let processed = 0;
  let failed = 0;
  for (const media of photos) {
    try {
      const result = await processPhoto(media.id, media.file_url, userId);
      if (result) processed += 1;
      else failed += 1;
    } catch {
      failed += 1;
    }
  }
  return { processed, failed };
}
