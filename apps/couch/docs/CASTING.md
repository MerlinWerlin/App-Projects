# Casting photos and videos (T76 part 1 + cast-1024 core, T89)

Status: **part 1 (T76) done; cast-1024 phase A core (T89) done: CastDriver for DLNA, Roku and the
demo TV, the direct renderer probe, the target list and the queue/slideshow. Core logic only,
tested against reconstructed fixtures. Not tested on a real TV, speaker or phone.** The native file
server (T90) and the Cast tab (T91) are separate tasks.

Casting uses plain UPnP / DLNA MediaRenderer control, which many smart TVs and some speakers and
streaming boxes support. The phone serves the picked file over HTTP on the home Wi-Fi and tells the
TV to fetch and play it. Nothing leaves the local network.

## What is done (pure TypeScript, `src/core/cast/`)

| File | What it does |
| --- | --- |
| `ssdp.ts` | M-SEARCH for `urn:schemas-upnp-org:device:MediaRenderer:1` over the injected UDP socket (sent twice, like TV discovery), parsing of replies and NOTIFY alive (LOCATION, USN, ST), dedupe by USN. Reuses `buildMSearch` / `parseSsdpHeaders` from `src/core/discovery.ts`. Only `http://` LOCATIONs on an RFC 1918 address are kept. |
| `description.ts` | Device description parse: friendly name (CDATA and entities handled), UDN, model, and the AVTransport and RenderingControl control URLs resolved against `<URLBase>` or LOCATION (absolute, `//`, `/`, relative and `../` references). Every URL must pass the LAN guard (`src/core/lanHost.ts`), otherwise the device is refused. |
| `discover.ts` | SSDP search, then each description, deduped again by UDN. Bad devices are skipped and noted for diagnostics. |
| `didl.ts` | DIDL-Lite metadata: `dc:title`, `upnp:class` (`object.item.imageItem.photo` / `object.item.videoItem`), `res` with `protocolInfo="http-get:*:<mime>:*"`, size and duration. Every value XML-escaped. |
| `avTransport.ts` | SOAP client: SetAVTransportURI (URI + DIDL metadata, escaped again inside the envelope), Play, Pause, Stop, Seek (`REL_TIME`, `hh:mm:ss`), GetTransportInfo, GetPositionInfo. Quoted `SOAPACTION: "<serviceType>#<Action>"` using the service type the device advertised. SOAP faults (UPnPError codes 401/602/701/702/703/704/705/710/711/714/716, anything else) become `driverError(code, key)` with the new `core.driver.cast.*` catalogue keys, translated into all 11 languages (machine translation, awaiting native review like the rest). |
| `session.ts` | `CastSession` state machine: idle -> loading -> playing / paused -> stopped, or error. Polls transport + position on an injected timer, tolerates the brief STOPPED / TRANSITIONING many renderers report right after Play (until `loadTimeoutMs`), gives up after 3 failed polls in a row, clamps seeks, ignores stale results when a new load or a stop overtakes an old one. Photos go straight to "playing" and are not polled. |
| `mediaServer.ts` | The `MediaServer` port: `serve({ uri, mime })` returns `http://<phone-lan-ip>:<port>/<token>[.ext]` plus `stop()`; `stopAll()`. URLs are built and checked here (RFC 1918 host, port >= 1024, token of at least 22 URL-safe characters, about 128 bits). `UNAVAILABLE_MEDIA_SERVER` refuses with "Casting needs the full app." |

### cast-1024 core (T89)

