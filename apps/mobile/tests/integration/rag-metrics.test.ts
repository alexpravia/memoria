// Phase 4B — RAG metrics integration test.
//
// Two metrics over the canonical rag-recall fixture (skipped without Supabase
// test creds, like every integration test):
//   1. Retrieval recall@N — does searchMemories surface the expected row in the
//      top-N for each rag-recall.eval.json case?
//   2. Answer-assertion pass rate — do the deterministic (substring/no_substring/
//      regex) assertions in assistant-quality.eval.json hold against the real
//      ask-assistant answer? (judge assertions need an LLM grader and are skipped.)
//
// This is the before/after baseline the LLM plan calls for: run it before and
// after a retrieval/prompt change to see whether the change actually helped.
//
// Run: SUPABASE_TEST_URL=... SUPABASE_TEST_SERVICE_KEY=... npm run test:integration
// (also needs the app Supabase client — EXPO_PUBLIC_SUPABASE_* — pointed at the
// SAME project, since embedAndStore/searchMemories use the app client.)

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseTestCreds } from "../helpers/skip-if-no-creds";
import { getSupabaseTestClient } from "../helpers/supabase-test-client";
import {
  seedUser,
  seedPeople,
  seedPhotos,
  seedLifeFacts,
  seedEvents,
  wipeAll,
} from "../helpers/seed";
import { embedAndStore, searchMemories } from "@memoria/core";

