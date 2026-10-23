# iOS widgets, Live Activity and Control Center: plan

Status: plan only. No code, packages or targets have been added. Owner decisions are marked **Decide**.

These are Couch Plus extras (PLAN section 5). The rule still holds: every button inside the app is free
forever. Plus only adds *extra places* to press a few of those buttons (Home Screen, Lock Screen,
Control Center, Dynamic Island). The app never removes or locks a control.

## 1. How the target gets built

- **Preferred: `@bacons/apple-targets`** (Expo config plugin that generates Xcode targets from a
  `targets/` folder on `npx expo prebuild`). It supports `widget` (WidgetKit + Live Activity, same
  extension) and `control` style targets, keeps Swift source in the repo and survives prebuild with
  `--clean`. Needs a dev-client build (not Expo Go), which we already require for LAN sockets.
- Fallback: a hand-written Expo config plugin (`withXcodeProject` + `withEntitlementsPlist`) that copies
  a prepared extension folder. More upkeep; only if `@bacons/apple-targets` lags behind SDK 55.
- Swift sources live in `targets/couch-widgets/` (WidgetKit + ActivityKit + AppIntents, iOS 17+;
  Control Center controls need iOS 18+). **Decide:** minimum iOS for the extension (suggest 17.0, with
  controls gated by `#available(iOS 18, *)`).
- One extension, three surfaces:
  1. Home/Lock Screen widgets (small: Power + last TV name; medium: Power, Vol -/+, Mute, Play/Pause;
     accessory circular/rectangular for the Lock Screen).
  2. Live Activity (Lock Screen banner + Dynamic Island): volume -/+, mute, play/pause for the active TV
     while a "watching" session is running. Started from the app only.
  3. Control Center controls (iOS 18 `ControlWidgetButton`): Power toggle and Mute for the last TV.

## 2. Sharing data with the extension (App Group)

- App Group `group.<bundle id>.shared` added to both the app and the extension entitlements.
- The app mirrors a small, read-only **widget snapshot** into the App Group `UserDefaults` whenever the
  saved TVs change: `{ version, lastUsedId, tvs: [{ id, name, platform, host, mac?, port? }] }` plus the
  pairing token only for platforms that need it per request (Samsung token, LG client-key, Philips
  credentials). Tokens go to the shared **Keychain access group**, not UserDefaults.
- Writing the snapshot needs a tiny native module (`SharedGroupPreferences`-style, or an Expo module in
  `modules/couch-shared/`). The JS side would live in `src/plus/` and read the existing `SavedTvStore`;
  it must not be imported from any control path (tests/plus-guard.test.ts).
- `WidgetCenter.shared.reloadAllTimelines()` / `ControlCenter.shared.reloadAllControls()` after each
  write.
- Plus entitlement is mirrored into the snapshot (`plus: true`). Widgets without Plus show a single
  "Open Couch" tile that deep-links into the app; they never show a fake or broken remote.

## 3. Which intents send keys, and how

Interactive widgets and controls run `AppIntent.perform()` **inside the extension process**, without
launching the app. So the extension needs its own minimal Swift sender for the simplest LAN protocols:

| Intent | Keys | Platforms the extension can reach directly |
| --- | --- | --- |
| `PowerIntent(tvId)` | POWER (or Wake-on-LAN magic packet if the TV is off and we have a MAC) | Roku (ECP HTTP POST), Sony (IRCC over HTTP + PSK), Philips (JointSPACE HTTP), Samsung (WebSocket, token), LG (WebSocket, client-key) |
| `VolumeIntent(tvId, up/down)` | VOL_UP / VOL_DOWN | same |
| `MuteIntent(tvId)` | MUTE | same |
| `PlayPauseIntent(tvId)` | PLAY_PAUSE | same |

- Roku, Sony and Philips are single HTTP requests: easy and reliable from an extension.
- Samsung and LG need a short WebSocket handshake with the saved token; doable with
  `URLSessionWebSocketTask` but each press costs a connect (~200-600 ms).
- **Android TV remote v2** (TLS + protobuf, client certificate) and **IR** are not attempted from the
  extension. For those, the intent uses `openAppWhenRun = true` / `OpenIntent` and the app sends the key.
- Wake-on-LAN: a UDP broadcast from the extension; works on Wi-Fi only.
- Local Network permission: the extension shares the app's `NSLocalNetworkUsageDescription`; the first
  press from a widget may trigger the system prompt if the app never asked. Mitigation: only enable the
  widget picker after the app has connected once.
- No network calls outside the local network, no analytics, same as the app.

## 4. Live Activity

- Started by the app (Plus) when the user taps "Pin to Lock Screen" on the remote's overflow, ended
  after 4 hours or when the app disconnects for good. ActivityKit, no push token (we have no server),
  so updates happen only from the app or from the intents themselves.
- Buttons on the Live Activity use the same AppIntents as widgets (`LiveActivityIntent`, which runs in
  the app process when it is alive, giving the app's warm socket and <150 ms presses).
- Starting a Live Activity from JS needs a small native module; it lives in `src/plus/` on the JS side.

## 5. Limits and risks

- Widget extensions have tight memory (~30 MB) and time budgets; keep the Swift sender tiny, no JS.
- Interactive widgets require iOS 17; Control Center controls iOS 18; Lock Screen widgets iOS 16
  (display only before 17).
- Per-press latency from a widget is higher than in-app (cold connect each time). Show the target
  latency honestly; the in-app remote stays the fast path.
- Duplicated protocol logic in Swift for 5 platforms is the main cost. Start with Roku + Samsung
  (largest share), then LG, Sony, Philips. **Decide:** scope of the first widget release.
- App Store review: Plus must be a one-time non-consumable; the free app must stay fully usable
  (it is). Tips are consumables that unlock nothing.
- Android equivalents (Glance widgets, Quick Settings tile, Wear OS) are a separate plan.

## 6. Order of work (once the owner approves)

1. Owner: create the App Group and Keychain group in the Apple Developer account; decide min iOS.
2. Add `@bacons/apple-targets` and an empty widget target; verify `expo prebuild` + EAS build.
3. Native module to write the widget snapshot; JS mirror in `src/plus/`.
4. Swift sender for Roku + Samsung; Power/Volume/Mute intents; small + medium widgets.
5. Control Center controls (iOS 18), then the Live Activity.
6. Real purchase provider replaces `StubPurchaseProvider` (separate owner decision: StoreKit 2 directly
   or RevenueCat).
