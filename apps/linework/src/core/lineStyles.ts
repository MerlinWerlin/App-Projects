// Outline styles beyond the v2 "classic" engine (T49, owner feedback fb-1017 F3 "Better outlines").
//
//  - 'lineart' — a proper Canny pipeline: luma -> CLAHE-style local contrast normalisation ->
//    Gaussian smoothing -> Sobel gradients -> non-maximum suppression -> hysteresis with automatic
//    thresholds (Otsu on the gradient histogram of the NMS ridge, scaled by Detail) -> thinning ->
//    gap bridging -> speck removal -> anti-aliased strokes. Crisp, exact contours: objects,
//    buildings, lettering, anything with real edges.
//  - 'bold' — the same edges found at a coarser scale and drawn as dilated (thick) lines.
//  - 'sketch' — XDoG: a difference of Gaussians with a soft tanh threshold, after the same local
//    contrast normalisation. Soft, pencil-like lines that follow faces, fur and soft shading where an
//    edge detector draws double lines or nothing. Specks are dropped by connected-component size.
//
// Pure TS, O(pixels) per stage, chunked through the same generator protocol as `outlineSteps`.

import { gaussBlur, otsu, type Plane } from './imgops.ts';
import { dropShort, linkGaps, thin } from './thin.ts';
import { pruneSpurs, renderStrokes, smoothChain, traceChains, type Stroke } from './strokes.ts';
import type { OutlineOptions, RGBAImage } from './outline.ts';

export type StyleParams = {
  /** Gaussian sigma (px) before gradients / the inner XDoG sigma. */
  sigma: number;
  /** Multiplier on the automatic (Otsu) high threshold; lower = more edges. */
  highScale: number;
  /** Absolute gradient floor (Sobel magnitude) so flat or noisy areas never become lines. */
  floor: number;
  /** Speck removal: smallest component kept (px of 1-px line, or px of area for sketch). */
  minLen: number;
  /** Largest gap bridged between line ends (px). */
  gap: number;
  /** Stroke radius in px. */
  radius: number;
  /** CLAHE blend 0..1 and clip limit. */
  clahe: number;
  clip: number;
};

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Resolved parameters for a style at size w x h. */
export function styleParams(style: 'sketch' | 'lineart' | 'bold', opts: OutlineOptions, w: number, h: number): StyleParams {
  const detail = Number.isFinite(opts.detail) ? clamp01(opts.detail) : 0.5;
  const thick = Number.isFinite(opts.thickness) ? Math.min(8, Math.max(0.5, opts.thickness)) : 1.5;
  const smooth = clamp01(opts.smooth ?? 0);
  const u = Math.max(w, h) / 1024;
  let sigma: number, highScale: number, minLen: number, gap: number, radius: number;
  if (style === 'sketch') {
    sigma = lerp(2.0, 0.9, detail) * (1 + 0.5 * smooth);
    highScale = lerp(1.5, 0.55, detail); // tanh threshold, in units of the response RMS
    minLen = lerp(60, 12, detail);
    gap = 0;
    radius = thick / 2;
  } else if (style === 'bold') {
    sigma = Math.max(lerp(3.2, 1.8, detail), 0.45 * thick) * (1 + 0.5 * smooth);
    highScale = lerp(1.35, 0.7, detail);
    minLen = Math.max(lerp(40, 16, detail), 4 * thick);
    gap = lerp(10, 6, detail);
    radius = Math.max(1.5, thick / 2);
  } else {
    sigma = Math.max(lerp(2.2, 1.0, detail), 0.38 * thick) * (1 + 0.5 * smooth);
    highScale = lerp(1.3, 0.45, detail);
    minLen = Math.max(lerp(26, 6, detail), 3 * thick);
    gap = lerp(7, 3.5, detail);
    radius = thick / 2;
  }
  const sig = Math.max(0.7, sigma * u);
  return {
    sigma: sig,
    highScale,
    // A step of `delta` luma peaks at ~3.2 * delta / sigma in the smoothed Sobel magnitude.
    floor: (lerp(0.03, 0.012, detail) * 3.2) / Math.max(1, sig),
    minLen: Math.max(3, Math.round(minLen * u)),
    gap: gap * u,
    radius: radius * u,
    clahe: 0.6,
    clip: 2.5,
  };
}

