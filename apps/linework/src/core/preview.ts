// Fast outline preview helpers (oversight D7-1): a small copy of the decoded photo, the face /
// subject analysis rescaled to it, and a "latest request wins" job tracker so a newer slider
// change cancels any older outline job. Pure TypeScript, no React Native imports.

import type { Analysis, RGBAImage } from './outline.ts';

/** Default long edge of the quick preview, in px. */
export const PREVIEW_PX = 320;

/** Area-average downscale so the long edge is <= maxPx. Returns the input when it is already small enough. */
export function downscaleRGBA(img: RGBAImage, maxPx: number): RGBAImage {
  const { width: w, height: h, data } = img;
  const cap = Math.max(1, Math.floor(maxPx));
  const s = Math.min(1, cap / Math.max(w, h));
  if (s >= 1) return img;
  const dw = Math.max(1, Math.round(w * s));
  const dh = Math.max(1, Math.round(h * s));
  const n = dw * dh;
  const acc = new Float64Array(n * 4);
  const cnt = new Uint32Array(n);
  const bx = new Int32Array(w);
  for (let x = 0; x < w; x++) bx[x] = Math.min(dw - 1, Math.floor((x * dw) / w));
  for (let y = 0, p = 0; y < h; y++) {
    const row = Math.min(dh - 1, Math.floor((y * dh) / h)) * dw;
    for (let x = 0; x < w; x++, p += 4) {
      const i = row + bx[x];
      const q = i * 4;
      acc[q] += data[p];
      acc[q + 1] += data[p + 1];
      acc[q + 2] += data[p + 2];
      acc[q + 3] += data[p + 3];
      cnt[i]++;
    }
  }
  const out = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) {
    const k = cnt[i] > 0 ? 1 / cnt[i] : 0;
    const q = i * 4;
    out[q] = Math.round(acc[q] * k);
    out[q + 1] = Math.round(acc[q + 1] * k);
    out[q + 2] = Math.round(acc[q + 2] * k);
    out[q + 3] = Math.round(acc[q + 3] * k);
  }
  return { data: out, width: dw, height: dh };
}

/** The analysis of a full-size image, expressed for a resized copy (faces scaled; subject map is size-free). */
export function scaleAnalysis(a: Analysis, width: number, height: number): Analysis {
  if (a.width === width && a.height === height) return a;
  const sx = width / a.width;
  const sy = height / a.height;
  return {
    ...a,
    width,
    height,
    faces: a.faces.map((f) => ({ ...f, x: f.x * sx, y: f.y * sy, w: f.w * sx, h: f.h * sy })),
  };
}

export type JobToken = { aborted: boolean; readonly seq: number };

export type LatestJobs = {
  /** Start a new job: every older job's token is aborted. */
  start(): JobToken;
  /** True while `token` belongs to the newest job and has not been cancelled. */
  isCurrent(token: JobToken): boolean;
  /** Abort the current job (e.g. leaving the screen). */
  cancel(): void;
};

export function makeLatestJobs(): LatestJobs {
  let seq = 0;
  let current: JobToken | null = null;
  return {
    start() {
      if (current) current.aborted = true;
      seq += 1;
      current = { aborted: false, seq };
      return current;
    },
    isCurrent(token) {
      return !token.aborted && current !== null && token.seq === current.seq;
    },
    cancel() {
      if (current) current.aborted = true;
    },
  };
}
