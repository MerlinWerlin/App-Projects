# Glaze App Store screenshots (1.0.43, first release)

**21 Nov 2026 (1.0.43, App Review pass):** shots 1-7 are from the 1.0.43 (Dreamroom) build via `glaze-store-capture.yml`. Shot 5 is the `31-widgets-custom` frame (Custom 1-5 whole) placed into the composed caption frame with `compose.phone()`, because the Maestro scroll lands differently from run to run. Shot 8 (Glaze Plus) is still the 1.0.41 capture on purpose: the simulator's StoreKit returns the US price ($1.99), and the en-AU listing must show the real A$2.99. The sheet's content and terms are unchanged.

Eight portrait shots for the **6.9-inch iPhone** display (1320 x 2868, RGB JPEG, quality 93, no chroma subsampling) in `6.9/`.
Glaze is iPhone-only (`supportsTablet: false`), so no iPad set is needed, and App Store Connect scales the
6.9-inch set down for every smaller iPhone, so no 6.5-inch set is needed either. `store/listing.json` points
`APP_IPHONE_67` (Apple's API name for the 6.7/6.9-inch slot) at this folder.

| # | File | Headline | Screen |
|---|---|---|---|
| 1 | `01-home-screen.jpg` | Your whole Home Screen, one tap | A Home Screen in Alpine Starlight: wallpaper, themed icons, Artwork 1-5 |
| 2 | `02-five-artworks.jpg` | Five artworks with every theme | Widgets tab, Alpine Starlight's Artwork 1-4 (every piece named) |
| 3 | `03-every-mood.jpg` | A look for every mood | Home Screens in Desert Afterglow, Cloud Atelier and Cobalt Caravan |
| 4 | `04-use-this-theme.jpg` | Tap a theme, then tap Yes | Cloud Atelier with "Use this theme?" |
| 5 | `05-custom-widgets.jpg` | Make it yours with Custom widgets | Widgets tab, Your artwork: Custom 1-5 filled with art from three themes |
| 6 | `06-themes.jpg` | Over 140 original themes | Themes tab: Alpine Starlight and Cloud Atelier featured, Premium · Free cards |
| 7 | `07-matching-icons.jpg` | Matching icons for your apps | Cobalt Caravan's page: ivory icons on lapis |
| 8 | `08-glaze-plus.jpg` | Every theme with Glaze Plus | The yearly Glaze Plus sheet (A$2.99 a year) |

## Where they come from

- **Shots 2 and 4-8 are real captures** of the Glaze 1.0.41 simulator build on an iPhone 16 Pro Max simulator
  (native 1320 x 2868), driven by Maestro, and checked by eye: no Preparing states, empty slots, tip banners or
  half-loaded art. `.github/workflows/glaze-store-capture.yml` runs
  `store/capture/store-flow.yaml` (deep links plus taps on "Yes, use it", "View widgets with this theme",
  "Add to Custom N" and the Plus sheet). Status bar: 9:41, full battery.
- **Shots 1 and 3 are drawn, not captured:** the simulator can't install the icon profile or place widgets,
  so `store/capture/home.py` lays out a Home Screen from each theme's own published files: its full-size
  wallpaper, its Artwork 1-5 exactly as the app picks them (`scripts/packs/artwork-coverage.json`) as Small
  Glaze widgets, and icons in the theme's palette and texture as the app draws them (Feather glyphs; a
  starfield on night themes, grain on the rest). App labels are generic words; no brand logos anywhere.
- **Price in shot 8:** the sheet shows A$2.99, the Australian price (the app's fallback when StoreKit has no
  product). Later simulator runs get the live product from the US storefront and show $1.99; use the A$2.99
  capture, because the listing's primary locale is Australia.
- `store/capture/compose.py` puts the headline over each capture in a plain rounded phone (no Apple device
  art), using Inter / Inter Display (SIL OFL). Captions and themes per shot: `store/capture/shots.json`.

## Re-make them

Push to any `claude/glaze-store-*` branch (or run the workflow by hand) on the code you want to show. The
run's `glaze-store-captures` artifact has `raw/` (every capture) and `6.9/` (the finished shots). Locally:

```sh
python store/capture/home.py --out <raw>/00-home-alpine-starlight.png
python store/capture/compose.py --raw <raw> --out store/screenshots/6.9
```

## Caption rules

No competitor names, no ranks, badges, ratings or download counts, no live-wallpaper promise
(docs/STORE.md). "Over 140" = 141 catalogue themes on Cloudflare R2 (15 Nov 2026) + 3 bundled; recount if the
catalogue shrinks. "10 free" = `FREE_THEME_IDS` (`src/core/freeThemes.ts`). No price on the captions: the
sheet in shot 8 shows the app's own fallback price (A$2.99) because the simulator has no App Store products.
