// Live Photo export payload (docs/PLAN.md §3 "Live Photo", docs/LIVEPHOTO.md).
// Builds and validates the JSON the GlazeLivePhoto native module (modules/glaze-livephoto)
// receives. Pure TypeScript: no React Native or Expo imports, so Node runs it directly.
//
// Live Photos are short: the exported clip is at most LIVE_PHOTO_MAX_MS long (after speed),
// taken from the START of the loop's trim range. The still frame sits in the middle of it.
import {
  cropRect,
  exportSettings,
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
/** Shortest clip worth saving (output time). */
export const LIVE_PHOTO_MIN_MS = 500;

export type LivePhotoPayload = {
  sourceUri: string;
  /** Source time range to read (ms in the source video). */
  trim: Trim;
  /** Pixel crop in source pixels, measured against `source` (display orientation). */
  crop: Rect;
  /** Source size the crop was measured against; the module rescales if the decoded size differs. */
  source: Size;
  speed: LoopSpeed;
  /** Output size in pixels (portrait, from exportSettings). */
  width: number;
  height: number;
  fps: number;
  /** Target average video bitrate (bits per second, H.264). */
  bitrate: number;
  /** Output clip length in ms (after speed), ≤ LIVE_PHOTO_MAX_MS. */
  durationMs: number;
  /** Still frame time in the OUTPUT clip (ms), the middle of it. */
  stillTimeMs: number;
};

export type LivePhotoBuildError = 'no-source' | 'gif' | 'too-short';

export type LivePhotoBuildResult =
  | { ok: true; payload: LivePhotoPayload }
  | { ok: false; error: LivePhotoBuildError };

const finite = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;
const even = (n: number): number => Math.max(2, n - (n % 2));

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

/** Build the native payload for a loop project on a device, or say why it can't be done. */
export function buildLivePhotoPayload(project: LoopProject, device: Device): LivePhotoBuildResult {
  if (!project.sourceUri) return { ok: false, error: 'no-source' };
  // AVFoundation can't read GIFs as video; GIF loops need converting first (not in v1).
  if (project.kind === 'gif') return { ok: false, error: 'gif' };
  const speed = project.speed;
  const trim = livePhotoTrim(project.trim, speed);
  const durationMs = Math.round((trim.endMs - trim.startMs) / speed);
  if (durationMs < LIVE_PHOTO_MIN_MS) return { ok: false, error: 'too-short' };
  const settings = exportSettings(device, { codec: 'h264' });
  const source = { width: project.sourceWidth, height: project.sourceHeight };
  return {
    ok: true,
    payload: {
      sourceUri: project.sourceUri,
      trim,
      crop: cropRect(source, lockAspect(device), project.crop),
      source,
      speed,
      // Video encoders want even sizes (some screens, e.g. 1179 px wide, are odd).
      width: even(settings.width),
      height: even(settings.height),
      fps: settings.fps,
      bitrate: settings.bitrate,
      durationMs,
      stillTimeMs: Math.round(durationMs / 2),
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
  return errors;
}
