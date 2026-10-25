# Store listing (draft)

Written for T20 from the OpenAI lane draft in `docs/spec/STORE.md`, checked against what is built today (TRIAL milestone) and docs/PLAN.md. "Satchel" is a working title: check App Store and trademark availability before launch (PLAN.md). No competitor names, no brand names, no battery-life numbers.

**Rule for this file:** the paste-ready copy below only describes features that exist in the app now. Anything unbuilt (downloadable offline maps, offline points of interest, trip export/import, share extension, iCloud sync, shared trips, widgets, Wallet passes, Satchel Plus itself) is kept out of the copy and listed under "Add when shipped" at the end. Before each submission, re-read the copy against the build and the owner's trial answers in docs/TRIAL.md (Starter Standard §3: never claim a feature works on a real phone until the owner confirms it).

Character counts were measured with a script; recount after any edit.

## App Store (iOS)

| Field | Text | Chars / limit |
|---|---|---|
| Name | Satchel: Offline Travel Wallet | 30 / 30 |
| Subtitle | Trips & tickets in flight mode | 30 / 30 |

Fallback name if "Satchel" is taken: `Flight Mode Travel Wallet` (25).

### Keywords (100 limit)

```
itinerary,planner,boarding,pass,packing,emergency,passport,visa,documents,hotel,airplane,QR,map
```

**95 characters**, comma-separated, no spaces. Words already in the name or subtitle (satchel, offline, travel, wallet, trips, tickets, flight, mode) are left out because Apple indexes those already. No brand or competitor names. Swap ideas if a word underperforms: holiday, vacation, journey, checklist, timeline.

### Promotional text (170 limit, can change without review)

> Keep your itinerary, tickets, documents and emergency card together on your phone. Save what you need before you travel, then open it in flight mode.

(149 characters)

### Description

> Leave your phone in flight mode. Your trip is still there.
>
> Satchel keeps the details you need on the day in one calm place, saved on your phone, so you are not hunting for a signal at the gate, on the train or at the taxi rank.
>
> PLAN THE TRIP
> - A day-by-day timeline for each trip, with a Next up card at the top.
> - Add flights, trains, ferries, buses, hotels, car hire, activities and notes.
> - Each booking keeps its own time zone, so departure and arrival times read correctly.
> - Warnings for nights with no bed booked and bookings that clash.
> - Attach PDFs and images from Files or Photos.
>
> TICKETS AT THE GATE
> - Open a ticket full screen at full brightness.
> - Save a crop of the QR code so it opens big in one tap.
>
> KEEP ESSENTIALS CLOSE
> - Hotel address card: shows the address in large text, with room for the local-language address to show a taxi driver.
> - Document vault for passport, visa and licence copies, with expiry warnings and a Face ID or passcode lock.
> - Emergency card: local emergency numbers (always check them locally), your insurance details, emergency contacts and private medical notes.
> - Packing lists with templates for different kinds of trip.
>
> WHEN THE BATTERY IS LOW
> - Essentials mode: a plain black screen with your next ticket, hotel address and emergency card. Satchel offers it when your battery is low, and you can switch it on any time.
>
> MAP
> - See your bookings and saved places on a map, and check where you are with a single tap. Location is checked once when you ask and is never tracked in the background. The map background needs a signal in this version.
>
> PRIVATE BY DESIGN
> - No account. No ads. No analytics. No tracking.
> - Your trips, documents and medical notes stay on your phone.
>
> Try it straight away with a sample trip.

### Six screenshot captions

Shots, states and sizes are in docs/SCREENSHOTS.md.

1. **Your whole trip, day by day** — trip timeline with the Next up card.
2. **Tickets ready at the gate** — ticket full screen with its QR crop.
3. **Show the driver your hotel** — hotel address card with the local-language address.
4. **Help, one tap away** — emergency card (numbers marked "check locally").
5. **Documents, locked and dated** — document vault with expiry warnings.
6. **Pack with a clear checklist** — packing list from a template.

### What's New (first release)

