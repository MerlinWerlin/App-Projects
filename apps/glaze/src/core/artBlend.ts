// T251 (owner-1101h #2): widget art BLENDS with the wallpaper on every theme. No frame, no box, no
// halo. Owner: Alpine Starlight's white full moon showed a light-grey frame round a black square
// (the old blurred-copy background) and the red blood moon sat on a dark box with a glow edge.
//
// Rule: art whose background is plain (black / near-black / one flat colour) is KEYED: alpha from
// the distance to that background colour with a soft threshold, the colour un-mixed from the key so
// no dark fringe stays (keyAlpha + unmix). Art whose edges are busy (a painted scene) is FEATHERED:
// its edges fade to transparent over a band of the short side (featherAlpha). Either way the art
// then sits on the wallpaper crop under the widget (or the wallpaper-sampled colour), so the moon
// floats in the same sky. Art that already has a transparent edge is left alone.
//
// The same maths runs in three places (keep them in step; artBlend.test.ts pins the constants):
//   - here (pure, tested; decides and previews);
//   - modules/glaze-widget-bridge/ios/GlazeWidgetBridgeModule.swift `GlazeArtBlend` (the phone, at
//     "Use on my widget" time, for packs that still ship opaque art);
//   - scripts/packs/blend-audit.py (contact sheets + `--fix`, which writes keyed / feathered PNGs for
//     the pack build so the shipped files are already transparent).
//
// Pure TS (Node runs it directly). No React Native imports.

/** 0-255 sRGB triple. */
export type Rgb = readonly [number, number, number];

/** Edge ring thickness: this share of the short side, at least RING_MIN_PX. */
export const BLEND_RING_SHARE = 0.03;
export const BLEND_RING_MIN_PX = 2;
/** At least this share of the edge ring transparent (alpha < 128) = already transparent art. */
export const BLEND_TRANSPARENT_SHARE = 0.5;
/** An edge pixel within this RGB distance (0-441) of the edge median counts as "the background". */
export const BLEND_KEY_NEAR = 20;
/** Keyed only when at least this share of the opaque edge ring is the background colour… */
export const BLEND_KEY_MIN_UNIFORM = 0.95;
/** …and the ring's mean channel standard deviation is at most this (a plain, flat background). */
export const BLEND_KEY_MAX_SPREAD = 10;
/** Key thresholds: alpha 0 up to lo = BASE + spread, rising smoothly to 1 at lo + SOFT. */
export const BLEND_KEY_LO_BASE = 16;
export const BLEND_KEY_SOFT = 48;
/** Keying must leave at least this share of the image opaque (else the subject is the background colour too: feather). */
export const BLEND_MIN_SUBJECT = 0.03;
/** Feather band for busy art: this share of the short side fades from transparent to opaque. */
export const BLEND_FEATHER_SHARE = 0.14;
/** Keyed art also gets a thin feather so a subject touching the image edge has no hard cut. */
export const BLEND_KEY_EDGE_FEATHER_SHARE = 0.04;
/**
 * Interior hold (keyed art): the background is the key-alpha < BLEND_KEY_BG_ALPHA region connected to
 * the image border (4-connected flood fill). A pixel farther than BLEND_KEY_RIM_SHARE of the short
 * side from that background is inside the subject, so a dim part of it (the blood moon's dark limb,
 * key alpha between HOLD_LO and HOLD_HI and up) is held opaque instead of letting stars through.
 * Pure key-colour holes inside the subject (a clock dial, a ring gap) stay transparent.
 */
export const BLEND_KEY_BG_ALPHA = 0.5;
export const BLEND_KEY_RIM_SHARE = 0.02;
export const BLEND_KEY_HOLD_LO = 0.05;
export const BLEND_KEY_HOLD_HI = 0.3;
/** Audit: an opaque edge this far (RGB) from the wallpaper under the widget shows as a box if drawn raw. */
export const BLEND_BOX_DISTANCE = 28;

export type ArtEdgeStats = {
  width: number;
  height: number;
  /** Edge ring thickness used (px). */
  ring: number;
  /** Share of edge-ring pixels with alpha < 128. */
  transparentShare: number;
  /** Per-channel median of the opaque edge ring (the background colour candidate). */
  key: Rgb;
  /** Mean of the three channel standard deviations of the opaque edge ring. */
  spread: number;
  /** Share of the opaque edge ring within BLEND_KEY_NEAR of `key`. */
  uniformShare: number;
  /** Share of ALL pixels that are opaque and farther than the key's `hi` threshold from `key`. */
  subjectShare: number;
};

