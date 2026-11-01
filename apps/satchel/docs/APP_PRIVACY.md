# App privacy answers (T159, 1 Nov 2026)

What to enter in App Store Connect "App Privacy" and Google Play "Data safety", worked out from the code (runtime
inventory below). Public page: docs/privacy.html. src/core/privacyhosts.test.ts fails if code gains a host that
docs/privacy.html does not name, or a new file starts using the network.

## Runtime inventory (what the app touches)

**Network: services the app calls by itself, only when online**

| Host | Code | When | What is sent |
|---|---|---|---|
| Apple Maps (MapKit tiles; `maps.apple.com` links) | src/native/maps.tsx (react-native-maps, system map); link builders in src/core/toilets.ts, safecheck.ts, staydetails.ts, dayplan.ts | Map on screen without a downloaded city covering it; "Open in Apple Maps" / directions when tapped | The map area being viewed (by MapKit); for a tapped link, destination and optional start coordinates, opened in the Maps app |
| `api.met.no` (MET Norway Locationforecast) | src/core/weather.ts `MET_URL`, src/native/weather.ts | Trip weather card, online, forecast range covers the trip | Coordinates of the trip's stay or saved place, rounded to 4 decimals; User-Agent `Satchel/<version> github.com/MerlinWerlin/App-Projects`. Never the phone's location |
| `overpass-api.de` (OpenStreetMap Overpass) | src/native/toilets.ts `OVERPASS_URL`, src/native/help.ts | "Find toilets / help near me" or "Near my hotel" when no installed city pack covers the spot | That spot (6 decimals) and a radius |
| `github.com` releases (`satchel-maps-v1`) | src/core/citymaps.ts `MAPS_BASE_URL`, src/native/cityMaps.ts | Opening the city map list; downloading a city | File names only (catalog.json, the city pack) |
| Expo update service | expo-updates (app.json `updates`, url filled by EAS) | App launch, online | App version, runtime version, platform, channel; no user data |
| App Store / Google Play billing | src/plus/store.ts (expo-iap) | Unlock / Restore in Settings > Satchel Plus | Handled by the OS store; the app gets only the purchase result |

