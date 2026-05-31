# Memoria — Web App & Hardware Vision Plan

**Written:** May 30, 2026  
**Author:** Alex Pravia  
**Purpose:** Strategic plan for pivoting Memoria from a mobile app to a voice-first web app, with the goal of demoing it as a smart-speaker-style device and pursuing hardware partnerships with Amazon, Google, or Apple.

---

## The Core Idea

Memoria is being rebuilt as a **voice-first web application** — not a traditional "website," but a screen + microphone experience designed to sit on a counter and talk to you, the way an Alexa or Google Home does.

The immediate goal is to demo this on a laptop: the laptop becomes the hardware prototype. Memo speaks back through the speakers. The user speaks to Memo through the microphone. The screen shows context visually when helpful. Everything is driven by voice.

The long-term goal is a hardware device — purpose-built for dementia and Alzheimer's patients — that runs this same software. To get there, the plan is to build the software layer so well that Amazon, Google, or Apple want to put it on their hardware.

---

## Why Web, Not Mobile

Mobile is the wrong form factor for this population.

- A phone is small, easily lost, requires fine motor control (tapping, scrolling), and demands sustained visual attention.
- The App Store creates a distribution barrier — co-users have to download it, users have to find it, iOS/Android fragmentation adds maintenance overhead.
- A person with dementia waking up confused at 2am is not going to unlock their phone, find the app, open it, and navigate to Memo. But they might speak to a device that is always on and always listening on their nightstand or kitchen counter.

A web app accessed from a fixed screen — a tablet mounted on the wall, a smart display on the kitchen counter, a laptop in the living room — removes every one of those friction points.

**Web also helps the co-user side.** Managing photos, life facts, people, and sensitivity filters is dramatically easier on a full web browser than on a mobile screen. Co-users are typically on a computer. Meeting them where they are is a UX win.

---

## The Demo Strategy: Your Laptop as an Alexa

Before hardware exists, the demo IS the laptop.

The pitch is: "This is what Memoria looks like running on a dedicated device. The device is just a screen with a microphone and speakers. Right now that device is my laptop."

**What makes this real:**

- Chrome's Web Speech API (SpeechRecognition) handles push-to-talk or always-listening voice input — no native code needed.
- The existing OpenAI TTS (`nova` voice) works natively in a browser: fetch the audio bytes, play through Web Audio API. Memo's voice is identical to what's in the mobile app.
- For a proper "Hey Memo" wake word (no button press required), Picovoice Porcupine has a WebAssembly SDK that runs entirely in the browser. This is the technical piece that makes the laptop feel like an Alexa — the wake word detection runs locally, then routes to Memo.
- The screen can go into a "passive mode" showing the time, user's name, and a soft ambient display — exactly like an Echo Show.

**Demo flow:**
1. Laptop is sitting on a desk. Screen shows: *"Hi [Name]. Good morning."*
2. Visitor says: "Hey Memo, who is Maria?"
3. Memo speaks: "Maria is your daughter. She lives in Miami and calls you every Sunday. Here's a photo of her."
4. Photo of Maria appears on screen.

That is a fundable demo.

---

## Why This Is the Right Path to Hardware Partnerships

Amazon, Google, and Apple are not going to build a dementia care software layer. That is too niche, too clinically sensitive, and requires the kind of family/caregiver emotional intelligence that big tech companies are bad at.

What they will do is **partner with or acquire** a software company that has a proven product, a user base, and a working AI system — and put it on their hardware distribution at scale.

The pitch to Amazon: "Memoria is Alexa for Alzheimer's patients. We've built the AI, the caregiver workflow, the safety layer, and the voice interaction. You have 100 million Echo devices in homes. Put us on Echo Show and we reach the exact population that needs this most."

The pitch to Google: same, with Nest Hub.

The pitch to Apple: Apple Health + iPad + HomePod is the premium version — a family buys their parent an iPad or HomePod running Memoria.

