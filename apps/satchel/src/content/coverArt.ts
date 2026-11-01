// T152 bundled cover art manifest. Each slot (src/core/covers2.ts COVER_ART_KEYS: <scene>-<day|night>) maps to an
// optimised image in assets/covers/ named by coverArtFile (e.g. 'city-night.webp'). A slot that is not listed here
// draws the SVG scene instead (src/core/covers2.ts resolveCover), so the manifest can fill in one image at a time.
//
// While no art has been delivered the manifest is empty. When an image lands (docs/research/COVER_ART_REQUEST.md,
// PC _drops/art with a MANIFEST entry), the build run copies it into assets/covers/ and adds one line per file:
//   'city-day': require('../../assets/covers/city-day.webp'),
// src/core/covers2.test.ts checks that every line points at a file that exists, under the slot's own name, and that
// the files together stay inside COVER_ART_BUDGET. Only this file may require() cover images.
import type { CoverArtManifest } from '../core/covers2.ts';

export const COVER_ART_IMAGES: CoverArtManifest<number> = {
  // (no bundled cover art yet: every scene draws its SVG fallback)
};
