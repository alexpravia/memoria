# Memoria — Progress Log

---

## March 8, 2026

### Project Foundation

The project started today with the creation of the **memoria** GitHub repository at github.com/alexpravia/memoria. Two foundational documents were written: `details.md`, which captures the full project vision — what Memoria is, who it helps, the core principles of simplicity and audio-first design, and feature ideas like the cooking function and "Tell Me About Your Day" — and `plan.md`, a detailed development roadmap breaking the project into four phases with a full data model and tech stack defined up front. A reusable **committing-and-pushing** skill was installed so future commits can be handled quickly.

### Phase 0: Project Setup

The mobile app was initialized using React Native with Expo SDK 54 and TypeScript, giving the project a single codebase that works on both iOS and Android and is immediately testable via Expo Go on a real device. Supabase was set up as the backend, providing a real Postgres database, user authentication, and file storage without needing a custom server. The full database schema was designed and deployed — 11 tables covering user profiles, co-users, people in the user's life, photos/videos, events, journal entries, daily summaries, pinned notes, sensitivity filters, and a flag queue for co-user review. TypeScript types were generated to match every table, making the codebase type-safe. The two-experience navigation system was built, routing users to completely different app flows depending on whether they log in as the patient or the caregiver.

### Phase 1A: Authentication & Co-User Onboarding

Login and signup screens were built with real Supabase authentication — accounts are created, sessions persist, and logout works correctly. A four-step co-user onboarding flow was built to walk the caregiver through setting up their loved one's profile: entering name, date of birth, and location; adding life facts to be reminded of; adding important people with relationship descriptions and emotional notes; and adding events and routines. The co-user dashboard was built with live stats showing how many life facts, people, and events have been entered, with quick-access buttons to add more at any time. A "Set Up Their Login" screen was added so the co-user can create credentials for the patient without being logged out of their own session. Three device import screens were built: Import Contacts pulls from the phone's contact list for selective import, Import Calendar grabs events from the past month through three months ahead, and Import Photos opens a grid-style picker. All three handle permissions gracefully and save directly to Supabase.

### Phase 1B: User Experience

The user home screen was built with two large, simple buttons: "Start My Day" to begin the morning briefing, and "Who Am I?" for the emergency context card. The morning briefing was built to pull the user's profile, life facts, people, and events from the database and present them one slide at a time with large text, each slide read aloud via TTS, with forward/back/replay controls and a progress bar. The emergency context card was built to display the user's name, location, and emergency contact in large clear text — designed to be accessed quickly when the user is disoriented.

---

## March 9, 2026

### Phase 1C: AI & Safety Layer

The sensitivity filters screen was built, letting co-users define boundaries for what the AI is allowed to show or mention. Three filter types are supported: specific people to avoid, topics to avoid (like "the hospital"), and entire time periods to skip. These filters apply globally across briefings, the AI assistant, and all future features. Each filter can include a note explaining why it exists, and filters can be deleted at any time.

The flag queue screen was built as a review interface where co-users can see all AI-flagged items before they reach the patient. Each item shows its type, description, and the co-user can approve, reject, or hide it. Previously reviewed items are shown separately. The co-user dashboard now shows a red badge with the count of pending items.

The conversational AI assistant was built, letting the patient ask questions about themselves, their family, or their schedule in a simple chat interface. The assistant pulls the user's profile, life facts, people, and events, strips anything blocked by sensitivity filters, and sends filtered context to an LLM with a system prompt that enforces warmth, simplicity, and honesty. Responses are displayed in large text bubbles and read aloud automatically. The AI service layer (`assistant.ts`) was built to be provider-agnostic — the LLM call goes through a single swappable function controlled by three env vars (`LLM_API_URL`, `LLM_API_KEY`, `LLM_MODEL`). The `ask-assistant` Supabase Edge Function was deployed to proxy requests to any OpenAI-compatible API.

Push notifications were added: when the patient opens the app, it requests permission and schedules local reminders for all of today's events — one an hour before and one at event time. All previously scheduled notifications are cleared and rescheduled fresh on each open to avoid duplicates. The co-user dashboard was reorganized with a "Safety & Settings" section grouping the review queue, sensitivity filters, and login setup, color-coded with red for safety features and purple for imports.