Not runtime calls: source-citation URLs in src/content/*.json and the licences screen open in the browser only when
tapped ("links you choose to open in your browser"); idea links the user saves, likewise. No WebView loads remote
content (src/native/pdfView.tsx shows local PDFs with JavaScript off and refuses links).

**On-device only**
- expo-location: `getCurrentPositionAsync` once per tap (src/native/location.ts: map Where am I?, toilets/help
  near me, day-plan start, gift spot, Share where I am); `watchPositionAsync` + `watchHeadingAsync` only while Find
  my way back is focused (src/native/compass.ts). Foreground only; background blocked in app.json.
- expo-image-picker (library + camera), expo-document-picker, expo-contacts (system picker, one contact),
  expo-clipboard (read only on "Paste from clipboard"): picked items are copied into the app's documents folder.
- expo-local-authentication: vault and hidden stay codes; the app receives success/failure only.
- AsyncStorage (`satchel.*` keys) and expo-file-system (attachments/, covers/, vault/, maps/): all local.
- expo-sharing / React Native Share: backup (.satchelbackup, not encrypted, vault only with "Include documents"),
  trip file (.satchel, never vault / emergency card / medical notes / home codes), calendar .ics, itinerary text.
  The user picks the destination.
- Linking: tel:, sms:, facetime:, maps links, Settings. The user's own apps handle them.
- expo-network, expo-battery, expo-brightness, expo-keep-awake, expo-haptics, expo-localization: read locally.

## App Store Connect > App Privacy

**Answer: "No, we do not collect data from this app" -> label "Data Not Collected".**

Apple counts data as collected when it is transmitted off the device in a way the developer or its third-party
partners can access beyond what is needed to service the request in real time. Satchel has no server, no SDK for
analytics, ads, crash reporting or attribution, and no account. Per Apple data type:

| Apple data type | Answer | Why |
|---|---|---|
| Contact Info (name, email, phone, address) | Not collected | Contacts picked for the emergency card / help cards / trusted contacts stay in AsyncStorage on the phone. No sign-up |
| Health & Fitness | Not collected | Medical notes and medicine times are local only, never in trip files |
| Financial Info | Not collected | Spending and receipts are local; purchases go through Apple, the app never sees payment info |
| Location (precise / coarse) | Not collected | Location is used on device. The one case it leaves the phone (Overpass near-me search without a city pack) is sent straight to a third-party service to answer that request, not stored or linked by us: Apple's "service the request in real time" case. The MET forecast uses a booking's place, not the device location |
| Sensitive Info | Not collected | Nothing leaves the phone |
| Contacts (address book) | Not collected | System picker, one contact at a time, stored locally |
| User Content (photos, documents, other) | Not collected | Attachments, journal, vault copies are local; backups/trip files go only where the user sends them |
| Browsing / Search History | Not collected | Map search runs over local city packs; no search terms go online |
| Identifiers (user ID, device ID) | Not collected | None created or sent; MET User-Agent names the app, not the user |
| Purchases | Not collected | expo-iap result stays on the phone; Apple handles the transaction |
| Usage Data, Diagnostics | Not collected | No analytics, no crash reporter |
| Other Data | Not collected | |

Tracking: **No** (app.json `privacyManifests.NSPrivacyTracking: false`, no tracking domains, no collected types).

**What changes this answer** (re-answer before release if any of these land):
- Any analytics, crash reporting (Sentry, Crashlytics, Expo Insights...), ads or attribution SDK.
- A server of ours, an account, sync through our backend, or a feedback form that uploads text or logs.
- Sending the device location or search terms to a service that keeps them for its own use or that we can access.
- A new host in code: src/core/privacyhosts.test.ts will fail until docs/privacy.html names it.
- iCloud sync in the user's own private iCloud container would still be "not collected" (we can't access it), but
  docs/privacy.html must say so first.

## Google Play > Data safety

- Does your app collect or share any of the required user data types? **No.**
- Is all user data encrypted in transit? Answered only if collected; for completeness: every call above is HTTPS.
- Do you provide a way for users to request that their data be deleted? Not applicable (nothing is collected);
  deleting the app or its data removes everything.
- Location: used on device only, foreground, at the user's request. Play's "ephemeral processing" applies to the
  Overpass near-me request (sent to answer it, not stored by us), so it is not "collected".
- **Before answering for a Play build:** the Android map is Google Maps SDK (decision B in docs/RELEASE_CHECKLIST.md).
  Check what that SDK declares in Google's own Data safety guidance and include it if Google says so.
- Android permissions expected in the build (app.json plus what the modules add; confirm in the Play Console after the
  first upload): location (fine + coarse, background blocked), camera and media (expo-image-picker),
  contacts (expo-contacts), biometric (expo-local-authentication), internet. All match the uses above.

## iOS purpose strings (app.json), checked against the code

| Key | Used by | Status |
|---|---|---|
| NSLocationWhenInUseUsageDescription (+ expo-location plugin copy) | location.ts (once per tap: map, toilets, help, day plan, gifts, safe) and compass.ts (watch while Find my way back is open) | **Fixed in T159.** Old text said "once, only when you tap Where am I?" and "stays on your phone"; Find my way back watches while open and a near-me search can send the spot to OpenStreetMap |
| NSPhotoLibraryUsageDescription (+ image-picker `photosPermission`) | pickers.ts, docPick.ts (vault), journal.ts, coverPhoto.ts, helpcard / lost bag / rental / receipt photos | **Fixed in T159.** Old text named only tickets and bookings (the T64/T72/T92 wording queued in RELEASE_CHECKLIST is folded in and widened) |
| NSCameraUsageDescription (+ image-picker `cameraPermission`) | journal.ts `launchCameraAsync`, reused by cards, help cards, lost bag, rental, receipts | **Fixed in T159**, same reason |
| NSFaceIDUsageDescription | auth.ts: vault (WalletVaultSlot) and hidden stay codes (app/stay/[itemId].tsx) | **Fixed in T159**: now names the stay codes too |
| NSContactsUsageDescription | contacts.ts `pickContact`: emergency card, help cards, trusted contacts (app/safe.tsx) | **Fixed in T159**: named only the emergency card |
| Microphone | not used (`microphonePermission: false`) | ok |
| Calendar / Reminders | not used (.ics goes through the share sheet, no EventKit) | ok, no key needed |
| Photo library add-only | not used (nothing is saved to Photos) | ok |

The infoPlist and the plugin copies are kept identical (src/release.test.ts checks every key has a string). These
changes need a new TestFlight build: an over-the-air update can't change Info.plist.
