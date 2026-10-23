// Curated glyph sets shown in the symbol picker. Names come from the existing Feather /
// in-house lists (src/core/glyphnames.ts); no new art. Ownership is checked in src/plus only.
// Pure TS (no React Native / Expo) so Node can run and test it directly.

import { FEATHER_GLYPHS, INHOUSE_GLYPHS } from './glyphnames.ts';

export type GlyphSet = {
  id: string;
  name: string;
  description: string;
  names: readonly string[];
  /** Plus-only set. The full Feather + in-house library stays free. */
  plus: boolean;
};

export const GLYPH_SETS: readonly GlyphSet[] = Object.freeze([
  {
    id: 'everything',
    name: 'All symbols',
    description: 'Every line and Glaze symbol. Always free.',
    names: Object.freeze([...FEATHER_GLYPHS, ...INHOUSE_GLYPHS].sort()),
    plus: false,
  },
  {
    id: 'plus-moods',
    name: 'Moods & Moments',
    description: 'A hand-picked set for weather, time, feelings and little rituals.',
    names: Object.freeze([
      'sun', 'sunrise', 'sunset', 'moon', 'cloud', 'cloud-rain', 'cloud-snow', 'cloud-lightning',
      'wind', 'umbrella', 'droplet', 'thermometer', 'coffee', 'heart', 'smile', 'meh', 'star',
      'feather', 'gift', 'music', 'headphones', 'book-open', 'bookmark', 'compass', 'anchor',
      'award', 'aperture', 'zap', 'leaf', 'paw', 'pizza', 'ticket', 'plane', 'utensils',
    ]),
    plus: true,
  },
]);

export function getGlyphSet(id: string): GlyphSet | undefined {
  return GLYPH_SETS.find((s) => s.id === id);
}