| File | What it does |
| --- | --- |
| `driver.ts`, `queueTypes.ts` | Shared contracts (CastDriver, CastTarget, QueueItem, QueueSnapshot). |
| `dlnaDriver.ts` | `createDlnaDriver(target, renderer, fetch, timer?)`: the CastDriver over `AvTransportClient` + `CastSession` (no SOAP of its own). `load()` rejects with the translated error when SetAVTransportURI / Play fail (the session only records it). Photos ignore pause/seek. `play()` after a stop loads the same media again. |
| `rokuCast.ts` | `createRokuCast(target, fetch, timer?)`: the Roku media player over ECP. Load: `POST :8060/input/15985?t=v&u=<url>&k=&videoName=<title>&videoFormat=mp4` (photos `t=p&u=<url>&k=`). **That input comes from community docs, not Roku's official ECP reference, and is unverified.** Play/pause is the `Play` keypress (a toggle, state tracked locally), stop is `Back`, seek is refused (`core.driver.cast.seekUnsupported`). No polling: the video position is an estimate from the phone's clock, and the video counts as finished 3 s after its estimated end so the queue can advance. Only RFC 1918 hosts; 403 shows the existing mobile-control help. |
| `mockCast.ts` | `MOCK_CAST_TARGET` (`mock:demo`, "Demo TV") and `createMockCast(target?, timer?)`: demo mode. A video "loads" for 300 ms, plays with a moving position and ends in `stopped`; photos go straight to playing. |
| `probe.ts` | `probeRenderer(host, { fetch, udp?, timeoutMs?, timer? })`: finds a renderer on a known TV host **without multicast** (the iOS multicast entitlement is pending). GETs `http://<host>:9197/dmr` and `http://<host>:52323/dmr.xml` (from public integration docs, unverified; other brands use random ports that only SSDP finds), first with an AVTransport wins; then, when a UDP factory is given, a unicast M-SEARCH to `<host>:1900`, following only a LOCATION on that same host. Never throws; non-LAN hosts are refused before any request. |
| `targets.ts` | `findCastTargets(env, tvs)`: mock TVs give the demo target, Roku TVs a Roku target, every LAN TV is probed for DLNA, plus a multicast `discoverRenderers` when `env.udp` is set; DLNA targets deduped by UDN and host, `tvId` set when the host matches a saved TV. Renderers are remembered by target id, so `createCastDriver(target, env)` builds the right driver without passing the renderer. |
| `queue.ts` | `CastQueue`: items, index, slideshow (3/5/10/15/30 s, snapped), loop. The slideshow timer runs only on photos; a video plays to the end and `onMediaEnded()` advances when the slideshow or loop is on. `next` at the end wraps with loop, else stops the slideshow; `prev` at 0 wraps with loop. A failing play leaves the index on the item, turns the slideshow off and rethrows; a stale play (next pressed again quickly) is ignored. |

All timers are injected (`CastTimer`); the tests never use real timers. Contract tests
(`driverContract.test.ts`) run the same cases against all three drivers. No new catalogue keys were
needed (the T76 `core.driver.cast.*` keys and the Roku keys cover every error).

`src/native/mediaServer.ts` loads the planned native module `modules/media-server` with a guarded
`require` inside a function (the same pattern as the other native wrappers; `tests/native-guard.test.ts`
checks it). Without the module (Expo Go, web, tests) it returns `UNAVAILABLE_MEDIA_SERVER`, so
Expo Go never crashes. With it, it combines the phone's Wi-Fi IPv4 (expo-network) with the port and
token from the native side and refuses anything that is not a safe LAN URL.

Tests: `src/core/cast/*.test.ts`, `tests/media-server.test.ts`, fixtures in
`src/core/cast/__fixtures__/` (generic names, see its README). No npm dependency was added.

## What needs a dev build (not done)

1. **Native HTTP file server** (`modules/media-server`, an Expo module, iOS + Android): serve one
   picked file at a random token path with correct `Content-Type`, `Content-Length` and HTTP Range
   support (TVs seek in videos with Range requests), only while a cast is active, bound to the Wi-Fi
   interface. Interface expected by the wrapper: `serve(uri, mime) -> { id, port, token }`,
   `stop(id)`, `stopAll()`. It must handle `ph://` / `content://` URIs from the picker (or the picker
   copies to a cache file first). iOS needs the local network usage description (already present for
   discovery) and the server must stop when the app goes to the background.
2. **Photo / video picker**: e.g. expo-image-picker (an owner and dependency decision; nothing was
   installed).
3. **UDP** for SSDP: `react-native-udp`, same as TV discovery; without it there is no multicast
   renderer search. The direct probe (`probe.ts`, T89) covers saved TVs without multicast.
4. The casting screen and wiring (part 2).

## Not verified

- Never tested on a real TV or renderer; fixtures were written from the UPnP / DLNA specifications.
- The Roku media player input (`/input/15985`) and the two probe URLs are from community / public
  integration docs and unverified. The Roku position is an estimate; buffering will make it drift.
