# Home Screen widget (T77, part 1: core + adapter)

Status: **core logic and app-side wiring only, tested in Node with fakes. No widget exists yet, and
nothing here has run on a phone, in a widget extension or against a TV.** The native part needs a
dev build and is described below. The wider plan (Live Activity, Control Center, Swift senders) is
in `docs/widgets.md`.

## How it works

1. The app writes a small **widget snapshot** (JSON) to shared storage whenever what the widget
   should show changes: the current TV, its connection state, and up to 6 buttons.
2. The widget extension draws that snapshot. Each button opens a deep link:
   `couch://widget/<action>?tv=<savedTvId>`.
3. The app receives the link, parses it strictly, drops repeats, switches to that TV if needed and
   sends the action's keys through the normal session, exactly like the remote's own buttons.

Actions: `power`, `volume-up`, `volume-down`, `mute`, `next-input`, `home`, `play-pause`.
They map to `POWER`, `VOL_UP`, `VOL_DOWN`, `MUTE`, `SOURCE`, `HOME`, `PLAY_PAUSE`.

## What is done

| File | What it does |
| --- | --- |
| `src/core/widget/actions.ts` | The action list, `actionKeys(action)` (action to `Key[]` from `src/core/keys.ts`), translated button labels (the remote's own key labels, plus "Next input"), defaults and the 6-button cap. |
| `src/core/widget/links.ts` | `buildWidgetLink` and a strict `parseWidgetLink`. Only `couch://widget/<action>?tv=<id>` is accepted, as a whole string: another scheme or host, upper case, a port or user, a trailing or double slash, a fragment, an empty, extra or repeated parameter, an unknown action, or a TV id outside `[A-Za-z0-9._:-]{1,128}` (after percent-decoding) gives `null`. Never throws. No `URL` class (the React Native polyfill is incomplete). |
| `src/core/widget/tapGate.ts` | `WidgetTapGate`: the same action for the same TV within **250 ms** of the last accepted one is dropped (double taps, a replayed launch URL), and at most 8 links per second go through. Injected clock; survives a clock going backwards. |
| `src/core/widget/snapshot.ts` | `buildWidgetSnapshot` / `serializeWidgetSnapshot` / `parseWidgetSnapshot` (the contract for the native side) and `sameWidgetContent`. Labels are translated in the app's language when built, so the extension needs no catalogue. TV names are tidied and cut at 32 characters. No host, MAC or pairing token goes in. The `plus` flag is a plain boolean passed in by the caller; `src/core` never reads the entitlement. |
| `src/core/widget/bridge.ts` | The `WidgetBridge` port (`setSnapshot(json)`, `reloadTimelines()`) and `UNAVAILABLE_WIDGET_BRIDGE`, a no-op. |
| `src/native/widgetBridge.ts` | Loads the planned `modules/widget-bridge` with a guarded `require` inside a function (the same pattern as `mediaServer.ts`; listed in `tests/native-guard.test.ts`). Without the module (Expo Go, web, tests) it returns the no-op bridge. Native errors are swallowed: a failed write only means a stale widget. |
| `src/ui/widget/linkHandler.ts` | Pure link handling: not a widget link means it is left to the router. A malformed one is swallowed. An unknown TV, or demo mode, sends nothing (never to a different TV). A link that arrives before the saved TVs have loaded (cold start from a widget tap) is held for up to 4 s and sent once they load. Never reads Couch Plus. |
| `src/ui/widget/snapshotSync.ts` | Writes the snapshot only when its content changes, then reloads timelines. Writes go one at a time, in order, and a failed write is retried on the next update. |
| `src/ui/widget/nativeIntent.ts` | `redirectSystemPath` for Expo Router, so a widget link opens the remote instead of the "unmatched route" screen. |
| `src/ui/widget/useWidgetLinks.ts` | The React hook and `<WidgetLinkHost />`: listens to `Linking` (launch URL once per process, then `url` events), feeds the handler, retries a pending link when the session changes, and syncs the snapshot (rebuilt on TV, connection, Plus or language changes). |

New copy: `core.widget.*` (9 keys) in English and in all 10 other catalogues (machine translation,
awaiting native review like the rest).

Tests: `src/core/widget/*.test.ts`, `src/ui/widget/*.test.ts`, `tests/widget-bridge.test.ts`, and
the additions in `tests/native-guard.test.ts`. No npm dependency was added and `app.json` is
unchanged.

## Wiring the lead must add

Two one-line changes in files this task does not own.

1. `app/_layout.tsx`: mount the host inside `<SessionProvider>` (next to `<RatingPromptHost />`):

   ```tsx
   <WidgetLinkHost />
   ```

   with `import { WidgetLinkHost } from '../src/ui/widget/useWidgetLinks';`

2. New file `app/+native-intent.tsx` (otherwise Expo Router tries to open a `/widget/...` route that
   does not exist):

   ```ts
   export { redirectSystemPath } from '../src/ui/widget/nativeIntent';
   ```

Neither touches `app/(tabs)/remote.tsx`. Until the native widget exists, both are harmless: no
widget means no links, and the bridge is a no-op.

## Native part still needed (dev build, not done)

1. **iOS WidgetKit extension through a config plugin.** Preferred: `@bacons/apple-targets` with a
   `targets/couch-widget/` folder (see `docs/widgets.md` section 1); fallback: a hand-written plugin
   (`withXcodeProject` + `withEntitlementsPlist`). Both are owner and dependency decisions. Nothing was
   installed and `app.json` has no new plugin.
2. **App Group** `group.com.jared797.couch.shared` on the app and the extension (created in the Apple
   Developer account by the owner). The snapshot JSON goes into the App Group `UserDefaults` under one
   key, for example `couch.widget.snapshot`.
3. **`modules/widget-bridge`** (a local Expo module). Its default export must have:
   - `setSnapshot(json: string): Promise<void>`: writes to the App Group `UserDefaults` on iOS, or to
     `SharedPreferences` on Android.
   - `reloadTimelines(): Promise<void>`: calls `WidgetCenter.shared.reloadAllTimelines()` on iOS, and
     sends an AppWidget update broadcast on Android.

   Once it exists, `loadWidgetBridge()` picks it up with no JS change.
4. **SwiftUI widget**: reads the snapshot (decode exactly the fields `parseWidgetSnapshot` accepts,
   `version` 1) and draws the TV name, connection label and buttons. With no buttons it draws
   `message` and an "Open Couch" tile (`openUrl`).
   - Before iOS 17, a button is a `Link(destination: url)`, which opens the app.
   - **iOS 17+ interactive widgets**: buttons can use `Button(intent:)` with an `AppIntent` that has
     `openAppWhenRun = true` and opens the same deep link, so the JS handler stays the single sender.
     Sending keys without opening the app (a Swift sender in the extension) is the later step
     described in `docs/widgets.md` section 3. Not part of this task.
5. **Android AppWidget** (or Glance): an `AppWidgetProvider` reading the same JSON from
   `SharedPreferences`, with buttons as `PendingIntent`s that open the `couch://widget/...` deep
   links. The `couch` scheme is already registered by Expo (`"scheme": "couch"` in `app.json`).

## Not verified

- Nothing has run on a device. It is not verified that Expo Router's `redirectSystemPath` and
  React Native's `Linking` `url` event both see the same widget URL, on both platforms, cold and warm.
  The design assumes they do.
- Whether iOS delivers the launch URL through both `getInitialURL` and a `url` event. The 250 ms gate
  only covers repeats close together, and the launch URL is read once per process.
- Latency from a widget tap: the app has to come to the foreground (and on a cold start, restore and
  reconnect the TV) before the key is sent. Saved TVs that load more than 4 s after a cold-start link
  arrives drop that link. No timing was measured.
- How any TV reacts to `POWER` or `SOURCE` sent this way is the driver's normal behaviour. The widget
  adds nothing to it, and it has not been checked on hardware.

## Free or Couch Plus?

Widgets are a **Couch Plus** extra (`widgets` in `PLUS_FEATURES`, PLAN section 5). The decision as
built:

- **Plus decides only whether the widget offers buttons.** Without Plus the snapshot has no buttons,
  only the hint "Widgets come with Couch Plus. Every button in the app stays free." and an "Open
  Couch" tile. The entitlement is read only in `src/ui/widget/useWidgetLinks.ts`, through
  `src/plus/state` (`usePlus().canUse('widgets')`).
- **A widget link that arrives always sends its key**, with or without Plus. The link handler never
  looks at the entitlement, so a lapsed or refunded Plus, or a stale widget, can never block a TV
  control. The remote itself is untouched either way.
- `src/core` and `app/(tabs)/remote.tsx` do not import `src/plus` (test-enforced by
  `tests/plus-guard.test.ts`; `tests/widget-bridge.test.ts` also checks the widget files).
