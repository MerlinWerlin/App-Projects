# Store listing (release 0.1.0)

Rewritten for T158 (run 111, 1 Nov 2026) from what is in the build: the done tasks in ops/backlog.json, ops/RUNLOG.md, docs/TRIAL.md and the screens under app/. The 24 Oct draft (T20) described only the first trial build. "Satchel" is a working title: check App Store and trademark availability before launch (PLAN.md).

**Rule for this file:** the paste-ready copy below only describes features that exist in the build and work without anything still unpublished. Offline city map downloads are in the build but not live (the map files, GitHub release `satchel-maps-v1`, are not published), so they, the offline places that come with them and Satchel Plus (which only unlocks extra offline cities per trip) stay out of the copy and wait under "Add when shipped". Before each submission, re-read the copy against the build and the owner's answers in docs/TRIAL.md (Starter Standard §3: never claim something works on a real phone until the owner confirms it).

House rules for the copy: no competitor or brand names, no battery-life numbers, no "works on your phone" claims, no medical or legal guarantees, emergency numbers always "verify locally". No ads, no tracking, no account; everything described is free.

**Checked by a script.** `node tools/store/limits.mjs` reads the tables and the fenced blocks under each "(N limit)" heading in the App Store and Google Play sections, prints each field's character count and fails on a field over its limit, a wrong count in a table, a keyword already in the name or subtitle, a brand name or a banned claim. `npm test` runs the same checks (src/core/storelimits.test.ts). Paste the fenced text exactly as it is.

## App Store (iOS)

| Field | Text | Chars / limit |
|---|---|---|
| Name | Satchel: Offline Travel Wallet | 30 / 30 |
| Subtitle | Trips & tickets in flight mode | 30 / 30 |

Fallback name if "Satchel" is taken: `Flight Mode Travel Wallet` (25).

### Keywords (100 limit)

```text
itinerary,planner,boarding,pass,packing,passport,emergency,toilet,phrasebook,jetlag,currency,journal
```

Comma-separated, no spaces. Words Apple already indexes from the name and subtitle (satchel, offline, travel, wallet, trip, tickets, flight, mode) are left out, and so are brand names. Swap ideas if a word underperforms: holiday, vacation, converter, documents, layover, checklist.

### Promotional text (170 limit)

Can change without review.

```text
Your plan, tickets, documents and emergency card in one calm place, saved on your phone and ready in flight mode. Free, with no ads, no account and no tracking.
```

### Description (4000 limit)

```text
Leave your phone in flight mode. Your trip is still there.

Satchel keeps everything for the trip in one calm place, saved on your phone: the plan, the tickets, the documents and the details you need when there is no signal at the gate, on the train or at the taxi rank.

PLAN THE TRIP
- A day-by-day timeline with a Next up card and a Your day brief each morning.
- Flights, trains, ferries, buses, stays, car hire, activities and notes, each in its own time zone.
- Paste a confirmation email and Satchel drafts the booking, or share a PDF or text into Satchel from other apps.
- A Ready to go? check for passport dates, plus flags for missing stays, clashes, tight connections and check-in times.
- Places to go, Plan my day, trip to-dos, public holidays, jet lag tips and a Call home planner.
- Sunrise, sunset and golden hour for every day, plus a saved forecast and a rainy-day Plan B.
- Illustrated trip covers or your own photo. Add to Calendar, share the plan as text, or plan a trip again.

TICKETS AND WALLET
- Tickets full screen at full brightness, with the code cropped big. PDFs open inside the app.
- Loyalty cards, stay details with room, door code and a Wi-Fi code to join.
- Currency converter with your own rates, bill split, cash on hand, units and a tipping guide.
- Trip spending: budget, shared costs with travel companions, receipt photos and a spreadsheet export.

SAFETY
- Emergency card: local emergency numbers (verify locally), your insurance, contacts and private medical notes.
- Step-by-step guides for a lost passport, lost cards, lost luggage and more.
- I'm safe: share where you are with one location check, only when you tap.
- Medicine times that follow you across time zones.
- Help cards for children and companions, and a step-free card for access needs, in the local language.
- Local customs, plugs and voltage, driving abroad with a rental car checklist, and getting around guides.

WORDS AND SIGNS
- Show-a-local phrase cards, a sign reader and a numbers and prices trainer in 12 languages, plus a menu helper.

TOILETS
- Find public toilets near you or your hotel, with filters for free, wheelchair, changing table and open now. Needs a signal.

PACKING
- Packing lists from templates, scaled to the number of nights, sorted into bags.
- Outfit planner, lost-bag kit, gifts and postcards lists.
- Leaving home and coming home checklists.

MEMORIES
- A trip journal with photos, a recap of each trip, passport stamps and Your travels: countries, cities and days away.
- Travel games for queues, flights and car trips.
- An In the air card while you fly.

DOCUMENTS AND LOW BATTERY
- Document vault for passport, visa and licence copies, with expiry warnings and a Face ID or passcode lock.
- Essentials mode: a plain dark screen with your next ticket, hotel address and emergency card when the battery is low.

MAP
- Your bookings, saved places and each day's stops on the map, with search and a compass back to your hotel. The map background needs a signal.

PRIVATE BY DESIGN
- No account. No ads. No tracking. Your trips, documents and notes stay on your phone.
- Back up everything to one file and restore it on a new phone. Send a trip to a friend as a file.
- Light and dark mode.

Try it straight away with the demo trip.
```