export type BlendDecision =
  | { mode: 'transparent' }
  | { mode: 'key'; key: Rgb; lo: number; hi: number; band: number; boxDistance: number | null }
  | { mode: 'feather'; band: number; edge: Rgb; boxDistance: number | null };

export type BlendMode = BlendDecision['mode'];

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
const fin = (v: number, d = 0): number => (Number.isFinite(v) ? v : d);

/** Euclidean RGB distance (0-441.7). */
export function rgbDistance(a: Rgb, b: Rgb): number {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/** Hermite smoothstep: 0 at or below e0, 1 at or above e1. */
export function smoothstep(e0: number, e1: number, x: number): number {
  if (!(e1 > e0)) return x >= e1 ? 1 : 0;
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** The key's soft threshold for an edge ring of `spread`. */
export function keyThresholds(spread: number): { lo: number; hi: number } {
  const lo = BLEND_KEY_LO_BASE + Math.max(0, fin(spread));
  return { lo, hi: lo + BLEND_KEY_SOFT };
}

/** Key alpha (0-1) of a pixel at RGB distance `dist` from the key colour. */
export function keyAlpha(dist: number, lo: number, hi: number): number {
  return smoothstep(lo, hi, fin(dist));
}

/**
 * The foreground colour of a pixel `c` that is `a` of something over the key: c = a·fg + (1-a)·key,
 * so fg = key + (c - key) / a, clamped. Removes the dark (or light) fringe a plain key leaves.
 */
export function unmix(c: Rgb, key: Rgb, a: number): Rgb {
  if (!(a > 1 / 255)) return [0, 0, 0];
  const ch = (i: 0 | 1 | 2) => Math.round(clamp(key[i] + (c[i] - key[i]) / a, 0, 255));
  return [ch(0), ch(1), ch(2)];
}

/** Feather alpha (0-1) of pixel (x, y) in a w×h image with a band of `bandPx`. */
export function featherAlpha(x: number, y: number, w: number, h: number, bandPx: number): number {
  const e = Math.min(x + 0.5, y + 0.5, w - x - 0.5, h - y - 0.5);
  return smoothstep(0, Math.max(1, bandPx), e);
}

/** Lower median of a 256-bin histogram holding n values. */
function histMedian(hist: Uint32Array, n: number): number {
  const half = Math.ceil(n / 2);
  let cum = 0;
  for (let v = 0; v < 256; v++) {
    cum += hist[v];
    if (cum >= half) return v;
  }
  return 0;
}

/** Edge-ring thickness for a w×h image. */
export function ringWidth(w: number, h: number): number {
  return Math.max(BLEND_RING_MIN_PX, Math.round(Math.min(w, h) * BLEND_RING_SHARE));
}

/**
 * Measure an art piece. `rgba` is straight (not premultiplied) RGBA, row-major, w×h. The edge ring
 * is the outer ringWidth px on all four sides.
 */
export function measureArtEdges(rgba: ArrayLike<number>, w: number, h: number): ArtEdgeStats {
  const W = Math.max(0, Math.floor(fin(w)));
  const H = Math.max(0, Math.floor(fin(h)));
  const r = ringWidth(W, H);
  const hist = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
  const sum = [0, 0, 0];
  const sq = [0, 0, 0];
  let ringTotal = 0;
  let transparent = 0;
  let opaque = 0;
  const inRing = (x: number, y: number) => x < r || y < r || x >= W - r || y >= H - r;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!inRing(x, y)) continue;
      const i = (y * W + x) * 4;
      ringTotal++;
      if (rgba[i + 3] < 128) {
        transparent++;
        continue;
      }
      opaque++;
      for (let c = 0; c < 3; c++) {
        const v = rgba[i + c];
        hist[c][v]++;
        sum[c] += v;
        sq[c] += v * v;
      }
    }
  }
  const key: Rgb = opaque ? [histMedian(hist[0], opaque), histMedian(hist[1], opaque), histMedian(hist[2], opaque)] : [0, 0, 0];
  let spread = 0;
  if (opaque) {
    for (let c = 0; c < 3; c++) {
      const m = sum[c] / opaque;
      spread += Math.sqrt(Math.max(0, sq[c] / opaque - m * m));
    }
    spread /= 3;
  }
  const { hi } = keyThresholds(spread);
  let near = 0;
  let subject = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (rgba[i + 3] < 128) continue;
      const d = rgbDistance([rgba[i], rgba[i + 1], rgba[i + 2]], key);
      if (inRing(x, y) && d <= BLEND_KEY_NEAR) near++;
      if (d > hi) subject++;
    }
  }
  return {
    width: W,
    height: H,
    ring: r,
    transparentShare: ringTotal ? transparent / ringTotal : 1,
    key,
    spread,
    uniformShare: opaque ? near / opaque : 0,
    subjectShare: W * H ? subject / (W * H) : 0,
  };
}

