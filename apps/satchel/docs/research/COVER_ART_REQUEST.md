# Trip cover art: image prompt pack (T152, for the Satchel OpenAI lanes / ChatGPT image generation)

Written 2026-11-01 by the T152 build worker (run 108). Jared tested TestFlight and said "when selecting a trip, the
covers are ugly". The app now has a slot for illustrated raster covers. Until images arrive, every scene draws its
redrawn SVG fallback. This file is the request: 16 images (8 scenes x day / night) in one consistent style. It contains
no images.

## How the app uses them

- Each trip picks one of 8 scenes automatically (`src/core/covers.ts`, unchanged): city, mountains, coast, oldtown,
  countryside, snow, desert, island. The traveller can also pick a scene, or use their own photo.
- Light mode shows the **day** image and dark mode shows the **night** image. If one variant is missing, the other is
  used. If both are missing, the SVG scene is drawn (`src/core/covers2.ts` `resolveCover`: own photo, then bundled art,
  then SVG).
- The same image is cropped to different shapes, using `resizeMode: cover`, which keeps the centre:
  - trip hero: 16:9
  - Trips list card strip: about 3.4:1 (a band through the middle)
  - recap tiles: 1:1 and 1.4:1
  - picker previews: 1.5:1
  **Keep everything important inside the centre 60% of the width and the middle 50% of the height.** The bottom 30%
  sits under the trip name, behind a dark scrim, so keep it calm (ground, water, road) with no key detail.

## Exact files (names must match `src/core/covers2.ts` `coverArtFile`)

| Scene | Day file | Night file | Subject |
|---|---|---|---|
| city | `city-day.webp` | `city-night.webp` | A generic modern skyline across a river or harbour, with tall towers of mixed heights. Night: lit windows and reflections. No real skyline and no recognisable tower. |
| mountains | `mountains-day.webp` | `mountains-night.webp` | Layered alpine ranges with snow caps, a pine forest and a green valley floor, perhaps a small lake. Night: moonlit peaks. |
| coast | `coast-day.webp` | `coast-night.webp` | A sandy beach curving to a headland with a small generic lighthouse, calm sea, sun low over the water. Night: warm dusk sky with a moon path on the sea. |
| oldtown | `oldtown-day.webp` | `oldtown-night.webp` | A row of tall, narrow old townhouses with steep tiled roofs and a simple clock tower, with a cobbled street in front. Night: warm lit windows. Not a real town or building. |
| countryside | `countryside-day.webp` | `countryside-night.webp` | Rolling hills with field rows, a lone farmhouse, round trees and a winding lane. Night: a blue hour with a few stars. |
| snow | `snow-day.webp` | `snow-night.webp` | A snowy valley with pine trees, a small timber cabin with smoke from its chimney, and peaks behind. Night: a lit cabin window and a faint aurora band (soft green, low). |
| desert | `desert-day.webp` | `desert-night.webp` | Wind-shaped dunes, a flat-topped mesa in the haze and a small palm oasis. Night: a deep violet sky, a big moon and cool dune shadows. |
| island | `island-day.webp` | `island-night.webp` | A small tropical island with two leaning palms, a turquoise lagoon ring and open sea. Night: moonlight on the water. |

Optional extras, only if the 16 above come out well: `harbour`, `lake`, `vineyard`, `rainforest`, `canyon`. These would
need a new scene id in `src/core/covers.ts` (a code task), so don't make them now.

## Size, format and budget

- **Source:** 1200 x 675 px (16:9), PNG or high-quality JPEG. Keep the sources in the drop folder.
- **Shipped:** 800 x 450 px **WebP**, quality about 70 to 78. The build run makes the shipped files from the sources.
- **Budget:** all 16 shipped files together **under 1.5 MB** (about 90 KB each, never above 130 KB for one file).
  `src/core/covers2.test.ts` fails the build if the bundled files go over `COVER_ART_BUDGET` (1,500,000 bytes).
- sRGB, no transparency, no border, no vignette baked in (the app adds its own scrim).

## One style for all 16 (paste this block into every prompt)

