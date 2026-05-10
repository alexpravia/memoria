# Memoria — Agent Context

## Previous Thread References
These threads from a previous account contain the full history of work on this project:
- **T-019cca95-4554-73bc-a109-791746791d53** — Project details formatting and overview
- **T-019ccaea-c2a6-7322-a6b2-33ea3934864e** — Med-tech VC investment evaluation of Memoria
- **T-019ccae3-e981-71fb-bd6a-77f4bd1ab557** — Committed `details.md` update (generic "tablet", visual accessibility note)
- **T-019ce8b8-8008-729c-9344-35b6c75b8099** — Full review of Memoria context, implementation status, and recent fixes
- **T-019cef56-210d-70e9-b449-ab86ab5b8ee0** — Photo intelligence pipeline: full AI photo processing (upload, vision analysis, tagging, flag queue, assistant context, chat display, briefing integration) + emergency card bug fix
- **T-019cfe0f-0e80-70fb-8610-e5021490bd5d** — Bug fix batch (March 22, 2026): 4 fixes applied, NOT yet logged in progressLogs.md
- **T-019d16a7-c602-723d-b09e-0b7a88480abd** — Editable imported contacts/people, emergency contact phone management, photo pipeline retry + queue hardening, briefing photo coverage expansion, and AGENTS/progress context updates
- **T-019d7887-f02d-75ab-a60f-7e6fca0f2725** — Maestro iOS automation setup and stabilization: Expo Go wrapper, smoke flows for login/briefing/emergency/co-user, selector hardening, and startup context refresh
- **T-019e0e91-f11d-742b-9882-8e6dbc3e6634** — AI-native migration (Phases 0–E): pgvector RAG, agentic tool-calling assistant, semantic sensitivity classifier, persistent assistant memory, AI-orchestrated briefings; plus polish waves (OpenAI TTS with Nova voice, photo storage hardening, PhotoLightbox, Memo rebrand, briefing date toggle, search_memories fallback)
- **T-019e0ffb-7873-7118-9f23-41f8bb0eabcf** — Phase 1 photo + briefing polish (3 rounds): image-first PhotoLightbox with subtle bottom-left tag overlay (single-tap to enlarge), Memo's Notes scroll arrows, larger 4:3 briefing photos with backfill, AI-tolerant briefing validators, `processPhoto` non-http guard + `reprocessAllPhotos`, new `reset-photos-for-retag.ts` script + 0-byte-detector in `repair-broken-photos.ts`, content-aware vision prompt (tags landscapes/objects), one-sentence description prompt, auto-verify when no people, fixed lightbox tag pan gesture, removed spurious onError DB-hide; cleaned live DB (4 file:// + 5 zero-byte rows hidden, 5 photos re-tagged with one-sentence descriptions)

## Project Overview
Memoria is a real-time context generator that helps people with Alzheimer's, dementia, and other memory impairments stay connected to reality. It combines a co-user's (caregiver/family) emotional intelligence with AI processing to build a personal database of the user's life and deliver it back to them daily. The in-app AI assistant is named **Memo**.

## Tech Stack
- **Frontend:** React Native (Expo SDK 54) with TypeScript
- **Backend:** Supabase (Postgres + `pgvector`, Auth, Storage, Edge Functions)
- **AI:** OpenAI `gpt-4o-mini` (chat, classification, briefing generation), `text-embedding-3-small` (embeddings), `tts-1` with **`nova` voice** (TTS). All routed via Supabase Edge Functions; provider-agnostic via env vars.
- **Tools layer:** Function-calling pattern. Tools defined in `src/lib/tools.ts` and mirrored in the Edge Function — assistant calls `search_memories`, `get_person`, `list_events`, `get_life_facts`, `get_user_profile`, `remember_about_user`, `recall_about_user`, `flag_for_co_user`.
- **Audio:** `expo-audio` (replaces deprecated `expo-av`) with `expo-speech` retained as fallback.
- **Device APIs:** `expo-contacts`, `expo-calendar`, `expo-media-library`, `expo-notifications`, `expo-image-manipulator` (HEIC→JPEG).
- **Test harness:** Vitest unit tests (`src/lib/*.test.ts`), integration tests (`tests/integration/`, skip without Supabase test creds), AI eval files (`tests/evals/`). CI gate: `npx tsc --noEmit && npm test`. **Maestro is paused** during the migration — flows preserved but not maintained; see `.maestro/README.md`.
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