---

## March 13, 2026

### Bug Fixes & UX Improvements

Several co-user side improvements were made. The stat cards on the dashboard were made tappable, routing to dedicated view screens (`ViewLifeFactsScreen`, `ViewPeopleScreen`, `ViewEventsScreen`, `ViewPhotosScreen`) that list all saved data in styled cards before offering an "Add More" button. A Photos stat card was added to the dashboard, completing the four-card row. Back and exit buttons were added to the Life Facts, People, and Events onboarding screens so the co-user isn't forced through a linear flow.

On the import side, a photo import crash was fixed — the app had been using `ph://` URIs from the iOS photo library which React Native can't render. These are now resolved to `file://` local URIs using `getAssetInfoAsync` before display. Duplicate imports were addressed by showing already-imported items dimmed with an "Already imported" badge rather than hiding them. A "Grant Access to More Contacts" button was added to open iOS Settings for users who initially granted limited contact access, and a permission-denied state was added for users who denied access entirely. The "Set Up Their Login" button now dynamically shows "Set Up Another User" if credentials already exist.

On the user side, the emergency card text overflow was fixed using `adjustsFontSizeToFit` for long contact names, the emergency contact's phone number was added to the "Who Am I?" screen, an exit button was added to the morning briefing, and slide-in animations were added to the briefing so each slide fades in and floats up over 600ms with TTS triggering as the animation plays.

Infrastructure-wise, Expo tunnel mode was resolved by installing `@expo/ngrok` locally with `--legacy-peer-deps` to bypass peer dependency conflicts, and accidental `react-dom` and `react-native-web` dependencies were removed after a failed web-support install broke the build.

### Next Steps
- Continue testing and fixing bugs across both the co-user and user experiences
- Verify all import flows work correctly end-to-end on a real device
- Test the full user journey — login, briefing, emergency card, and AI assistant

---

## March 14, 2026

### Photo Intelligence Pipeline

Photo import was overhauled to upload photos to Supabase Storage (`photos/{userId}/`) instead of saving local `file://` URIs, making photos accessible via public URLs for AI analysis. Upload progress is shown during import ("Uploading 3 of 10...").

A new `process-photo` Supabase Edge Function was created that accepts a photo URL and the user's known people list, calls the AI vision model, and returns structured JSON: a warm description, category tags, identified people with confidence levels (high/medium/low), and a review flag with reason.

The post-import processing pipeline was built in `src/lib/photoProcessing.ts`. After upload, each photo is sent to `process-photo`, and results are written back: description and `ai_tags` on the `media` row, `media_people` rows with numeric confidence scores (high=0.9, medium=0.7, low=0.3), `flag_queue` entries for photos needing review, and auto-verification for photos where all identified people are high-confidence.

The flag queue was enhanced to display actual photos for `flag_type='media'` items, along with the AI-generated description and tagged people with color-coded confidence badges (green/orange/red). Cascading approval logic was added — approving a flag verifies the photo and all its `media_people` rows; rejecting or hiding sets `verification_status='hidden'`. Previously reviewed media flags show a small photo thumbnail for reference. The photos view screen was updated with verification status badges (✓/⏳/🚫) and a filter toggle bar (All / Pending / Verified with counts) so the co-user can quickly find photos still needing review.

The AI assistant was updated to include verified photo metadata in its context, enabling questions like "Show me photos of Maria." Photo metadata (URL, description, tags from `ai_tags` JSONB, taken date, and tagged people names) is included in the system prompt as a `PHOTOS & MEMORIES` section with `[PHOTO:url]` markers. The client strips these markers from spoken text and returns them as a separate `photos` array so the UI can render photos inline without URLs being read aloud. The media query in `getUserContext()` fetches up to 50 most recent verified photos, joins `media_people` with `people` to resolve tagged person names, and applies full sensitivity filtering — excluding photos linked to filtered person IDs, photos with descriptions containing filtered topics, and photos taken during filtered time periods. The `media_people` query is skipped when there are no media IDs to avoid unnecessary Supabase calls. The chat UI was updated to render photos as a horizontal scrollable row of 200×200 rounded images below the assistant's text bubble.

