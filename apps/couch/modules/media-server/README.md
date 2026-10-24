# media-server (local Expo module) — UNVERIFIED

A tiny HTTP/1.1 file server on the phone so a TV (DLNA / UPnP renderer) on the home network can
fetch one picked photo or video for casting (cast-1024 phase A, T90). The JS wrapper is
`src/native/mediaServer.ts`, which builds the served URL from the phone's Wi-Fi IPv4 and checks it
with `src/core/cast/mediaServer.ts` (RFC 1918 host, port >= 1024, token of at least 128 bits).

**Status: never compiled in the cloud (no Xcode / Gradle there) and not tested on a device or a
TV.** Only text checks cover it (`tests/media-server-module.test.ts`). The first TestFlight / EAS
build log will tell whether it compiles.

## JS API (`index.ts`)

`requireOptionalNativeModule('MediaServer')` — the default export is `null` in Expo Go, web and
tests (no top-level throw).

- `serve(uri, mime): Promise<{ id, port, token }>` — registers the file under a fresh token and
  starts the server on first use. `uri` is `file://` (both platforms; expo-image-picker returns
  cache copies on iOS) or `content://` (Android, through `ContentResolver`). `ph://` is rejected.
  Errors: `ERR_MEDIA_SERVER_URI` (unsupported, missing, unreadable or unknown-size source),
  `ERR_MEDIA_SERVER_START` (listener could not start / was stopped).
- `stop(id): Promise<void>` — forgets that token (its URL answers 404) and closes its open
  connections. Unknown ids are ignored.
- `stopAll(): Promise<void>` — forgets every token, closes every connection and the listener.

## Behaviour (both platforms)

- One server per app process, started lazily on the first `serve()` on an **ephemeral TCP port
  (>= 1024, checked) bound to all interfaces** (not only Wi-Fi: binding to one interface is fragile
  with hotspots and Ethernet adapters; the unguessable token is the access control). Stopped by
  `stopAll()` and when the app goes to the background (iOS: `UIApplication.didEnterBackgroundNotification`;
  Android: `OnActivityEntersBackground`), plus on module destroy. It restarts on the next `serve()`,
  with a new port.
- Token: 18 bytes (144 bits) from `SecRandomCopyBytes` / `SecureRandom`, base64url without padding
  (24 characters). Served path `/<token>` or `/<token>.<ext>` (the JS adds the extension; both are
  accepted; a query string is ignored).
- Requests: request head read up to CRLF CRLF (16 KiB cap -> 431, 15 s timeout). `GET` and `HEAD`
  only (else 405 with `Allow`), unknown token -> 404. Responses carry `Content-Type` (the given
  mime; empty or non-printable -> `application/octet-stream`), `Content-Length`,
  `Accept-Ranges: bytes`, `Cache-Control: no-store`, `Connection: close`, and two DLNA headers:
  `transferMode.dlna.org: Streaming` (video / audio) or `Interactive` (images), and
  `contentFeatures.dlna.org: DLNA.ORG_OP=01;DLNA.ORG_CI=0;DLNA.ORG_FLAGS=01700000000000000000000000000000`.
  The DLNA headers are **unverified best practice** copied from common DLNA servers.
- Range: one `bytes=a-b`, `bytes=a-` or `bytes=-n` -> 206 with `Content-Range: bytes s-e/size`;
  unsatisfiable (start beyond the end, `-0`, empty file) -> 416 with `Content-Range: bytes */size`;
  several ranges, or a malformed / non-`bytes` value -> the full file with 200 (RFC 9110 allows
  ignoring Range).
- Files are streamed in 64 KiB chunks, never loaded whole. Up to 64 concurrent connections (TVs
  open several for probing and seeking).
- Nothing logs tokens or file paths.

## Layout

- `expo-module.config.json` — `MediaServerModule` (Apple), `expo.modules.mediaserver.MediaServerModule` (Android).
- `ios/MediaServerModule.swift` — module definition and the background observer.
- `ios/MediaHttpServer.swift` — Network.framework `NWListener` + `NWConnection`; all state on one
  serial `DispatchQueue`; `FileHandle` with `seek(toOffset:)` / `read(upToCount:)`; the next chunk
  is read only after `.contentProcessed` for the previous one. Written in the lan-wss Swift style
  (Xcode 16): no captured `var` inside `@Sendable` closures (per-connection state lives in a
  reference type), dictionary literals typed `[String: Any]` before `promise.resolve`.
- `ios/MediaServer.podspec` — iOS 15.1, Swift 5.9, links Network and Security.
- `android/build.gradle`, `android/src/main/AndroidManifest.xml` (INTERNET, already in RN apps),
  `android/src/main/java/expo/modules/mediaserver/MediaServerModule.kt` — `java.net.ServerSocket(0)`,
  an accept thread, one thread per connection from a cached daemon thread pool. `content://` size
  from `openFileDescriptor(...).statSize`, falling back to `OpenableColumns.SIZE`; reads through
  `openFileDescriptor` (seek via `FileChannel.position`) or `openInputStream` (skip).

## Not wired in yet

- Not in `package.json` and not in the `app.json` plugins. Expo autolinking scans `modules/`, so a
  dev build **will** compile it. If it breaks a build before it is fixed, exclude it with
  `"expo": { "autolinking": { "exclude": ["media-server"] } }` in package.json (or move the folder).

## Things to check on the first build / device test

- Swift: `AsyncFunction` closures with a trailing `Promise` (including the Promise-only
  `stopAll`), `OnCreate` / `OnDestroy`, `NWListener(using:on: .any)`, `.contentProcessed` trailing
  closure syntax, `FileHandle.read(upToCount:)`. Any Sendable warnings under Xcode 16.
- iOS: whether the listener passes through `.waiting` while the Local Network prompt is shown (the
  code treats `.waiting` as a failure, so the first cast may fail once and succeed on retry).
- iOS: TVs reach the phone only while the app is in the foreground (the server stops on background).
- Kotlin: `OnActivityEntersBackground`, `appContext.reactContext`, `promise.reject(code, message, null)`.
- Android: that `content://` URIs from the picker stay readable from the server threads.
- A real DLNA TV: Range seeking in videos, the DLNA headers, HEAD probes. **Not tested on a real TV.**
