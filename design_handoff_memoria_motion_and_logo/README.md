# Handoff: Memoria — Forget-me-not Logo + App-wide Motion System

## Overview

This package specifies two related pieces of work for the **Memoria** React Native app
(a memory-care app: a **user** side for a person with memory loss, and a **co-user** side
for their caregiver):

1. **A new brand logo** — a forget-me-not flower mark that replaces the old chevron (`∧`),
   including an animated **"bloom on open"** treatment on the sign-in screen.
2. **An app-wide motion system** — calm, breathing, "alive" motion across the sign-in,
   briefing, and the entire co-user flow (Home, People, Photos, Events, Notes, Review Queue,
   Edit Person, Sensitivity Filters, Generate Briefing), plus shared primitives: staggered
   entrance, press feedback, item-exit, branded loaders, and alive empty states.

The guiding principle is **calm, not flashy**. Memoria serves people with cognitive
impairment, so motion must be reassuring and slow — gentle tides, drifting light, soft
blooms. The co-user (caregiver) screens may be slightly more spirited but still calm.

---

## About the Design Files

The files in `reference_prototypes/` are **design references built in HTML/React (web)** —
working prototypes that show the intended look and motion. **They are not production code
to copy directly.** Your job is to **recreate them in the Memoria React Native codebase**
using its existing patterns, tokens, and component structure.

The single best way to view them: open `reference_prototypes/memoria-motion.html` in a
browser. It has a screen switcher (User / Co-user groups) and a **Tweaks** panel
(top-right) with an **Intensity** control (Off / Subtle / Calm / Rich) — set it to **Subtle**
(the chosen default) and click between tabs to watch each screen animate in.

`screenshots/` contains a still of each screen (captured with motion settled) as the visual
source of truth.

## Fidelity: HIGH (hi-fi)

These are **pixel- and motion-accurate** mockups. Match them exactly. This is achievable
because everything you need is specified verbatim below and reproduces 1:1 in React Native:

- **The logo** is plain SVG (a `<path>` + two radial gradients). `react-native-svg` renders
  the identical path and gradient stops — **copy the values verbatim**, do not redraw.
- **The motion** is plain CSS keyframes with exact durations/easings. `react-native-reanimated`
  (or `moti`) reproduces the same timings and cubic-bezier easings — **copy the numbers**.
- **Colors, spacing, radii, type** already live in the app's `src/theme.ts`. **Reuse those
  tokens** (see Design Tokens below) — do not hardcode new hex values except the logo's
  gradient stops (which are new and listed here).

### Required libraries
- **`react-native-svg`** — for the forget-me-not logo + the existing custom icon set.
- **`react-native-reanimated`** (v3+) — for all motion. `moti` on top is fine and will make
  staggers/entrances terser. Use whichever the codebase already has; if neither, add
  `react-native-reanimated`.
- **Gradients on non-SVG surfaces** (button glows, tiles) — use `expo-linear-gradient` if the
  app is Expo, else `react-native-linear-gradient`. Most "glows" here are better done as
  `shadowColor`/`elevation` or a `<RadialGradient>` inside an SVG.

---

## PART 1 — The Logo (forget-me-not)

### Geometry (copy verbatim into `react-native-svg`)

- **viewBox:** `0 0 48 48`
- **One petal path** (`d`), pointing up, with a soft notch at the tip:
  ```
  M24 21.5 C19.6 20.8 16.4 18 16 13.9 C15.7 10.1 18.6 7.3 21.6 7.7 C22.8 7.9 23.4 8.9 24 10 C24.6 8.9 25.2 7.9 26.4 7.7 C29.4 7.3 32.3 10.1 32 13.9 C31.6 18 28.4 20.8 24 21.5 Z
  ```
- **Five petals:** render the same path 5×, each rotated about the flower center:
  `transform="rotate(${i*72} 24 24)"` for `i = 0..4`.
- **Petal fill:** radial gradient (see below). **Petal stroke:** `#ffffff` at opacity `0.12`,
  width `0.5` (a faint rim that separates overlapping petals).
- **The "eye"** (center), three stacked circles at `cx=24 cy=24`:
  1. `r=4.5` fill `#fdfdff` (white ring)
  2. `r=2.8` fill `url(#eye-grad)` (golden corona)
  3. `r=0.95` fill `#d89a2c` (throat)

### Gradients

