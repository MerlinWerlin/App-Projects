# Product

<!-- impeccable:product-schema 1 -->

> Written 23 Nov 2026 from the owner's brief relayed by the Apps master session (owner at work, asked not to be waited on).
> Every line below is taken from that brief or from the shipped code; nothing was confirmed in a live interview.

## Platform

ios

## Users
Welders, boilermakers and metal fabricators (trade and serious hobby) in Australia first, then New Zealand, the UK,
Ireland, the USA and Canada. They use the phone in the workshop or on site: gloves on, dirty screens, bright arc light and
dim sheds, often standing at a saw or a bench with a tape in the other hand. The job: get a cut right first time
(a pipe saddle, a mitre, a cut length) and know how much steel or filler to buy.

## Product Purpose
Do the workshop maths a fabricator would otherwise do on paper or by eye, show the working so it can be trusted, and
turn geometry into a true-scale printed template that can be wrapped round the pipe. Success: fewer wasted cuts and
a template that fits first time.

## Positioning
True-scale, tiled, self-checking printable templates (every sheet carries a 100 mm ruler), sourced formulas with the
working shown, and guidance fitted to the user's country: the sections local merchants actually stock, local
standards names, units, spelling and currency.

## Operating Context
Workshop and site. Printing happens later at home or the office (AirPrint or a shared PDF). Measurements come from a
tape, a pipe's stencil or a supplier's list. Many users switch between metric and imperial.

## Capabilities and Constraints
- Tools: saddle (fishmouth) templates, lobster-back bends, frame mitres, cut list, steel weight, weld metal,
  sheet bending, bolt circles. Jobs save on the device only. No account, no server, no data collected.
- Country chosen at first launch (device region preselected), changeable in Settings. Full guidance for AU, NZ, GB,
  IE, US, CA; any other country gets metric and generic sizes.
- Monetisation: free core tools, a user-started free 7-day Trial and a one-time Full Unlock (A$4.99). No subscription.
- iPhone only, portrait. Expo SDK 58 / React Native. Dark appearance by design (owner's brief: "dark, high-contrast
  workshop look").

## Brand Commitments
- Name: Rootpass (a welding term: the first pass in a joint). Store name "Rootpass: Weld & Fab Calcs".
- Plain, trade-literate English. Australian spelling by default; US spelling for US users.
- Owner asks for bold design, big glove-friendly controls and no timid limits.

## Evidence on Hand
- Worked-example tests for every formula (`src/core/*.test.ts`), sources in code comments and on the public
  formulas page (`docs/rootpass/formulas.html`).
- No testimonials, users, reviews or press exist yet; never invent them.

## Product Principles
1. Correct before clever: every number traceable to a source and shown with its working.
2. Workshop first: readable at arm's length, usable with gloves, nothing hidden behind small targets.
3. Local by default: the user's country decides sizes, units, words and standards; unverified data falls back to generic, labelled as such.
4. Respect the trade: no hand-holding copy, no fake precision, a clear "verify before cutting" where it matters.

## Accessibility & Inclusion
Contrast ≥4.5:1 everywhere (bright-light use), Dynamic Type honoured, 56 pt minimum controls (gloves), VoiceOver labels
on every icon-only control and drawing.