The morning briefing was updated with a "Recent Memories" section showing up to 5 verified photos with AI-generated descriptions, each on its own slide with a warm intro and TTS. Sensitivity filtering was applied using the same pattern as the assistant. A photo fallback was added for people slides — when a person has no `photo_url` (common for imported contacts), the briefing checks `media_people` for a verified, high-confidence (≥0.8) photo of that person and uses it as their slide photo. The memories section is fully optional — if no verified photos exist or all are filtered out, the section is silently skipped and the briefing flows naturally.

An emergency card bug was fixed — the query had been selecting a `phone` column that doesn't exist on `co_users`, silently failing the entire contact section. The query was corrected with a fallback to `people.contact_info` JSONB for phone numbers. A pre-existing TypeScript error (invalid `minFontSize` style property) was also removed; the codebase now compiles with zero TypeScript errors.

### Next Steps
- Test the full photo pipeline end-to-end on a real device — import photos, verify AI processing runs, check flag queue, approve photos, confirm they appear in briefing and chatbot
- Deepen AI integration beyond the chatbot — facial recognition accuracy, photo categorization refinement, and smarter context surfacing (e.g. "This Day in Your Life" photo memories, event-linked photos)
- Continue testing and fixing bugs across both co-user and user experiences

---

## March 22, 2026

### Photo Import RLS Fix

A "new row violates row-level security policy" error during co-user photo import was diagnosed and fixed. The co-user is authenticated with their own `auth.uid()` but inserts `media` rows with the patient's `user_id`, which the default RLS policies rejected. A migration (`supabase/fix_rls_policies.sql`) was written with updated policies for the `media`, `media_people`, `flag_queue` tables and the `photos` Storage bucket, all allowing co-users to manage data for their linked patient via `co_users.auth_id = auth.uid()`. All policies use `DROP POLICY IF EXISTS` before `CREATE POLICY` for idempotent re-runs. The file is ready to run in the Supabase Dashboard SQL Editor.

---

## April 6, 2026

### People Editing, Emergency Contact Management & Pipeline Reliability

Full editing support was added for people (including imported contacts). `EditPersonScreen.tsx` was created and wired into navigation and `ViewPeopleScreen.tsx` so co-users can update name, relationship, key facts, emotional notes, phone, and email. Refresh-on-focus behavior was added to `ViewPeopleScreen` and `CoUserHomeScreen` so edits appear immediately when navigating back.

`EmergencyContactSettingsScreen.tsx` was added to the co-user dashboard so the co-user can explicitly set and update the emergency phone number at any time. Onboarding (`CreateUserProfileScreen.tsx`) was updated to collect this at setup. The emergency card was updated to read phone and email directly from `co_users`, displaying phone above email, with a backward-compatible fallback to `people.contact_info.phone` only when needed. A duplicate email rendering path was also removed so contact details appear once and in the intended order. The briefing slide photo assignment was expanded to ensure applicable slides have photos via verified fallback pools (including people and event-related sections).

The photo processing pipeline was hardened so AI failures no longer silently stall — pending media now gets queue entries, metadata update failures are handled, and person-tag upserts are resilient. A `reprocessPendingPhotos()` function was added and wired into a retry action in `ViewPhotosScreen`. A direct "Open Review Queue" action was added from the pending photos UI to speed up manual verification. The import screen now surfaces partial AI failures to the co-user rather than showing silent success. The flag queue was updated with better error handling and visible retry UI. Two SQL migrations were added: `supabase/add_co_user_phone.sql` (adds `co_users.phone` as the emergency contact source of truth) and `supabase/fix_flag_queue_and_pending_backfill.sql` (hardens RLS around `flag_queue`/`media_people` access and backfills missing pending queue records for pending photos). Both were executed in Supabase and confirmed in place.

### Next Steps
- Fully test everything end-to-end and do not move forward until everything works correctly

---

## April 12, 2026

### Maestro iOS Smoke Test Stabilization

