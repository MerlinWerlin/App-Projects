// In-house glyphs (original artwork, Glaze) for generic categories Feather lacks.
// 24×24 grid, stroke style matching Feather: stroke width 2, round caps and joins, no fill.
// `dots` are small filled shapes (eyes, buttons, toppings). Pure data: Node-safe, no RN imports.
// Names must match INHOUSE_GLYPHS in src/core/glyphnames.ts (a core test checks this).

export type InhouseGlyph = {
  /** Path data drawn with stroke only. */
  strokes: string[];
  /** Path data drawn filled with the glyph colour (no stroke). */
  dots?: string[];
};

export const INHOUSE_VIEWBOX = 24;
export const INHOUSE_STROKE_WIDTH = 2;

/** Circle as path data (two arcs). */
function circle(cx: number, cy: number, r: number): string {
  return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
}

export const INHOUSE_GLYPH_PATHS: Readonly<Record<string, InhouseGlyph>> = Object.freeze({
  bank: {
    strokes: ['M3 9.5L12 4l9 5.5Z', 'M5.5 12v6M10 12v6M14 12v6M18.5 12v6', 'M3 21h18'],
  },
  pizza: {
    strokes: ['M12 21L3.6 6.4a15 15 0 0 1 16.8 0Z', 'M5 8.8a12 12 0 0 1 14 0'],
    dots: [circle(10, 12, 1.3), circle(14, 13.5, 1.1), circle(12, 17, 1)],
  },
  'game-controller': {
    strokes: [
      'M7 8h10a5 5 0 0 1 4.9 6l-.4 2a2.6 2.6 0 0 1-4.6 1.1L15.5 15h-7l-1.4 2.1a2.6 2.6 0 0 1-4.6-1.1l-.4-2A5 5 0 0 1 7 8Z',
      'M8 10.5v3M6.5 12h3',
    ],
    dots: [circle(15.5, 11, 0.9), circle(17.5, 13, 0.9)],
  },
  pill: {
    strokes: [
      'M10.83 18.83L18.83 10.83A4 4 0 0 0 13.17 5.17L5.17 13.17A4 4 0 0 0 10.83 18.83Z',
      'M9.17 9.17L14.83 14.83',
    ],
  },
  ticket: {
    strokes: [
      'M3 7a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v3a2 2 0 0 0 0 4v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3a2 2 0 0 0 0-4Z',
      'M15 6.5v1.5M15 11.25v1.5M15 16v1.5',
    ],
  },
  dumbbell: {
    strokes: ['M6.5 6v12M17.5 6v12', 'M3.5 9v6M20.5 9v6', 'M6.5 12h11'],
  },
  paw: {
    strokes: [
      'M12 12.5c-3 0-6 3.4-6 5.6A2.3 2.3 0 0 0 8.4 20.4c1.4 0 2.2-.6 3.6-.6s2.2.6 3.6.6a2.3 2.3 0 0 0 2.4-2.3c0-2.2-3-5.6-6-5.6Z',
    ],
    dots: [circle(5, 10.5, 1.7), circle(9, 6.2, 1.9), circle(15, 6.2, 1.9), circle(19, 10.5, 1.7)],
  },
  baby: {
    strokes: [circle(12, 12.5, 8.5), 'M9.5 16a3.2 3.2 0 0 0 5 0', 'M12 4c-1.6 0-2.4 1.6-1.2 2.6'],
    dots: [circle(9, 12, 1), circle(15, 12, 1)],
  },
  car: {
    strokes: [
      'M3 16.5V13l2-4.6A2 2 0 0 1 6.8 7h10.4a2 2 0 0 1 1.8 1.4L21 13v3.5a.5.5 0 0 1-.5.5h-17a.5.5 0 0 1-.5-.5Z',
      'M3 13h18',
      circle(7.5, 17.5, 1.8),
      circle(16.5, 17.5, 1.8),
    ],
  },
  plane: {
    strokes: [
      'M12 2.5a1.5 1.5 0 0 1 1.5 1.5v5l7.5 4.5V16l-7.5-2.5V19l2 1.5V22L12 21l-3.5 1v-1.5l2-1.5v-5.5L3 16v-2.5L10.5 9V4A1.5 1.5 0 0 1 12 2.5Z',
    ],
  },
  leaf: {
    strokes: ['M5 19C5 10 10 5 20 4c-1 10-6 15-15 15Z', 'M5 19l8-8'],
  },
  utensils: {
    strokes: ['M5 3v5a2 2 0 0 0 4 0V3', 'M7 3v18', 'M17 21V3c-2 1.5-3 4-3 7v3h3'],
  },
});

export function inhouseGlyph(name: string): InhouseGlyph | null {
  return Object.prototype.hasOwnProperty.call(INHOUSE_GLYPH_PATHS, name) ? INHOUSE_GLYPH_PATHS[name] : null;
}
