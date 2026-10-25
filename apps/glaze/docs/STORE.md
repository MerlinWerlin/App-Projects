# App Store listing: copy and screenshots

T67 (M5, oversight D75-2). Source and renderer: `assets/store/` (see its README). All copy and art here is Glaze's own: no competitor wording, names or artwork, no brand logos, no famous characters, no ratings, ranks, download counts or laurel badges. The theme counts on the shots come from the code; widget contents are sample data.

**Positioning (owner decision 24 Oct 2026):** themes, matching icons, themed widgets and wallpaper packs are the pitch. The Live Photo maker is an extra; never promise a constantly looping Lock Screen on iPhone (parked: `docs/future/live-wallpaper/README.md`).

**Live Photo maker on iOS (T147, fb-1025 C, 25 Oct 2026):** no wallpaper-motion promise at all. The owner's TestFlight test saved the Live Photo fine, but it did not move as his Lock Screen wallpaper, and Apple's DTS engineer says app-made Live Photos have undocumented requirements to work as Live Wallpapers (see `docs/REVIEW_NOTES.md`). Listing copy may say: it saves your clip to Photos as a Live Photo that moves when you press it in Photos. It must not say it moves on the Lock Screen, when you wake your iPhone, or that it is a "live wallpaper" on iPhone. Android's looping live wallpaper is real and may be described on Google Play.

## Title and subtitle (draft, owner decides)

App Store limits: title 30 characters, subtitle 30.

| Field | Draft | Chars | Alternatives |
|---|---|---|---|
| Title | Glaze: Icon Themes & Widgets | 28 | Glaze: Themes & Widgets (23) |
| Subtitle | Widgets, icons and wallpapers | 29 | Cute themes. One price. (23) · Matching widgets and icons (26) |

The subtitle follows the playbook (lead with outcome nouns). The title keeps "Glaze" first; check the name is free in the store and trademark search before submission.

## Screenshots (6.9-inch, 1290 x 2796 portrait, 8 shots)

Files: `assets/store/01.png` … `08.png` (style A, chosen). Headlines and subcaptions are set in `assets/store/src/shots.js`; keep the two in sync.

| # | Shows | Headline | Subcaption |
|---|---|---|---|
| 1 | Hook: Cherry Blossom Home Screen with matching clock, calendar and photo widgets; floating quote widget and icons | Themes, icons and widgets that match. *One price. No weekly subscription.* | Glaze Plus is a one-time purchase. Start free. |
| 2 | Themes tab: category bubbles, "50 themes · 18 free" chip, theme cards with Free / Plus badges | 50 original themes | 18 free to start. Cute, cosy, neon, seasonal and more, all drawn by us. |
| 3 | Celestial Night Home Screen with clock, calendar, battery and quote widgets in the theme's colours | Every theme has matching widgets | Clock, calendar, photo, quote and battery, in small, medium and large. |
| 4 | Widget Studio: live preview, background chips, colour swatches, font chips drawn in their own font, size slider, Add widget | Make every widget yours | Choose a photo, colours, fonts and size, then add it to your Home Screen. |
| 5 | Cloud Nine Home Screen with water, sleep and mood habit widgets and their buttons | Tap to log water, sleep and mood | Interactive habit widgets that work right on your Home Screen. |
| 6 | Wallpapers tab (Still / Live / Pairs) with LIVE badges; floating Lock + Home pair | Wallpapers for every look | Still wallpapers and Live Photos, plus matching Lock and Home Screen pairs. |
| 7 | Live Photo maker (an extra): a Lock Screen over an illustrated beach clip, Live pill, floating trim strip and play button | Turn a clip into a Live Photo | Your own clip as a Live Photo that moves when you press it in Photos. Free in Glaze. |
| 8 | Seasonal collections: Halloween (Now), Diwali (Soon), Christmas, with real collection themes | A fresh look for every season | Halloween, Diwali, Christmas, Lunar New Year and more, ready when the day comes. |

