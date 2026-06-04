# Memoria — Product & Development Plan

*Last updated: June 3, 2026*

---

## What Memoria Is

Memoria is a **voice-first ambient companion** for people with Alzheimer's, dementia, and other memory impairments. It sits in their home like an Echo Show or Google Nest Hub — always on, always listening, always ready — but it knows their actual life: their family, their history, their routines, and their feelings.

It is not a generic assistant. It is a personal AI built from the co-user's (caregiver's) emotional intelligence and the patient's own life data. Every photo, every person, every event they've lived through is in Memoria's memory. Memo (the AI) can answer questions, surface memories, read briefings, navigate to content, and reach out to the patient throughout the day — gently, warmly, and accurately.

The product has two distinct experiences sharing one AI/data layer:
- **The Kiosk** — a voice-first web app for the patient. Alexa-like ambient device. Minimal UI, everything spoken.
- **The Mobile App** — a management dashboard for the co-user. Full-featured React Native app for caregivers.

---

## Core Principles

1. **Simplicity above all.** The patient has memory problems. Every screen, word, and interaction must be as simple as possible. When in doubt, remove it.
2. **Audio-first.** Listening is easier than reading. Everything shown to the patient should also be spoken. The device should be usable passively — eyes closed, hands free.
3. **Proactive presence.** Patients forget that tools exist. Memo must reach out to them — scheduled reminders, idle suggestions, memory surfacing — not just wait to be asked. The goal is ambient, continuous engagement.
4. **Show, don't just tell.** When the answer to a question is a photo or a screen, navigate there. "Show me pictures of Maria" should show pictures, not describe them.
5. **Nothing reaches the patient without verification.** All AI-processed content goes through the co-user before the patient sees it. Safety is non-negotiable.
6. **Faithfulness over helpfulness.** For a dementia patient, a hallucinated family fact is not a UX failure — it is a harm. Memo must only say things it can ground in real retrieved data.
7. **Human + AI together.** The co-user provides emotional context and oversight. Memo handles organization, retrieval, and delivery. Neither works without the other.
8. **It is a spectrum.** Cognitive levels adapt the experience to the patient's degree of impairment — simpler language, shorter briefings, more frequent nudges.

---

## Architecture

### Platform
- **Kiosk:** Next.js 15 App Router PWA (`apps/kiosk/`) — deployed to a browser on a fixed touchscreen device (laptop, Echo Show-equivalent). Voice loop with openWakeWord wake word, Web Speech STT, OpenAI TTS.
- **Mobile:** React Native (Expo SDK 54) (`apps/mobile/`) — co-user management app. iOS priority, Android supported.
- **Shared:** `packages/core/` — all AI, data, and auth logic shared between both apps via npm workspaces.

### Backend
- **Database:** Supabase Postgres with `pgvector` (1536-dim embeddings), RLS policies, real-time subscriptions
- **Auth:** Supabase Auth — two roles: `user` (patient) and `co_user` (caregiver), routed to separate UX
- **Storage:** Supabase Storage — photos bucket with public read, co-user-gated write
- **Edge Functions (Deno, 7 total):**
  - `ask-assistant` — agentic tool-calling loop (RAG + memory + navigation tools)
  - `generate-briefing` — nightly AI slide deck + daily nudge schedule generation
  - `process-photo` — vision pipeline (description, tags, people, review flag)
  - `check-sensitivity` — intent-aware sensitivity classifier
  - `embed` — text-embedding-3-small proxy
  - `tts` — OpenAI TTS nova voice (raw audio bytes)
  - `generate-nudge` — (planned) proactive idle/memory/check-in message generator

### AI Stack
- **LLM:** `gpt-4o-mini` (real-time: assistant, sensitivity, nudges) / `gpt-4o` (async: briefings, vision)
- **Embeddings:** `text-embedding-3-small` (1536-dim)
- **TTS:** OpenAI `tts-1` with `nova` voice — LRU disk cache, 5s fallback to `expo-speech` (mobile) / Web Speech (kiosk)
- **Retrieval:** Dense pgvector + BM25 hybrid (Reciprocal Rank Fusion), similarity floor 0.65, top-5 injection
- **All provider-agnostic** — model, URL, key all via env vars; swap without code changes