/** Luma 0..1 composited over white paper. */
function luma(img: RGBAImage): Plane {
  const { data, width: w, height: h } = img;
  const n = w * h;
  const L = new Float32Array(n);
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const a = data[p + 3] / 255;
    L[i] = ((0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]) / 255) * a + (1 - a);
  }
  return L;
}

/**
 * CLAHE-style local contrast normalisation: per-tile clipped-histogram equalisation, bilinearly
 * interpolated between tile centres, blended with the input by `amount`. Faint edges in an
 * evenly lit region (a jaw line, a pale petal) get the same contrast as a busy background.
 */
export function clahe(L: Plane, w: number, h: number, amount = 0.6, clip = 2.5, bins = 64): Plane {
  const tx = Math.max(1, Math.min(8, Math.round(w / 48)));
  const ty = Math.max(1, Math.min(8, Math.round(h / 48)));
  const tw = w / tx, th = h / ty;
  // Cumulative mapping at the bin edges (bins + 1 per tile), interpolated inside a bin so the
  // mapping is continuous (a step mapping would turn grain into false edges).
  const B1 = bins + 1;
  const maps = new Float32Array(tx * ty * B1);
  const hist = new Float64Array(bins);
  for (let j = 0; j < ty; j++) {
    for (let k = 0; k < tx; k++) {
      hist.fill(0);
      const x0 = Math.floor(k * tw), x1 = Math.floor((k + 1) * tw);
      const y0 = Math.floor(j * th), y1 = Math.floor((j + 1) * th);
      let cnt = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          let b = (L[y * w + x] * bins) | 0;
          if (b >= bins) b = bins - 1; else if (b < 0) b = 0;
          hist[b]++;
          cnt++;
        }
      }
      if (!cnt) continue;
      const limit = Math.max(1, (clip * cnt) / bins);
      let excess = 0;
      for (let b = 0; b < bins; b++) if (hist[b] > limit) { excess += hist[b] - limit; hist[b] = limit; }
      const add = excess / bins;
      let acc = 0;
      const base = (j * tx + k) * B1;
      maps[base] = 0;
      for (let b = 0; b < bins; b++) {
        acc += hist[b] + add;
        maps[base + b + 1] = acc / cnt;
      }
    }
  }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    let fy = (y + 0.5) / th - 0.5;
    if (fy < 0) fy = 0;
    const j0 = Math.min(ty - 1, Math.floor(fy)), j1 = Math.min(ty - 1, j0 + 1);
    const ay = Math.min(1, fy - j0);
    for (let x = 0; x < w; x++) {
      let fx = (x + 0.5) / tw - 0.5;
      if (fx < 0) fx = 0;
      const k0 = Math.min(tx - 1, Math.floor(fx)), k1 = Math.min(tx - 1, k0 + 1);
      const ax = Math.min(1, fx - k0);
      const i = y * w + x;
      const v = L[i];
      let fb = v * bins;
      if (fb < 0) fb = 0; else if (fb > bins - 1e-4) fb = bins - 1e-4;
      const b = fb | 0, fr = fb - b;
      const at = (t: number) => maps[t + b] + (maps[t + b + 1] - maps[t + b]) * fr;
      const m00 = at((j0 * tx + k0) * B1), m01 = at((j0 * tx + k1) * B1);
      const m10 = at((j1 * tx + k0) * B1), m11 = at((j1 * tx + k1) * B1);
      const m = (m00 * (1 - ax) + m01 * ax) * (1 - ay) + (m10 * (1 - ax) + m11 * ax) * ay;
      out[i] = v + amount * (m - v);
    }
  }
  return out;
}

/**
 * Canny edges: Sobel on the smoothed plane, non-maximum suppression, automatic hysteresis
 * thresholds. Returns the 0/1 edge mask and the gradient magnitude (normalised to the ridge p99).
 */
