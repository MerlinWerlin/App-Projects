// WCAG 2.x colour contrast (docs/DESIGN_V2.md §2, §8 "contrast AA (token test)"). Pure TS, no React Native.
// Accepts '#RGB', '#RRGGBB', '#RRGGBBAA' and 'rgba(r,g,b,a)' / 'rgb(r,g,b)'. Translucent colours are composited
// over a backdrop before measuring (a pastel at 18% alpha over the card colour, for example).

export type Rgba = { r: number; g: number; b: number; a: number };

/** Parses a colour string; throws on anything it does not understand (tokens must be explicit). */
export function parseColor(input: string): Rgba {
  const s = input.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(s);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h.split('').map((ch) => ch + ch).join('');
    const n = (i: number) => parseInt(h.slice(i, i + 2), 16);
    return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) / 255 : 1 };
  }
  const fn = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(s);
  if (fn) {
    return { r: Number(fn[1]), g: Number(fn[2]), b: Number(fn[3]), a: fn[4] === undefined ? 1 : Number(fn[4]) };
  }
  throw new Error(`unsupported colour: ${input}`);
}

/** Source-over composite of `top` on an opaque `bottom`. */
export function composite(top: Rgba, bottom: Rgba): Rgba {
  const a = Math.min(1, Math.max(0, top.a));
  const mix = (t: number, b: number) => t * a + b * (1 - a);
  return { r: mix(top.r, bottom.r), g: mix(top.g, bottom.g), b: mix(top.b, bottom.b), a: 1 };
}

/** `rgba()` string for a hex colour at an alpha (used for the dark-mode pastels). */
export function withAlpha(hexColor: string, alpha: number): string {
  const { r, g, b } = parseColor(hexColor);
  return `rgba(${r},${g},${b},${alpha})`;
}

const channel = (v: number): number => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};

/** WCAG relative luminance (0 = black, 1 = white) of an opaque colour. */
export function relativeLuminance(color: Rgba | string): number {
  const c = typeof color === 'string' ? parseColor(color) : color;
  return 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
}

/**
 * Contrast ratio (1–21) of text `fg` on fill `bg`. A translucent `bg` is first composited over `backdrop`
 * (default white); a translucent `fg` is composited over the (resolved) `bg`.
 */
export function contrastRatio(fg: string, bg: string, backdrop: string = '#FFFFFF'): number {
  const base = composite(parseColor(bg), parseColor(backdrop));
  const text = composite(parseColor(fg), base);
  const l1 = relativeLuminance(text);
  const l2 = relativeLuminance(base);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/** WCAG AA for normal text (4.5:1); large text (≥ 18 pt, or 14 pt bold) needs 3:1. */
export function meetsAA(fg: string, bg: string, opts: { large?: boolean; backdrop?: string } = {}): boolean {
  return contrastRatio(fg, bg, opts.backdrop) >= (opts.large ? 3 : 4.5);
}