> Flat-but-rich editorial travel illustration, in the style of a modern travel poster or picture-book landscape,
> **not** photo-real and not 3D-rendered. Wide 16:9 landscape, eye-level view, with 4 to 5 clear depth layers
> (foreground, middle ground, two or three background layers) separated by soft atmospheric haze, so far layers are
> paler and bluer. Shapes are simple and slightly geometric, with gently rounded corners and clean edges, and **no
> outlines**. Lighting is soft, with one clear light source (a low sun in the day images, a moon in the night images),
> a gentle glow around it, lit faces on the side facing the light and cool shadow on the far side. A subtle grain and
> paper texture sits over the flat colour fills (fine noise, like risograph print). The sky is a smooth vertical
> gradient. Palette: day uses clear sky blue to warm cream at the horizon, with one warm accent. Night uses deep navy
> to dusky violet, warm lights, and a cream moon and stars. Calm, uncluttered, optimistic. Leave a quiet band along the
> bottom 30% of the image.

Palette anchors (from the app's tokens, `src/theme/tokens.ts` `coverPalettes`, so the images sit well with the UI):

- Day: sky `#8EC3E6` to `#FBE3C4`, sun `#FFD27A`, ink navy `#14213D`, accent `#CC6A26`.
- Night: sky `#0A1430` to `#3B2F5E`, moon `#F6E7C1`, lit windows `#FFC864`.

## Rules (put these in every prompt as negatives)

- **Original art only.** Do not copy or imitate any existing artwork, poster, photo or named artist's style. Do not
  copy landmarks as they appear in artworks.
- **No real landmarks** or recognisable buildings, skylines, bridges, statues or lighthouses. Every place is generic.
- **No brands**, logos, signs, flags, words, letters, numbers or watermarks. **No text at all.**
- **No people's faces.** Tiny distant figures are fine only if faceless; we prefer none. No animals in close-up.
- No borders, frames, UI, captions or signatures.

## Prompt template

```
[STYLE BLOCK]
Scene: <subject from the table>, <day: "late-morning light, low warm sun to the upper right" |
night: "night, crescent moon upper left, a few stars, warm lit windows">.
Composition: main subject centred in the middle 60% of the width, horizon at about 55-60% height, calm ground or
water across the bottom 30%. 16:9, 1200x675.
Negative: text, letters, logos, brands, signs, flags, watermark, faces, people close-up, real landmarks, famous
buildings, photo-realism, 3D render, outlines, frame, border.
```

Example (mountains, night):

```
[STYLE BLOCK]
Scene: layered alpine ranges with snow caps, dark pine forest and a still lake in a valley, night, crescent moon upper
left with a soft halo, a few stars, moonlight catching the snow on the left faces of the peaks, cool blue shadow on the
right faces, thin mist between the ranges.
Composition: highest peak slightly left of centre, lake across the lower third, calm dark shore along the bottom 30%.
16:9, 1200x675.
Negative: text, letters, logos, brands, signs, flags, watermark, faces, people, real landmarks, famous mountains,
photo-realism, 3D render, outlines, frame, border.
```

Make all 16 in one session, or reuse the first approved image as the style reference, so the set matches. Make the
day image first, then the night image from the same composition, so each pair lines up.

## Hand-off: how the build run imports them

1. Put the 16 source files in the PC folder `Desktop\Apps\satchel\_drops\art\covers\`, named exactly as in the table
   (the source may be `.png` or `.jpg` with the same base name, for example `city-day.png`).
2. Add one entry per file to `_drops/art/MANIFEST.json`:
   ```json
   { "file": "covers/city-day.png", "slot": "city-day", "task": "T152", "model": "<image model>",
     "prompt": "<the full prompt used>", "created": "2026-11-0X", "original": true,
     "notes": "no text, no brands, no landmarks, no faces" }
   ```
   Also save each prompt beside the image in `meta.json`, as the starter standard asks.
3. The next build run will then:
   - check each image for text, logos, landmarks and faces, and reject any that fail (recorded in `ops/DECISIONS.md`);
   - resize to 800 x 450 and encode WebP into `assets/covers/<slot>.webp`;
   - add one line per file to `src/content/coverArt.ts`, for example
     `'city-day': require('../../assets/covers/city-day.webp'),`;
   - run `npm test` (the manifest guard checks names, that the files exist and the 1.5 MB budget);
   - stamp `imported_by_build` on the MANIFEST entry.
   Scenes without an image keep the SVG drawing, so a partial set can ship.
4. New bundled images need a new build to reach phones. The auto-ship decides between an over-the-air update (assets
   only) and TestFlight.
