# Linework store screenshots

Eight shots at 1320×2868 (the 6.9-inch iPhone slot `listing.json` uploads from `jpg/a/`), plus the same set at
1284×2778 in `jpg/a-6.5/`. From 1.0.4 (21 Nov 2026) **every phone screen is a real capture of the app**, taken on an
iPhone Pro Max simulator at its native 1320×2868. Only the frame around it is added: the paper background with the
drafting grid, a caption, a graphite phone outline with the Dynamic Island, and red registration marks (DESIGN.md).
Nothing inside the screen is drawn or retouched. The earlier set was drawn vector mockups in the old blue v2 look; it
was retired so the store shows the app as it really is (App Review Guideline 2.3.3).

| # | Shot | Capture (`capture/shots/`) | What it shows |
|---|---|---|---|
| 01 | Trace anything onto paper | `clean-home` | Home on a fresh install: Trace a photo, Take a photo, Templates, the trial offer |
| 02 | 1,900+ templates to trace | `trial-templates` | Templates tab with the category bubbles |
| 03 | Letters in 16 styles | `trial-letters` | The Letters bubble |
| 04 | Exact angles for the workshop | `trial-workshop` | Workshop tab |
| 05 | Any photo to a sketch | `trial-prepare` | Prepare on Outline, from `capture/photo.jpg` |
| 06 | No camera? Use Lightbox | `trial-lightbox` | Lightbox with the owl template |
| 07 | Light or dark, day or night | `dark-templates` | Templates tab in dark mode |
| 08 | Pay once. Keep it all. | `clean-plus` | Linework Plus with the trial offer, the App Store price and Restore purchases |

The live-camera Trace screen is not in the set: a simulator has no camera, and a drawn stand-in would not be a real
capture. Add it from a physical iPhone screenshot if wanted.

## How the captures are made

- `capture/flow-clean.yaml` (Maestro): a clean install, light mode. Home and Plus show the trial offer.
- `capture/flow-trial.yaml`: the 14-day trial running, so the library and outline mode are open. The trial start date
  is written to the app's storage before launch (`linework.trial.v1`, the same value the trial purchase stores),
  because a simulator cannot complete the trial purchase. Run in light and dark.
- `capture/photo.jpg` (source `photo.svg`) is an original still life drawn for this, used as the "photo" on Prepare.
  It is not a photograph and not anyone else's image.
- They run on a throwaway `linework-capture/**` branch with `linework-design-capture.yml` pointed at these flows on an
  iPhone Pro Max simulator; copy the PNGs into `capture/shots/` (dark ones get a `dark-` prefix).

## Build

```sh
python store/src/build.py    # from apps/linework; Pillow, and node_modules for the Fraunces and Inter fonts
```

It writes `jpg/a/`, `jpg/a-6.5/` and `contact-sheet.png`. Captions come from `captions.json` (English is the source;
the 10 other locales are machine translation awaiting native review, marked in `localeInfo`). `src/core/storeAssets.test.ts`
checks the sizes, the captions, that every shot has its capture, and that no other app's names, ranking claims or store
badges appear in store/.

**1.0.2 OTA removal (10 Nov 2026):** see `OTA_REMOVAL_1_0_2.md`. Linework no longer includes expo-updates; the review notes and privacy page say so.