Shots 2 to 8 also carry a small "No ads · No weekly subscription" chip, which repeats the price promise from shot 1 (the playbook's "one price" shot is folded into the hook and these chips, so the set stays at 8).

### Where the facts come from

- **50 themes, 18 free (32 Plus):** counted by `render.mjs` from `ALL_THEMES` in `src/core/plusThemes.ts` and written into `assets/store/src/catalogue.js`. If the catalogue changes, re-render and the shots follow; update the table above by hand. 8 of the 32 Plus themes arrive as a downloadable pack (Aurora pack), still part of the catalogue the app ships.
- **Widget kinds and sizes:** `src/core/widgetSets.ts` (clock, date, photo, quote/countdown, battery × small/medium/large) and `src/core/widgetKinds.ts` (habit trackers, progress dots).
- **Seasonal collections:** `SEASONAL_COLLECTIONS` in `src/core/seasons.ts`; the themes shown in each row are the real collection members.
- **Price:** no amount is printed anywhere, because the final price is the owner's call (MARKET.md "Pricing proposal"). "One price" and "no weekly subscription" are true for any one-time Plus price.
- Sample widget content (9:41, 76%, "12 days to go", "5 / 8 glasses") is illustrative mock data, not a claim. (Since T73 water is tracked in ml; see the shot 5 note below.)

### Before uploading (honesty checks)

- **Shot 5 (interactive widgets):** T73 is now code-complete (App Intents buttons in the WidgetKit target, docs/WIDGETS.md "Interactive habit widgets"), but it has **not** been compiled or tested on a device. Shot 5 can be used once a device test of the submitted build confirms the widget buttons log taps on iOS 17+ (WIDGETS.md "Testing on a dev build", step 7); until then use shots 1–4 and 6–8 (7 shots). Shot 5 was re-rendered in run 54 so its water widget matches the real one (1,500 / 2,000 ml, a "+ 150 ml" button; sleep "+ 1 hr").
- **Shots 6 and 7 need a re-render (T147):** the captions in `assets/store/src/shots.js` and the table above were changed on 25 Oct 2026 to drop the wallpaper-motion promise, but `06.png` and `07.png` still carry the old captions ("Wallpapers that move", "…moves when you wake your iPhone"). Run `node assets/store/render.mjs` before uploading; do not upload the old files.
- **Shot 7 (Live Photo maker)** is a hand-drawn marketing mock-up. Its art frames the clip on a Lock Screen; since the Live Photo often stays still as an iPhone wallpaper, prefer redrawing it as the Photos view (or drop the shot) before submission. It does not claim, and nothing in the listing should claim, that it was tested on a device.
- **Shot 6** shows the Wallpapers tab's Live sub-tab (T71); on iOS those are Live Photo clips, not moving wallpapers. Keep the listing description to that.
- App Store Connect asks for flattened RGB images. The committed PNGs are 256-colour palette files to keep the repo small; convert on export with `python3 assets/store/export_rgb.py` (writes RGB copies to `assets/store/out/upload/`).

## Style choice (L7)

Two original styles were built from the same art kit and rendered at full size:

- **Style A (chosen):** serif headline on top, soft pastel gradient, phone tilted 6°, floating cut-out widgets and icons, sparkles and bubbles.
- **Style B (source only):** full-bleed screen with a bold rounded caption on tilted highlight boxes at the bottom. Preview: `assets/store/style-b-preview.jpg`; render it with `node assets/store/render.mjs --style b`.

**Why A:** it matches the "bubbly, cute, iOS" look the owner asked for (DESIGN_V2) and the pastel brand, and it reads as one family across 8 shots. The headline sits on a clean background, so it stays readable at search-result thumbnail size, where B's caption has to compete with a busy screen behind it. B's dark scrim also muddies the pastel themes (shot 1 turns grey-purple at the bottom), and its caption covers the most useful part of in-app screens (the Widget Studio button, the tab bar). B's strength is that the product is shown at full size; A gets most of that back by scaling the phone to 74% and letting it bleed off the bottom edge. Keep B as a fallback for an A/B test with App Store product page optimisation.

## No-copy review (T67 acceptance)

Checked on 18 Oct 2026 against ops/CONVENTIONS.md and MARKET.md:

- Art: every glyph, wallpaper, widget and screen is drawn in `assets/store/src/art.js` with SVG/CSS (a few glyphs reuse Glaze's in-house set from `src/render/inhouse.ts`). The phone frame is a generic rounded rectangle. No photos, logos, characters, or third-party artwork; fonts are Lora, Poppins and Inter (OFL), used only to render.
- Copy: headlines are our own; none reuses wording recorded for other apps in MARKET.md. App labels on icons are generic words (Camera, Photos, Music, Chat…).
- No competitor names in `assets/store/` or this file (grep-checked); no ratings, ranks, download counts, laurels or "#1".
- Theme count is the real catalogue count; no invented numbers.
