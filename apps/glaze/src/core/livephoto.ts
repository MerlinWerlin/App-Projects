// Live Photo export payload (docs/PLAN.md §3 "Live Photo", docs/LIVEPHOTO.md).
// Builds and validates the JSON the GlazeLivePhoto native module (modules/glaze-livephoto)
// receives. Pure TypeScript: no React Native or Expo imports, so Node runs it directly.
//
// Live Photos are short: the exported clip is at most LIVE_PHOTO_MAX_MS long (after speed),
// taken from the START of the loop's trim range. The still frame sits in the middle of it.
//
// T153 (run 120) wallpaper recipe, docs/LIVEPHOTO.md "Wallpaper recipe (run 120)": the video is
// always 1080 x 1920 portrait (long side <= 1920 px, LivePaper docs/FINDINGS.md), HEVC, 30 fps,
// 1 to 3 s long, and the still is a frame of the video at >= 0.5 s (never at 0 s).
import {
  cropRect,
  exportBitrate,
  lockAspect,
  type Device,
  type LoopProject,
  type LoopSpeed,
  type Rect,
  type Size,
  type Trim,
} from './loop.ts';

/** Longest Live Photo clip (output time, after speed). Camera Live Photos are ~3 s. */
export const LIVE_PHOTO_MAX_MS = 3_000;
/** Shortest clip worth saving (output time). T153: 1 s, like the wallpaper exporters (PR #288: 1 to 3 s). */
export const LIVE_PHOTO_MIN_MS = 1_000;
/** T153: the still must not sit at 0 s; exporters that work keep it at or after 0.5 s. */
export const LIVE_PHOTO_STILL_MIN_MS = 500;
/** T153: the paired video is always this size (portrait). Long side over 1920 px fails as a wallpaper. */
export const LIVE_PHOTO_WALLPAPER_SIZE = { width: 1080, height: 1920 } as const;
/** T153: 30 fps, like camera Live Photos (60 fps conversions play back choppy). */
export const LIVE_PHOTO_FPS = 30;
/** T153: the paired video is HEVC; H.264 paired videos never passed as wallpapers (LivePaper). */
export const LIVE_PHOTO_CODEC = 'hevc' as const;

export type LivePhotoPayload = {
  sourceUri: string;
  /** Source time range to read (ms in the source video). */
  trim: Trim;
  /** Pixel crop in source pixels, measured against `source` (display orientation). */
  crop: Rect;
  /** Source size the crop was measured against; the module rescales if the decoded size differs. */
  source: Size;
  speed: LoopSpeed;
  /** Output size in pixels: always LIVE_PHOTO_WALLPAPER_SIZE (1080 x 1920, T153). */
  width: number;
  height: number;
  fps: number;
  /** Target average video bitrate (bits per second, HEVC). */
  bitrate: number;
  /** Output clip length in ms (after speed), ≤ LIVE_PHOTO_MAX_MS. */
  durationMs: number;
  /** Still frame time in the OUTPUT clip (ms), the middle of it, never before LIVE_PHOTO_STILL_MIN_MS. */
  stillTimeMs: number;
};

export type LivePhotoBuildError = 'no-source' | 'gif' | 'too-short';

export type LivePhotoBuildResult =
  | { ok: true; payload: LivePhotoPayload }
  | { ok: false; error: LivePhotoBuildError };

const finite = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

/**
 * Clamp a trim range to a Live Photo: keep the start, cut the source range so the
 * output (source length / speed) is at most LIVE_PHOTO_MAX_MS.
 */
export function livePhotoTrim(trim: Trim, speed: LoopSpeed = 1): Trim {
  const s = Math.max(0, Math.round(finite(trim.startMs, 0)));
  const e = Math.max(s, Math.round(finite(trim.endMs, s)));
  const maxSourceMs = Math.round(LIVE_PHOTO_MAX_MS * speed);
  return { startMs: s, endMs: Math.min(e, s + maxSourceMs) };
}

/**
 * Re-shape a crop rect to `aspect` (width / height) around the same centre: cut the long side
 * when it fits (aspect fill), and keep the rect inside the source. Integer pixels.
 */
export function fillCrop(rect: Rect, source: Size, aspect: number): Rect {
  let w = rect.width;
  let h = rect.height;
  if (w / h > aspect) w = h * aspect;
  else h = w / aspect;
  // Never larger than the source (a source narrower than 9:16 keeps its full width).
  if (w > source.width) { w = source.width; h = Math.min(source.height, w / aspect); }
  if (h > source.height) { h = source.height; w = Math.min(source.width, h * aspect); }
  w = Math.max(1, Math.floor(w));
  h = Math.max(1, Math.floor(h));
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const x = Math.min(Math.max(0, Math.round(cx - w / 2)), source.width - w);
  const y = Math.min(Math.max(0, Math.round(cy - h / 2)), source.height - h);
  return { x: Math.max(0, x), y: Math.max(0, y), width: w, height: h };
}