None of those conversations can happen from a mobile app. They can happen from a voice-first web app with a working hardware demo.

---

## What Doesn't Change

The entire backend stays the same:

- **Supabase** (Postgres, auth, storage, RLS) — no change.
- **All Edge Functions** — `ask-assistant`, `generate-briefing`, `process-photo`, `check-sensitivity`, `tts`, `embed` — no change.
- **Memo's AI layer** — RAG pipeline, pgvector, tool-calling loop, persistent memory, sensitivity classifier — no change.
- **The two-UX model** — patient (user) and caregiver (co-user) — no change.
- **The data model** — all 15+ tables — no change.
- **The LLM-plan.md improvements** — all still apply, all still valuable.

The pivot is **frontend only**. The AI infrastructure, the database, and Memo's intelligence are already built for this.

---

## What Changes on the Frontend

### User Experience (Patient Side)

The patient-facing UI becomes a **kiosk-mode web app**:

- Runs full-screen in a browser, no browser chrome visible.
- Designed for a fixed screen — 10–15 inch display on a counter or wall mount, not a handheld phone.
- Primary input: **voice**. "Hey Memo" → wake → speak → Memo responds.
- Secondary input: large tap/click targets for people who prefer touch.
- The existing screens (Briefing, Emergency Card, Assistant chat) translate directly to web — they become larger, more ambient, less "app-like."
- Morning briefing auto-starts or is triggered by voice: "Hey Memo, good morning."
- Emergency card is always one voice command away: "Hey Memo, who am I?"

### Co-User Experience (Caregiver Side)

The co-user dashboard becomes a **standard web dashboard**:

- Accessible from any browser, any device (laptop, phone, tablet).
- Device imports (contacts, calendar, photos) move to:
  - **Photos:** File upload + Google Photos OAuth + iCloud link.
  - **Contacts:** vCard file import (`.vcf`) or Google Contacts OAuth.
  - **Calendar:** `.ics` file import or Google Calendar OAuth.
