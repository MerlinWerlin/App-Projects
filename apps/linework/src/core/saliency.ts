// Main-subject estimate for the outline pipeline: which part of the photo is "the thing you want
// to trace" and which part is background. Runs on a small copy of the photo (~128 px).
//
// Method: Minimum Barrier Distance saliency (Zhang et al., ICCV 2015) from the image border on
// three opponent colour channels, plus a mild centre prior and any detected faces (expanded to
// head and shoulders). The map is thresholded (Otsu), cleaned to its main connected regions,
// hole-filled and softened into a 0..1 weight map.

import { boxBlur, otsu, resizePlane, type Plane } from './imgops.ts';
import type { Box } from './faceDetect.ts';

export type SubjectEstimate = {
  /** Soft subject weight 0..1 at (sw, sh). */
  weight: Plane;
  sw: number;
  sh: number;
  /** 0..1: how clearly a subject stands out from its background (0 = no clear subject). */
  clarity: number;
  /** Fraction of the image covered by the subject mask. */
  area: number;
};

function mbd(ch: Plane, w: number, h: number, D: Plane): void {
  const n = w * h;
  const U = new Float32Array(n);
  const L = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    D[i] = Infinity;
    U[i] = L[i] = ch[i];
  }
  for (let x = 0; x < w; x++) {
    D[x] = 0;
    D[(h - 1) * w + x] = 0;
  }
  for (let y = 0; y < h; y++) {
    D[y * w] = 0;
    D[y * w + w - 1] = 0;
  }
  const relax = (i: number, j: number) => {
    const v = ch[i];
    const u = U[j] > v ? U[j] : v;
    const l = L[j] < v ? L[j] : v;
    const c = u - l;
    if (c < D[i]) {
      D[i] = c;
      U[i] = u;
      L[i] = l;
    }
  };
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        relax(i, i - 1);
        relax(i, i - w);
      }
    }
    for (let y = h - 2; y >= 1; y--) {
      for (let x = w - 2; x >= 1; x--) {
        const i = y * w + x;
        relax(i, i + 1);
        relax(i, i + w);
      }
    }
  }
}

/**
 * @param rgb  small RGB planes (0..1) at (w, h)
 * @param faces face boxes in the small image's coordinates
 */
export function estimateSubject(r: Plane, g: Plane, b: Plane, w: number, h: number, faces: readonly Box[] = []): SubjectEstimate {
  const n = w * h;
  // Opponent colour channels, roughly perceptual weights.
  const c1 = new Float32Array(n), c2 = new Float32Array(n), c3 = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    c1[i] = 0.299 * r[i] + 0.587 * g[i] + 0.114 * b[i];
    c2[i] = (r[i] - g[i]) * 0.7;
    c3[i] = ((r[i] + g[i]) * 0.5 - b[i]) * 0.7;
  }
  const s = new Float32Array(n);
  const D = new Float32Array(n);
  for (const ch of [c1, c2, c3]) {
    // Light smoothing so single noisy pixels don't break barriers.
    const sm = boxBlur(ch, w, h, 1);
    mbd(sm, w, h, D);
    for (let i = 0; i < n; i++) s[i] += D[i];
  }
  // Centre prior (mild) and faces.
  const cx = w / 2, cy = h / 2;
  const sx = w * 0.45, sy = h * 0.45;
  let max = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const dx = (x - cx) / sx, dy = (y - cy) / sy;
      s[i] *= 0.6 + 0.4 * Math.exp(-(dx * dx + dy * dy));
    }
  }
  for (const f of faces) {
    // Head (with hair) and shoulders.
    const x0 = Math.max(0, Math.floor(f.x - 0.55 * f.w)), x1 = Math.min(w, Math.ceil(f.x + 1.55 * f.w));
    const y0 = Math.max(0, Math.floor(f.y - 0.6 * f.h)), y1 = Math.min(h, Math.ceil(f.y + 2.4 * f.h));
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = y * w + x;
      // Shoulders widen below the chin.
      const below = y > f.y + 1.25 * f.h;
      const left = below ? f.x - 1.1 * f.w : f.x - 0.55 * f.w;
      const right = below ? f.x + 2.1 * f.w : f.x + 1.55 * f.w;
      if (x >= left && x <= right) s[i] = Math.max(s[i], 1e9);
    }
    // The widened shoulder rows extend past x0..x1.
    const yb0 = Math.max(0, Math.floor(f.y + 1.25 * f.h)), yb1 = Math.min(h, Math.ceil(f.y + 2.4 * f.h));
    const xb0 = Math.max(0, Math.floor(f.x - 1.1 * f.w)), xb1 = Math.min(w, Math.ceil(f.x + 2.1 * f.w));
    for (let y = yb0; y < yb1; y++) for (let x = xb0; x < xb1; x++) s[y * w + x] = Math.max(s[y * w + x], 1e9);
  }
  // Normalise by a high percentile (robust to the face boost).
  const sorted = Float32Array.from(s).filter((v) => v < 1e8).sort();
  const p98 = sorted.length ? sorted[Math.floor(sorted.length * 0.98)] : 1;
  max = p98 > 1e-6 ? p98 : 1;
  for (let i = 0; i < n; i++) s[i] = Math.min(1, s[i] / max);

  const thr = Math.max(0.15, otsu(s));
  const mask = new Uint8Array(n);
  for (let i = 0; i < n; i++) mask[i] = s[i] >= thr ? 1 : 0;
  keepMainRegions(mask, s, w, h);
  fillHoles(mask, w, h);

  let inSum = 0, inN = 0, outSum = 0, outN = 0;
  for (let i = 0; i < n; i++) {
    if (mask[i]) { inSum += s[i]; inN++; } else { outSum += s[i]; outN++; }
  }
  const area = inN / n;
  const contrast = inN && outN ? inSum / inN - outSum / outN : 0;
  // A subject that is tiny or fills the frame isn't a useful "main subject".
  const areaOk = area < 0.02 ? area / 0.02 : area > 0.85 ? Math.max(0, (0.97 - area) / 0.12) : 1;
  const clarity = Math.max(0, Math.min(1, (contrast - 0.15) / 0.35)) * areaOk;

  // Soft weight: dilate by ~3% of the size and feather.
  const m = new Float32Array(n);
  for (let i = 0; i < n; i++) m[i] = mask[i];
  const rad = Math.max(1, Math.round(Math.max(w, h) * 0.04));
  const grown = boxBlur(m, w, h, rad);
  for (let i = 0; i < n; i++) grown[i] = grown[i] > 0.02 ? 1 : 0;
  const weight = boxBlur(grown, w, h, rad);
  // Also honour partial saliency (a saucer under a cup, wheels under a bike) instead of a hard cut.
  const soft = boxBlur(s, w, h, Math.max(1, rad >> 1));
  for (let i = 0; i < n; i++) {
    const t = Math.min(1, Math.max(0, (soft[i] - 0.12) / 0.4));
    const v = t * t * (3 - 2 * t);
    if (v > weight[i]) weight[i] = v;
  }
  return { weight, sw: w, sh: h, clarity, area };
}

