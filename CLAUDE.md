# Memoria — Claude Code Context

## Before Starting Any Work
Read `progress.md` to understand the current state of the project before doing anything.

---

## Project Overview
Memoria is a real-time context generator that helps people with Alzheimer's, dementia, and other memory impairments stay connected to reality. It combines a co-user's (caregiver/family) emotional intelligence with AI processing to build a personal database of the user's life and deliver it back to them daily. The in-app AI assistant is named **Memo**.

## Tech Stack
- **Frontend:** React Native (Expo SDK 54) with TypeScript
- **Backend:** Supabase (Postgres + `pgvector`, Auth, Storage, Edge Functions)
- **AI:** OpenAI `gpt-4o-mini` (chat, classification, briefing generation), `text-embedding-3-small` (embeddings), `tts-1` with **`nova` voice** (TTS). All routed via Supabase Edge Functions; provider-agnostic via env vars.
- **Tools layer:** Function-calling pattern. Tools defined in `src/lib/tools.ts` and mirrored in the Edge Function — assistant calls `search_memories`, `get_person`, `list_events`, `get_life_facts`, `get_user_profile`, `remember_about_user`, `recall_about_user`, `flag_for_co_user`.
- **Audio:** `expo-audio` (replaces deprecated `expo-av`) with `expo-speech` retained as fallback.
- **Device APIs:** `expo-contacts`, `expo-calendar`, `expo-media-library`, `expo-notifications`, `expo-image-manipulator` (HEIC→JPEG).
- **Test harness:** Vitest unit tests (`src/lib/*.test.ts`), integration tests (`tests/integration/`, skip without Supabase test creds), AI eval files (`tests/evals/`). CI gate: `npx tsc --noEmit && npm test`. **Maestro is paused** — flows preserved but not maintained; see `.maestro/README.md`.
- **LLM Config:** Swappable via env vars: `LLM_API_URL`, `LLM_API_KEY`, `LLM_MODEL`, `EMBEDDING_API_URL/KEY/MODEL`, `TTS_API_URL/MODEL/VOICE`.

## Two-UX Model
- **User (patient):** Simple, calming, audio-driven experience. Large buttons, minimal reading, OpenAI Nova voice TTS reads everything aloud. Cool purple color scheme.
- **Co-User (caregiver):** Management dashboard with onboarding, data entry, sensitivity filters, flag queue, import tools, AI Memory inspector ("Memo's Notes"), and Briefing Preview/Approval.

## Database Schema
**Original 11 tables** — `users`, `life_facts`, `co_users`, `people`, `media`, `media_people`, `events`, `journal_entries`, `daily_summaries`, `pinned_notes`, `sensitivity_filters`. Plus `flag_queue` for co-user review.

**Added during AI-native migration (Phases A–E):**
- `embedding`/`embedding_text`/`embedding_updated_at` columns on `media`, `life_facts`, `people`, `events` (1536-dim vectors).
- `match_memories(user_id, query_embedding, match_count, kinds)` RPC for unified semantic search.
- `conversations` + `messages` — chat history with tool-call records.
- `sensitivity_decisions` — per-item classifier cache.
- `assistant_memory` — Memo's persistent notes about the user (kind, content, importance, status).
- `briefings` — AI-generated daily briefings (slides as JSONB, status workflow).

## Current Status (as of May 30, 2026)
**Phases 0 through 1C plus the full AI-native migration (Phases 0–E) are complete, and three rounds of Phase 1 photo/briefing polish have shipped.** The app now has:
- Role-based auth (user vs co-user).
- Co-user onboarding (life facts, people, events, device imports for contacts/calendar/photos) with embeddings written on save.
- Co-user dashboard: stat cards → view screens, plus AI-era additions: Memo's Notes (AI memory inspector) and Tomorrow's Briefing (AI briefing preview/approval, with Today/Tomorrow date toggle for testing).
- Editing for imported contacts and manually added people.
- **Semantic sensitivity classifier** — replaces keyword filters; supports free-text intent rules classified per item via `check-sensitivity` Edge Function with cached decisions. Fail-OPEN on read paths.
- **Agentic AI assistant ("Memo")** — `ask-assistant` Edge Function runs a tool-calling loop with full conversation persistence. Top-5 memories injected as a second system message. Photos render inline. Singular request → 1 photo, plural → 3-5.
- **Persistent assistant memory** — Memo writes notes via `remember_about_user`, recalls via `recall_about_user`. Co-user reviews/edits in Memo's Notes screen. High-importance memories auto-flag for review.
- **AI-orchestrated briefings** — `generate-briefing` Edge Function produces 6-12 slides, validated, upserted as draft, approved by co-user, rendered through TTS/animation pipeline. Procedural builder remains as safety fallback.
- **OpenAI TTS** — `nova` voice. Direct binary fetch. LRU disk cache (50 entries). 5-second timeout fallback to `expo-speech`. Pre-warms next slide. Honors iOS silent mode.
- **Photo storage hardening** — HEIC→JPEG conversion, hard-fail on upload errors, `http(s)` prefix validation. `processPhoto` refuses non-http URLs. Repair + seed + retag scripts.
- **PhotoLightbox** — Image-first full-screen modal with translucent bottom-left AI metadata overlay, single-tap to enlarge, horizontally scrollable tags.
- **Design system** — `src/theme.ts` (centralized design tokens), `src/components/Icon.tsx` (custom rounded-stroke SVG icon set via `react-native-svg`). All screens use theme tokens; all emoji icons replaced with custom SVG components.
- **Test suite** — 127 unit tests across 7 files. Integration tests skip without creds.

