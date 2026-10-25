# Satchel: flight-mode travel wallet + offline map (working title)

App Factory app id `travel` (repo/slug `satchel`). The owner asked for it on 12 Oct 2026 and started it on 24 Oct 2026: "ok sounds good, let's trial that for now". This rewritten plan (24 Oct) replaces the 12 Oct version. It is **serverless**: no accounts, no backend and no running costs except near-zero static hosting for offline map files later.
"Satchel" is a working title only; check App Store / trademark availability before launch. Never use a competitor's name anywhere in the app, store copy or assets. Follow docs/STARTER_STANDARD.md from the first build.

## 1. The pitch
**"Leave your phone in flight mode. Satchel still works."**
- Itinerary apps are good at planning and weak on the day itself, with no signal. Travellers juggle airline apps, PDFs, QR screenshots and Maps downloads, and pay roaming fees.
- **The phone's GPS works in flight mode**, so an offline map stored on the phone still shows the blue dot with no data and no roaming.
- **Battery:** with the radios off and GPS used only on request, the phone lasts much longer. Never quote battery percentages until the owner has measured them on a real trip; "works in flight mode" is the claim.
- **Why we need our own map:** Apple and Google let users download offline maps in their own apps, but third-party apps can't use those downloads (Apple DTS: "not possible with the APIs available today", https://developer.apple.com/forums/thread/765857). Google's terms ban caching its map data. So Satchel brings its own OpenStreetMap-based map files.

## 2. Pricing
- **Free forever:**
  - trips, timeline, tickets, emergency card, document vault, packing lists, low-battery mode
  - the offline map for **one city per trip**, with GPS
  - trip export/import as a file
- **Satchel Plus, one-time (about A$7.99, owner decides):**
  - unlimited offline cities and regions
  - offline point-of-interest layers everywhere
  - iCloud sync across your devices
  - shared trips
  - home-screen widgets, themes

No subscription, no ads, no tracking, no accounts.

## 3. Milestones and features

**TRIAL (Expo Go, on-device only), the first thing the owner tries:**
- **Trips:** a trips list leading to a trip timeline (days, plus items: flight, train, ferry, bus, hotel, car hire, activity, note). Each item has its own IANA time zone, and the app does correct local-time maths offline. There's a "Next up" card at the top.
- **Adding items:** add manually; attach PDFs or images from Files or Photos; everything is stored locally.
- **Ticket view:** full screen at full brightness (expo-brightness), a saved QR crop for each ticket, and one-handed use.
- **Emergency card, one tap from Home:** local emergency numbers from a bundled table with a source and date ("verify locally"), insurance policy and phone, emergency contacts, and private local-only medical notes.
- **Hotel address card:** shows the address big for a taxi driver, with a field for the local-language address.
- **Document vault:** passport, visa and licence copies with expiry warnings, behind a Face ID lock (expo-local-authentication).
- **Low-battery essentials mode:** below 20% battery (expo-battery), or by a manual switch, Satchel offers a plain dark screen with the next ticket, the hotel address card and the emergency card. No animation, no map.
- **Packing lists:** one per trip, with templates by trip type.
- **Map v0 (online in Expo Go):** react-native-maps with the system map. Saved places, bookings and the demo city's bundled points (toilets, drinking water, fuel, food, pharmacy, ATM, hospital) are pinned, with category toggles. Location is a **single check on request** ("Where am I?"), never continuous. This proves the UX before the native offline map.
- **Demo trip** (Sydney → Tokyo → Kyoto) so the owner can try everything straight away.

**NATIVE (development build via TestFlight):**
- **Offline map:** MapLibre Native rendering vector tiles from per-city PMTiles extracts. They're cut from the free Protomaps OpenStreetMap builds and hosted on static storage; the plan is Cloudflare R2 (no egress fees, free tier), but **verify the current terms and the ODbL attribution/share-alike rules first**, and the owner approves any account. Downloads go to the device and work fully offline. The map has a dark style.
- **Offline points of interest:** per-city OpenStreetMap extracts (amenity=toilets, drinking_water, fuel, restaurant/cafe/fast_food, pharmacy, hospital, atm, plus transport stations) as small files with the map download. The OSM attribution is shown on the map.
- **Flight-mode mode:** a banner when the phone is offline ("Flight mode: map and tickets still work"), GPS dot from a single location check or a short watch only while the map is open, a reminder before a flight to download the destination city, and "Directions" handing off to Apple or Google Maps when online.
- **Share extension** "Save to Satchel" from Mail, Safari, Files and others, which picks the trip and suggests the day.
- **Apple Wallet:** pass-through for .pkpass files where providers supply them.
- **Widgets / Lock Screen:** the next item plus a ticket shortcut.

