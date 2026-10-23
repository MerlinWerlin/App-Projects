# lan-wss (local Expo module) — UNVERIFIED

A tiny WebSocket client for talking to TVs on the home network. Samsung Tizen's remote channel
(`wss://<tv>:8002/...`) uses a self-signed certificate, which React Native's built-in WebSocket
rejects. This module accepts a self-signed certificate **only** when both are true:

1. the caller passes `allowSelfSignedLan: true`, and
2. the URL host is a literal RFC 1918 IPv4 address (10/8, 172.16/12, 192.168/16).

The same module also has a one-shot HTTP(S) `fetch` (T32) for TVs whose REST API sits behind a
self-signed certificate (Vizio SmartCast, Philips JointSpace). It follows the same rule, with
`https://` in place of `wss://`.

Hostnames (including `.local`), public IPs, loopback, link-local and IPv6 always get normal
certificate validation. The rule matches `src/core/lanHost.ts` (`isRfc1918Host`), and the JS
adapter `src/native/lanWss.ts` applies it too before calling native code.

**Status: written without a build machine. It has not been compiled for iOS or Android.**
The native sources were first written but never committed (the old `.gitignore` ignored every
`ios/` and `android/` folder); they were recreated in T27 and are now tracked. Only text checks
cover them (`tests/lan-wss-sources.test.ts`). Treat it as unverified until a dev build on the PC (`npx expo prebuild` then `expo run:android`
/ `expo run:ios`) succeeds and a Samsung TV connects.

## Layout

- `expo-module.config.json` — module registration (`LanWssModule` on Apple,
  `expo.modules.lanwss.LanWssModule` on Android).
- `index.ts` — JS API via `requireOptionalNativeModule('LanWss')` (null when not compiled in):
  `connect(id, url, allowSelfSignedLan): Promise<void>`, `send(id, data): boolean`, `close(id)`,
  events `onMessage {id,data}`, `onClose {id,code,reason}`, `onError {id,message}`.
  The caller picks `id` before connecting so its listeners are in place for the first frame.
  Plus `fetch(url, method, headersJson, body, timeoutMs, allowSelfSignedLan):
  Promise<{status, headersJson, body}>` — resolves for any HTTP status (a 401 keeps its
  `WWW-Authenticate` header for Philips Digest), header names lower-cased and repeats joined with
  `", "`; rejects with `ERR_LAN_FETCH` (network/TLS) or `ERR_LAN_FETCH_TIMEOUT`. The JS adapter
  is `src/native/lanFetch.ts` (`loadLanFetch(): FetchLike | null`).
- `ios/LanWssModule.swift`, `ios/LanWss.podspec` — one `URLSessionWebSocketTask` per id on a
  shared `URLSession`. The **task-level** auth delegate (the session-level one is deliberately not
  implemented, so URLSession routes server-trust challenges per task) returns
  `.useCredential(URLCredential(trust:))` only when allowSelfSignedLan was requested for that task,
  the URL is `wss://`, and the challenge host equals the URL host and is RFC 1918; otherwise
  `.performDefaultHandling`. `connect` resolves in `didOpenWithProtocol` and rejects if the task
  completes/fails before that. Binary frames are forwarded only if they decode as UTF-8.
- `ios/LanFetch.swift` — `fetch` on a separate ephemeral `URLSession` (no credential storage,
  cache or cookies, so a Digest 401 is returned to JS rather than answered by the system). Same
  task-level trust delegate rule, for `https://`; relaxed-trust tasks refuse redirects.
- `android/build.gradle`, `android/src/main/java/expo/modules/lanwss/LanWssModule.kt` — OkHttp.
  For an allowed RFC 1918 `wss://` URL it builds a per-connection client whose trust manager
  accepts the presented chain, with a `HostnameVerifier` that passes only that exact host and
  redirects disabled (the host as written in the URL must also equal OkHttp's parsed host). Every
  other URL uses the default client. `fetch` uses the same rule for `https://` (relaxed or default
  client, plus `callTimeout`/`readTimeout` = timeoutMs; OkHttp's default authenticator does not
  answer 401s). `connect` resolves in `onOpen`, rejects in
  `onFailure`/`onClosed` before open; after open a failure emits `onError` then `onClose` (1006).

## Not wired in yet (on purpose)

- It is **not** in `package.json` and **not** in the `app.json` plugins list.
- Heads-up: Expo autolinking scans the project's `modules/` directory by default, so a
  `npx expo prebuild` / dev build **will** pick this module up and compile it. That is the way
  to verify it. If it breaks a build before it is fixed, exclude it with
  `"expo": { "autolinking": { "exclude": ["lan-wss"] } }` in package.json (or move the folder).
- Expo Go never contains it: `src/native/lanWss.ts` returns null there and the Samsung driver
  cannot connect (the UI should say a dev build is needed for Samsung).

## Things to check on the first build

- Gradle: the `expo-module-gradle-plugin` plugin id (template for recent SDKs) and the OkHttp
  version resolve against React Native's own OkHttp.
- Swift: `AsyncFunction` with a trailing `Promise` argument, `sendEvent` payloads, and that
  `URLSession` calls the task-level trust delegate method for `wss://` to an IP (no session-level
  method is implemented). Podspec iOS minimum (15.1) matches the SDK's.
- `fetch` takes 6 arguments plus the promise (7 total) on both platforms; confirm that arity is
  supported by the SDK's `AsyncFunction` overloads (otherwise switch to a single options record).
- iOS: that a Digest 401 reaches the completion handler with its headers (credential storage is
  nil; default handling should then deliver the response). Android: cleartext `http://` to a LAN
  IP may need `usesCleartextTraffic` in release builds (Vizio and Philips use https, so not today).
- Kotlin: `AsyncFunction` with a trailing `expo.modules.kotlin.Promise`, and `promise.reject(code,
  message, cause)` signature.
- iOS Local Network permission prompt appears (`NSLocalNetworkUsageDescription` is in app.json).
- Android: no `network_security_config` change is needed (the trust decision is in code).
