# Infrastructure record

This app reuses the App Factory's repository and Expo toolchain described in `Desktop/Apps/STARNET_APP_FACTORY_GUIDE.md`, root `docs/SHIPPING.md` and `docs/RELEASE_STANDARD.md`. It is repo-direct, like the newer apps, and has no Claude artifact writer or scheduled build worker. Codex writes this owned branch; code joins the shared release line through a pull request.

| Existing infrastructure | Application here |
|---|---|
| `apps/<app>` | `apps/meow-manager`, independently installed with its own lockfile. |
| Expo SDK 57 / Router / React Native | Package versions inherited from the current app fleet and checked with `expo install --check`. No fleet SDK upgrade. |
| Pure TypeScript core + Node tests | `src/core/` owns capture, state validation, day planning and reminder eligibility. It has no native imports. |
| AsyncStorage | One versioned `meow-manager.world.v1` document. Writes are serialised. A bad load blocks editing and preserves the source value. |
| Device adapters | `src/native/services.ts` uses lazy Expo imports and reports unsupported/denied/failed outcomes. |
| GitHub `check.yml` | Existing manual app input checks this branch, installs, aligns dependencies, typechecks, tests and exports both mobile bundles. The new app needs no changes to other apps or workflows. |
| GitHub `preview.yml` | A future merge containing `EXPO_GO_PREVIEW` can use the fleet's existing preview publication path. No preview/release is claimed until a receipt exists. |
| TestFlight release workflows | Existing `ship`/`ship-mac`, EAS profiles and App Store Connect tooling remain the native release route. No `RELEASE.json` trigger is included in this first build. |

`app/index.tsx` implements the four screens and task sheets; `src/components/Cat.tsx` contains original SVG character/room art and reduced-motion-aware animation. All UI strings live in a typed English/Japanese catalog. The phone language is selected at first launch and can be changed in settings.

## Reminder and calendar behaviour

Reminder scheduling uses stable `meow:<task id>` notification identifiers. Reconciliation removes obsolete app-owned requests and retains matching requests. At most the next 48 reminders are scheduled, leaving room under iOS's pending-notification limit. Later reminders are added when the app opens; the interface reports this limit. Permission is requested only after the user selects a reminder action, not at first launch. No push server or push token is used.

Calendar reading requests access when tapped, reads only today's events from the device calendars, and holds them only in memory. All-day and busy events block time; canceled/free events do not. Returning to the app invalidates the snapshot so the user can refresh. Today's plan does not silently assume an old calendar snapshot is current. The system calendar editor handles event creation. A chosen calendar provider may sync the user's event according to its own settings.

Native permission prompts, reminder delivery after backgrounding, reboot behaviour, notification deep opening, calendar read/write and speech still require real-device verification. Browser testing cannot establish those outcomes.

## Adding open-ended AI and connected actions

The next integration should use a server-held provider credential, explicit data consent and structured task/calendar tools. Provider secrets must never be compiled into the mobile app. The local task store remains usable when a provider is unavailable. Every external mutation needs a preview of the exact action, an explicit user action where appropriate, an idempotency key and a result receipt; the cat may say it succeeded only after checking the result. Email sending, reservations and payments each need real connectors and their own outcome handling. These are integration requirements, not present capabilities.