export function cannyEdges(S: Plane, w: number, h: number, highScale: number, floor: number): { mask: Uint8Array; mag: Plane } {
  const n = w * h;
  const mag = new Float32Array(n);
  const dir = new Uint8Array(n);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const a = S[i - w - 1], b = S[i - w], c = S[i - w + 1];
      const d = S[i - 1], f = S[i + 1];
      const g = S[i + w - 1], hh = S[i + w], k = S[i + w + 1];
      const gx = c + 2 * f + k - a - 2 * d - g;
      const gy = g + 2 * hh + k - a - 2 * b - c;
      mag[i] = Math.sqrt(gx * gx + gy * gy);
      const ax = Math.abs(gx), ay = Math.abs(gy);
      // 0 = horizontal gradient (compare left/right), 2 = vertical, 1/3 = diagonals.
      dir[i] = ay <= ax * 0.4142 ? 0 : ay >= ax * 2.4142 ? 2 : (gx > 0) === (gy > 0) ? 1 : 3;
    }
  }
  // Non-maximum suppression. Weak ridges (grain, texture) are kept for the threshold statistics
  // so Otsu separates texture from edges, not strong edges from fainter real ones.
  const ridge = new Float32Array(n);
  const statFloor = floor * 0.25;
  let cand = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const m = mag[i];
      if (m < statFloor) continue;
      const d = dir[i];
      const o = d === 0 ? 1 : d === 2 ? w : d === 1 ? w + 1 : w - 1;
      // Ties: keep the first of a plateau only (>= on one side, > on the other).
      if (m < mag[i - o] || m <= mag[i + o]) continue;
      ridge[i] = m;
      cand++;
    }
  }
  const mask = new Uint8Array(n);
  if (!cand) return { mask, mag: ridge };
  // Automatic thresholds: Otsu on the ridge magnitudes, normalised by their 99th percentile.
  const vals = new Float32Array(cand);
  let max = 0;
  for (let i = 0, k = 0; i < n; i++) if (ridge[i] > 0) { vals[k++] = ridge[i]; if (ridge[i] > max) max = ridge[i]; }
  const HB = 256;
  const hist = new Uint32Array(HB);
  for (let k = 0; k < cand; k++) hist[Math.min(HB - 1, ((vals[k] / max) * HB) | 0)]++;
  let acc = 0, p99 = max;
  for (let b = 0; b < HB; b++) {
    acc += hist[b];
    if (acc >= cand * 0.99) { p99 = ((b + 1) / HB) * max; break; }
  }
  for (let k = 0; k < cand; k++) vals[k] = Math.min(1, vals[k] / p99);
  const t = otsu(vals, 64);
  const high = Math.max(floor * 1.6, t * p99 * highScale);
  const low = Math.max(floor, high * 0.4);
  const stack = new Int32Array(cand + 8);
  for (let s = 0; s < n; s++) {
    if (mask[s] || ridge[s] < high) continue;
    mask[s] = 1;
    let sp = 0;
    stack[sp++] = s;
    while (sp) {
      const p = stack[--sp];
      for (let dy = -w; dy <= w; dy += w) {
        for (let dx = -1; dx <= 1; dx++) {
          const q = p + dy + dx;
          if (q >= 0 && q < n && !mask[q] && ridge[q] >= low) { mask[q] = 1; stack[sp++] = q; }
        }
      }
    }
  }
  for (let i = 0; i < n; i++) ridge[i] = ridge[i] / p99;
  return { mask, mag: ridge };
}

/** Grayscale dilation (max filter) of a 0..255 plane with a square of radius r, in place. */
function maxFilter(a: Uint8Array, w: number, h: number, r: number): void {
  if (r < 1) return;
  const tmp = new Uint8Array(a.length);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let m = 0;
      const x0 = Math.max(0, x - r), x1 = Math.min(w - 1, x + r);
      for (let k = x0; k <= x1; k++) if (a[row + k] > m) m = a[row + k];
      tmp[row + x] = m;
    }
  }
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let m = 0;
      const y0 = Math.max(0, y - r), y1 = Math.min(h - 1, y + r);
      for (let k = y0; k <= y1; k++) if (tmp[k * w + x] > m) m = tmp[k * w + x];
      a[y * w + x] = m;
    }
  }
}

