// T91: WCAG 2.x relative luminance and contrast ratio, pure TS (no React Native), for the token contrast tests.
// Accepts #RGB, #RRGGBB and rgba(r, g, b, a); a translucent colour is first composited over `under`.

/** Normal text. */
export const AA_TEXT = 4.5;
/** Large text (18 pt, or 14 pt bold), icons and other meaningful graphics. */
export const AA_LARGE = 3;

type RGB = readonly [number, number, number];

/** Parse #RGB / #RRGGBB / rgb() / rgba() into 0-255 channels plus alpha. */
export function parseColour(c: string): { rgb: RGB; a: number } {
  const s = c.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map((x) => x + x).join('') : hex[1];
    const n = parseInt(h, 16);
    return { rgb: [(n >> 16) & 255, (n >> 8) & 255, n & 255], a: 1 };
  }
  const fn = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(s);
  if (fn) return { rgb: [Number(fn[1]), Number(fn[2]), Number(fn[3])], a: fn[4] === undefined ? 1 : Number(fn[4]) };
  throw new Error(`not a colour: ${c}`);
}

/** Composite `top` (may be translucent) over an opaque `under`; returns opaque channels. */
export function over(top: string, under: string): RGB {
  const t = parseColour(top);
  const u = parseColour(under).rgb;
  return [0, 1, 2].map((i) => t.rgb[i] * t.a + u[i] * (1 - t.a)) as unknown as RGB;
}

/** WCAG relative luminance of an opaque colour (a translucent one is composited over white). */
export function luminance(c: string | RGB): number {
  const rgb = typeof c === 'string' ? over(c, '#FFFFFF') : c;
  const lin = rgb.map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

/** Contrast ratio 1..21 between two colours (order does not matter). */
export function contrast(a: string | RGB, b: string | RGB): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (hi + 0.05) / (lo + 0.05);
}
