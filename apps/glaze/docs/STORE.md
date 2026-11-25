# App Store listing: final copy and screenshots

T266 (owner-1101i #3, 1 Nov 2026) replaces the T67 draft. Paste the fields below into App Store Connect > Apps >
Glaze > iOS App > version 1.0.44 > App Store tab (English (Australia) is the primary language; copy the same text to
English (U.S.) and English (U.K.) if those localisations are added). Character counts are checked by
`src/core/t266Release.test.ts`.

All copy and art here is Glaze's own: no competitor wording, names or artwork, no brand logos, no famous characters,
no ratings, ranks, download counts or laurel badges.

**Positioning (owner decision 24 Oct 2026):** themes, matching icons, themed widgets and wallpaper packs are the pitch.
The Live Photo maker is an extra; never promise a constantly looping Lock Screen on iPhone (parked:
`docs/future/live-wallpaper/README.md`).

**Live Photo maker on iOS (T147, fb-1025 C, 25 Oct 2026):** no wallpaper-motion promise at all. The owner's TestFlight
test saved the Live Photo fine, but it did not move as his Lock Screen wallpaper, and Apple's DTS engineer says
app-made Live Photos have undocumented requirements to work as Live Wallpapers (see `docs/REVIEW_NOTES.md`). Listing
copy may say: it saves your clip to Photos as a Live Photo that moves when you press it in Photos. It must not say it
moves on the Lock Screen, when the phone wakes, or that it is a "live wallpaper" on iPhone. Android's looping live
wallpaper is real and may be described on Google Play.

**Current listing (1.0.42):** the App Store Connect copy for the first review is in `store/LISTING.md`; the yearly
subscription's App Store Connect fields and the review notes are in `store/SUBSCRIPTION.md`. This page keeps the
listing rules, counts and screenshot plan.

**No pets, no Live Activities (T198, 1 Nov 2026):** never mention or show them in the listing, keywords or What's New.
Tabs are Themes · Widgets · Icons · Wallpapers.

## Listing fields

| Field | Text | Chars | Limit |
|---|---|---|---|
| Name | `Glaze: Icon Themes & Widgets` | 28 | 30 |
| Subtitle | `Aesthetic Home Screen Makeover` | 30 | 30 |
| Keywords | `wallpaper,lock,custom,cute,pastel,kawaii,cozy,dark,color,photo,matching,artwork,shortcut,style,art` | 98 | 100 |
| Promotional text | `Over 250 original themes, each with a wallpaper, matching icons and five artworks for your widgets. 10 premium themes are free; Glaze Plus unlocks the rest.` | 156 | 170 |

- **Name:** "Glaze" first; "Icon Themes & Widgets" are the two most-searched outcome nouns. Fallback if the name is
  taken in App Store Connect: `Glaze: Themes & Widgets` (23).
- **Subtitle:** adds words the name doesn't have ("aesthetic", "home screen", "makeover"). Fallback:
  `Matching icons and wallpapers` (29).
- **Keywords:** Apple already indexes the name and subtitle, so no word from either is repeated (icon, theme, widget,
  aesthetic, home, screen, makeover, glaze). Singular forms only (Apple matches plurals). No brand or app names.
- **Promotional text** can be changed at any time without a new review.

### Description (2,714 characters; limit 4,000)

<!-- description:start -->
```text
Glaze gives your iPhone a look that fits together: a wallpaper, matching app icons and widget art in the same style, all from one theme.

THEMES
- Over 250 original themes made for Glaze: starry nights, nature, ocean, cute and cosy, sweets, dreamy pastels, moody darks, art, seasons and city retro.
- Every theme comes with a wallpaper, an icon style and five artworks for your widgets.
- 10 premium themes are free, including Alpine Starlight and Cloud Atelier. Glaze Plus unlocks every other theme.
- Starter themes are built into the app and work offline. Other themes download once, then stay on your iPhone.

ONE TAP TO START
Tap a theme and answer "Use this theme?". Your Glaze widgets switch to its art straight away. Then Glaze lists the next steps: add the wallpaper, add the icons, add the widgets. Skip any step and come back later.

WIDGETS: FIVE ARTWORKS AND FIVE OF YOUR OWN
- Small Home Screen widgets. Put Artwork 1 to 5 on your Home Screen: each shows a different piece from the theme you use, and they change when you change theme.
- Make it yours with Custom 1 to 5: add your own pictures, or a favourite artwork from a theme.

MATCHING ICONS
- Glaze makes icons for the apps you choose, in the theme's colours and symbols. They are Home Screen shortcuts that open your apps; your original apps are not changed.
- Add them all at once with one install in Settings, or one at a time with Apple's Shortcuts app. Glaze shows every step, and how to undo it.
- Change the shape, colours and symbol of any icon.

WALLPAPERS
- Save a theme's wallpaper to Photos and set it for your Home Screen and Lock Screen.
- Extra: the Live Photo maker turns a short clip of your own into a Live Photo that moves when you press it in Photos.

SIMPLE AND PRIVATE
- No account, no ads, no tracking.
- Your photos and videos never leave your iPhone.
- Available in 11 languages.

GLAZE PLUS
Glaze Plus: a yearly subscription (A$2.99 a year in Australia, or your local equivalent) that unlocks every theme, new themes as they're added and all widget artwork. Ten premium themes are free, and there is no free trial: the free themes are yours to try. Payment is charged to your Apple Account at confirmation. The subscription renews automatically unless cancelled at least 24 hours before the end of the current year, and you can manage or cancel it in Settings > your name > Subscriptions. Without Plus you keep the 10 free themes, your own icons, Custom 1 to 5 with your own pictures and the Live Photo maker, and a theme you already applied keeps working.

Terms of Use: https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
Privacy Policy: https://merlinwerlin.github.io/App-Projects/glaze/privacy.html
```
<!-- description:end -->

**1.0.41 (15 Nov 2026):** `store/listing.json` is now the source for every field above (the store workflow pushes it);
this file mirrors it. Glaze Plus is a yearly auto-renewing subscription (about A$2.99 a year, no trial) and 10
themes are free. Guideline 3.1.2 needs the subscription's name, length and price plus a Terms of Use and Privacy
Policy link in the description, so the "GLAZE PLUS" paragraph states them. If the final price tier changes, change
"A$2.99" in listing.json, here and in the paywall shot. Apple's standard EULA is the Terms of Use.

### Other fields

| Field | Value |
|---|---|
| What's New | `Welcome to Glaze! Pick a theme, tap Use this theme, and your widgets switch to its five artworks. Then add the wallpaper and matching icons, one short step at a time.` (App Store Connect may not ask for it on a first release) |
| Support URL | `https://merlinwerlin.github.io/App-Projects/glaze/support.html` (repo `docs/glaze/support.html`; the old `apps/glaze/docs/site/` address was never served by Pages) |
| Privacy Policy URL | `https://merlinwerlin.github.io/App-Projects/glaze/privacy.html` (repo `docs/glaze/privacy.html`, copy of `apps/glaze/docs/privacy.html`) |
| Marketing URL | leave empty |
| Copyright | `2026 Jared Bradley` (App Store Connect adds the © sign; use the seller name shown under Business if it differs) |
| Primary category | **Lifestyle** |
| Secondary category | Utilities |
| Age rating | 4+ (answers in `docs/RELEASE_CHECKLIST.md` §5) |
| Price | Free download; Glaze Plus yearly auto-renewable subscription (about A$2.99 a year, no trial; `store/SUBSCRIPTION.md`) |

**Why Lifestyle:** people choose a Home Screen "look" the way they choose decor or fashion; that is a lifestyle
purchase, and the pitch (themes first, widgets and icons that match) is about taste, not a tool. Utilities is crowded
with practical tools (scanners, VPNs, calculators, file managers), so a theme app has more competition for the top
chart places there and its pastel screenshots look out of place. Utilities stays as the secondary category so the
widget side is still found. The category can be changed with any later version.

## Screenshots (1.0.44)

Eight 6.9-inch shots (1320 x 2868) in `store/screenshots/6.9/`, made by `.github/workflows/glaze-store-capture.yml`
(real simulator captures of 1.0.44, plus Home Screens drawn from the themes' own files for shots 1 and 3). How they are made, and how to re-make them:
`store/screenshots/README.md`. Glaze is iPhone-only, so there is no iPad set, and the 6.9-inch set covers every
smaller iPhone.

| # | Headline | Subline |
|---|---|---|
| 1 | Your whole Home Screen, one tap | Wallpaper, icons and widgets that match, from one theme. |
| 2 | Five artworks with every theme | Artwork 1 to 5 widgets follow the theme you use. |
| 3 | A look for every mood | Rosewater Reverie, Rainlight and Bluewing. |
| 4 | Tap a theme, then tap Yes | Glaze puts it on your widgets, then shows the next steps. |
| 5 | Make it yours with Custom widgets | Add your own pictures, or a favourite artwork. |
| 6 | Over 250 original themes | Start with 10 free, including Alpine Starlight and Cloud Atelier. |
| 7 | Matching icons for your apps | Every theme styles your icons to match. |
| 8 | Every theme with Glaze Plus | One small yearly price. Cancel anytime. |

### Honesty checks for the shots

- **Theme count:** "Over 250" = 252 themes in `catalog-v2.json` on Cloudflare R2 (1.0.44, 25 Nov 2026) + 3 bundled. Recount
  before upload; if it ever drops to 250 or fewer, change the promotional text, description and shot 6.
- **Free themes:** "10 free" = `FREE_THEME_IDS` in `src/core/freeThemes.ts` (unchanged in 1.0.44).
- **No price on the captions** (the store localises it). The Plus sheet in shot 8 was captured on 1.0.41, which showed
  the app's fallback A$2.99 (the Australian price). From 1.0.42 the sheet shows only StoreKit's localised price, so a
  re-capture needs StoreKit to return the product (a StoreKit configuration or sandbox), or the sheet shows
  "Couldn't load the price · Try again" instead.
- **Icons:** generic app labels and Glaze's own glyphs, never brand logos. The phone frame is a plain rounded rectangle.
- The older sets (`assets/store/` 1290 x 2796, and the T267 HTML compositions) are out of date: do not upload them.

## Where the facts come from

- Theme count: live release `catalog.json` (`src/config/packs.ts` points at `glaze-packs-v1`) + `themes/` (3 bundled).
- Categories in the description: the ten `category` sections in the catalogue (`docs/THEME_PACKS.md`, T253).
- Widget kinds and sizes: `src/core/widgetSets.ts`, `src/core/widgetKinds.ts`.
- Symbols: `GLYPH_SETS` "All symbols" in `src/core/glyphsets.ts` (282 symbols, free).
- Install methods: `src/config/install.ts`, `src/core/installMethods.ts`; guided set-up: T265.
- Languages: `CFBundleLocalizations` in `app.json` (11).

## No-copy review

Checked on 1 Nov 2026 against `ops/CONVENTIONS.md`: no competitor names in this file (guarded by
`src/core/t266Release.test.ts`), no ratings, ranks, download counts, laurels or "#1", no invented numbers, no
live-wallpaper promise, no pets or Live Activities.

**Calendar and weather widgets (owner-1102b T280/T281):** the description line above names them; the Next event widget reads calendars on the device only and the Weather widget sends a location rounded to about 1 km to Open-Meteo only (docs/privacy.html). Weather is CC BY 4.0 data, credited in the widget, and Open-Meteo's commercial terms are an owner check (docs/LICENSES.md).
