# Kiosk Voice Stack (W2)

Hands-free voice loop for the Memoria kiosk: **"Hey Memo" → listen → answer in
nova → back to idle**, plus an auto-advancing morning briefing.

## Architecture

```
machine.ts        pure reducer (idle→wake→listen→think→speak→idle) — unit-tested
useVoiceLoop.ts   binds the reducer to the browser: STT, wake word, TTS,
                  askAssistant, navigation intents, earcons, race guards
stt.ts            Web Speech API wrapper (push-to-talk; continuous opt-in)
wakeword.ts       Web Speech continuous listener — "Hey Memo" wake phrase detection
../audio-unlock.ts        AudioContext/HTMLAudio/Fullscreen/WakeLock unlock + earcons
../../components/AudioUnlockGate.tsx   "Touch to begin" overlay (provides useAudioUnlocked)
../../components/VoiceOrb.tsx          animated Logo: idle/listening/thinking/speaking
```

## Wake word

"Hey Memo" is detected via a continuous `SpeechRecognition` session scanning for the
phrase in the background while idle. No dependencies, no account, no model files.

**Works in Chrome/Edge.** Firefox has no `SpeechRecognition` → falls back to
push-to-talk (tap the orb or press space).

The recognizer is **paused** for the whole non-idle turn and re-armed ~900 ms after
Memo finishes speaking, so nova's own audio can't retrigger the wake phrase. Chrome
auto-terminates recognizers after ~5 min; a restart watchdog keeps it alive.

Future: replace with Picovoice Porcupine for on-device acoustic detection (no audio
to Google, lower false-trigger rate, offline). See `future-implementations.md`.

## Concurrency notes

- **Race guard.** `machine.ts` keeps a `generation` counter that bumps on
  cancel/barge-in/silence/error. Every async side effect captures the generation it
  launched under and drops its result if it changed. The happy path never bumps
  `generation` (asserted in `machine.test.ts`).
- **Barge-in.** Tapping while SPEAKING dispatches `BARGE_IN`; the SPEAKING effect's
  cleanup calls `tts.stop()`. `tts-web` uses a `speakEpoch` so a stop landing
  mid-fetch still cancels the about-to-play audio.
- **Briefing double-advance.** Both `onDone` and a `duration_ms` max-dwell timer can
  advance a slide; each is guarded by `(genRef, idxRef)` so only the first wins.