- Real renderers differ: some want `DLNA.ORG_PN` / `DLNA.ORG_OP` flags in `protocolInfo`, some
  reject photos without a size, some need `Stop` before a new `SetAVTransportURI`, some report
  positions only while playing. Expect adjustments after the first hardware test.
- HEIC photos and HEVC / MOV videos will often not play; the app may need to transcode or pick
  JPEG / MP4 only.

## Free or Couch Plus?

**Owner decision, not made.** The default is **free**: nothing here checks the Couch Plus
entitlement and nothing is gated (`src/core` may not import `src/plus`, test-enforced). If the owner
later decides casting is a Plus feature, the gate belongs in `src/plus/` and the screen, never in
`src/core/cast`.

## Cast tab (cast-1024, T91)

Status: **UI and wiring only, tested with fakes. Not tested on a real TV or phone.**

- `app/(tabs)/cast.tsx` (tab between Remote and Apps) with components in `src/ui/cast/`: target
  chips ("Demo TV" in demo mode), "Choose photos and videos", the queue (thumbnail, title, kind /
  length, move earlier / later / remove as buttons and screen-reader actions), transport (previous,
  play/pause, next, -10 s / +10 s with mm:ss position for videos, stop casting, all in NeverMirror),
  slideshow switch + seconds per photo (3/5/10/15/30) + loop, a status line, the empty state, and the
  AirPlay shortcut (T92).
- `src/core/cast/castController.ts`: pure controller (targets, active driver, queue, file server).
  Each item is served through the MediaServer (the previous served file is stopped first) and loaded
  with `driver.load()`; when a video stops by itself the queue moves on; stop casting stops the TV,
  the served file and the server. Photos: play/pause pauses or resumes the slideshow.
- Demo mode when the remote is in demo mode or there is no file server (Expo Go): MockCast, no
  serving (placeholder LAN URLs that MockCast never fetches). The tab then says "Casting to a real TV
  works in the TestFlight build. Here you can try it in demo mode."
- `src/native/mediaPicker.ts`: expo-image-picker behind a guarded require. Multi-select (50), asks
  iOS for compatible representations (JPEG instead of HEIC, H.264 export preset for videos). JPEG,
  PNG and MP4 are expected to play; other formats are queued with "May not play on every TV".
- Remote screen: while a cast is on, Play/Pause controls the cast (`useCastRouting`) and a
  "Casting: <title>" pill with a stop button shows under the TV header.
- Free: nothing here imports `src/plus` (test-enforced in tests/cast-tab.test.ts).

## Google Cast (T106)

Status: **pure TypeScript route, tested against reconstructed fixtures only. NEVER tested on a real
TV. The native TLS socket it needs is uncompiled and only arrives with the next native build.**

Why: the owner's TV (a TCL C7K, Google TV) has Chromecast built in but no DLNA renderer the probe
finds, and it is not a Roku, so nothing he cast reached it. Google TV / Android TV sets with
Chromecast built in accept casts over the Cast protocol (CASTV2), so every saved TV with platform
`androidtv` on a literal RFC 1918 address now also becomes a cast target.