**SYNC (still no server of ours):**
- iCloud (CloudKit private database) sync across the user's own devices.
- Trip sharing by exporting a `.satchel` file over AirDrop or Messages and tapping to import it. Later, CloudKit shares for live shared trips.

**Later ideas:**
- currency converter with cached rates
- shared trip expenses
- check-in, check-out and car-return reminders
- offline phrase cards
- plug type and tipping notes per country
- a trip journal with photos pinned to the map

## 4. Platform facts to respect
- No API exists to pull a user's bookings from airlines or booking sites. The inputs are the share sheet, attaching files, manual entry and, later, light template parsing of shared confirmation text, always confirmed by the user.
- Location is foreground only, a single check by default; the permission text says why. No background tracking.
- Health notes and documents never leave the device unless the user turns on iCloud sync. Encrypt at rest where available.
- The emergency numbers table must be sourced and dated.

## 5. Visual design
Calm, legible "travel wallet": navy with boarding-pass paper, and one warm accent for tickets.
```
--paper:#F4F1EA --card:#FFFFFF --line:#DED8CC --ink:#14213D --muted:#6B7280
--accent:#E07A2F --accent-soft:#FBE7D6 --sea:#2A6F97 --ok:#2C7A54 --warn:#A2620F --danger:#B42318
dark: --paper:#0E1320 --card:#161C2C --line:#2A3247 --ink:#EEF1F7 --muted:#A3ABBD --accent:#F29A5C --accent-soft:#3A2516 --sea:#7DB7DA
```
Fonts: Space Grotesk (display) and Inter (body). Touch targets 48 pt or more. Ticket screens work one-handed at full brightness. Low-battery mode is pure black with white text.

## 6. Architecture (Expo SDK 58, TypeScript)
```
app/            Expo Router: (tabs)/trips, (tabs)/map, (tabs)/wallet, (tabs)/emergency; trip/[id], item/[id], essentials, settings
src/core/       pure TS, node:test, offline
  model.ts      Trip, Day, Item (kind, start/end with IANA tz), Attachment, Place, PackingList, Doc, EmergencyCard
  timeline.ts   group by local day, overlaps, gaps, next-up
  tz.ts         time-zone maths via Intl, no network
  emergency.ts  country -> numbers table (sourced, dated), card assembly
  packing.ts    templates + rules
  poi.ts        POI categories, OSM tag mapping, filter, distance sort
  battery.ts    essentials-mode rules (threshold, manual override)
  tripfile.ts   .satchel export/import (versioned JSON + attachments manifest)
  share.ts      incoming payload -> attachment + suggested trip/day
src/native/     adapters: files, maps (MapLibre later), share intake, wallet, auth lock, battery, brightness; Expo Go stubs never crash
```
Expo Go libraries until TRIAL: expo-router, expo-file-system, expo-document-picker, expo-image-picker, expo-local-authentication, expo-contacts, expo-location, expo-brightness, expo-battery, expo-sharing, expo-clipboard, expo-network, @react-native-community/datetimepicker, react-native-maps, react-native-svg, async-storage, gesture-handler, reanimated, @expo/vector-icons, @expo-google-fonts/*, plus pure-JS packages.

## 7. Risks
- **Crowded category.** The wedge is flight-mode on the day, not planning. Keep the milestones strict.
- **Map data:** ODbL compliance (attribution, share-alike on derived databases), size of the city files (aim for 10–60 MB per city), and the hosting terms.
- **Scope creep:** "all in one" can sprawl, so nothing after TRIAL until the owner has tried it.
