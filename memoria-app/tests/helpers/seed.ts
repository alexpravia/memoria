// Seed helpers for integration tests.
//
// Each function is a no-op when `client` is null so callers can call them
// unconditionally inside an `it.skipIf(!creds)(...)` guard.

import type { SupabaseClient } from "@supabase/supabase-js";

export interface SeedUserInput {
  email?: string;
  fullName?: string;
  location?: string | null;
  dateOfBirth?: string | null;
}

export interface SeedPersonInput {
  fullName: string;
  relationship: string;
  keyFacts?: string[];
  emotionalNotes?: string | null;
}

export interface SeedPhotoInput {
  fileUrl?: string;
  description: string;
  aiTags?: string[];
  takenAt?: string | null;
  personIds?: string[];
}

export interface SeedEventInput {
  title: string;
  description?: string | null;
  event_date: string;
  event_type?: "one_time" | "recurring" | "routine";
}

export interface SeededUser {
  id: string;
  email: string;
  full_name: string;
}

function rand(): string {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Insert a new `users` row (no auth user — integration tests that need
 * auth should add it separately). Returns the inserted row.
 */
export async function seedUser(
  client: SupabaseClient | null,
  overrides: SeedUserInput = {}
): Promise<SeededUser | null> {
  if (!client) return null;
  const email = overrides.email ?? `test-${rand()}@example.com`;
  const fullName = overrides.fullName ?? `Test User ${rand()}`;

  const { data, error } = await client
    .from("users")
    .insert({
      email,
      full_name: fullName,
      location: overrides.location ?? null,
      date_of_birth: overrides.dateOfBirth ?? null,
    })
    .select("id, email, full_name")
    .single();

  if (error) throw error;
  return data as SeededUser;
}

/**
 * Insert N people for the given user with varied names/relationships.
 * Pass `count` (number) for canned data, or an array of explicit inputs.
 */
export async function seedPeople(
  client: SupabaseClient | null,
  userId: string,
  countOrPeople: number | SeedPersonInput[]
): Promise<string[]> {
  if (!client) return [];

  const samples: SeedPersonInput[] = Array.isArray(countOrPeople)
    ? countOrPeople
    : Array.from({ length: countOrPeople }, (_, i) => ({
        fullName: `Person ${i + 1} ${rand()}`,
        relationship: ["daughter", "son", "spouse", "friend", "neighbor"][i % 5],
        keyFacts: [`fact ${i + 1}a`, `fact ${i + 1}b`],
        emotionalNotes: null,
      }));

  const rows = samples.map((p) => ({
    user_id: userId,
    full_name: p.fullName,
    relationship: p.relationship,
    key_facts: p.keyFacts ?? [],
    emotional_notes: p.emotionalNotes ?? null,
  }));

  const { data, error } = await client.from("people").insert(rows).select("id");
  if (error) throw error;
  return (data ?? []).map((r: { id: string }) => r.id);
}

/**
 * Insert media rows (verification_status='verified') for the given user.
 */
export async function seedPhotos(
  client: SupabaseClient | null,
  userId: string,
  descriptionsOrPhotos: string[] | SeedPhotoInput[]
): Promise<string[]> {
  if (!client) return [];

  const items: SeedPhotoInput[] = (descriptionsOrPhotos as Array<string | SeedPhotoInput>).map(
    (item, i) =>
      typeof item === "string"
        ? { description: item, fileUrl: `https://example.test/photo-${rand()}-${i}.jpg` }
        : item
  );

  const rows = items.map((p) => ({
    user_id: userId,
    file_url: p.fileUrl ?? `https://example.test/photo-${rand()}.jpg`,
    file_type: "photo",
    description: p.description,
    ai_tags: p.aiTags ?? [],
    taken_at: p.takenAt ?? null,
    verification_status: "verified",
  }));

  const { data, error } = await client.from("media").insert(rows).select("id");
  if (error) throw error;
  const ids = (data ?? []).map((r: { id: string }) => r.id);

  // Optional people junctions.
  const junctions = items
    .flatMap((p, i) =>
      (p.personIds ?? []).map((personId) => ({
        media_id: ids[i],
        person_id: personId,
        verified: true,
      }))
    );
  if (junctions.length > 0) {
    const { error: jErr } = await client.from("media_people").insert(junctions);
    if (jErr) throw jErr;
  }

  return ids;
}

export async function seedLifeFacts(
  client: SupabaseClient | null,
  userId: string,
  facts: string[]
): Promise<string[]> {
  if (!client) return [];
  const rows = facts.map((fact, i) => ({
    user_id: userId,
    fact,
    display_order: i,
  }));
  const { data, error } = await client
    .from("life_facts")
    .insert(rows)
    .select("id");
  if (error) throw error;
  return (data ?? []).map((r: { id: string }) => r.id);
}

export async function seedEvents(
  client: SupabaseClient | null,
  userId: string,
  events: SeedEventInput[]
): Promise<string[]> {
  if (!client) return [];
  const rows = events.map((e) => ({
    user_id: userId,
    title: e.title,
    description: e.description ?? null,
    event_date: e.event_date,
    event_type: e.event_type ?? "one_time",
  }));
  const { data, error } = await client.from("events").insert(rows).select("id");
  if (error) throw error;
  return (data ?? []).map((r: { id: string }) => r.id);
}

/**
 * Cascade-deletes the user row and (via FK on delete cascade) every row
 * scoped to that user across the schema. Safe to call between tests.
 */
export async function wipeAll(
  client: SupabaseClient | null,
  userId?: string
): Promise<void> {
  if (!client || !userId) return;
  const { error } = await client.from("users").delete().eq("id", userId);
  if (error) throw error;
}
