# Licences for icons, glyphs and fonts

Glaze ships only generic glyphs and original artwork. **No brand logos** are drawn, bundled or
selectable: Feather's brand-logo icons (e.g. the social-network and developer-tool logos) are
excluded in `src/core/glyphnames.ts` (`FEATHER_BRAND_GLYPHS`) and resolve to a plain square if
ever requested. Users may fill any icon with their own photo; that image never leaves the device.

| Asset | Where it is used | Source | Licence |
| --- | --- | --- | --- |
| Feather icons (v4.29) | App icon glyphs (primary set), UI icons | https://github.com/feathericons/feather, bundled as a font by `@expo/vector-icons` | MIT, Copyright (c) 2013-2017 Cole Bemis |
| @expo/vector-icons | Font loader / component for Feather | https://github.com/expo/vector-icons | MIT, Copyright (c) 2015 Joel Arvidsson, (c) 2016-present 650 Industries |
| ThumbHash encoder (algorithm and reference code by Evan Wallace) | Build-time placeholder hashes for remote art packs, `scripts/packs/thumbhash.mjs` (not shipped in the app) | https://github.com/evanw/thumbhash | MIT, Copyright (c) 2023 Evan Wallace |
| Unbounded | Display / headings | Google Fonts via `@expo-google-fonts/unbounded` | SIL Open Font License 1.1 |
| Manrope | Body text | Google Fonts via `@expo-google-fonts/manrope` | SIL Open Font License 1.1 |
| In-house glyphs (`bank`, `pizza`, `game-controller`, `pill`, `ticket`, `dumbbell`, `paw`, `baby`, `car`, `plane`, `leaf`, `utensils`) | App icon glyphs for categories Feather lacks | Original artwork, `src/render/inhouse.ts` | Glaze, all rights reserved |
| Icon shapes (squircle, circle, rounded square, blob), backgrounds | Icon rendering | Generated geometry, `src/core/shapes.ts` | Glaze, all rights reserved |
| Theme artwork motifs (strawberry, cream swirl, daisy, tulip, leaf sprig, leaf, mushroom, acorn, crescent moon, moon phases, star, sparkle, ringed planet, cloud, heart, bow, lace doily, scallop shell, starfish, cherry blossom, petal, pumpkin, wrapped sweet, lollipop, teacup, cherries, ice cream cone, butterfly, droplet, sun), icon frames (scalloped, lace, stitched, ribbon, double ring), textures (gingham, polka, paper speckle, linen, starfield, watercolour wash, stripes) and wallpaper compositions | Theme icons, stickers and wallpapers | Original in-house vector art drawn for Glaze as SVG path data, `src/core/artwork.ts`; generic subjects only, no characters, franchises, brands or traced artwork | Glaze, all rights reserved |
| Lora, Poppins, Inter | Store screenshot headlines and captions only (rendered into `assets/store/*.png`, not bundled in the app) | Google Fonts, installed system fonts on the render machine | SIL Open Font License 1.1 |
| Store screenshot art (phone frames, floating widgets, sparkles, bubbles, gradients) | `assets/store/` | Original SVG/CSS drawn for Glaze in `assets/store/src/`, reusing in-house glyphs from `src/render/inhouse.ts` | Glaze, all rights reserved |
| App icon, splash and full-screen intro: the Prism diamond (fb-1025 G; current again since T199, owner-1101d #2) | `assets/brand/*` (icon and adaptive SVGs copied from `docs/mascot/previous-prism-diamond/`), splash and intro geometry in `src/core/introGlaze.ts`, drawn at runtime by `src/ui/IntroGlaze.tsx` | Original generated SVG geometry drawn for Glaze (faceted crystal, light beam, colour fan); no traced or reference artwork | Original, owned by the Glaze project, all rights reserved |
| Rejected icon and mascot "Prism", the little prism creature (owner-1101 item 8, T190; rejected by T199, reference only, not bundled) | `docs/mascot/rejected-prism-creature/` | Original generated SVG geometry drawn for Glaze (rounded lilac crystal with a face, arms and feet, rainbow arch, clouds, sparkles); no traced or reference artwork, not based on any existing character, mascot, logo or album art | Original, owned by the Glaze project, all rights reserved |
| Source copy of the Prism diamond icon (fb-1025 G, 25 Oct 2026; copied into `assets/brand/` by T199) | `docs/mascot/previous-prism-diamond/` | Original generated SVG geometry drawn for Glaze (faceted crystal, light beam, spectrum fan) | Original, owned by the Glaze project, all rights reserved |
| Previous app icon (glaze-drip tile, 23 to 25 Oct 2026, reference only, not bundled) | `docs/mascot/previous-glaze-drip/` | Original generated SVG drawn for Glaze | Original, owned by the Glaze project, all rights reserved |
| Mascot concepts (Tessel, Latchling, Vitri; fb-1023 D, concept only, not bundled) | `docs/mascot/*.svg`, `docs/mascot/*.png`, `docs/MASCOT.md` | Original hand-written SVG drawn for Glaze; no traced or reference artwork, no existing characters or brands | Original, owned by the Glaze project, all rights reserved |
| App icon, splash tile and opening animation art (faceless glaze-pour tile) | `assets/brand/*`, drawn at runtime by `src/ui/IntroGlaze.tsx` | Original geometry generated from `src/core/introGlaze.ts` by `scripts/brand/build-brand.mjs`; plain shapes and gradients, no text, no traced or reference artwork, no existing brands | Original, owned by the Glaze project, all rights reserved |

## Space (Webb) photos (T103)

Not bundled: each photo is downloaded from the official host only when the person taps Download on
that theme (docs/THEME_PACKS.md, "Space (Webb) photo pack"). All are ESA/Webb releases under
**Creative Commons Attribution 4.0 International** (https://creativecommons.org/licenses/by/4.0/;
terms https://esawebb.org/copyright/, checked 2026-10-22). The credit line below is shown unaltered
next to the photo in the theme detail. ESA/Webb logos are not covered and are not used; no
endorsement by ESA/Webb, NASA or CSA is implied.

| Theme | Image (release id) | Source page | Credit (exact) | Licence |
| --- | --- | --- | --- | --- |
| Pillars of Creation | Pillars of Creation, full view (weic2216b) | https://esawebb.org/images/weic2216b/ | NASA, ESA, CSA, STScI; J. DePasquale, A. Koekemoer, A. Pagan (STScI). | CC BY 4.0 |
| Cosmic Cliffs | "Cosmic Cliffs" in Carina, NIRCam (weic2205a) | https://esawebb.org/images/weic2205a/ | NASA, ESA, CSA, and STScI | CC BY 4.0 |
| Tarantula Nebula | Tarantula Nebula, NIRCam (weic2212a) | https://esawebb.org/images/weic2212a/ | NASA, ESA, CSA, and STScI | CC BY 4.0 |
| Cassiopeia A | Cas A, NIRCam (weic2330a) | https://esawebb.org/images/weic2330a/ | NASA, ESA, CSA, STScI, D. Milisavljevic (Purdue University), T. Temim (Princeton University), I. De Looze (University of Gent) | CC BY 4.0 |
| Infrared Remnant | Cassiopeia A, MIRI (weic2311a) | https://esawebb.org/images/weic2311a/ | NASA, ESA, CSA, D. Milisavljevic (Purdue University), T. Temim (Princeton University), I. De Looze (UGent), J. DePasquale (STScI) | CC BY 4.0 |
| Rho Ophiuchi | Rho Ophiuchi cloud complex (weic2316a) | https://esawebb.org/images/weic2316a/ | NASA, ESA, CSA, STScI, K. Pontoppidan (STScI), A. Pagan (STScI) | CC BY 4.0 |
| Cartwheel Galaxy | Cartwheel Galaxy, NIRCam + MIRI (weic2211a) | https://esawebb.org/images/weic2211a/ | NASA, ESA, CSA, STScI | CC BY 4.0 |
| Ghostly Pillars | Pillars of Creation, MIRI (weic2218a) | https://esawebb.org/images/weic2218a/ | NASA, ESA, CSA, STScI, J. DePasquale (STScI), A. Pagan (STScI) | CC BY 4.0 |

The Space themes' icons, widget styles and fallback wallpaper art are Glaze's own (see the theme
artwork row above).

## Technical references (no code copied)

| Project | Licence | Used for |
|---|---|---|
| LivePaper, <https://github.com/Yuyang16Z/LivePaper> (docs/FINDINGS.md) | MIT | Facts about the Live Photo wallpaper format (T153, docs/LIVEPHOTO.md "Wallpaper recipe (run 120)"). No code or data copied, so no notice is needed in the app. |
| open-wallpaper-engine-mac PR #288, <https://github.com/deepratna-awale/open-wallpaper-engine-mac/pull/288> | not stated on the page | Same: facts from the PR description only. |

## Notes

- MIT requires the copyright notice and permission notice to be included with copies of the
  software. Show both in Settings → About → Licences.
- The OFL allows bundling the fonts in the app; the fonts may not be sold on their own.
- When a new glyph set or font is added, record it here in the same change.

## Island pets

Mochi, Pip and Clover are original 16×16 pixel grids authored for Glaze on 26 October 2026, removed from the app on 1 Nov 2026 (T198) and parked in `docs/future/pets-game/sprites.md`. No third-party pet art was copied. Native decorative symbols use Apple SF Symbols through SwiftUI.
