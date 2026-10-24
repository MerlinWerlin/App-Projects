# Linework store listing (English, release R4 / T58)

Copy for App Store Connect and Google Play Console, version 1.0. English only for now: the app ships 11 languages, and **localised listings (the other 10 languages) are a follow-up task**.

Rules this copy follows (docs/PLAN.md, ops/CONVENTIONS.md, docs/MARKET.md §6 and "Design reference 18 Oct"): no other app's name anywhere; no ranking claims, award or download badges; no superlatives or chart positions; every claim is true of the code today (checked against `app/` and `src/`); price left for the owner to decide.

Character counts in brackets are exact Unicode character counts of the text inside each block. `src/core/storeListing.test.ts` re-counts them and fails if a block goes over its limit or a stated count goes stale.

Before submitting, the owner checks:
- "Linework" is free to use as an app name in both stores and has no trademark conflict (PLAN: working title).
- The support and privacy URLs are live: host `docs/support.html` and `docs/privacy.html` (for example on GitHub Pages) and fill in the support email marked TODO on both pages.
- Linework Plus must be created in App Store Connect (non-consumable `com.jared797.linework.plus`, A$2.99) and attached to the 1.0 submission, and a TestFlight sandbox purchase must succeed before submitting.

### Name check, 19 Oct (owner note, not listing copy; T87 research half, oversight D78-2)

Public web search of the App Store and Google Play on 19 Oct 2026. This is not a trademark search or legal advice; App Store Connect only confirms a name when you reserve it.

- **App Store, exact name "Linework" is taken**: a social-networking / crypto-wallet app by LINEWORK USA INC (apps.apple.com id1661508634, 5 ratings, poor reviews). Apple needs unique names, so plain "Linework" would be refused.
- **App Store, "Linework app"**: a tattoo-studio booking/business app by Linework Inc. (id1611510851, Business category). Different category, but it sits close to art, so people searching "linework" may see it.
- **App Store, "SDTV Linework"** (Taiwan store, id1546695452): unrelated, no conflict.
- **Google Play**: no app named "Linework" for drawing or tracing turned up.
- **Our listing name "Linework: Trace & Sketch" doesn't clash with either App Store app**, and no listing with that name turned up. The trademark risk is low but not zero, because Linework Inc. exists. Keeping the bundle id com.jared797.linework is fine either way.

Fallback names if Apple refuses the name or you want a cleaner one. A web search found no app listings under these names; check each one when you reserve it:
1. **Tracewell: Draw on Paper**
2. **Lineplay: Trace & Sketch**
3. **Linework Studio: Trace** (keeps the brand; still distinct from both apps above)

---

## 1. App Store

### App name (≤30) [24]
```text
Linework: Trace & Sketch
```

### Subtitle (≤30) [28]
```text
Trace photos onto real paper
```

### Promotional text (≤170) [158]
```text
New: Workshop, exact angles, joints and layouts for trades, plus letters in 16 styles. Free for 14 days, then unlock once for A$2.99. No ads, no subscription.
```

### Keywords (≤100) [97]
Comma separated, no spaces after commas, no word that is already in the name or subtitle (Apple indexes those anyway), no other app's name.
```text
tracing,stencil,template,workshop,angle,carpentry,lettering,calligraphy,font,scrapbook,mural,kids
```

