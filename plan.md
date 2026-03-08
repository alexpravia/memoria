# Memoria — Development Plan

---

## Core Concept

A real-time context generator that fills in the gaps of memory for people with Alzheimer's, dementia, and other memory impairments. The app combines a co-user's emotional intelligence with AI processing to build a personal database of the user's life — their identity, relationships, routines, and memories — and uses that database to keep them connected to reality every day.

---

## Core Principles

1. **Simplicity above all.** Every screen, interaction, and word must be as simple as possible. The user has memory problems — complexity is the enemy.
2. **Aid, not cure.** We help people live better with memory loss. We are not a medical treatment.
3. **It is a spectrum.** A cognitive level system adapts the experience to the user's degree of impairment.
4. **Nothing reaches the user without verification.** All AI-processed content is flagged for co-user review before the user ever sees it.
5. **Audio-first.** Listening is easier than reading. The app should be usable passively through voice.
6. **Human + AI together.** The co-user provides emotional context and oversight. The AI handles data processing, organization, and delivery.

---

## Architecture

- **Frontend:** React Native (cross-platform, iOS priority)
- **Backend:** Supabase (Postgres database, auth, file storage, edge functions, real-time sync)
- **AI Services:**
  - Facial recognition (photo tagging)
  - Speech-to-text (journal transcription)
  - Text-to-speech (briefings, conversations)
  - NLP/LLM (summarization, conversational AI, document/photo recognition and sorting)
- **Integrations:** Google Photos, iCloud, Facebook, Contacts, Calendar (Phase 1 stretch / Phase 2)

---

## Two-UX Model

### User Experience
- Simple, calming, audio-driven
- Large buttons, one thing on screen at a time
- Cool purple color scheme
- Minimal reading required — the app speaks to them
- Conversational AI they can ask questions to

### Co-User Experience
- Management dashboard
- Upload and organize data (photos, events, contacts, facts)
- Review AI-flagged items (verification queue)
- Set sensitivity filters (people, topics, time periods to avoid)
- Receive notifications (flags, mood alerts, daily summaries)
- Monitor user's experience to make sure everything is going smoothly

---

## Data Model

### User Profile
- Name, photo, DOB, location
- Key life facts ("You retired from teaching in 2015")
- Cognitive level (set and adjusted by co-user)
- Preferences (audio speed, text size, language)

### People
- Name, relationship to user, photo(s), contact info
- Key facts about them
- Emotional notes from co-user ("user loves talking about fishing with this person")
- Sensitivity flags ("avoid mentioning health issues with this person")

### Media
- Photos/videos with metadata: who's in it, when, where, description
- Verification status: pending, verified, hidden
- AI-generated tags and facial recognition data

### Events
- Past events (what happened, who was there, how user felt)
- Future events (appointments, birthdays, plans)
- Recurring routines (daily, weekly)

### Journal Entries
- Raw audio recordings timestamped throughout the day
- AI-generated transcription
- AI-generated daily summary
- User's end-of-day recall attempt (recorded and transcribed)
- Co-user review status

### Co-User
- Linked to user, relationship, permissions
- Notification preferences
- Sensitivity filters (people, topics, time periods to hide across all features)
- Flag review queue

### Pinned Notes ("Things I Want to Remember")
- User-initiated voice notes stored as pinned items
- Rotated into briefings
- Co-user can review/manage

---

## Sensitivity Layer

A centralized system in the co-user dashboard where they can define boundaries for the AI:
- **People to avoid:** "Don't show anything with Uncle Robert"
- **Time periods to avoid:** "Skip anything from 2019"
- **Topics to avoid:** "Don't mention the hospital"
- These filters apply globally — briefings, conversations, journal recaps, "This Day in Your Life", everything
- The AI checks against these filters before surfacing any content

---

## Development Phases

### Phase 0: Project Setup & Foundation
- Initialize React Native project
- Set up Supabase (database, auth, storage)
- Define and create database schema (all tables above)
- Set up co-user and user auth flows (two roles, one app)
- Basic navigation structure (user mode vs. co-user mode)

