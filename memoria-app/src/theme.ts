/**
 * Memoria — design tokens for the React Native app.
 *
 * Every screen used to hardcode hex values inline (#7c4dff, #2a2a4a, …).
 * Import from here instead so the whole app shares one source of truth:
 *
 *   import { colors, radius, type } from "../theme";
 *   ...
 *   container: { backgroundColor: colors.bg },
 *   button:    { backgroundColor: colors.primary, borderRadius: radius.md },
 */

export const colors = {
  // surfaces (cool-purple dark world)
  bg: "#1a1a2e",            // every screen background
  surface: "#2a2a4a",       // cards · buttons · inputs · bubbles
  surfaceSunk: "#22223a",   // inset panels
  surfaceRaised: "#3a3a5a", // avatars · chips · selected

  // purple accent ramp
  primary: "#7c4dff",       // all primary actions
  primaryDeep: "#5e35b1",   // pressed / secondary purple
  primarySoft: "#b388ff",   // labels · subtitles · headings

  // text
  fg: "#e0e0e0",            // default body (soft off-white)
  fgStrong: "#ffffff",      // card values · text on purple
  fgMuted: "#888888",       // placeholder
  fgMutedDim: "#666666",    // dim placeholder

  // semantic
  danger: "#ff6b6b",        // emergency · sign-out · safety · flag
  dangerAlt: "#ff5252",     // destructive
  success: "#4caf50",       // briefing approved
  info: "#2196f3",          // briefing delivered
} as const;

/** Corner radii used across the app. */
export const radius = {
  sm: 12,   // cards · inputs · stat cards · action rows
  md: 14,   // nav / back buttons
  lg: 16,   // secondary buttons · briefing photo
  xl: 18,   // chat bubbles
  xxl: 20,  // big "Start My Day" button · emergency card
  pill: 24, // chat text input
  full: 999,// circular send / replay · avatars · badges
} as const;

/** Border widths. The app is flat — borders, not shadows. */
export const border = {
  accent: 4,    // dashboard left-accent
  thin: 2,      // secondary-button outline
  emphatic: 3,  // emergency card outline
} as const;

/**
 * Type scale (numeric, for RN StyleSheet). The platform system font is
 * used by default (SF Pro on iOS) — leave fontFamily unset.
 */
export const type = {
  display: 48,  // "Memoria" wordmark on auth screens
  greeting: 36, // "Good Morning" on user home
  title: 32,    // screen titles, briefing headline
  bigBtn: 28,   // "Start My Day" / emergency value
  h2: 24,       // card values, contact name, stat number
  h3: 22,       // large secondary buttons
  xl: 20,       // nav title, briefing subtitle
  lg: 18,       // body / action-button labels
  md: 17,       // chat input
  base: 16,     // default body, links
  sm: 14,       // uppercase labels
  xs: 13,       // badge
  xxs: 11,      // stat-card caption

  weightRegular: "400" as const,
  weightMedium: "600" as const,
  weightBold: "700" as const,

  trackingLabel: 2, // letterSpacing for uppercase emergency labels
} as const;

export const theme = { colors, radius, border, type };
export default theme;
