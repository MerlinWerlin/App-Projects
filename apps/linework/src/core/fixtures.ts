// Synthetic test images with known edges (T49), generated in code so tests need no photos and
// nothing copyrighted: geometric shapes, a portrait-like smooth-gradient face, and blocky text.
// Each fixture carries a ground-truth edge map (1 = pixel on a region boundary) built from region
// ids, not from pixel values, so smooth shading inside a region never counts as an edge.
// Also the metrics used by outlineMetrics.test.ts: edge recall / precision with a pixel tolerance
// and a speck count.

import type { RGBAImage } from './outline.ts';

export type Fixture = { name: string; img: RGBAImage; edges: Uint8Array };

export type Sample = { id: number; rgb: [number, number, number] };

export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Renders `f` with uniform noise of +-`noise` levels and builds the boundary map from region ids. */
export function build(name: string, w: number, h: number, noise: number, seed: number, f: (x: number, y: number) => Sample): Fixture {
  const data = new Uint8ClampedArray(w * h * 4);
  const ids = new Int32Array(w * h);
  const r = rng(seed);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const s = f(x, y);
      const i = y * w + x;
      ids[i] = s.id;
      const nz = (r() * 2 - 1) * noise;
      data[i * 4] = s.rgb[0] + nz;
      data[i * 4 + 1] = s.rgb[1] + nz;
      data[i * 4 + 2] = s.rgb[2] + nz;
      data[i * 4 + 3] = 255;
    }
  }
  const edges = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (x + 1 < w && ids[i + 1] !== ids[i]) { edges[i] = 1; edges[i + 1] = 1; }
      if (y + 1 < h && ids[i + w] !== ids[i]) { edges[i] = 1; edges[i + w] = 1; }
    }
  }
  return { name, img: { data, width: w, height: h }, edges };
}

const grey = (v: number): [number, number, number] => [v, v, v];
const inEllipse = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) =>
  ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;

/**
 * Geometric shapes on a smooth gradient: a dark rectangle, a light disc, a mid-grey triangle and
 * a faint (18 grey levels) rectangle, the case a single global threshold tends to miss.
 */
export function shapesFixture(w = 512, h = 384, seed = 11, noise = 4): Fixture {
  const m = Math.min(w, h);
  return build(noise > 4 ? 'noisy shapes' : 'shapes', w, h, noise, seed, (x, y) => {
    const bg = 150 + 40 * (x / w) - 15 * (y / h);
    if (x >= 0.08 * w && x < 0.36 * w && y >= 0.12 * h && y < 0.5 * h) return { id: 1, rgb: grey(50) };
    if (inEllipse(x, y, 0.66 * w, 0.34 * h, 0.16 * m, 0.16 * m)) return { id: 2, rgb: grey(235) };
    // Triangle: apex (0.25w, 0.6h), base y = 0.92h from 0.08w to 0.42w.
    const ty = (y - 0.6 * h) / (0.32 * h);
    if (ty >= 0 && ty <= 1 && Math.abs(x - 0.25 * w) <= ty * 0.17 * w) return { id: 3, rgb: grey(95) };
    if (x >= 0.56 * w && x < 0.9 * w && y >= 0.64 * h && y < 0.9 * h) return { id: 4, rgb: grey(bg + 18) };
    return { id: 0, rgb: grey(bg) };
  });
}

/**
 * Portrait-like image: smooth shaded face ellipse with eyes, irises, brows, nostrils and lips,
 * hair behind it, a neck and a gradient background. Soft subject: few hard edges, lots of shading.
 */
export function portraitFixture(w = 400, h = 500, seed = 23): Fixture {
  const cx = 0.5 * w, cy = 0.5 * h, rx = 0.27 * w, ry = 0.33 * h;
  return build('portrait', w, h, 3, seed, (x, y) => {
    const ex = 0.1 * w, ey = 0.44 * h;
    for (const sx of [-1, 1]) {
      const exx = cx + sx * ex;
      if (inEllipse(x, y, exx, ey, 0.018 * w, 0.018 * w)) return { id: 10 + (sx > 0 ? 1 : 0), rgb: [60, 70, 85] };
      if (inEllipse(x, y, exx, ey, 0.05 * w, 0.022 * h)) return { id: 12 + (sx > 0 ? 1 : 0), rgb: [232, 228, 222] };
      if (inEllipse(x, y, exx, 0.385 * h, 0.065 * w, 0.009 * h)) return { id: 14 + (sx > 0 ? 1 : 0), rgb: [80, 62, 50] };
      if (inEllipse(x, y, cx + sx * 0.025 * w, 0.565 * h, 0.012 * w, 0.007 * h)) return { id: 16 + (sx > 0 ? 1 : 0), rgb: [120, 85, 70] };
    }
    if (inEllipse(x, y, cx, 0.64 * h, 0.085 * w, 0.022 * h)) return { id: 18, rgb: [176, 96, 92] };
    if (inEllipse(x, y, cx, cy, rx, ry)) {
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      const v = 214 - 34 * d + 10 * ((x - cx) / rx);
      return { id: 2, rgb: [v + 14, v - 4, v - 22] };
    }
    if (inEllipse(x, y, cx, 0.42 * h, 0.33 * w, 0.37 * h) && y < 0.62 * h) {
      const v = 66 + 4 * Math.sin(x * 0.4 + y * 0.05);
      return { id: 3, rgb: [v + 10, v, v - 8] };
    }
    if (Math.abs(x - cx) < 0.12 * w && y > cy && y < h) {
      const v = 168 - 18 * Math.abs(x - cx) / (0.12 * w);
      return { id: 4, rgb: [v + 14, v - 4, v - 22] };
    }
    const v = 120 + 50 * (y / h) + 10 * Math.sin(x / w * 3);
    return { id: 0, rgb: [v - 10, v, v + 12] };
  });
}