/**
 * T251: what to do with an art piece before it goes on the wallpaper.
 *   transparent: its edge is already see-through; draw it as is.
 *   key:         plain background (near-black / flat): key it out (soft threshold + un-mix) and
 *                feather the outermost few % so nothing is cut hard.
 *   feather:     a busy painted background: fade its edges into what is under it.
 * `wallpaper` is the mean colour of the wallpaper under the widget (null when unknown); it only
 * feeds `boxDistance` (how visible a raw box would be, for the audit), never the mode.
 */
export function decideArtBlend(stats: ArtEdgeStats, wallpaper: Rgb | null = null): BlendDecision {
  if (!(stats.transparentShare < BLEND_TRANSPARENT_SHARE)) return { mode: 'transparent' };
  const box = wallpaper ? Math.round(rgbDistance(stats.key, wallpaper) * 10) / 10 : null;
  const { lo, hi } = keyThresholds(stats.spread);
  if (stats.spread <= BLEND_KEY_MAX_SPREAD && stats.uniformShare >= BLEND_KEY_MIN_UNIFORM && stats.subjectShare >= BLEND_MIN_SUBJECT) {
    return { mode: 'key', key: stats.key, lo, hi, band: BLEND_KEY_EDGE_FEATHER_SHARE, boxDistance: box };
  }
  return { mode: 'feather', band: BLEND_FEATHER_SHARE, edge: stats.key, boxDistance: box };
}

/**
 * The keyed background: 1 where key alpha `t` < BLEND_KEY_BG_ALPHA AND the pixel is 4-connected to
 * the image border through such pixels (flood fill from the border), else 0.
 */
export function keyBackground(t: ArrayLike<number>, w: number, h: number): Uint8Array {
  const bg = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let head = 0;
  let tail = 0;
  const seed = (i: number) => {
    if (!bg[i] && t[i] < BLEND_KEY_BG_ALPHA) {
      bg[i] = 1;
      queue[tail++] = i;
    }
  };
  for (let x = 0; x < w; x++) {
    seed(x);
    seed((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    seed(y * w);
    seed(y * w + w - 1);
  }
  while (head < tail) {
    const i = queue[head++];
    const x = i % w;
    if (x > 0) seed(i - 1);
    if (x < w - 1) seed(i + 1);
    if (i >= w) seed(i - w);
    if (i < (h - 1) * w) seed(i + w);
  }
  return bg;
}

/** Chamfer (3-4) distance in px from every pixel to the nearest `mask` pixel (Infinity when none). */
export function chamferDistance(mask: ArrayLike<number>, w: number, h: number): Float64Array {
  const d = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) d[i] = mask[i] ? 0 : Infinity;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let v = d[i];
      if (x > 0) v = Math.min(v, d[i - 1] + 3);
      if (y > 0) {
        v = Math.min(v, d[i - w] + 3);
        if (x > 0) v = Math.min(v, d[i - w - 1] + 4);
        if (x < w - 1) v = Math.min(v, d[i - w + 1] + 4);
      }
      d[i] = v;
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      let v = d[i];
      if (x < w - 1) v = Math.min(v, d[i + 1] + 3);
      if (y < h - 1) {
        v = Math.min(v, d[i + w] + 3);
        if (x < w - 1) v = Math.min(v, d[i + w + 1] + 4);
        if (x > 0) v = Math.min(v, d[i + w - 1] + 4);
      }
      d[i] = v;
    }
  }
  for (let i = 0; i < w * h; i++) d[i] /= 3;
  return d;
}

/** Final key alpha with the interior hold (see BLEND_KEY_RIM_SHARE). */
export function heldKeyAlpha(t: number, distToBg: number, rimPx: number): number {
  const hold = smoothstep(rimPx * 0.5, rimPx, distToBg) * smoothstep(BLEND_KEY_HOLD_LO, BLEND_KEY_HOLD_HI, t);
  return Math.max(t, hold);
}