---

## The Two Experiences

### Kiosk — Patient UX

The patient's device is always on. It sits in their home and knows their life.

**Passive (no interaction needed):**
- Morning briefing auto-starts (or speaks a welcome when they approach)
- Scheduled nudges fire throughout the day based on their calendar and co-user config
- Idle-state suggestions: after 3-5 minutes of silence, Memo gently offers something ("Here's a photo from last Christmas")
- Memory surfacing: once daily, Memo shares a "This Day in Your Life" moment
- Evening wrap-up: a brief "here's what happened today" before bedtime

**Active (voice or tap):**
- "Hey Memo" wake word → voice query → spoken answer
- "Show me pictures of Maria" → Memo navigates to photo gallery filtered by Maria
- "What's on my schedule today?" → Memo navigates to calendar view and reads events
- "Tell me about my grandson" → Memo navigates to person profile and reads it aloud
- "Play my briefing" → briefing auto-advances with TTS
- "I want to remember this" → Memo stores a pinned note
- "Who is that?" (about a photo on screen) → Memo describes it

**Design rules:**
- One thing on screen at a time. No menus. No lists longer than 5 items.
- Large text. High contrast. Full audio on everything.
- Every navigation has a "go back" (voice or tap) and a "read it to me" option.
- Memo never pressures. If the patient ignores a nudge, Memo returns to idle silently.

### Mobile App — Co-User UX

The caregiver's management hub. Used daily to keep Memoria accurate and the patient safe.

**Dashboard:** Stats (life facts, people, events, photos, pending reviews), quick actions, briefing status, tomorrow's briefing CTA.

**Data management:** Add/edit life facts, people (with editing for imported contacts), events. Import from contacts, calendar, photos. Bulk AI re-tag.

