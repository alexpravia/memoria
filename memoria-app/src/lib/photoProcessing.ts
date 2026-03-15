import { supabase } from "./supabase";

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

export async function processPhoto(
  mediaId: string,
  photoUrl: string,
  userId: string
): Promise<ProcessedPhoto | null> {
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
    return null;
  }

  const result: ProcessedPhoto =
    typeof data === "string" ? JSON.parse(data) : data;
  result.mediaId = mediaId;

  // Update media row with description and tags
  const allHighConfidence =
    result.people_identified.length > 0 &&
    result.people_identified.every((p) => p.confidence === "high");
  const verificationStatus =
    allHighConfidence && !result.needs_review ? "verified" : "pending";

  await supabase
    .from("media")
    .update({
      description: result.description,
      ai_tags: result.tags,
      verification_status: verificationStatus,
    })
    .eq("id", mediaId);

  // Link identified people via media_people junction table
  for (const identified of result.people_identified) {
    const match = people.find(
      (p) => p.full_name.toLowerCase() === identified.name.toLowerCase()
    );
    if (match) {
      await supabase.from("media_people").insert({
        media_id: mediaId,
        person_id: match.id,
        ai_confidence: CONFIDENCE_MAP[identified.confidence] ?? 0.3,
        verified: false,
      });
    }
  }

  // Create flag_queue entry if review is needed
  if (result.needs_review) {
    await supabase.from("flag_queue").insert({
      user_id: userId,
      flag_type: "media",
      reference_id: mediaId,
      description: `AI flagged: ${result.review_reason || "Needs manual review"}`,
      status: "pending",
    });
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
