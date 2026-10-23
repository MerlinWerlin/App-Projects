// Outline mode (PLAN §2.3, §5): turns a photo into clean, traceable line art on the device.
//
// Why not a plain edge filter: a gradient edge detector with one global threshold (the v1 design)
// spends its line budget on the strongest edges in the picture — usually a busy background — so
// faint but important features (eyes, lips, jaw, the chin against the neck) vanish, and raising
// "detail" only adds noise. Thick lines were made by dilating everything, which merged features.
//
// v2 pipeline (all pure TS, O(pixels) per stage):
//  1. Analysis on a small copy: frontal faces (LBP cascade, faceDetect.ts), main subject vs
//     background (saliency.ts), and the photo kind (portrait / drawing / photo) when 'auto'.
//  2. Edge-preserving smoothing (guided filter): removes skin pores, fur noise and JPEG grain
//     while keeping real edges. Skin (colour model taken from the detected face) is smoothed more.
//  3. Line response = Difference of Gaussians on the dark side ("ink goes where it's darker than
//     its surroundings"): a thin dark feature gives ONE line (no double edges around eyelids or
//     lips), a boundary gives a line on its darker side. A second, finer scale adds detail as
//     the Detail slider rises (hair strands, folds, texture), mostly inside the subject.
//  4. Local contrast normalisation: each response is compared with the activity around it, so
//     a soft jaw line in an even-lit face competes with its neighbours, not with a high-contrast
//     background. Faces get an extra boost; background gets the Background-mode weight.
//  5. Hysteresis threshold -> thinning to 1-px centre lines -> removal of short strays
//     (strokes inside faces are kept: eyes and nostrils are short).
//  6. Rendering: anti-aliased round strokes whose width follows the Line thickness setting, with
//     optional taper (strong outlines bold, fine inner details thinner so they don't merge).
//     Lines are extracted at a scale that grows with the line width, so thick lines stay clean.
//
// Output: line pixels in `lineColor` (or white when `invert`), alpha = coverage (anti-aliased),
// on a fully transparent background, so the result sits on top of the camera feed.

import { boxBlur, gaussBlur, guidedFilter, guidedSize, resizePlane, type Plane } from './imgops.ts';
import { detectFaces, type Box, type Face } from './faceDetect.ts';
import { estimateSubject, subjectWeightAt, type SubjectEstimate } from './saliency.ts';
import { dropShort, linkGaps, thin } from './thin.ts';
import { pruneSpurs, renderStrokes, smoothChain, traceChains, type Stroke } from './strokes.ts';
import { styleSteps } from './lineStyles.ts';

export type RGBAImage = { data: Uint8ClampedArray | Uint8Array; width: number; height: number };

/** What kind of picture this is; 'auto' detects portraits and drawings. */
export type PhotoKind = 'auto' | 'portrait' | 'pet' | 'object' | 'landscape' | 'drawing';
/** How much background to keep: only the main subject, a soft hint of it, or everything. */
export type BackgroundMode = 'subject' | 'soft' | 'all';
/**
 * Line engine (T49): 'classic' = the v2 pipeline below (face/subject aware); 'lineart' = Canny,
 * 'bold' = Canny drawn as dilated lines, 'sketch' = XDoG soft lines (see lineStyles.ts).
 * The non-classic styles trace the whole picture and ignore `kind` / `background`.
 */
export type OutlineStyle = 'classic' | 'sketch' | 'lineart' | 'bold';

export type OutlineOptions = {
  /** 0..1, higher = more lines: 0 keeps the main shapes, 1 adds hair strands, folds, texture. */
  detail: number;
  /** Line width in px for a 1024 px image (scaled for other sizes), 0.5..8. */
  thickness: number;
  /** true = white lines (for dark paper) instead of `lineColor`. */
  invert: boolean;
  /** Default 'classic'. */
  style?: OutlineStyle;
  /** Default 'auto'. */
  kind?: PhotoKind;
  /** Default 'soft'. */
  background?: BackgroundMode;
  /** 0..1: how much fine details thin out relative to strong outlines. Default 0.35. */
  taper?: number;
  /** 0..1 extra smoothing before lines are found (simpler, calmer result). Default 0. */
  smooth?: number;
  /** Line colour for invert = false. Default [34, 32, 28] (warm near-black ink). */
  lineColor?: [number, number, number];
  /** Precomputed analysis (from `analyze`) so slider changes skip face/subject detection. */
  analysis?: Analysis;
};

