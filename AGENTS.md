# Memoria — Agent Context

## Previous Thread References
These threads from a previous account contain the full history of work on this project:
- **T-019cca95-4554-73bc-a109-791746791d53** — Project details formatting and overview
- **T-019ccaea-c2a6-7322-a6b2-33ea3934864e** — Med-tech VC investment evaluation of Memoria
- **T-019ccae3-e981-71fb-bd6a-77f4bd1ab557** — Committed `details.md` update (generic "tablet", visual accessibility note)
- **T-019ce8b8-8008-729c-9344-35b6c75b8099** — Full review of Memoria context, implementation status, and recent fixes
- **T-019cef56-210d-70e9-b449-ab86ab5b8ee0** — Photo intelligence pipeline: full AI photo processing (upload, vision analysis, tagging, flag queue, assistant context, chat display, briefing integration) + emergency card bug fix

## Project Overview
Memoria is a real-time context generator that helps people with Alzheimer's, dementia, and other memory impairments stay connected to reality. It combines a co-user's (caregiver/family) emotional intelligence with AI processing to build a personal database of the user's life and deliver it back to them daily.

## Tech Stack
- **Frontend:** React Native (Expo SDK 54) with TypeScript
- **Backend:** Supabase (Postgres, Auth, Storage, Edge Functions)
- **AI:** OpenAI `gpt-4o-mini` via Supabase Edge Function (`ask-assistant`), provider-agnostic service layer (`src/lib/assistant.ts`)
- **TTS:** `expo-speech`
- **Device APIs:** `expo-contacts`, `expo-calendar`, `expo-media-library`, `expo-notifications`
- **LLM Config:** Swappable via env vars: `LLM_API_URL`, `LLM_API_KEY`, `LLM_MODEL`

## Two-UX Model
- **User (patient):** Simple, calming, audio-driven experience. Large buttons, minimal reading, TTS reads everything aloud. Cool purple color scheme.
- **Co-User (caregiver):** Management dashboard with onboarding, data entry, sensitivity filters, flag queue, and import tools.

## Database Schema (11 tables in Supabase Postgres)
1. `users` — Patient profile (identity, cognitive level, preferences)
2. `life_facts` — Key identity facts
3. `co_users` — Caregivers linked to patients
4. `people` — Important contacts with relationships and emotional notes
5. `media` — Photos/videos with AI metadata
6. `media_people` — Junction table for facial recognition tagging
7. `events` — Past, future, and recurring schedule items
8. `journal_entries` — Voice recordings and transcriptions
9. `daily_summaries` — AI-generated daily recaps
10. `pinned_notes` — "Things I want to remember" voice notes
11. `sensitivity_filters` — Boundaries to hide distressing content

## Current Status (as of March 14, 2026)
**Phases 0 through 1C are complete, plus the photo intelligence pipeline.** The app has:
- Role-based auth (user vs co-user)
- Co-user onboarding (life facts, people, events, device imports for contacts/calendar/photos)
- Co-user dashboard with tappable stat cards → view screens (ViewLifeFactsScreen, ViewPeopleScreen, ViewEventsScreen, ViewPhotosScreen)
- Sensitivity filters and flag/verification queue (enhanced with photo review UI)
- Conversational AI assistant with filtered context (now includes photo/media context)
- User home screen, morning briefing (TTS + slide animations + photo memories), emergency context card
- Push notifications for daily events
- **Photo intelligence pipeline**: Supabase Storage upload, AI vision analysis (`process-photo` Edge Function), auto-tagging, people identification, flag queue integration, inline photo display in chat, photo memories in briefing
- Back/Exit buttons on onboarding screens
- Duplicate import filtering with "Already imported" badges
- iOS photo `ph://` → `file://` URI fix
- Emergency card bug fix (removed invalid `phone` column query)

## Key Files
- `src/lib/assistant.ts` — AI context filtering and LLM calls
- `src/lib/notifications.ts` — Notification scheduling
- `src/screens/user/AssistantScreen.tsx` — AI chat interface
- `src/screens/user/BriefingScreen.tsx` — Morning briefing with TTS
- `src/screens/user/EmergencyCardScreen.tsx` — Emergency context card
- `src/screens/couser/CoUserHomeScreen.tsx` — Helper dashboard

## Development Phases
- **Phase 0:** ✅ Setup, Supabase, schema, auth, navigation
- **Phase 1A:** ✅ Auth, co-user onboarding, dashboard, device imports
- **Phase 1B:** ✅ User home, morning briefing, emergency card
- **Phase 1C:** ✅ Sensitivity filters, flag queue, AI assistant, notifications
- **Phase 2:** 🔜 "Tell Me About Your Day" — voice journaling, recall exercises, mood/tone awareness
- **Phase 3:** 🔜 Cooking assist, brain stimulation, photo exploration, familiar voice option
- **Phase 4:** 🔜 Cognitive level refinement, analytics, community, hardware exploration

## Important Context Files
- `details.md` — Full project vision and design philosophy
- `plan.md` — Detailed development roadmap and data model
- `progressLogs.md` — Chronological log of all completed work

## Instructions for Working on This Project
- Always read `progressLogs.md` before starting work to understand current status
- After completing work, append a dated entry to `progressLogs.md` documenting what was done
- Follow the existing code conventions in `memoria-app/`
- Keep the UI extremely simple — this is the #1 design rule
- Audio-first: anything shown to the user should also be spoken via TTS
- Safety-first: no AI content reaches the user without sensitivity filter checks
- The app source code lives in `memoria-app/`
