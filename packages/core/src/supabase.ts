import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Live binding — all lib modules import { supabase } from "./supabase" and always
// read the current value. initSupabase() must be called at app startup before
// any lib function executes.
export let supabase: SupabaseClient;

export function createSupabaseClient(
  url: string,
  anonKey: string,
  opts: Parameters<typeof createClient>[2] = {}
): SupabaseClient {
  return createClient(url, anonKey, opts);
}

export function initSupabase(
  url: string,
  anonKey: string,
  opts: Parameters<typeof createClient>[2] = {}
): SupabaseClient {
  supabase = createSupabaseClient(url, anonKey, opts);
  return supabase;
}