export type Analysis = {
  width: number;
  height: number;
  /** Faces in full-image coordinates, largest first. */
  faces: Face[];
  subject: SubjectEstimate;
  /** Kind chosen for 'auto'. */
  autoKind: Exclude<PhotoKind, 'auto'>;
};

export const THICKNESS_MIN = 0.5;
export const THICKNESS_MAX = 8;

const DEFAULT_LINE: [number, number, number] = [34, 32, 28];
/** Long edge of the copy used for face detection. */
const FACE_PX = 288;
/** Long edge of the copy used for subject estimation. */
const SUBJECT_PX = 128;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function clampByte(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
}

function validate(img: RGBAImage): void {
  const { width: w, height: h, data } = img;
  if (!Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1) {
    throw new RangeError(`outline: width and height must be integers >= 1 (got ${w}x${h})`);
  }
  if (!data || data.length !== w * h * 4) {
    throw new RangeError(`outline: data length ${data ? data.length : 'missing'} != ${w}*${h}*4`);
  }
}

/** Luma 0..1 composited over white paper. */
function lumaPlane(img: RGBAImage): Plane {
  const { data, width: w, height: h } = img;
  const n = w * h;
  const L = new Float32Array(n);
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const a = data[p + 3] / 255;
    const l = (0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]) / 255;
    L[i] = l * a + (1 - a);
  }
  return L;
}

function smallSize(w: number, h: number, long: number): [number, number] {
  const s = Math.min(1, long / Math.max(w, h));
  return [Math.max(1, Math.round(w * s)), Math.max(1, Math.round(h * s))];
}

/** Share of near-flat pixels and of very dark thin strokes: high for drawings and cartoons. */
function looksLikeDrawing(L: Plane, w: number, h: number): boolean {
  const n = w * h;
  let flat = 0, dark = 0, light = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const g = Math.abs(L[i + 1] - L[i - 1]) + Math.abs(L[i + w] - L[i - w]);
      if (g < 0.01) flat++;
      if (L[i] < 0.25) dark++;
      if (L[i] > 0.85) light++;
    }
  }
  return flat / n > 0.55 && light / n > 0.45 && dark / n < 0.25;
}

/** One-pass area-average downsample of RGBA (over white) to RGB planes 0..1. */
function downsampleRGB(img: RGBAImage, dw: number, dh: number): [Plane, Plane, Plane] {
  const { data, width: w, height: h } = img;
  const n = dw * dh;
  const r = new Float32Array(n), g = new Float32Array(n), b = new Float32Array(n), c = new Float32Array(n);
  const bx = new Int32Array(w);
  for (let x = 0; x < w; x++) bx[x] = Math.min(dw - 1, Math.floor((x * dw) / w));
  for (let y = 0, p = 0; y < h; y++) {
    const row = Math.min(dh - 1, Math.floor((y * dh) / h)) * dw;
    for (let x = 0; x < w; x++, p += 4) {
      const i = row + bx[x];
      const a = data[p + 3] / 255;
      const wa = (1 - a) * 255;
      r[i] += data[p] * a + wa;
      g[i] += data[p + 1] * a + wa;
      b[i] += data[p + 2] * a + wa;
      c[i] += 255;
    }
  }
  for (let i = 0; i < n; i++) {
    const k = c[i] > 0 ? 1 / c[i] : 0;
    r[i] *= k; g[i] *= k; b[i] *= k;
  }
  return [r, g, b];
}