const GLYPHS: Record<string, string[]> = {
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
};

/** Blocky 5x7 bitmap lettering ("LINE" / "ART"), dark ink on slightly uneven paper. */
export function textFixture(w = 480, h = 360, seed = 37): Fixture {
  const lines = ['LINE', 'ART'];
  const cell = Math.max(2, Math.floor(Math.min(w / (4 * 6 + 2), h / (2 * 8 + 2))));
  return build('text', w, h, 4, seed, (x, y) => {
    const paper = 228 - 14 * (y / h) + 6 * Math.sin(x / w * 5);
    const row = Math.floor(y / cell) - 1;
    const line = Math.floor(row / 8), gy = row % 8;
    if (line >= 0 && line < lines.length && gy < 7) {
      const col = Math.floor(x / cell) - 1;
      const k = Math.floor(col / 6), gx = col % 6;
      const ch = lines[line][k];
      if (col >= 0 && ch && gx < 5 && GLYPHS[ch][gy][gx] === '1') return { id: 1, rgb: grey(38) };
    }
    return { id: 0, rgb: grey(paper) };
  });
}

/** The standard fixture set used by the metrics test (shapes again with heavy +-16 level grain). */
export function allFixtures(): Fixture[] {
  return [shapesFixture(), shapesFixture(512, 384, 13, 16), portraitFixture(), textFixture()];
}

/** Square dilation (Chebyshev radius r) of a 0/1 mask. */
function dilate(mask: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const tmp = new Uint8Array(mask.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 0;
      for (let k = Math.max(0, x - r); k <= Math.min(w - 1, x + r) && !v; k++) v = mask[y * w + k];
      tmp[y * w + x] = v;
    }
  }
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 0;
      for (let k = Math.max(0, y - r); k <= Math.min(h - 1, y + r) && !v; k++) v = tmp[k * w + x];
      out[y * w + x] = v;
    }
  }
  return out;
}

/** Inked pixels of a line-art result (alpha >= `on`). */
export function inkMask(img: RGBAImage, on = 128): Uint8Array {
  const n = img.width * img.height;
  const m = new Uint8Array(n);
  for (let i = 0; i < n; i++) m[i] = img.data[i * 4 + 3] >= on ? 1 : 0;
  return m;
}

export type EdgeMetrics = { recall: number; precision: number; f1: number; inked: number };

/**
 * Recall = share of ground-truth edge pixels with ink within `tol` px; precision = share of ink
 * pixels within `tol` px of a ground-truth edge.
 */
export function edgeMetrics(out: RGBAImage, gt: Uint8Array, tol = 2): EdgeMetrics {
  const w = out.width, h = out.height;
  const ink = inkMask(out);
  const inkD = dilate(ink, w, h, tol);
  const gtD = dilate(gt, w, h, tol);
  let g = 0, gHit = 0, k = 0, kHit = 0;
  for (let i = 0; i < ink.length; i++) {
    if (gt[i]) { g++; if (inkD[i]) gHit++; }
    if (ink[i]) { k++; if (gtD[i]) kHit++; }
  }
  const recall = g ? gHit / g : 1;
  const precision = k ? kHit / k : 0;
  const f1 = recall + precision > 0 ? (2 * recall * precision) / (recall + precision) : 0;
  return { recall, precision, f1, inked: k };
}

/** Number of 8-connected inked components (alpha >= 32, i.e. visible) smaller than `maxArea` pixels: specks. */
export function speckCount(out: RGBAImage, maxArea = 12): number {
  const w = out.width, h = out.height;
  const ink = inkMask(out, 32);
  const seen = new Uint8Array(ink.length);
  const stack: number[] = [];
  let specks = 0;
  for (let s = 0; s < ink.length; s++) {
    if (!ink[s] || seen[s]) continue;
    let area = 0;
    seen[s] = 1;
    stack.push(s);
    while (stack.length) {
      const p = stack.pop() as number;
      area++;
      const x = p % w, y = (p / w) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          const q = yy * w + xx;
          if (ink[q] && !seen[q]) { seen[q] = 1; stack.push(q); }
        }
      }
    }
    if (area < maxArea) specks++;
  }
  return specks;
}
