// Live Lock Screen payload (docs/LIVELOCK.md). The JS adapter (src/native/livelock.ts)
// sends this JSON to the Swift module's start(json:). The Swift side decodes exactly
// these fields (modules/glaze-livelock/ios/LivelockPayload.swift); keep both in step.
// Pure TypeScript: no React Native or Expo imports, so Node runs it directly.
//
// T135: the loop is exported at 3:4 (ARTWORK_EXPORT_WIDTH x ARTWORK_EXPORT_HEIGHT), not at the
// screen aspect. Apple's "Providing animated artwork for media items": the video and the preview
// image must match the key's aspect ratio (MPNowPlayingInfoProperty3x4AnimatedArtwork = 3:4), or
// "the system will ignore your animated artwork and display your static artwork". The old export
// at ~9:19.5 is why the owner only saw a small static player.
import {
  MAX_LOOP_MS,
  clampCrop,
  cropRect,
  exportBitrate,
  lockAspect,
  sanitizeProject,
  type Codec,
  type Crop,
  type Device,
  type LoopKind,
  type LoopProject,
  type LoopSpeed,
  type Rect,
  type Size,
  type Trim,
} from './loop.ts';

export const LIVELOCK_PAYLOAD_VERSION = 1;
/** Every loop in a playlist is exported up front; keep the first start reasonably quick. */
export const MAX_LIVELOCK_PROJECTS = 12;

export type LivelockExport = {
  width: number;
  height: number;
  fps: number;
  codec: Codec;
  /** Target average bitrate (bits/s). Used by the GIF writer; video presets pick their own. */
  bitrate: number;
  maxDurationMs: number;
};

export type LivelockProjectPayload = {
  id: string;
  name: string;
  /** file:// URI or absolute path on this device. */
  sourceUri: string;
  kind: LoopKind;
  /** Display-oriented source size the crop rect was computed against. */
  sourceWidth: number;
  sourceHeight: number;
  /** Source range. endMs <= startMs means "unknown: use the whole clip, capped". Ignored for GIFs. */
  trim: Trim;
  /** Normalised crop, for reference. */
  crop: Crop;
  /**
   * Pixel crop in source (display orientation) coordinates, at the export aspect: exactly 3:4
   * (artworkCropRect of the user's screen-aspect crop), so the render is never stretched.
   */
  cropRect: Rect;
  speed: LoopSpeed;
};

export type LivelockPayload = {
  version: number;
  export: LivelockExport;
  projects: LivelockProjectPayload[];
};

export type LivelockBuildError = 'empty' | 'no-valid-projects';
export type LivelockBuildResult =
  | { ok: true; payload: LivelockPayload; json: string; skipped: string[] }
  | { ok: false; error: LivelockBuildError; skipped: string[] };

/** Only local files: Photos and videos never leave the device, and the exporter reads files. */
export function isLocalSourceUri(uri: unknown): uri is string {
  if (typeof uri !== 'string' || !uri) return false;
  return uri.startsWith('file://') || uri.startsWith('/');
}

// ---------------------------------------------------------------------------
// 3:4 animated artwork (T135)

/** Width / height of the tall animated artwork (MPNowPlayingInfoProperty3x4AnimatedArtwork). */
export const ARTWORK_ASPECT = 3 / 4;
/** Export size of the animated artwork video: exactly 3:4, even dimensions. */
export const ARTWORK_EXPORT_WIDTH = 1080;
export const ARTWORK_EXPORT_HEIGHT = 1440;
/** Apple: at most 60 fps. We render at 30 (smaller files, less decoding on the Lock Screen). */
export const ARTWORK_FPS = 30;

/** Export settings for the animated artwork: 1080x1440 (3:4), 30 fps, no audio, ≤ 15 s. */
export function artworkExport(codec: Codec = 'hevc'): LivelockExport {
  return {
    width: ARTWORK_EXPORT_WIDTH,
    height: ARTWORK_EXPORT_HEIGHT,
    fps: ARTWORK_FPS,
    codec,
    bitrate: exportBitrate(ARTWORK_EXPORT_WIDTH, ARTWORK_EXPORT_HEIGHT, codec),
    maxDurationMs: MAX_LOOP_MS,
  };
}

/** True when width:height is exactly 3:4 (integer check, no float rounding). */
export function isThreeByFour(width: number, height: number): boolean {
  return width > 0 && height > 0 && width * 4 === height * 3;
}

/**
 * The 3:4 crop (source pixels, display orientation) for the animated artwork, derived from the
 * user's crop `user` (made at the screen aspect in the editor):
 * - same centre as the user's crop (moved only as far as needed to stay inside the source);
 * - tall enough to cover the user's crop (its height, and its width at 3:4) when the source allows;
 *   otherwise the largest 3:4 rect that fits inside the source;
 * - exactly 3:4 with even sides (width = 6k, height = 8k) whenever the source is at least 6x8.
 */