### Description (≤4000) [3436]
```text
Trace anything onto real paper. Stand your phone over a sheet of paper, pick a photo or a template, and Linework shows it on top of the live camera view so you can draw along the lines with your own pencil.

Made for scrapbooking, journaling, cards, crafts, signs and lettering, wall art and murals, woodwork and trades, kids' colouring and cake decorating.

New: the Workshop. Exact angles, joints and layouts for carpenters, welders, tilers and every trade, plus letters in 16 styles for hand lettering.

Every tracing tool is free. No ads, no trial, no weekly subscription, no account.

PHOTO TO SKETCH
• Turn any photo into clean line art right on your phone. Nothing is uploaded.
• Pick a style: Sketch for soft pencil-like lines, Line art for crisp edges, Bold lines for just the main shapes, or let Best match choose.
• Adjust detail and line thickness, keep only the subject or the whole scene, and switch to white lines for dark paper.

1,900+ TEMPLATES TO TRACE
• Letters in 16 styles, one letter per template: bubble, retro, calligraphy, script, pixel, graffiti, blackletter, stencil, western, art deco, typewriter and more.
• Original line art in 19 categories, including a Workshop of exact angles, joints and layouts: sea life, heroes, game world, movie night, fairy tales, kids, cute & chibi, flowers & botanicals, animals & pets, birds & insects, faces & figures, letters, trade & workshop, mandalas, frames & patterns, buildings & landscapes, fantasy, still life and simple shapes.
• Filter by level from beginner to advanced, search, and tap the heart to keep favourites.

STEADY WHILE YOU DRAW
• Lock the picture in place so a stray touch can't move it.
• Touch lock lets your hand rest on the screen; press and hold to leave it.
• Keep focus while locked, so the camera doesn't blur when your hand moves in.
• The screen stays awake while you trace.

ALL THE TRACING TOOLS
• Opacity slider: fade the picture until you can see both it and your pencil.
• Pinch to size, two fingers to rotate, drag to move, one tap to reset.
• Flashlight, a 3×3 or 4×4 grid, and mirror to flip the picture.
• Sketch steps: reveal the picture from big shapes to fine lines, one step at a time.
• Lightbox: show the picture full-bright on a white screen and trace over your phone or tablet with thin paper, no camera needed.

KEEP WHAT YOU MAKE
• Record a timelapse of your drawing (up to 10 minutes, no watermark) and save it to Photos when you choose.
• Check your work: snap your paper and compare it with the picture side by side.
• Save finished drawings to My drawings, a free gallery on your phone.
• See your drawings, minutes drawn and streak, kept only on your device.

EASY TO START
• A four-step setup guide shows you how to stand your phone on a stand, a glass or a pile of books.
• Every control has a clear label, not just an icon.
• In 11 languages: English, Spanish, French, German, Italian, Portuguese (Brazil), Japanese, Korean, Simplified Chinese, Hindi and Arabic, with a right-to-left layout for Arabic.

PRIVATE BY DESIGN
Data Not Collected. No analytics, no ads, no tracking and no accounts. Your photos, outlines and drawings stay on your device.

FREE TRIAL, THEN ONE SMALL PRICE
Everything is free for 14 days. After that, tracing your own photos with every tracing tool and 24 starter templates stay free. Linework Plus unlocks the full template library and photo-to-outline once, for A$2.99. No subscription.
```

### What's New in version 1.0 (≤500) [167]
```text
Welcome to Linework 1.0! Trace photos and 1,900+ templates onto paper, turn any photo into a sketch, lock it steady and record a timelapse. Every tracing tool is free.
```

### URLs
- Support URL: where `docs/support.html` is hosted (owner).
- Privacy Policy URL: where `docs/privacy.html` is hosted (owner).
- Marketing URL: optional, leave empty.

### Category
- Primary: **Graphics & Design** (where the tracing apps people compare us with are ranked).
- Secondary: **Education** (learn to draw, sketch steps). Alternative: Entertainment.

### Age rating
Answer "None" / "No" to every content question: no violence, no mature themes, no gambling, no user-generated content shared with others, no chat, no unrestricted web access, no ads. Expected rating: **4+**. Declare **In-App Purchases: Yes** once Linework Plus or the tip jar is live (no loot boxes, no subscriptions).

### App Privacy ("nutrition label")
- "Do you or your third-party partners collect data from this app?" → **No, we do not collect data from this app.** Result: **Data Not Collected**.
- Why that is true: no analytics, ads, crash reporting, accounts or tracking SDKs (`src/core/scaffold.test.ts` guards the dependency list); camera frames, photos, outlines and drawings never leave the device; settings, recent pictures, favourites, My drawings, stats and the Plus flag live in on-device storage only; purchases are processed by Apple, which does not count as collection by the app.
- Owner check before submitting: store builds run the EAS Update check on launch (`app.json` `updates`), which sends the app version, platform, update channel and a random install ID created by the update library to Expo's update service. It carries nothing about the person and is only used to deliver updates; the privacy page discloses it. If the owner wants to be strict, he can confirm Expo's current guidance on App Privacy for EAS Update before answering.
- Tracking (App Tracking Transparency): **No**, the app does not track.
- Privacy manifest: no tracking domains.

