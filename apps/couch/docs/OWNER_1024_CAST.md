# Owner brief, 24 Oct 2026: Couch casts photos and videos (cast-1024)

Owner: "add cast to TV to Couch now — we need to connect to the TV anyway, so upgrade it to a
dual-action app: remote + screen cast. Two birds, one stone."

Paid cast/mirror apps charge about US$6.99/week (one rated 2.1 stars with false-advertising
complaints). Couch's pitch becomes **remote and casting, free core, no weekly anything**.

Imported in run 70 (manual fire) as tasks tagged `cast-1024`, ranked after open owner bug fixes and
before other backlog work. The owner asked for it, so it is exempt from the D77-1 hold, which had
held the earlier casting part 2 (T80) until a dev build existed. TestFlight builds exist now
(24 Oct). T80 is superseded by T89–T92.

## Rules

- Every TV control stays free. **Casting basics are free too** (pick, queue, next/previous,
  play/pause/seek, slideshow, AirPlay shortcut). Couch Plus may gate extras only. None are defined
  yet, and the price is still the owner's decision.
- Nothing is claimed to work on real hardware until the owner confirms. Drivers are tested against
  fixtures (DLNA SOAP, SSDP, Roku ECP).
- Expo Go never crashes: the native parts (HTTP file server, route picker) load through guarded
  adapters. In Expo Go the Cast tab runs in demo mode with MockCast and says "Casting to a real TV
  works in the TestFlight build".
- No transcoding. Couch sends formats TVs usually accept (JPEG photos, H.264 MP4 videos). The picker
  asks iOS for compatible versions (JPEG instead of HEIC, H.264 where iOS offers it). If a TV refuses
  a file, the app says so in plain words.
- Local network only: the phone serves the picked file over HTTP on the home Wi-Fi, at a random
  128-bit token URL, only while a cast is active.

## Phases

### A. Cast photos and videos (T89 core, T90 native file server, T91 Cast tab)

- **Cast tab** next to Remote / Apps / TVs: pick from Photos (expo-image-picker, multi-select),
  queue, next/previous, play/pause/seek, slideshow with interval (3/5/10/15/30 s), loop. While a cast
  is active, play/pause on the remote screen controls the cast.
- **CastDriver interface** (`src/core/cast/driver.ts`), like TvDriver:
  - **DLNA/UPnP MediaRenderer**: SSDP `urn:schemas-upnp-org:device:MediaRenderer:1` when UDP is
    available, plus a direct probe of the connected TV's known description URLs, which needs no
    multicast. Then AVTransport SetAVTransportURI / Play / Pause / Seek / GetPositionInfo. Covers most
    Samsung, LG, Sony, Philips and Hisense TVs.
  - **Roku**: ECP launch of the Roku media player where supported, falling back to DLNA if the Roku
    exposes it.
  - **Android / Google TV**: DLNA where present. The Google Cast SDK is native and stays a later
    adapter.
  - **MockCast**: the demo mode target (Expo Go, App Review).
- **Local HTTP file server** (`modules/media-server`, an Expo module for iOS and Android): one file per
  token, Content-Type, Content-Length, HTTP Range (TVs seek with Range requests). It stops when the
  app goes to the background. It only runs in the TestFlight/dev build.

### B. AirPlay / Screen Mirroring shortcut (T92), free

Many current Samsung, LG, Sony and Roku TVs accept AirPlay 2 natively. An "AirPlay / Screen
Mirroring" button opens the system route picker (AVRoutePickerView through a small native module,
`modules/route-picker`, behind an adapter). A one-screen guide covers Control Centre → Screen
Mirroring. Without the module (Expo Go, Android) the button opens the guide.

### C. Full screen mirroring to non-AirPlay TVs: design note only (T93, later)

Not this round. Design and effort estimate:

- **iOS capture:** a ReplayKit Broadcast Upload Extension (a separate app-extension target with its
  own bundle id `com.jared797.couch.broadcast`, an App Group shared with the app, and
  RPSystemBroadcastPickerView to start it). It receives CMSampleBuffers of the whole screen.
  Extensions are capped at about 50 MB of memory, so encoding must be hardware-only.
- **Encoding:** VideoToolbox H.264 (baseline/main, 720p30, 3–6 Mbit/s, short GOP for low latency).
  System audio comes as a separate buffer (AAC through AudioToolbox).
- **Delivery to a DLNA TV:** TVs expect a file or stream URL. The extension would serve a live
  stream from the phone: MPEG-TS over HTTP (chunked, DLNA `DLNA.ORG_OP=00`, `DLNA.ORG_FLAGS` for
  live) or HLS (segments + playlist; many TVs add 5–15 s of latency). Expect 2–6 s of lag on most
  TVs. Fine for photos, slides and video, poor for games.
- **Roku:** the Roku media player plays HLS. The same stream works there, with similar latency.
- **Android:** MediaProjection + MediaCodec, the same stream server.
- **Expo:** needs a config plugin that adds the extension target (no maintained Expo package does
  this cleanly). EAS builds it fine once the target exists. App Groups must be set by hand in the
  Apple developer site (Apple's API can't assign them; see the ship workflow's skipCapabilitySync).
- **Effort:** about 3–5 focused build runs for iOS (extension + encoder + stream server + plugin),
  1–2 for Android, then real-TV tuning that only the owner can do. That means several TestFlight
  round trips. Risk: high (memory cap, TV-specific live-stream quirks, App Review asks for a clear
  purpose string).
- **Recommendation:** ship A and B first. AirPlay already mirrors to most current TVs for free, so
  phase C mainly helps older non-AirPlay TVs. Revisit after the owner has tried A and B on his TVs.

## Marketing

"Remote + cast, free". Do **not** claim that no other app does both: several remote apps bundle
casting. Claim that it is fair-priced and has no weekly subscriptions. Recorded in docs/MARKET.md and
docs/STORE.md.
