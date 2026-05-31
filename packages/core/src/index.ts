// Supabase client factory + live binding
export { supabase, initSupabase, createSupabaseClient } from "./supabase";

// Types
export * from "./types";

// Design tokens
export * from "./theme";

// AI / data layer
export * from "./assistant";
export * from "./tools";
export * from "./embeddings";
export * from "./memory";
export * from "./briefing";
export * from "./sensitivity";
export * from "./photoProcessing";
export * from "./preferenceSignals";

// Auth context (platform-agnostic React)
export { AuthProvider, useAuth } from "./auth/AuthContext";