/** Keeps the largest region plus any region whose mean saliency is close to the best one. */
function keepMainRegions(mask: Uint8Array, s: Plane, w: number, h: number): void {
  const n = w * h;
  const label = new Int32Array(n).fill(-1);
  const regions: { size: number; sum: number }[] = [];
  const stack = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    if (!mask[i] || label[i] >= 0) continue;
    const id = regions.length;
    let sp = 0, size = 0, sum = 0;
    stack[sp++] = i;
    label[i] = id;
    while (sp) {
      const p = stack[--sp];
      size++;
      sum += s[p];
      const x = p % w, y = (p / w) | 0;
      if (x > 0 && mask[p - 1] && label[p - 1] < 0) { label[p - 1] = id; stack[sp++] = p - 1; }
      if (x < w - 1 && mask[p + 1] && label[p + 1] < 0) { label[p + 1] = id; stack[sp++] = p + 1; }
      if (y > 0 && mask[p - w] && label[p - w] < 0) { label[p - w] = id; stack[sp++] = p - w; }
      if (y < h - 1 && mask[p + w] && label[p + w] < 0) { label[p + w] = id; stack[sp++] = p + w; }
    }
    regions.push({ size, sum });
  }
  if (!regions.length) return;
  const score = regions.map((r) => r.sum); // size x mean saliency
  const best = Math.max(...score);
  const keep = regions.map((r, k) => score[k] >= best * 0.25 && r.size >= n * 0.004);
  for (let i = 0; i < n; i++) if (mask[i] && !keep[label[i]]) mask[i] = 0;
}

/** Fills background pockets not connected to the border. */
function fillHoles(mask: Uint8Array, w: number, h: number): void {
  const n = w * h;
  const outside = new Uint8Array(n);
  const stack = new Int32Array(n);
  let sp = 0;
  const push = (i: number) => {
    if (!mask[i] && !outside[i]) { outside[i] = 1; stack[sp++] = i; }
  };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (sp) {
    const p = stack[--sp];
    const x = p % w, y = (p / w) | 0;
    if (x > 0) push(p - 1);
    if (x < w - 1) push(p + 1);
    if (y > 0) push(p - w);
    if (y < h - 1) push(p + w);
  }
  for (let i = 0; i < n; i++) if (!outside[i]) mask[i] = 1;
}

/** Upscales the subject weight to (w, h). */
export function subjectWeightAt(est: SubjectEstimate, w: number, h: number): Plane {
  return resizePlane(est.weight, est.sw, est.sh, w, h);
}
