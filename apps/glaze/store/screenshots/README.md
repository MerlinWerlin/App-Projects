# Glaze App Store screenshots (1.0.41, first release)

Eight portrait shots for the **6.9-inch iPhone** display (1320 x 2868, flattened RGB PNG) in `6.9/`.
Glaze is iPhone-only (`supportsTablet: false`), so no iPad set is needed, and App Store Connect scales the
6.9-inch set down for every smaller iPhone, so no 6.5-inch set is needed either. `store/listing.json` points
`APP_IPHONE_67` (Apple's API name for the 6.7/6.9-inch slot) at this folder.

| # | File | Headline | Screen |
|---|---|---|---|
| 1 | `01-home-screen.png` | Your whole Home Screen, one tap | A Home Screen in Alpine Starlight: wallpaper, icons, Artwork widgets |
| 2 | `02-five-artworks.png` | Five artworks with every theme | Widgets tab, Cobalt Caravan's Artwork 1-4 |
| 3 | `03-every-mood.png` | A look for every mood | Porcelain Tide, Desert Afterglow and Cobalt Caravan theme pages |
| 4 | `04-use-this-theme.png` | Tap a theme, then tap Yes | Cloud Atelier with "Use this theme?" |
| 5 | `05-custom-widgets.png` | Make it yours with Custom widgets | Widgets tab, Your artwork: Custom 1-5 |
| 6 | `06-themes.png` | Over 140 original themes | Themes tab, Free section (Alpine Starlight, Cloud Atelier first) |
| 7 | `07-matching-icons.png` | Matching icons for your apps | Alpine Starlight icons step |
| 8 | `08-glaze-plus.png` | Every theme with Glaze Plus | The yearly Glaze Plus sheet |

## Where they come from

- **Shots 2-8 are real captures** of the Glaze 1.0.41 simulator build on an iPhone 16 Pro Max simulator
  (native 1320 x 2868), driven by Maestro: `.github/workflows/glaze-store-capture.yml` runs
  `store/capture/store-flow.yaml` (deep links plus taps on "Yes, use it", "View widgets with this theme",
  "Add to Custom N" and the Plus sheet). Status bar: 9:41, full battery.
- **Shot 1 is drawn, not captured:** the simulator can't install the icon profile or place widgets, so
  `store/capture/home.py` lays out a Home Screen from Alpine Starlight's own files: its full-size wallpaper,
  its Artwork 1-3 pieces as Small Glaze widgets, and icons in the theme's style as the app draws them
  (Feather glyphs on the dark starfield tile, matched to the app's own preview in the icons step). App labels
  are generic words; no brand logos anywhere.
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
