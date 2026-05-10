# Memoria — Progress Logs

---

## March 8, 2026

### Project Foundation
- Created the **memoria** GitHub repository at github.com/alexpravia/memoria to house the entire project
- Wrote **details.md**, which documents the full project vision — what Memoria is, who it helps, the core principles (simplicity, audio-first, aid not cure), feature ideas like the cooking function and "Tell Me About Your Day", and general design philosophy
- Wrote **plan.md**, a detailed development roadmap that breaks the entire project into four phases, covering everything from the data model and tech stack to the order features should be built
- Installed a reusable **committing-and-pushing** skill so future commits can be handled quickly

### Phase 0: Project Setup
- Initialized the mobile app using **React Native with Expo SDK 54 and TypeScript** — this means one codebase that works on both iOS and Android, and it's running and testable on a real phone through Expo Go
- Set up a **Supabase** account and project to handle the backend — this gives the app a real Postgres database, user authentication, and file storage without needing to build a server from scratch
- Designed and deployed the **full database schema** — 11 tables that cover every data type the app needs: user profiles, co-users, people in the user's life, photos/videos, events, journal entries, daily summaries, pinned notes, sensitivity filters, and a flag queue for co-user review
- Built out **TypeScript types** matching every database table so the codebase is type-safe and catches errors during development instead of at runtime
- Built the **two-experience navigation system** — the app routes you to a completely different experience depending on whether you're logging in as the user (patient) or the helper (co-user)

### Phase 1A: Authentication & Co-User Onboarding
- Built **login and signup screens** with real authentication powered by Supabase — accounts are created, sessions persist, and logging out works properly
- Built a **four-step co-user onboarding flow** that walks the helper through setting up their loved one's profile: entering their name/DOB/location, adding life facts they should be reminded of, adding important people with relationships and emotional notes, and adding events and routines
- Built the **co-user dashboard**, which shows live stats (how many life facts, people, and events have been added) and provides quick-access buttons to add more data at any time
- Built the **"Set Up Their Login"** screen, which lets the co-user create email/password credentials for the patient so they can log into their own experience — and it does this without logging the co-user out of their own session
- Built three **device import screens** — Import Contacts pulls from the phone's contact list and lets the co-user select which people to bring in, Import Calendar grabs events from the past month through three months ahead, and Import Photos opens a grid-style photo picker to select memories to add to the database. All three handle permissions, let you pick and choose what to import, and save directly to Supabase

### Phase 1B: User Experience
- Built the **user home screen** with two large, simple buttons — "Start My Day" to begin the morning briefing and "Who Am I?" for the emergency context card
- Built the **morning briefing screen**, which pulls the user's profile, life facts, people, and events from the database and presents them one slide at a time with large text. Each slide is read aloud using text-to-speech, and the user can go forward, go back, or replay any slide with simple controls and a progress bar at the top
- Built the **emergency context card**, which displays the user's name, where they live, and their emergency contact in large, clear text — designed to be pulled up quickly if the user is confused or disoriented

---

## March 9, 2026

### Phase 1C: AI & Safety Layer

