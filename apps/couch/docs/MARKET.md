# Market research: iOS universal TV remote apps (18 Oct 2026)

Task market-1018 M1. I fetched the public apps.apple.com listings for the US and AU stores and some
recent roundups with WebSearch/WebFetch, split across three parallel workers, on 18 Oct 2026.
**Competitor names appear only in this file**: never in the app, the store copy or any asset.

**Limits:**
- Each listing shows only 3–5 written reviews, so the review themes are a small sample.
- AU prices are in AUD.
- **I could not view the competitors' store screenshot images.** The listing text exposes no
  captions or counts, and the cloud browser cannot reach apps.apple.com (blocked by the sandbox's
  network; I did not work around it). The screenshot playbook below therefore rests on general
  App Store practice, not on studying their images.
- The owner asked for screenshots of their main pictures. Those were for analysis only: they would
  never be stored or published.

## Comparison table

Prices are US$ / A$. "Wk" means a weekly plan; "life" means a one-time purchase. "Ads" means the
listing carries the "Contains Advertising" label or reviews report ads.

| App (developer) | Rating US (count) · AU | Cheapest weekly · yearly · one-time | Ads | Keyboard | Touchpad | Voice | App launcher | Casting | Widgets / Watch / Themes |
|---|---|---|---|---|---|---|---|---|---|
| TV Remote - Universal Control (Evolly) | 4.4 (623K) · 4.1 | wk $4.99/A$7.99 · yr $19.99 · life $44.99/A$69.99 | yes, heavy upsell | yes | yes (large) | yes | yes (3 fixed shortcuts) | no | no / no / Halloween event |
| Universal Remote TV Control (Begamob) | 4.7 (142K) · 4.6 | wk $3.99–14.90 (7 variants) · yr $26.49 | yes, even after paying | yes | – | yes | yes | photos/video/music | no / no / no |
| Universal TV Remote (Kraftwerk 9) | 4.6 (93K) · 4.4 | wk $2.99 · yr $34.99 · life $14.99/A$22.99 | yes, 10–15 s video | paywalled | swipe pad instead of a d-pad | – | paywalled | – | – |
| Universal Remote TV Control (Desidari) | 4.3 (51K) · 4.0 | wk $4.99 · yr $29.99 · pack $14.99 | no | letter by letter | yes, laggy | old notes | – | old notes | – |
| TV Remote – Universal (Zap) | 4.6 (59K) · 4.5 | wk $4.99/A$7.99 · yr $19.99/A$29.99 | yes | – | – | – | yes | – | – |
| Universal remote tv smart (NSTX) | 4.2 (43K) · 4.0 | premium $7.99–29.99 · remove ads $16.99 | heavy (ad X near Power) | no | no | no | no | no | dark mode only |
| Universal Remote・TV Control (Ozuna) | 4.6 (11K) · 4.4 | wk $4.99–9.99 (7 variants) · yr $29.99 | no | yes | yes + motion pointer | yes | yes | photos/video | gamepad mode; seasonal skin |
| Universal Remote · Smart TV (Level Clash) | 4.7 (11K) · 4.5 | wk $6.99 · yr $19.99 · setup $4.99 | no | yes | yes | – | hot keys | built-in YouTube/browser/photos | remote styles, sleep timer |
| TVRem (Electronic Team) | **4.8 (7K) · 4.8** | **free, no IAP** | **none, no tracking** | yes (phone keyboard) | yes | via the TV's assistant + voice typing | yes, favourites | – | – (added Apple TV) |
| Universal TV Remote Control (Dylan Oliver) | 4.6 (1.2K) · 4.9 | wk $3.99 · yr $17.99 · remove ads $3.99 | yes, every ~10 taps | – | – | – | – | – | widget requested by users |
| Universal TV Remote Control (Codematics) | 3.6 (4.1K) · 2.9 | wk $6.99 · yr $89.99/A$149.99 · ad-free $99.99 | full-screen | – | – | – | installed apps | – | – |
| TV Remote Controller Universal (Mobile Alchemy) | too few ratings | wk $4.99 · yr $59.99/A$99.99 | none, collects no data | – | – | voice typing | yes | photos/video | sleep timer |
| Smart TV Remote Universal App (Real Vision) | 4.3 (33) | remove ads $9.99/A$14.99 one-time | yes, pop-ups | – | – | – | – | – | colour keys, numpad |
| *Official apps (Roku, Google TV, ThinQ, SmartThings)* | Roku 4.7 (6.3M) | free | – | yes, laggy on Roku | – | yes | yes | Roku: yes | Samsung widget, limited |
| **Couch (us)** | – | **all controls free; Plus one-time** | **none, no data** | yes | yes | hold-to-talk + typing fallback | TV-supplied icons | **no** | themes yes; widgets/Watch planned |