- Everything else (life facts, people, sensitivity filters, flag queue, Memo's Notes, Briefing Preview) works better on web than mobile — more screen space, easier data entry.

### Code Architecture

Expo already supports web export (`npx expo export --platform web`). The existing React Native codebase is the starting point — not a full rewrite. Key adaptations needed:

- Replace `expo-audio` with Web Audio API for TTS playback.
- Replace `expo-speech` fallback with browser `speechSynthesis`.
- Replace device import screens with file upload + OAuth flows.
- Add Picovoice Porcupine web SDK for wake word detection.
- Add Web Speech API (SpeechRecognition) for voice input.
- Add a "kiosk mode" layout for the patient-facing screens.
- Style changes: larger type, more ambient spacing, designed for a fixed display.

React Native's component model (View, Text, StyleSheet, etc.) compiles to web via React Native Web. Most of the existing UI components work. The main effort is audio and device APIs.

---

## Phased Roadmap

### Phase W1: Web Foundation

**Goal:** The existing app running in a browser, co-user flow fully functional on web.

- Export existing Expo app to web.
- Fix audio: replace `expo-audio` with Web Audio API for TTS.
- Replace device import screens with file upload alternatives.
- Verify the full co-user flow works: onboarding, photo import, flag queue, sensitivity filters, briefing preview.
- Verify Memo chat works in browser (text input, photo rendering, TTS playback).
- Deploy to a real URL (Vercel, Netlify, or Cloudflare Pages — all free tier).

### Phase W2: Voice-First Interaction

**Goal:** Memo can be fully controlled by voice. No keyboard required for the patient.

- Add Web Speech API voice input to the assistant screen.
- Add push-to-talk button as the primary input method (simpler, more reliable than always-on).
- Add "Hey Memo" wake word via Picovoice Porcupine WebAssembly SDK.
- Auto-play TTS on Memo's responses (already works in mobile, wire it to web audio).
- Add voice commands for navigation: "Hey Memo, start my day" → briefing, "Hey Memo, go home" → home screen.
- Briefing becomes fully voice-driven: auto-starts, reads slides, listens for "next" / "repeat" / "stop".

### Phase W3: Kiosk Mode

**Goal:** The patient-facing experience looks and behaves like a dedicated device.

- Full-screen kiosk layout (no browser chrome, no URL bar).
- Passive/ambient home screen: clock, user's first name, soft background — visible when idle.
- Auto-lock to patient view (no way to accidentally navigate to co-user dashboard from patient mode).
- Optimize for 10–15 inch fixed display (iPad size, Echo Show size).
- Add "always listening" mode toggle (co-user can enable/disable Porcupine wake word).
- Add offline resilience for briefings (cache today's briefing locally so it plays even if internet drops).

### Phase W4: Hardware Demo Polish

**Goal:** A demo that is indistinguishable from a purpose-built device.

- Build a small physical enclosure OR identify an off-the-shelf smart display (Amazon Echo Show 10, Google Nest Hub Max, iPad with a stand) as the reference hardware.
- Document the "Memoria on Echo Show" setup story for the partnership pitch.
- Record a 3-minute demo video showing the full flow: morning briefing, emergency card, photo recall, family conversation.
- Prepare the investor/partner deck: the problem, the solution, the demo, the ask.

---

## The Hardware Partnership Pitch

**Target partners (in order of fit):**

1. **Amazon** — Echo Show is already a smart display designed for ambient home use. Alexa's healthcare ambitions (medication reminders, fall detection) are adjacent but don't include memory care. Memoria fills that gap. Distribution: 100M+ Echo devices.

2. **Google** — Nest Hub Max has a screen, camera, and is frequently in kitchens and living rooms — exactly where dementia patients need help. Google Health is an existing platform. Google also has strong interest in aging-in-place technology.

3. **Apple** — The premium play. iPad + HomePod + Apple Health as a combined package. Apple already markets to seniors and caregivers. Higher price point, more privacy-conscious users, smaller but more premium distribution.

4. **Dedicated hardware** — If partnerships don't materialize quickly, a purpose-built device is viable. A simple ARM board (Raspberry Pi or similar), a 10-inch display, a microphone array (like what Echo uses), and a speaker — running a Chrome kiosk pointing at the Memoria web app. Bill of materials under $150 at scale.

**What makes the pitch work:**

- A live demo that proves the software works.
- Verified user stories (real families, real patients, real use).
- The safety layer (sensitivity filters, co-user verification, groundedness checking from LLM-plan.md) — this is what sets Memoria apart from a general-purpose voice assistant. It was built specifically for a cognitively impaired user with a caregiver oversight model.
- The AI pipeline (RAG, persistent memory, AI briefings) — this is not "Alexa with a medical plugin." It is a purpose-built memory care AI.

---

## What This Means for the Existing Mobile App

The mobile app code is not abandoned — it becomes the foundation of the web app via Expo Web. The investment in the AI pipeline, the database schema, the Edge Functions, and the two-UX model is fully preserved.

Mobile remains relevant as a secondary access point:
- Co-users can manage their loved one's data from their phone.
- The patient-facing mobile app can stay available for families who prefer it.
- But the primary demo, the product story, and the investor pitch are all web + hardware.

The shift from "mobile-first" to "voice-first web" doesn't erase the work — it redirects it toward a more natural form factor for the population Memoria serves.

---

## Why This Works

The deepest insight behind this pivot: **a phone is a personal device designed for one person who is cognitively intact.** Memoria's user is neither. They may share a living room with a caregiver. They may not remember how to unlock their phone. They may drop it, lose it, or be afraid of it.

A device that sits on the counter, is always on, and responds to their voice is fundamentally different. It removes every barrier between the person and the help they need. That is what Memoria should be — not an app you open, but a presence in the room.

The web app makes that demo possible today. The hardware partnership makes it real at scale.

---

*End of web-app-plan.md — v1.0, May 30, 2026*
