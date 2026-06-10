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

---

## June 1, 2026

### W2 — Kiosk Voice Stack

The full W2 voice loop was built for `apps/kiosk` and validated end-to-end (Hey Memo → listen → nova answer → idle confirmed working in Chrome).

**State machine.** A pure reducer (`lib/voice/machine.ts`) drives the loop: `idle → wake → listening → thinking → speaking → idle`. It is the single source of truth for concurrency rules: `generation` bumps on every turn abandonment (cancel/barge-in/silence/error) so in-flight async work can be dropped; the happy path never bumps it. 24 unit tests cover every transition, the silence path, barge-in, wake-while-speaking (no-op by design), and the race-guard invariant. vitest was wired into `apps/kiosk` and the root `npm test` now runs both `packages/core` (116 tests) and `apps/kiosk` (24 tests).

**Voice loop hook.** `lib/voice/useVoiceLoop.ts` binds the reducer to browser side effects: STT, wake word, TTS (`tts-web.ts`), `askAssistant`, earcons, and navigation intents. Key concurrency properties enforced: generation race guard on `askAssistant` and TTS callbacks; barge-in stops TTS via effect cleanup; wake word paused for the whole non-idle turn and re-armed only after a post-speak debounce (with an `isSpeaking()` poll so nova's own audio never retriggers the wake phrase); 20-second `thinking` watchdog so a hung `askAssistant` doesn't strand the kiosk; spacebar PTT (skips buttons/links); per-user `conversationId` reset on auth change; mic-permission errors speak an actionable message instead of the generic retry fallback.

**STT.** `lib/voice/stt.ts` wraps `SpeechRecognition` (PTT default, Safari→PTT, Firefox→unsupported). A module-level `activeRec` guard ensures only one recognizer holds the mic at a time — navigating between pages can't orphan a session.

**Wake word.** `lib/voice/wakeword.ts` uses `SpeechRecognition` in continuous mode (no dependencies, no account, no model files). Scans interim transcripts for "hey memo" (+ phonetic variants) while idle; restarts via a watchdog when Chrome auto-terminates the session (~5 min); degrades to push-to-talk in Firefox. Picovoice (proper acoustic wake word) is documented in `future-implementations.md` for when a custom-domain email is available.

**Audio unlock.** `lib/audio-unlock.ts` performs the gesture-driven unlock sequence (AudioContext resume, silent buffer, speechSynthesis prime, Fullscreen request, Wake Lock). `components/AudioUnlockGate.tsx` renders a full-screen "Touch to begin" overlay providing `useAudioUnlocked()` to the tree. The home greeting speaks immediately after unlock.

**UI.** `components/VoiceOrb.tsx` is an animated Logo button: slow breathing (idle), ring pulse + glow (listening), dim pulse (thinking), expanding ring (speaking). CSS keyframes live in `globals.css`. `app/HomeClient.tsx` is the new ambient home — orb + live caption + nav shortcuts. `app/briefing/` is a new route with auto-advancing slides: `speak(tts_text, { onDone: advance })`, `prewarm(nextSlide)` during current slide, `duration_ms` max-dwell fallback timer, next/again/stop controls (buttons + one-shot voice command mic), `markDelivered` on completion. The assistant page gained a mic button that runs a one-shot STT session and sends the transcript.

**tts-web.ts hardening.** Added `speakEpoch` (monotonic counter bumped by `stop()`) so a barge-in during the audio-fetch gap cancels the about-to-play audio — the previous window where an abandoned answer could play anyway. Added `currentBlobUrl` tracking so every `stop()` revokes the blob URL, preventing an unbounded memory leak on a long-running kiosk. Empty/blank `speak()` calls now fire `onDone` so briefing advance never stalls. Read-path briefing validation added (`validateBriefing` called before rendering). `Providers.tsx` updated to wrap the app in `AudioUnlockGate`.

**Multi-agent adversarial review.** After the initial build, a 32-agent workflow fanned out across 4 lenses (race-guard concurrency, React 19/Next 16 correctness, briefing auto-advance, API-contract integration), raised 28 findings, and confirmed 15 real. All real-impact findings were fixed in the same session.

**future-implementations.md** created at the repo root: Picovoice wake word, hardware partnership wake word strategy, Phases 2–4, LLM Phase 5, deferred kiosk polish, and infrastructure flags.

### Security Note
The `service_role` key was accidentally pasted into `.env.local` (second occurrence — also flagged May 30). It was cleared from the file immediately and `.env.local` is gitignored so it never reached the repo. Rotate the key in Supabase Dashboard → Settings → API before any production use.

### Flags for Next Session (W2)
- `AudioUnlockGate` ignores the `isAudioUnlocked()` sessionStorage flag on remount — gate re-shows within the same browser session on a hard reload. Fix: add a mount effect `if (isAudioUnlocked()) setUnlocked(true)`. Low priority for now.
- Wake word false triggers: "hey memo" appearing in any sentence fires the wake. Acceptable for demo; Picovoice (acoustic) is the proper fix — see `future-implementations.md`.
- Briefing "pause" restarts the current slide from the beginning (no true resume). Acceptable for the patient audience; documented in `future-implementations.md`.
- Supabase project risks pausing due to inactivity — hit it weekly or set up a keep-alive ping.

---

### Kiosk Web App — Sign-in & Auth Gate

The kiosk had no authentication gate — the app was fully accessible without signing in, which meant `userId` was always null. Every feature that depended on it (voice loop, assistant, briefing) either silently failed or showed "Please sign in."

**Sign-in screen.** `components/SignIn.tsx` was added: a full-screen, on-brand sign-in form (logo, large email/password fields, primary "Sign In" button, error feedback). A helper note tells the patient that their account was set up by a family member, since patients don't self-register. The form uses `useAuth().signIn()` from `@memoria/core`.

**Auth gate.** `app/Providers.tsx` was updated with an `AuthGate` component that wraps the entire app inside `AuthProvider`. The gate renders a spinner while the session loads, the sign-in form when unauthenticated, and children once authenticated. `AudioUnlockGate` was moved inside the gate so co-users bypass it entirely — it's only needed for the patient's audio-first kiosk UX.

With auth in place, all four prior issues resolved: the voice loop now calls `askAssistant` with a valid `userId`; the assistant page no longer shows "Please sign in"; the briefing loads from the database; and the home greeting fires after unlock.

### Kiosk Web App — Co-User Portal (Milestone 1)

Co-users were incorrectly landing on the patient kiosk after login. The portal now routes each role to the correct experience and provides a complete co-user dashboard shell.

**Role-based routing.** `AuthGate` in `Providers.tsx` now reads `role` from the auth context after session load. A `useEffect` redirects `co_user` → `/co-user` and `user` away from `/co-user/*`; a synchronous guard shows a spinner during the in-flight redirect so the wrong UI never flashes. Co-users bypass `AudioUnlockGate`; patients continue to use it.

**Co-user layout.** `app/co-user/layout.tsx` wraps all `/co-user/*` routes with a persistent top navigation bar: the Memoria logo (links back to the dashboard) and a Sign Out button. The layout is a client component so it can call `useAuth().signOut()` directly.

**Co-user dashboard.** `app/co-user/CoUserHomeClient.tsx` is the full management hub, mirroring the mobile `CoUserHomeScreen` in web form. On mount it fires seven parallel Supabase queries: patient full name, life facts count, people count, events count, photos count (excluding hidden), pending flag queue count, and tomorrow's briefing status via `getBriefingForDate`. The dashboard renders:
- A greeting header ("Caring for [Patient Name]" + today's date)
- A stat card row (Life Facts, People, Events, Photos, Pending Review — the last highlighted in red when > 0)
- A **Dashboard** section: a hero card for Tomorrow's Briefing (gradient background, live status badge — Not generated / Draft ready / Approved / Delivered — and a contextual CTA) plus action cards for Photos, People, Events, Memo's Notes, Review Queue, and Safety & Filters
- An **Add** section: Life Facts, People, Events
- An **Import** section: Calendar (Google Calendar OAuth2 + `.ics` file upload as fallback), Photos
- A **Settings & Tools** section: Life Facts, Set Up Their Login, Emergency Contact

**Shared `PageHeader` component.** `components/co-user/PageHeader.tsx` provides a consistent back-link, title, optional subtitle, and action slot for all co-user sub-pages.

**Plan for remaining milestones:**
- **M2 — Onboarding wizard**: multi-step flow (Create Profile → Life Facts → People → Events) shown when `userId` is null
- **M3 — People**: list view, add form, edit form
- **M4 — Life Facts & Events**: list views, add forms; Calendar import (Google OAuth2 + `.ics` upload)
- **M5 — Photos**: grid with status filters, web file-picker import with Supabase upload + AI pipeline
- **M6 — AI & Review**: Flag Queue, Memo's Notes (AI Memory), Briefing Preview with generate/edit/approve
- **M7 — Settings**: Sensitivity Filters, Set Up Their Login, Emergency Contact

### Next Steps
- Continue building co-user portal milestones M2–M7 in order
- All nav cards on the dashboard link to routes that don't exist yet — each milestone fills them in
- Test the role-routing end-to-end: co-user login → dashboard; patient login → kiosk home

---

## June 1, 2026 (continued)

### Mobile App — Add & Import Screen Redesign

The six "Add & Import" screens on the co-user side were redesigned to match the motion-study design handoff (`memoria-motion.html`, "Add & Import" group). All Supabase logic, navigation, and permissions handling were preserved; only the visual layer changed.

A new shared primitives file `apps/mobile/src/screens/couser/FlowLayout.tsx` was created with reusable components used across all six screens: `FlowNav` (circular back + close icon buttons, replacing the old text-link "← Back / ✕" header), `FlowHeader` (title in `colors.fg` + subtitle in `#9a9ab0` muted purple, replacing the old large lavender title), `FocusField` (text input with a 2px purple border + soft shadow glow on focus, replacing plain flat inputs), `AddRow` (field + circular purple add button in a flex row), `FactChip` (card with lavender bullet dot + text + red close icon, replacing the old simple pill), `ObCheck` (circular checkbox, filled purple + white check icon when selected), `FlowButton` (shimmer primary action button via the existing `ShimmerButton`), `SectionCard` / `SectionTitle` (sunken `#22223a` card for inline form sections), `AddSubButton` (deep-purple secondary button for "Add this person" / "Add this event"), and `TypeSegment` (segmented control for event type).

`AddLifeFactsScreen` was updated to use the new nav, header, `AddRow`, `FactChip` chips (with lavender bullet and animated leave), and a shimmer "Save N facts" / "Skip for now" button. `AddPeopleScreen` was updated so added people render as gradient `Avatar` circles (using the existing `Avatar` from `motion/ui`) plus a green `check` icon instead of the old left-bordered purple cards; the form card uses `SectionCard`; key facts use inline flex-wrap chips; the "Add this person" button includes the `addPerson` icon. `AddEventsScreen` was updated so added events keep the left-border style but with tightened dimensions; the form card uses `SectionCard`; the type selector uses `TypeSegment`; the "Add this event" button includes the `add` icon.

`ImportContactsScreen` was restructured with a fixed header (FlowNav + FlowHeader + select-all/count toolbar) above the existing `FlatList`. Each row now shows a gradient `Avatar` circle, name, phone or italic "Already imported" in lavender, and a circular `ObCheck`. Selection is shown as a persistent `borderWidth: 2` that transitions from transparent to purple — no layout shift. The `ShimmerButton` import action is pinned at the bottom and appears when any contacts are selected. The standalone "Cancel" text link was removed (the back button handles cancellation). `ImportPhotosScreen` was similarly restructured: fixed header above the 3-column `FlatList` grid, 3px purple border + top-right `check` overlay circle on selected tiles, `ShimmerButton` at bottom. `ImportCalendarScreen` was restructured with a fixed header + toolbar; each event row now shows a 44×44 sunken day-abbreviation chip (MON/TUE/WED etc., lavender 12px bold) instead of a plain date, plus `ObCheck` and the same inset-border selection pattern, and `ShimmerButton` at bottom.

All six screens were TypeScript-clean and the full test suite (140 tests) passed.

### Mobile App — Monorepo Metro Fix

The app was crashing on launch after the W1 monorepo conversion with `TypeError: Cannot read property 'useState' of null`. Root cause: the three workspaces pinned different React versions (`apps/mobile@19.1.0`, `apps/kiosk@19.2.4`, `packages/core@*`), so npm installed three separate React copies (`19.1.0`, `19.2.4`, `19.2.6`) — one per workspace. Metro bundled the mobile app's React for app files and the workspace-root React for `packages/core` files (resolved via the symlink's real path), producing two live React runtimes. The `AuthContext` hooks crossing the boundary triggered the dispatcher mismatch.

Two fixes were applied. First, `packages/core/package.json` moved `react` from `dependencies` to `peerDependencies: ">=18"` so core no longer triggers a separate React install. Second, `apps/mobile/metro.config.js` replaced the `extraNodeModules` approach (which doesn't intercept symlinked workspace packages) with a `resolver.resolveRequest` hook that intercepts every Metro module lookup for `react`, `react/jsx-runtime`, `react/jsx-dev-runtime`, `react-native`, and `react-native-reanimated` and hard-routes them to `apps/mobile/node_modules`. This ensures a single React runtime regardless of where in the monorepo the importing file lives.

### Next Steps
- Verify the Metro fix resolves the startup crash on the iOS simulator end-to-end
- Continue building co-user portal milestones M2–M7 in order
- Test the mobile app's Add & Import screen redesign on device once the simulator is working

---

## June 3–4, 2026

### Planning — Voice Navigation, Proactive Engagement, and a Restructured Plan

Two new themes were added to `LLM-plan.md` (bumped to v1.1). **Theme K — Voice-Triggered Navigation Agents** reframes navigation as a first-class agentic capability: instead of pattern-matching nav commands, the assistant calls a `navigate_to` tool and the kiosk routes to a screen (e.g. "show me pictures of Maria" → photo gallery filtered by Maria). It specifies a `navigation` field on the `ask-assistant` response envelope, the new tool schema, and the kiosk screens needed (PhotoBrowse, Calendar, Person). **Theme L — Proactive Engagement & Ambient Presence** addresses the single most important product gap: memory-care patients forget the device exists, so Memo must initiate contact. It defines five layers — scheduled calendar-driven nudges, idle-state suggestions, daily "This Day in Your Life" memory surfacing, emotional check-ins, and re-engagement after long silence — plus the supporting schema (`daily_nudges` table, `co_users.proactive_settings`) and a new `generate-nudge` Edge Function. The roadmap tables gained a medium-term Navigation & Engagement track (items 15–22) and four new guiding principles (navigation-is-a-tool, proactive-presence, grounded-content, Memo-speaks-first).

`plan.md` was fully restructured around the current reality of the project: a **voice-first web kiosk** (Alexa/Nest-Hub-like) for the patient plus the preserved React Native mobile app for the co-user, sharing one AI/data layer. The rewrite captures the founding design constraint — *the patient should not have to USE anything; Memo speaks to them first, reactive chat is secondary* — and lays out the two-experience model, the full architecture, a completed/in-progress/upcoming feature roadmap, pending actions, and a concrete immediate build order. Four new co-user features were folded into the M2–M7 milestone plan: **primary-contact** flagging on people, **recurring-event** support (discovered to already exist in the schema as `event_type` + `recurrence_rule` — UI-only work), **bulk document & image upload**, and a **"Write About Them"** freeform narrative that the AI uses for RAG the way an LLM uses a context `.md` file.

### "Write About Them" + Document/People/Events Data Layer

The full backend for the narrative and document features was built and verified behind the green gate (147 tests: 123 core + 24 kiosk; tsc clean across all three workspaces). **No UI was built and nothing was deployed** — this is plumbing the M2 wizard will sit on top of.

**Migrations** (in `supabase/`, written but not yet applied to the live project):
- `add_primary_contact.sql` — `people.is_primary_contact boolean` (metadata-only add, no table rewrite) plus a partial index for "who are this patient's primary contacts?". Primary contacts will be surfaced first in briefings, always included in the emergency card, and prioritized by the nudge engine.
- `add_documents_and_narratives.sql` — four new **chunked** RAG tables: `documents` + `document_chunks` and `user_narratives` + `narrative_chunks`. Unlike the four core tables (which embed a single vector on the row), these split one logical source into many embedded chunks. Each chunk table has a `vector(1536)` embedding with an **HNSW** index (chosen over IVFFlat because the chunk tables grow incrementally and stay small per-user, where IVFFlat's fixed lists hurt recall) and a generated `fts` tsvector column via a new `memoria_chunk_fts` immutable function (mirroring the `add_hybrid_search.sql` pattern). RLS mirrors the established co-user/self pattern. Both retrieval RPCs — `match_memories` (dense) and `match_memories_hybrid` (dense + lexical RRF) — were extended with `documents` and `narrative` UNION arms and now include both kinds in their default `p_kinds` lists. The `events` table needed **no** migration: it already carries `event_type` (`one_time`/`recurring`/`routine`) and `recurrence_rule`; recurrence is purely a UI-exposure task for M4.

**Edge Function** — `supabase/functions/process-narrative/index.ts`: accepts `{ user_id, raw_text }`, upserts the raw narrative, deletes and re-creates `narrative_chunks` (paragraph-first, sentence-fallback chunker → batch-embed → insert), and runs a second LLM call with strict **Structured Outputs** to extract suggested people, life facts, events, and sensitivity hints. The suggestions are **returned for co-user review, never auto-written** to core tables — preserving the safety rule that AI never populates patient-facing data without human verification. Extraction is best-effort (RAG storage succeeds even if extraction fails).

**Shared core** (`packages/core/`):
- Split the kind types: `EmbeddingKind` stays the four write-path tables (embedded on the row via `embedAndStore`); a new `SearchKind` superset adds `documents` + `narrative` for the read path. `MemoryMatch.kind`, `SearchMemoriesOpts.kinds`, and `DEFAULT_KINDS` were widened to the six read kinds, so client searches now include narrative + documents by default.
- New `narrative.ts` client wrapper (`getNarrative`, `saveNarrative` returning the suggestions envelope) + `index.ts` export + `narrative.test.ts` (7 tests). The `embeddings.test.ts` default-kinds assertion was updated to the new six-kind contract.

**Live assistant wiring** — `ask-assistant/index.ts`: the mirrored `search_memories` tool definition (enum + description) and the hardcoded kinds fallback were updated to include `documents` and `narrative`, so once redeployed Memo actually retrieves the narrative and documents (the RPC default alone wasn't enough because the Edge Function passes an explicit fallback array).

### Repo Restructure — supabase/ Moved to Root

The shared backend folder was moved from `apps/mobile/supabase/` to the **repo root** `supabase/` (sibling to `apps/` and `packages/`). It had been buried under one app despite being shared by both. Root is the Supabase CLI's expected location (deploys run from root with no `--workdir`) and makes every existing reference correct — `CLAUDE.md`, `LLM-plan.md`, and code comments already wrote the path root-relative as `supabase/functions/...`. The dead `"exclude": ["supabase/functions"]` was removed from `apps/mobile/tsconfig.json`, and the `.gitignore` temp rule was repointed to `/supabase/.temp/`. As a cleanup bonus, the CLI `.temp/` state files (which had been accidentally tracked) are now untracked at the new path while remaining on disk for CLI use.

### Flags for Next Session
- **M2 is the next build** — the co-user onboarding wizard (Create Profile → **Write About Them** + extraction-review UI → Life Facts → People → Events). This is where the narrative backend becomes visible/usable. Sonnet-appropriate UI work.
- **Nothing is deployed.** The two migrations must be pasted into the Supabase Dashboard → SQL Editor, and `process-narrative` + `ask-assistant` must be deployed via `npx supabase functions deploy <name>` from the repo root (no global `supabase` CLI on this machine). Recommendation: build M2 first, then deploy once and test end-to-end, rather than poking the backend blind.
- **Document _processing_ is not built** — only the `documents`/`document_chunks` tables exist. The document-ingestion Edge Function (M5) has an open decision: how to extract text from PDFs/DOCX inside a Deno runtime (a JS PDF lib via esm.sh vs. images+plaintext-only for v1 vs. an external parser). Ask before building.
- **Rotate the `service_role` key** — still outstanding from the May 30 / June 1 flags; do it before any real deploy.
- HNSW indexes require pgvector ≥ 0.5 (Supabase has it); the documents/narratives migration creates only new tables + replaces two functions, so it does **not** trigger the heavy IVFFlat rebuild / `maintenance_work_mem` issue the hybrid-search migration hit.

### Next Steps
- Build co-user portal **M2** (onboarding wizard incl. "Write About Them" + extraction review), then deploy the data layer and test the narrative flow end-to-end in the web-app
- Continue M3 (people + primary-contact toggle), M4 (life facts + recurring events UI), M5 (photos + document upload — resolve the Deno extraction decision first), M6 (flag queue, Memo's Notes, briefing preview), M7 (settings + proactive config)
- Then the parallel kiosk track: `navigate_to` tool + PhotoBrowse/Calendar/Person screens, and the Layer-1 proactive nudge engine

---

## June 8, 2026

### Model Selection Rules — CLAUDE.md

A model selection guide was added directly to `CLAUDE.md` so it's always in context at the start of every session. Rules cover Haiku/Sonnet/Opus/Ultracode tiers, Memoria-specific assignments (portal screens → Sonnet, Edge Function changes → Opus, etc.), and a mid-implementation interrupt rule requiring a model-switch flag when a task turns safety-critical or architecturally novel mid-build.

### Co-User Portal — M2 Onboarding Wizard

A full 5-step onboarding wizard was built at `/co-user/onboard` for new co-users who haven't yet set up a patient profile.

**Steps:**
1. **Profile** — creates the `users` row (patient) + `co_users` row (linking co-user's auth), calls `setUserId()` to update auth context. Fields: full name, DOB, location, relationship, emergency phone.
2. **Story ("Write About Them")** — freeform narrative textarea → `saveNarrative()` → `process-narrative` Edge Function → suggestion review panel with checkboxes for people, life facts, events, and sensitivity hints (hints shown as informational only, not auto-saved). Accepted items inserted + embedded immediately.
3. **Life Facts** — chip-based builder with enter-key support. Saves + embeds each fact.
4. **People** — name + relationship form with avatar initials. Saves + embeds.
5. **Events** — title + date + one-time/recurring/routine type selector. "Finish Setup" saves and redirects to dashboard.

`CoUserHomeClient` updated to redirect to `/co-user/onboard` (via `useRouter`) when `userId` is null, replacing the dead "Account setup needed" message. All steps except Profile are skippable. 147 tests passing, TypeScript clean.

### Vercel Deployment

The kiosk web app was deployed to Vercel. Root `vercel.json` configures the monorepo build: `npm install --legacy-peer-deps` from root, `npm run build --workspace=apps/kiosk`, output from `apps/kiosk/.next`.

**Deployment issue resolved:** React couldn't be found during the Vercel build because npm workspace hoisting placed React@19.2.4 (kiosk) and React@19.1.0 (mobile) in separate workspace-local `node_modules` directories that Vercel's environment doesn't create. Fixed by adding `react` and `react-dom` as direct dependencies of the root `package.json` and adding `overrides` to pin both to `19.2.4`, guaranteeing React is at root `node_modules` where Next.js can find it.

**Live URL:** https://memoria-web-seven.vercel.app  
**Vercel project:** `alex-pravias-projects/memoria-web`  
**Future deploys:** `npx vercel --prod` from repo root.

### Flags for Next Session
- `AudioUnlockGate` remount bug still open (re-shows on hard reload within same session) — low priority
- The onboard wizard step 2 ("Write About Them") accepted events have no date from the narrative extraction — they default to today. Co-user should be able to edit dates after setup via M4 (Events screen).
- The Vercel project is named `memoria-web-seven` — rename in Vercel dashboard → Project Settings → General if a cleaner URL is wanted.

### Next Steps
- **Test the live deployment end-to-end:** sign in as a co-user, run through the M2 wizard (profile → story → facts → people → events), verify dashboard loads with correct stats, confirm the narrative was processed and suggestions appeared correctly.
- Continue building M3 (people list + add + primary-contact toggle), M4 (life facts list + recurring events UI), M5 (photos + document upload), M6 (flag queue, Memo's Notes, briefing preview), M7 (settings + proactive config).
- Kiosk track (parallel): `navigate_to` tool + PhotoBrowse/Calendar/Person screens, Layer-1 proactive nudge engine.

---

## June 9, 2026

### Co-User Portal — M3–M7 Complete

All remaining co-user portal screens were built, completing the full management dashboard for caregivers. Each route follows the established pattern: a `page.tsx` server component wrapping a `Suspense` boundary + a `*Client.tsx` client component. All data writes call `embedAndStore` after insert to keep RAG current.

**M3 — People (`/co-user/people`):** list with gradient-initial avatar circles, sensitive chip indicator, edit and delete actions. `/co-user/people/add` — form with full name, relationship, phone, email, emotional notes, and key facts chips (enter-to-add). `/co-user/people/[id]/edit` — same form pre-populated, with is_sensitive toggle.

**M4 — Life Facts & Events:** `/co-user/life-facts` — list with lavender bullet dots and delete. `/co-user/life-facts/add` — bulk entry: type + Enter to build a list, then save all at once; category chip selector (Career/Family/Hobby/Health/Education/Home/Travel/Other). `/co-user/events` — split into Upcoming/Past sections, date chip (month abbrev + day number), type badge (One-time/Recurring/Routine). `/co-user/events/add` — title, description, date picker, event type buttons, recurrence select. `/co-user/calendar/import` — `.ics` file parser (splits on VEVENT, extracts SUMMARY/DTSTART), filters to ±1 month → +3 months window, checkbox selection UI.

**M5 — Photos (`/co-user/photos`):** grid with filter tabs (All/Verified/Pending) using live counts. Status dot per tile (green = verified, yellow border = pending). Inline lightbox: fixed overlay, img contain, verify/mark-pending/hide action buttons. `/co-user/photos/import` — drag-drop zone + multi-file input, per-file upload to Supabase Storage `photos` bucket, then `processPhotos()` from `@memoria/core` for AI pipeline. Status tile per file (uploading/processing/done/error).

**M6 — AI & Review:** `/co-user/flags` — Supabase join query (`flag_queue → media`), Supabase returns joined media as an array, normalized to single object with `Array.isArray` guard. Approve/Reject/Hide buttons; approve → sets `media.verification_status = 'verified'`; reject/hide → `'hidden'`. Reviewed items shown/hidden toggle. `/co-user/memory` — uses `listMemoriesForCoUser`, `updateMemoryStatus`, `deleteMemory` from core; filter chips by MemoryKind (observation/preference/recurring_question/emotional_state/factual_correction); pin/suppress/restore/delete actions with importance dots (1–5). `/co-user/briefing` — today/tomorrow date toggle, `getBriefingForDate` + `resolveSlidePhotos`, generate/regenerate buttons, slide viewer with dot nav, photo display, tts_text in italic, approve button calls `approveBriefing(briefing.id, coUserId)` (both args required — caught via TS check).

**M7 — Settings:** `/co-user/filters` — inline add form with type selector (topic/person/time_period), value input, optional date range for time_period; direct CRUD on `sensitivity_filters`. `/co-user/emergency-contact` — updates `co_users.phone`. `/co-user/setup-login` — creates patient auth account via `supabase.auth.signUp`, updates `users.auth_id`, warns if credentials already exist.

### Co-User Portal — Write About Them & Documents

Two additional portal pages were built and the dashboard was updated to link to them.

**`/co-user/story`** — standalone "Write About Them" narrative editor. Loads the existing narrative via `getNarrative(userId)` on mount. Large textarea for freeform prose. "Save & Process" calls `saveNarrative(userId, text)` which invokes the `process-narrative` Edge Function (chunk → embed → extract suggestions). On success, shows a tabbed suggestions panel: People / Life Facts / Events / Sensitivity. Each suggestion has an "Add" button that promotes it directly to the corresponding database table with embeddings. Promoted items show a green "Added ✓" state. The editor tracks dirty state (save button disabled when unchanged).

**`/co-user/documents`** — document list. Queries the `documents` table for the user, shows status badges (pending/processing/processed/failed), file type, size, date, and AI-generated summary when available. Delete button marks `processing_status = 'hidden'`. Links to upload page.

**`/co-user/documents/upload`** — drag-drop file uploader with per-file pipeline: upload to Supabase Storage `documents` bucket → insert `documents` row (status: processing) → extract text client-side → chunk into ~500-char segments → embed each chunk via `embed` Edge Function → insert `document_chunks` rows → mark processed. Text extraction is v1 (not long-term — see `future-implementations.md`): `.txt` files read via `FileReader`, `.pdf` via dynamically-imported `pdfjs-dist` (digital PDFs only; scanned PDFs yield no text and are stored without chunks), images and other formats stored with a note in the summary. `pdfjs-dist@4.x` added to `apps/kiosk/package.json`; worker loaded from CDN to avoid SSR issues.

**Dashboard updated:** "Write About Them" (`notes` icon) and "Documents" (`tip` icon) cards added to the Dashboard section of `CoUserHomeClient.tsx`. Memo's Notes card icon changed to `sparkle` to distinguish it from the narrative card.

**`future-implementations.md`** — new "Document Text Extraction — v1 Limitations" section documenting the current approach (txt direct, pdfjs for digital PDFs, images/scanned stored without text) and the correct long-term fix: a `process-document` Edge Function that handles async extraction + OCR via vision API.

**Storage:** The `documents` Supabase Storage bucket must be created manually (Storage → New bucket → name: `documents`, public: true) — it is not created by the SQL migration.

### Flags for Next Session
- `process-narrative` Edge Function and the updated `ask-assistant` still need to be deployed to the live Supabase project — the narrative save UI will call them but they won't work until deployed.
- `add_primary_contact.sql` (is_primary_contact column on people) has not been confirmed deployed — check before building primary-contact UI.
- Rotate the Supabase `service_role` key — still outstanding from May 30 / June 1 flags.
- Document upload uses the client-side `documents` bucket; ensure RLS policies allow co-users to upload (currently RLS on the `documents` table exists but storage bucket policies are not yet written).

### Next Steps
- Deploy `process-narrative` and updated `ask-assistant` Edge Functions so the Story page works end-to-end.
- Test the complete co-user portal end-to-end on the live Vercel deployment.
- Kiosk patient track: `navigate_to` tool + PhotoBrowse/Calendar/Person screens (Sonnet).
- Layer-1 proactive nudge engine — `generate-nudge` Edge Function (Opus required).
