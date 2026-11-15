# Satchel 1.0.0: App Store listing (first release)

Copy-paste text for App Store Connect > Satchel (app id 6826958413) > iOS App > 1.0 > App Store tab, primary
language English (Australia). Satchel 1.0.0 is a free download with a 7-day free trial, then a one-time A$2.99 unlock (two non-consumables,
`store/IAP.md`). iPhone only (`supportsTablet: false`), no account, no ads and no tracking.

**Checked by a script.** `node tools/store/limits.mjs` reads the table and the fenced blocks under each "(N limit)"
heading in the "App Store" section below, prints each field's character count and fails on a field over its limit, a
wrong count in the table, a keyword already in the name or subtitle, a brand name or a banned claim. `npm test` runs
the same checks (src/core/storelimits.test.ts). Paste the fenced text exactly as it is.

House rules for the copy: describe only what is in the 1.0.0 build; no competitor, airline, map-provider or phone
brand names; no battery-life numbers; no "works on your phone" claims; no medical or legal guarantees; emergency
numbers always "verify locally".

## App Store (iOS)

| Field | Text | Chars / limit |
|---|---|---|
| Name | Satchel: Offline Travel Wallet | 30 / 30 |
| Subtitle | Itinerary, tickets & documents | 30 / 30 |

If App Store Connect says the name is taken, use `Satchel: Trip Wallet & Planner` (30) and keep the subtitle.

### Keywords (100 limit)

```text
planner,boarding,pass,packing,passport,emergency,toilet,phrasebook,jetlag,holiday,vacation,journal
```

Comma-separated, no spaces. Words Apple already indexes from the name and subtitle (satchel, offline, travel,
wallet, itinerary, tickets, documents) are left out, and so are brand names.

### Promotional text (170 limit)

Can change without review.

```text
Your itinerary, tickets, documents and emergency card in one calm place, saved on your phone and ready in flight mode. No ads, no account and no tracking.
```

### Description (4000 limit)

```text
Leave your phone in flight mode. Your trip is still there.

Satchel keeps everything for the trip in one calm place, saved on your phone: the itinerary, the tickets, the documents and the details you need when there is no signal at the gate, on the train or at the taxi rank.

YOUR ITINERARY
- An Itinerary tab with Today and Tomorrow at a glance, a day strip and a timetable you can swipe through.
- Already have a plan? Copy Satchel's simple format and paste your plans in, or let an AI chat app you already use fill it in for you. Satchel shows every plan it found so you can check them before anything is saved.
- Or add plans yourself with the day, time, type and place. Tap a plan to edit or delete it.
- Open a calendar file, paste a confirmation email, or share a PDF or text into Satchel from other apps.
- Share your itinerary to another phone as a calendar file, a Satchel file or text, so a travel companion has a copy if your battery runs flat.

PLAN THE TRIP
- Flights, trains, ferries, buses, stays, car hire, activities and notes, each in its own time zone, with a Next up card and a Your day brief each morning.
- A Ready to go? check for passport dates, plus flags for missing stays, clashes, tight connections and check-in times.
- Places to go, Plan my day, trip to-dos, public holidays, jet lag tips and a Call home planner.
- Sunrise, sunset and golden hour for every day, plus a saved forecast and a rainy-day Plan B.

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

MAP AND TOILETS
- Your bookings, saved places and each day's stops on the map, with search and a compass back to your hotel.
- Download a city before you fly (Tokyo, Kyoto and Sydney to start) and its streets, toilets and places work in flight mode. Elsewhere the map background needs a signal. Map data © OpenStreetMap contributors.
- Find public toilets near you or your hotel, with filters for free, wheelchair, changing table and open now.

PACKING
- Packing lists from templates, scaled to the number of nights, sorted into bags.
- Outfit planner, lost-bag kit, gifts and postcards lists.
- Leaving home and coming home checklists.

MEMORIES
- A trip journal with photos, a recap of each trip, passport stamps and Your travels: countries, cities and days away.

DOCUMENTS AND LOW BATTERY
- Document vault for passport, visa and licence copies, with expiry warnings and a Face ID or passcode lock.
- Essentials mode: a plain dark screen with your next ticket, hotel address and emergency card when the battery is low.

PRIVATE BY DESIGN
- No account. No ads. No tracking. Your trips, documents and notes stay on your phone.
- Back up everything to one file and restore it on a new phone. Send a trip to a friend as a file.
- Light and dark mode.

FREE TRIAL
Free 7-day trial, then a one-time A$2.99 unlock. No subscription. After the trial, every trip you saved stays viewable and trip files friends send you always open.

Weather data: MET Norway.

Try it straight away with the sample trip.
```