Brands named across listings: Samsung, LG, Sony, Roku, Fire TV, Android/Google TV, Vizio, Hisense,
TCL, Philips, Panasonic, Toshiba, Insignia, plus long tails such as Sharp, Onn, Element and
Westinghouse. "100+ brands / 500+ TVs" claims are common, but those are the same few protocols
underneath.

## Features most of them have that we lack

1. **Casting photos and videos from the phone to the TV.** 5 of 13 apps have it, usually through
   DLNA/UPnP media render, which needs no account.
2. **A free sleep timer.** 2 of the newer apps have one. It's cheap to build as a phone-side timer
   that sends Power.
3. **Long-press repeat on fast-forward/rewind and volume.** It's a complaint where missing, and
   TVRem praises long-press volume. Couch has hold-to-repeat on the d-pad and volume; transport keys
   need checking.
4. **Customisable shortcuts** (users dislike fixed ones). Couch pins favourites, but there is no
   reorder or edit on the remote screen.
5. **Home-screen widget.** Users ask for it in reviews, and only Samsung's own app has one, a limited
   one. Couch Plus plans this but hasn't built it.
6. **Apple TV support** (TVRem added it), and a **gamepad / motion pointer** mode (one app). Both are
   lower priority.

Nobody offers an Apple Watch app, Live Activity / Dynamic Island volume, Lock Screen controls,
macros, or accessibility claims. That is open ground for Couch Plus.

## What users love

- Setup that is instant and automatic: "connected in 30 seconds", no pairing codes.
- Low lag and responsive buttons. The connection stays up for hours.
- The keyboard, for searches and passwords. Forum users call it the best reason to use a phone remote.
- Launching apps directly from the phone.
- Free with no ads and no upsell. The only app with no IAP at all is also the top-rated one (4.8).
- A clean, cute, simple layout with big buttons.
- A one-time or lifetime price is seen as fair.

## What users hate (our openings)

1. **Weekly subscriptions.** Nearly every competitor sells them, at $3–15/week (A$8–20), often 5–7
   price variants at once. Users note it costs more than buying a physical remote.
2. **Trial traps:** card required up front, charges after cancelling, a "lifetime" purchase billed
   yearly, no Family Sharing.
3. **Paywalled basics:** volume, power and the keyboard. Upsell prompts on almost every tap, even
   after paying.
4. **Ads in the controls:** full-screen ads every few taps, and an ad close button near Power that
   turns the TV off.
5. **Connection failures:**
   - The remote drops when the phone sleeps or switches apps.
   - The TV's PIN or "Allow" prompt keeps coming back.
   - Re-pairing is needed after a reinstall.
   - A TV is found but doesn't respond.
6. **The TV-side "Allow" prompt is useless when the physical remote is lost.** That's the main reason
   people download a remote app.
7. **Layouts that break with Larger Text,** with buttons overlapping.
8. Repeated pushy rating prompts, typing lag, battery drain and unresponsive support.

## UI patterns worth adopting (patterns, not anyone's look)

- **A first screen that is the working remote, not a paywall.** Discovery runs in the background,
  and the TV appears as a tappable card ("Living room TV — tap to connect").
- **A "Find my TV" flow that explains the TV-side Allow prompt before it appears.** For a lost
  remote, offer a manual Wake / Wi-Fi path and say plainly which TVs need the physical remote once.
- **A touchpad / d-pad toggle on the same screen,** with the choice remembered. Swipe pad for
  people who prefer it; d-pad as the default.
- **A keyboard that opens straight to the phone's own keyboard with live typing.** Voice typing on
  the same bar.
- **App shortcuts row with long-press to reorder and remove.** Favourites first.
- **Quick-switch between TVs from the title** (a pill menu), with an "on/off" dot per TV.
- **Keep-alive messaging:**
  - Reconnect silently when the app returns to the foreground.
  - Show "Reconnecting…" in the status pill, never a modal.
