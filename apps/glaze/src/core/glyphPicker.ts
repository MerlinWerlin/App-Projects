// T90: what the glyph picker shows under its grid, and whether the Monogram letters field is shown.
// Pure so the rules are tested in Node; src/ui/IconOverrideSheet.tsx turns the result into copy.

/**
 * The count line under the glyph grid.
 * - `none`     nothing matches the search (no glyphs, no Monogram cell).
 * - `matches`  only the Monogram cell matches ("1 match"), so "0 symbols" never shows next to a cell.
 * - `showing`  more glyphs match than the grid shows ("Showing 120 of 480").
 * - `symbols`  every matching glyph is shown ("12 symbols").
 */
export type GlyphCountLine =
  | { kind: 'none' }
  | { kind: 'matches'; count: number }
  | { kind: 'showing'; shown: number; total: number }
  | { kind: 'symbols'; count: number };

export type GlyphCountInput = {
  /** Glyphs matching the search (before the grid limit). */
  glyphCount: number;
  /** Whether the Monogram cell is in the grid for this search. */
  monogramShown: boolean;
  /** How many glyph cells the grid shows at most. */
  limit: number;
};

export function glyphCountLine({ glyphCount, monogramShown, limit }: GlyphCountInput): GlyphCountLine {
  const count = Math.max(0, Math.floor(glyphCount));
  if (count === 0) return monogramShown ? { kind: 'matches', count: 1 } : { kind: 'none' };
  if (count > limit) return { kind: 'showing', shown: limit, total: count };
  return { kind: 'symbols', count };
}

export type MonogramLettersInput = {
  /** The icon's glyph is the Monogram. */
  monogramOn: boolean;
  /** A photo replaces the glyph, so letters don't apply. */
  hasOverrideImage: boolean;
  /** Whether the Monogram cell is in the grid for the current search. */
  monogramShown: boolean;
};

/**
 * The letters field follows the Monogram cell: shown while the Monogram is selected and no photo
 * covers it, and hidden while the search filters the selected Monogram cell out of the grid, so the
 * field never floats under results it has nothing to do with. Clearing the search brings it back.
 */
export function showMonogramLetters({ monogramOn, hasOverrideImage, monogramShown }: MonogramLettersInput): boolean {
  return monogramOn && !hasOverrideImage && monogramShown;
}
