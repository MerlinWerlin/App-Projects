// Frontal face detection in pure TypeScript (no native modules, works in Expo Go).
// Evaluates OpenCV's LBP cascade (src/core/faceCascade.ts) over an image pyramid, the same way
// cv2.CascadeClassifier.detectMultiScale does, then groups overlapping hits.
// Used by the outline pipeline to keep eyes, brows, nose, lips and jaw lines in portraits.

import { CASCADE } from './faceCascade.ts';

export type Box = { x: number; y: number; w: number; h: number };
export type Face = Box & { /** Number of raw hits merged into this face (a confidence proxy). */ hits: number };

export type GrayImage = { data: Float32Array | Uint8Array | Uint8ClampedArray; width: number; height: number };

export type DetectOptions = {
  /** Pyramid step. Default 1.15. */
  scaleFactor?: number;
  /** Raw hits needed to accept a face (OpenCV minNeighbors). Default 3. */
  minNeighbors?: number;
  /** Smallest face side in px of the input. Default 24. */
  minSize?: number;
};

/** Integral image with a zero first row/column: (w + 1) x (h + 1). */
function integral(g: Float32Array, w: number, h: number): Float64Array {
  const W = w + 1;
  const ii = new Float64Array(W * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    const o = (y + 1) * W;
    const p = y * W;
    for (let x = 0; x < w; x++) {
      row += g[y * w + x];
      ii[o + x + 1] = ii[p + x + 1] + row;
    }
  }
  return ii;
}

/** Bilinear resize (as OpenCV's detector does per pyramid level) with precomputed column taps. */
function downscale(src: Float32Array, w: number, h: number, dw: number, dh: number): Float32Array {
  const out = new Float32Array(dw * dh);
  const sx = w / dw, sy = h / dh;
  const x0s = new Int32Array(dw), x1s = new Int32Array(dw), fxs = new Float32Array(dw);
  for (let x = 0; x < dw; x++) {
    let fx = (x + 0.5) * sx - 0.5;
    if (fx < 0) fx = 0;
    const x0 = Math.min(w - 1, Math.floor(fx));
    x0s[x] = x0;
    x1s[x] = Math.min(w - 1, x0 + 1);
    fxs[x] = fx - x0;
  }
  for (let y = 0; y < dh; y++) {
    let fy = (y + 0.5) * sy - 0.5;
    if (fy < 0) fy = 0;
    const y0 = Math.min(h - 1, Math.floor(fy));
    const r0 = y0 * w, r1 = Math.min(h - 1, y0 + 1) * w;
    const ty = fy - y0;
    const o = y * dw;
    for (let x = 0; x < dw; x++) {
      const a = x0s[x], b = x1s[x], t = fxs[x];
      const top = src[r0 + a] + (src[r0 + b] - src[r0 + a]) * t;
      const bot = src[r1 + a] + (src[r1 + b] - src[r1 + a]) * t;
      out[o + x] = top + (bot - top) * ty;
    }
  }
  return out;
}

function evalWindow(ii: Float64Array, W: number, wx: number, wy: number): boolean {
  const { features, stages, featureIndex, subsets, leaves } = CASCADE;
  let k = 0; // weak classifier index
  for (let s = 0; s < stages.length; s += 2) {
    const n = stages[s];
    const thr = stages[s + 1];
    let sum = 0;
    for (let j = 0; j < n; j++, k++) {
      const f = featureIndex[k] * 4;
      const fx = wx + features[f], fy = wy + features[f + 1];
      const cw = features[f + 2], ch = features[f + 3];
      // Corner offsets of the 3x3 cell grid: rows r0..r3, cols c0..c3.
      const r0 = fy * W, r1 = (fy + ch) * W, r2 = (fy + 2 * ch) * W, r3 = (fy + 3 * ch) * W;
      const c0 = fx, c1 = fx + cw, c2 = fx + 2 * cw, c3 = fx + 3 * cw;
      // Cell sums of the 3x3 grid (integral image corners), written out for the interpreter.
      const a00 = ii[r0 + c0], a01 = ii[r0 + c1], a02 = ii[r0 + c2], a03 = ii[r0 + c3];
      const a10 = ii[r1 + c0], a11 = ii[r1 + c1], a12 = ii[r1 + c2], a13 = ii[r1 + c3];
      const a20 = ii[r2 + c0], a21 = ii[r2 + c1], a22 = ii[r2 + c2], a23 = ii[r2 + c3];
      const a30 = ii[r3 + c0], a31 = ii[r3 + c1], a32 = ii[r3 + c2], a33 = ii[r3 + c3];
      const cval = a22 - a21 - a12 + a11;
      const code =
        (a11 - a10 - a01 + a00 >= cval ? 128 : 0) |
        (a12 - a11 - a02 + a01 >= cval ? 64 : 0) |
        (a13 - a12 - a03 + a02 >= cval ? 32 : 0) |
        (a23 - a22 - a13 + a12 >= cval ? 16 : 0) |
        (a33 - a32 - a23 + a22 >= cval ? 8 : 0) |
        (a32 - a31 - a22 + a21 >= cval ? 4 : 0) |
        (a31 - a30 - a21 + a20 >= cval ? 2 : 0) |
        (a21 - a20 - a11 + a10 >= cval ? 1 : 0);
      const inSet = subsets[k * 8 + (code >> 5)] & (1 << (code & 31));
      sum += inSet ? leaves[k * 2] : leaves[k * 2 + 1];
    }
    if (sum < thr) return false;
  }
  return true;
}