/** Face, subject and kind analysis. Cheap (works on small copies); cache it per image. */
export function analyze(img: RGBAImage): Analysis {
  validate(img);
  const { width: w, height: h } = img;
  const [fw, fh] = smallSize(w, h, FACE_PX);
  const [r288, g288, b288] = downsampleRGB(img, fw, fh);
  const Lf = new Float32Array(fw * fh);
  for (let i = 0; i < Lf.length; i++) Lf[i] = 0.299 * r288[i] + 0.587 * g288[i] + 0.114 * b288[i];
  const Lf255 = new Float32Array(Lf.length);
  for (let i = 0; i < Lf.length; i++) Lf255[i] = Lf[i] * 255;
  const fs = w / fw;
  const faces = detectFaces({ data: Lf255, width: fw, height: fh }, { minSize: 26, minNeighbors: 4 })
    // Small, weakly supported hits are usually false positives (fabric, foliage).
    .filter((f) => f.hits >= 6 || f.w >= fw * 0.12)
    .slice(0, 6)
    .map((f) => ({ ...f, x: f.x * fs, y: f.y * fs, w: f.w * fs, h: f.h * fs }));
  const [sw, sh] = smallSize(w, h, SUBJECT_PX);
  const ss = sw / w;
  const r = resizePlane(r288, fw, fh, sw, sh);
  const g = resizePlane(g288, fw, fh, sw, sh);
  const b = resizePlane(b288, fw, fh, sw, sh);
  const smallFaces: Box[] = faces.map((f) => ({ x: f.x * ss, y: f.y * ss, w: f.w * ss, h: f.h * ss }));
  const subject = estimateSubject(r, g, b, sw, sh, smallFaces);
  const big = faces.length > 0 && faces[0].w * faces[0].h >= w * h * 0.01;
  const autoKind = big ? 'portrait' : looksLikeDrawing(Lf, fw, fh) ? 'drawing' : 'object';
  return { width: w, height: h, faces, subject, autoKind };
}

/** Resolved numeric parameters for one run (exported for tests and the Prepare screen). */
export type Params = {
  kind: Exclude<PhotoKind, 'auto'>;
  /** DoG inner sigma in px. */
  sigma: number;
  /** Fine-scale sigma and its weight (0 = off). */
  fineSigma: number;
  fineWeight: number;
  /** Guided filter radius / eps (eps 0 = no smoothing). */
  smoothR: number;
  smoothEps: number;
  /** Hysteresis thresholds on the normalised response. */
  high: number;
  low: number;
  /** Shortest stroke kept (px). */
  minLen: number;
  /** Response weight outside the subject (1 = background treated like the subject). */
  bgWeight: number;
  /** Stroke radius in px and taper. */
  radius: number;
  taper: number;
  /** Response multiplier inside faces. */
  faceBoost: number;
  /** Largest gap (px) bridged between line ends. */
  gap: number;
  /** Stroke radius cap inside eye/nose/mouth zones (px). */
  featureCap: number;
};