/**
 * Apply a decision to straight RGBA pixels (returns a new straight RGBA array). Mirrors the bridge's
 * GlazeArtBlend.blended and blend-audit.py `apply_blend`.
 */
export function applyArtBlend(rgba: ArrayLike<number>, w: number, h: number, d: BlendDecision): Uint8ClampedArray {
  const W = Math.max(0, Math.floor(w));
  const H = Math.max(0, Math.floor(h));
  const out = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H * 4; i++) out[i] = rgba[i];
  if (d.mode === 'transparent') return out;
  const bandPx = d.band * Math.min(W, H);
  let t: Float64Array | null = null;
  let toBg: Float64Array | null = null;
  if (d.mode === 'key') {
    t = new Float64Array(W * H);
    for (let p = 0; p < W * H; p++) t[p] = keyAlpha(rgbDistance([rgba[p * 4], rgba[p * 4 + 1], rgba[p * 4 + 2]], d.key), d.lo, d.hi);
    toBg = chamferDistance(keyBackground(t, W, H), W, H);
  }
  const rimPx = BLEND_KEY_RIM_SHARE * Math.min(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      let c: Rgb = [rgba[i], rgba[i + 1], rgba[i + 2]];
      let a = rgba[i + 3] / 255;
      if (d.mode === 'key' && t && toBg) {
        const k = heldKeyAlpha(t[y * W + x], toBg[y * W + x], rimPx);
        c = unmix(c, d.key, k);
        a *= k;
      }
      a *= featherAlpha(x, y, W, H, bandPx);
      out[i] = c[0];
      out[i + 1] = c[1];
      out[i + 2] = c[2];
      out[i + 3] = Math.round(a * 255);
    }
  }
  return out;
}

/** Rec. 709 luma of a colour (0-255). */
export function luma(c: Rgb): number {
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

// ------------------------------------------------------------------ in-app preview

/**
 * How the Widgets tab preview approximates a blend without reading pixels: `screen` drops a dark
 * key (black adds nothing), `multiply` a light one, `feather` masks the edges (SVG gradient mask),
 * `none` draws the art as is.
 */
export type PreviewBlend = 'none' | 'screen' | 'multiply' | 'feather';

export function previewBlend(d: BlendDecision): PreviewBlend {
  if (d.mode === 'transparent') return 'none';
  if (d.mode === 'feather') return 'feather';
  return luma(d.key) < 128 ? 'screen' : 'multiply';
}

/**
 * Production pieces measured by scripts/packs/blend-audit.py (glaze-packs-v1, 1 Nov 2026), keyed
 * `<themeId>/<optionId>`: the plain-background ones are keyed (dark key → `screen`). Every other
 * opaque remote piece measured `feather`; bundled art-pack heroes are already transparent.
 */
export const KNOWN_ART_BLEND: Readonly<Record<string, PreviewBlend>> = Object.freeze({
  'alpine-starlight/constellation-clock': 'screen',
  'alpine-starlight/copper-eclipse': 'screen',
  'alpine-starlight/jupiter-polar': 'screen',
  'alpine-starlight/saturn-rings': 'screen',
  'alpine-starlight/silver-moon': 'screen',
  'alpine-starlight/spiral-galaxy': 'screen',
});

/**
 * The preview blend for a piece: a measured production piece, else `none` for art known to be
 * transparent (bundled heroes, or a pack that says so), else `feather` (the safe default for an
 * opaque piece: its edges fade, never a box).
 */
export function previewBlendFor(themeId: string, optionId: string, knownTransparent: boolean): PreviewBlend {
  if (knownTransparent) return 'none';
  return KNOWN_ART_BLEND[`${themeId}/${optionId}`] ?? 'feather';
}

/** Luminance-mask colours of the preview's feather (SVG masks: white shows, black hides). Not UI chrome. */
export const FEATHER_MASK_SHOW = '#FFFFFF';
export const FEATHER_MASK_HIDE = '#000000';

/** The four gradient stops (0-1 offsets) of a feather mask with a band of `share` of the side. */
export function featherStops(share: number = BLEND_FEATHER_SHARE): [number, number, number, number] {
  const s = clamp(fin(share, BLEND_FEATHER_SHARE), 0, 0.5);
  return [0, s, 1 - s, 1];
}