- **Rating prompt only after a successful week of use,** at most once, through Apple's own prompt.
- **Large-text-safe layout:** the remote reflows rather than overlapping.

## Store screenshot playbook

**Do competitors show streaming-service logos in their store screenshots?** I couldn't check, because
the images weren't viewable. Several listings name streaming services in their description text
(e.g. Netflix, YouTube, Prime Video, Disney+). Category norms are app-tile rows inside an app-launcher
screenshot. **Couch will not do this:** screenshots use original abstract tiles, and the store copy
says real app icons come from your TV. The risks are App Review guideline 5.2 (IP) and trademark
complaints.

General rules that work in this category, applied with our own words and art:

1. **Shot 1 sells the outcome:** one remote for every TV, with the live remote filling the frame. A
   headline of 4–6 words, high contrast.
2. **Shot 2 is the price promise, which no competitor can make:**
   - "Every button free. No ads. No subscription."
   - Show it as a remote with a clean "Free" seal, not as a comparison chart.
3. **Then one feature per shot,** in the order users value them:
   - instant TV discovery
   - keyboard / voice search
   - app launcher (abstract tiles)
   - themes
   - multi-TV
   - Plus extras (widgets / Watch) once built
4. **Consistent framing:**
   - The same device frame and headline position on every shot.
   - The headline above the device.
   - One accent colour per shot, taken from that shot's theme.
5. **Readable at thumbnail size:**
   - Headline at least 7% of shot height.
   - At most 2 lines.
   - No small print.
6. **Localise the headlines** (catalogue keys already exist). RTL shots keep the d-pad physical.
7. **Never show:**
   - competitor-style weekly-plan imagery
   - TV brand logos or real TV interfaces
   - streaming logos
   - fake star ratings or review quotes

## Pricing proposal (owner decides)

- **Every TV control free forever:** power, d-pad, touchpad, keyboard, voice, volume, channels,
  app launcher, multi-TV, IR. No ads, no tracking, no trials, no account.
- **Couch Plus, one-time US$4.99 / A$7.99,** with Family Sharing on. It covers:
  - themes
  - Home/Lock Screen widgets
  - Live Activity volume
  - Apple Watch
  - macros
  - casting extras
- **Comparison over a year:**
  - Cheapest competitor yearly plan: about $18–20 (A$29.99).
  - Typical weekly plans: about $260/year at $4.99/week.
  - Cheapest competitor one-time option: a lifetime unlock of $14.99/A$22.99.
  - Plus costs less than one week of the most common weekly plan.
- **Optional tip jar** (A$2.99 / A$5.99) for people who want to give more. No subscriptions of any kind.
- **Alternative to consider:** US$2.99 / A$4.99 launch price for the first month, to drive early reviews.

## Top 10 takeaways

1. The category's revenue model is weekly subscriptions ($3–15/week). Users resent it, so a free
   remote with no ads and a cheap one-time Plus is a real opening.
2. The highest-rated app (4.8) is the one with no IAP and no ads. Users reward "free, no upsell"
   with ratings.
3. The biggest functional complaint is connections dropping when the phone sleeps or switches apps.
   Fast silent reconnect is a feature in itself.
4. The TV-side Allow/PIN prompt blocks the lost-remote case. Explaining it up front and offering a
   Wake path wins trust.
5. Keyboard and app launch are the features users value most after the basic buttons.
6. Casting photos and videos is the most common feature we lack.
7. A sleep timer and long-press repeat on every rocker and transport key are cheap wins.
8. Nobody ships widgets, Apple Watch, Live Activity or macros. Couch Plus can own that space.
9. Accessibility (Larger Text, VoiceOver) is broken or unclaimed across the category. Couch's
   Dynamic Type work is a differentiator worth saying in the store copy.
10. Store pages lean on "100+ brands" claims and streaming names. Couch should lead with the price
    promise and real screenshots of its own remote, never logos.

Sources: App Store listings (US + AU) id1539090879, id1581765635, id1439422220, id1591238748,
id1670649189, id1401880138, id6467252904, id1631564230, id6746162794, id6444097595, id1492122256,
id6738310918, id6466823406, Roku id482066631; mac.eltima.com roundups (published by TVRem's maker);
airdroid.com; splitmetrics.com; kimola.com review analysis; nextpit.com (Samsung widget);
mwm.ai (LG ThinQ); forum.network-inventory-advisor.com.