### What's New in 0.1.0 (4000 limit)

```text
First release.

- Trips with a day-by-day timeline, Your day brief, readiness check, connections and check-in times.
- Paste a booking or share one in from other apps.
- Tickets full screen with the code cropped big, loyalty cards and stay details.
- Emergency card with local numbers (verify locally), guides for when things go wrong, medicine times and help cards.
- Phrase cards, sign reader and numbers trainer in 12 languages, and a menu helper.
- Toilet finder, packing lists with bags and outfits, spending with shared costs, journal and trip recap.
- Document vault with a lock, low-battery essentials mode, backup and restore.

Everything stays on your phone. No account, no ads, no tracking.
```

### Six screenshot captions

Shots, states and sizes are in docs/SCREENSHOTS.md (the shot table there must use these captions in this order; the test checks it).

1. **Your whole trip, day by day** — demo trip cover hero and timeline with Next up.
2. **Tickets ready at the gate** — ticket full screen with the code cropped big.
3. **Find a toilet, fast** — Toilets tab near the demo hotel, with filter chips.
4. **Help, one tap away** — emergency card, numbers marked "verify locally".
5. **Show a local** — phrase card "Where is the toilet?" in Japanese.
6. **Pack once, pack right** — packing list sorted into bags.
7. **Every trip, remembered** — Your travels with countries, days away and stamps.

## Google Play

| Field | Text | Chars / limit |
|---|---|---|
| App name | Satchel: Offline Travel Wallet | 30 / 30 |
| Short description | Your trip, tickets, documents and emergency card, ready in flight mode. | 71 / 80 |

### Full description (4000 limit)

Same as the App Store description, with "Face ID or passcode lock" made general for Android phones.

