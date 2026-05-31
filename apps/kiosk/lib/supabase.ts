import { initSupabase } from "@memoria/core";

const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://zpxyqomebbjadqvgpapw.supabase.co";
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "sb_publishable_zuXXnzGR2Ba-JsL3awTQsQ_JyoQQZVC";

// Initialize the shared @memoria/core client for the kiosk.
// localStorage persistence keeps the patient session across browser restarts.
export const supabase = initSupabase(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
    storageKey: "memoria-kiosk-auth",
  },
});