const creds = requireSupabaseTestCreds();
const adminClient = getSupabaseTestClient();
const userFacingClient = creds
  ? createClient(creds.url, creds.serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

// ─── Canonical fixture (mirrors rag-recall.eval.json seed_data_summary) ──
const PHOTOS: Record<string, string> = {
  "photo:beach": "A sunny day at the beach with umbrellas and seagulls by the water.",
  "photo:dinner": "The whole family gathered around the table for a warm family dinner.",
  "photo:garden": "Colorful flowers blooming in the backyard garden on a spring morning.",
  "photo:birthday": "A birthday party with a cake, balloons, and smiling friends.",
  "photo:hike": "A mountain hike along a forest trail lined with tall pine trees.",
};

const PEOPLE = [
  { slug: "person:sarah", fullName: "Sarah", relationship: "daughter", keyFacts: ["Lives nearby", "Visits every Sunday"], emotionalNotes: "Very close to her" },
  { slug: "person:robert", fullName: "Robert", relationship: "son", keyFacts: ["Lives in another city", "Calls on weekends"], emotionalNotes: null },
  { slug: "person:maria", fullName: "Maria", relationship: "neighbor", keyFacts: ["Lives next door", "Brings over baked goods"], emotionalNotes: null },
  { slug: "person:bill", fullName: "Bill", relationship: "brother", keyFacts: ["Younger brother", "Lives across town"], emotionalNotes: null },
];

const FACTS: Record<string, string> = {
  "fact:taught-school": "I taught school for thirty years.",
  "fact:gardens-daily": "I work in my garden every day.",
  "fact:married-1972": "I got married in 1972.",
  "fact:retired-2010": "I retired in 2010.",
  "fact:loves-jazz": "I love listening to jazz music.",
};

const EVENTS = [
  { slug: "event:doctor", title: "Doctor appointment", description: "Check-up with Dr. Lee", event_type: "one_time" as const },
  { slug: "event:wedding", title: "Granddaughter's wedding", description: "Emma's wedding celebration", event_type: "one_time" as const },
  { slug: "event:lunch", title: "Lunch with Sarah", description: "Lunch with my daughter Sarah", event_type: "one_time" as const },
  { slug: "event:garden-club", title: "Gardening club", description: "Weekly gardening club meeting", event_type: "recurring" as const },
];

let userId: string | null = null;
const idBySlug: Record<string, string> = {};

function futureISO(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

const HERE = dirname(fileURLToPath(import.meta.url));

function loadEval(file: string): any {
  return JSON.parse(readFileSync(join(HERE, "..", "evals", file), "utf-8"));
}

/** Evaluate one deterministic assertion; returns null for judge/unknown types. */
function evalDeterministic(answer: string, assertion: any): boolean | null {
  const lower = answer.toLowerCase();
  if (assertion.type === "substring") {
    const vals = Array.isArray(assertion.value) ? assertion.value : [assertion.value];
    return vals.every((v: string) => lower.includes(String(v).toLowerCase()));
  }
  if (assertion.type === "no_substring") {
    const vals = Array.isArray(assertion.value) ? assertion.value : [assertion.value];
    return vals.every((v: string) => !lower.includes(String(v).toLowerCase()));
  }
  if (assertion.type === "regex") {
    return new RegExp(assertion.value, "i").test(answer);
  }
  return null;
}

beforeAll(async () => {
  if (!creds || !adminClient) return;

  const user = await seedUser(adminClient, {
    fullName: "Margaret",
    location: "Portland, Oregon",
    dateOfBirth: "1945-06-15",
  });
  userId = user!.id;

  // Photos
  const photoSlugs = Object.keys(PHOTOS);
  const photoIds = await seedPhotos(adminClient, userId, photoSlugs.map((s) => PHOTOS[s]));
  photoSlugs.forEach((s, i) => (idBySlug[s] = photoIds[i]));
  for (const s of photoSlugs) await embedAndStore("media", idBySlug[s], PHOTOS[s]);

  // People
  const peopleIds = await seedPeople(
    adminClient,
    userId,
    PEOPLE.map((p) => ({
      fullName: p.fullName,
      relationship: p.relationship,
      keyFacts: p.keyFacts,
      emotionalNotes: p.emotionalNotes,
    }))
  );
  PEOPLE.forEach((p, i) => (idBySlug[p.slug] = peopleIds[i]));
  for (let i = 0; i < PEOPLE.length; i++) {
    const p = PEOPLE[i];
    const text = [p.fullName, p.relationship, p.keyFacts.join(" "), p.emotionalNotes ?? ""]
      .filter(Boolean)
      .join(" ");
    await embedAndStore("people", peopleIds[i], text);
  }

  // Life facts
  const factSlugs = Object.keys(FACTS);
  const factIds = await seedLifeFacts(adminClient, userId, factSlugs.map((s) => FACTS[s]));
  factSlugs.forEach((s, i) => (idBySlug[s] = factIds[i]));
  for (const s of factSlugs) await embedAndStore("life_facts", idBySlug[s], FACTS[s]);

  // Events
  const eventIds = await seedEvents(
    adminClient,
    userId,
    EVENTS.map((e, i) => ({
      title: e.title,
      description: e.description,
      event_date: futureISO(i + 1),
      event_type: e.event_type,
    }))
  );
  EVENTS.forEach((e, i) => (idBySlug[e.slug] = eventIds[i]));
  for (let i = 0; i < EVENTS.length; i++) {
    await embedAndStore("events", eventIds[i], `${EVENTS[i].title} ${EVENTS[i].description}`);
  }
}, 180_000);

afterAll(async () => {
  if (!creds || !adminClient || !userId) return;
  await wipeAll(adminClient, userId);
});

describe("RAG metrics", () => {
  it.skipIf(!creds)(
    "retrieval recall@N over the canonical fixture",
    async () => {
      const recallEval = loadEval("rag-recall.eval.json");
      let hits = 0;
      for (const c of recallEval.cases) {
        const expectedIds: string[] = c.expected_ids
          .map((s: string) => idBySlug[s.replace("FIXTURE:", "")])
          .filter(Boolean);
        const results = await searchMemories(userId!, c.query, {
          limit: c.top_n,
          kinds: [c.kind],
        });
        const ids = results.map((r) => r.id);
        const hit = expectedIds.some((id) => ids.includes(id));
        if (hit) hits += 1;
        else
          console.warn(
            `recall miss [${c.name}] expected one of ${JSON.stringify(expectedIds)} in ${JSON.stringify(ids)}`
          );
      }
      const recall = hits / recallEval.cases.length;
      console.log(
        `Recall@N: ${hits}/${recallEval.cases.length} = ${(recall * 100).toFixed(0)}%`
      );
      expect(recall).toBeGreaterThanOrEqual(0.7);
    },
    120_000
  );

  it.skipIf(!creds)(
    "deterministic answer assertions hold for fixture questions",
    async () => {
      const qualityEval = loadEval("assistant-quality.eval.json");
      const cases = qualityEval.cases.filter((c: any) =>
        c.assertions.some((a: any) =>
          ["substring", "no_substring", "regex"].includes(a.type)
        )
      );
      // Optional cap for a faster local run: RAG_EVAL_LIMIT=10
      const limit = Number(process.env.RAG_EVAL_LIMIT ?? cases.length);
      const subset = cases.slice(0, limit);

      let total = 0;
      let passed = 0;
      for (const c of subset) {
        const { data } = await userFacingClient!.functions.invoke("ask-assistant", {
          body: { userId, question: c.query },
        });
        const parsed = typeof data === "string" ? JSON.parse(data) : data;
        const answer = String(parsed?.answer ?? "");
        for (const assertion of c.assertions) {
          const res = evalDeterministic(answer, assertion);
          if (res === null) continue;
          total += 1;
          if (res) passed += 1;
          else
            console.warn(
              `assertion fail [${c.name}] ${assertion.type} ${JSON.stringify(assertion.value)} :: answer="${answer}"`
            );
        }
      }
      const rate = total === 0 ? 1 : passed / total;
      console.log(
        `Deterministic answer assertions: ${passed}/${total} = ${(rate * 100).toFixed(0)}% (over ${subset.length} questions)`
      );
      expect(rate).toBeGreaterThanOrEqual(0.8);
    },
    300_000
  );
});
