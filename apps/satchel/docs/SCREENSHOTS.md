# Screenshot kit (draft)

Six store screenshots for the App Store and Google Play, all taken from the built-in demo trip (Tokyo & Kyoto). Since T33 the demo also seeds the sample data the shots need: a sample ticket on the outbound demo flight, a sample passport in the vault and sample emergency details. All of it is invented and labelled sample (no real carrier, insurer, person or document number). Captions match docs/STORE.md. Every screen shown must exist in the build being submitted; never mock up an unbuilt feature (offline map downloads, widgets, sync, Wallet, share sheet).

## Sizes

| Store | Device class | Portrait size (px) | Notes |
|---|---|---|---|
| App Store | 6.9" iPhone | 1320 x 2868 | Required set. Simulator: the current largest Pro Max model. |
| App Store | 6.5" iPhone | 1284 x 2778 (or 1242 x 2688) | Only needed if App Store Connect still asks for it; otherwise it scales the 6.9" set. |
| App Store | 13" iPad | 2064 x 2752 | Only if `supportsTablet` stays true in app.json: see the iPad decision in docs/RELEASE_CHECKLIST.md. Same six shots. |
| Google Play | Phone | 1080 x 1920 or 1080 x 2160 | 2 to 8 shots; each side 320 to 3840 px and the long side no more than twice the short side (so not 1080 x 2400). PNG or JPEG, no alpha. |

Check the current size list in App Store Connect and Play Console before exporting: both change with new devices.

## The six shots

| # | Screen | Demo-trip state | Caption |
|---|---|---|---|
| 1 | Trip timeline (Trips tab, then the "Tokyo & Kyoto (demo)" trip) | Fresh demo trip; Next up card showing the Sydney to Tokyo Haneda flight; scroll so day 1 and day 2 show. Light mode. | Your whole trip, day by day |
| 2 | Ticket view (open the demo Sydney → Tokyo Haneda flight, Show ticket; or Wallet tab) | Already seeded: "Sample boarding pass" on Demo Air DA 21, a code pattern that encodes nothing with SAMPLE printed under it, shown big as the QR crop, plus booking ref DMO4KX and seat 34K. Dark mode reads well here. | Tickets ready at the gate |
| 3 | Hotel address card (demo Hotel Asakusa Lantern) | Address and local-language address (already in the demo) in large text. Light mode. | Show the driver your hotel |
| 4 | Emergency tab | Country set to Japan. Already seeded (only when the card was empty): insurer "Sample Travel Cover (demo)", policy SAMPLE-000-DEMO, phone +61 2 5550 0101, contact "Sample contact (demo)" +61 491 570 156, and a sample medical note. The numbers come from Australia's ranges set aside for fiction. The "verify locally" label must be visible. | Help, one tap away |
| 5 | Document vault (unlocked) | Already seeded: "Sample passport (demo)", valid for about four years, with a placeholder page image (grey bars and SAMPLE, no name or number). To show the expiry warning, add a second invented entry, for example "Driving licence (sample)" expiring in 2 months. Never a real ID scan. | Documents, locked and dated |
| 6 | Packing list (demo trip, Packing) | Add the "City break" template; tick off 4 or 5 items. Light mode. | Pack with a clear checklist |

Do not use the Map tab as a store shot until the offline map (T12) ships: today it is the online system map with invented sample points.

## How to capture

1. Install the build you will submit (TestFlight or a simulator build of the same commit). Expo Go screens include Expo's own UI and are not suitable.
2. Fresh install, so the demo trip is seeded starting 3 days from today. If it is missing, Trips tab, empty state, "Try the demo trip".
3. Set the simulator status bar to a clean state: `xcrun simctl status_bar booted override --time 9:41 --batteryState charged --batteryLevel 100 --cellularBars 4`. For shots 1 to 3 you may show flight mode on to match the pitch.
4. Check the seeded sample data from the table above is there (ticket, vault passport, emergency details). The emergency details are only seeded onto an empty card, so on a phone that already has a card fill in the same invented values by hand. Anything extra you add must be made up too: no real brands, people or documents.
5. Removing the demo trip also removes the sample passport and clears the emergency card if it still holds exactly the sample details; an edited card is kept.
6. Capture with `xcrun simctl io booted screenshot shot-1.png` (iOS) or the Android emulator's camera button (Play), once in each required size.
7. Turn off haptics and anything that animates mid-capture; wait for the startup fade to finish.
8. Keep the raw captures and the framed exports in `docs/art/screenshots/` with a short `meta.json` (device, build commit, date, caption).

## Background and frame

- Original backgrounds only. Use the app's own palette: paper `#F4F1EA` with navy `#14213D` text for light shots, `#0E1320` with `#EEF1F7` for dark shots, and the warm accent `#E07A2F` for one highlight line per shot at most.
- Caption at the top, 2 lines maximum, in Space Grotesk Bold (SIL OFL, see docs/THIRD_PARTY.md); the screenshot below, scaled to about 80% of the canvas width, with rounded corners and a soft shadow.
- Optional background art: a simple boarding-pass or paper-texture pattern, made from vector shapes or generated with the prompts in docs/art/ART_PROMPTS.md (save each prompt in `meta.json`). No landmarks, no airline or map-provider marks.
- Use a plain rounded rectangle as the "device"; do not use any phone maker's device frame artwork, logos or wordmarks. No competitor names or app icons anywhere.
- Text inside the screenshot must match the build: do not retouch numbers, times or labels.