| File | What it does |
| --- | --- |
| `googleCast/framing.ts` | Hand-written protobuf for `CastMessage` (protocol_version, source_id, destination_id, namespace, payload_type STRING, payload_utf8; unknown fields and binary payloads skipped), 4-byte big-endian length prefix, and a stream decoder that handles split and coalesced chunks and refuses frames over 64 KiB. |
| `googleCast/channel.ts` | `CastChannel.open(tcp, host, timer)`: `TcpFactory(host, 8009, { tls: true })` with a connect timeout, CONNECT sender-0 -> receiver-0, PING every 5 s and PONG to the device's PING, gives up after 15 s of silence, requestId-matched requests and generic waits with timeouts, close handling. RFC 1918 hosts only. |
| `googleCast/googleCastDriver.ts` | `createGoogleCast(target, tcp, timer?)`, a CastDriver: receiver LAUNCH of the Default Media Receiver (`CC1AD845`), wait for a RECEIVER_STATUS listing its transportId + sessionId, CONNECT to it, media LOAD (`contentId` = the phone's file URL, `contentType`, `streamType: BUFFERED`, metadata type 0 generic or 4 photo, title, autoplay). MEDIA_STATUS PLAYING / PAUSED -> playing / paused with `confirmed: true` (the Cast tab only says it is on the TV then); BUFFERING before that -> loading, unconfirmed; IDLE + FINISHED -> stopped; IDLE + ERROR, LOAD_FAILED, LOAD_CANCELLED, INVALID_REQUEST -> error. Play / pause / seek by mediaSessionId; stop = media STOP, receiver STOP of the session, then the connection closes. GET_STATUS every second while a video loads or plays. The receiver app closing (or another app taking over) stops the cast; a dropped connection is an error. |
| `targets.ts` | `CastTransportKind` gains `'googlecast'`, `CastEnv` gains `tcp?: TcpFactory \| null`. With `env.tcp`, each LAN `androidtv` TV gets `gcast:<host>` (name = TV name, photo + video, tvId), listed before that TV's DLNA renderer when it has one (both are kept). No network at search time. `createCastDriver` builds it, and throws `core.driver.cast.needsFullApp` without `env.tcp`. `googleCastCandidates(tvs)` lists the TVs that could use it, so the screen can explain that casting to them needs the next build when `tcp` is null. |
| `src/native/lanTls.ts` | `loadLanTls(): TcpFactory \| null` over the lan-wss module's new TLS socket, guarded like `lanFetch.ts` (null when the module or its `tlsConnect` is missing: Expo Go, web, tests, builds made before T106). TLS only, refuses non-RFC 1918 hosts before any native call, bytes as base64 (`src/core/crypto/bytes.ts`). `src/state/cast.tsx` passes it as `env.tcp`. |
| `modules/lan-wss` | `tlsConnect(id, host, port, timeoutMs)`, `tlsWrite(id, base64)`, `tlsClose(id)`, events `onTlsData` / `onTlsClose`. iOS: `NWConnection` with TLS whose verify block accepts the device's self-signed certificate only when the host is RFC 1918 (`ios/LanTls.swift`). Android: `SSLSocket` from an `SSLContext` with an accept-the-presented-chain trust manager built only for RFC 1918 hosts, read loop on a background thread. See `modules/lan-wss/README.md`. |

New catalogue keys (all 11 languages, machine translation awaiting review):
`core.driver.cast.gcast.connectFailed`, `.launchFailed`, `.loadFailed`, `.lost`. User-facing text
says "the TV", never a brand.

Tests: `src/core/cast/googleCast/*.test.ts` (framing, channel, driver flows against the scripted
receiver in `src/core/cast/__tests__/fakeCastDevice.ts`), the Google Cast case in
`driverContract.test.ts` and `targets.test.ts`, `tests/lan-tls.test.ts`, and text checks of the
native sources in `tests/lan-wss-sources.test.ts`. No real network, fake timers only.

What this is not:

- No Google Cast SDK and no new npm dependency: the protocol is spoken directly.
- Not verified on hardware. The message shapes come from public descriptions of CASTV2 and the
  Default Media Receiver, rebuilt as fixtures. Expect adjustments after the first test on the
  owner's TV (for example: whether the TV fetches the phone's `http://` file URL, whether photos
  report PLAYING, buffering behaviour, the device's TLS settings).
- Needs the next native build: the TLS socket in `modules/lan-wss` has not been compiled for iOS
  or Android. Until then `env.tcp` is null and no Google Cast target appears.
- Device authentication (the `deviceauth` namespace some senders use) is not implemented; public
  descriptions say the Default Media Receiver does not require it, which is unverified.

## Google Cast switch (oversight D147-1)
`src/core/cast/googleCast/switch.ts` holds one line, `export const GOOGLE_CAST_ON = true;`. Set it to `false` when the Google Cast native code (modules/lan-wss/ios/LanTls.swift, the TLS part of LanWssModule.kt) blocks a build or misbehaves: the app stops loading the TLS socket, so Cast uses DLNA / AirPlay / demo only, and on iOS LanWss.podspec reads the same line and compiles a stub `LanTlsClient` instead (`COUCH_NO_GOOGLE_CAST`). Android only gets the runtime gate. tests/google-cast-switch.test.ts keeps the line's exact form and the gating in place.
