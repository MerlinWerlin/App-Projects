# App Store listing: final copy and screenshots

T266 (owner-1101i #3, 1 Nov 2026) replaces the T67 draft. Paste the fields below into App Store Connect > Apps >
Glaze > iOS App > version 1.0.1 > App Store tab (English (Australia) is the primary language; copy the same text to
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

**No pets, no Live Activities (T198, 1 Nov 2026):** never mention or show them in the listing, keywords or What's New.
Tabs are Themes · Widgets · Icons · Wallpapers.

## Listing fields

| Field | Text | Chars | Limit |
|---|---|---|---|
| Name | `Glaze: Icon Themes & Widgets` | 28 | 30 |
| Subtitle | `Aesthetic Home Screen Makeover` | 30 | 30 |
| Keywords | `wallpaper,lock,custom,shortcut,cute,pastel,kawaii,cozy,dark,color,clock,calendar,photo,matching` | 95 | 100 |
| Promotional text | `Over 90 original themes, each with matching icons, wallpapers and widgets. Pick a look and Glaze walks you through setting it up, step by step. No account, no ads.` | 163 | 170 |

- **Name:** "Glaze" first; "Icon Themes & Widgets" are the two most-searched outcome nouns. Fallback if the name is
  taken in App Store Connect: `Glaze: Themes & Widgets` (23).
- **Subtitle:** adds words the name doesn't have ("aesthetic", "home screen", "makeover"). Fallback:
  `Matching icons and wallpapers` (29).
- **Keywords:** Apple already indexes the name and subtitle, so no word from either is repeated (icon, theme, widget,
  aesthetic, home, screen, makeover, glaze). Singular forms only (Apple matches plurals). No brand or app names.
- **Promotional text** can be changed at any time without a new review.

### Description (1,588 characters; limit 4,000)

<!-- description:start -->
```text
Glaze gives your iPhone a look that fits together: a wallpaper, matching app icons and widgets in the same colours, all from one theme.

THEMES
- Over 90 original themes drawn for Glaze: starry nights, nature, ocean, cute and cosy, sweets, dreamy pastels, moody darks, art, seasons and city retro.
- Every theme comes with a wallpaper, an icon style and widget art that match.
- Themes download when you open them and stay on your iPhone, so they keep working offline.

MATCHING ICONS
- Glaze makes icons for the apps you choose, in the theme's colours and symbols.
- Install them all at once, or one at a time with Apple's Shortcuts app. Glaze walks you through every step and shows how to undo it.
- Make your own icons from hundreds of symbols and letters.

WIDGETS THAT WORK
- Clock, calendar, photo, countdown, quote and battery widgets in small, medium and large.
- Use the theme's art, or make a widget your own in the Widget Studio with your photo, colours and fonts.

WALLPAPERS
- Still wallpapers and matching Lock Screen and Home Screen pairs.
- Extra: the Live Photo maker turns a short clip of your own into a Live Photo that moves when you press it in Photos.

GUIDED SET-UP
Tap "Use this theme" and Glaze shows you what to do, one short step at a time: wallpaper, then icons, then widgets. Skip any step and come back later.

SIMPLE AND PRIVATE
- No account, no ads, no tracking.
- Your photos and videos never leave your iPhone.
- Available in 11 languages.

GLAZE PLUS
Glaze Plus is an optional one-time purchase. No subscription, ever. Restore it any time from Settings.
```
<!-- description:end -->

The "GLAZE PLUS" paragraph deliberately names no contents: what Plus adds is still the owner's decision
(`docs/RELEASE_CHECKLIST.md` §2b). Once decided, add one plain sentence such as "It adds N extra themes." If the owner
picks option B (ship 1.0.1 without Plus), delete the paragraph.

### Other fields

| Field | Value |
|---|---|
| What's New | Not shown for a first release (App Store Connect only asks from the second version). For 1.0.2: `Smoother set-up, new themes and fixes. Thanks for using Glaze!` |
| Support URL | `https://merlinwerlin.github.io/App-Projects/apps/glaze/docs/site/` (page `docs/site/index.html`; needs GitHub Pages, owner step) |
| Privacy Policy URL | `https://merlinwerlin.github.io/App-Projects/apps/glaze/docs/site/privacy.html` (copy of `docs/privacy.html`) |
| Marketing URL | leave empty |
| Copyright | `2026 Jared Bradley` (App Store Connect adds the © sign; use the seller name shown under Business if it differs) |
| Primary category | **Lifestyle** |
| Secondary category | Utilities |
| Age rating | 4+ (answers in `docs/RELEASE_CHECKLIST.md` §5) |
| Price | Free download; Glaze Plus in-app purchase (`docs/IAP_SANDBOX.md`) |

**Why Lifestyle:** people choose a Home Screen "look" the way they choose decor or fashion; that is a lifestyle
purchase, and the pitch (themes first, widgets and icons that match) is about taste, not a tool. Utilities is crowded
with practical tools (scanners, VPNs, calculators, file managers), so a theme app has more competition for the top
chart places there and its pastel screenshots look out of place. Utilities stays as the secondary category so the
widget side is still found. The category can be changed with any later version.

## Screenshots (T266 plan; rendered by T267)

Six portrait shots, one set per size. The renders go on the build page under `store-screens/` (not in the repo
bundle):

| Size | Pixels | Folder |
|---|---|---|
| 6.9" (iPhone 16/17 Pro Max) | 1320 x 2868 | `store-screens/6.9/01-home-hook.jpg` … `06-make-your-own.jpg` |
| 6.5" (iPhone 11 Pro Max class) | 1284 x 2778 | `store-screens/6.5/01-home-hook.jpg` … `06-make-your-own.jpg` |

App Store Connect scales the 6.9" set down for smaller iPhones; the 6.5" set is uploaded too because it is still
asked for on some accounts. Flattened RGB PNG, no transparency.

| # | Shows | Caption | Chars |
|---|---|---|---|
| 1 | Hook: a finished Home Screen in one theme (wallpaper, matching icons, clock + calendar + photo widgets in the theme's art) | Themes, icons and widgets that match. One price. No weekly subscription. | 72 |
| 2 | Themes tab: art-led cards from the remote catalogue with category sections | Over 90 original themes | 23 |
| 3 | Theme page > "Use this theme": the guided steps with progress dots 1-2-3 (T265) | Set it up in three easy steps | 29 |
| 4 | Icons: the install screen with "Install all icons" and the themed icon grid | Icons that match, all at once | 29 |
| 5 | Widgets tab / Widget Studio: small, medium and large widgets in the theme's art | Widgets in your theme's colours | 31 |
| 6 | Wallpapers tab: still wallpapers and a Lock + Home pair | Wallpapers and Lock Screen pairs | 32 |

Caption 1 is the owner's decision ("Themes, icons and widgets that match. One price. No weekly subscription."); "One
price" stays true under every Plus option in the checklist (one-time unlock, or no purchase at all). Shot captions are
image text, not a listing field, so there is no character limit; keep them on two lines at the shot's headline size.

### Honesty checks for the shots

- **Theme count:** "Over 90" comes from the live catalogue `glaze-packs-v1` (`catalog.json` generated
  2026-11-01T06:42Z: 95 packs, all free) plus 3 bundled starters (`themes/`) = 98 themes. Recount before upload; if
  the catalogue ever drops to 90 or fewer, change the promotional text, description and shot 2.
- **Widgets:** sample contents (9:41, 76 %, dates) are illustrative mock data. Interactive habit widgets are not
  device-tested, so no shot or line of copy shows or promises them.
- **Live Photo maker:** not in the six shots. If it is ever shown, show it in the Photos view with the caption "your
  clip as a Live Photo that moves when you press it in Photos", never framed as a moving Lock Screen.
- **Icons:** draw generic app labels (Camera, Photos, Music, Chat…), never real brand logos.
- **No price on the shots** (the price is localised by the store and is the owner's call).
- The old 8-shot T67 set in `assets/store/` (1290 x 2796, "50 original themes · 18 free") is out of date: the
  catalogue changed in T177 and all gallery themes are free. Do not upload it.

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
