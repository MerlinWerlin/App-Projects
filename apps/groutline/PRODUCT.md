# Product

<!-- impeccable:product-schema 1 -->

Facts below come from Jared's brief of 23 Nov 2026 (relayed by the Apps master). Lines marked *(inferred)* were not
confirmed with him in an interview: he asked for the app to be finished autonomously while he was at work.

## Platform

ios

## Users
Professional wall and floor tilers, and serious renovators, on their own iPhone. They use it on site: standing in a
bathroom or kitchen with a tape measure, often with gloves on, adhesive on their hands, in poor or harsh light, and
in the van or at the supplier's counter when ordering. *(inferred: the situation; the trade and the gloves are in the brief)*

## Product Purpose
A job-site toolkit that turns measurements into what to buy and how to set the job out: tiles and cartons, set-out
without thin cuts, grout, adhesive and waterproofing, falls to the waste, trim lengths and stairs. Success: the
tiler gets the right quantity for the right local product in seconds and trusts the number because the working is shown.

## Positioning
Country-first: the app asks where you work and then speaks that country's language, units, standards and the pack
sizes the local suppliers actually stock (Australia, New Zealand, UK, Ireland, US, Canada; generic metric elsewhere).
Every answer shows how it was worked out, and every country value is sourced.

## Operating Context
- Tabs: Tools, Jobs, Settings. Six calculators: Tiles & cartons (free), Set-out, Grout / adhesive / waterproofing,
  Falls, Trim, Stairs. Jobs are saved on the phone and can be shared as text.
- Sizes are typed the way they are measured: mm (or 2.4m) in metric countries; feet-inches and fractions in imperial.

## Capabilities and Constraints
- Expo SDK 58 / React Native, iPhone only, no OTA updates. App Store Connect app 6838133146.
- 7-day free trial (`com.jared797.groutline.trial7`, user-started) and one-time Full Unlock (`com.jared797.groutline.unlock`, A$4.99).
- Retailer and brand names may appear in code docs only, never in the UI (unit test enforces it).
- Quantities are estimates from makers' published coverage; the app says to check data sheets and local rules.

## Brand Commitments
Name Groutline; the set-out icon (full tiles, cut edge tiles, orange centre lines). No personal names in public text
(seller shown as Astro Labs AU).

## Evidence on Hand
Sourced research for six countries in `docs/research/` and `docs/SOURCES.md`. No users, testimonials, ratings or
press exist yet; do not invent any.

## Product Principles
1. The number first, then the working: a tiler must be able to check the sum on site.
2. Local truth over generic advice: the country's own products, words and rules, or a clear "generic" label.
3. Built for gloves and glare: big targets, big numerals, nothing fiddly. *(inferred)*
4. Never overstate: estimates are called estimates; unverified rules are flagged.

## Accessibility & Inclusion
56 pt controls, Dynamic Type, VoiceOver labels on every control and on the set-out diagram, light and dark appearance.