export function artworkCropRect(source: Size, user: Rect): Rect {
  const W = Math.max(1, Math.floor(Number.isFinite(source.width) ? source.width : 1));
  const H = Math.max(1, Math.floor(Number.isFinite(source.height) ? source.height : 1));
  const ok = (v: number) => Number.isFinite(v) && v > 0;
  const u: Rect = ok(user.width) && ok(user.height) && Number.isFinite(user.x) && Number.isFinite(user.y)
    ? user
    : { x: 0, y: 0, width: W, height: H };
  // Height that covers the user's crop (height, and width at 3:4), capped by the source.
  const want = Math.max(u.height, u.width / ARTWORK_ASPECT);
  const kMax = Math.min(Math.floor(W / 6), Math.floor(H / 8));
  if (kMax < 1) return { x: 0, y: 0, width: W, height: H }; // tiny source: nothing sensible to crop
  const k = Math.max(1, Math.min(kMax, Math.ceil(want / 8)));
  const width = 6 * k;
  const height = 8 * k;
  const cx = u.x + u.width / 2;
  const cy = u.y + u.height / 2;
  const clampTo = (v: number, max: number) => Math.min(Math.max(v, 0), max);
  const x = clampTo(Math.round(cx - width / 2), W - width);
  const y = clampTo(Math.round(cy - height / 2), H - height);
  return { x, y, width, height };
}

/**
 * Build the start() payload for `projects` (playlist order) on `device` (the device only sets the
 * aspect of the user's crop; the export is always the 3:4 artwork size).
 * Invalid projects (bad data, non-local sources, duplicates) are skipped and reported
 * by id; the list is capped at MAX_LIVELOCK_PROJECTS.
 */
export function buildLivelockPayload(
  projects: readonly unknown[],
  device: Device,
  opts: { codec?: Codec } = {},
): LivelockBuildResult {
  const skipped: string[] = [];
  if (!Array.isArray(projects) || projects.length === 0) return { ok: false, error: 'empty', skipped };
  const aspect = lockAspect(device);
  const seen = new Set<string>();
  const out: LivelockProjectPayload[] = [];
  for (const raw of projects) {
    const p: LoopProject | null = sanitizeProject(raw);
    const rawId =
      raw && typeof raw === 'object' && typeof (raw as { id?: unknown }).id === 'string'
        ? (raw as { id: string }).id
        : '?';
    if (!p || !isLocalSourceUri(p.sourceUri) || seen.has(p.id)) {
      skipped.push(p ? p.id : rawId);
      continue;
    }
    if (out.length >= MAX_LIVELOCK_PROJECTS) {
      skipped.push(p.id);
      continue;
    }
    seen.add(p.id);
    const crop = clampCrop(p.crop);
    const source = { width: p.sourceWidth, height: p.sourceHeight };
    out.push({
      id: p.id,
      name: p.name,
      sourceUri: p.sourceUri,
      kind: p.kind,
      sourceWidth: p.sourceWidth,
      sourceHeight: p.sourceHeight,
      trim: p.kind === 'gif' ? { startMs: 0, endMs: 0 } : { startMs: p.trim.startMs, endMs: p.trim.endMs },
      crop,
      cropRect: artworkCropRect(source, cropRect(source, aspect, crop)),
      speed: p.speed,
    });
  }
  if (out.length === 0) return { ok: false, error: 'no-valid-projects', skipped };
  const payload: LivelockPayload = {
    version: LIVELOCK_PAYLOAD_VERSION,
    export: artworkExport(opts.codec),
    projects: out,
  };
  return { ok: true, payload, json: JSON.stringify(payload), skipped };
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function isRect(v: unknown): v is Rect {
  if (!v || typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  return isNum(r.x) && isNum(r.y) && isNum(r.width) && isNum(r.height) && r.width > 0 && r.height > 0;
}

/**
 * Strict check of a payload JSON string, mirroring what the Swift decoder requires.
 * Returns the payload or null.
 */
export function parseLivelockPayload(json: string): LivelockPayload | null {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.version !== LIVELOCK_PAYLOAD_VERSION) return null;
  const e = o.export as Record<string, unknown> | undefined;
  if (!e || typeof e !== 'object') return null;
  if (!isNum(e.width) || !isNum(e.height) || !isNum(e.fps) || !isNum(e.bitrate) || !isNum(e.maxDurationMs)) return null;
  if (e.width <= 0 || e.height <= 0 || e.width > e.height) return null; // portrait only
  if (!isThreeByFour(e.width, e.height)) return null; // T135: the 3x4 artwork key needs a 3:4 video
  if (e.fps > 60) return null; // Apple: animated artwork at most 60 fps
  if (e.codec !== 'hevc' && e.codec !== 'h264') return null;
  if (!Array.isArray(o.projects) || o.projects.length === 0 || o.projects.length > MAX_LIVELOCK_PROJECTS) return null;
  for (const item of o.projects) {
    if (!item || typeof item !== 'object') return null;
    const p = item as Record<string, unknown>;
    if (typeof p.id !== 'string' || !p.id || typeof p.name !== 'string') return null;
    if (!isLocalSourceUri(p.sourceUri)) return null;
    if (p.kind !== 'video' && p.kind !== 'gif') return null;
    if (!isNum(p.sourceWidth) || !isNum(p.sourceHeight)) return null;
    const t = p.trim as Record<string, unknown> | undefined;
    if (!t || !isNum(t.startMs) || !isNum(t.endMs)) return null;
    if (!isRect(p.cropRect)) return null;
    if (p.speed !== 0.5 && p.speed !== 1 && p.speed !== 1.5) return null;
  }
  return raw as LivelockPayload;
}