### Screenshot captions

Shots and how they are made: `store/screenshots/README.md` (6.9" iPhone, 1320 x 2868). docs/SCREENSHOTS.md uses
these captions in this order (the test checks it).

1. **Your itinerary, day by day** — Itinerary tab: Today, the day strip and the timetable of an invented Tokyo trip.
2. **Paste your plans, check, save** — Add your itinerary: five pasted plans found, ticked, Add 5 plans.
3. **Tickets ready at the gate** — a boarding pass full screen with the code big.
4. **Show a local, in 12 languages** — phrase cards, Japanese picked from the trip.
5. **Help, one tap away** — emergency card for Japan, numbers marked "verify locally".
6. **Your trip on the map** — the Map tab with the trip's pins in Tokyo.

## Other App Store Connect fields

| Field | Value |
|---|---|
| Primary category | Travel |
| Secondary category | Productivity |
| Price | Free download; in-app purchases `com.jared797.satchel.trial7` (free) and `com.jared797.satchel.unlock` (A$2.99), see `store/IAP.md` |
| Support URL | `https://merlinwerlin.github.io/App-Projects/satchel/support.html` |
| Privacy Policy URL | `https://merlinwerlin.github.io/App-Projects/satchel/privacy.html` |
| Marketing URL | leave empty |
| Copyright | `2026 Jared Bradley` (App Store Connect adds the ©) |
| Version | 1.0 (the build is 1.0.0) |
| What's New | not shown for a first version; leave empty |
| Age rating | 4+: every questionnaire answer "None" / "No" (no user-generated content shared with others, no web browsing inside the app, no gambling, no medical treatment information beyond the traveller's own notes) |
| Content rights | Does not contain, show or access third-party content that needs rights (OpenStreetMap data is ODbL with attribution in the app; MET Norway weather is CC BY 4.0 with attribution) |
| Encryption | `ITSAppUsesNonExemptEncryption = false` is set in the build (HTTPS only) |

## App Review notes (paste into App Review Information > Notes)

```text
Satchel is an offline travel wallet and itinerary planner for travellers. It needs no account and no login.

On first launch the app adds a sample trip so every screen has something to show; it can be deleted from the trip screen.

In-app purchases: a free 7-day trial (com.jared797.satchel.trial7, a free non-consumable the user starts, Guideline 3.1.1) and a one-time unlock (com.jared797.satchel.unlock). Both are in Settings > Satchel Full Unlock, with Restore purchases; tapping + to add a trip before the trial starts shows the same screen. After the trial without the unlock, saved trips stay viewable and received trip files still open; creating, editing and sharing ask for the unlock.

Where to look:
- Itinerary tab (middle): Today / Tomorrow, the day strip, Share itinerary (top right). With no plans, "Add your itinerary" offers: copy a format and paste your plans (optionally filled in by an AI chat app the user already uses; Satchel itself sends nothing to any AI service), open a calendar file, or add plans by hand.
- Wallet tab: tickets full screen. Emergency tab: emergency card (numbers are marked "verify locally").
- Map tab: Offline city maps lets you download Tokyo, Kyoto or Sydney from our GitHub release; they then work in flight mode.

Online services (only when online, only when the feature is used): the system map; MET Norway weather for a trip's hotel coordinates; OpenStreetMap Overpass for "toilets near me" when no downloaded city covers the spot; GitHub for the offline city map files. No analytics, ads or tracking.

Permissions are asked only when a feature needs them: location (when in use, never background), camera and photos (attach a ticket or journal photo), contacts (pick one emergency contact), Face ID (lock the document vault).
```