```text
Leave your phone in flight mode. Your trip is still there.

Satchel keeps everything for the trip in one calm place, saved on your phone: the plan, the tickets, the documents and the details you need when there is no signal at the gate, on the train or at the taxi rank. An offline travel wallet and itinerary planner.

PLAN THE TRIP
- A day-by-day timeline with a Next up card and a Your day brief each morning.
- Flights, trains, ferries, buses, stays, car hire, activities and notes, each in its own time zone.
- Paste a confirmation email and Satchel drafts the booking, or share a PDF or text into Satchel from other apps.
- A Ready to go? check for passport dates, plus flags for missing stays, clashes, tight connections and check-in times.
- Places to go, Plan my day, trip to-dos, public holidays, jet lag tips and a Call home planner.
- Sunrise, sunset and golden hour for every day, plus a saved forecast and a rainy-day Plan B.
- Illustrated trip covers or your own photo. Add to Calendar, share the plan as text, or plan a trip again.

TICKETS AND WALLET
- Tickets full screen at full brightness, with the code cropped big. PDFs open inside the app.
- Loyalty cards, stay details with room, door code and a Wi-Fi code to join.
- Currency converter with your own rates, bill split, cash on hand, units and a tipping guide.
- Trip spending: budget, shared costs with travel companions, receipt photos and a spreadsheet export.

SAFETY
- Emergency card: local emergency numbers (verify locally), your insurance, contacts and private medical notes.
- Step-by-step guides for a lost passport, lost cards, lost luggage and more.
- I'm safe: share where you are with one location check, only when you tap.
- Medicine times that follow you across time zones.
- Help cards for children and companions, and a step-free card for access needs, in the local language.
- Local customs, plugs and voltage, driving abroad with a rental car checklist, and getting around guides.

WORDS AND SIGNS
- Show-a-local phrase cards, a sign reader and a numbers and prices trainer in 12 languages, plus a menu helper.

TOILETS
- Find public toilets near you or your hotel, with filters for free, wheelchair, changing table and open now. Needs a signal.

PACKING
- Packing lists from templates, scaled to the number of nights, sorted into bags.
- Outfit planner, lost-bag kit, gifts and postcards lists.
- Leaving home and coming home checklists.

MEMORIES
- A trip journal with photos, a recap of each trip, passport stamps and Your travels: countries, cities and days away.
- Travel games for queues, flights and car trips.
- An In the air card while you fly.

DOCUMENTS AND LOW BATTERY
- Document vault for passport, visa and licence copies, with expiry warnings and a fingerprint, face or passcode lock.
- Essentials mode: a plain dark screen with your next ticket, hotel address and emergency card when the battery is low.

MAP
- Your bookings, saved places and each day's stops on the map, with search and a compass back to your hotel. The map background needs a signal.

PRIVATE BY DESIGN
- No account. No ads. No tracking. Your trips, documents and notes stay on your phone.
- Back up everything to one file and restore it on a new phone. Send a trip to a friend as a file.
- Light and dark mode.

Try it straight away with the demo trip.
```

- **Release notes:** the What's New text above.
- **Screenshots:** the same shots and captions (docs/SCREENSHOTS.md, Play phone size; Play takes 2 to 8).
- **Feature graphic (1024 x 500, required):** paper background (#F4F1EA) with the satchel mark and the line "Your trip, ready in flight mode". Original art only, no logos or device frames from other brands.
- **Category:** Travel & Local. **App Store category:** Travel (secondary: Productivity).
- The Android build is not tested yet (iOS first). Re-check the Play copy against an Android build before the first Play upload: share-in, the vault lock and Add to Calendar behave differently there.

## Notes on the copy

- **Signal-only parts are labelled.** The toilet finder, the weather forecast (saved once fetched), nearest help and the map background need a connection until offline city maps go live; the copy says "Needs a signal" for toilets and the map, and says the forecast is saved. Sunrise, golden hour, phrases, guides, converters and everything you saved work offline.
- **Emergency numbers:** every field that mentions them says "verify locally" (the in-app card has a source and checked date per country, but numbers change).
- **Medical notes and medicine times** are the traveller's own notes and reminders, not advice; keep the copy that way.
- **Face ID** is named only in the App Store text; Play says "fingerprint, face or passcode".
- **Not in the copy although built:** the In-flight games and recap details beyond one line, arrival cards, photo light details, kids' rows, Plan B dismissals, and other smaller follow-ups. Fine to rotate in when a feature gets owner confirmation in docs/TRIAL.md.
- **Owner confirmation:** the pitch "ready in flight mode" and every feature above still need the owner's yes on a TestFlight build (docs/TRIAL.md). Do not submit while any line above has a "no" there.

## Add when shipped (do not paste before the feature is live and confirmed)

- **Offline city maps**, when the map files (GitHub release `satchel-maps-v1`) are published and the owner confirms the TRIAL.md map test: "The map works online, plus downloaded cities when available: download your destination before you fly and the streets, labels and your position show in flight mode." Needs "© OpenStreetMap contributors" attribution in the app (docs/THIRD_PARTY.md). Remove "The map background needs a signal" from the MAP lines then.
- **Offline places from downloaded cities:** toilets, pharmacies, hospitals, police, ATMs, food and transport stops in flight mode; then drop "Needs a signal" from the TOILETS line.
- **Satchel Plus**, at the same time as offline city maps: "Everything is free. Satchel Plus, an optional one-time purchase with no subscription, adds extra offline cities for each trip." Store pages show the price; never write it in the copy. Plus unlocks nothing else.
- iCloud sync, shared trips, widgets, Wallet passes: not built.
