/**
 * Generated texture geometry for remote themes (owner-1017 T56). Pure TS (no React Native), so the
 * shapes are unit-tested and RemoteTexture.tsx only turns them into react-native-svg elements.
 * Everything is maths: gradients, stripes and sine-wave grain. No images, no photos, no artwork.
 */

/** Deterministic 0..1 pseudo-random from an integer seed (mulberry32), so a texture never flickers. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface GrainLine {
  d: string;
  color: string;
  width: number;
  opacity: number;
}

/**
 * Woodgrain: gently wavy horizontal lines (sum of two sines), spaced down the card, cycling the
 * theme's colours. `w`/`h` in points.
 */
export function woodgrainLines(w: number, h: number, colors: readonly string[], seed = 1017): GrainLine[] {
  if (w <= 0 || h <= 0 || colors.length === 0) return [];
  const rnd = seeded(seed);
  const count = Math.max(6, Math.min(40, Math.round(h / 22)));
  const step = Math.max(8, Math.round(w / 24));
  const out: GrainLine[] = [];
  for (let i = 0; i < count; i++) {
    const y0 = ((i + 0.5) / count) * h;
    const a1 = 2 + rnd() * 5;
    const a2 = 1 + rnd() * 3;
    const f1 = 1 + rnd() * 1.5;
    const f2 = 3 + rnd() * 3;
    const ph = rnd() * Math.PI * 2;
    let d = '';
    for (let x = 0; x <= w + step; x += step) {
      const u = x / w;
      const y = y0 + a1 * Math.sin(u * Math.PI * 2 * f1 + ph) + a2 * Math.sin(u * Math.PI * 2 * f2 + ph * 1.7);
      d += `${d ? 'L' : 'M'}${Math.round(x * 10) / 10} ${Math.round(y * 10) / 10}`;
    }
    out.push({
      d,
      color: colors[i % colors.length] as string,
      width: Math.round((1 + rnd() * 4) * 10) / 10,
      opacity: Math.round((0.35 + rnd() * 0.5) * 100) / 100,
    });
  }
  return out;
}

/** Brushed metal: one stripe period (pt) and the two stripe heights within it. */
export const BRUSHED = { period: 3, line: 1 } as const;

/** Aurora drift loop (decoration only): period ms, translate px, opacity band. */
export const AURORA = { period: 16000, px: 18, min: 0.55, max: 1, still: 0.8, peak: 0.6 } as const;

/** Neon edge light stays inside this band (pt) from the card edge, under the card's 18 pt padding. */
export const NEON_EDGE = { band: 8 } as const;

/**
 * Strongest fraction of a texture colour painted at any point inside the card's padding, before the
 * theme's texture opacity: used by the contrast test (body text over the texture stays AA).
 * Neon draws only in the edge band, never under text.
 */
export function texturePeak(kind: string): number {
  if (kind === 'neon') return 0;
  if (kind === 'aurora') return AURORA.peak;
  return 1;
}
