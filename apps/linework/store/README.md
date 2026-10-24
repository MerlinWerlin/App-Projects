# Linework store screenshots (T77)

Eight shots at 1320×2868 (6.9-inch iPhone portrait), each in two styles for the owner to pick or A/B test. They follow docs/MARKET.md §6 and "Design reference 18 Oct" §1, with the headlines from docs/STORE.md §3: one feature per shot and a short bold headline at the top.

**These are illustrative mockups, not real-device captures.** The phone is a generic rounded device with no maker's marks. The app UI is redrawn as vector art in Linework's v2 look (tokens from src/theme/tokens.ts). Everything is original art: the hand, the pencil, the cat "photo", the icons, the arrows and the sparkles are drawn in `src/build.mjs`, and the line art inside the phones comes from our own `assets/templates/`. There are no store badges, ratings or ranking claims, and no other app's names or looks.

| # | Shot | Shows |
|---|---|---|
| 01 | Trace anything onto paper | Trace screen, half traced |
| 02 | Made for… | Uses list (10 uses, 11 locales in captions.json `items`) over the trace screen; subtitle "Every tool free, no ads" |
| 03 | Exact angles for the workshop | The blueprint Workshop tab |
| 04 | Any photo to a sketch | Prepare screen on Outline |
| 05 | 1,900+ templates to trace | Templates grid with category bubbles |
| 06 | Letters in 16 styles | Letters bubble with style tiles |
| 07 | Lock it. Draw steady. | Image locked, touch lock banner |
| 08 | Pay once. Keep it all. | Linework Plus one-time unlock (no price figure) |

**v2 (owner 24 Oct 2026):** one pastel style (a) only; style (b) was dropped. No hands, fingers or body parts anywhere. Every shot is an upright iPhone-style phone (Dynamic Island, no punch-hole camera) as large as the frame allows, caption above. Renders: `jpg/a/` at 1320×2868 and `jpg/a-6.5/` at 1284×2778.

## Styles

- **(a) Serif pastel** (`svg/a`, `jpg/a`): a big serif headline (Fraunces, falling back to Lora or Georgia) in graphite on a soft pastel gradient that changes per shot (peach, lilac, apricot, mint, sky, butter, rose, rainbow). The phone is tilted 5–8°, and cut-out cards, chips and sparkles burst out past the frame. Hand-drawn curved arrows link the phone to the result.
- **(b) Bold sans, one colour** (`svg/b`, `jpg/b`): a heavy rounded sans headline (SF Pro Rounded, Arial Rounded MT Bold, or Inter ExtraBold as the fallback) in white on Linework ink blue `#2346A8` across the whole set. The phone is upright, flat and calm, with one enlarged white pop-up per shot where it helps (the category bubble, the lock, the step bar, the slider).

## Files

- `src/build.mjs`: the generator (Node stdlib only). It writes `svg/a/*.svg`, `svg/b/*.svg` and `svg/shots.json`.
- `src/render.mjs`: renders every SVG to `jpg/{a,b}/*.jpg` at exactly 1320×2868 (JPEG quality 85, which the stores accept) and builds `contact-sheet.png`. It uses the preinstalled Chromium through playwright-core and needs no installs. The JPEGs keep the whole set at about 3.5 MB. Full-colour PNGs came to about 10 MB.
- `captions.json`: the headline and subtitle for every shot in all 11 app locales. English is the source. The other locales are machine translation awaiting native review, and `localeInfo` marks each one. `localeInfo.ar.mirroring` says how to mirror the layout for Arabic.
- `contact-sheet.png`: both styles side by side, for review.

## Regenerate

```sh
node store/src/build.mjs     # SVG sources
node store/src/render.mjs    # JPEG renders + contact sheet (needs local Chromium)
```

`src/core/storeAssets.test.ts` (run by `npm test`) checks the sizes, the captions in every locale, and that no other app's names, ranking claims or store badges appear in these files.

The SVGs set font-family stacks and embed no fonts, so the renders use whatever fonts the machine has. Install Fraunces and SF Pro Rounded before the final export to get the exact brand faces. Localised sets are made by swapping in the strings from `captions.json`. Check line breaks by eye for German and French, which run longer.
