# Couch — universal TV remote (working title)

App Factory app id: `tvremote` · folder `Desktop\Apps\tvremote` · added 12 Oct 2026
UI reference: the prototype artifact this file is attached to (index.html). Port it like Housemate: the prototype is the source of truth for layout, copy and flows.

"Couch" is a working title only; check App Store / trademark availability before launch. Never put Roku, Samsung, LG etc. in the app name or icon (nominative "works with Roku TVs" in the description is fine, plus a non-affiliation line).

## 1. Why this wins

The category charts high (Toggle 4.8★/82K, Kraftwerk 9 4.6★/93K, Evolly #5 US Utilities) on dark patterns:
- weekly plans of $3–10 (Begamob runs 7 weekly price variants; TVSMART up to $18.99/month; Codematics $89.99/yr)
- "free" apps that need a trial before the TV responds; upsell screens every few taps; ads on top of paid tiers
- trial auto-renew surprises and child purchases
- can't find the TV, drops on backgrounding, 2–3 s lag, slow keyboard
- tracking SDKs and location in a remote app

Official apps are free but single-brand and buried inside content apps (Google TV, Fire TV needs an Amazon login, SmartThings is a smart-home app). Only one small indie (Adam Foot's TV Remote, 630 ratings) does widgets / Live Activity / Watch well, and it paywalls power.

## 2. Positioning (the five differentiators)
1. **Every button free forever** — power, d-pad, touchpad, keyboard, volume, app launcher, multi-TV. No ads, no trials, no weekly anything, privacy label "Data Not Collected". One-time **Couch Plus** (A$3.99, owner 25 Oct 2026; other storefronts follow Apple's price tiers) for widgets, Watch/Wear, Live Activity, macros. Themes are free for everyone (owner 25 Oct 2026). Family Sharing on. No tip jar (owner 25 Oct 2026).
2. **Fast and reliable** — persistent socket, auto-reconnect on foreground, saved TVs with last IP + MAC, Wake-on-LAN, latency shown in a diagnostics screen. Target <150 ms key-to-TV on LAN.
3. **System-level control** — interactive Home/Lock Screen widgets, Live Activity volume, Control Center control, Siri/App Shortcuts, Watch + Wear OS (Plus).
4. **Six platforms in one app + IR** — Samsung, Roku, Google/Android TV, LG, Fire TV (beta), then Vizio/Sony/Philips; IR blaster fallback on Android phones that have one.
5. **Calm, accessible UI** — big targets, haptics, VoiceOver/TalkBack labels, one-handed layout, "Simple mode" (big power/volume/channel/home only) for kids and parents.

Market share check: US Samsung Tizen 34% of smart-TV owners, Roku 28% of primary streaming devices (Parks, Jan 2026). UK Google TV 14%, Tizen 13%, webOS 8%, Fire 7%, Roku 4% (Ofcom/Omdia 2024). AU: Samsung #1 by units then LG, Hisense, TCL (Google TV) — no current OS split found.

## 3. Platforms and build order

| Order | Platform | Discovery | Transport | Pairing | Reference |
|---|---|---|---|---|---|
| 1 | Roku ECP | SSDP `roku:ecp` | HTTP :8060 | none (Roku OS 14.1+: user sets Settings > System > Advanced > Control by mobile apps = Enabled) | developer.roku.com ECP docs |
| 2 | Samsung Tizen 2016+ | SSDP `urn:samsung.com:device:RemoteControlReceiver:1`, `http://ip:8001/api/v2/` | WSS :8002 self-signed | Allow prompt on TV → token | samsungtvws (LGPL — port logic, don't copy code) |
| 3 | LG webOS | SSDP `urn:lge-com:service:webos-second-screen:1` | WSS :3001 self-signed (ws :3000 legacy) | register manifest → prompt → client-key; pointer socket for keys | aiowebostv (Apache-2.0) |
| 4 | Google / Android TV | mDNS `_androidtvremote2._tcp` | mutual TLS :6467 pair, :6466 remote, protobuf | 6-hex code on TV | androidtvremote2 (Apache-2.0), kud/androidtv-remote (MIT) |
| 5 | Fire TV (beta) | mDNS `_amzn-wplay._tcp` | wake `POST :8009/apps/FireTVRemote`, then HTTPS :8080 `/v1/FireTV/*` | PIN display/verify → client token | HA community; undocumented, exclude Vega OS |
| 6 | Vizio, Sony Bravia, Philips | SSDP/mDNS | HTTPS REST | PIN / PSK | pyvizio, pybravia, ha-philipsjs (MIT) — verify details |
| later | Android IR blaster | — | ConsumerIrManager | — | IR code DB (check licence) |
| defer | Apple TV, Hisense VIDAA, Panasonic | | | | crypto-heavy / legal risk / small share |

Power-on: Wake-on-LAN (store MAC from device-info at pairing) for Samsung, LG, Sony, Roku TVs with fast start.

## 4. Architecture (Expo dev-client, TypeScript, no server)

```
app/                    Expo Router: (tabs)/remote, (tabs)/apps, (tabs)/tvs, settings, add-tv flow
src/core/               pure TS, unit-tested, no RN imports
  types.ts              Tv, Platform, Key, Capability, PairState
  keys.ts               canonical Key enum -> per-platform code maps
  driver.ts             interface TvDriver { connect, disconnect, sendKey, sendText, launchApp, listApps?, volume?, powerOn?, capabilities }
  drivers/roku.ts       ECP over fetch
  drivers/samsung.ts    WS message builders + token handling
  drivers/webos.ts      SSAP register/manifest + pointer socket
  drivers/androidtv.ts  pairing hash + protobuf messages (protobufjs)
  drivers/firetv.ts
  discovery.ts          parse SSDP responses / mDNS records -> Tv candidates
  wol.ts                magic packet builder
  store.ts              saved TVs, last used, prefs (MMKV)
src/native/             thin adapters: udp (react-native-udp), zeroconf, tls socket (react-native-tcp-socket), WSS-trust-LAN module (Expo module, accepts self-signed certs only for RFC1918 IPs)
modules/ir-blaster/     Expo module, Android ConsumerIrManager
targets/widget/         iOS WidgetKit + Live Activity (expo config plugin / @bacons/apple-targets)
```

Rules: drivers are pure and tested against recorded fixtures; transport is injected so tests run in Node. A `MockTv` driver powers demo mode (needed for App Review and screenshots).

iOS: `NSLocalNetworkUsageDescription`; `NSBonjourServices` for every mDNS type; **request `com.apple.developer.networking.multicast` early** (SSDP needs it; ~1 week) — fallback meanwhile: manual IP + unicast subnet probe (`:8060/query/device-info`, `:8001/api/v2/`). Android: `MulticastLock`, cleartext for LAN HTTP via expo-build-properties, `TRANSMIT_IR`.

App Review: one universal app (guideline 4.3), demo mode + video for reviewers (2.1), no brand names in title/icon.

## 5. Monetisation
- Free: everything that controls the TV, unlimited TVs.
- Couch Plus, one-time: widgets, Lock Screen + Control Center controls, Live Activity, Watch/Wear, themes, button macros ("Movie night": power, input HDMI2, volume 15).
- No tip jar (owner 25 Oct 2026). Family Sharing on for Couch Plus. No subscription. RevenueCat or StoreKit 2 / Play Billing directly.
- Marketing hook in screenshot 1: "Every button free. No weekly subscription. Ever."

## 6. Milestones
- M1 (prototype parity in Expo, MockTv demo mode) → M2 Roku + Samsung on real hardware → M3 LG + Google TV → M4 widgets/Live Activity/Watch → M5 TestFlight with owner's TVs + 3-5 friends' TVs → store listing.
- Hardware test matrix is the main cost: owner records which TVs are in reach in `OWNER_NOTES.md` (brand, model, year). Workers can't test real TVs; they ship against fixtures and the owner smoke-tests each morning build.

## 6b. Owner feedback, 12 Oct 2026 (prototype v2 has these)
- **Source** button on the remote (labelled), with a source picker (TV, HDMI 1–4, AV) where the TV lists inputs; otherwise "Next source" cycles like the physical button.
- **TV Settings** button (opens the TV's settings menu; Samsung/LG/Android TV have a key for it).
- **123 number pad** sheet for channel numbers (digits, dash, OK).
- **Red/green/yellow/blue** colour buttons, shown only for TVs that support them (hidden on Roku).
- **Voice**: a prominent "Hold to talk" button. Android/Google TV sends voice natively where the protocol allows; elsewhere the phone's speech-to-text is typed into the TV search.
- **App tiles**: no app shortcuts on the remote screen. The Apps tab shows each app's real icon as supplied by the TV (Roku `/query/icon/<id>`, webOS app icon URLs, Samsung/Android where available), in one consistent tile style. Never redraw or restyle the services' logos ourselves (trademark), and fall back to the house-style tile when the TV gives no icon.
- **Infrared code test setup** (Android phones with an IR blaster): pick brand (or "Not sure"), then "Point at the TV, tap Volume up, did it work?" stepping through code sets until one works, then name it ("TV 1", "TV 2" …). iPhones have no IR, so they always use Wi-Fi.
- **Wi-Fi setup needs no IP address** in normal use: the scan lists TVs automatically; typing an address is a last-resort link. New TVs default to the names "TV 1", "TV 2" …, editable.

## 7. Owner actions
1. List the TVs/streamers you can test on (brand, model, year) in `factory\OWNER_NOTES.md`.
2. When the Apple Developer account exists: submit the Multicast Networking Entitlement request (text drafted in `docs/multicast-request.md` by task T12).
3. Decide final name before store listing.
