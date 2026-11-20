# Product

<!-- impeccable:product-schema 1 -->

## Platform

ios

## Users
Independent travellers on their own iPhone (store locale en-AU). They use Satchel equally in two situations (confirmed by Jared, 21 Nov 2026): planning at home (building the itinerary, packing, documents) and on the trip itself (at the gate, on a train, at a taxi rank, often in flight mode, in a hurry, sometimes one-handed and in bright sun or a dark plane cabin).

## Product Purpose
An offline travel wallet and itinerary. Everything for a trip (plans, tickets, documents, emergency card, maps, phrases) is saved on the phone and works with no signal. Success: the traveller finds the next thing they need in seconds without a connection, and plans the trip in one calm place.

## Positioning
"Leave your phone in flight mode. Satchel still works." Serverless and private: no account, no ads, no tracking, nothing leaves the phone except files the user shares. Its own offline city maps (OpenStreetMap) with GPS in flight mode.

## Operating Context
Five tabs: Trips, Map, Itinerary (centre), Wallet, Emergency; Toilets is reached from Map. Trips have days and items (flight, train, ferry, bus, stay, car hire, activity, note), each in its own time zone. Tickets show full screen at full brightness. A low-battery Essentials mode is a plain black screen with no animation. Trips travel between phones as `.satchel` files.

## Capabilities and Constraints
- Expo / React Native app (`apps/satchel`), iPhone only. No OTA updates (expo-updates is banned for App Review).
- StoreKit 2 module `modules/satchel-store`: 7-day free trial (`com.jared797.satchel.trial7`), one-time A$2.99 unlock (`com.jared797.satchel.unlock`), read-only after the trial ends. Received trip files always open.
- Privacy manifest and `.satchel` file open/share must keep working.
- Emergency numbers carry "Verify locally" and their source; map credits OpenStreetMap, weather credits MET Norway.
- Light and dark appearance; Reduce Motion respected everywhere.

## Brand Commitments
Binding (Jared): the hand-painted 1930s rubber-hose satchel mascot and its poses; the 25 destination country themes with seasonal particles (Reduce Motion respected); the three original reminder sounds. Everything else in the look (fonts, colours, cards, layout, app icon) may be replaced (Jared, 21 Nov 2026). Never use a competitor's name.

## Evidence on Hand
Real content: the sample trip (Sydney to Tokyo and Kyoto), bundled country data (emergency numbers, plugs, customs, phrases in 12 languages, holidays). Store screenshots use an invented Tokyo & Kyoto trip (`store/capture/seed.py`). No testimonials, ratings or press exist; do not invent any.

## Product Principles
1. The day itself comes first: the next plan, ticket and address are always one glance away.
2. Works offline, says so plainly, and never pretends to know what it can't check ("Verify locally").
3. Private by default; nothing to sign in to.
4. Calm and friendly, with the mascot's warmth, never cute at the cost of speed.

## Accessibility & Inclusion
WCAG AA contrast in both appearances (src/theme/contrast.test.ts), 44 pt+ touch targets, VoiceOver labels on every control, Reduce Motion respected, Essentials mode with no animation.
