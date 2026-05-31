# Memoria → Voice-First Web Kiosk: Definitive Implementation Plan

> **Author:** Lead architect handoff to Alex
> **Status:** Approved blueprint — build against this.
> **Goal:** Turn Memoria into a voice-first web app demoed on a laptop like an Alexa/Google Home, with a clean path to hardware partnerships — without throwing away the working product.

---

## 1. Executive Summary

### The decision
We are going **hybrid**: build a **fresh Next.js "kiosk" app** for the patient (the fundable demo), keep the **existing Expo app untouched** as the caregiver surface, and extract the AI/data layer into a shared **`@memoria/core`** workspace package that both apps consume. The **Supabase backend and all 7 Edge Functions stay exactly as they are.**

### Why this is the right call
The single most important verified fact is that **the moat is already platform-agnostic, and the patient kiosk is a fundamentally different UX from the app we have today.** Concretely:

- All **7 Edge Functions are reuse-as-is, zero edits** — they already send `Access-Control-Allow-Origin: *`, handle `OPTIONS` preflight, and use bearer auth, so a browser can call them today.
- **9 of 10 `src/lib` files are pure TypeScript over `supabase-js`** with zero native imports — they move into `@memoria/core` verbatim.
- The `askAssistant() → tts.speak()` pipeline (already wired in `AssistantScreen.handleSend`, lines 54 + 77) drops straight behind a new voice trigger.
- The patient views are a **greenfield rewrite under every option considered** (DOM, react-native-web, or RN primitives), and `tts.ts` internals are a **forced rewrite under every option** (it imports `expo-file-system/legacy` on line 26, a ts-ignored transitive shim that won't even resolve in a browser bundler).

So no framework choice "saves" the patient UX. The only genuinely shareable things are the `lib/` layer and the backend, which are framework-agnostic. Given that, the question reduces to: *where do we build the kiosk, and what do we do with the working native app?* The answer is: **build the kiosk fresh in Next.js + DOM** (the cleanest substrate for Web Speech, Web Audio, Porcupine WASM, Cache API, and a lean PWA), and **keep the Expo app** so we don't throw away the working device-import screens (contacts/calendar/photo-roll with on-device HEIC→JPEG).

### What stays vs. what changes (at a glance)

| Stays untouched | Adapted (minor) | Rewritten / net-new |
|---|---|---|
| 7 Supabase Edge Functions | `supabase.ts` → factory | `tts.ts` internals (playback/cache/fallback) |
| `match_memories` RPC, all DB tables | `AuthContext` role logic (parameterized) | 4 patient views as React DOM |
| 9/10 `src/lib` files (verbatim) | `theme.ts` → CSS vars | Voice loop (wake word + STT) — **net-new** |
| The entire Expo app (as caregiver surface) | Icon/Logo geometry → inline `<svg>` | reanimated motion → CSS/WAAPI |
| `tools.ts` ↔ Edge Function mirror (server is authority) | `usePhotoLightbox` state | `notifications.ts` → service worker / server |
| | | Audio-unlock gate — **net-new** |

### The demo end-state
A MacBook running Chrome in `--kiosk` mode behind a tablet stand, indistinguishable from an Echo Show. It shows an **ambient idle home** (live clock, "Good morning, Robert," soft purple gradient). A visitor says **"Hey Memo, who is Maria?"** → a listening ring pulses → Memo answers in the warm OpenAI **nova** voice while Maria's photo fades in. Saying **"Hey Memo, start my day"** launches an **auto-advancing briefing slideshow** narrated slide-by-slide. All of it runs on the untouched backend, threading through the same `conversations`/`messages` tables.

---

## 2. Architecture Decision

### Chosen framework: Hybrid (fresh Next.js kiosk + preserved Expo app + shared `@memoria/core`)

We convert the repo into an **npm workspaces monorepo** — no new tooling required (npm workspaces ships with the existing toolchain; Turborepo is optional later).

```
memoria/
  package.json                      # root: { "workspaces": ["packages/*", "apps/*"] }
  packages/
    core/                           # @memoria/core — the shared source of truth
      src/
        assistant.ts                # moved verbatim from memoria-app/src/lib
        tools.ts                    # moved verbatim (stays mirrored w/ Edge Fn — server is authority)
        embeddings.ts               # moved verbatim
        memory.ts                   # moved verbatim
        briefing.ts                 # moved verbatim
        sensitivity.ts              # moved verbatim
        photoProcessing.ts          # moved verbatim
        preferenceSignals.ts        # moved verbatim
        photoUpload.ts              # NEW: browser-safe upload+insert+processPhotos (shared)
        types/index.ts              # UserRole etc., moved verbatim
        theme.ts                    # design tokens (pure data), shared by both apps
        auth/AuthContext.tsx        # platform-agnostic role provider (client injected)
        supabase.ts                 # PARAMETERIZED factory — NEVER a singleton
                                    #   export createSupabaseClient(env, { storage, ... })
      package.json
  apps/
    mobile/                         # the EXISTING Expo app, moved from memoria-app/
                                    #   imports @memoria/core instead of relative ../lib;
                                    #   constructs its client via createSupabaseClient
                                    #   (AsyncStorage/SecureStore adapter). Otherwise UNTOUCHED.
    kiosk/                          # NEW — Next.js 15 App Router PWA (the fundable demo)
      app/
        (kiosk)/page.tsx            # ambient always-listening home (replaces UserHome hub)
        (kiosk)/briefing/page.tsx   # auto-advancing slideshow synced to tts onDone
        (kiosk)/assistant/page.tsx  # voice loop → askAssistant → tts.speak
        (kiosk)/emergency/page.tsx  # "Who Am I?" identity card
        (kiosk)/layout.tsx          # shell: audio-unlock gate + role guard + voice machine + wake lock
        provision/page.tsx          # one-time co-user device binding (hidden)
        manifest.ts                 # typed PWA manifest (display: fullscreen)
        tokens.css                  # generated from @memoria/core/theme.ts
        motion.css                  # CSS keyframes (Ken Burns, rings, shimmer, breathing)
      lib/
        supabase.ts                 # one createSupabaseClient() instance (localStorage)
        tts-web.ts                  # tts.ts internals rewritten; SAME public API
        voice.ts                    # NET-NEW: Porcupine wake word + Web Speech STT + state machine
        audio-unlock.ts             # NET-NEW: autoplay-policy unlock
      components/
        Icon.tsx                    # 27 SVG 'd' strings → inline <svg>
        Logo.tsx, BrandLoader.tsx, Avatar.tsx, IntensityContext.tsx
        PhotoLightbox.tsx           # React portal/overlay (DOM)
        Button.tsx, Card.tsx, PhotoTile.tsx, ChatBubble.tsx, VoiceOrb.tsx
      scripts/
        gen-tokens.ts               # theme.ts → tokens.css (prebuild)
        demo-mac.sh                 # one-command Chrome --kiosk launcher
      tailwind config (v4 @theme block consuming tokens.css)
  supabase/                         # UNTOUCHED. Backend serves both apps identically.
```

> **Demo build = `apps/kiosk` only.** The Expo app keeps working untouched as the caregiver surface.

### What is reused vs. rewritten

**Reused as-is (verbatim or near-verbatim):**
- All 7 Edge Functions (`ask-assistant`, `generate-briefing`, `process-photo`, `check-sensitivity`, `embed`, `tts`, `nightly-briefings`).
- 9/10 `src/lib` files into `@memoria/core`: `assistant.ts`, `tools.ts`, `embeddings.ts`, `memory.ts`, `briefing.ts`, `sensitivity.ts`, `photoProcessing.ts`, `preferenceSignals.ts`, `types/index.ts`.
- The `askAssistant() → tts.speak()` send/thread pipeline.
- `tts.ts` **public API** + binary-fetch contract + djb2 cache key + LRU bookkeeping.
- `theme.ts` design tokens; all 27 Icon `d` strings; Logo petal/eye geometry.
- Briefing data layer (`getTodaysBriefing`, `resolveSlidePhotos`, `markDelivered`, validators) + procedural `buildBriefing` fallback.
- `EmergencyCardScreen` data logic (`loadEmergencyInfo`, `formatPhone`).
- `AuthContext` role-detection (two-table `loadProfile`).
- The entire Expo native app (caregiver surface + working device-import screens).

**Rewritten / net-new:**
- `supabase.ts` → `createSupabaseClient(env, storage)` factory (creds → env vars).
- `tts.ts` internals → `HTMLAudioElement` + Cache API/IndexedDB + `speechSynthesis`.
- Wake-word + STT loop — **entirely net-new** (no code exists; today is keyboard-only).
- 4 patient views → React DOM + Tailwind.
- All reanimated motion → CSS keyframes/WAAPI behind the ported `IntensityContext`.
- `PhotoLightbox` + `PhotoTagsView` → DOM portal/overlay.
- `notifications.ts` → service-worker / server scheduling.
- Routing → Next.js App Router route groups + layout role guard.
- Audio-unlock gate — **net-new** (browser autoplay policy).

### The honest dissent

The strongest dissent came from the **speed lens**, which favored a *fresh Next.js with no monorepo* (scored 9 vs hybrid's 6): for a laptop demo soon, monorepo plumbing is "pure tax" because only one surface is demoed.

**Why we override it — and where the dissenter is right:**
1. **The speed delta is tiny.** Hybrid scopes the kiosk build *identically* to the fresh-Next.js option — same fresh app, same DOM view rewrite, same verbatim theme/icon port, same net-new voice loop. The only extra work is **one `npm workspaces` entry plus moving an already-isolated, zero-native-dependency `lib/` folder into `packages/core` and parameterizing the 6-line `supabase.ts`.** That's hours, and it's essentially the same extraction the fresh option would do informally by copying `lib/` anyway. Hybrid just makes that copy a shared package instead of a fork.
2. **The second optimization target is "a clean path to a real product."** The fresh option's hidden cost is abandoning the working native co-user app and re-solving device ingestion (contacts/calendar/photo-roll, native HEIC decode) via file-pickers and Google OAuth — pure loss with no kiosk benefit. Hybrid keeps it.

**The real risk we are accepting:** *workspace-package drift.* The lib modules currently import a Supabase singleton, and `tools.ts` is already mirrored into the Deno Edge Function. **The mitigation is non-negotiable and baked into the structure: `supabase.ts` must be a per-environment factory (never a re-introduced singleton), and `@memoria/core` must remain the single home for all AI/data logic.** If a team cannot hold that discipline, the fresh-Next.js option becomes the correct fallback.

---

## 3. What Stays Untouched — The Hard Part Is Done

This is the reassuring part. **The intelligence, the data model, and the safety gates are already platform-agnostic and require zero changes.**

### The backend (Supabase + 7 Edge Functions): zero edits
Every Edge Function is pure Deno (`Deno.serve`, `Deno.env.get`, `fetch`) with no `expo`, `react-native`, `file://`, or device-token references anywhere. They are stateless HTTP endpoints at `https://<project>.supabase.co/functions/v1/<name>` with permissive CORS, so a browser calls them exactly like a native client does.

| Edge Function | Role | Web verdict |
|---|---|---|
| `ask-assistant` | Agentic tool-calling loop, memory injection, conversation persistence | **reuse-as-is** |
| `generate-briefing` | 6–12 slide JSON generator, validate + upsert | **reuse-as-is** |
| `process-photo` | AI vision (description, tags, people, flag); fetches an http(s) Storage URL | **reuse-as-is** |
| `check-sensitivity` | Intent-aware classifier, 50-item cap | **reuse-as-is** |
| `embed` | `text-embedding-3-small` proxy | **reuse-as-is** |
| `tts` | OpenAI nova voice, raw audio bytes, voice/format allowlist | **reuse-as-is** |
| `nightly-briefings` | Cron-only batch (service-role bearer, no `*` CORS, rejects clients) | **reuse-as-is** (never client-facing) |

**Two invocation patterns, both portable:**
- `supabase.functions.invoke('<name>', { body })` — used by 6 functions; identical on web and native.
- Direct `fetch` to `${SUPABASE_URL}/functions/v1/tts` — **only** `tts`, because `functions.invoke` JSON-parses every response and corrupts binary MP3 bytes. This raw-fetch + `arrayBuffer` pattern is standard Web API and works in browsers as-is.

**Payload safety is preserved:** `process-photo` only ever receives an http(s) Storage URL; the client-side hard guard (`!photoUrl.toLowerCase().startsWith('http')` in `photoProcessing.ts` ~line 77) must be kept so a native `file://`/`content://`/`ph://` URI can never reach the function — but the function itself doesn't change.

### The AI/data layer (`@memoria/core`): moved verbatim
`assistant.ts`, `tools.ts`, `embeddings.ts`, `memory.ts`, `briefing.ts`, `sensitivity.ts`, `photoProcessing.ts`, `preferenceSignals.ts`, and `types/index.ts` only talk to Supabase via `@supabase/supabase-js` (cross-platform) and `fetch`. They contain **zero** `expo-*`, `react-native`, `AsyncStorage`, file-system, or notification imports. `sensitivity.ts`'s `ruleSetHash` even uses a hand-rolled FNV-1a (deliberately avoiding `crypto`) so it works in browsers.

### The safety model is intact
Per project rules, no AI content reaches the patient without the sensitivity classifier + co-user verification. The kiosk reuses `getTodaysBriefing` (which returns draft/approved/delivered) and `buildBriefing`'s client-side sensitivity filtering unchanged — **the voice kiosk must not surface unverified media, and these gates carry over for free.**

---

## 4. Subsystem Migration Map

| Subsystem | Verdict | Effort | Notes |
|---|---|---|---|
| **7 Edge Functions** | reuse-as-is | None | Zero edits. CORS `*` + OPTIONS + bearer already browser-ready. Confirm `tts` CORS before relying on nova on web. |
| **`src/lib` AI/data (9 files)** | reuse-as-is | Low (move + import-swap) | Move into `@memoria/core`; swap singleton import for injected client. |
| **`supabase.ts`** | adapt | Low | Singleton → `createSupabaseClient(env, storage)` factory. Creds → env vars. **Load-bearing discipline.** |
| **`AuthContext` role logic** | adapt | Low | Two-table `loadProfile` (co_users then users by `auth_id`) is platform-agnostic; parameterize the client. |
| **`tts.ts`** | rewrite (internals) | Medium | Keep public API identical. `expo-audio`→`HTMLAudioElement`; `expo-file-system`→Cache API/IndexedDB; `expo-speech`→`speechSynthesis`; delete silent-mode + base64. |
| **4 patient views** | rewrite (views) | Medium-High | DOM + Tailwind. Data/AI logic reused 100%. Briefing gets **net-new auto-advance** synced to TTS `onDone`. |
| **Wake word + STT loop** | net-new | High (riskiest) | Porcupine WASM "Hey Memo" + Web Speech `SpeechRecognition` feeding unchanged `askAssistant()`. |
| **Motion (reanimated)** | rewrite | Medium | CSS `@keyframes`/WAAPI behind ported `IntensityContext`. Lighter than worklets in a browser. |
| **`PhotoLightbox` / `PhotoTagsView`** | rewrite | Low-Medium | DOM portal/overlay; `usePhotoLightbox` state reused. Fold hardcoded hex onto tokens. |
| **`theme.ts` / Icon / Logo** | reuse-as-is / adapt | Low | Tokens → CSS vars; 27 `d` strings + Logo geometry → inline `<svg>` (camelCase→kebab attr renames). |
| **`notifications.ts`** | rewrite | Medium | Service-worker / server scheduling (Web Notifications don't survive a closed tab). Event query reused. |
| **Routing (`AppNavigator`)** | rewrite | Medium | App Router route groups + layout role guard + audio-unlock gate. Kiosk ships **only** patient routes. |
| **Co-user dashboard (16 screens)** | unchanged for demo | None now | Stays on the Expo app. Web port is post-demo (forms/lists map cleanly; `Alert.alert` buttons + reanimated stubs are the work). |
| **Device-import screens (3)** | rewrite (acquisition only) | Medium | File-picker/`.vcf`/`.ics` + Google OAuth (deferred). Downstream Supabase pipeline reused verbatim. |
| **`LoginScreen` (~700 lines reanimated)** | rewrite | N/A for kiosk | Patient never sees login. Co-user login stays in Expo. |

---

## 5. The Voice Stack

This is the heart of the product and the riskiest net-new work. Build it as browser-native modules under `apps/kiosk/lib/voice/` plus one React hook driving the patient pages. **Build and prototype the voice loop first — it is make-or-break.**

### 5.1 STT — Web Speech API (`apps/kiosk/lib/voice/stt.ts`)
Thin wrapper over `const SR = window.SpeechRecognition || window.webkitSpeechRecognition`.

- `createRecognizer({ continuous, lang: 'en-US', interimResults: true })` → `start()/stop()/abort()` + `onResult(transcript, isFinal)`, `onError(err)`, `onEnd()`.
- Feature-detect at module load: `export const sttSupported = !!SR`.
- **Push-to-talk (primary):** `continuous: false`, `interimResults: true`. The reliable cross-browser path; default it for the demo.
- **Continuous (opt-in):** auto-restart on `onend` (Chrome silently ends ~every 60s) guarded by an `active` flag so we don't restart after an intentional stop. Recycle on `no-speech`/`aborted`/`network`; surface `not-allowed` as permission-denied UI.
- **Browser coverage:** Chrome/Edge desktop = full; Safari = webkit-prefixed, unreliable continuous → **force push-to-talk**; Firefox = unsupported → **fall back to a visible text input reusing `handleSend`.**
- **Privacy note (must disclose to co-user):** Chrome streams mic audio to Google servers for transcription. Porcupine wake detection is on-device and does *not* have this issue.

### 5.2 Wake word — Porcupine WASM (`apps/kiosk/lib/voice/wakeword.ts`)
`@picovoice/porcupine-web` + `@picovoice/web-voice-processor`. Runs the keyword spotter **entirely in-browser** (no audio leaves the machine for wake detection).

- Build a custom **"Hey Memo" `.ppn`** in the Picovoice Console (Web/WASM target); ship `hey_memo_wasm.ppn` + `porcupine_params.pv` as static assets under `apps/kiosk/public/porcupine/`.
- `PorcupineWorker.create(accessKey, [keyword], onDetect, modelPath)` + `WebVoiceProcessor.subscribe(worker)` (acquires mic via `getUserMedia`, feeds 16kHz frames). On detection → dispatch `WAKE`.
- `wakeWordSupported` feature-detect (WebAssembly + getUserMedia + AudioWorklet).
- AccessKey is a build-time env `NEXT_PUBLIC_PICOVOICE_ACCESS_KEY` (activation key, rate-limited not secret; free tier covers a single-device kiosk).
- **One `getUserMedia` grant on kiosk unlock covers both Porcupine and Web Speech** for the session (and doubles as the autoplay unlock gesture).
- **Co-user on/off toggle** read from Supabase (e.g. `users.wake_word_enabled` or a `kiosk_settings` row). When off, the kiosk shows only the push-to-talk mic button.
- If the custom `.ppn` isn't ready for the demo, degrade to a built-in stock keyword.

### 5.3 TTS on web — `apps/kiosk/lib/tts-web.ts` (drop-in replacement)
**Preserve the EXACT public API** so the briefing/assistant pages call it unchanged: `speak`, `stop`, `isSpeaking`, `prewarm`, `clearCache`, `_cacheKey`, `SpeakOpts`.

**Keep verbatim (already pure Web):**
- `fetchTTSAudio` — raw POST to `${SUPABASE_URL}/functions/v1/tts` with `Authorization` (session token, anon-key fallback) + `apikey`, body `{text,voice,model}`, `AbortController` 5s timeout, returns `arrayBuffer()`.
- `djb2Hex` / `_cacheKey`; LRU bookkeeping with `MAX_CACHE_ENTRIES = 50`; constants `DEFAULT_VOICE='nova'`, `DEFAULT_MODEL='tts-1'`, `FETCH_TIMEOUT_MS=5000`.

**Rewrite the three native pieces:**
| Native | Web replacement |
|---|---|
| `expo-audio` playback | **One persistent** `HTMLAudioElement` fed `URL.createObjectURL(new Blob([ab],{type:'audio/mpeg'}))`; `'ended'` event mirrors `didJustFinish` → `onDone`. |
| `expo-file-system` LRU disk cache | **Cache API** (`caches.open('memoria-tts-v1')`) for bytes + **IndexedDB** (`idb-keyval`) for `last_used_at` + eviction; 50-entry cap preserved; revoke object URLs on evict. |
| `expo-speech` fallback | `window.speechSynthesis` + `SpeechSynthesisUtterance` (`lang='en'`, `rate=0.85`); resolve best `en` voice via `getVoices()`/`voiceschanged`. |

**Delete:** `configureAudioMode`/`setAudioModeAsync` (no browser analogue) and `arrayBufferToBase64` (use Blob directly).

**Self-heal:** a missing `cache.match` is treated as a miss (re-fetch), exactly as native re-fetched a stale file. **Memory hygiene:** every `createObjectURL` is paired with `revokeObjectURL` on `'ended'`/`stop`/replace, guarded by a per-clip token so a stale `'ended'` listener can't clear the wrong state.

### 5.4 Audio-unlock gate (`apps/kiosk/lib/audio-unlock.ts` + `components/AudioUnlockGate.tsx`)
Browser autoplay policy keeps audio silent until a user gesture — which would break the "everything is spoken" rule for an auto-narrating kiosk.

- The `(kiosk)/layout.tsx` renders a full-screen **"Touch anywhere to start your day"** overlay (theme-styled, one huge tappable surface, Logo) whenever `!isAudioUnlocked()`.
- On the gesture, `unlockAudio()`: resumes a shared `AudioContext`, plays a 1-frame silent buffer through the persistent `audioEl` (so all future programmatic `play()` calls are allowed), primes-then-cancels an empty `speechSynthesis` utterance, sets `audioUnlocked=true`, **requests fullscreen + acquires the wake lock in the same gesture**, and notifies `onUnlock` subscribers (so the home greeting speaks immediately).
- A `sessionStorage` hint skips the copy flicker, but the **silent-buffer unlock always re-runs on the first real gesture after a hard reload** (the gesture requirement resets per page load).
- **Defense in depth:** every `audioEl.play()` is wrapped in `.catch → fallbackSpeak`, so a single blocked play never leaves the user in silence.

### 5.5 The interaction state machine (`apps/kiosk/lib/voice/machine.ts` + `useVoiceLoop.ts`)
A pure, unit-testable reducer plus a React hook binding it to STT/wake-word/TTS. The hook is the **single owner of mic + audio focus**, so pages never fight over the microphone.

```
                  (wake word, if enabled)
        ┌──────────────── WAKE ◄───────────── 'Hey Memo'
        │   earcon + ring                      │ (barge-in)
        ▼                                       │
      IDLE ──PTT_DOWN──► LISTENING ──final──► THINKING ──RESPONSE──► SPEAKING ──TTS_DONE──► IDLE
   (ambient)             (live interim         (askAssistant)        (tts.speak,            │
    Ken Burns             transcript)                                 photos render)        │
        ▲                     │ silence ~8s          │ error                ▲ BARGE_IN/CANCEL
        └─────────────────────┴──────────────────────┴──── ERROR ──speak fallback──────────┘
```

| State | Behavior |
|---|---|
| **IDLE** | Ambient home (Ken Burns/clock); Porcupine listening if enabled. |
| **WAKE** | Transient: earcon + SpeakingRing pulse → immediately LISTENING. |
| **LISTENING** | STT active; show large live interim transcript; final → THINKING; silence ~8s → IDLE. |
| **THINKING** | `askAssistant(userId, transcript, conversationId)`; "Memo is thinking" loader; capture returned `conversationId` into a ref (mirrors `handleSend`) to thread the next turn. |
| **SPEAKING** | `tts.speak(answer, { onDone })`; render returned photos (singular=1, plural=3–5, as today). `onDone` → IDLE. |
| **ERROR** | Speak the existing fallback line, then IDLE. |

**Conversation threading:** the hook holds `conversationId` in a ref and passes it into every `askAssistant` call — multi-turn spoken conversations thread through the same `conversations`/`messages` tables the Edge Function already persists. **No Edge Function changes.**

**Navigation intents** are matched on the transcript *before* hitting the LLM: `"start my day"/"good morning"` → `/briefing`; `"who am I"/"who is this"` → `/emergency`; `"go home"/"never mind"` → `/`; `"next"/"again"/"stop"` handled by the briefing route.

**Briefing auto-advance (net-new):** speak slide N via `tts.speak(...,{onDone})` → advance to N+1; `prewarm` slide N+1's TTS during slide N; use `BriefingSlide.duration_ms` as a **max-dwell fallback timer**; listen for `"next"/"again"/"stop"`. Guard races against `tts.stop()` (idempotent, null-checks current player) and drop stale `askAssistant` responses arriving after a `CANCEL`/`BARGE_IN` via a request-generation counter.

**Barge-in:** in SPEAKING, arm tap-anywhere/Stop + PTT (emit `BARGE_IN` → `tts.stop()` → LISTENING) as the **reliable demo path**. Voice barge-in (Porcupine during SPEAKING) is gated behind a post-speak debounce to prevent the nova audio from self-triggering the wake word.

### Voice stack libraries
| Library | Purpose |
|---|---|
| `@picovoice/porcupine-web` ^3 | In-browser WASM "Hey Memo" wake word |
| `@picovoice/web-voice-processor` ^4 | Mic capture + 16kHz framing (AudioWorklet) |
| Web Speech API (`SpeechRecognition`) | STT — browser-native, no install |
| Web Speech API (`SpeechSynthesis`) | Degraded TTS fallback |
| `HTMLAudioElement` + Web Audio | nova MP3 playback + silent-buffer unlock |
| `idb-keyval` ^6 (~600B) | IndexedDB LRU index for TTS cache (or raw IDB to avoid the dep) |
| `xstate` ^5 / `@xstate/store` (optional) | Formalize the machine; a hand-rolled reducer is lighter for the demo |

---

## 6. Auth, Session & Kiosk Login

### Model: the patient never sees a login screen
The kiosk holds a **real patient-owned Supabase session** (the `users.auth_id` account created today by `SetupUserLoginScreen`), persisted in `localStorage`, **never the co-user's session.** It is hard-locked to the `(kiosk)` patient route group, auto-resumes on boot, and shows no password prompt ever.

### Session persistence: make the implicit explicit, per-app
Today `supabase.ts` calls `createClient(url, key)` with no options. On web that defaults to `persistSession: true` on `localStorage` + `autoRefreshToken: true` (it improves for free); on native it falls back to in-memory and **silently logs out on cold start (a latent native bug).** We make it explicit and per-environment:

```ts
// packages/core/src/supabase.ts  — FACTORY, never a singleton
export function createSupabaseClient(
  env: { url: string; anonKey: string },
  opts: { storage?; storageKey?; persistSession?; autoRefreshToken?; detectSessionInUrl? }
) {
  return createClient(env.url, env.anonKey, {
    auth: {
      persistSession: opts.persistSession ?? true,
      autoRefreshToken: opts.autoRefreshToken ?? true,
      detectSessionInUrl: opts.detectSessionInUrl ?? false,
      storage: opts.storage,
      storageKey: opts.storageKey,
    },
  });
}
```

- **Kiosk:** one instance with `storage: window.localStorage`, `storageKey: 'memoria-kiosk-auth'`, `persistSession/autoRefreshToken: true`, `detectSessionInUrl: true`. Plain `@supabase/supabase-js` (no SSR data fetching needed for the kiosk surface; `@supabase/ssr` cookies are only worth it if a co-user *admin* web dashboard is built later). `localStorage` survives reboots, browser restarts, and PWA relaunches — exactly the kiosk requirement.
- **Mobile:** `createSupabaseClient` with an **AsyncStorage/SecureStore adapter** — this *fixes* the existing native cold-start logout bug. **Easy to forget during the import swap — do not skip it.**

### Boot sequence (auto-login)
`(kiosk)/layout.tsx`: AuthProvider mounts → `getSession()` resolves the stored session → `autoRefreshToken` mints a fresh access token → `loadProfile(authId)` confirms `role === 'user'` → render the ambient home. A daily-used kiosk effectively never expires. If `getSession()` is null (never provisioned), show a calm **"Ask your family to set up this device"** screen with **no login form** — provisioning is a co-user action.

### Provisioning (one-time, co-user-driven — replaces the fragile `setSession` dance)
Today `SetupUserLoginScreen` calls `supabase.auth.signUp` for the patient while the co-user is logged in, then restores the co-user session via `setSession` — on web this clobbers `localStorage` mid-flow. We move account creation **server-side**:

1. New Edge Function **`provision-kiosk`** (service-role): verify the caller's `co_users.user_id` matches the target patient, then `supabase.auth.admin.createUser` (or `generateLink`) and stamp `users.auth_id`. The co-user's browser session is never disturbed.
2. **Preferred binding (A):** co-user (signed into their own device) taps "Set up the device" → `provision-kiosk` mints a short-lived (~5 min) magic link for the patient account → co-user opens that link **physically on the kiosk** → `detectSessionInUrl: true` parses + persists the patient session, then `router.replace('/')` strips the token → auto-login forever.
3. **Fallback binding (B):** co-user types the patient email/password into the hidden `/provision` page on the kiosk once.

### Routing lock (the kiosk cannot escape)
- `(kiosk)/layout.tsx` `KioskGuard`: `loading` → BrandLoader; `!session` → ProvisioningNeeded; `role && role !== 'user'` → `signOut()` + ProvisioningNeeded; else render children.
- **Ship NO `/login`, `/signup`, or `(couser)` routes in the kiosk bundle** — even a typed URL cannot reach a login screen.
- `router.replace` (never `push`) so there's no growing history stack; a **popstate sentinel trap** bounces the Back button to `/`; `contextmenu`/selection/zoom disabled at the layout.
- The only escape hatch: a **co-user PIN gesture** (long-press the clock 3s) — kept out of the patient's normal path.

### Co-user separate sign-in
The co-user authenticates as themselves (`co_users.auth_id`) on the **Expo app** (or a future `(couser)` web route group with a separate `storageKey`/device). They are never signed into the kiosk as themselves — their only kiosk interaction is the one-time physical provisioning gesture. This keeps RLS clean: kiosk session = patient (curated, sensitivity-filtered data only); co-user session = full management scope.

### Security trade-offs (accepted, with mitigations)
- **No lock screen** = anyone physically present sees the patient's data. **Accepted** because the patient cannot perform login and all kiosk-visible content is already co-user-verified + sensitivity-classified; the device is a personal home appliance.
- **Mitigations:** RLS scopes the session to one patient's rows; the kiosk ships **zero write-heavy admin routes** (read briefings/people/media + chat only); only the anon/publishable key is client-side (service-role lives solely in `provision-kiosk`); a co-user **"Revoke this device"** action (`admin.signOut(patientAuthId)` / password rotation) invalidates a lost device's refresh token; a tight CSP + no third-party scripts bounds the `localStorage`-token XSS surface to one low-stakes scope.

---

## 7. Data Imports on Web

> These are caregiver screens. Per the hybrid decision, **the working native import screens stay in the Expo app.** The web replacements below are built only when/if a web caregiver surface is added (`apps/admin` or kiosk-adjacent routes). **Build order if/when needed: Photos first (highest demo value — the AI vision pipeline is the wow factor), then a combined Contacts+Calendar file-upload screen; Google OAuth is post-demo.**

### Principle: replace only acquisition, keep the entire downstream pipeline verbatim
A shared `packages/core/src/photoUpload.ts` mirrors `ImportPhotosScreen.handleImport` line-for-line but takes browser `File` objects:

`normalize → upload to bucket 'photos' at '${userId}/${filename}.jpg' (contentType image/jpeg) → getPublicUrl → the EXACT '!publicUrl.startsWith("http")' guard → push the EXACT media row {user_id, file_url, file_type:'photo', taken_at, verification_status:'pending'} → bail if rows.length===0 → .insert(rows).select('id,file_url') → processPhotos(inserted.map(r=>({mediaId:r.id, photoUrl:r.file_url})), userId, onProgress)`

Browser `File` **is** already a `Blob`, so the native `fetch(uri).blob()` round-trip is dropped. `process-photo` still receives an http(s) URL — **zero backend change.**

### Photos — file picker / drag-drop + HEIC
- `<input type="file" multiple accept="image/*,.heic,.heif">` + drag-drop dropzone.
- **HEIC→JPEG (the single biggest behavioral gap):** detect by extension `/\.he(ic|if)$/i` OR `file.type === image/heic|heif` OR **empty type (Safari reports `''` for HEIC)**. Convert with `heic2any({ blob, toType: 'image/jpeg', quality: 0.85 })` (matches native `compress: 0.85`). For non-HEIC, optional canvas re-encode; on failure upload the original (jpg/png/webp are browser-decodable and the vision model accepts them). **Fallback path:** move conversion server-side into `process-photo` (Deno + libheif/sharp) if client conversion proves flaky.
- **`taken_at` fidelity:** EXIF `DateTimeOriginal` (via `exifr`) → `File.lastModified` → `Date.now()`. Flag as a chronology risk; Google Photos OAuth (`mediaMetadata.creationTime`) is the only accurate source.
- **Defensive accounting:** preserve per-file try/catch + `failedUploads` counter + "N of M failed" message; add a concurrency limit (~3–4 files at a time) to avoid tab crashes.

### Contacts — `.vcf` upload
`<input accept=".vcf,text/vcard">` → `file.text()` → parse VCARD blocks (lib `vcf`/`vcard4`); extract `FN`/first `TEL`/first `EMAIL` → the **exact** `people` row shape (`relationship: 'Contact'`, `key_facts: []`). Keep the existing dedupe (`select('full_name').eq('user_id', userId)` → lowercased Set) and `insert(rows)` verbatim. Drop the iOS Settings deep-link.

### Calendar — `.ics` upload
`<input accept=".ics,text/calendar">` → `file.text()` → `ical.js` (`ICAL.parse` → `getAllSubcomponents('vevent')`); per VEVENT extract `SUMMARY`/`DTSTART`/`DTEND`/`DESCRIPTION`. Apply the **same window** (now−1mo … now+3mo). Keep the `title|date` dedupe and the **exact** `events` insert (`event_type: 'one_time'`, `is_past: new Date(startDate) < now`). Handle `RRULE` via `ICAL.RecurExpansion` within the window (or first-instance + warning for the demo — recurrence is the main `.ics` correctness risk).

### Google OAuth (deferred, all three)
One OAuth client covering `photoslibrary.readonly` + `contacts.readonly` + `calendar.readonly`. **Token exchange MUST be server-side** (new `google-oauth-exchange` Edge Function / Next route handler) to keep the client secret out of the bundle. The in-app flow is its own OAuth client, **not** the dev-side Google MCP tools. All three sources converge on the same `uploadAndInsertPhotos` / `people`-insert / `events`-insert paths.

### Import libraries
`heic2any` ^0.0.4 · `ical.js` ^2 · `exifr` ^7 · `vcf` ^2 / `vcard4` · (`googleapis`/`google-auth-library` server-side, deferred).

---

## 8. Kiosk Mode & Ambient Shell

### Shell topology
`apps/kiosk/app/(kiosk)/layout.tsx` is the shell: `position: fixed; inset: 0; overflow: hidden; touch-action: none; user-select: none; overscroll-behavior: none` (nothing scrolls/rubber-bands; no accidental navigation surface). It mounts, in order: `<AudioUnlockGate>` → `<KioskGuard>` → `<VoiceMachineProvider>` → `<WakeLockKeeper>` → `<FullscreenController>` → route children. The four patient routes live under it; `(kiosk)/page.tsx` (ambient home) is the default/return state. **There is no co-user route in the kiosk bundle.**

### PWA setup
`app/manifest.ts` → `/manifest.webmanifest`: `name "Memoria"`, `short_name "Memo"`, `display: "fullscreen"`, `display_override: ["fullscreen","standalone"]`, `orientation: "landscape"`, `background_color`/`theme_color = #1a1a2e`, `start_url: "/?source=pwa"`, 192/512/maskable icons from Logo geometry. Service worker via **`@serwist/next` ^9** (maintained `next-pwa` successor), prod-only, scoped to `(kiosk)`:
- Precache the app shell; NetworkFirst for `(kiosk)` HTML.
- CacheFirst for Supabase Storage photo URLs (`*.supabase.co/storage/v1/object/public/*`) so briefing photos survive a dropped connection.
- A **today's-briefing cache** keyed by `briefing_date` (resolved slide JSON + prewarmed TTS MP3s, sharing the `tts-web.ts` Cache API store) → automatic offline briefing playback once viewed online.

### Fullscreen / wake-lock (Echo Show behavior)
- **PWA standalone** (`display: fullscreen`) hides chrome; detect via `matchMedia('(display-mode: fullscreen)')`.
- **Fullscreen API:** `document.documentElement.requestFullscreen()` on the same first gesture that unlocks audio; re-request on `fullscreenchange` exit via a "tap to re-enter" affordance.
- **Chrome `--kiosk`** for the laptop demo (no in-app code).
- **Wake Lock:** `navigator.wakeLock.request('screen')` after the unlock gesture, **re-acquired on `visibilitychange === visible`** (the lock auto-releases when the tab hides). On macOS, also run `caffeinate` and disable App Nap.

### Ambient idle home (`(kiosk)/page.tsx`)
Replaces the button grid with a calm presence: a large live 12-hour clock (single `setInterval`, ~96px), the patient's **first name** from `users.full_name` (time-of-day-aware "Good morning, Robert"), a soft cool-purple radial gradient with a slow ~14s breathing animation (disabled under `prefers-reduced-motion`), and a low-contrast **"Say 'Hey Memo'"** mic hint. It is the canonical return state after any flow or inactivity timeout. Quiet large touch fallbacks (a big "Talk to Memo" target, a small "Who am I?") exist but read as ambient, not app-like.

### Accessibility
- Kiosk-scoped `html { font-size: 20px }` scaling the `theme.ts` type scale ~1.25×; tokens exposed as CSS vars.
- All interactive targets **≥ 88×88px** (well beyond 44px WCAG min).
- Body text `#fff`/`#e0e0e0` on `#1a1a2e` clears WCAG AAA for large text; the "Hey Memo" hint is intentionally low-contrast but decorative (also spoken).
- A single `@media (prefers-reduced-motion: reduce)` block disables gradient breathing, speaking-ring pulse, Ken Burns, cross-dissolves → maps to `IntensityContext` "Off". Large high-contrast `focus-visible` rings for switch/keyboard users. **Every visual state has a spoken counterpart.**

### Laptop-demo runbook ("run it like an Alexa on a MacBook")
1. From repo root: `npm install` (workspaces hoist), then for a faithful demo `npm run build -w apps/kiosk && npm run start -w apps/kiosk` (SW + production autoplay/wake-lock behavior is prod-only). `npm run dev -w apps/kiosk` is fine for iteration.
2. `apps/kiosk/.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_PICOVOICE_ACCESS_KEY`.
3. Provision the kiosk once as the patient (`role === 'user'` account from the co-user `SetupUserLogin` flow); the `localStorage` session persists across restarts.
4. Launch Chrome in kiosk mode:
   ```
   open -na "Google Chrome" --args --kiosk --app=http://localhost:3000 \
     --autoplay-policy=no-user-gesture-required --use-fake-ui-for-media-stream
   ```
   (the last two flags suppress the audio-unlock gate and the mic prompt for a clean demo; in a real install you keep the gate and grant the mic once). Run `caffeinate -dimsu` in another terminal so the screen never sleeps.
5. Grant microphone permission once; Porcupine + SpeechRecognition then run.
6. **Demo script:** ambient clock + "Good morning, Robert" → "Hey Memo, who is Maria?" → ring pulses → Memo speaks in nova and Maria's photo fades in. Then "Hey Memo, start my day" → auto-advancing narrated briefing.
7. (Optional) Mount the MacBook behind a tablet stand, hide the keyboard. Provide `apps/kiosk/scripts/demo-mac.sh` wrapping the Chrome launch + `caffeinate` so it's one command.

### Kiosk libraries
`next` ^15 · `react`/`react-dom` ^19 · `@serwist/next` + `serwist` ^9 · `@picovoice/porcupine-web` ^3 · `@picovoice/web-voice-processor` ^4 · `@xstate/store` ^2 (optional) · `tailwindcss` ^4 · Web platform APIs (SpeechRecognition, Wake Lock, Fullscreen, Cache Storage, Web Audio, media queries).

---

## 9. Design System Port

**~70% of the brand is copy-paste portable** (tokens + all SVG geometry); the ~30% that's RN-specific (reanimated, RN Modal/responder, expo-linear-gradient) is re-expressed in CSS/WAAPI/HTML-`<svg>` — lighter than dragging the RN equivalents through a browser. **Do not carry reanimated/worklets or react-native-web to the web side.**

### Tokens → CSS vars / Tailwind v4
`theme.ts` (pure data, zero RN imports) moves to `packages/core/src/theme.ts`. A prebuild script `apps/kiosk/scripts/gen-tokens.ts` emits `app/tokens.css`:

```css
:root {
  --color-bg:#1a1a2e; --color-surface:#2a2a4a; --color-surface-sunk:#22223a;
  --color-surface-raised:#3a3a5a; --color-primary:#7c4dff; --color-primary-deep:#5e35b1;
  --color-primary-soft:#b388ff; --color-fg:#e0e0e0; --color-fg-strong:#fff;
  --color-fg-muted:#888; --color-danger:#ff6b6b; --color-success:#4caf50; --color-info:#2196f3;
  --radius-sm:12px; --radius-md:14px; --radius-lg:16px; --radius-xl:18px;
  --radius-xxl:20px; --radius-pill:24px; --radius-full:999px;
  --type-display:48px; --type-greeting:36px; --type-title:32px; --type-big-btn:28px; --type-h2:24px; /* ... */
}
```

Tailwind v4 `@theme` aliases these so `bg-surface`, `text-primary-soft`, `rounded-xxl` exist. Font: set `--font-sans` to `-apple-system, system-ui, 'Segoe UI', Roboto, sans-serif` (RN intentionally left `fontFamily` unset → SF Pro). Type scale → `px` (fixed kiosk display; `rem` unnecessary). **Fold the hardcoded hex now** (`PhotoTagsView` `#7c4dff/#b388ff/#e0e0e0`; `PhotoLightbox` `rgba(42,42,74,0.9)`; `AssistantScreen` ChatBubble `#1a1a2e`) onto tokens so there's one source of truth.

### Icons & Logo → inline `<svg>`
Port the 27 glyphs to `apps/kiosk/components/Icon.tsx` returning `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">` with the **identical `d` strings** (mark uses 2.6). Two-tone glyphs keep a second accent path driven by `var(--color-primary)`; `memo` dots become filled `<circle>`. `Logo.tsx` ports identically: two `radialGradient`s (petal `#ddc8ff→#9c6bff→#7340d8`, eye `#fff3c4→#f6c64f→#e7a92f`), the single PETAL path at `rotate(i*72 24 24)` ×5, three eye circles. **Namespace gradient ids with `useId()`** so multiple Logos on one page (e.g. BrandLoader + header) don't collide. Attribute renames: `stop-color`, `stop-opacity`, `gradient-units`, `stroke-opacity` (in JSX these can stay camelCase — be consistent).

### Motion → CSS/WAAPI behind `IntensityContext`
Port `IntensityContext` verbatim except swap reanimated `useReducedMotion` for `matchMedia('(prefers-reduced-motion: reduce)')`. Keep `AMP = {Off:0, Subtle:0.5, Calm:1, Rich:1.6}`, `on = intensity !== Off`, `speed = max(amp, 0.5)`; expose `--motion-speed` so durations are `calc(BASE / var(--motion-speed))`. Recreate each animation with the **exact captured timings/easings** (in `app/motion.css`):

| Animation | Spec |
|---|---|
| AnimatedEntrance (fade-up) | opacity 0→1 + translateY 16→0, 600ms, `cubic-bezier(0.2,0.7,0.3,1)`, staggered delay (base 120/140ms + index×70/80)/speed |
| SpringPressable (press-scale) | cards 0.94 / bigBtn 0.965 / default 0.96, transition 160ms `cubic-bezier(.34,1.56,.64,1)` (approximates damping12/stiffness350/mass0.8) |
| Ken Burns | scale 1→1.12 + translateX 0→12px, 16000ms/speed, ease-in-out alternate; warm light-leak as a `linear-gradient` overlay |
| SpeakingRing | three ring divs, scale 1→1.9 + opacity 0.5→0, 2600ms/speed ease-out infinite, delays 0/850/1700ms |
| Slide cross-dissolve+rise | opacity 0→1 + translateY 22→0 + scale 0.985→1 on slide key change |
| BrandLoader | breathing flower 1↔1.06 2600ms + two pulse rings (→1.9 / opacity 0.55→0, 2400ms, ring2 half-cycle offset) + caption glow 0.62↔1 6000ms |
| ShimmerButton | `::after` gradient strip skewX(-12deg) translateX -160%→320%, 4500ms/speed, 1200ms initial delay |
| AliveEmptyState | float 0↔-8px 5000ms + SVG draw-on check `stroke-dasharray:26`/offset 26→0, 700ms `cubic-bezier(0.5,0,0.2,1)` after 300ms |
| Avatar | `avatarColors` djb2 hash + 6 `AVATAR_PAIRS` → `linear-gradient(135deg, a, b)` |

Use `framer-motion` ^11 **only** for orchestrated mount/unmount (`AnimatePresence` on lightbox/slide). Everything ambient/looping stays **pure CSS `@keyframes`** (transform/opacity only, GPU-composited) so a kiosk running for hours stays cool and frame-stable.

### Lightbox → portal/overlay
`usePhotoLightbox` state logic reused verbatim. `PhotoLightbox` → `createPortal(document.body)` fixed full-screen div: backdrop `rgba(0,0,0,0.95)` (`onClick=close`); `<img style="object-fit:contain">` with `onClick` `stopPropagation`; top-left ⓘ + top-right ✕ round buttons (`Icon`); bottom-left translucent `PhotoTagsView`. `AnimatePresence` for the fade (matches RN Modal `animationType="fade"`). `PhotoTagsView` → div with an `overflow-x: auto` tag-pill row (CSS scroll replaces RN horizontal ScrollView).

### Shared component inventory (`apps/kiosk/components/`)
`Button` (ShimmerButton feel + press-scale + hero glow) · `Card` (surface + optional 4px left-accent + AnimatedEntrance) · `PhotoTile` (cover img + broken-state + tap-to-open) · `Lightbox` + `usePhotoLightbox` · `BriefingSlide` (full-bleed Ken Burns + light-leak + tint wash + headline/subtitle + progress bar, auto-advance) · `ChatBubble` (user/Memo variants + inline PhotoTile rows) · **`VoiceOrb`** (the kiosk centerpiece — breathing Logo flower with SpeakingRing halos when speaking and a subtle "listening" state) · plus `Logo`, `Icon`, `BrandLoader`, `Avatar`, `IntensityProvider`. All consume the CSS-var token set so one theme change repaints both surfaces.

### Design libraries
`tailwindcss` ^4 + `@tailwindcss/postcss` · `framer-motion` ^11 (scoped) · `clsx` + `tailwind-merge`. **No** `react-native-web`, `react-native-svg`, `react-native-reanimated`, `react-native-worklets`, or `expo-linear-gradient` on web.

---

## 10. Phased Roadmap

> Ordering principle: get a **working caregiver dashboard + Memo text chat on web first** (proves the shared core + browser TTS), **then** voice, **then** kiosk lockdown, **then** polish. Each phase ends green on the existing CI gate: `npx tsc --noEmit && npm test`.

### Week 1 — Web Foundation (monorepo + shared core + browser TTS + text chat)
**Deliverables (ordered):**
1. Convert repo to npm workspaces (root `package.json`); move `memoria-app/` → `apps/mobile/`; create `packages/core/`.
2. Move `src/lib` (9 files) + `theme.ts` + `types/` into `packages/core/src`. **Parameterize `supabase.ts` into `createSupabaseClient(env, storage)`** (move creds to env). Update every core module + `AuthContext` to accept the injected client (provider prop or one-time `setClient`).
3. Repoint Expo app imports to `@memoria/core`; give it an **AsyncStorage/SecureStore adapter** (fixes the native cold-start logout). Confirm `npm run check` (tsc + 127 vitest tests) passes.
4. Scaffold `apps/kiosk` (Next.js 15 App Router). Generate `tokens.css` from `theme.ts`; wire Tailwind v4 `@theme`. Port `Icon.tsx`, `Logo.tsx`, `IntensityContext`.
5. Implement `apps/kiosk/lib/tts-web.ts` (same public API; `HTMLAudioElement` + Cache API/IDB + `speechSynthesis`). Port `tts.test.ts` to jsdom/happy-dom fakes.
6. Build a minimal DOM **Assistant page** (text input → `askAssistant` → `tts.speak`) to prove the core + TTS end-to-end in the browser. Confirm the `tts` Edge Function CORS works from a browser.

**Definition of done:** A browser page can type a question, get a real Memo answer threaded via `conversationId`, and hear it spoken in the nova voice; both `apps/mobile` and `apps/kiosk` build; CI green. **Touches:** all `src/lib/*`, `supabase.ts`, `theme.ts`, `AuthContext.tsx`, `tts.ts` (→ `tts-web.ts`), `assistant.ts`, `briefing.ts`.

### Week 2 — Voice-First (wake word, STT, state machine, briefing auto-advance)
**Deliverables (ordered):**
1. Build the custom **"Hey Memo" `.ppn`** in the Picovoice Console (Web/WASM); add assets to `public/porcupine/`. Add Porcupine deps + access key.
2. Implement `lib/voice/stt.ts` (push-to-talk primary; continuous opt-in; Safari→PTT; Firefox→text fallback).
3. Implement `lib/voice/wakeword.ts` (Porcupine + web-voice-processor) with the co-user on/off toggle.
4. Implement `lib/voice/machine.ts` (pure reducer; **unit-test all transitions + barge-in + error path** with Vitest) and `useVoiceLoop(userId)` (binds STT/wake/TTS; holds `conversationId`; navigation intents).
5. Implement the **audio-unlock gate** (`audio-unlock.ts` + `AudioUnlockGate.tsx`).
6. Wire the **Assistant page** to the voice loop; build the **Briefing page** with auto-advance synced to `tts onDone` + `prewarm` N+1 + `duration_ms` max-dwell + `"next/again/stop"` + `markDelivered` on exit. Re-author Ken Burns/SpeakingRing as CSS.

**Definition of done:** Hands-free on Chrome — "Hey Memo, …" wakes, listens, answers aloud with photos; "start my day" runs a fully narrated auto-advancing briefing; barge-in via tap/PTT works; machine transitions unit-tested. **Touches:** new `apps/kiosk/lib/voice/*`, `audio-unlock.ts`, `(kiosk)/assistant`, `(kiosk)/briefing`; reuses `askAssistant`, `getTodaysBriefing`, `resolveSlidePhotos`, `markDelivered`, `tts-web.ts`.

### Week 3 — Kiosk (PWA, fullscreen, wake-lock, routing lock, auth, ambient home)
**Deliverables (ordered):**
1. Build `(kiosk)/layout.tsx` shell (fixed/overflow-hidden/touch-action) mounting AudioUnlockGate → KioskGuard → VoiceMachineProvider → WakeLockKeeper → FullscreenController.
2. Implement **KioskGuard** (role==='user') + routing lock (router.replace, popstate sentinel, no co-user routes, contextmenu/zoom disabled, long-press-clock PIN escape).
3. Build the **ambient idle home** (clock + first name + gradient + mic hint + quiet touch fallbacks) and the **emergency "Who Am I?"** page (reuse `loadEmergencyInfo`/`formatPhone`).
4. Create the **`provision-kiosk` Edge Function** (service-role, co_user-ownership check, `admin.createUser`/`generateLink`) + the `/provision` page (magic-link via `detectSessionInUrl` + email/password fallback). Add the co-user **"Revoke device"** action.
5. Add PWA: `manifest.ts` (display: fullscreen, Logo icons), `@serwist/next` SW (precache + NetworkFirst HTML + CacheFirst Storage photos + today's-briefing cache), prod-only.
6. Accessibility pass (font-size up, ≥88px targets, AAA contrast, single reduced-motion block, focus rings).

**Definition of done:** A provisioned MacBook boots straight into the ambient home with no login, runs full-screen, never sleeps, can't navigate to the dashboard, works offline for an already-viewed briefing, and a co-user can revoke it. **Touches:** new `(kiosk)/layout.tsx`, `(kiosk)/page.tsx`, `(kiosk)/emergency`, `provision/page.tsx`, `manifest.ts`, new `provision-kiosk` Edge Function; reuses `AuthContext`, `EmergencyCardScreen` logic.

### Week 4 — Demo Polish (runbook, motion fidelity, hardening, dry runs)
**Deliverables (ordered):**
1. Write `scripts/demo-mac.sh` (Chrome `--kiosk --app` + `--autoplay-policy` + `--use-fake-ui-for-media-stream` + `caffeinate`) and the runbook.
2. Motion-fidelity diff against the design prototypes (`design_handoff_*` screenshots): tune press-spring approximation, verify gradient ids don't collide, tag rows scroll, reduced-motion forces Off.
3. Tune the "Hey Memo" `.ppn` sensitivity in the actual demo acoustic environment; verify push-to-talk fallback and the wake-word-unavailable state.
4. Harden TTS: object-URL revocation on evict/stop, per-clip token to kill stale `'ended'` listeners, cache self-heal, LRU cap verified.
5. Add a tight CSP (no third-party scripts) to the kiosk; verify the revoke-device path invalidates the persisted refresh token.
6. End-to-end dry runs of both IDLE→briefing and IDLE→Q&A loops on a MacBook in Chrome kiosk; record a backup video.

**Definition of done:** One-command demo launch, brand-faithful motion, robust wake word, no audio leaks/silence, scripted walkthrough rehearsed with a fallback recording. **Touches:** `scripts/demo-mac.sh`, `motion.css`, `tts-web.ts`, kiosk CSP/manifest, voice tuning.

---

## 11. Risks & Open Questions

| Risk | Severity | Mitigation / Open question |
|---|---|---|
| **Browser STT fragmentation** — full support only Chrome/Edge; Safari webkit-prefixed & unreliable continuous; Firefox none. | High (coverage) | Push-to-talk default; force PTT on Safari; text fallback on Firefox. **Demo target is Chrome `--kiosk`, so this is bounded for the demo.** |
| **Browser autoplay policy** — auto-narration is silent until a gesture. | High | AudioUnlockGate "Tap to begin" + every `play()` `.catch → fallbackSpeak`; demo flag `--autoplay-policy=no-user-gesture-required`. Must NOT skip the silent-buffer unlock after a hard reload. |
| **Web Speech privacy** — Chrome streams mic audio to Google servers. | Medium | Co-user-facing disclosure; Porcupine wake is on-device. Open question: do we need a self-hosted/streaming STT before a real (non-demo) deployment? |
| **TTS self-triggering the wake word** during SPEAKING. | Medium | Rely on tap/PTT barge-in for the demo; gate voice barge-in behind a post-speak debounce; consider `getUserMedia` echo cancellation. |
| **Wake-word false/missed triggers** hurt a memory-impaired user. | Medium-High | Tune the custom `.ppn` in the real acoustic environment; always keep a large push-to-talk target. |
| **Porcupine licensing / free tier** — access key required; key ships in the client bundle (activation, not secret); rate/activation-limited. | Medium | Free tier covers a single-device kiosk; monitor usage; degrade to a built-in stock keyword if the `.ppn`/key isn't ready. **Open question: licensing terms for a multi-device hardware rollout.** |
| **Kiosk auth security** — no lock screen; refresh token in `localStorage` (XSS-exfiltratable). | Medium (accepted) | RLS scopes to one sensitivity-filtered patient; kiosk ships read-only patient routes; tight CSP + no third-party scripts; co-user revoke (`admin.signOut`/password rotation). Open question: confirm Supabase refresh-token rotation/reuse-detection settings so an offline kiosk isn't silently logged out. |
| **Singleton re-introduction** (the hybrid's load-bearing failure) — drift between the two apps / SSR session leak. | High | `createSupabaseClient` factory + client injection enforced via lint rule + code review; `@memoria/core` is the only home for AI/data logic; `tools.ts` authority stays server-side. |
| **HEIC in-browser** — browsers can't decode HEIC; `heic2any` WASM can fail/OOM on large/Live-Photo HEIC. | High (imports) | Per-file "could not convert" state + concurrency cap; fallback = server-side conversion in `process-photo` (Deno + libheif/sharp). Not on the demo path. |
| **`taken_at` fidelity** — file uploads lack capture timestamps. | Medium | EXIF → `File.lastModified` → `Date.now()`; Google Photos OAuth (deferred) is the accurate source. Degrades briefing chronology. |
| **Wake Lock support** — auto-released on tab-hide; macOS can still sleep. | Medium | Re-acquire on `visibilitychange`; `caffeinate -dimsu` + disable App Nap during the demo. |
| **SW cache staleness** — a cached briefing could show after a co-user edit. | Low-Medium | Key by `briefing_date`; prefer NetworkFirst online; cap TTS LRU at 50, revoke object URLs on evict. |
| **Routing-lock completeness** — App Router history + hardware Back. | Low | `router.replace` only; popstate sentinel bounces to `/`; no co-user route compiled in; Chrome `--kiosk` removes chrome entirely for the demo. |
| **Supabase magic-link redirect** — origins must be allow-listed or `detectSessionInUrl` parsing fails. | Low | Allow-list the kiosk origin in Supabase Auth; keep provisioning links short-lived (~5 min). |

**Open product questions to resolve with Alex:**
1. Is the demo strictly Chrome-only, or must it survive Safari (which forces push-to-talk and may need a non-Google STT for privacy)?
2. For hardware partnerships, do we keep browser Web Speech STT or commit to a self-hosted/streaming STT for privacy + reliability?
3. Where does the co-user wake-word on/off toggle live in the schema (`users.wake_word_enabled` column vs. a `kiosk_settings` row)?
4. Is a web caregiver dashboard (`apps/admin`) needed soon, or does the Expo app remain the only caregiver surface through the demo?

---

## 12. Immediate Next Steps (start W1 now)

1. **Convert to npm workspaces.** Add root `memoria/package.json` with `"workspaces": ["packages/*", "apps/*"]`; `git mv memoria-app apps/mobile`; create `packages/core` with its `package.json`.
2. **Move the AI/data layer into `@memoria/core`.** Move the 9 reusable `src/lib` files + `theme.ts` + `types/index.ts` into `packages/core/src`. Don't touch their logic.
3. **Parameterize `supabase.ts`** into `createSupabaseClient(env, { storage, storageKey, persistSession, autoRefreshToken, detectSessionInUrl })`; move the hardcoded URL/key to env vars (`NEXT_PUBLIC_*` / `EXPO_PUBLIC_*`). **This is the load-bearing anti-drift step — verify no module re-imports a singleton.**
4. **Repoint the Expo app** at `@memoria/core` and give its client an AsyncStorage/SecureStore adapter (fixes the native cold-start logout). Run `npx tsc --noEmit && npm test` and confirm the 127 tests still pass.
5. **Scaffold `apps/kiosk`** (Next.js 15 App Router). Add `scripts/gen-tokens.ts` (theme → `tokens.css`) and Tailwind v4 `@theme`. Port `Icon.tsx` and `Logo.tsx` to inline `<svg>` (namespace gradient ids with `useId()`).
6. **Write `apps/kiosk/lib/tts-web.ts`** preserving the exact public API; port `tts.test.ts` to jsdom fakes (`HTMLAudioElement` dispatching `'ended'`, in-memory caches/IDB, `speechSynthesis`). Confirm the `tts` Edge Function answers a browser `fetch` (CORS) with audio.
7. **Build a minimal DOM Assistant page** (`(kiosk)/assistant`) wiring `askAssistant → tts-web.speak` to prove the shared core + browser nova TTS end-to-end.
8. **Register for a Picovoice account** and start the custom **"Hey Memo" `.ppn`** build (Web/WASM target) so it's ready for W2 — this has the longest lead time and is the riskiest piece.

> **Prototype the voice loop (steps 6–8) earliest in parallel with the plumbing.** It is the make-or-break, framework-independent work, and the custom wake-word model has external lead time.