/**
 * Speck removal on a coverage plane: drops inked components (alpha >= `on`) smaller than
 * `minArea` pixels, and faint pixels (alpha < `on`) that do not touch a kept component.
 * Returns the number of components removed.
 */
export function removeSpecks(cov: Uint8Array, w: number, h: number, minArea: number, on = 32): number {
  const n = w * h;
  const mask = new Uint8Array(n);
  let before = 0;
  for (let i = 0; i < n; i++) if (cov[i] >= on) { mask[i] = 1; before++; }
  const kept = dropShort(mask, w, h, minArea);
  let removed = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!cov[i] || mask[i]) continue;
      if (cov[i] >= on) { cov[i] = 0; removed++; continue; }
      let touch = 0;
      for (let dy = -1; dy <= 1 && !touch; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx >= 0 && xx < w && mask[yy * w + xx]) { touch = 1; break; }
        }
      }
      if (!touch) cov[i] = 0;
    }
  }
  return before === kept ? 0 : removed;
}

function toRGBA(cov: Uint8Array, w: number, h: number, opts: OutlineOptions): RGBAImage {
  const col = opts.invert ? [255, 255, 255] : (opts.lineColor ?? [34, 32, 28]);
  const cb = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(255, Math.round(v))) : 0);
  const r = cb(col[0]), g = cb(col[1]), b = cb(col[2]);
  const n = w * h;
  const out = new Uint8ClampedArray(n * 4);
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const a = cov[i];
    if (!a) continue;
    out[p] = r; out[p + 1] = g; out[p + 2] = b; out[p + 3] = a;
  }
  return { data: out, width: w, height: h };
}

/** Canny-based 'lineart' and 'bold' styles. */
function* cannySteps(img: RGBAImage, opts: OutlineOptions, style: 'lineart' | 'bold'): Generator<number, RGBAImage> {
  const w = img.width, h = img.height, n = w * h;
  const P = styleParams(style, opts, w, h);
  const L = luma(img);
  yield 0.1;
  const C = clahe(L, w, h, P.clahe, P.clip);
  yield 0.25;
  const S = gaussBlur(C, w, h, P.sigma);
  yield 0.4;
  // Grain (amplified by CLAHE in flat areas) must never pass the floor.
  // Sobel of blurred grain of std n peaks around ~6 n / sigma at NMS maxima.
  const floor = Math.max(P.floor, (6 * noiseLevel(C, w, h)) / Math.max(1, P.sigma));
  const { mask, mag } = cannyEdges(S, w, h, P.highScale, floor);
  yield 0.6;
  thin(mask, w, h);
  linkGaps(mask, w, h, P.gap);
  yield 0.72;
  dropShort(mask, w, h, P.minLen);
  yield 0.8;
  let chains = traceChains(mask, w, h);
  chains = pruneSpurs(chains, mask, w, h, Math.max(3, Math.round(P.minLen * 0.5)));
  const strokes: Stroke[] = [];
  const passes = Math.max(1, Math.round(1 + 2 * P.radius));
  for (const c of chains) {
    let sum = 0;
    for (const i of c) sum += mag[i];
    const { xs, ys } = smoothChain(c, w, Math.min(passes, Math.max(1, (c.length / 3) | 0)));
    strokes.push({ xs, ys, strength: clamp01(sum / c.length) });
  }
  const cov = new Uint8Array(n);
  renderStrokes(strokes, cov, w, h, P.radius, style === 'bold' ? 0.25 : 0);
  yield 0.95;
  const out = toRGBA(cov, w, h, opts);
  yield 1;
  return out;
}

/**
 * Robust grain estimate (std of pixel noise, luma units) from the median absolute difference of
 * horizontal neighbours on a sparse sample: edges are rare, so the median ignores them.
 */
