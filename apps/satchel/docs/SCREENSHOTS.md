# Screenshot kit (release 0.1.0)

Seven store screenshots for the App Store and Google Play, refreshed for T158 to show the richer look (trip covers, illustrated headers, light and dark). All of them come from the built-in demo trip (Tokyo & Kyoto) and the invented sample data it seeds: a sample ticket on the outbound demo flight, a sample passport in the vault and sample emergency details. Nothing is a real carrier, insurer, person or document number. Captions match docs/STORE.md word for word and in order (`npm test` checks it). Every screen shown must exist in the build being submitted; never mock up an unbuilt or unpublished feature (offline city map downloads, offline places, Satchel Plus, widgets, sync, Wallet passes).

## Sizes

| Store | Device class | Portrait size (px) | Notes |
|---|---|---|---|
| App Store | 6.9" iPhone | 1320 x 2868 | Required set. Simulator: the current largest Pro Max model. |
| App Store | 6.5" iPhone | 1284 x 2778 (or 1242 x 2688) | Only needed if App Store Connect still asks for it; otherwise it scales the 6.9" set. |
| App Store | 13" iPad | 2064 x 2752 | Only if `supportsTablet` stays true in app.json: see the iPad decision in docs/RELEASE_CHECKLIST.md. Same shots. |
| Google Play | Phone | 1080 x 1920 or 1080 x 2160 | 2 to 8 shots; each side 320 to 3840 px and the long side no more than twice the short side (so not 1080 x 2400). PNG or JPEG, no alpha. |

Check the current size list in App Store Connect and Play Console before exporting: both change with new devices.

## The seven shots

Four light, three dark. Order is the store order; drop shot 7 if a store wants six.

| # | Screen | Demo-trip state | Mode | Caption |
|---|---|---|---|---|
| 1 | Trip screen: Trips tab, then "Tokyo & Kyoto (demo)" | Fresh demo trip with its illustrated cover hero at the top, the Next up card on the Sydney to Tokyo Haneda flight and day 1 of the timeline below. No own cover photo. | Light | Your whole trip, day by day |
| 2 | Ticket view: the demo Sydney → Tokyo Haneda flight, Show ticket (or Wallet tab) | Already seeded: "Sample boarding pass" on Demo Air DA 21, a code pattern that encodes nothing with SAMPLE under it, shown big as the crop, booking ref DMO4KX, seat 34K. | Dark | Tickets ready at the gate |
| 3 | Toilets tab, "Near my hotel" | Online, searching near Hotel Asakusa Lantern (demo); the list with distances and filter chips (Free, Wheelchair, Open now), the illustrated tab header and the "© OpenStreetMap contributors" line in view. Toilet names come from OpenStreetMap: pick a scroll position with no shop or brand names showing. | Light | Find a toilet, fast |
| 4 | Emergency tab | Country set to Japan; seeded sample insurer "Sample Travel Cover (demo)", policy SAMPLE-000-DEMO, contact "Sample contact (demo)" (numbers from Australia's ranges for fiction). The illustrated header and the "verify locally" label must be visible. | Dark | Help, one tap away |
| 5 | Phrase card: Wallet tab (or Help cards) > Show a local > Japanese > "Where is the toilet?" | Full-screen card with トイレはどこですか？ big, the reading and the English line under it. | Light | Show a local |
| 6 | Packing (demo trip > Packing) | Add the "City break" template, tick 4 or 5 items, and move a few into Carry-on and Checked so the bag headers and their progress show. | Light | Pack once, pack right |
| 7 | Your travels (Trips tab > Your travels > See all) | Turn on "Include demo trips". For fuller tiles and stamps, add one or two invented past trips by hand first (made-up names, no real bookings). Countries, days away and the world tiles in view. | Dark | Every trip, remembered |

Not used as store shots: the Map tab (its background is the online system map until offline city maps ship, docs/STORE.md "Add when shipped") and Settings > Satchel Plus (only unlocks offline cities, not live). In-flight mode only shows while a flight is in the air or within 24 hours of leaving, so it is a later swap for shot 7 if the owner wants it: add an invented flight that is in the air at capture time.

## How to capture

1. Install the build you will submit (TestFlight or a simulator build of the same commit). Expo Go screens include Expo's own UI and are not suitable.
2. Fresh install, so the demo trip is seeded starting 3 days from today. If it is missing, Trips tab, empty state, "Try the demo trip".
3. Set Settings > Appearance to Light or Dark for each shot (the Mode column). Set the simulator status bar to a clean state: `xcrun simctl status_bar booted override --time 9:41 --batteryState charged --batteryLevel 100 --cellularBars 4`. For shots 1, 2, 5 and 6 you may show flight mode on to match the pitch; shot 3 needs a connection, so keep the normal signal there.
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