### Phase 1: MVP — Morning Briefing + Co-User Onboarding

**Co-User Onboarding Flow:**
- Input user's core identity (name, photo, DOB, location, life facts)
- Add family members / important people (names, photos, relationships, notes)
- Upload photos → AI processes (facial recognition, tagging, sorting)
- Add events (past, future, recurring)
- Review AI-flagged items (verification queue)
- Set sensitivity filters
- Connect existing services (Google Photos, iCloud, Contacts, Calendar) — stretch goal

**Morning Briefing ("Start My Day"):**
- One button to begin
- Full audio + visual briefing:
  1. "Good morning [name]. Today is [day, date]."
  2. "You live in [location] with [family member(s)]."
  3. Key identity facts
  4. Family photos with names/relationships
  5. Yesterday's recap
  6. Past week highlights
  7. Things they love / things that make them happy
  8. Personal pinned notes ("things you wanted to remember")
  9. Today's schedule
  10. Tomorrow + rest of the week preview
  11. "This Day in Your Life" — surfaced only from verified, sensitivity-checked content
- User can pause, replay, skip sections
- After briefing: conversational AI available for questions ("Who is Maria?", "What am I doing Thursday?", "When is my grandson's birthday?")

**Gentle Reminders Throughout the Day:**
- Spaced nudges, not just one morning dump
- "This afternoon you have a doctor's appointment at 3"
- "Tonight your son David is coming for dinner. Here's a photo of David."

**Emergency Context Card:**
- Quick-access screen (lock screen widget or persistent button)
- Shows: name, address, emergency contact, condition
- Available even when confused or away from home

### Phase 2: "Tell Me About Your Day"
- Voice journaling: user taps mic anytime to record a thought/moment
- AI transcribes and timestamps each entry
- End of day recall exercise:
  1. AI asks: "Can you walk me through what you did today?"
  2. User recalls what they can (recorded and transcribed)
  3. AI compares recall vs. actual journal entries
  4. AI fills in the gaps: "You also mentioned you went to the garden this afternoon"
  5. Full day summary generated and stored
  6. Summary feeds into tomorrow's briefing
- Co-user gets notified to review the summary
- Mood/tone awareness: AI flags if user sounded distressed, confused, or unusually quiet → co-user notified

**"Things I Want to Remember":**
- User says "remember this" at any point
- AI stores it as a pinned note
- Pinned notes rotate into briefings
- Co-user can review and manage

### Phase 3: Expanded Features
- **Cooking/Activity Assist:** voice-activated step tracker, reminds user what they've already done, alerts to turn off appliances
- **Brain Stimulation:** simple games, daily trivia, news readouts, stories, articles
- **Photo Exploration:** "Show me my family" → scrollable, audio-described gallery
- **Familiar Voice Option:** co-user records key phrases in their own voice for briefings and reminders
- **Reminders & Safety:** medication, appliance shutoffs, appointment alerts

### Phase 4: Polish & Future
- Refine cognitive level system (adapts UI complexity, briefing depth, interaction style)
- Co-user analytics dashboard (is recall improving? declining? mood trends?)
- Multi co-user support (multiple family members managing one user)
- Community features (connect users, support groups — with careful safety/moderation)
- Accessibility pass (vision impairment, motor issues, hearing impairment)
- Explore hardware integrations (interactive mirror, smart glasses) once app is solid

---

## Immediate Next Steps

1. ~~Document the plan~~ ✅
2. Initialize React Native project with TypeScript
3. Set up Supabase project and define database schema
4. Build co-user onboarding flow (identity input, people, photo upload)
5. Build AI photo processing pipeline (facial recognition, tagging, flagging)
6. Build co-user verification queue
7. Build the "Start My Day" briefing screen with TTS
8. Test with real data, simplify UI relentlessly

---

## Name Ideas

*(TBD)*