**Petal — radial, `gradientUnits="userSpaceOnUse"`, `cx=24 cy=24 r=17`:**

| variant | stop 0% | stop 48% | stop 100% |
|---|---|---|---|
| **Brand purple ← USE THIS** | `#ddc8ff` | `#9c6bff` | `#7340d8` |
| True-to-life blue (reference) | `#aed1f2` | `#5e92d8` | `#487ccb` |
| Periwinkle (reference) | `#cdd2f6` | `#8a90e6` | `#6c72d6` |

> The user chose **Brand purple** so the mark matches the app's existing palette. The blue/
> periwinkle stops are included only for context — **do not use them** unless asked.

**Eye — radial, `cx=50% cy=42% r=60%`:** `0% #fff3c4` → `60% #f6c64f` → `100% #e7a92f`.

### Reference RN implementation (react-native-svg)

```tsx
import Svg, { Path, Circle, RadialGradient, Stop, Defs, G } from "react-native-svg";

const PETAL =
  "M24 21.5 C19.6 20.8 16.4 18 16 13.9 C15.7 10.1 18.6 7.3 21.6 7.7 C22.8 7.9 23.4 8.9 24 10 C24.6 8.9 25.2 7.9 26.4 7.7 C29.4 7.3 32.3 10.1 32 13.9 C31.6 18 28.4 20.8 24 21.5 Z";

export function Logo({ size = 48 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Defs>
        <RadialGradient id="petal" cx="24" cy="24" r="17" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#ddc8ff" />
          <Stop offset="0.48" stopColor="#9c6bff" />
          <Stop offset="1" stopColor="#7340d8" />
        </RadialGradient>
        <RadialGradient id="eye" cx="50%" cy="42%" r="60%">
          <Stop offset="0" stopColor="#fff3c4" />
          <Stop offset="0.6" stopColor="#f6c64f" />
          <Stop offset="1" stopColor="#e7a92f" />
        </RadialGradient>
      </Defs>
      {[0, 1, 2, 3, 4].map((i) => (
        <Path key={i} d={PETAL} transform={`rotate(${i * 72} 24 24)`}
          fill="url(#petal)" stroke="#ffffff" strokeOpacity={0.12} strokeWidth={0.5} />
      ))}
      <Circle cx={24} cy={24} r={4.5} fill="#fdfdff" />
      <Circle cx={24} cy={24} r={2.8} fill="url(#eye)" />
      <Circle cx={24} cy={24} r={0.95} fill="#d89a2c" />
    </Svg>
  );
}
```

Reference source: `reference_prototypes/memoria-icons.jsx` (`FlowerGlyph`) and
`reference_prototypes/memoria-flower-real.jsx` (the colorway studies).

### Where the logo is used
- **Sign-in screen** — large (≈90px), glowing, animated (see Part 2 → Sign-in bloom).
- **App icon / favicon** — static brand-purple flower. Holds up down to 16px.
- **Loaders & empty states** — the same flower, breathing (replaces the old chevron mark).
- Replace the old `mark` (chevron) glyph in `src/components/Icon.tsx`, or add a dedicated
  `<Logo>` component and point usages at it.

### Existing icon set
The app already has a custom rounded-stroke icon set in `src/components/Icon.tsx` (24px grid,
2px stroke). The flower shares that visual language. Keep using `Icon` for UI glyphs; use
`<Logo>` only for the brand mark.

---

## PART 2 — Motion System

### Intensity model
All motion scales with a single **Intensity** setting. Ship **Subtle** as the default. Model:

```
amp = { Off: 0, Subtle: 0.5, Calm: 1, Rich: 1.6 }[intensity]
on  = intensity !== "Off"
speed = max(amp, 0.5)        // animation durations are divided by speed
```

When `on` is false, render everything in its final static state (no animation). Honor the OS
"Reduce Motion" setting by treating it as `Off`.

> **Note on the concrete millisecond values below:** they are written for **Subtle**
> (`speed = 0.5`), i.e. the shipped default, so durations look large (a CSS `0.9s/speed` =
> `1.8s`). If you implement the `amp` model, use the *base* values (the numerator) and divide
> by `speed`. If you hardcode one intensity, use the Subtle numbers as-is.

### Core primitives (used everywhere)

