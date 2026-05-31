import { initSupabase } from "@memoria/core";

// Initialize the Supabase client for the mobile app.
// Using default (in-memory) session storage — same behaviour as before.
// TODO: pass an AsyncStorage adapter to fix cold-start logout on native.
const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  "https://zpxyqomebbjadqvgpapw.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  "sb_publishable_zuXXnzGR2Ba-JsL3awTQsQ_JyoQQZVC";

export const supabase = initSupabase(SUPABASE_URL, SUPABASE_ANON_KEY);

// Re-export everything from core so files that import from this path
// (e.g. tts.ts, notifications.ts) continue to work unchanged.
export * from "@memoria/core";