/** OpenCV-style grouping: cluster similar boxes, keep clusters with > minNeighbors members, drop nested ones. */
export function groupBoxes(boxes: readonly Box[], minNeighbors: number, eps = 0.2): Face[] {
  const n = boxes.length;
  const label = new Int32Array(n).fill(-1);
  const similar = (a: Box, b: Box) => {
    const d = eps * (Math.min(a.w, b.w) + Math.min(a.h, b.h)) * 0.5;
    return (
      Math.abs(a.x - b.x) <= d && Math.abs(a.y - b.y) <= d &&
      Math.abs(a.x + a.w - b.x - b.w) <= d && Math.abs(a.y + a.h - b.y - b.h) <= d
    );
  };
  let classes = 0;
  for (let i = 0; i < n; i++) {
    if (label[i] >= 0) continue;
    label[i] = classes;
    const queue = [i];
    while (queue.length) {
      const a = queue.pop() as number;
      for (let j = 0; j < n; j++) {
        if (label[j] < 0 && similar(boxes[a], boxes[j])) {
          label[j] = classes;
          queue.push(j);
        }
      }
    }
    classes++;
  }
  const acc = Array.from({ length: classes }, () => ({ x: 0, y: 0, w: 0, h: 0, hits: 0 }));
  for (let i = 0; i < n; i++) {
    const a = acc[label[i]];
    a.x += boxes[i].x; a.y += boxes[i].y; a.w += boxes[i].w; a.h += boxes[i].h; a.hits++;
  }
  const faces: Face[] = acc
    .filter((a) => a.hits > minNeighbors)
    .map((a) => ({ x: a.x / a.hits, y: a.y / a.hits, w: a.w / a.hits, h: a.h / a.hits, hits: a.hits }));
  // Drop a face that sits inside a stronger, larger one.
  return faces
    .filter((f) => !faces.some((g) => g !== f && g.hits >= f.hits && g.w > f.w &&
      f.x >= g.x - 0.2 * g.w && f.y >= g.y - 0.2 * g.h && f.x + f.w <= g.x + 1.2 * g.w && f.y + f.h <= g.y + 1.2 * g.h))
    .sort((a, b) => b.w * b.h - a.w * a.h);
}

/** Detects frontal faces in a gray image (0..255 or 0..1, any range works: LBP only compares sums). */
export function detectFaces(img: GrayImage, opts: DetectOptions = {}): Face[] {
  const { width: w, height: h } = img;
  const factorStep = opts.scaleFactor ?? 1.15;
  const minNeighbors = opts.minNeighbors ?? 3;
  const minSize = Math.max(CASCADE.width, opts.minSize ?? 24);
  const src = img.data instanceof Float32Array ? img.data : Float32Array.from(img.data);
  const raw: Box[] = [];
  for (let factor = minSize / CASCADE.width; ; factor *= factorStep) {
    const sw = Math.round(w / factor), sh = Math.round(h / factor);
    if (sw < CASCADE.width + 1 || sh < CASCADE.height + 1) break;
    const g = factor === 1 ? src : downscale(src, w, h, sw, sh);
    const ii = integral(g, sw, sh);
    const W = sw + 1;
    const step = factor > 2 ? 1 : 2;
    for (let y = 0; y + CASCADE.height <= sh; y += step) {
      for (let x = 0; x + CASCADE.width <= sw; x += step) {
        if (evalWindow(ii, W, x, y)) {
          raw.push({ x: x * factor, y: y * factor, w: CASCADE.width * factor, h: CASCADE.height * factor });
        }
      }
    }
  }
  return groupBoxes(raw, minNeighbors);
}