## Current Status (as of May 10, 2026)
**Phases 0 through 1C plus the full AI-native migration (Phases 0–E) are complete, and three rounds of Phase 1 photo/briefing polish have shipped.** The app now is:
- Role-based auth (user vs co-user) — unchanged.
- Co-user onboarding (life facts, people, events, device imports for contacts/calendar/photos) with embeddings written on save.
- Co-user dashboard: stat cards → view screens, plus AI-era additions: **🧠 Memo's Notes** (AI memory inspector) and **📅 Tomorrow's Briefing** (AI briefing preview/approval, with Today/Tomorrow date toggle for testing).
- Editing for imported contacts and manually added people.
- **Semantic sensitivity classifier** — replaces keyword filters; supports free-text intent rules ("avoid Mom's death") classified per item via `check-sensitivity` Edge Function with cached decisions. Fail-OPEN on read paths.
- **Agentic AI assistant ("Memo")** — `ask-assistant` Edge Function runs a tool-calling loop with full conversation persistence (`conversations` + `messages`). Multi-turn chat threads correctly. Top-5 memories injected as a second system message. Photos render inline (no markdown links). Singular request → 1 photo, plural → 3-5.
- **Persistent assistant memory** — Memo writes notes via `remember_about_user`, recalls via `recall_about_user`. Co-user reviews/edits in Memo's Notes screen. High-importance memories auto-flag for review.
- **AI-orchestrated briefings** — `generate-briefing` Edge Function produces 6-12 slides (greeting/fact/person/memory_photo/event/reassurance/pinned_note), validated, upserted as draft, edited/approved by co-user, rendered through existing TTS/animation pipeline. Procedural builder remains as the safety fallback. Briefing renders only `status='approved' | 'delivered'` rows.
- **OpenAI TTS via `tts` Edge Function** — `nova` voice (warm, female, calming). Direct binary fetch (bypasses supabase-js JSON parsing). LRU disk cache (50 entries, ~4MB). 5-second timeout fallback to `expo-speech`. Pre-warm next briefing slide while current plays. Honors iOS silent mode.
- **Photo storage hardening** — `ImportPhotosScreen` converts HEIC→JPEG, hard-fails on upload errors (no more silent local-URL inserts), validates `http(s)` prefix before insert. `processPhoto` now refuses to send non-http URLs to the vision API and hides those rows immediately. Scripts: `repair-broken-photos.ts` (hides legacy `file://` AND 0-byte http rows), `seed-test-photos.ts` (uploads Picsum images), and the new `reset-photos-for-retag.ts` (bulk-resets every non-hidden http photo to pending so the AI re-tagger reprocesses everything).
- **PhotoLightbox** — Image-first full-screen modal in `src/components/PhotoLightbox.tsx` + `usePhotoLightbox` hook + `PhotoTagsView` with `compact` mode (description + tag chips + tagged-people list). The image fills the screen via `resizeMode='contain'`; AI metadata sits in a translucent bottom-left overlay (full-width, white text) toggled by a top-left ⓘ button. Tags are horizontally scrollable with a visible white indicator. **Single-tap to enlarge** anywhere — `useTapToOpen` is a thin `useCallback` wrapper (no double-tap timing). Wired into ViewPhotosScreen, FlagQueueScreen, AssistantScreen, BriefingScreen, BriefingPreviewScreen.
- **Hidden media filtering** — ViewPhotosScreen and FlagQueueScreen exclude `verification_status='hidden'` at the query level. `<Image onError>` self-heals tiles locally on render failure but no longer writes `hidden` to the DB (transient simulator/network blips were nuking good photos). Real bad rows are caught by the `processPhoto` guard and the repair script.
- **Photo auto-verification** — Photos auto-verify when `needs_review === false`, regardless of whether people are present. Old logic required at least one high-confidence person, which sent every landscape/scenery/object photo to pending. Vision prompt now requires ONE short sentence (under 15 words) and 3-8 literal-content tags (landscapes, objects, animals, etc.); explicitly tells the model NOT to set `needs_review=true` just because the photo lacks people.
- **Briefing photo robustness** — `BriefingScreen` renders a large 4:3 rectangular photo (no avatar circle); `BriefingPhoto` returns `null` on `<Image onError>`. AI path runs `backfillPhotos` to pick from a verified-pool when slides lack `photo_url`. `resolveSlidePhotos` filters hidden + non-http rows. `validateSlide` tolerates ANY non-string `photo_id` (treats as missing); `generate-briefing` Edge Function strips bad `photo_id` shapes before validation.
- **Memo's Notes scroll cues** — Kind-filter row in `AIMemoryScreen` shows ‹ / › chevrons that appear/hide based on scroll position; tap to scroll 120px.
- **Test suite** — 127 unit tests across 7 files (`src/lib/{assistant,embeddings,tools,sensitivity,memory,briefing,tts}.test.ts`). Integration tests skip without creds. 5 eval JSON files written for sensitivity/briefing/assistant/RAG/memory.
- **Memo rebrand** — All user-facing assistant strings renamed: "Talk to Memo" button, "Hi, I'm Memo." greeting, "Memo's Notes" co-user screen ("Memo's memories and notes about your loved one"), system prompt identity. Project name "Memoria" stays in code/files.
- **`expo-av` removed**, replaced with `expo-audio` (`createAudioPlayer` + `setAudioModeAsync` with new `playsInSilentMode`/`shouldPlayInBackground` props).