The Expo Go Maestro wrapper script (`memoria-app/scripts/maestro-ios.sh`) was stabilized so each run terminates any stale Expo Go instance before reopening the local `exp://` URL on the booted iOS simulator. Authenticated Maestro login flows for user briefing, emergency card, and co-user coverage were hardened with retries on text entry, explicit email field verification (confirming the field actually contains the expected address, not just that it was typed), and cold-start handling for the Expo Go app tile. iOS system prompt handling was added for the "Save Password?" sheet so it no longer blocks login during Maestro runs. The co-user save-success alert expectation was removed from the edit-person flow and replaced with a check for the real navigation behavior (returning to the people list). The `.maestro/README.md` was updated to document the new stability behavior including fresh Expo Go launches, explicit email verification, and password-save sheet dismissal. All four Maestro flows passed: `maestro:test`, `maestro:test:user:briefing`, `maestro:test:user:emergency`, `maestro:test:co-user`.

### Next Steps
- Test everything end-to-end using Maestro
- Make everything look nice and function correctly
- Make the AI processing work correctly, with special emphasis on getting the pipeline fully reliable

---

## May 10, 2026

### AI-Native Migration (Phases 0–E)

This was a large session that migrated Memoria from a context-injection AI pattern to a fully agentic, RAG-powered architecture. The changes touched the database, every Edge Function, and most of the client library.

