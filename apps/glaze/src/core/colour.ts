// Colour helpers: hex parse/format, RGB <-> HSL, mixing, gradients, WCAG contrast,
// and a deterministic "k-means lite" palette extractor for image pixels.
// Pure TypeScript (no React Native / Expo imports) so Node can run it directly.

export type RGB = { r: number; g: number; b: number };
export type HSL = { h: number; s: number; l: number };
export type PaletteColour = { hex: string; count: number; share: number };

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
const clamp255 = (v: number): number => clamp(Math.round(v), 0, 255);

// ---------------------------------------------------------------- hex

/** Parse `#RGB`, `#RRGGBB` (the `#` is optional). Returns null when invalid. */
export function parseHex(input: string): RGB | null {
  if (typeof input !== 'string') return null;
  let s = input.trim();
  if (s.startsWith('#')) s = s.slice(1);
  if (!/^[0-9a-fA-F]+$/.test(s)) return null;
  if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
  if (s.length !== 6) return null;
  return {
    r: parseInt(s.slice(0, 2), 16),
    g: parseInt(s.slice(2, 4), 16),
    b: parseInt(s.slice(4, 6), 16),
  };
}

/** Like parseHex but throws on invalid input. */
export function hexToRgb(hex: string): RGB {
  const c = parseHex(hex);
  if (!c) throw new Error(`Invalid hex colour: ${hex}`);
  return c;
}

/** Format as uppercase `#RRGGBB` (channels are rounded and clamped). */
export function rgbToHex(c: RGB): string {
  const h = (v: number) => clamp255(v).toString(16).padStart(2, '0');
  return ('#' + h(c.r) + h(c.g) + h(c.b)).toUpperCase();
}

/** Normalise any accepted hex form to `#RRGGBB`. */
export function normalizeHex(hex: string): string {
  return rgbToHex(hexToRgb(hex));
}

export function isHex(input: string): boolean {
  return parseHex(input) !== null;
}

// ---------------------------------------------------------------- hsl

/** RGB (0-255) -> HSL with h in [0,360), s and l in [0,1]. */
export function rgbToHsl(c: RGB): HSL {
  const r = c.r / 255;
  const g = c.g / 255;
  const b = c.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s: clamp(s, 0, 1), l };
}