/** Build the native payload for a loop project on a device, or say why it can't be done. */
export function buildLivePhotoPayload(project: LoopProject, device: Device): LivePhotoBuildResult {
  if (!project.sourceUri) return { ok: false, error: 'no-source' };
  // AVFoundation can't read GIFs as video; GIF loops need converting first (not in v1).
  if (project.kind === 'gif') return { ok: false, error: 'gif' };
  const speed = project.speed;
  const trim = livePhotoTrim(project.trim, speed);
  const durationMs = Math.round((trim.endMs - trim.startMs) / speed);
  if (durationMs < LIVE_PHOTO_MIN_MS) return { ok: false, error: 'too-short' };
  const { width, height } = LIVE_PHOTO_WALLPAPER_SIZE;
  const source = { width: project.sourceWidth, height: project.sourceHeight };
  // The user framed the loop for this device's screen; keep that framing's centre and zoom but
  // aspect-fill it to 9:16, the shape iPhone's wallpaper Live Photos use (T153).
  const deviceCrop = cropRect(source, lockAspect(device), project.crop);
  return {
    ok: true,
    payload: {
      sourceUri: project.sourceUri,
      trim,
      crop: fillCrop(deviceCrop, source, width / height),
      source,
      speed,
      width,
      height,
      fps: LIVE_PHOTO_FPS,
      bitrate: exportBitrate(width, height, LIVE_PHOTO_CODEC),
      durationMs,
      stillTimeMs: Math.max(LIVE_PHOTO_STILL_MIN_MS, Math.round(durationMs / 2)),
    },
  };
}

const isPosInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v > 0;
const isNonNegInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;

/**
 * Check a payload before it crosses the bridge. Returns a list of problems (empty = valid).
 * The Swift side re-checks the essentials, but catching mistakes here keeps them testable.
 */
export function validateLivePhotoPayload(v: unknown): string[] {
  const errors: string[] = [];
  if (!v || typeof v !== 'object') return ['payload is not an object'];
  const p = v as Record<string, unknown>;
  if (typeof p.sourceUri !== 'string' || !p.sourceUri) errors.push('sourceUri missing');
  if (!(p.speed === 0.5 || p.speed === 1 || p.speed === 1.5)) errors.push('speed must be 0.5, 1 or 1.5');
  const speed = typeof p.speed === 'number' && p.speed > 0 ? p.speed : 1;
  const t = p.trim as Record<string, unknown> | undefined;
  if (!t || !isNonNegInt(t.startMs) || !isNonNegInt(t.endMs) || t.endMs <= t.startMs) {
    errors.push('trim must be integer ms with endMs > startMs');
  } else if ((t.endMs - t.startMs) / speed > LIVE_PHOTO_MAX_MS + 1) {
    errors.push(`clip longer than ${LIVE_PHOTO_MAX_MS} ms`);
  }
  if (!isPosInt(p.width) || !isPosInt(p.height)) errors.push('width/height must be positive integers');
  else if (p.width % 2 !== 0 || p.height % 2 !== 0) errors.push('width/height must be even');
  const s = p.source as Record<string, unknown> | undefined;
  const c = p.crop as Record<string, unknown> | undefined;
  if (!s || !isPosInt(s.width) || !isPosInt(s.height)) errors.push('source size missing');
  if (!c || !isNonNegInt(c.x) || !isNonNegInt(c.y) || !isPosInt(c.width) || !isPosInt(c.height)) {
    errors.push('crop must be an integer rect');
  } else if (s && isPosInt(s.width) && isPosInt(s.height)) {
    if (c.x + c.width > s.width || c.y + c.height > s.height) errors.push('crop outside source');
  }
  if (!isPosInt(p.fps)) errors.push('fps must be a positive integer');
  if (!isPosInt(p.bitrate)) errors.push('bitrate must be a positive integer');
  if (!isPosInt(p.durationMs) || p.durationMs > LIVE_PHOTO_MAX_MS) errors.push('durationMs out of range');
  if (!isNonNegInt(p.stillTimeMs) || (isPosInt(p.durationMs) && p.stillTimeMs > p.durationMs)) {
    errors.push('stillTimeMs must be inside the clip');
  }
  else if (p.stillTimeMs < LIVE_PHOTO_STILL_MIN_MS) errors.push(`stillTimeMs must be at least ${LIVE_PHOTO_STILL_MIN_MS} ms`);
  if (isPosInt(p.width) && isPosInt(p.height) && Math.max(p.width, p.height) > LIVE_PHOTO_WALLPAPER_SIZE.height) {
    errors.push(`long side over ${LIVE_PHOTO_WALLPAPER_SIZE.height} px`);
  }
  return errors;
}
