# Product
<!-- impeccable:product-schema 1 -->

Written from the repository (store/listing.json, docs/MARKET.md, docs/DESIGN_V2.md, code comments carrying owner
decisions) for the Nov 2026 design overhaul. No interview round: the owner's brief came through the App Factory
master session. Facts marked *(inferred)* are readings of the repo, not confirmed answers.

## Platform
ios

## Users
People at home on the couch who lost the TV remote, want one remote for several smart TVs and streaming players, or
want to type and search on the TV with a phone keyboard. Includes kids and grandparents (Simple mode) and people who
use large text and VoiceOver. Used one-handed, in a dim living room, glancing between phone and TV *(inferred)*.

## Product Purpose
A universal Wi-Fi remote for Roku, Samsung Tizen, LG webOS, Google TV / Android TV, Vizio, Sony, Philips and Fire TV
(beta), plus casting photos and videos to the TV. Success: the remote answers instantly and the user forgets it is
an app.

## Positioning
The honest remote in a category of weekly subscriptions and ads: all TV setup free, a 7-day free trial, then one
purchase (Couch Plus) unlocks the remote and casting for good. No ads, no account, no tracking; commands go straight
from the phone to the TV on the home network.

## Operating Context
Same Wi-Fi as the TV. Local Network permission to find TVs; some TVs show an Allow prompt or a pairing code. Several
TVs per home, switched in one tap. Tabs: Remote, Cast, Apps, TVs. Settings, themes, Couch Plus, Add a TV, AirPlay
guide, feedback and diagnostics sit above them.

## Capabilities and Constraints
- Remote: power, source, d-pad or touchpad, voice (hold to talk), back/home/menu, volume and channel rockers,
  mute, keyboard, numbers, playback, colour keys where the TV supports them, sleep timer, Simple mode, one-handed
  layout, cinema glow setting, twelve remote themes (all free).
- Couch Plus gate (src/plus/gate.tsx) and the paywall logic are out of scope for design work.
- Expo SDK 57, React Native 0.86, no Reanimated or Gesture Handler: motion uses RN Animated with the native driver.
- Every text/background pair is contrast-tested (src/theme/design.test.ts), for light, dark and every remote theme.
- No demo mode in shipping builds (owner 7 Nov 2026).

## Brand Commitments
- Name: Couch. App icon and opening animation: a matte charcoal remote with a brushed-gold d-pad on near-black
  (#0E0E0F). The default remote theme (Charcoal & Gold) must match them (owner 24 Oct 2026).
- The remote keeps its identity and its themes; themes change colours, texture, glow, radius and press feel only.
- Competitor names, art and wording never appear in the app.
- Voice: plain, short, kind; says what will happen.

## Evidence on Hand
Store screenshots in store/jpg/ios (rendered from the prototype, not the app). No testimonials, ratings or press may
be invented.

## Product Principles
1. The remote is the product: nothing may slow or crowd a key press.
2. Free where it matters: finding, adding and managing TVs never hit the paywall.
3. Honest and private: say plainly what happens; never fake a connection or a sent key.
4. Works for everyone: large targets, Dynamic Type to the largest sizes, VoiceOver, Reduce Motion.

## Accessibility & Inclusion
WCAG AA contrast (tested), 48 pt targets, Dynamic Type up to the accessibility sizes, VoiceOver labels on every icon
key, Reduce Motion and Reduce Transparency respected.
