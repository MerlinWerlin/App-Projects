# Widget snapshots (T203, owner-1101d #6)

> **T251 (owner-1101h #2):** the JPG sheets below predate T251 and still show the old blurred
> backgrounds (now removed). The blend audit is the current check:
> `python3 scripts/packs/blend-audit.py [--download] [--fix DIR]` writes raw-vs-blended contact
> sheets outside the repo; findings in [BLEND_AUDIT_1101H.md](BLEND_AUDIT_1101H.md).

Contact sheets of every widget art option of every theme, at small / medium / large, drawn with the
same placement maths as the phone, so a placement problem shows up here before anyone tests on a
phone. One JPG per theme, plus `index.json` (every option, every size, the numbers and the flags).

## Run it

```sh
node --no-warnings scripts/widget-snapshots.mjs              # all themes; downloads remote packs
node --no-warnings scripts/widget-snapshots.mjs --offline    # bundled + already-downloaded packs only
node --no-warnings scripts/widget-snapshots.mjs --only firefly-grove,deep-sea   # some themes (index.json kept)
node --no-warnings scripts/widget-snapshots.mjs --staging    # the staging release instead of production
```

Needs Node 22.18+ (it imports `src/core/*.ts` directly), Playwright with Chromium
(`require('playwright')`), and `curl` (or Node's fetch) for downloads. Remote packs come from the
release in `src/config/packs.ts` (`glaze-packs-v1` on `MerlinWerlin/App-Projects`): `catalog.json`
is fetched fresh each run; manifests and images are cached in `.cache/widget-snapshots/` (gitignored)
and every image is checked against its manifest SHA-256. Nothing downloaded is committed.

Then look at the sheets (they are small enough to open in any viewer) and read the summary line.
The script exits 0 even when it finds flags: they are for review, not a gate.

## What is drawn

Themes: the bundled art packs (`themes/<id>/`, `src/core/artPackThemes.ts`: their three hero
pieces as v1 options, like `src/ui/ThemeWidgetArt.tsx`) and every pack in the remote catalogue (the
pack v2 `widgets` list via `parseRemoteArtManifest`, or options derived from v1). Bundled themes
without widget art (the catalogue themes and the `packs/space-webb` photo themes) have no art
options; they are listed in `index.json` (`noArtThemes`, `noArtPackThemes`).

For each option and size, `src/core/widgetSnapshot.ts` (`snapshotPlan`, tested) follows the app:

| Option background | App call (ThemeWidgetArt `onUse`) | What the plan uses |
| --- | --- | --- |
| `wallpaper` | `setSeamless` | `seamlessCrop` of the wallpaper under the size's default slot (6.7-inch 2796 table row), hero fitted with `heroRect` (6 % inset) |
| `theme`, `blur` | `setWidgetArt` | `widgetSizePx`, fit decided by `placeArt` on the option's declared size, art fitted with `placeArt` on the real image size (or stretched edge to edge for `fill`) |

The page then draws what `GlazeWidgetBridgeModule.swift` composes (theme colour, blurred art under a
25 % veil, or the wallpaper crop; then the art) and what `targets/widget/SeamlessWidget.swift` shows
(the file `scaledToFit` over a blurred `scaledToFill` copy, in a 22 pt rounded mask). Sizes are in
points: small 170×170, medium 364×170, large 364×382; sheets are drawn at 1× and scaled down
(0.8 / 0.65 / 0.5) and JPG-compressed until each is under 98 KB (`ops/bundle-check.sh` flags images
over 100 KB). The header of each sheet says which scale it used.

Every option is drawn in all three sizes; a size the option does not list is dimmed and marked
"not offered".

The label column shows the menu name the app uses (`optionName`: the pack label, a derived v1 piece's
shape name such as "Small piece", else "Art n" by pack place; the same in every size) and, for a
practical kind whose picture has fixed numbers, `kind → art (fixed numbers)` (T206, `fixedValues`:
the app shelves it with the art, without the "Live" badge). `index.json` has `shelfKind` and
`fixedValues` per option.

## Automatic checks (`index.json` → `flags`)

| Flag | Severity | Meaning |
| --- | --- | --- |
| `crop` | error | the art rectangle reaches outside the widget frame (dashed box on the sheet) |
| `stretch` | error | `fill` drew the art at a different aspect |
| `noWallpaper` | error | background `wallpaper` on a theme with no wallpaper: Use fails |
| `empty` / `white` | error | the composed widget is one flat colour / (nearly) all white |
| `fill` | warn | scale-to-fill: art drawn edge to edge instead of fitted |
| `metaAspect` | warn | the declared size (manifest or `HERO_REFERENCE_SIZES`) has another aspect than the real image, so the app's `placeArt` and the bridge disagree |
| `cornerClip` | warn | a corner of the art rectangle falls outside the rounded mask |
| `edgeCut` | warn | transparent art whose picture runs off its own image edge (subject cut in the source file) |
| `textOverflow` | warn | the option's name (plus the "Live" badge) is wider than its card in the Widgets tab menu (`WidgetArtMenu`, subhead 15 pt semibold; one line with the badge beside it, or in small cards up to two lines with the badge underneath, `menuCaptionLayout`): the app truncates it. Names are numbered once per piece (`stableArtNumbers`), the same in every size. Measured with a stand-in for SF Pro, so treat ±10 pt as noise |
| `letterbox` | info | fitted art covers under 40 % of the widget (square art in a medium widget) |

Error / warn cells get a red / orange frame on the sheet. `index.json` also records, per cell, the
bridge path, the fit mode, the composed pixel size, the wallpaper crop, the art rectangle in points
and its coverage, and per option the menu name in each size.

## Not covered

- Live catalogue widgets (clock, calendar, countdown, habits, progress): their layout is
  `src/core/widgetKinds.ts` / `catalogueWidgetModel.ts`, drawn natively by `SavedWidgetView.swift`.
- Lock Screen options (none of the current packs list `lock`).
- The real SwiftUI rendering: see `MACOS_RENDERER.md` for an ImageRenderer plan.
- Blur is approximated with a canvas blur (CoreImage `clampedToExtent` has no dark rim; the sheet
  draws the blurred copy slightly larger to match).

## Repo space rule (run 208)

The sheets live in git, and every changed sheet adds about 1 MB to the build page's repo bundle (16 MB cap, see docs/REPO_SPACE.md). Build runs therefore run the script and review the sheets every run, but **commit new sheets only when widget code or theme packs changed what they show**. If nothing changed, `git checkout docs/widget_snapshots` throws away the re-render.
