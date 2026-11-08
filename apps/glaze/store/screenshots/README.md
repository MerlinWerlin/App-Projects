# App Store screenshots (T267, owner-1101i #3)

There are 6 portrait shots in two sizes:

- **6.9-inch:** 1320 x 2868
- **6.5-inch:** 1284 x 2778

Each one is a JPEG at quality 90, RGB with no alpha, about 200 to 320 KB.

## Honesty note: check these before you submit

These are **HTML compositions**. They are **not simulator or device captures**. The app could not run here: the npm registry was unreachable and there was no simulator. Each shot redraws a Glaze screen from:

- the app's real layout code (`app/(tabs)/themes.tsx`, `app/theme/[id].tsx`, `app/install.tsx`, `app/(tabs)/icons.tsx`)
- the design tokens (`src/core/designV2.ts` lightV2 / typeV2)
- the English strings (`src/i18n/ns/*/en.ts`, `src/i18n/locales/en.ts`)
- real theme assets: wallpapers and widget art from `themes/<id>/`, plus the catalogue thumbs and a Cloud Atelier wallpaper from the production pack release

Icon colours and texture come from the app's own `themedTextureSpec` (`src/core/iconLook.ts`). The icon outline comes from `shapePath` (`src/core/shapes.ts`). Glyphs are Feather plus Glaze's in-house set. App labels are generic words (Mail, Photos, Music…). There are no brand logos, and the phone frame is a plain rounded rectangle.

Small differences from the real app are likely: spacing, the exact segmented controls, the step-card look, and the scroll position. **Owner: compare each shot with the app on your iPhone before uploading. Better still, replace them with real screenshots taken on your iPhone using the same captions** (see the captions table below).

Known simplifications:

- **Themes tab subtitle left out.** The real subtitle is "Whole looks: wallpaper, icons, widgets and a loop." It was dropped so the listing makes no wallpaper-motion promise. Consider changing that string too.
- **Sample data.** The clock widget's "9:41 / Monday / 3 November", "12 icons", and the custom style in shot 6 (Circle, Solid, Ocean) are all sample data.
- **Shot 5 step list.** It shows the T262 profile steps as one numbered list, with step 1 open. Check this against the real install screen.

## Re-render

```sh
node --no-warnings store/screenshots/render.mjs                 # all shots, both sizes
node --no-warnings store/screenshots/render.mjs --only 2,4      # some shots
node --no-warnings store/screenshots/render.mjs --out /some/dir # another output folder
node --no-warnings store/screenshots/render.mjs --offline       # cached downloads only
```

The renderer needs Node 22.18+ and Playwright with Chromium (`require('playwright')`). Output goes to `/home/claude/store-screens/{6.9,6.5}/0N-<slug>.jpg` by default.

Downloads (`catalog.json`, thumbs, one wallpaper) are cached in `<out>/cache`. They come from the release in `src/config/packs.ts`, fetched with curl. **Never commit the images:** the repo has a size limit.

### Files

| File | What it holds |
|---|---|
| `shots.json` | Sizes, captions, the theme for each shot, background tints |
| `template.html` | One page that draws a shot. The stage is laid out 1320 px wide and the phone screen in 440 x 956 points. |
| `render.mjs` | Builds the data: themes, icon specs, the Themes-tab chips and rails (via `src/core/themeBrowse.ts`). It then captures every shot at the exact pixel size. If an image is over 900 KB, it steps the JPEG quality down. |

## Captions

| # | File | Caption | Screen |
|---|---|---|---|
| 1 | `01-home-hook.jpg` | Themes, icons and widgets that match. *One price. No weekly subscription.* | A Sunset Dunes Home Screen with matching icons, a clock widget and two art widgets |
| 2 | `02-themes-tab.jpg` | 98 themes to choose from | The Themes tab: All / Liked, search, category chips and the Space & Night rail |
| 3 | `03-matching-icons.jpg` | Matching icons for your apps | The Deep Sea theme page: hero, the Icons block with Icon style, the icon grid, Apply this look |
| 4 | `04-widgets.jpg` | Widgets that follow your theme | A Starry Night Home Screen with large, small (clock + art) and medium widgets |
| 5 | `05-install.jpg` | Install all icons in one go | Install icons: your icon set, "Install all at once" (one profile), the guided steps |
| 6 | `06-make-your-own.jpg` | Make your own icons, *free* | The Icons tab: live preview and Style for all icons (shape, background, colour, symbol size) |

### Where the theme count comes from

Shot 2 says **98**. That is the count the Themes tab shows on its "All themes" chip. render.mjs works it out on each run with `browseThemes(remote catalogue, bundled starters)`: 95 catalogue themes on 1 Nov 2026, plus 3 bundled starters (Deep Sea, Starry Night, Sunset Dunes).

If the catalogue changes, re-render and the caption follows. With no catalogue at all, render.mjs falls back to `fallbackThemeCount` in shots.json.

### Caption rules

The captions follow docs/STORE.md:

- No competitor names.
- No ranks, badges, ratings or download counts.
- No live-wallpaper or "moves on the Lock Screen" promise.
- No price amount. "One price" and "no weekly subscription" are true for any one-time Plus price.
- "Free" in shot 6: the Icons tab is not behind Plus. Only Plus themes are locked (`useLocked(theme.plus)`).

Note that the 1290 x 2796 set in `assets/store/` (docs/STORE.md) is the older, separate style-A set. This folder is the T267 set at the sizes the owner asked for.
