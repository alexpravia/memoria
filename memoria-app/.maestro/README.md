# Maestro UI Smoke Tests

> ⏸️ **PAUSED during AI-native migration (May 2026).** Do not extend. Will revisit before TestFlight.
>
> The `maestro:*` package scripts have been renamed with a leading underscore (e.g. `_maestro:test`) so they are preserved but inert. Re-enable them by removing the underscore once the AI-native migration is complete and the new test harness has stabilized.

End-to-end smoke flows for the Memoria app, driven by [Maestro CLI](https://docs.maestro.dev/).

## Local iOS Setup

Memoria is still a plain Expo-managed app, so the first Maestro setup targets Expo Go on the iOS simulator. A small wrapper script terminates any stale Expo Go instance on the booted simulator, relaunches it, opens the running Expo project with `simctl openurl`, and then hands off to Maestro for UI assertions and interactions.

## Prerequisites

1. Java 17+.
2. Maestro CLI installed with `curl -fsSL "https://get.maestro.mobile.dev" | bash`.
3. Xcode plus a booted iOS Simulator.
4. Expo dev server running via `npm run ios` from `memoria-app/`.
5. Seeded Supabase test accounts for the authenticated user and co-user flows.

## Environment Variables

| Variable | Description |
|---|---|
| `EXPO_URL` | Expo Go URL for the running app. The scripts default to `exp://127.0.0.1:8081`. |
| `MAESTRO_DEVICE_ID` | Optional simulator UDID. If omitted, the wrapper uses the first booted simulator. |
| `MAESTRO_USER_EMAIL` | Email for the test `user` account. |
| `MAESTRO_USER_PASSWORD` | Password for the test `user` account. |
| `MAESTRO_COUSER_EMAIL` | Email for the test `co_user` account. |
| `MAESTRO_COUSER_PASSWORD` | Password for the test `co_user` account. |

Example shell setup:

```bash
export EXPO_URL=exp://127.0.0.1:8081
export MAESTRO_USER_EMAIL=testuser@example.com
export MAESTRO_USER_PASSWORD=testpassword123
export MAESTRO_COUSER_EMAIL=testcouser@example.com
export MAESTRO_COUSER_PASSWORD=testpassword123
```

## Quick Start

```bash
# Terminal 1
cd memoria-app
npm run ios

# Terminal 2
cd memoria-app
npm run maestro:test
```

If Expo starts on a different host or port, override it when you run the flow:

```bash
EXPO_URL=exp://127.0.0.1:8082 npm run maestro:test
```

## Available Flows

| Flow | File | What it covers |
|---|---|---|
| Local iOS Login Screen | `ios-local-login-screen.yaml` | Bootstrap Expo Go to the running project and verify the Memoria login screen renders. |
| Login -> Briefing | `login-to-briefing.yaml` | Log in as a user, verify User Home, enter Briefing, advance one slide, and exit back home. |
| Login -> Emergency Card | `login-to-emergency-card.yaml` | Log in as a user, verify User Home, open Emergency Card, and return home. |
| Co-user People Edit | `couser-smoke.yaml` | Log in as a co-user, verify the dashboard, open People, edit the first person, save, and return to the dashboard. |

## Package Scripts

| Script | What it does |
|---|---|
| `npm run maestro:check` | Prints the installed Maestro CLI version. |
| `npm run maestro:studio` | Opens Maestro Studio for live inspection and flow authoring. |
| `npm run maestro:test` | Runs the login-screen smoke flow. |
| `npm run maestro:test:user:briefing` | Runs the authenticated user briefing smoke flow. |
| `npm run maestro:test:user:emergency` | Runs the authenticated user emergency-card smoke flow. |
| `npm run maestro:test:co-user` | Runs the authenticated co-user smoke flow. |
| `npm run maestro:test:all` | Runs every flow in `.maestro/`. |

## Running Specific Flows

```bash
npm run maestro:test
npm run maestro:test:user:briefing
npm run maestro:test:user:emergency
npm run maestro:test:co-user
npm run maestro:test:all
```

## Failure Artifacts

The wrapper writes Maestro artifacts to `.maestro/artifacts` and debug output to `.maestro/debug`.

## Login Stability

The authenticated flows explicitly verify that the email field contains the expected address before they continue. This guards against flaky text entry on the iOS simulator where a tap can succeed but the text input does not actually land in the email field.

On iOS, the simulator can also show a system-level `Save Password?` sheet after the password field is filled. The authenticated flows dismiss that sheet before tapping the app's login button so the submit step remains reachable.

## Selector Strategy

The flows target React Native `testID` values via Maestro `id:` selectors. The automation hooks are semantic and stable, for example `login-email-input`, `user-home-briefing-button`, `briefing-slide-text`, and `co-user-home-view-people`.

## Scope & Limitations

- This setup is Expo Go on iOS simulator first. It does not add a native iOS project, Expo dev client, or CI build pipeline.
- The authenticated flows require pre-seeded Supabase accounts and representative app data.
- Permission-heavy flows such as contacts, calendar, photos, notifications, and TTS are intentionally out of scope for the first smoke suite.