/** HSL (h degrees, s/l 0-1) -> RGB (0-255, rounded). */
export function hslToRgb(c: HSL): RGB {
  const h = (((c.h % 360) + 360) % 360) / 60;
  const s = clamp(c.s, 0, 1);
  const l = clamp(c.l, 0, 1);
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const x = chroma * (1 - Math.abs((h % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 1) [r, g, b] = [chroma, x, 0];
  else if (h < 2) [r, g, b] = [x, chroma, 0];
  else if (h < 3) [r, g, b] = [0, chroma, x];
  else if (h < 4) [r, g, b] = [0, x, chroma];
  else if (h < 5) [r, g, b] = [x, 0, chroma];
  else [r, g, b] = [chroma, 0, x];
  const m = l - chroma / 2;
  return { r: clamp255((r + m) * 255), g: clamp255((g + m) * 255), b: clamp255((b + m) * 255) };
}

export function hexToHsl(hex: string): HSL {
  return rgbToHsl(hexToRgb(hex));
}

export function hslToHex(c: HSL): string {
  return rgbToHex(hslToRgb(c));
}

// ---------------------------------------------------------------- mixing

/** Linear sRGB-space mix: t=0 gives a, t=1 gives b. */
export function mix(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const k = clamp(t, 0, 1);
  return rgbToHex({
    r: ca.r + (cb.r - ca.r) * k,
    g: ca.g + (cb.g - ca.g) * k,
    b: ca.b + (cb.b - ca.b) * k,
  });
}

/** Raise HSL lightness by `amount` (0-1, absolute). */
export function lighten(hex: string, amount: number): string {
  const c = hexToHsl(hex);
  return hslToHex({ ...c, l: clamp(c.l + amount, 0, 1) });
}

/** Lower HSL lightness by `amount` (0-1, absolute). */
export function darken(hex: string, amount: number): string {
  return lighten(hex, -amount);
}

/** Apply alpha as `#RRGGBBAA` (alpha 0-1). */
export function withAlpha(hex: string, alpha: number): string {
  const a = clamp255(clamp(alpha, 0, 1) * 255).toString(16).padStart(2, '0').toUpperCase();
  return normalizeHex(hex) + a;
}

/**
 * `n` evenly spaced colours along a gradient through `stops` (2+ colours, or one colour
 * repeated). The first and last results equal the first and last stops.
 */
export function gradientStops(stops: string[] | [string, string], n: number): string[] {
  if (stops.length === 0) throw new Error('gradientStops needs at least one colour');
  const count = Math.max(0, Math.floor(n));
  if (count === 0) return [];
  if (stops.length === 1) return Array.from({ length: count }, () => normalizeHex(stops[0]));
  if (count === 1) return [normalizeHex(stops[0])];
  const out: string[] = [];
  const segs = stops.length - 1;
  for (let i = 0; i < count; i++) {
    const pos = (i / (count - 1)) * segs;
    const seg = Math.min(Math.floor(pos), segs - 1);
    out.push(mix(stops[seg], stops[seg + 1], pos - seg));
  }
  return out;
}

/** Convenience: gradient between two colours. */
export function gradient(from: string, to: string, n: number): string[] {
  return gradientStops([from, to], n);
}

// ---------------------------------------------------------------- WCAG

function channelToLinear(v: number): number {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

const LUMA_CACHE = new Map<string, number>();
const LUMA_CACHE_MAX = 8192;

/** WCAG 2.x relative luminance, 0 (black) to 1 (white). */
export function relativeLuminance(hex: string): number {
  // Memoised: contrast solving (widget looks, T65) asks for the same colours many thousands of times.
  const hit = LUMA_CACHE.get(hex);
  if (hit !== undefined) return hit;
  const c = hexToRgb(hex);
  const l = 0.2126 * channelToLinear(c.r) + 0.7152 * channelToLinear(c.g) + 0.0722 * channelToLinear(c.b);
  if (LUMA_CACHE.size >= LUMA_CACHE_MAX) LUMA_CACHE.clear();
  LUMA_CACHE.set(hex, l);
  return l;
}


/** WCAG contrast ratio between two colours, 1 to 21. Order does not matter. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/** True if the pair meets `min` (default 4.5, WCAG AA body text). */
export function meetsContrast(a: string, b: string, min = 4.5): boolean {
  return contrastRatio(a, b) >= min;
}

/** Pick whichever of `dark` / `light` has the higher contrast against `bg`. */
export function bestTextOn(bg: string, dark = '#000000', light = '#FFFFFF'): string {
  return contrastRatio(bg, dark) >= contrastRatio(bg, light) ? normalizeHex(dark) : normalizeHex(light);
}

/** Lowest contrast of `fg` against every colour in `bgs` (21 when `bgs` is empty). */
export function minContrast(fg: string, bgs: readonly string[]): number {
  let lo = 21;
  for (const b of bgs) lo = Math.min(lo, contrastRatio(fg, b));
  return lo;
}

/**
 * `fg` with alpha `alpha` painted over an opaque `under`, as `#RRGGBB`. Used to bound what a
 * translucent layer can look like (composite over black and over white).
 */
export function composite(fg: string, alpha: number, under: string): string {
  return mix(under, fg, alpha);
}

/**
 * Nudge `fg` (keeping its hue and saturation) darker or lighter until it reaches `min` contrast
 * against every colour in `bgs`. Returns `fg` normalised when it already passes, the nearest
 * passing shade otherwise, or null when even black / white cannot reach `min`.
 */
export function ensureContrast(fg: string, bgs: readonly string[], min = 4.5): string | null {
  const start = normalizeHex(fg);
  if (minContrast(start, bgs) >= min) return start;
  const towardDark = minContrast('#000000', bgs) >= minContrast('#FFFFFF', bgs);
  const hsl = hexToHsl(start);
  for (let i = 1; i <= 50; i++) {
    const l = towardDark ? hsl.l - (hsl.l * i) / 50 : hsl.l + ((1 - hsl.l) * i) / 50;
    const c = hslToHex({ ...hsl, l });
    if (minContrast(c, bgs) >= min) return c;
  }
  const end = towardDark ? '#000000' : '#FFFFFF';
  return minContrast(end, bgs) >= min ? end : null;
}

// ---------------------------------------------------------------- palette

/** Small seeded PRNG (mulberry32); returns floats in [0,1). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type PaletteOptions = {
  /** Pixels with alpha below this are ignored (default 128). */
  minAlpha?: number;
  /** Max pixels sampled (evenly strided); default 4000. */
  maxSamples?: number;
  /** k-means iterations cap; default 12. */
  maxIterations?: number;
};

/**
 * Deterministic k-means lite over RGBA pixels. Returns clusters sorted by size (largest
 * first), with empty clusters dropped and identical centres merged, so fewer than `k`
 * colours may come back for images with few distinct colours.
 */
export function paletteClusters(
  pixels: Uint8Array | Uint8ClampedArray | number[],
  k: number,
  seed = 1,
  options: PaletteOptions = {},
): PaletteColour[] {
  const minAlpha = options.minAlpha ?? 128;
  const maxSamples = Math.max(1, options.maxSamples ?? 4000);
  const maxIterations = Math.max(1, options.maxIterations ?? 12);
  const total = Math.floor(pixels.length / 4);
  const kk = Math.max(1, Math.floor(k));
  if (total === 0) return [];

  // Sample opaque pixels with a fixed stride.
  const stride = Math.max(1, Math.floor(total / maxSamples));
  const pts: number[][] = [];
  for (let i = 0; i < total; i += stride) {
    const o = i * 4;
    if (pixels[o + 3] < minAlpha) continue;
    pts.push([pixels[o], pixels[o + 1], pixels[o + 2]]);
  }
  if (pts.length === 0) return [];

  const rand = seededRandom(seed);
  const d2 = (p: number[], q: number[]) => {
    const dr = p[0] - q[0];
    const dg = p[1] - q[1];
    const db = p[2] - q[2];
    return dr * dr + dg * dg + db * db;
  };

  // k-means++ initialisation (seeded).
  const centres: number[][] = [pts[Math.floor(rand() * pts.length)].slice()];
  const dist = pts.map((p) => d2(p, centres[0]));
  while (centres.length < kk) {
    let sum = 0;
    for (const v of dist) sum += v;
    if (sum === 0) break; // every point already coincides with a centre
    let r = rand() * sum;
    let idx = 0;
    for (; idx < dist.length - 1; idx++) {
      r -= dist[idx];
      if (r <= 0) break;
    }
    const c = pts[idx].slice();
    centres.push(c);
    for (let i = 0; i < pts.length; i++) dist[i] = Math.min(dist[i], d2(pts[i], c));
  }

  // Lloyd iterations.
  const assign = new Int32Array(pts.length);
  for (let iter = 0; iter < maxIterations; iter++) {
    let changed = iter === 0;
    for (let i = 0; i < pts.length; i++) {
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < centres.length; c++) {
        const d = d2(pts[i], centres[c]);
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      if (assign[i] !== best) {
        assign[i] = best;
        changed = true;
      }
    }
    const sums = centres.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < pts.length; i++) {
      const s = sums[assign[i]];
      s[0] += pts[i][0];
      s[1] += pts[i][1];
      s[2] += pts[i][2];
      s[3] += 1;
    }
    for (let c = 0; c < centres.length; c++) {
      const s = sums[c];
      if (s[3] > 0) centres[c] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]];
    }
    if (!changed) break;
  }

  const counts = new Map<string, number>();
  for (let i = 0; i < pts.length; i++) {
    const c = centres[assign[i]];
    const hex = rgbToHex({ r: c[0], g: c[1], b: c[2] });
    counts.set(hex, (counts.get(hex) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([hex, count]) => ({ hex, count, share: count / pts.length }))
    .sort((a, b) => b.count - a.count || (a.hex < b.hex ? -1 : a.hex > b.hex ? 1 : 0));
}

/** Palette colours (`#RRGGBB`) sorted by cluster size, largest first. */
export function paletteFromPixels(
  pixels: Uint8Array | Uint8ClampedArray | number[],
  k: number,
  seed = 1,
  options: PaletteOptions = {},
): string[] {
  return paletteClusters(pixels, k, seed, options).map((c) => c.hex);
}