> First release. Trips with a day-by-day timeline, tickets with QR crops, hotel address card, document vault, emergency card, packing lists and low-battery essentials mode, all saved on your phone.

## Google Play

| Field | Text | Chars / limit |
|---|---|---|
| App name | Satchel: Offline Travel Wallet | 30 / 30 |
| Short description | Trips, tickets, documents and emergency card, ready in flight mode. | 67 / 80 |

- **Full description (4000 limit):** use the App Store description above unchanged (1,768 characters). Play has no keyword field; the words in the description do that job, so keep "timeline", "tickets", "packing lists", "document vault" and "flight mode" in the text when editing (adding "itinerary" and "offline" to the first paragraph for Play is worth testing).
- **Screenshots:** the same six shots and captions (docs/SCREENSHOTS.md, Play phone size).
- **Feature graphic (1024 x 500, required):** paper background (#F4F1EA) with the satchel mark and the line "Your trip, ready in flight mode". Original art only, no logos or device frames from other brands.
- **Release notes:** same as What's New.
- **Category:** Travel & Local. **App Store category:** Travel (secondary: Productivity).

## Checked from the OpenAI draft (docs/spec/STORE.md)

Kept (true of the build): day-by-day timeline, booking kinds, attaching PDFs and images, tickets with QR crops, hotel address with local-language field, document vault with biometric lock, packing templates, emergency card with insurance, contacts and medical notes, dark essentials screen, no account / backend / ads / tracking, promotional text (lightly edited), captions 1, 2, 4 and 6.

Rejected or changed:

| Draft text | Why |
|---|---|
| "Download one city map per trip for offline use"; caption 3 "A city map that works offline" | Offline maps are not built (T12). The map today is the online system map. Caption 3 replaced with the hotel address card. |
| "Use saved places and map points such as pharmacies, food, toilets and transport stops" | The only map points are invented sample data for the demo trip; real offline points of interest are T13. |
| "Export or import a trip as a file" | Not built (T15). |
| The Plus paragraph (unlimited offline cities, offline points of interest, sync across devices, shared trips, widgets, themes) and "one offline city per trip" in the free list | Satchel Plus and all of those features are unbuilt (T12-T17). |
| "stored on your device unless you choose to enable cloud sync" | There is no sync to enable yet (T17). |
| "Numbers include a source and date" | Most rows have no source and none has a checked date (ops/DECISIONS.md); the copy says "check them locally" instead. |
| "Use the app in flight mode" as a flat claim | Kept as the pitch ("ready in flight mode"), but the owner has not yet confirmed flight-mode behaviour on a real phone; confirm the TRIAL.md flight-mode questions before submitting. |
| Caption 5 "expiry reminders" | The vault shows expiry warnings; there are no reminder notifications. |
| Keyword field `offline,travel,wallet,map,itinerary,tickets,trip,packing,documents,flight` | Repeated words already in the name/subtitle and wasted about 40 characters. |
| Extra keyword ideas "QR ticket wallet", "trip file sharing" | "Wallet" in a QR context can read as the Apple Wallet feature (not built); file sharing is not built. |

No competitor names or battery-life numbers were found in the draft.

## Add when shipped (do not paste before the feature is in the build and confirmed)

- Offline city maps: "Download your destination city before you fly; the map and your blue dot work in flight mode." (T12, needs OpenStreetMap attribution in the app, see docs/THIRD_PARTY.md)
- Offline points of interest: toilets, drinking water, pharmacies, food, ATMs, hospitals and transport stops. (T13)
- Export and import a trip as a file to AirDrop or message. (T15)
- Satchel Plus, one-time purchase, no subscription: unlimited offline cities and regions, offline points of interest everywhere, iCloud sync, shared trips, widgets and themes (only the parts that exist at the time). Add the price-free wording "An optional one-time purchase"; the store shows the price. (T16-T17)
- "Save to Satchel" from the share sheet (T14), Wallet pass hand-off (T17), Lock Screen and home-screen widgets (T17).