**AI management:** Memo's Notes (review/edit/pin/suppress Memo's persistent memories), Briefing Preview (generate/edit/approve tomorrow's briefing), sensitivity filters, flag review queue.

**Settings:** Emergency contact, set up patient login, notification preferences, proactive engagement settings (which layers are on, what times).

---

## Feature Roadmap

### Completed — Mobile App (Phase 0 – 1C + AI Migration)
- Role-based auth, two-UX navigation
- Co-user onboarding: life facts, people, events, device imports (contacts, calendar, photos)
- Patient experience: morning briefing, emergency card, AI assistant ("Memo")
- AI photo pipeline: vision description, tags, people ID, review flag, verified gallery
- Semantic sensitivity classifier (intent-based, not keyword-based)
- Agentic Memo: RAG tool loop, 8 tools, conversation persistence, inline photos
- Persistent assistant memory (Memo's Notes, co-user review)
- AI-orchestrated briefings (6-12 slides, TTS pipeline, approval workflow)
- Hybrid retrieval (dense + BM25 + RRF), similarity floor, structured outputs
- Groundedness checking, output sensitivity re-check, conversation traces
- Design system: theme tokens, custom SVG icon set, motion primitives
- 140 unit tests, TypeScript clean

### Completed — Kiosk W1 + W2
- Next.js 15 monorepo, shared `@memoria/core` package
- Voice loop: openWakeWord (ONNX pipeline), Web Speech STT, state machine (idle→wake→listen→think→speak→idle)
- AudioUnlockGate, VoiceOrb animated UI, spacebar PTT fallback
- Auto-advance briefing with TTS, prewarm, voice commands (next/again/stop)
- Text chat assistant with TTS
- Sign-in gate, role-based routing (patient → kiosk, co-user → portal)
- Co-user portal M1: dashboard (stat cards, briefing status, all nav actions)

### In Progress — Kiosk Co-User Portal (M2–M7)

- **M2** — Onboarding wizard: Create Profile → Write About Them → Life Facts → People → Events
- **M3** — People: list, add, edit; **primary contact flag** (surfaces first in briefings, always in emergency card, prioritized in nudges)
- **M4** — Life Facts & Events: list, add; calendar import; **events support recurring flag + pattern** (daily/weekly/monthly/custom days — feeds proactive nudge scheduling)
- **M5** — Media & Documents: photo grid + **bulk document/image upload** (PDFs, Word, text, images); AI batch processes all — extracts text, chunks, embeds, adds to `match_memories` as a new `documents` kind
- **M6** — Flag Queue, Memo's Notes (AI Memory), Briefing Preview (generate/edit/approve)
- **M7** — Sensitivity Filters, Set Up Login, Emergency Contact, proactive engagement settings

#### "Write About Them" — Narrative Feature (new, part of M2 onboarding + standalone edit)

Co-user writes a freeform stream-of-consciousness about the patient — no structure required. Example: *"Mom loves gardening, she's done it since the 70s. Her husband Robert passed in 2021. She gets anxious about medical topics. Loves Elvis and Frank Sinatra. Every Sunday she'd cook Italian dinner for the whole family..."*

**Two things happen on save:**
1. **RAG source** — narrative is chunked at sentence/paragraph boundaries, each chunk embedded and stored as a new `narrative` kind in `match_memories`. Memo queries this as high-priority context — it carries emotional intelligence that structured tables can't.
2. **AI extraction** — a `process-narrative` Edge Function extracts structured suggestions: people mentioned (name, relationship, notes), life facts, recurring events, and sensitivity hints (topics/people the co-user signals to avoid). Suggestions are shown to the co-user for review (accept/reject per item, same pattern as flag queue). Accepted items insert into the proper tables.

The narrative remains fully editable at any time. Re-saving re-runs extraction and re-embeds.

#### Document & Image Upload — Schema Plan

```
documents         — file_url, file_type, processing_status, user_id
document_chunks   — document_id, chunk_index, text, embedding (1536-dim)
user_narratives   — user_id (unique), raw_text, last_edited_at
narrative_chunks  — user_id, chunk_index, text, embedding
```

Both `document_chunks` and `narrative_chunks` participate in `match_memories` via new kinds: `documents`, `narrative`.

#### People Schema Addition
```sql
ALTER TABLE people ADD COLUMN is_primary_contact boolean DEFAULT false;
```
Max 2-3 primary contacts enforced at app level. Primary contacts: always included in briefings, always in emergency card, prioritized in proactive nudges.

#### Events — NO migration needed (schema already supports recurrence)
The `events` table already has `event_type` (`one_time` | `recurring` | `routine`) and `recurrence_rule text`. Recurrence is already modeled — it's just not exposed in onboarding/UI. M4 work is purely UI: expose the `event_type` segmented control and a recurrence picker that writes `recurrence_rule` (convention: `weekly:monday,thursday` / `daily` / `monthly:15`). `routine` covers "things they do often." Recurring/routine events are the primary feed for Layer 1 proactive nudges.

### Next — Voice Navigation (parallel with M2–M7)
Voice-triggered navigation turns Memo from a chatbot into a navigator. When the user asks to SEE something, Memo calls a `navigate_to` tool and the kiosk routes there — no pattern matching, full AI understanding.

- `navigate_to` tool added to ask-assistant tool set (tools.ts + Edge Function)
- `navigation` field on ask-assistant response envelope
- kiosk `useVoiceLoop` reads navigation intent and fires React Router push
- **PhotoBrowseScreen** — filterable gallery (person, tags, date); each photo auto-captioned aloud
- **CalendarScreen** — week/day event list; events read aloud on entry
- **PersonScreen** — single person: photo, name, relationship, key facts, photos together; fully TTS'd

### Next — Proactive Engagement Engine
The biggest UX gap: patients forget Memo exists. The engagement engine closes this.

**Layer 1 — Scheduled nudges (highest priority)**
Nightly, `generate-briefing` also generates a `daily_nudges` schedule: timestamped messages tied to real events ("David is coming at 6 tonight"). Kiosk Supabase Realtime subscription fires TTS at the right time.

**Layer 2 — Idle suggestions**
After 3-5 minutes of kiosk silence, Memo surfaces something real from the database and speaks it gently. If ignored, returns to idle. Never repeats. Requires `generate-nudge` Edge Function.

**Layer 3 — Memory surfacing ("This Day in Your Life")**
Once daily (configurable time, e.g. 2pm), Memo surfaces a verified photo or event from past years on today's date. "Three years ago, you and Maria were at Thanksgiving. Here's a photo."

**Layer 4 — Emotional check-ins**
Once daily, Memo asks how the patient is feeling. Response logged, distress flagged to co-user. Seeds Phase 2 mood/tone awareness.

**Layer 5 — Re-engagement after long silence**
After 2+ hours of silence, soft chime + brief re-orientation: "Welcome back. It's 3 in the afternoon. I'm here if you need anything."

### Phase 2 — "Tell Me About Your Day" (Voice Journaling)
- Voice journaling: patient taps mic anytime to record a thought/moment
- AI transcribes, timestamps, and stores each entry
- End-of-day recall exercise: Memo asks "What do you remember from today?" → user recalls → Memo fills gaps
- Daily summary generated and fed into tomorrow's briefing
- Mood/tone awareness: distressed or confused voice patterns → co-user flagged
- "Remember this" pinned notes → rotate into briefings
- Voice-initiated from kiosk at any time

### Phase 3 — Expanded Capabilities
- **Cooking/Activity Assist** — voice-activated step tracker; "Did I add the salt?" → yes/no; alerts to turn off appliances
- **Brain Stimulation** — daily trivia, stories, news readouts, simple games calibrated to cognitive level
- **Familiar Voice Option** — co-user records key phrases; briefings and reminders use their voice instead of nova
- **Photo Exploration** — "Show me my family" → scrollable, auto-described gallery; navigate to any person
- **Multi-co-user support** — multiple family members linked to one patient, permissions-aware
- **Facial recognition** — AWS Rekognition replaces GPT vision guessing for people identification

### Phase 4 — Polish & Scale
- Cognitive level system: adapts briefing depth, language complexity, nudge frequency, interaction style
- Co-user analytics: recall trends, mood over time, engagement patterns, Memo usage stats
- Community features (carefully moderated): connecting patients, caregiver support groups
- Accessibility: vision impairment mode, motor-limited interaction, hearing impairment TTS adjustments
- Hardware: pitch to Amazon/Google for Echo Show / Nest Hub native integration; explore Rabbit R1-style dedicated hardware

---

## Pending Actions (before next session)

- Rotate Supabase `service_role` key (flagged twice — security critical before any production use)
- Verify Metro fix resolves iOS simulator startup crash (`resolver.resolveRequest` in `apps/mobile/metro.config.js`)
- Drop openWakeWord ONNX model files into `apps/kiosk/public/openwakeword/` + set `NEXT_PUBLIC_WAKEWORD_ENABLED=1` to go hands-free
- Realign Expo SDK 54 version drift (`npx expo install --fix -- --legacy-peer-deps`)
- `AudioUnlockGate` re-shows on hard reload — add `if (isAudioUnlocked()) setUnlocked(true)` mount effect

---

## Immediate Build Order

1. **DB migrations** — `is_primary_contact`, recurring event columns, `documents`, `document_chunks`, `user_narratives`, `narrative_chunks` tables; update `match_memories` RPC for new kinds
2. **`process-narrative` Edge Function** — chunk + embed narrative; extract people/facts/events/sensitivity suggestions; return structured suggestions for co-user review
3. **Co-user portal M2** — onboarding wizard: Create Profile → Write About Them (+ extraction review) → Life Facts → People → Events
4. **Co-user portal M3** — People list/add/edit with primary contact toggle
5. **Co-user portal M4** — Life Facts & Events with recurring event support
6. **Co-user portal M5** — Media & Documents: photo grid + bulk document/image upload + AI batch processing
7. **Co-user portal M6** — Flag Queue, Memo's Notes, Briefing Preview
8. **Co-user portal M7** — Settings + proactive config
9. **`navigate_to` tool** + PhotoBrowseScreen, CalendarScreen, PersonScreen
10. **Daily nudges** (Layer 1 proactive) — `daily_nudges` table + nightly generation + kiosk Realtime subscription
11. **Idle suggestions** (Layer 2) + `generate-nudge` Edge Function
12. **Phase 2** — voice journaling