## Key Files
- **AI / Logic**
  - `src/lib/assistant.ts` — thin client wrapper that invokes the agentic Edge Function
  - `src/lib/tools.ts` — canonical tool definitions + handlers (mirrored in `ask-assistant` Edge Function)
  - `src/lib/embeddings.ts` — embed, embedAndStore, searchMemories (RAG entry point)
  - `src/lib/sensitivity.ts` — semantic classifier wrapper, ruleSetHash, getOrClassify, isAllowed
  - `src/lib/memory.ts` — Memo's persistent memory (rememberAboutUser, recallAboutUser, statuses)
  - `src/lib/briefing.ts` — generate, get, approve, validate, resolveSlidePhotos
  - `src/lib/tts.ts` — OpenAI TTS with cache + fallback
  - `src/lib/photoProcessing.ts` — vision pipeline + embedding wiring
  - `src/lib/notifications.ts` — local push scheduling
- **Edge Functions** (`supabase/functions/`)
  - `ask-assistant` — agentic tool-calling loop with memory injection
  - `embed` — `text-embedding-3-small` proxy
  - `check-sensitivity` — intent-aware classifier
  - `process-photo` — AI vision (description + tags + people + flag)
  - `generate-briefing` — slide JSON generator with retry-on-invalid
  - `tts` — OpenAI TTS proxy (raw audio bytes)
- **User screens** (`src/screens/user/`) — `UserHomeScreen`, `BriefingScreen`, `EmergencyCardScreen`, `AssistantScreen`
- **Co-user screens** (`src/screens/couser/`) — `CoUserHomeScreen`, view screens, `EditPersonScreen`, `EmergencyContactSettingsScreen`, `FlagQueueScreen`, `SensitivityFiltersScreen`, `AIMemoryScreen` (Memo's Notes), `BriefingPreviewScreen`, onboarding/, import/
- **Design tokens** — `src/theme.ts` (colors, radius, border, type scale)
- **Components** — `src/components/Icon.tsx` (custom SVG icon set), `PhotoLightbox.tsx`, `usePhotoLightbox.tsx`, `PhotoTagsView.tsx`
- **Scripts** — `scripts/backfill-embeddings.ts`, `scripts/repair-broken-photos.ts`, `scripts/reset-photos-for-retag.ts`, `scripts/seed-test-photos.ts`, `scripts/check.sh`

## Development Phases
- **Phase 0:** ✅ Setup, Supabase, schema, auth, navigation
- **Phase 1A:** ✅ Auth, co-user onboarding, dashboard, device imports
- **Phase 1B:** ✅ User home, morning briefing, emergency card
- **Phase 1C:** ✅ Sensitivity filters, flag queue, AI assistant, notifications
- **AI-native migration:** ✅ Phases 0 (test harness), A (RAG), B (tools), C (semantic sensitivity), D (memory), E (AI briefings)
- **Phase 2:** 🔜 "Tell Me About Your Day" — voice journaling, recall exercises, mood/tone awareness
- **Phase 3:** 🔜 Cooking assist, brain stimulation, photo exploration, familiar voice option
- **Phase 4:** 🔜 Cognitive level refinement, analytics, community, hardware exploration

## Instructions for Working on This Project
- **Read `progress.md` before starting any work** — it is the authoritative log of what has been done
- Never update `progress.md` during normal implementation flow; only update it when the user explicitly asks at the end of a session
- Follow existing code conventions in `memoria-app/`
- Keep the UI extremely simple — this is the #1 design rule; the primary user has memory problems
- Audio-first: anything shown to the user should also be spoken via TTS (OpenAI Nova)
- Safety-first: no AI content reaches the user without sensitivity classifier + co-user verification
- The AI assistant is named **Memo** in all user-facing strings; "Memoria" is the project/codebase name
- Maestro is **paused** — do not extend it; the test gate is `npx tsc --noEmit && npm test` (127 unit tests)
- The app source code lives in `memoria-app/`
- Provider-agnostic LLM/embeddings/TTS — never hardcode URLs; read from env vars
- Tool definitions live in TWO places that must stay in sync: `src/lib/tools.ts` (client) and the duplicate block in `supabase/functions/ask-assistant/index.ts` (Deno)
