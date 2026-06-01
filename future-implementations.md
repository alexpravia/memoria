# Memoria — Future Implementations

A running list of deferred features, improvements, and technical upgrades.
Add to this as new work is scoped and decisions are made.

---

## Voice & Wake Word

### Picovoice Porcupine — proper "Hey Memo" wake word
**Why deferred:** Picovoice Console requires a non-free-webmail email address at signup.
**What it gives:** on-device acoustic wake word (no audio to Google), lower false-trigger
rate, works offline, fires in ~100ms. The wakeword.ts interface is already designed to
accept any backend — Picovoice is a one-function swap.
**How to do it:**
1. Sign up at console.picovoice.ai with a custom-domain or .edu email (~$10/yr for a domain).
2. Build a "Hey Memo" keyword (Web/WASM target) in the Console → download `.ppn`.
3. `npm install --workspace=apps/kiosk @picovoice/porcupine-web @picovoice/web-voice-processor`
4. Rewrite `apps/kiosk/lib/voice/wakeword.ts` using `PorcupineWorker` + `WebVoiceProcessor`
   (the code from the first W2 implementation in git history is the reference).
5. Add `NEXT_PUBLIC_PICOVOICE_ACCESS_KEY` to `.env.local`.

### Hardware wake word (Echo Show / Nest Hub partnership)
At device-partnership scale, wake word moves off our code entirely onto the device's
dedicated DSP chip (Alexa Voice Service / Google Assistant SDK). Our app just handles
the "user is speaking to your app" intent. The rest of the voice loop stays identical.

---

## Mobile App — Phase 2: "Tell Me About Your Day"
Voice journaling, recall exercises, mood/tone awareness. Do not begin until
Phase 1 end-to-end is fully verified and stable.
- Voice journaling: patient speaks, transcript saved as a journal entry, embedded for RAG.
- Recall exercises: Memo asks simple questions ("Do you remember what you did yesterday?").
- Mood/tone awareness: classify emotional tone of patient responses, surface to co-user.

## Mobile App — Phase 3
Cooking assist, brain stimulation games, photo exploration mode, familiar voice option
(record a family member's voice to replace nova for TTS).

## Mobile App — Phase 4
Cognitive level refinement, analytics dashboard for co-users, community features,
hardware exploration.

---

## AI Pipeline — Phase 5 (LLM-plan.md)
Intentionally paused. Do facial recognition first (AWS Rekognition — the GPT
people-ID is a stub; the `media_people` schema is ready), then:
- `key_facts` chunking for better RAG recall on long life-fact entries
- LLM re-ranking of retrieved memories before injection
- Memory consolidation (merge/summarise Memo's assistant_memory notes over time)
- Document pipeline (upload PDFs — medical records, family histories)
- Familiar voice TTS (fine-tuned/cloned voice from recorded family audio)

---

## Kiosk — Deferred polish (from W2 adversarial review)

### True briefing pause/resume
Currently "Pause" restarts the slide from the beginning on "Play". True resume would
require saving playback position and adding `pause()`/`resume()` to `tts-web.ts`
(without clearing `audio.src`). For the patient audience, restart-from-start is
arguably acceptable. Revisit if co-users report confusion.

### AudioUnlockGate sessionStorage reconciliation
`AudioUnlockGate` ignores the `isAudioUnlocked()` sessionStorage flag on remount —
gate re-shows within the same browser session. Fix: add a mount effect that calls
`setUnlocked(true)` if `isAudioUnlocked()`. Low impact (one extra tap); fix before
any patient-facing deployment.

### Voice command mic in briefing — no-speech restarts slide
A "Hey, what was that?" with no matching command replays the current slide from the
start. Fix: don't disrupt()/pause before opening the mic; only act when a command is
actually recognized. Low priority for the demo.

---

## Infrastructure

### Supabase keep-alive
The Supabase free-tier project pauses after 7 days of inactivity. Set up a weekly
GitHub Action that makes a lightweight query to keep it alive, or upgrade to a paid tier
before any patient-facing use.

### Photo import: post-upload size check
Zero-byte HEIC→JPEG uploads can silently succeed. Add a `content-length > 0` check
inside the import loop after each upload to catch this before it hits the AI pipeline.

### Security: rotate Supabase service_role key
The service_role key was exposed in a tool chat during a deployment session (noted in
progress.md, May 30 2026 session). Rotate it in Supabase Dashboard → Settings → API
before any production use.