**1. Staggered entrance ("rise").** Children fade up as a screen mounts.
- Per item: `opacity 0→1`, `translateY 16px→0`.
- Easing `cubic-bezier(.2,.7,.3,1)`, base duration `0.55–0.6s`, `fill: both`.
- **Stagger:** delay `≈ 0.12s + index * 0.07s` (lists), `0.14s + i*0.08s` (cards).
- Reanimated: `FadeInDown.duration(600).delay(i*70)` (with `moti`/Layout animations) or a
  shared `entering` transition.

**2. Press feedback (spring).** Every tappable element.
- On press-in: `scale → 0.96` (cards `0.94`, big buttons `0.965`), `brightness 0.93`.
- Spring back on release. Easing `cubic-bezier(.34,1.56,.64,1)` (overshoot), ~`160ms`.
- Reanimated: `useSharedValue` scale + `withSpring`, or `Pressable` + `Animated`.

**3. Item exit.** When a row/card is approved/deleted, it animates out before removal.
- `opacity 1→0`, `translateX 0→40px`, `scale 1→0.96`, `max-height 200→0` (collapse).
- Easing `cubic-bezier(.4,0,1,.6)`, `~460ms`. Remove from state after it completes.
- Reanimated: `Layout` + `exiting={SlideOutRight}` or animate height to 0.

**4. Branded loader.** Replaces plain spinners.
- The **forget-me-not breathes** (`scale 1↔1.06`, `~2.6s/speed` ease-in-out, infinite) with
  1–2 **pulse rings** expanding behind it (`scale 1→1.9`, `opacity .55→0`, `~2.4s/speed`,
  staggered). Caption text glows (`opacity .62↔1`, soft text-shadow).

**5. Alive empty state.** Never a dead screen.
- An icon in a soft tinted circle that **floats** gently (`translateY 0↔-8px`, `~5s/speed`).
- "All caught up" check **draws itself on** (SVG `stroke-dashoffset len→0`, `~0.7s`,
  `cubic-bezier(.5,0,.2,1)`, delay `.3s`). For brand moments use the breathing flower instead.

### Sign-in "bloom on open" (the hero moment)

When the sign-in screen mounts, the forget-me-not **unfurls**. Three layered animations on the
`<Logo>` (base values; divide by `speed`):

1. **Whole flower** — `transform: scale(0.12) rotate(-38deg) → scale(1) rotate(0)`,
   easing `cubic-bezier(.34,1.42,.5,1)` (slight overshoot), duration `0.9s`, delay `0.1s`,
   `fill: both`, transform-origin **center**.
2. **Petals** — each `opacity 0→1`, duration `0.42s`, ease, **staggered** delay
   `0.18s + i*0.09s` (`i=0..4`). They appear to light up one by one as the flower scales open.
3. **Eye** — `opacity 0→1`, duration `0.55s`, delay `≈0.56s` (after the last petal).

The wordmark "Memoria" then **breathes** (soft glow pulse, `opacity .62↔1` + text-shadow,
`~6s/speed`). Inputs **bloom a focus glow** when focused (`box-shadow → 0 0 0 2px #7c4dff,
0 0 22px rgba(124,77,255,0.45)`, bg `#2a2a4a→#30305a`, `~0.4s`). The primary button has a slow
**shimmer sweep** and a press ripple.

> RN approach: wrap `<Logo>` in an `Animated.View` for the scale+rotate (origin center is the
> default). Drive each petal's `opacity` with its own shared value + staggered `withDelay`,
> using `AnimatedProp` on `<Path>` (react-native-svg paths accept animated props via
> `Animated.createAnimatedComponent(Path)`). The eye is one more delayed opacity.
> Reference: `reference_prototypes/memoria-signin.jsx` (`BrandMark`) and the keyframes
> `m-bloom`, `m-fade-in`, `m-eye-pop` in `memoria-motion.html`.

---

## Per-screen spec

Each screen below: archetype + what animates. All share the core primitives above. Real
codebase files are named in **(parens)**. Screenshots in `screenshots/`.

### User side
- **Sign-in** *(auth/LoginScreen)* — the bloom (above) + breathing wordmark + focus-glow
  fields + shimmer button + drifting ambient background (default **Aurora + Orbs**: a slow
  aurora wash with soft "memory orbs" rising). `01-signin-bloom.png`
- **Briefing** *(user/BriefingScreen)* — the daily deck. Photos get a slow **Ken Burns**
  pan/zoom (`scale 1→~1.12`, `~16s/speed`, alternate); slides **cross-dissolve** + rise;
  a soft **speaking ring** pulses around the replay button while Memo talks; section tint
  shifts per slide; progress bar fills with a spring + glow. `02-briefing.png`
