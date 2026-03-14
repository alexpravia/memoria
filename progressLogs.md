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