On the database side, pgvector support was added via `add_embeddings.sql` with `embedding`/`embedding_text`/`embedding_updated_at` columns on `media`, `life_facts`, `people`, and `events`, IVFFlat indexes, and a `match_memories` RPC for unified semantic search across all four tables. New tables were created for `conversations` and `messages` (persistent chat history with tool-call records, via `conversations_messages.sql`), `assistant_memory` (Memo's notes about the user with importance-based auto-flagging, via `assistant_memory.sql`), `briefings` (AI-generated slide decks with a `draft → approved → delivered` status workflow, via `briefings.sql`), and `sensitivity_decisions` (a cache for classifier results). Intent-aware columns (`intent_text`, `intent_embedding`) were added to `sensitivity_filters` via `sensitivity_upgrade.sql`. `ensure_photos_bucket.sql` was added to confirm the `photos` Storage bucket exists with public read access and correct RLS policies.

Six Edge Functions were built in Deno: `embed` (proxy for `text-embedding-3-small`), `check-sensitivity` (intent-aware content classifier using `gpt-4o-mini` to judge content against natural-language rules), `ask-assistant` (fully agentic tool-calling loop with conversation persistence, memory injection, and eight tools: `search_memories`, `get_person`, `list_events`, `get_life_facts`, `get_user_profile`, `remember_about_user`, `recall_about_user`, `flag_for_co_user`), `process-photo` (AI vision pipeline returning description, tags, people, and review flag), `generate-briefing` (slide JSON generator with retry-on-invalid validation and a candidate photo pool), and `tts` (`tts-1` with `nova` voice, returning raw audio bytes).

On the client side, a full suite of library modules was added: `assistant.ts` (thin agentic wrapper), `tools.ts` (canonical tool definitions mirrored in the Edge Function — these two must stay in sync), `embeddings.ts` (RAG entry point with embed, embedAndStore, searchMemories), `sensitivity.ts` (fail-OPEN classifier wrapper with ruleSetHash, getOrClassify, isAllowed), `memory.ts` (rememberAboutUser, recallAboutUser, statuses), `briefing.ts` (generate, get, approve, validate, resolveSlidePhotos), and `tts.ts` (OpenAI TTS with 50-entry LRU disk cache and `expo-speech` fallback).

New screens were built for the co-user: `AIMemoryScreen` ("Memo's Notes") lets co-users review, edit, pin, suppress, and delete Memo's persistent memories. `BriefingPreviewScreen` lets co-users generate, review, and approve daily briefings, with a Today/Tomorrow date toggle for testing without waiting for the next morning. The assistant screen was updated for conversation threading (`conversationId`), "Memo" branding throughout, and inline PhotoLightbox integration; the system prompt now forbids markdown links, file paths, and raw IDs in answers. The briefing screen was updated to use AI-orchestrated slides when an approved briefing exists, falling back to the procedural builder when it doesn't, with next-slide TTS pre-warming for instant playback. The audio stack was fully migrated from `expo-av` to `expo-audio` (`createAudioPlayer` + `setAudioModeAsync` with `playsInSilentMode`/`shouldPlayInBackground`). HEIC→JPEG conversion via `expo-image-manipulator` was added to the photo import flow. The AI assistant was renamed to "Memo" across every user-facing string — button labels, greeting, screen titles, accessibility labels, and the system prompt identity — while the project name "Memoria" stays in code and files.

### Photo Pipeline Polish

The TTS empty-payload bug was fixed by replacing `supabase.functions.invoke('tts')` with a direct `fetch()` against `${SUPABASE_URL}/functions/v1/tts` so binary responses are read via `arrayBuffer()` instead of being JSON-parsed and stripped. The assistant photo-limit logic was fixed so `search_memories` defaults to `limit:1` when unspecified, and the system prompt now explicitly distinguishes singular ("show me a photo" → 1) from plural ("show me photos" → 3-5). Photo import was hardened to hard-fail on upload errors and validate `http(s)` prefix before insert. The `processPhoto` function now refuses non-http URLs early and immediately marks those rows hidden, eliminating the recurring "Edge Function returned a non-2xx status code" review-queue error caused by `file://` URIs. Photo auto-verification was fixed to trigger whenever `needs_review === false` regardless of whether people are present — the old logic had forced every landscape and scenery photo into the review queue unnecessarily. The `process-photo` vision prompt was rewritten to require a single short description sentence (under 15 words, with examples and an explicit no-paragraphs rule), 3–8 literal-content tags drawn from a wide vocabulary (landscapes, nature, objects, animals, etc. — no empty arrays), and to only flag for review when truly warranted (unidentified faces, sensitive content, very poor quality) — not just because a photo lacks people.

`validateSlide` was made to tolerate any non-string `photo_id` (null, empty string, number, array, object) treating it as missing, and `generate-briefing` was updated to strip non-string `photo_id` shapes before validation, with the prompt schema tightened to forbid non-string values. `resolveSlidePhotos` was updated to filter `verification_status='hidden'` rows at the query level and post-filter any rows whose `file_url` isn't `http(s)`. `BriefingScreen` now renders a large 4:3 rectangular photo (replacing the 150×150 round avatar), self-heals on `<Image onError>` by returning `null`, and runs a `backfillPhotos` helper that fills missing `photo_url` values on `greeting`/`person`/`memory_photo` slides from a verified-recent-media pool.

The `PhotoLightbox` was replaced with an image-first design where the photo fills the screen via `resizeMode='contain'` and AI metadata overlays in a translucent bottom-left card (full-width, white text) toggled by a top-left ⓘ button. Single-tap (replacing double-tap) was implemented via `useTapToOpen` (a thin `useCallback` wrapper, no timing threshold) across `ViewPhotosScreen`, `FlagQueueScreen`, `BriefingScreen`, `AssistantScreen`, and `BriefingPreviewScreen`. The lightbox tag overlay was made full-width with no description clamp so the full sentence wraps, and the tag slider pan gesture was fixed using a `View + onStartShouldSetResponder=true / onMoveShouldSetResponder=false` pattern so horizontal scroll receives the pan without dismissing the modal. Scroll affordance arrows (‹/›) were added to the kind-filter row in `AIMemoryScreen`, appearing/disappearing based on scroll position and tapping to scroll 120px in each direction.

The front-end `<Image onError>` self-heal behavior was changed so it no longer writes `verification_status='hidden'` to the DB — the tile still hides locally on render failure, but transient simulator/network blips no longer permanently nuke good photos. `repair-broken-photos.ts` was extended to detect 0-byte uploads via HEAD requests (in addition to `file://` detection) and now also clears `ai_tags` and `description` when hiding a row to prevent stale text leaking into chat or briefings. A `reprocessAllPhotos(userId)` function was added to `photoProcessing.ts` that resets every non-hidden http photo to pending and re-runs `processPhoto`, wired to a co-user "Re-tag All Photos With AI" button on `ViewPhotosScreen`. A standalone `scripts/reset-photos-for-retag.ts` script was added (`--user <id> --apply`, dry-run by default, idempotent) that mirrors the repair script pattern.

A live DB cleanup was run on the test user (42cd6787-…): 4 legacy `file://` HEIC rows were hidden, 5 zero-byte JPEG uploads were identified and hidden, 5 photos that had been spuriously marked hidden during a flaky simulator session were restored, and a re-tag pass was run on all remaining pending photos producing one-sentence descriptions and 5–8 literal-content tags each. Final state: 5 verified, 9 hidden. `process-photo` and `generate-briefing` were deployed to the live Supabase project (`zpxyqomebbjadqvgpapw`) multiple times as the prompt and validation logic were refined. The test suite reached 127 unit tests across 7 files, including 5 new tests for `validateSlide` non-string `photo_id` tolerance and 2 new tests for `resolveSlidePhotos` hidden + non-http filtering. Five AI eval JSON files were written in `tests/evals/` for non-deterministic behavior coverage: assistant quality, sensitivity judgment, briefing quality, RAG recall, and memory formation. The CI gate (`npx tsc --noEmit && npm test`) was passing clean at end of session.

### Flags for Next Session
- The front-end `<Image onError>` self-heal no longer writes `verification_status='hidden'` to the DB. The only safety nets for broken photos are the `processPhoto` early guard (non-http URLs) and the `repair-broken-photos.ts` script (file:// + 0-byte detection). If a transient fetch failure leaves a good photo looking broken in the UI, the row is fine and a reload will recover it
- Five zero-byte JPEGs survived in Storage from an older import session (HEIC→JPEG silent failure). Future imports go through the hardened `ImportPhotosScreen` that hard-fails on upload error, but monitor newly imported batches — if more zero-byte rows appear, add a post-upload `content-length > 0` check inside the import loop
- `reset-photos-for-retag.ts` does NOT unhide rows. If `onError` ever hides a good photo during a script run, an admin must manually `UPDATE media SET verification_status='pending' WHERE ...` via SQL
- The lightbox tag-pan fix uses `View + onStartShouldSetResponder=true / onMoveShouldSetResponder=false`. If any other component embeds a horizontal `ScrollView` inside a touch responder, mirror this pattern or the pan will be intercepted

### Next Steps
- Test the entire implementation fully end-to-end (co-user onboarding, photo import, AI re-tag, briefing generation/approval/delivery, assistant chat with photos and memory, sensitivity classifier, emergency card) and surface any remaining bugs
- Fix any outstanding issues with Memo's chat before any Phase 2 work begins
- Do NOT begin Phase 2 ("Tell Me About Your Day") until everything in Phase 1 works correctly
- After full end-to-end verification, consider running `repair-broken-photos.ts` on any other linked users to clean up legacy media
- Consider adding a post-upload size sanity check (`content-length > 0`) to the photo import flow to prevent the 0-byte HEIC→JPEG failure mode from recurring

---

## May 30, 2026

### Talk to Memo — Chat Scroll Bug Fix

A long-standing visual bug in the assistant chat was diagnosed and fixed. The bug caused photo bubbles to have blank space below the image and grow taller with each new message appended. The root cause was an unbounded horizontal `ScrollView` wrapping chat photos — it was being measured against available parent space rather than its image content, and each new message triggered a cascading re-layout that made the scroll viewport taller every turn. The bug had been incorrectly attributed to a missing `height` on the photo container in an earlier patch attempt during the session; the oracle was consulted to confirm the actual root cause before refactoring.

The fix replaced the single-photo path with a plain `<View>` so the common case has no nested scroll viewport and the bubble wraps tightly to the photo. The horizontal `ScrollView` was kept only for responses with two or more photos, bounded with `flexGrow:0 / flexShrink:0 / alignSelf:"flex-start"` so it cannot claim excess vertical space, with a `photosScrollContent` style setting `alignItems:"flex-start"`. `ChatPhoto` was refactored to calculate each tile's natural aspect ratio via `Image.getSize` (width fixed at 200pt, height clamped 120–280pt via `PHOTO_WIDTH`, `PHOTO_MIN_HEIGHT`, `PHOTO_MAX_HEIGHT` constants) so portrait and landscape photos display correctly without distortion. An `isLast` prop was added on `ChatPhoto` so single-photo tiles get no trailing `marginRight`. Photo keys were switched from array index (`key={j}`) to `key={url}` to prevent React from reusing component state if photo order ever shifts.

### Emergency Card — Phone Number Formatting

A `formatPhone()` helper was added to `EmergencyCardScreen.tsx` that formats 10-digit US numbers as `(XXX) XXX-XXXX`, 11-digit numbers starting with 1 as `+1 (XXX) XXX-XXXX`, and leaves anything else (international, extensions, partial) unchanged. The phone number in the emergency card now always displays formatted regardless of how the co-user typed it during onboarding.

### Design System Implementation

A centralized design token file was added at `src/theme.ts`, replacing the hardcoded hex values (`#7c4dff`, `#2a2a4a`, etc.) that were scattered inline across every screen's StyleSheet. The file exports `colors`, `radius`, `border`, and `type` objects as the single source of truth for the app's visual language. `react-native-svg` 15.12.1 was installed and a custom icon component was created at `src/components/Icon.tsx` with a full rounded-stroke SVG icon set — 14 icons plus 4 control glyphs (back, forward, close, add) — designed to match the brand mark's visual language on a 24px grid with 2px stroke weight and round caps. All emoji icons across the app (💬 🆘 🔊 📇 📅 📸 🚩 🛡️ 🧠 🔑 📞) were replaced with the custom SVG components, and all six affected screens (`UserHomeScreen`, `EmergencyCardScreen`, `BriefingScreen`, `CoUserHomeScreen`, `SensitivityFiltersScreen`, `FlagQueueScreen`) were migrated to use theme tokens throughout their StyleSheets. TypeScript and all 127 unit tests remained passing.

### Flags for Next Session
- The single-photo / multi-photo split in `AssistantScreen.tsx` is intentional — the inner `ScrollView` is the dangerous shape on iOS. If a future change consolidates the two paths, the multi-photo container MUST keep `flexGrow:0 / flexShrink:0 / alignSelf:"flex-start"` or the chat-scroll bug will return
- `Image.getSize` still triggers a one-time height resize after each chat photo loads (square placeholder → true aspect ratio). If flicker becomes visible in practice, pre-fetch dimensions in `askAssistant` or pass a size hint from the server alongside the URL
- `AssistantScreen` is the only screen that renders chat photos in this exact nested-ScrollView pattern, but `BriefingScreen` and `BriefingPreviewScreen` should be audited for the same shape before the next polish wave
- The Supabase project risks being paused due to inactivity — hit the project from the app or SQL editor weekly, or set up a GitHub Action keep-alive ping

### Next Steps
- Keep testing the end-to-end Phase 1 experience and polishing — co-user onboarding, photo import, AI re-tag, briefing generation/approval/delivery, assistant chat with photos and memory, sensitivity classifier, emergency card
- Surface any remaining bugs and patch them with root-cause discipline before moving forward
- Do not begin Phase 2 ("Tell Me About Your Day" — voice journaling, recall exercises, mood/tone awareness) until everything in Phase 1 feels solid

---

## May 30–31, 2026

### AI-Native RAG Upgrade (Phases 1–4 of LLM-plan.md)

A resource atlas of top-tier LLM-engineering references was analyzed and distilled into `LLM-plan.md`, a deeply-reasoned, codebase-specific roadmap for making Memoria's AI genuinely AI-native. Phases 1–4 of that plan were implemented in one session, each kept behind the `npx tsc --noEmit && npm test` gate (now 132 unit tests) and validated by a multi-agent adversarial review.

**Retrieval & embeddings.** Photo embeddings were enriched to fold the AI tags and identified people's names into the embedded text (`buildPhotoEmbedText`), not just the description — so a photo tagged "beach"/"sunset" is now retrievable by a "beach photo" query even when the prose never says it; `scripts/reembed-media-rich.ts` backfills pre-existing photos. The `match_memories` RPC gained a `p_min_similarity` floor (wrapped UNION, backward-compatible 5th param) to cut low-relevance noise. A hybrid-retrieval RPC, `match_memories_hybrid`, was added: dense vector search fused with BM25-style Postgres full-text search via Reciprocal Rank Fusion, with generated `tsvector` columns on media/life_facts/people/events. The dense arm honors the similarity floor; the lexical arm (exact names, dates, tags) is never floored.

**Assistant (`ask-assistant`).** Dynamic tool selection narrows the read tools by question type while always offering the write/safety tools; tool results are clamped to bound context growth. Two post-generation safety gates were added — a groundedness check (an unsupported answer is suppressed to a safe fallback and flagged, because a hallucinated family fact told to a dementia patient is a safety issue) and an output sensitivity re-check — both fail-open. Final-answer persistence was moved past the gates so a suppressed answer never enters stored history. Per-tool-call traces persist to a new `conversation_traces` table.

**Structured Outputs.** `process-photo` and `generate-briefing` were migrated from prompt-instructed JSON to strict JSON-schema Structured Outputs, eliminating silent parse failures (and the spurious review-queue entries they caused); a `BRIEFING_LLM_MODEL` env var allows a stronger model for the async briefing path.

**Memory & evaluation.** A `preference_signals` table plus `logPreferenceSignal` capture implicit co-user feedback (memory pin/suppress/delete, briefing approve/regenerate/edit) as future fine-tuning data. The assistant-quality eval was expanded 15 → 50 cases (including groundedness guards), and a `rag-metrics` integration test measures retrieval recall@N and deterministic answer-assertion pass-rate against the canonical seeded fixture.

**Review.** A multi-agent adversarial pass confirmed the SQL, Structured Outputs, and client/test changes and surfaced one real defect — `selectTools` had been stranding the write/safety tools on narrowed turns — which was fixed so `remember_about_user` and `flag_for_co_user` are always offered.

### Production Deployment & Migration Hurdles

All four SQL migrations were applied to the live project and the three changed Edge Functions deployed (ask-assistant v10, process-photo v6, generate-briefing v4); existing photos were re-embedded with rich text. Hurdles worked through: a migration was first run against the wrong Supabase project (harmless — it only defines a function and rolled back on the missing-table error); the hybrid migration hit `54000: maintenance_work_mem` because adding a STORED generated column rewrites the table and rebuilds the 1536-dim IVFFlat index (fixed with `set maintenance_work_mem = '256MB'`); it then hit `42P17: generation expression is not immutable` because Postgres treats the `'english'` regconfig coercion, `array_to_string`, and `jsonb::text` as merely STABLE (resolved by wrapping each table's tsvector expression in an `IMMUTABLE` SQL function). The Supabase CLI was run via `npx` (no Homebrew / Command-Line-Tools needed).

### Local App Fix — Expo SDK 54 Dependency Alignment

The app stopped loading locally with a Hermes `SyntaxError: private properties are not supported`. Root cause: `babel-preset-expo` had drifted to v56 while SDK 54 expects ~54.0.10, so `react-native-svg`'s `#private` fields reached Hermes untranspiled; pinning `babel-preset-expo@~54.0.10` (54.0.11) fixed it. That surfaced a second crash — `Exception in HostFunction` from `NativeReanimated` — because the JS had `react-native-reanimated@3.16.7` (SDK 53) while Expo Go for SDK 54 ships reanimated 4 natively; resolved by upgrading to `react-native-reanimated@~4.1.1` + `react-native-worklets@0.5.1` and swapping the Babel plugin to `react-native-worklets/plugin` (where reanimated 4 moved it).

### Design & Motion System (parallel session)

In parallel, a design/motion system was integrated: a `src/motion/` module (`IntensityContext`, `primitives`, `ui`), a `Logo` component, and design-handoff assets, with edits across many screens. Authored in a separate session; type-checks and unit tests pass.

### Flags for Next Session
- **Security:** the Supabase `service_role` key was pasted into a tool chat during deployment — rotate it (Settings → API / reset JWT secret) and update the anon key in `src/lib/supabase.ts`.
- Verify the reanimated 4 upgrade at runtime — confirm briefing slide-in animations still behave; v3→v4 changes a few APIs.
- Remaining SDK-54 version drift is still unaligned (`expo` 54.0.33 vs 54.0.35, `expo-asset`, `expo-image-picker`, `expo-notifications`, `@types/react` 18 vs 19, `typescript` 5.7 vs 5.9) — realign deliberately with `npx expo install --fix -- --legacy-peer-deps`, testing after.
- Phase 5 of `LLM-plan.md` is intentionally paused: facial recognition first (AWS Rekognition — the GPT people-ID is a stub the `media_people` schema is ready to receive), then key_facts chunking, LLM re-ranking, memory consolidation, and the document pipeline.