- **Memo chat** *(user chat)* — messages glide in, a breathing typing-dot indicator, a soft
  speaking glow on Memo's reply. (Reference: `memoria-chat.jsx`.)
- **Emergency** *(couser/EmergencyContactSettingsScreen / user emergency card)* — a slow,
  reassuring heartbeat halo behind the icon, a gentle breathing glow on the accent border, a
  calm staggered reveal, optional pulsing Call button. (Reference: `memoria-emergency.jsx`.)

### Co-user side
- **Home** *(couser/CoUserHomeScreen)* — dashboard action cards **rise in staggered**; the
  primary "Generate Briefing" card has a purple glow; the Review badge breathes; press-spring
  on every card. `03-home.png`
- **People** *(couser/ViewPeopleScreen)* — avatar rows stagger in; "Add a person" primary;
  Loaded/Loading/Empty states with the **breathing flower loader** and an alive empty state.
  `04-people.png`
- **Photos** *(couser/ViewPhotosScreen)* — 2-col tile grid staggers in; filter pills
  (All/Pending/Verified) swap the grid; brand status badges (check/pending/block) in colored
  chips; tiles press-spring. `05-photos.png`
- **Events** *(couser/ViewEventsScreen)* — a vertical **timeline** reveals top-down; the
  soonest event node glows purple. `06-events.png`
- **Notes / Memo's Notes** *(couser/AIMemoryScreen)* — fact rows stagger in; pinned/suppressed
  status; Pin/Suppress/Delete; **row animates out** on action; breathing loader + empty.
  (Reference: `memoria-lists.jsx`.)
- **Review Queue** *(couser/FlagQueueScreen)* — flag cards stagger in; **Approve/Reject/Hide**
  animates the card out, queue settles, ends on a calm "all caught up" empty state.
  `07-review.png`
- **Edit Person** *(couser/EditPersonScreen)* — form fields stagger in and **bloom a focus
  glow**; an animated toggle (knob springs across); Save button shimmers. Same pattern applies
  to **Setup User Login** *(couser/SetupUserLoginScreen)* and **Emergency Contact Settings**.
  `08-edit-person.png`
- **Sensitivity Filters** *(couser/SensitivityFiltersScreen)* — toggle rows (knob spring) +
  a detail **slider** that fills smoothly with a glowing thumb; staggered reveal. `09-filters.png`
- **Generate Briefing** *(couser/BriefingPreviewScreen)* — tap Generate → the brand flower
  **breathes while assembling** → shimmer placeholder bars → briefing cards **reveal one by
  one** with check marks. `10-generate.png`
- **Life Facts** *(couser/ViewLifeFactsScreen)* — same list archetype as Notes/People.
- **Import / Onboarding** *(couser/import, couser/onboarding)* — apply the same primitives
  (staggered entrance, press feedback, focus-glow fields, branded loader).

> **Archetype shortcut:** most co-user screens are one of four archetypes — **List**
> (People, Notes, Life Facts), **Grid** (Photos), **Card-review** (Review Queue), **Form**
> (Edit Person, Setup Login, Emergency Settings, Filters). Build one reusable animated wrapper
> per archetype and every screen falls into place.

---

## Design Tokens (from the app's `src/theme.ts` — reuse, don't reinvent)

**Colors**
- `bg #1a1a2e` · `surface #2a2a4a` · `surfaceSunk #22223a` · `surfaceRaised #3a3a5a`
- `primary #7c4dff` · `primaryDeep #5e35b1` · `primarySoft #b388ff`
- `fg #e0e0e0` · `fgStrong #ffffff` · `fgMuted #888888`
- `danger #ff6b6b` · `success #4caf50` · `info #2196f3`

**Radii** — `sm 12 · md 14 · lg 16 · xl 18 · xxl 20 · pill 24 · full 999`

**Type scale (px)** — `display 48 (wordmark) · greeting 36 · title 32 · bigBtn 28 · h2 24 ·
h3 22 · xl 20 · lg 18 · md 17 · base 16 · sm 14 · xs 13 · xxs 11`. Weights: regular `400`,
medium `600`, bold `700`. System font (SF Pro on iOS) — leave `fontFamily` unset.