### Recent fixes (May 9, 2026 — T-019e0e91-f11d-742b-9882-8e6dbc3e6634):
1. **TTS empty payload fixed** — Replaced `supabase.functions.invoke('tts')` with direct `fetch()` against `${SUPABASE_URL}/functions/v1/tts` so binary responses are read via `arrayBuffer()` instead of being JSON-parsed.
2. **Photo limit fallback** — `search_memories` now defaults to `limit:1` when caller doesn't specify (fixes "show me a photo" returning 5 photos). System prompt updated with singular vs plural rules.
3. **Hidden media filtered everywhere** — ViewPhotosScreen + FlagQueueScreen exclude hidden rows at query level. Repair-broken-photos script + manual SQL cleanup remove legacy `file://` rows.
4. **PhotoLightbox + tag browser** — Reusable double-tap-to-enlarge modal; co-user can see description + AI tags + tagged people inside the lightbox on Photos and Review screens.
5. **Memo's Notes rename** — "AI Memory" → "Memo's Notes" on home button, screen header, subtitle, empty state, delete dialog, accessibility labels. Route name `AIMemory` preserved.
6. **expo-audio migration** — `expo-av` deprecation warning silenced; TTS public API unchanged.
7. **Briefing date toggle** — `BriefingPreviewScreen` adds Today/Tomorrow tabs so co-user can generate-and-test the briefing immediately instead of waiting for the next morning.
8. **`photo_id: null` tolerance** — `validateSlide` now accepts `null`/`""` photo_id (treats as "no photo"); `generate-briefing` strips them before validation.
9. **System prompt: no URLs in answers** — Forbids markdown links / file paths / raw IDs in assistant responses; the photos array auto-populates the UI.
10. **Search-fallback safety** — Recent-verified-photos fallback always filters `verification_status='verified'` at the query level, never leaks hidden media.

## Key Files
- **AI / Logic**
  - `src/lib/assistant.ts` — thin client wrapper (~50 lines) that invokes the agentic Edge Function
  - `src/lib/tools.ts` — canonical tool definitions + handlers (mirrored in `ask-assistant` Edge Function)
  - `src/lib/embeddings.ts` — embed, embedAndStore, searchMemories (RAG entry point)
  - `src/lib/sensitivity.ts` — semantic classifier wrapper, ruleSetHash, getOrClassify, isAllowed (fail-OPEN)
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
- **Co-user screens** (`src/screens/couser/`) — Dashboard (`CoUserHomeScreen`), View screens, `EditPersonScreen`, `EmergencyContactSettingsScreen`, `FlagQueueScreen`, `SensitivityFiltersScreen`, **`AIMemoryScreen` (Memo's Notes)**, **`BriefingPreviewScreen`**, onboarding/, import/
- **Components** — `src/components/PhotoLightbox.tsx`, `usePhotoLightbox.tsx`, `PhotoTagsView.tsx`
- **Scripts** — `scripts/backfill-embeddings.ts`, `scripts/repair-broken-photos.ts` (file:// + 0-byte detector), `scripts/reset-photos-for-retag.ts` (force AI re-tag for one user), `scripts/seed-test-photos.ts`, `scripts/check.sh`

## Development Phases
- **Phase 0:** ✅ Setup, Supabase, schema, auth, navigation
- **Phase 1A:** ✅ Auth, co-user onboarding, dashboard, device imports
- **Phase 1B:** ✅ User home, morning briefing, emergency card
- **Phase 1C:** ✅ Sensitivity filters, flag queue, AI assistant, notifications
- **AI-native migration:** ✅ Phases 0 (test harness), A (RAG), B (tools), C (semantic sensitivity), D (memory), E (AI briefings)
- **Phase 2:** 🔜 "Tell Me About Your Day" — voice journaling, recall exercises, mood/tone awareness (now sits cleanly on top of memory + tools)
- **Phase 3:** 🔜 Cooking assist, brain stimulation, photo exploration, familiar voice option
- **Phase 4:** 🔜 Cognitive level refinement, analytics, community, hardware exploration

## Important Context Files
- `details.md` — Full project vision and design philosophy
- `plan.md` — Detailed development roadmap and data model
- `progressLogs.md` — Chronological log of all completed work

## Instructions for Working on This Project
- Always read `progressLogs.md` before starting work to understand current status
- Never update `progressLogs.md` during normal implementation flow
- Only update `progressLogs.md` when the user explicitly requests it at the end of the session
- Follow the existing code conventions in `memoria-app/`
- Keep the UI extremely simple — this is the #1 design rule
- Audio-first: anything shown to the user should also be spoken via TTS (OpenAI Nova)
- Safety-first: no AI content reaches the user without sensitivity classifier + co-user verification
- The AI assistant is named **Memo** in all user-facing strings; "Memoria" is the project/codebase name
- Maestro is **paused** — do not extend it; the test gate is `npx tsc --noEmit && npm test` (127 unit tests)
- The app source code lives in `memoria-app/`
- Provider-agnostic LLM/embeddings/TTS — never hardcode URLs; read from env vars
- Tool definitions live in TWO places that must stay in sync: `src/lib/tools.ts` (client) and the duplicate block in `supabase/functions/ask-assistant/index.ts` (Deno)
