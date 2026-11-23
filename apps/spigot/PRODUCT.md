# Product

<!-- impeccable:product-schema 1 -->

> Written 23 Nov 2026 from Jared's brief (relayed by the Apps master session) without a live interview: Jared is at
> work and asked for the build to continue autonomously. Facts marked (inferred) come from the brief, not from Jared.

## Platform

ios

## Users

Licensed plumbers, apprentices and pipe fitters working on site: kneeling in a trench, under a house or in a roof,
often wearing gloves, in direct sun or poor light, with one free thumb. They need a number fast (cut length, fall,
travel) and to trust it. Primary market Australia, then New Zealand, the UK, Ireland, the USA and Canada; the app
asks the person's country first and follows its units, codes and stocked materials.

## Product Purpose

A job-site toolkit that does plumbing maths correctly and shows its working: offsets, rolling offsets, cut lengths
after fitting take-offs, drain fall/grade, pipe volume and flow, and stock-length cut lists, plus jobs to keep results
per site and quick reference cards. Success: a tradie gets the right number in seconds, can check how it was worked
out, and never wastes a length on a bad cut.

## Positioning

Country-aware (units, code names, minimum grades and the pipe and fittings local trade suppliers actually stock),
correctness-first with cited sources and visible working, glove-friendly and readable in sunlight, private (no
account, no data collected), and a one-time unlock instead of a subscription. (inferred from the brief)

## Operating Context

Used one-handed on an iPhone on site, between cuts. Inputs are tape readings in mm (AU/NZ/UK/IE) or feet, inches and
sixteenths (US, often CA). Results get written on the pipe or shared to a boss or apprentice as text. Offline is
normal (under houses, rural jobs).

## Capabilities and Constraints

- Expo SDK 58 / React Native, iOS only for 1.0, English only (spelling and terms follow the chosen country).
- Free: Offset, Fall, Reference, Jobs. Full Unlock (one-time A$4.99, free user-started 7-day Trial): Cut length,
  Rolling offset, Volume & flow, Cut list.
- Everything stored on the device only. No permissions requested. No over-the-air updates.
- Every formula and country-specific value cites its source in code; unverifiable values fall back to generic
  guidance, never a guess. Retailer names may appear in code docs only, never in the UI.

## Brand Commitments

Name: Spigot. Icon: chunky copper pipe offset with a water drop on hi-vis yellow (generated in ChatGPT, docs/ART.md).
Voice: plain tradie English, short and direct; the trade's own words, nothing fancier.

## Evidence on Hand

No testimonials, users or reviews yet: none may be invented. Data sources: docs/DATA_SOURCES.md and docs/COUNTRY_DATA.md.
Artwork: assets/brand, assets/art, store/art.

## Product Principles

1. The number must be right, and the person must be able to see why.
2. Readable at arm's length in sun, operable with gloves.
3. Local by default: the person's country decides units, codes and the materials on offer.
4. Never block the job: free tools work offline, no sign-up, no nagging.

## Accessibility & Inclusion

Large tap targets (56 pt+), high contrast (results 10:1+), Dynamic Type supported with caps on giant numerals,
VoiceOver labels on every control and result, Reduce Motion respected.
