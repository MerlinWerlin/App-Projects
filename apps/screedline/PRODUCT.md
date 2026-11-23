# Product

<!-- impeccable:product-schema 1 -->

> Written 23 Nov 2026 from Jared's brief relayed by the Apps master session (he was at work and asked for autonomous
> builds). Facts marked *(inferred)* were not confirmed by him directly.

## Platform

ios

## Users
Concreters, concrete finishers, landscapers and their crews, plus serious DIY builders, standing on a job site:
outdoors, often in bright sun, wearing gloves, phone in one hand, working out how much to order or how to set out
a job before a supplier call or a pour. First market Australia; also New Zealand, the UK, Ireland, the USA and Canada.

## Product Purpose
Work out concrete, steel, formwork and landscape quantities correctly, in the user's own country's units, products
and terms, and show the working so the number can be trusted and checked. Success: the user orders the right amount
first time and can explain the number to a supplier, client or boss.

## Positioning
Every answer shows its arithmetic and its sources, and the defaults are the products actually stocked in the user's
country (bag sizes, mesh sheets, bar designations, pavers, blocks, bulk materials), chosen at first launch. *(inferred
from Jared's request: "guided to that country", "materials that are actually available")*

## Operating Context
- Job sites and trucks: glare, dust, gloves, interruptions. Quick one-handed entry, big numbers.
- Ordering ready-mix by phone, buying bagged premix, mesh and bar from merchants and hardware chains, bulk material
  from landscape yards by the tonne or cubic metre/yard.
- Jobs per site/client; a text job sheet shared with suppliers or clients.

## Capabilities and Constraints
- Calculators: slab (edge beam), footings, piers, steps, odd shapes, truck order, premix bags, site mix, mesh and
  chairs, bars and laps, trench mesh, formwork and pegs, falls with peg heights, pavers, bulk materials, tonnes ↔
  volume, retaining walls, pour weather, pour and curing checklist.
- Country chosen at first launch (device region preselected), changeable in Settings, stored on the device only.
- Every formula and country value cites a source in code; unverifiable country values fall back to generic guidance.
- Offline, no account, no server, no analytics (App Privacy: Data Not Collected). Expo/React Native, iPhone only.
- Money: free core, one-time Full Unlock, user-started free 7-day Trial item. No subscription.

## Brand Commitments
- Name: Screedline. Icon and art: ChatGPT-generated, charcoal + concrete grey + hi-vis amber (assets/meta.json).
- Retailer names may appear in code docs only, never in the UI. No logos, no affiliation claims.
- Plain words. "Confirm with your supplier, and your engineer for anything structural" wherever it matters.

## Evidence on Hand
- 30 worked-example core tests and registry tests (src/**/*.test.ts). Source list in src/core/sources.ts.
- No testimonials, users, reviews or press. Never invent any.

## Product Principles
1. Correct first: a wrong quantity costs real money; show the working and the source.
2. The site, not the desk: glove-sized targets, sunlight-readable, one-handed.
3. Local by default: the user's country, units, products and terms, without them having to set anything up.
4. Honest limits: say when a value is a rule of thumb or when the engineer's drawings govern.

## Accessibility & Inclusion
Dynamic Type, VoiceOver labels, 56 pt targets, a maximum-contrast Sun theme for glare. *(inferred)*