### Pricing and availability
- Price: **Free** download with a 14-day free trial of everything (owner decision 22 Oct 2026, docs/OWNER_1022D.md).
- In-app purchase "Linework Plus" (non-consumable, one-time), product id `com.jared797.linework.plus`, **A$2.99** (owner decision 22 Oct 2026): the full template library and outline mode after the trial. The app shows the store's localised price.
- Optional tips (consumable): **amounts: owner decides** (MARKET §7 proposes US$1.99 / 4.99 / 9.99).
- Wording everywhere: "Free for 14 days. Tracing your own photos stays free; Linework Plus (A$2.99 once) unlocks the full library and outline mode."

---

## 2. Google Play

### App name (≤30) [24]
```text
Linework: Trace & Sketch
```

### Short description (≤80) [78]
```text
Trace photos & templates onto paper with your camera. Every tracing tool free.
```

### Full description
Same text as the App Store description above (within Play's 4000 limit too). Play has no promotional text or keyword field, so the full description carries the search words; it already uses tracing, sketch, outline, template, lightbox and camera naturally. Do not add a keyword list to it (Play policy forbids keyword stuffing).

### Release notes for 1.0
Same as App Store "What's New" (within Play's 500 limit).

### Category and tags
- App category: **Art & Design**.
- Tags (choose in Play Console): Drawing, Art & design tools, Education.

### Content rating (IARC questionnaire)
No violence, no sexual content, no profanity, no gambling, no user interaction or sharing, no location sharing, no ads. Expected: **Everyone / PEGI 3 / USK 0**. Contains in-app purchases: yes, once Plus is live.

### Data safety
- "Does your app collect or share any of the required user data types?" → **No**.
- "Is all of the user data collected by your app encrypted in transit?" → not applicable (no data collected).
- Ads: **No ads**. Target audience: general (not primarily children); the app is suitable for all ages.
- Same EAS Update note as the App Store section.

---

## 3. Screenshots (6.9" iPhone 1320×2868 portrait; 8 shots)

Follows MARKET §6 and "Design reference 18 Oct" §1: one feature per shot, a 3–5 word bold headline in the top third (about 72 px or more at 1320 px wide, contrast at least 4.5:1) with an optional one-line subline, the first three shots carry the listing. All art is original: our own templates, our own photos and drawings. No device-store chrome, no badges, no ratings, no other app's look.

Two styles to A/B test (Apple product page optimisation or Play store listing experiments):
- **Style (a), serif pastel:** big Fraunces headline on a soft pastel gradient (paper cream → ink-soft blue, or peach → lilac per shot), phone tilted 6–10°, elements "bursting" out of the frame: floating cut-out cards, small sparkles, a hand-drawn curved arrow from the phone to the result.
- **Style (b), bold sans, one colour:** bold rounded sans headline (SF Pro Rounded Heavy or similar) in white on one strong brand colour across the whole set (Linework ink blue `#2346A8`), phone upright, flat and calm, one enlarged pop-up per shot where useful.

| # | Headline | Subline | What it shows |
|---|---|---|---|
| 1 | **Trace anything onto paper** | Your phone over the page, your pencil on the lines | Trace screen: camera view of paper with the overlay, half traced |
| 2 | **Made for…** | Every tool free, no ads | Uses list over the trace screen: scrapbooking, journaling, cards, crafts, signs & lettering, wall art & murals, tattoo practice, woodwork & trades, kids' colouring, cake decorating |
| 3 | **Exact angles for the workshop** | Angles, joints and layouts to trace | Blueprint Workshop tab (early so tradespeople see it) |
| 4 | **Any photo to a sketch** | Three line styles, made on your phone | Prepare screen on Outline |
| 5 | **1,900+ templates to trace** | Letters, heroes, fairy tales, kids and more | Templates grid with category bubbles |
| 6 | **Letters in 16 styles** | Bubble, retro, calligraphy, pixel and more | Letters bubble with style tiles |
| 7 | **Lock it. Draw steady.** | Lock, touch lock and focus that stays put | Image locked + touch lock banner |
| 8 | **Pay once. Keep it all.** | One unlock for every template. No subscription. | Linework Plus one-time unlock (no price figure) |

v2 (owner 24 Oct 2026): one pastel style only; no hands, fingers or body parts anywhere (family-friendly); an upright iPhone-style phone (Dynamic Island) as large as the frame allows with the caption above. Rendered at 1320×2868 (6.9") and 1284×2778 (6.5").

### Art direction per shot

1. **Trace anything onto paper**
   - (a) Cream-to-peach gradient. Tilted phone resting on a glass, a hand with a pencil under it; the half-traced flower on paper continues *outside* the phone frame as a cut-out card, with two small sparkles. Curved hand-drawn arrow from screen to paper.
   - (b) Full-bleed ink-blue background, upright phone showing the camera view of the paper with the overlay; a real hand and pencil enter from the bottom edge. Concentric ripple rings where the pencil tip touches the paper.
2. **Every tool free**
   - (a) Lilac gradient. Phone shows the trace screen; the labelled control pills (Lock, Torch, Grid, Mirror, Steps, Lightbox, Record) float out of the phone as a fan of cut-out chips, each with its label. No price, no crossed-out prices.
   - (b) Ink blue. Phone upright on the trace screen; the subline set in three short lines beneath the headline; the control row enlarged beside the phone.
3. **Any photo to a sketch**
   - (a) Peach-to-cream gradient. Two tilted cards overlapping: an original photo (our own pet photo) labelled "Before" and its Line art outline labelled "After", the After card breaking out of the phone frame; a curved arrow between them.
   - (b) Ink blue. Phone on the prepare screen with the Original / Outline switch on Outline; a small strip of the three styles (Sketch, Line art, Bold lines) as enlarged chips beside it.
4. **1,900+ templates to trace**
   - (a) Mint gradient. Phone on the Templates screen; three template cards (a chibi character, a rose, a lettering piece from our own set) float out of the grid at different angles, with sparkles.
   - (b) Ink blue. Upright phone with category bubbles across the top and the large preview grid; one category bubble ("Heroes") enlarged beside the phone.
5. **Lock it. Draw steady.**
   - (a) Sky gradient. Tilted phone on the trace screen with the "Image locked" badge; the Lock button blown up beside the phone with ripple rings from a finger tap.
   - (b) Ink blue. Upright phone, a hand resting flat on the screen with the touch lock banner visible ("press and hold to exit"); the lock icon enlarged.
6. **Draw it step by step**
   - (a) Butter-yellow gradient. Four small cards fanning out from the phone, one per step (big shapes → main shapes → details → fine lines), joined by a curved dotted arrow.
   - (b) Ink blue. Upright phone with the steps bar ("Step 2 of 4 — main shapes"); the step bar enlarged above the phone.
7. **Fade it just right**
   - (a) Rose gradient. Phone on the trace screen at about half opacity; the vertical opacity slider blown up beside it with its % bubble ("65%"), a finger on the thumb with ripple rings.
   - (b) Ink blue. Same layout flat and upright: the enlarged slider and % bubble are the hero, the phone smaller behind it.
8. **Speaks 11 languages**
   - (a) Pastel rainbow gradient. Phone showing Home in one language; speech-bubble chips with "Trace" in several scripts float around it (English, 日本語, Español, العربية, हिन्दी, 한국어).
   - (b) Ink blue. Three phones side by side (English, 日本語, العربية with its right-to-left layout), headline above.

Localised screenshot captions follow with the localised listings (11 languages later).
