# Casting photos and videos (T76, part 1: core + adapter)

Status: **core logic only, tested against reconstructed fixtures. Nothing has been tried on a real
TV, speaker or phone.** There is no casting screen yet; that is part 2.

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
3. **UDP** for SSDP: `react-native-udp`, same as TV discovery; without it there is no renderer
   search (a manual-IP fallback could fetch a description URL directly, not built).
4. The casting screen and wiring (part 2).

## Not verified

- Never tested on a real TV or renderer; fixtures were written from the UPnP / DLNA specifications.
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
