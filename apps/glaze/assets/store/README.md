# Store screenshots (T67)

`01.png` … `08.png`: App Store screenshots, 1290 x 2796 (6.9-inch portrait), style A. Copy, shot list,
style choice and the honesty checks before upload are in `docs/STORE.md`.

## Files

| Path | What |
|---|---|
| `src/shot.html` | One page per shot: `shot.html?style=a\|b&shot=1..8` (430 x 932 CSS px). Styles for both looks. |
| `src/art.js` | Original art kit: glyphs, theme wallpapers, widgets, Home / Lock Screens, in-app screens (Design v2). |
| `src/shots.js` | Headlines, subcaptions, which screen and floating pieces each shot uses, both layouts. |
| `src/catalogue.js` | Generated from `src/core` by `render.mjs` (real theme count and palettes). Do not edit. |
| `render.mjs` | Renders with Playwright + Chromium at 3x, then quantises with `optimise.py`. |
| `optimise.py` | 256-colour palette PNG (keeps the repo bundle small: ~1.7 MB for 8 shots). |
| `export_rgb.py` | Flattened RGB copies for App Store Connect in `out/upload/`. |
| `style-b-preview.jpg` | Small contact sheet of the unchosen style B. |
| `out/` | Scratch renders (git-ignored). |

## Render

```sh
node assets/store/render.mjs            # chosen style (A) -> assets/store/01..08.png
node assets/store/render.mjs --style b  # style B -> assets/store/out/b-01..08.png
node assets/store/render.mjs --all      # both styles -> assets/store/out/
python3 assets/store/export_rgb.py      # RGB copies to upload
```

Needs Node 22.6+ (imports the `.ts` core files directly), the `playwright` package (a global
install is found through `npm root -g`) and Chromium (default `/opt/pw-browsers/chromium`, or set
`CHROMIUM=/path/to/chrome`). Fonts come from the system: Lora (headlines), Poppins (display
numerals) and Inter (UI), all SIL OFL. Without them Chromium falls back to other fonts, so check
the output. Nothing is fetched from the network. Pillow is optional (without it PNGs are left
unquantised, about 1.6 MB each).

Rules: all art is drawn here with SVG/CSS (some glyphs from Glaze's in-house set,
`src/render/inhouse.ts`). No logos, characters, photos or other apps' artwork or wording; no
ratings, ranks or download counts; numbers come from `src/core`.
