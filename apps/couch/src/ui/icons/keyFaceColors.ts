/**
 * Physical-key shading (fb-1017b H2) as pure colour math, so the remote's "3D" key faces are
 * unit-tested against the WCAG label pairs. KeyFace.tsx renders these stops; colours come only
 * from remote theme tokens (key / keyEdge), never from a fixed palette.
 */

function parse(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m || !m[1]) throw new Error(`not a #RRGGBB colour: ${hex}`);
  const v = parseInt(m[1], 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

const hex2 = (c: number): string => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, '0');

/** Mix `a` toward `b` by t (0..1), both #RRGGBB. */
export function mixHex(a: string, b: string, t: number): string {
  const x = parse(a);
  const y = parse(b);
  const k = Math.max(0, Math.min(1, t));
  return `#${hex2(x[0] + (y[0] - x[0]) * k)}${hex2(x[1] + (y[1] - x[1]) * k)}${hex2(x[2] + (y[2] - x[2]) * k)}`.toUpperCase();
}

/** How strongly the face is lit at the top and shaded at the bottom. Kept small for AA. */
export const KEY_FACE_LIGHT = 0.07;
export const KEY_FACE_SHADE = 0.05;

export interface KeyFaceColors {
  /** Gradient stop at the top of the face (slightly lit). */
  top: string;
  /** Gradient stop at the bottom of the face (slightly shaded toward keyEdge). */
  bottom: string;
  /** Thin top highlight (white, low opacity). */
  highlight: string;
  highlightOpacity: number;
  /** Soft inner shadow along the bottom edge (keyEdge, low opacity). */
  shade: string;
  shadeOpacity: number;
}

/** Relative luminance (WCAG) of a #RRGGBB colour. */
function lum(hex: string): number {
  const ch = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const [r, g, b] = parse(hex);
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

/** Face colours for a key from the theme's key / keyEdge. Light keys get a brighter gloss. */
export function keyFaceColors(t: { key: string; keyEdge: string }): KeyFaceColors {
  const dark = lum(t.key) < 0.4;
  return {
    top: mixHex(t.key, '#FFFFFF', KEY_FACE_LIGHT),
    bottom: mixHex(t.key, t.keyEdge, KEY_FACE_SHADE),
    highlight: '#FFFFFF',
    highlightOpacity: dark ? 0.14 : 0.6,
    shade: t.keyEdge,
    shadeOpacity: dark ? 0.35 : 0.18,
  };
}
