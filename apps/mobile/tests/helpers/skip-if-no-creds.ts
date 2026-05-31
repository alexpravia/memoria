// Helper for integration tests that talk to a real Supabase test project.
//
// Integration tests must NOT hard-fail when the developer has not set up
// a dedicated Supabase test project. Instead they should skip gracefully.
//
// Usage:
//   import { it } from "vitest";
//   import { requireSupabaseTestCreds } from "../helpers/skip-if-no-creds";
//
//   const creds = requireSupabaseTestCreds();
//   it.skipIf(!creds)("does the thing", async () => {
//     // creds is guaranteed here
//   });

export interface SupabaseTestCreds {
  url: string;
  serviceKey: string;
}

/**
 * Returns Supabase test creds if both env vars are set, otherwise null.
 * Callers should pass the boolean `!creds` to `it.skipIf(...)` so the test
 * is reported as skipped (not failed) when creds are missing.
 */
export function requireSupabaseTestCreds(): SupabaseTestCreds | null {
  const url = process.env.SUPABASE_TEST_URL;
  const serviceKey = process.env.SUPABASE_TEST_SERVICE_KEY;
  if (!url || !serviceKey) return null;
  return { url, serviceKey };
}
