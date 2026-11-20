# Product

<!-- impeccable:product-schema 1 -->

Inferred from the repository (README, docs/MARKET.md, docs/ART_BRIEF.md, docs/PLAN.md, the code) and the design-pass brief
of 21 Nov 2026. No interview was run in this session; facts below are taken from those files, not invented.

## Platform

ios

## Users

Friends, couples and families playing the reverse-singing trend together on one iPhone: someone sings or says a line,
hears it backwards, imitates the gibberish, and the copy is flipped to see how close it came. Often played in a room
with other people watching and laughing, sometimes filmed. Also solo players doing the daily line for a streak.

## Product Purpose

A reverse-singing game: record, play backwards, imitate, flip, score. Success is a laugh in the room and "one more go".

## Positioning

The only reverse-audio app that scores the copy, has party and guess modes for up to 8, a daily line with streaks and a
share line, and no ads or subscription (10 free goes, then one lifetime unlock).

## Operating Context

One phone passed hand to hand; loud rooms; quick rounds of 30–60 seconds. The record button is held (or tapped) with a
thumb while reading the line. Sound plays from the phone speaker. Dark and light mode both in use.

## Capabilities and Constraints

- Quick play, packs (950+ lines), freestyle, daily line, challenge-a-friend, party (copy and guess), saved takes,
  sound effects on the flip, share a 4-part clip, settings with alternate skins, a lifetime Plus unlock.
- 14 languages; every string in src/i18n. Expo / React Native, no custom native modules beyond Expo.
- Audio, scoring, purchase and store metadata are out of scope for visual work.

## Brand Commitments

- Name: Backspin.
- Mascot and icon (Jared, 26 Oct 2026): a lavender speech-bubble character on a cream ground. Splash is cream in
  light mode and dark in dark mode.
- No copyrighted lyrics, brand or celebrity names anywhere.
- Paywall has no dark patterns: close always visible, store price, no timers.

## Evidence on Hand

Real content: the line packs (src/content/lines.json) and verdict quips (quips.json). No testimonials or press.

## Product Principles

1. The round is the product: everything else gets you into one quickly.
2. Playful, not childish: party energy, grown-up craft.
3. Honest money: free game stays complete; no pressure tactics.
4. One hand, one phone, a noisy room: big targets, obvious next step.

## Accessibility & Inclusion

VoiceOver labels on every control, 44 pt targets, Dynamic Type friendly text, Reduce Motion respected (plus an in-app
"calm motion" switch), WCAG 4.5:1 text contrast in every skin.
