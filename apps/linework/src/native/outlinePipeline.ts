// Outline mode pipeline (PLAN §5): image uri -> resized base64 JPEG -> RGBA -> core outline
// (chunked, yielding to the UI) -> PNG -> cache file uri used as the trace overlay.
//
// Every platform call goes through `deps`, so this file has no React Native / Expo imports and
// runs in node tests with fakes. The real deps live in ./outlineDeps.ts.

import { decodeBase64, encodeBase64 } from '../core/base64.ts';
import { fitWithin } from '../core/image.ts';
import { analyze, outlineSteps, runChunked, type Analysis, type OutlineOptions, type PhotoKind, type RGBAImage } from '../core/outline.ts';
import { downscaleRGBA, scaleAnalysis } from '../core/preview.ts';

export type Pixels = { width: number; height: number; data: Uint8Array | Uint8ClampedArray };

export type OutlineDeps = {
  /** Rotate by `rotateTurns` clockwise quarter turns, shrink so the long edge is <= maxPx, return base64 JPEG. */
  resizeToJpegBase64(uri: string, maxPx: number, rotateTurns: number): Promise<{ base64: string; width: number; height: number }>;
  /** Decode JPEG bytes to RGBA (4 bytes per pixel). */
  decodeJpeg(bytes: Uint8Array): Pixels;
  /** Encode RGBA to a lossless PNG. */
  encodePng(rgba: Uint8Array | Uint8ClampedArray, width: number, height: number): Uint8Array;
  /** Write base64 data to a file in the cache folder; returns its uri. */
  writeCacheFile(name: string, base64: string): Promise<string>;
  /** Let the UI breathe between chunks (e.g. setTimeout 0). */
  yieldFn(): Promise<void>;
};

export type OutlineRunOptions = OutlineOptions & {
  /** Clockwise quarter turns applied to the source before outlining. Default 0. */
  rotateTurns?: number;
  /** Long-edge cap in px. Default 1024. */
  maxPx?: number;
  /**
   * Quick preview (D7-1): outline a copy whose long edge is this many px instead of the full
   * image. Shares the decoded source and analysis with full runs, so it never re-decodes.
   */
  previewPx?: number;
};

export type AbortToken = { aborted: boolean };

export type OutlineInfo = {
  /** What 'auto' detected for this photo. */
  autoKind: Exclude<PhotoKind, 'auto'>;
  /** Number of faces found. */
  faces: number;
  /** 0..1: how clearly a main subject stands out. */
  subjectClarity: number;
};

export type OutlineResult = { uri: string; width: number; height: number; info?: OutlineInfo; preview?: boolean };

export class OutlineAbortedError extends Error {
  constructor() {
    super('Outline cancelled');
    this.name = 'AbortError';
  }
}

export function isAbortError(e: unknown): boolean {
  return e instanceof OutlineAbortedError || (e instanceof Error && e.name === 'AbortError');
}

// Progress budget: prepare (resize + decode) 0..0.2, outline 0.2..0.9, PNG + write 0.9..1.
const P_RESIZED = 0.1;
const P_DECODED = 0.2;
const P_OUTLINED = 0.9;

export type OutlinePipeline = {
  run(
    uri: string,
    opts: OutlineRunOptions,
    onProgress?: (p: number) => void,
    signal?: AbortToken,
  ): Promise<OutlineResult>;
  /** Drop the cached decoded source (e.g. when leaving the screen). */
  clear(): void;
};

export function makeOutlinePipeline(deps: OutlineDeps): OutlinePipeline {
  // The decoded source is cached so slider tweaks only redo the outline step.
  let cache: { key: string; img: RGBAImage; analysis?: Analysis; small?: { px: number; img: RGBAImage } } | null = null;
  let counter = 0;

  async function run(
    uri: string,
    opts: OutlineRunOptions,
    onProgress?: (p: number) => void,
    signal?: AbortToken,
  ): Promise<OutlineResult> {
    let last = 0;
    const report = (p: number) => {
      const v = Math.min(1, Math.max(last, p));
      last = v;
      if (onProgress) onProgress(v);
    };
    const check = () => {
      if (signal && signal.aborted) throw new OutlineAbortedError();
    };

    if (!uri) throw new Error('No image to outline.');
    const maxPx = opts.maxPx && opts.maxPx >= 16 ? Math.floor(opts.maxPx) : 1024;
    const turns = (((Math.round(opts.rotateTurns ?? 0) % 4) + 4) % 4);
    const key = `${uri}|${turns}|${maxPx}`;

    check();
    report(0);
    let img: RGBAImage;
    if (cache && cache.key === key) {
      img = cache.img;
    } else {
      const jpg = await deps.resizeToJpegBase64(uri, maxPx, turns);
      check();
      report(P_RESIZED);
      const decoded = deps.decodeJpeg(decodeBase64(jpg.base64));
      const { width: w, height: h, data } = decoded;
      if (!(w > 0 && h > 0) || !data || data.length !== w * h * 4) {
        throw new Error(`Couldn’t read that image (decoded ${w}×${h}).`);
      }
      // The resizer should already have capped the size; refuse runaway inputs rather than hang.
      const fit = fitWithin(w, h, maxPx);
      if (fit.width !== w || fit.height !== h) {
        throw new Error(`Image is ${w}×${h}, larger than the ${maxPx}px limit.`);
      }
      img = { width: w, height: h, data };
      cache = { key, img };
      await deps.yieldFn();
      check();
      report(P_DECODED);
    }

    const tick = async () => {
      await deps.yieldFn();
      check();
    };
    // Face / subject analysis depends only on the image: compute once per source.
    const entry = cache && cache.img === img ? cache : null;
    let analysis = entry?.analysis;
    if (!analysis) {
      analysis = analyze(img);
      if (entry) entry.analysis = analysis;
      await deps.yieldFn();
      check();
    }
    const info: OutlineInfo = {
      autoKind: analysis.autoKind,
      faces: analysis.faces.length,
      subjectClarity: analysis.subject.clarity,
    };
    // Preview: same engine on a small copy, with the full-size analysis rescaled to it.
    const pv = opts.previewPx && opts.previewPx >= 16 ? Math.floor(opts.previewPx) : 0;
    let work = img;
    if (pv && pv < Math.max(img.width, img.height)) {
      if (entry && entry.small && entry.small.px === pv) {
        work = entry.small.img;
      } else {
        work = downscaleRGBA(img, pv);
        if (entry) entry.small = { px: pv, img: work };
        await deps.yieldFn();
        check();
      }
    }
    const workAnalysis = work === img ? analysis : scaleAnalysis(analysis, work.width, work.height);
    const art = await runChunked(outlineSteps(work, { ...opts, analysis: workAnalysis }), tick, (p) => report(P_DECODED + (P_OUTLINED - P_DECODED) * p));
    check();
    report(P_OUTLINED);

    const png = deps.encodePng(art.data, art.width, art.height);
    await deps.yieldFn();
    check();
    const b64 = encodeBase64(png);
    counter = (counter + 1) % 1e6;
    const name = `outline-${Date.now().toString(36)}-${counter}.png`;
    const out = await deps.writeCacheFile(name, b64);
    check();
    report(1);
    return work === img
      ? { uri: out, width: art.width, height: art.height, info }
      : { uri: out, width: art.width, height: art.height, info, preview: true };
  }

  return {
    run,
    clear() {
      cache = null;
    },
  };
}