- Built the **sensitivity filters screen** — the co-user can now define boundaries for what the AI is allowed to show or mention, with three filter types: specific people to avoid, topics to avoid (like "the hospital" or a person's name), and entire time periods to skip. These filters apply globally across the entire app — briefings, the AI assistant, and any future features. Filters are listed with delete capability, and each one can include a note explaining why it was set
- Built the **verification / flag queue screen** — a review interface where the co-user can see all AI-flagged items that need approval before they reach the user. Each item shows its type (media, person, event, journal, mood) with a description, and the co-user can approve, reject, or hide it. Previously reviewed items are shown separately. The co-user dashboard now displays a red badge with the count of pending items
- Built the **conversational AI assistant** — the user can now tap "Ask Me Anything" from the home screen and ask questions about themselves, their family, or their schedule in a simple chat interface. The assistant pulls the user's profile, life facts, people, and events from the database, strips out anything blocked by sensitivity filters, and sends the filtered context to an LLM with a system prompt that enforces warmth, simplicity, and honesty. Responses are displayed in large text bubbles and read aloud automatically using text-to-speech
- Built the **AI service layer** (`assistant.ts`) with a provider-agnostic architecture — the context-fetching, sensitivity filtering, and prompt building all happen on the client, and the actual LLM call goes through a single function that can be swapped to any provider without touching the rest of the codebase. Currently uses OpenAI's `gpt-4o-mini` through a Supabase Edge Function, but changing to a self-hosted model later only requires updating three environment variables (`LLM_API_URL`, `LLM_API_KEY`, `LLM_MODEL`)
- Built and deployed the **Supabase Edge Function** (`ask-assistant`) — a serverless function that proxies requests to any OpenAI-compatible LLM API. It accepts a question and system prompt, calls the model, and returns the answer. Deployed to Supabase's edge network and confirmed working with real queries
- Built the **push notification system** — when the user opens the app, it requests notification permissions and automatically schedules local reminders for all of today's events. Each event gets two notifications: one an hour before and one at event time. Notifications include the event title and description, and all previously scheduled notifications are cleared and rescheduled fresh each time the app opens to avoid duplicates
- Reorganized the **co-user dashboard** with a new "Safety & Settings" section that groups the review queue, sensitivity filters, and login setup together, with distinct color-coded accents (red for safety features, purple for imports)

---

## March 13, 2026

### Bug Fixes & UX Improvements (Co-User Side)

- Made the **stat cards tappable** — tapping Life Facts, People, or Events now opens a dedicated **view screen** that lists everything that's been saved, instead of going straight to the "add" form. Each view screen shows the data in styled cards and has an "Add More" button at the bottom
- Created **ViewLifeFactsScreen**, **ViewPeopleScreen**, **ViewEventsScreen**, and **ViewPhotosScreen** — four new screens that let the co-user review all the data they've entered at a glance
- Added a **Photos stat card** to the dashboard alongside the other three, showing the total number of imported photos. All four stat cards now sit in a single row
- Added **← Back and ✕ Exit buttons** to the Life Facts, People, and Events onboarding screens — the co-user is no longer forced to step through all three screens linearly and can go back or exit to the dashboard at any time
- Fixed the **Import Photos crash** — the app was using `ph://` URIs from the iOS photo library, which React Native can't render. Now resolves each photo to a `file://` local URI using `getAssetInfoAsync` before displaying
- Fixed **duplicate imports** — the Import Contacts and Import Calendar screens now show already-imported items dimmed with an "Already imported" badge instead of hiding them. New items appear at the top and remain fully selectable
- Added a **"Grant Access to More Contacts"** button to the Import Contacts screen that opens iOS Settings, so the co-user can expand contact access beyond the initial limited selection (iOS defaults to "Limited Access" for contacts)
- Added a **permission denied screen** for contacts — if access was denied, the screen now shows a clear message with an "Open Settings" button instead of just an alert
- Changed the **"Set Up Their Login"** button to dynamically show **"Set Up Another User"** if a login has already been created, by checking the `auth_id` field on the user profile

### Bug Fixes & UX Improvements (User Side)

- Fixed the **emergency card text overflow** — long emergency contact names now auto-shrink to fit on one line using `adjustsFontSizeToFit` instead of wrapping awkwardly
- Added **emergency contact phone number** display to the "Who Am I?" screen, shown in purple below the contact name and relationship
- Added an **exit button (✕)** to the morning briefing screen so the user can close it at any time without stepping through every slide
- Added **slide-in animations** to the morning briefing — each slide's text now fades in and floats up over 600ms, making the experience feel smoother and less abrupt. TTS triggers as the animation plays

### Infrastructure

- Resolved Expo tunnel mode setup by installing `@expo/ngrok` locally with `--legacy-peer-deps` to bypass peer dependency conflicts
- Removed accidental `react-dom` and `react-native-web` dependencies and the `"web"` config from `app.json` after a failed web support install broke the build

### Next Steps
1. Continue **testing and fixing bugs** across both the co-user and user experiences
2. Verify all import flows work correctly end-to-end on a real device
3. Test the full user journey — login, briefing, emergency card, and AI assistant

---

## March 14, 2026

### Photo Upload to Supabase Storage

- Modified **`ImportPhotosScreen.tsx`** to upload photos to Supabase Storage (bucket: `photos/{userId}/`) instead of saving local `file://` URIs — photos are now accessible via public URLs from any device and can be analyzed by AI
- Added upload progress display ("Uploading 3 of 10...") during the import process

### AI Vision Edge Function (`process-photo`)

- Created a new **Supabase Edge Function** (`process-photo`) that accepts a photo URL and the user's known people list, calls the AI vision model (same provider-agnostic setup as `ask-assistant`), and returns structured JSON: a warm description, category tags, identified people with confidence levels (high/medium/low), and a review flag with reason
- Deployed to Supabase via `npx supabase functions deploy process-photo`

### Post-Import Processing Pipeline

- Created **`src/lib/photoProcessing.ts`** — after photos are uploaded and inserted into `media`, this utility calls the `process-photo` Edge Function for each photo, then writes results back to the database: updates `media` with description and `ai_tags`, inserts `media_people` rows with numeric confidence scores (high=0.9, medium=0.7, low=0.3), creates `flag_queue` entries for photos needing review, and auto-verifies photos where all people are high-confidence
- Wired into **`ImportPhotosScreen.tsx`** — processing runs automatically after import with progress display ("Analyzing photo X of Y...")

### Flag Queue — Photo Review with AI Suggestions

- Enhanced **`FlagQueueScreen.tsx`** to handle `flag_type = 'media'` items with a rich review UI — when a media flag is displayed, it now shows the actual photo (fetched from `media.file_url` via `reference_id`), the AI-generated description, and all tagged people with color-coded confidence badges (green for high, orange for medium, red for low)
- Added **cascading approval/rejection logic** — when a co-user approves a media flag, it updates `media.verification_status` to `'verified'` and sets all `media_people` rows for that photo to `verified = true`; when rejected or hidden, it sets `media.verification_status` to `'hidden'`
- Previously reviewed media flags now show a small photo thumbnail for quick reference
- Enhanced **`ViewPhotosScreen.tsx`** with verification status badges on each photo: ✓ (green) for verified, ⏳ (orange) for pending, 🚫 (red) for hidden
- Added a **filter toggle bar** at the top of the photos grid with three options — "All", "⏳ Pending", and "✓ Verified" — each showing a count, so the co-user can quickly find photos that still need review

### AI Assistant — Photo/Media Context

- Updated **`assistant.ts`** to include verified photo metadata in the AI context, so the assistant can now answer questions like "Show me photos of Maria" or "Do I have pictures from Christmas?"
- Added a `media` array to the **`UserContext` interface** containing photo ID, URL, description, tags (from `ai_tags` JSONB), taken date, and tagged people names
- Added a **media query** in `getUserContext()` that fetches up to 50 most recent verified photos from the `media` table, joins `media_people` with `people` to resolve tagged person names, and applies full sensitivity filtering — excludes photos linked to filtered person IDs, photos with descriptions containing filtered topics, and photos taken during filtered time periods
- Added a **PHOTOS & MEMORIES** section to the system prompt in `buildSystemPrompt()` that lists each photo with its date, description, people, tags, and `[PHOTO:url]` reference for the LLM to use
- Updated **`askAssistant()`** to parse `[PHOTO:url]` markers from the LLM response, strip them from the text, and return them in a separate `photos` array on the `AssistantResponse` interface — this lets the UI render photos inline without raw URLs in the spoken text
- The `media_people` query is skipped when there are no media IDs to avoid unnecessary Supabase calls

### Photos in Chat UI

- Updated **`AssistantScreen.tsx`** to render photos inline in the chat — when the assistant references photos, they display as a horizontal scrollable row of 200×200 rounded images below the text bubble. TTS only reads the text, not photo URLs

### Photos in Morning Briefing

- Added a **"Recent Memories" section** to the morning briefing in `BriefingScreen.tsx` — after the people slides and before today's events, the briefing now shows up to 5 verified photos with AI-generated descriptions. Each photo gets its own slide with a warm intro ("Here's a memory", "A moment from your life", etc.), the description as the subtitle (read aloud via TTS), and the photo displayed using the existing circular image renderer
- Added **sensitivity filtering** to the memories section — fetches the user's sensitivity filters and excludes photos tagged with filtered people (via `media_people` join), photos with descriptions containing filtered topics, and photos taken during filtered time periods. Follows the same filtering pattern used in `assistant.ts`
- Added **photo fallback for people slides** — when a person's `photo_url` is null (common for imported contacts), the briefing now checks `media_people` for a verified, high-confidence (≥0.8) photo of that person and uses it as their slide photo. This means people imported from contacts can still show a face in the briefing if they've been tagged in a verified photo
- The memories section is fully optional — if no verified photos exist or all are filtered out, the section is silently skipped and the briefing flows naturally

### Bug Fix: Emergency Card Missing Contact Info

- Fixed **`EmergencyCardScreen.tsx`** — the query was selecting a `phone` column that doesn't exist on the `co_users` table, causing the entire emergency contact section to silently fail. Removed the invalid column from the query and added a fallback lookup to the `people` table's `contact_info` JSONB for phone numbers
- Fixed the pre-existing **TypeScript error** — removed invalid `minFontSize` style property from `contactValue` (the `adjustsFontSizeToFit` prop already handles this). Codebase now compiles with zero TypeScript errors

### Next Steps
1. **Test the full photo pipeline** end-to-end on a real device — import photos, verify AI processing runs, check flag queue, approve photos, confirm they appear in briefing and chatbot
2. **Deepen AI integration** beyond the chatbot — facial recognition accuracy, photo categorization refinement, and smarter context surfacing (e.g., "This Day in Your Life" photo memories, event-linked photos)
3. Continue testing and fixing bugs across both co-user and user experiences

---

## March 22, 2026

### Bug Fix: Photo Import RLS Error

- Diagnosed the **"new row violates row-level security policy"** error during co-user photo import — the co-user is authenticated with their own `auth.uid()`, but inserts into `media` with `user_id` set to the patient's UUID, which default RLS policies reject
- Created **`supabase/fix_rls_policies.sql`** — a safe-to-run migration that drops and recreates RLS policies for:
  - **`media` table** — INSERT, SELECT, UPDATE, DELETE policies allowing co-users to manage media for their linked patient (via `co_users.auth_id = auth.uid()`)
  - **`media_people` table** — INSERT policy so photo processing can tag people in the patient's photos
  - **`flag_queue` table** — INSERT policy so photo processing can create review items for flagged content
  - **`storage.objects` (photos bucket)** — INSERT and SELECT policies allowing any authenticated user to upload and read photos
- All policies use `DROP POLICY IF EXISTS` before `CREATE POLICY` for idempotent re-runs
- File is ready to run in the Supabase Dashboard SQL Editor

---

## April 6, 2026

### Co-User: People Editing + Emergency Contact Management

- Added full editing support for people (including imported contacts) by creating `EditPersonScreen.tsx` and wiring it into navigation and `ViewPeopleScreen.tsx`; co-users can now update name, relationship, key facts, emotional notes, phone, and email
- Added refresh-on-focus behavior to `ViewPeopleScreen.tsx` and `CoUserHomeScreen.tsx` so saved edits and updated stats appear immediately when returning to those screens
- Added `EmergencyContactSettingsScreen.tsx` and linked it from the co-user dashboard so the co-user can explicitly set and update emergency phone number at any time
- Updated onboarding (`CreateUserProfileScreen.tsx`) to collect emergency contact phone number at setup time

### User: Emergency Card + Briefing Photo Coverage

- Updated `EmergencyCardScreen.tsx` to read emergency phone/email directly from `co_users`, display phone above email, and keep a backward-compatible fallback to `people.contact_info.phone` only if needed
- Removed duplicate email rendering path in the emergency card flow so contact details appear once and in the intended order
- Expanded `BriefingScreen.tsx` slide photo assignment to ensure applicable slides have photos via verified fallback pools (including people and event-related sections)

### Photo Pipeline Reliability + Review Queue Hardening

- Hardened `photoProcessing.ts` so AI processing failures no longer silently stall: pending media now gets/keeps queue entries, metadata update failures are handled, and person-tag upserts are resilient
- Added retry processing for stuck pending photos via `reprocessPendingPhotos()` and wired a retry action into `ViewPhotosScreen.tsx`
- Added direct "Open Review Queue" action from pending photos UI to speed up manual verification workflow
- Improved `ImportPhotosScreen.tsx` post-import messaging so partial AI failures are surfaced to the co-user instead of appearing as silent success
- Strengthened `FlagQueueScreen.tsx` error handling for queue load and approve/reject/hide actions, with visible retry UI for failures

### Supabase SQL + Data Flow Updates

- Added `supabase/add_co_user_phone.sql` to add `co_users.phone` for emergency contact source-of-truth
- Added `supabase/fix_flag_queue_and_pending_backfill.sql` to harden RLS around `flag_queue`/`media_people` access and backfill missing pending queue records for pending photos
- Executed the SQL updates in Supabase and confirmed they are now in place for testing

### Validation

- Ran `npx tsc --noEmit` in `memoria-app` with no TypeScript errors

### Next Steps
1. Fully test everything end-to-end and do not move forward until everything works correctly.

---

## April 12, 2026

### Maestro iOS Smoke Test Stabilization

- Stabilized the **Expo Go Maestro wrapper** in `memoria-app/scripts/maestro-ios.sh` so each run terminates any stale Expo Go instance before reopening the local `exp://` URL on the booted iOS simulator
- Hardened the authenticated **Maestro login flows** for user briefing, user emergency card, and co-user smoke coverage so they now retry text entry, explicitly verify the email field actually contains the expected address, and avoid the earlier failure mode where the password was entered but the email field did not stick
- Added **Expo Go cold-start handling** to the Maestro flows so they can tap into the local app when the simulator shows the intermediate Expo app tile or open prompt
- Added **iOS system prompt handling** for the simulator's `Save Password?` sheet so it no longer blocks the login submit step during Maestro runs

### Maestro Flow Reliability Improvements

- Updated the **local login smoke flow** so it works reliably with fresh Expo Go launches and still verifies the Memoria login screen selectors are present
- Adjusted the **briefing, emergency card, and co-user smoke assertions** to use the selectors that consistently surface through Expo Go / Maestro on iOS, avoiding false negatives from nested React Native text nodes that were present on-screen but not exposed with the expected test IDs
- Removed an outdated **co-user save-success alert expectation** from the edit-person smoke flow and switched it to verify the real navigation behavior back to the people list after saving
- Documented the new **Maestro login stability behavior** in `.maestro/README.md`, including fresh Expo Go launches, explicit email verification, and dismissal of the iOS password-save sheet

### Validation

- Ran `npm run maestro:test` successfully in `memoria-app`
- Ran `npm run maestro:test:user:emergency` successfully in `memoria-app`
- Ran `npm run maestro:test:user:briefing` successfully in `memoria-app`
- Ran `npm run maestro:test:co-user` successfully in `memoria-app`

### Next Steps
1. Test everything end-to-end using Maestro.
2. Make everything look nice and function correctly.
3. Make the AI processing work correctly, with special emphasis on getting that pipeline fully reliable.

---

## May 10, 2026

### AI-Native Migration (Phases 0–E)

- Added **pgvector schema** (`add_embeddings.sql`) — `embedding`/`embedding_text`/`embedding_updated_at` columns on `media`, `life_facts`, `people`, and `events`, plus IVFFlat indexes and a `match_memories` RPC for unified semantic search across all four tables
- Created **`conversations` and `messages` tables** (`conversations_messages.sql`) with RLS so the assistant can persist multi-turn chat threads and tool-call records
- Created **`assistant_memory` table** (`assistant_memory.sql`) to store Memo's notes about the user (kind, content, importance, status) with importance-based auto-flagging
- Created **`briefings` table** (`briefings.sql`) for AI-generated daily slide decks (slides as JSONB, status workflow: `draft` → `approved` → `delivered`)
- Added **`sensitivity_decisions` cache table** and `intent_text`/`intent_embedding` columns on `sensitivity_filters` (`sensitivity_upgrade.sql`) to power intent-aware classification
- Added **`ensure_photos_bucket.sql`** to confirm the `photos` Storage bucket exists with public read access and the right RLS policies
- Built six Edge Functions (Deno):
  - **`embed`** — proxy for OpenAI `text-embedding-3-small`
  - **`check-sensitivity`** — intent-aware classifier using `gpt-4o-mini` to judge content against natural-language rules
  - **`ask-assistant`** — fully agentic tool-calling loop with conversation persistence, memory injection, and tool execution (`search_memories`, `get_person`, `list_events`, `get_life_facts`, `get_user_profile`, `remember_about_user`, `recall_about_user`, `flag_for_co_user`)
  - **`process-photo`** — AI vision pipeline (description + tags + people + needs-review flag)
  - **`generate-briefing`** — slide JSON generator with retry-on-invalid validation and a candidate photo pool
  - **`tts`** — OpenAI TTS proxy (`tts-1`, `nova` voice) returning raw audio bytes
- Added **client library modules** (`src/lib/`): `assistant.ts` (thin agentic wrapper), `tools.ts` (canonical tool definitions, mirrored in the Edge Function), `embeddings.ts` (RAG entry point), `sensitivity.ts` (fail-OPEN classifier wrapper), `memory.ts` (persistent notes), `briefing.ts` (generate/get/approve/validate/`resolveSlidePhotos`), `tts.ts` (OpenAI TTS with LRU disk cache + `expo-speech` fallback)
- Built **`AIMemoryScreen` ("Memo's Notes")** for co-users to review/edit/pin/suppress/delete Memo's persistent memories
- Built **`BriefingPreviewScreen`** for co-users to generate, edit, approve, and regenerate AI briefings, with a Today/Tomorrow date toggle for in-session testing
- Updated **`AssistantScreen`** for conversation threading (`conversationId`), "Memo" branding, and inline `PhotoLightbox` integration; system prompt now forbids markdown links / file paths / raw IDs in answers
- Updated **`BriefingScreen`** with an AI-orchestrated rendering path that falls back to the procedural builder when no approved briefing exists; pre-warms next-slide TTS for instant playback
- Added **`PhotoLightbox` + `usePhotoLightbox` + `PhotoTagsView`** components for full-screen photo viewing with description/tag/people overlays
- Migrated audio stack from **`expo-av` to `expo-audio`** (`createAudioPlayer` + `setAudioModeAsync` with `playsInSilentMode`/`shouldPlayInBackground`); removed all `expo-av` references
- Added **`expo-image-manipulator`** for HEIC→JPEG conversion during photo import
- Renamed the AI assistant to **"Memo"** across every user-facing string (button labels, greeting, screen titles, accessibility labels, system prompt identity); the project name "Memoria" stays in code/files

### Photo Pipeline Polish & Bug-Fix Waves

- Fixed **TTS empty-payload bug** by replacing `supabase.functions.invoke('tts')` with a direct `fetch()` against `${SUPABASE_URL}/functions/v1/tts` so binary responses are read via `arrayBuffer()` instead of being JSON-parsed and stripped
- Fixed **assistant photo-limit defaults** — `search_memories` now defaults to `limit:1` when the caller doesn't specify; system prompt explicitly distinguishes singular ("show me a photo" → 1) from plural ("show me photos" → 3-5)
- Hardened **`ImportPhotosScreen`** to hard-fail on upload errors (no more silent local-URL inserts) and validate the `http(s)` prefix before insert
- Hardened **`processPhoto`** with an early guard that refuses to send any non-`http` URL to the vision Edge Function and immediately marks the row hidden — eliminates the recurring "Edge Function returned a non-2xx status code" review-queue error caused by `file://` URIs
- Replaced the **photo verification logic** so a photo auto-verifies whenever `needs_review === false`, regardless of whether people are present; old logic required `people_identified.length > 0`, which forced every landscape/scenery/object photo into the review queue
- Rewrote the **`process-photo` vision prompt** to (a) require ONE short sentence (under 15 words) for the description with examples and a forbidden-paragraphs rule, (b) require 3–8 literal-content tags drawn from a wide vocabulary (landscapes, nature, objects, animals, etc.) with no empty arrays, and (c) only set `needs_review=true` for unidentified faces / sensitive content / very poor quality — explicitly NOT for photos with no people
- Made **`validateSlide`** tolerate any non-string `photo_id` (treats as missing) and made **`generate-briefing`** strip non-string `photo_id` shapes before validation; tightened the prompt schema to forbid arrays/objects/numbers/booleans for `photo_id`
- Made **`resolveSlidePhotos`** filter `verification_status='hidden'` rows at the query level and post-filter rows whose `file_url` isn't `http(s)` — slides referencing bad rows leave `photo_url` undefined so the renderer falls back gracefully
- Made **`BriefingScreen`** render a large 4:3 rectangular photo (replaces the 150×150 round avatar), self-heal on `<Image onError>` by returning `null`, and run a new `backfillPhotos` helper that fills missing `photo_url` values on `greeting`/`person`/`memory_photo` slides from a verified-recent-media pool plus the user profile photo
- Added **persistent assistant memory** wired end-to-end: Memo writes via `remember_about_user`, recalls via `recall_about_user`, co-user reviews/pins/suppresses/deletes in `AIMemoryScreen`; high-importance memories auto-flag for co-user review
- Added **AI-orchestrated briefings** end-to-end: the Edge Function gathers profile/events/memories/sensitivity rules/photo pool in parallel, prompts `gpt-4o-mini` for 6–12 ordered slides, validates server-side with retry-on-invalid, upserts on `(user_id, briefing_date)`, and persists with `status='draft'`; co-user previews/edits/approves; user-side `BriefingScreen` reads only `status='approved' | 'delivered'` rows and falls back to the procedural builder when nothing is approved

### Lightbox / Tap UX / Memo's Notes

- Replaced the **`PhotoLightbox`** layout with image-first design — the photo fills the screen via `resizeMode='contain'` (no `aspectRatio:1` cap, no `ScrollView`) and AI metadata overlays in a translucent **bottom-left** card with a top-left **ⓘ** toggle to show/hide
- Switched from **double-tap to single-tap** to enlarge — replaced `useDoubleTap` (300ms `useRef` threshold) with `useTapToOpen` (a thin `useCallback` wrapper, no timing) across `ViewPhotosScreen`, `FlagQueueScreen`, `BriefingScreen`, `AssistantScreen`, `BriefingPreviewScreen`
- Made the **lightbox tag overlay full-width** (left:16, right:16) instead of capped at 70%, removed the `numberOfLines={2}` description clamp so the full sentence wraps, bumped compact-mode font to 14px white, and increased padding so descriptions are no longer truncated with "…"
- Fixed the **lightbox tag slider** by replacing the wrapping `Pressable` with a `View` using `onStartShouldSetResponder={() => true}` and `onMoveShouldSetResponder={() => false}` — taps still don't dismiss the modal but the inner horizontal `ScrollView` now receives the pan gesture; added `showsHorizontalScrollIndicator={true}` in compact mode so the slider is discoverable
- Added **scroll affordance arrows** on the kind-filter row in `AIMemoryScreen` — ‹ / › chevrons appear/disappear based on scroll position and tap to scroll 120px in each direction

### Photo Storage Hardening & Cleanup Tooling

- Removed the **front-end auto-hide** behavior from `<Image onError>` in `ViewPhotosScreen` and `FlagQueueScreen` — the tile still hides locally on render failure, but no longer writes `verification_status='hidden'` to the DB; transient simulator/network blips were nuking perfectly good photos
- Extended **`repair-broken-photos.ts`** to detect 0-byte http uploads via HEAD requests (in addition to the existing `file://` detection); now also clears `ai_tags` and `description` when hiding a row so stale text can't leak into chat/briefings via search
- Added **`reprocessAllPhotos(userId)`** in `photoProcessing.ts` that resets every non-hidden http photo back to `pending`, clears stale AI metadata, and re-runs `processPhoto` — wired up to a new co-user **"Re-tag All Photos With AI"** button on `ViewPhotosScreen`
- Added **`scripts/reset-photos-for-retag.ts`** — standalone script (`--user <id> --apply`) that bulk-resets every non-hidden http photo for one user back to `pending`, clears `ai_tags`/`description`, and ensures a pending `flag_queue` row exists; mirrors the `repair-broken-photos.ts` pattern (env vars, dry-run by default, idempotent); shipped with a README documenting the cost implication

### Live DB Cleanup (Test User: 42cd6787-…)

- Ran **`repair-broken-photos.ts --apply`** against production: 4 legacy `file://` HEIC rows hidden (cleared `ai_tags` and `description` and pending flag-queue rows on the same operation)
- Identified and hid **5 zero-byte JPEG uploads** in the `photos` Storage bucket (HEIC→JPEG conversion silently failed during a prior import session, leaving empty objects that crashed the vision API with `invalid_image`)
- Restored **5 photos** that the old front-end onError self-heal had spuriously marked hidden during a flaky simulator session
- Drove a **CLI re-tag pass** through the redeployed `process-photo` Edge Function for all remaining pending photos: 5 verified with one-sentence descriptions and 5–8 literal-content tags each (e.g. "A serene misty landscape at dawn with distant trees", "A grand building with tall spires and a lush green lawn")
- Final live-DB state for Test User: **5 verified** (good photos with short descriptions and content tags) + **9 hidden** (4 file:// + 5 zero-byte) — gallery, review queue, briefings, and assistant chat all only see the 5 working photos

### Edge Function Deploys & Validation

- Deployed `process-photo` and `generate-briefing` Edge Functions to the live Supabase project (`zpxyqomebbjadqvgpapw`) multiple times across the day as the prompt and validation logic were refined
- Test suite now at **127 unit tests** across 7 files (`src/lib/{assistant,embeddings,tools,sensitivity,memory,briefing,tts}.test.ts`) — added 5 new tests for `validateSlide` non-string `photo_id` tolerance, plus 2 new tests for `resolveSlidePhotos` hidden + non-http filtering
- Wrote 5 AI eval JSON files (`tests/evals/`) for non-deterministic behavior coverage: assistant quality, sensitivity judgment, briefing quality, RAG recall, memory formation
- CI gate (`npx tsc --noEmit && npm test`) passing clean at end of session

### Flags for Next Session

- The front-end `<Image onError>` self-heal NO LONGER writes `verification_status='hidden'` to the DB — the only safety nets for broken photos are the `processPhoto` early guard (`file://` and other non-http URLs) and the `repair-broken-photos.ts` script (file:// + 0-byte detection). If a transient fetch failure ever leaves a good photo looking broken in the UI, the row is fine and reload will recover it
- Five zero-byte JPEGs survived in Storage from an older import session (HEIC→JPEG silent failure). Future imports go through hardened `ImportPhotosScreen` that hard-fails on upload error, but **monitor newly imported batches**; if more zero-byte rows appear, add an extra fetch+content-length check inside the import loop itself
- The `reset-photos-for-retag.ts` script does NOT unhide rows. If `onError` ever does hide a good photo (race during a script run), an admin needs to manually `update media set verification_status='pending' where ...` via SQL
- The lightbox tag-pan fix uses a `View + onStartShouldSetResponder=true / onMoveShouldSetResponder=false` pattern. If any other component embeds a horizontal `ScrollView` inside a touch responder, mirror this pattern or the pan will be intercepted
- Memo's chat (assistant) still has an outstanding behavioral issue the user wants addressed before Phase 2 — flagged below in Next Steps

### Next Steps

1. Test out the entire implementation fully end-to-end (co-user onboarding, photo import, AI re-tag, briefing generation/approval/delivery, assistant chat with photos and memory, sensitivity classifier, emergency card) and surface any remaining bugs.
2. Fix the outstanding issue with Memo's chat (the assistant) — investigate what's broken and resolve before any Phase 2 work begins.
3. Do NOT begin Phase 2 ("Tell Me About Your Day" — voice journaling, recall exercises, mood/tone awareness) until everything in Phase 1 works correctly.
4. After full end-to-end verification, consider running `repair-broken-photos.ts` on any other linked users to clean up legacy media.
5. Consider tightening the photo import flow with a post-upload size sanity check (`content-length > 0`) so the 0-byte HEIC→JPEG failure mode can never regress.
