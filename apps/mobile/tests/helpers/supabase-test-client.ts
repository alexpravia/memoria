// A Supabase client wired to a dedicated test project, using the service-role
// key so integration tests can seed and wipe data. NEVER use this in app code.
//
// Returns null when SUPABASE_TEST_URL / SUPABASE_TEST_SERVICE_KEY are not set,
// so integration tests can skip gracefully via skip-if-no-creds.

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseTestCreds } from "./skip-if-no-creds";

export function getSupabaseTestClient(): SupabaseClient | null {
  const creds = requireSupabaseTestCreds();
  if (!creds) return null;
  return createClient(creds.url, creds.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
