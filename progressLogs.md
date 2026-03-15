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