export function resolveParams(opts: OutlineOptions, w: number, h: number, analysis?: Analysis): Params {
  const detail = Number.isFinite(opts.detail) ? clamp01(opts.detail) : 0.5;
  const thick = Number.isFinite(opts.thickness) ? Math.min(THICKNESS_MAX, Math.max(THICKNESS_MIN, opts.thickness)) : 1.5;
  const smooth = clamp01(opts.smooth ?? 0);
  const taper = clamp01(opts.taper ?? 0.35);
  const requested = opts.kind ?? 'auto';
  const kind = requested === 'auto' ? (analysis?.autoKind ?? 'object') : requested;
  const u = Math.max(w, h) / 1024; // px scale relative to a 1024 px image

  let sigma = lerp(2.0, 0.95, detail) * (1 + 0.5 * smooth);
  let smoothEps = lerp(0.010, 0.0015, detail) * (1 + 4 * smooth);
  let smoothR = lerp(5, 2, detail) * (1 + smooth);
  let minLen = lerp(26, 7, detail) * (1 + 0.5 * smooth);
  let high = lerp(0.95, 0.5, detail);
  let fineWeight = clamp01((detail - 0.35) / 0.5);
  let faceBoost = 1;
  let bgMode: BackgroundMode = opts.background ?? 'soft';

  switch (kind) {
    case 'portrait':
      faceBoost = lerp(2.1, 1.6, detail);
      break;
    case 'pet':
      sigma *= 1.12;
      smoothEps *= 2.2;
      minLen *= 1.25;
      break;
    case 'landscape':
      sigma *= 1.1;
      minLen *= 1.4;
      if (opts.background === undefined) bgMode = 'all';
      break;
    case 'drawing':
      sigma = lerp(1.3, 0.8, detail);
      smoothEps = 0;
      minLen = lerp(10, 4, detail);
      high = lerp(1.0, 0.5, detail);
      fineWeight = 0;
      if (opts.background === undefined) bgMode = 'all';
      break;
    default:
      break;
  }
  // Thick lines need features at least a line-width apart, so look for lines at a matching scale.
  sigma = Math.max(sigma, 0.38 * thick);
  if (thick > 3) minLen *= 1 + (thick - 3) * 0.25;
  // Strokes much shorter than they are wide read as dots, not lines.
  minLen = Math.max(minLen, 3.5 * thick);

  const clarity = analysis ? analysis.subject.clarity : 1;
  const base = bgMode === 'subject' ? 0.2 : bgMode === 'soft' ? 0.55 : 1;
  // Without a clear subject, "subject only" would erase real content: fall back towards 'all'.
  const bgWeight = lerp(1, base, Math.min(1, clarity * 1.4));

  return {
    kind,
    sigma: Math.max(0.7, sigma * u),
    fineSigma: Math.max(0.6, Math.max(0.7, sigma * 0.55) * u),
    fineWeight,
    smoothR: Math.max(1, Math.round(smoothR * u)),
    smoothEps,
    high,
    low: high * 0.35,
    minLen: Math.max(3, Math.round(minLen * u)),
    bgWeight,
    radius: (thick / 2) * u,
    taper,
    faceBoost,
    gap: Math.max(2, (3 + 3 * (1 - detail)) * u),
    featureCap: Math.max(0.6, Math.min((thick / 2) * u, 1.6 * u)),
  };
}

/**
 * Skin-likeness 0..1 at (dw, dh) from chroma distance to the colour sampled at the face
 * centre(s): adapts to each person's skin tone instead of assuming one.
 */
function skinMap(img: RGBAImage, faces: readonly Face[], dw: number, dh: number): Plane | null {
  if (!faces.length) return null;
  const [r, g, b] = downsampleRGB(img, dw, dh);
  const n = dw * dh;
  const sx = dw / img.width, sy = dh / img.height;
  const cb = new Float32Array(n), cr = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const R = r[i] * 255, G = g[i] * 255, B = b[i] * 255;
    cb[i] = -0.1687 * R - 0.3313 * G + 0.5 * B;
    cr[i] = 0.5 * R - 0.4187 * G - 0.0813 * B;
  }
  const models: [number, number][] = [];
  for (const f of faces) {
    // Cheeks and nose bridge: centre band of the face box, avoiding eyes and mouth.
    let sb = 0, sr = 0, k = 0;
    const y0 = Math.max(0, Math.floor((f.y + 0.45 * f.h) * sy)), y1 = Math.min(dh, Math.ceil((f.y + 0.7 * f.h) * sy));
    const x0 = Math.max(0, Math.floor((f.x + 0.25 * f.w) * sx)), x1 = Math.min(dw, Math.ceil((f.x + 0.75 * f.w) * sx));
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { sb += cb[y * dw + x]; sr += cr[y * dw + x]; k++; }
    if (k) models.push([sb / k, sr / k]);
  }
  if (!models.length) return null;
  const out = new Float32Array(n);
  const k2 = 1 / (2 * 9 * 9);
  for (let i = 0; i < n; i++) {
    let best = Infinity;
    for (const [mb, mr] of models) {
      const d = (cb[i] - mb) * (cb[i] - mb) + (cr[i] - mr) * (cr[i] - mr);
      if (d < best) best = d;
    }
    out[i] = 1 / (1 + best * k2 + 0.5 * best * best * k2 * k2); // ~exp(-d) without exp
  }
  return out;
}

/** Face boxes enlarged to cover brows, hair line, ears and chin/jaw. */
function faceRegions(faces: readonly Face[]): Box[] {
  return faces.map((f) => ({ x: f.x - 0.2 * f.w, y: f.y - 0.25 * f.h, w: f.w * 1.4, h: f.h * 1.6 }));
}

