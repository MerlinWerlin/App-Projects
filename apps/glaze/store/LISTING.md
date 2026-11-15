# Glaze 1.0.41: App Store listing (first release)

Copy-paste text for App Store Connect > Glaze > iOS App > 1.0.41 > App Store tab (English (Australia) primary).
`store/listing.json` holds the same fields for the store workflow; `docs/STORE.md` explains the rules. Every
field is within Apple's limit (counts below). Nothing here names a competitor, shows a rank or badge, or claims
Medium/Large, live or Lock Screen widgets: Glaze 1.0.41 has small Artwork 1-5 and Custom 1-5 widgets only.

## App name (30 max)

The App Store Connect name is still the placeholder `Glaze (0968ee)` and must change before submission.

| # | Name | Chars | Why |
|---|---|---|---|
| 1 | `Glaze: Icon Themes & Widgets` | 28 | Recommended. Keeps the two most-searched nouns (icon themes, widgets); the subtitle adds Home Screen. |
| 2 | `Glaze: Home Screen Themes` | 25 | Broad and clear. If chosen, use the alternative subtitle below so Home Screen isn't repeated. |
| 3 | `Glaze: Themes, Icons & Widgets` | 30 | Every pillar in the name; leaves the subtitle free for mood words. |

## Subtitle (30 max)

`Aesthetic Home Screen Makeover` (30)

With name option 2: `Aesthetic icons, widgets & art` (30)

## Promotional text (170 max)

`Over 140 original themes, each with a wallpaper, matching icons and five artworks for your widgets. 10 premium themes are free; Glaze Plus unlocks the rest.` (156)

## Keywords (100 max)

`wallpaper,lock,custom,cute,pastel,kawaii,cozy,dark,color,photo,matching,artwork,shortcut,style,art` (98)

Commas, no spaces; no word from the name or subtitle repeated (Apple indexes those already); no brand names.

## Description (4000 max, 2714 used)

```text
Glaze gives your iPhone a look that fits together: a wallpaper, matching app icons and widget art in the same style, all from one theme.

THEMES
- Over 140 original themes drawn for Glaze: starry nights, nature, ocean, cute and cosy, sweets, dreamy pastels, moody darks, art, seasons and city retro.
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

The GLAZE PLUS paragraph carries the Guideline 3.1.2 terms (from `store/SUBSCRIPTION.md`: length, price,
auto-renewal, how to cancel) and the Terms of Use (Apple's standard EULA) and Privacy Policy links.

## What's New

`Welcome to Glaze! Pick a theme, tap Use this theme, and your widgets switch to its five artworks. Then add the wallpaper and matching icons, one short step at a time.` (166). App Store Connect may not ask for it on a first release.

## Other fields

| Field | Value |
|---|---|
| Primary category | Lifestyle (choosing a Home Screen look is taste, like decor; Utilities is crowded with tools) |
| Secondary category | Utilities |
| Support URL | `https://merlinwerlin.github.io/App-Projects/glaze/support.html` |
| Privacy Policy URL | `https://merlinwerlin.github.io/App-Projects/glaze/privacy.html` |
| Marketing URL | leave empty |
| Copyright | `2026 Jared Bradley` (App Store Connect adds the ©) |
| Age rating | 4+ |
| License Agreement | Apple's standard EULA |

**The support and privacy pages go live when this PR is merged** (GitHub Pages serves `main:/docs`):
`docs/glaze/support.html` and `docs/glaze/privacy.html`. The same pages are also published at
`/App-Projects/apps/glaze/docs/site/`, the address the 1.0.41 paywall links to, which returns 404 today.

## Facts behind the numbers

- "Over 140": 141 themes in the live catalogue on Cloudflare R2 (15 Nov 2026) + 3 bundled.
- "10 premium themes free": `FREE_THEME_IDS` in `src/core/freeThemes.ts` (1.0.41).
- "A$2.99 a year": `store/SUBSCRIPTION.md`, product `com.jared797.glaze.yearly`, no introductory offer.
- "11 languages": `CFBundleLocalizations` in `app.json`.
