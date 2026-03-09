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

### Next Steps
1. Fix the small kinks in the device import screens
2. Build **Phase 1C** — conversational AI so the user can ask questions about themselves, sensitivity filters for the co-user to set boundaries on what the AI can surface, a verification queue for reviewing flagged content, and push notifications for gentle reminders throughout the day
3. Begin **Phase 2** — voice journaling and the end-of-day recall exercise
4. Set up proper **photo uploads to Supabase Storage** so media persists across devices instead of referencing local file paths