/** Eye and mouth zones from the canonical frontal-face layout of the detector's box. */
function featureZones(faces: readonly Face[]): Box[] {
  const z: Box[] = [];
  for (const f of faces) {
    z.push({ x: f.x + 0.08 * f.w, y: f.y + 0.18 * f.h, w: 0.84 * f.w, h: 0.32 * f.h }); // brows + eyes
    z.push({ x: f.x + 0.3 * f.w, y: f.y + 0.45 * f.h, w: 0.4 * f.w, h: 0.25 * f.h }); // nose
    z.push({ x: f.x + 0.2 * f.w, y: f.y + 0.68 * f.h, w: 0.6 * f.w, h: 0.26 * f.h }); // mouth
  }
  return z;
}

function inBoxes(boxes: readonly Box[], x: number, y: number): boolean {
  for (const b of boxes) if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) return true;
  return false;
}

/**
 * Chunked outline: yields progress in 0..1 (monotonic, last yield is 1) and returns the line art.
 */
export function* outlineSteps(img: RGBAImage, opts: OutlineOptions): Generator<number, RGBAImage> {
  validate(img);
  if (opts.style === 'sketch' || opts.style === 'lineart' || opts.style === 'bold') {
    return yield* styleSteps(img, opts, opts.style);
  }
  const w = img.width, h = img.height, n = w * h;
  const analysis = opts.analysis && opts.analysis.width === w && opts.analysis.height === h ? opts.analysis : analyze(img);
  yield 0.08;
  const P = resolveParams(opts, w, h, analysis);
  const faces = P.kind === 'portrait' || analysis.faces.length ? analysis.faces : [];
  const regions = faceRegions(faces);
  const features = featureZones(faces);
  // Per-pixel zone: 0 = elsewhere, 1 = face region, 2 = eye/nose/mouth zone.
  const zone = new Uint8Array(n);
  for (const [boxes, v] of [[regions, 1], [features, 2]] as const) {
    for (const bx of boxes) {
      const x0 = Math.max(0, Math.floor(bx.x)), x1 = Math.min(w, Math.ceil(bx.x + bx.w));
      const y0 = Math.max(0, Math.floor(bx.y)), y1 = Math.min(h, Math.ceil(bx.y + bx.h));
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) zone[y * w + x] = v;
    }
  }

  // 1. Luma + edge-preserving smoothing.
  const L = lumaPlane(img);
  let S: Plane = L;
  if (P.smoothEps > 0) {
    let epsMap: { data: Plane; width: number; height: number } | undefined;
    const [gw, gh] = guidedSize(w, h, P.smoothR);
    const skin = P.kind === 'portrait' ? skinMap(img, faces, gw, gh) : null;
    if (skin) {
      for (let i = 0; i < skin.length; i++) skin[i] = 1 + 3 * skin[i];
      // ...but never inside the eye / nose / mouth zones: those details are the point.
      const zs = gw / w;
      for (const f of features) {
        const x0 = Math.max(0, Math.floor(f.x * zs)), x1 = Math.min(gw, Math.ceil((f.x + f.w) * zs));
        const y0 = Math.max(0, Math.floor(f.y * zs)), y1 = Math.min(gh, Math.ceil((f.y + f.h) * zs));
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) skin[y * gw + x] = 0.6;
      }
      epsMap = { data: skin, width: gw, height: gh };
    }
    S = guidedFilter(L, w, h, P.smoothR, P.smoothEps, epsMap);
  }
  yield 0.25;

  // 2. Dark-side DoG response(s).
  // Coarse scales (sigma >= 1.8 px) are computed on a half-size copy: same lines, ~4x less work.
  let R: Plane;
  let g1: Plane, g2: Plane;
  if (P.sigma >= 1.8 && w >= 64 && h >= 64) {
    const hw = w >> 1, hh = h >> 1;
    const Sh = resizePlane(S, w, h, hw, hh);
    const a1 = gaussBlur(Sh, hw, hh, P.sigma / 2);
    const a2 = gaussBlur(Sh, hw, hh, (P.sigma * 1.6) / 2);
    for (let i = 0; i < hw * hh; i++) {
      const d = a2[i] - a1[i];
      a1[i] = d > 0 ? d : 0;
    }
    yield 0.41;
    R = resizePlane(a1, hw, hh, w, h);
    g1 = new Float32Array(n);
    g2 = new Float32Array(n);
  } else {
    g1 = gaussBlur(S, w, h, P.sigma);
    yield 0.33;
    g2 = gaussBlur(S, w, h, P.sigma * 1.6);
    yield 0.41;
    R = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const d = g2[i] - g1[i];
      R[i] = d > 0 ? d : 0;
    }
  }
  const weightW = subjectWeightAt(analysis.subject, w, h);
  if (P.fineWeight > 0 || regions.length) {
    const f1 = gaussBlur(S, w, h, P.fineSigma, g1);
    const f2 = gaussBlur(S, w, h, P.fineSigma * 1.6, g2);
    // Fine detail is welcome inside the subject (and always inside faces), quieter outside.
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const z = zone[i];
        const d = f2[i] - f1[i];
        if (d <= 0) continue;
        let fw = P.fineWeight * (0.35 + 0.65 * weightW[i]);
        if (z) fw = Math.max(fw, z === 2 ? 1 : 0.7);
        // DoG amplitude shrinks with sigma; compensate so both scales are comparable.
        const v = d * fw * 1.25;
        if (v > R[i]) R[i] = v;
      }
    }
  }
  // Eyes, nostrils, lips: also follow the shapes' outlines (lid lines, iris rim, lip edges),
  // which a dark-line detector alone reduces to blobs. Thin gradient ridges (non-maximum
  // suppressed) inside the feature zones only.
  if (features.length) {
    // The fine-scale pass above always runs when faces exist and left its blur in g1.
    const f1 = g1;
    for (const bx of features) {
      const x0 = Math.max(1, Math.floor(bx.x)), x1 = Math.min(w - 1, Math.ceil(bx.x + bx.w));
      const y0 = Math.max(1, Math.floor(bx.y)), y1 = Math.min(h - 1, Math.ceil(bx.y + bx.h));
      const gw2 = x1 - x0;
      if (gw2 <= 2 || y1 - y0 <= 2) continue;
      const gm = new Float32Array(gw2 * (y1 - y0));
      const dir = new Uint8Array(gm.length);
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = y * w + x;
          const gx = f1[i + 1] - f1[i - 1], gy = f1[i + w] - f1[i - w];
          const k = (y - y0) * gw2 + (x - x0);
          gm[k] = Math.sqrt(gx * gx + gy * gy);
          const ax = Math.abs(gx), ay = Math.abs(gy);
          dir[k] = ay <= ax * 0.414 ? 0 : ay >= ax * 2.414 ? 2 : (gx > 0) === (gy > 0) ? 1 : 3;
        }
      }
      for (let y = y0 + 1; y < y1 - 1; y++) {
        for (let x = x0 + 1; x < x1 - 1; x++) {
          const k = (y - y0) * gw2 + (x - x0);
          const m = gm[k];
          const d = dir[k];
          const o = d === 0 ? 1 : d === 2 ? gw2 : d === 1 ? gw2 + 1 : gw2 - 1;
          if (m < gm[k - o] || m < gm[k + o]) continue;
          const v = m * 0.16;
          const i = y * w + x;
          if (v > R[i]) R[i] = v;
        }
      }
    }
  }
  yield 0.52;

  // 3. Local contrast normalisation.
  const sq = g1;
  let gsum = 0;
  for (let i = 0; i < n; i++) {
    sq[i] = R[i] * R[i];
    gsum += sq[i];
  }
  const grms = Math.sqrt(gsum / n) + 1e-4;
  const lrad = Math.max(4, Math.round(Math.max(w, h) * 0.05));
  const lms = boxBlur(sq, w, h, lrad, g2);
  const floor = 0.006; // ~1.5 grey levels: flat areas never become lines
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const r = R[i];
      if (r < floor) { R[i] = 0; continue; }
      const local = Math.sqrt(lms[i]);
      let v = r / (0.55 * local + 0.45 * grms + 0.004);
      v *= P.bgWeight + (1 - P.bgWeight) * weightW[i];
      const z = zone[i];
      if (z) v *= P.faceBoost * (z === 2 ? 1.5 : 1);
      R[i] = v;
    }
  }
  yield 0.62;

  // 4. Hysteresis threshold into a line band.
  const mask = new Uint8Array(n);
  const stack = new Int32Array(n);
  for (let s = 0; s < n; s++) {
    if (mask[s] || R[s] < P.high) continue;
    mask[s] = 1;
    let sp = 0;
    stack[sp++] = s;
    while (sp) {
      const p = stack[--sp];
      const x = p % w, y = (p / w) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          const q = yy * w + xx;
          if (!mask[q] && R[q] >= P.low) { mask[q] = 1; stack[sp++] = q; }
        }
      }
    }
  }
  yield 0.72;

  // 5. Thin to centre lines, drop strays (keep short strokes inside faces: eyes, nostrils).
  thin(mask, w, h);
  linkGaps(mask, w, h, P.gap);
  yield 0.82;
  dropShort(mask, w, h, P.minLen, regions.length
    ? (px) => {
      if (px.length < 3) return false;
      return zone[px[0]] >= (P.radius > 1.5 * (Math.max(w, h) / 1024) ? 2 : 1);
    }
    : undefined);
  yield 0.88;

  // 6. Trace into strokes, prune spurs, smooth, render anti-aliased round strokes.
  const cov = new Uint8Array(n);
  let chains = traceChains(mask, w, h);
  chains = pruneSpurs(chains, mask, w, h, Math.max(3, Math.round(P.minLen * 0.5)));
  const sat = P.high * 2.2;
  const passes = Math.max(1, Math.round(2 + 4 * P.radius));
  const strokes: Stroke[] = [];
  for (const c of chains) {
    let sum = 0;
    for (const i of c) sum += R[i];
    const { xs, ys } = smoothChain(c, w, Math.min(passes, Math.max(1, (c.length / 3) | 0)));
    let cap: Float32Array | undefined;
    if (features.length) {
      // Small facial features (eyes, nostrils, lips) stay fine so bold lines don't blot them.
      for (let k = 0; k < xs.length; k++) {
        if (zone[(Math.round(ys[k]) * w + Math.round(xs[k])) | 0] === 2) {
          if (!cap) cap = new Float32Array(xs.length).fill(Infinity);
          cap[k] = Math.max(0.6, P.featureCap);
        }
      }
    }
    strokes.push({ xs, ys, strength: clamp01(sum / c.length / sat), cap });
  }
  renderStrokes(strokes, cov, w, h, P.radius, P.taper);
  const col = opts.invert ? [255, 255, 255] : (opts.lineColor ?? DEFAULT_LINE);
  const cr = clampByte(col[0]), cg = clampByte(col[1]), cb = clampByte(col[2]);
  const out = new Uint8ClampedArray(n * 4);
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const a = cov[i];
    if (!a) continue;
    out[p] = cr; out[p + 1] = cg; out[p + 2] = cb; out[p + 3] = a;
  }
  yield 1;
  return { data: out, width: w, height: h };
}

/** Synchronous convenience wrapper around `outlineSteps`. */
export function outline(img: RGBAImage, opts: OutlineOptions): RGBAImage {
  const gen = outlineSteps(img, opts);
  for (;;) {
    const r = gen.next();
    if (r.done) return r.value;
  }
}

/**
 * Drives a chunked generator, awaiting `yieldFn` between chunks so the UI stays responsive
 * (e.g. `() => new Promise(r => setTimeout(r, 0))`). Reports progress 0..1 via `onProgress`.
 */
export async function runChunked<T>(
  gen: Generator<number, T>,
  yieldFn: () => Promise<void>,
  onProgress?: (p: number) => void,
): Promise<T> {
  for (;;) {
    const r = gen.next();
    if (r.done) return r.value;
    if (onProgress) onProgress(r.value);
    await yieldFn();
  }
}
