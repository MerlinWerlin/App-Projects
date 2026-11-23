/**
 * Layout patterns and their default cutting-waste allowance.
 *
 * No standards body publishes waste percentages (TCNA gives none). Defaults are mid-points of the ranges published by
 * retailers and makers (Bob Vila 10–20%, Artistic Tile 20–30%, Home Depot / Lowe's flat 10%, typical retailer guides
 * straight 10 / diagonal 15–20 / herringbone 15–25). See docs/SOURCES.md "Waste by layout". The tiler can override.
 */
export type LayoutId = 'straight' | 'brick' | 'third' | 'diagonal' | 'herringbone' | 'hexagon';

export interface Layout {
  id: LayoutId;
  name: string;
  short: string;
  wastePct: number;
  /** Offset patterns: share of the tile length that each row is shifted by. */
  offset?: number;
  notes: string[];
}

/** ANSI A108.02 §4.3.8.2: offset side over 15 in (nominal) -> offset max 33% unless the tile maker allows more. */
export const OFFSET_LIMIT_SIDE_MM = 15 * 25.4;

export const LAYOUTS: Record<LayoutId, Layout> = {
  straight: { id: 'straight', name: 'Straight lay', short: 'Straight', wastePct: 10, notes: [] },
  brick: { id: 'brick', name: 'Brick bond (half offset)', short: 'Brick ½', wastePct: 12, offset: 0.5, notes: [] },
  third: { id: 'third', name: 'Third offset', short: 'Third ⅓', wastePct: 12, offset: 1 / 3, notes: [] },
  diagonal: { id: 'diagonal', name: 'Diagonal (45°)', short: 'Diagonal', wastePct: 15, notes: ['Every edge tile on a diagonal is a triangle cut, so keep the extra waste even in small rooms.'] },
  herringbone: { id: 'herringbone', name: 'Herringbone', short: 'Herringbone', wastePct: 20, notes: ['Herringbone needs tiles whose length is a whole multiple of the width (2:1, 3:1, 4:1…). Allow 25% for 45° herringbone or chevron.'] },
  hexagon: { id: 'hexagon', name: 'Hexagon', short: 'Hex', wastePct: 15, notes: ['For hex tiles, enter the size across the flats for both length and width, or use the sheet size for mosaics.'] },
};

export const LAYOUT_ORDER: LayoutId[] = ['straight', 'brick', 'third', 'diagonal', 'herringbone', 'hexagon'];

/** Extra notes that depend on the tile, not just the pattern. */
export function layoutWarnings(id: LayoutId, tileLengthMm: number, tileWidthMm: number): string[] {
  const out: string[] = [];
  const l = LAYOUTS[id];
  const longSide = Math.max(tileLengthMm, tileWidthMm);
  if (l.offset && l.offset > 0.34 && longSide > OFFSET_LIMIT_SIDE_MM) {
    out.push('Offset side is over 15 in (381 mm): ANSI A108.02 §4.3.8.2 limits the offset to 33% unless the tile maker says otherwise, because tile bow makes half-offset joints lip. Use a third offset.');
  }
  if (longSide >= 600) out.push('Large-format tile (600 mm / 24 in and over): makers suggest about 5% more waste, one batch (shade and calibre), and checking lippage as you go.');
  return out;
}