export function noiseLevel(L: Plane, w: number, h: number): number {
  if (w < 3 || h < 1) return 0;
  const step = Math.max(1, Math.floor((w * h) / 40000));
  const HB = 512;
  const hist = new Uint32Array(HB);
  let cnt = 0;
  for (let i = 0; i + 1 < w * h; i += step) {
    if ((i % w) === w - 1) continue;
    const d = Math.abs(L[i + 1] - L[i]);
    hist[Math.min(HB - 1, (d * 2048) | 0)]++;
    cnt++;
  }
  let acc = 0;
  for (let b = 0; b < HB; b++) {
    acc += hist[b];
    if (acc * 2 >= cnt) return ((b + 0.5) / 2048) * 1.4826 / Math.SQRT2;
  }
  return HB / 2048;
}

/**
 * Low-light XDoG sigma (T78). In a dim, flat photo the sensor grain is large next to the
 * picture's own contrast and CLAHE stretches both, so a fine DoG turns the grain into a field of
 * dark specks. The DoG of white grain falls as ~1 / sigma while a real step keeps its peak, so
 * when grain / contrast (`nl` over the luma std `sd`, before CLAHE) is above 0.25 the sigma grows,
 * up to 2x. Ordinary photos sit far below (clean ~0.05, even the heavy-grain "noisy shapes"
 * fixture ~0.2), so they are unchanged.
 */
export function lowLightSigma(sigma: number, nl: number, sd: number): number {
  const r = sd > 0 ? nl / sd : 0;
  return sigma * (1 + Math.min(1, Math.max(0, (r - 0.25) / 0.2)));
}

/** Standard deviation of a plane. */
function planeStd(L: Plane): number {
  let s = 0, q = 0;
  for (let i = 0; i < L.length; i++) { s += L[i]; q += L[i] * L[i]; }
  const m = L.length ? s / L.length : 0;
  return L.length ? Math.sqrt(Math.max(0, q / L.length - m * m)) : 0;
}

/** XDoG 'sketch' style. */
function* sketchSteps(img: RGBAImage, opts: OutlineOptions): Generator<number, RGBAImage> {
  const w = img.width, h = img.height, n = w * h;
  const P = styleParams('sketch', opts, w, h);
  const L = luma(img);
  yield 0.1;
  const C = clahe(L, w, h, P.clahe, P.clip);
  yield 0.25;
  const nl = noiseLevel(C, w, h);
  const sigma = lowLightSigma(P.sigma, noiseLevel(L, w, h), planeStd(L));
  const g1 = gaussBlur(C, w, h, sigma);
  yield 0.4;
  const g2 = gaussBlur(C, w, h, sigma * 1.6);
  yield 0.55;
  // Dark-side DoG response: positive where a pixel is darker than its surroundings.
  const tau = 0.985;
  let ss = 0, cnt = 0;
  for (let i = 0; i < n; i++) {
    const d = tau * g2[i] - g1[i];
    g1[i] = d;
    if (d > 0) { ss += d * d; cnt++; }
  }
  const rms = cnt ? Math.sqrt(ss / cnt) : 0;
  // Never scale up noise or grain: the soft threshold sits at least this far above zero.
  const unit = Math.max(rms, 0.004, 0.3 * nl);
  const eps = P.highScale * unit;
  const phi = 2.2 / unit;
  const cov = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const d = g1[i];
    if (d <= eps * 0.5 || d < 0.004) continue;
    // Soft tanh ramp from half the threshold upward.
    const a = Math.tanh(phi * (d - eps * 0.5));
    cov[i] = a <= 0 ? 0 : Math.round(255 * Math.min(1, a));
  }
  yield 0.75;
  // Line weight: grayscale dilation beyond the base width the sigma already gives.
  maxFilter(cov, w, h, Math.round((P.radius - 0.75) * 0.9));
  yield 0.85;
  removeSpecks(cov, w, h, P.minLen);
  yield 0.95;
  const out = toRGBA(cov, w, h, opts);
  yield 1;
  return out;
}

/** Chunked generator for a non-classic style. */
export function* styleSteps(img: RGBAImage, opts: OutlineOptions, style: 'sketch' | 'lineart' | 'bold'): Generator<number, RGBAImage> {
  if (style === 'sketch') return yield* sketchSteps(img, opts);
  return yield* cannySteps(img, opts, style);
}