**New values introduced by this work** (not in theme — add if you want them tokenized):
- Logo petal gradient: `#ddc8ff → #9c6bff → #7340d8`
- Logo eye gradient: `#fff3c4 → #f6c64f → #e7a92f`, throat `#d89a2c`
- Status badge fills: verified `#1b5e20`, pending `#ffab40`, hidden/blocked `#b71c1c`

---

## Keyframe reference (from `memoria-motion.html`)

Exact base values, for translating to Reanimated. `speed = max(amp, 0.5)`; divide durations by `speed`.

| name | from → to | base dur / easing |
|---|---|---|
| `m-rise` | `opacity 0, translateY 16px` → `opacity 1, translateY 0` | 0.55–0.6s / `cubic-bezier(.2,.7,.3,1)` |
| `m-leave` | `opacity 1, x 0, scale 1, maxH 200` → `opacity 0, x 40px, scale .96, maxH 0` | 0.46s / `cubic-bezier(.4,0,1,.6)` |
| `m-bloom` | `scale .12 rotate -38deg` → `scale 1 rotate 0` | 0.9s / `cubic-bezier(.34,1.42,.5,1)` |
| `m-fade-in` | `opacity 0` → `1` | 0.42s / ease |
| `m-eye-pop` | `opacity 0` (hold to 60%) → `1` | 0.55s / ease |
| `m-breathe` | `scale 1 ↔ 1.06` | 2.6s / ease-in-out, infinite |
| `m-float` | `translateY 0 ↔ -8px` | 5s / ease-in-out, infinite |
| `m-pulse-ring` | `scale 1, opacity .55` → `scale 1.9, opacity 0` | 2.4s / ease-out, infinite |
| `m-glow` | `opacity .62 ↔ 1` + text-shadow | 6s / ease-in-out, infinite |
| `m-shimmer` | `translateX -160% skewX -12deg` → `320%` | 4.5–5s / ease-in-out, infinite |
| `m-draw` | `stroke-dashoffset len → 0` | 0.7s / `cubic-bezier(.5,0,.2,1)` |
| `m-kenburns-a/b/c` | `scale 1 → ~1.12`, slight translate | 16s / ease-in-out, alternate |
| `m-slide-in` | `opacity 0, translateY 22px, scale .985` → settled | 0.65s / `cubic-bezier(.2,.7,.3,1)` |
| `m-tint-in` | `opacity 0 → 0.85` (section tint) | 1.1s / ease |
| `m-pulse-ring` (speaking) | ring scale/opacity, staggered ×3 | 2.6s / ease-out, infinite |

---

## Files in this package

```
reference_prototypes/
  memoria-motion.html      ← OPEN THIS. Master preview: switcher + Tweaks(Intensity).
  memoria-icons.jsx        ← custom icon set + FlowerGlyph (the logo) + entrance helpers
  memoria-signin.jsx       ← sign-in + the bloom (BrandMark) + ambient backgrounds
  memoria-flower-real.jsx  ← forget-me-not colorway studies (blue / periwinkle / purple)
  memoria-briefing.jsx     ← briefing deck (Ken Burns, cross-dissolve, speaking ring)
  memoria-home.jsx         ← co-user dashboard (staggered cards)
  memoria-lists.jsx        ← Notes (list + loader + empty + row-exit)
  memoria-couser.jsx       ← People / Photos / Events / Review Queue
  memoria-forms.jsx        ← Edit Person / Sensitivity Filters / Generate Briefing
  memoria-chat.jsx         ← Memo chat
  memoria-emergency.jsx    ← emergency card
  ios-frame.jsx, tweaks-panel.jsx, design-canvas.jsx  ← preview scaffolding (not app code)
screenshots/               ← 01..10, one settled still per key screen
README.md                  ← this file
```

## Suggested implementation order
1. **`<Logo>`** component (react-native-svg) — verify it matches `screenshots/01` + favicon sizes.
2. **Motion primitives** — a `useIntensity()` hook (amp/speed/reduce-motion), an `<AnimatedEntrance>`
   stagger wrapper, a `<Pressable>` press-spring, a `<BrandLoader>`, an `<EmptyState>`.
3. **Sign-in** — swap chevron → `<Logo>`, add the bloom, focus-glow fields, shimmer button.
4. **Co-user archetypes** — List / Grid / Card-review / Form wrappers; apply to each screen.
5. **Briefing** — Ken Burns + cross-dissolve + speaking ring.
6. QA against each screenshot at Intensity = Subtle.
```
