// Live Lock Screen payload (docs/LIVELOCK.md). The JS adapter (src/native/livelock.ts)
// sends this JSON to the Swift module's start(json:). The Swift side decodes exactly
// these fields (modules/glaze-livelock/ios/LivelockPayload.swift); keep both in step.
// Pure TypeScript: no React Native or Expo imports, so Node runs it directly.
import {
  clampCrop,
  cropRect,
  exportSettings,
  lockAspect,
  sanitizeProject,
  type Codec,
  type Crop,
  type Device,
  type LoopKind,
  type LoopProject,
  type LoopSpeed,
  type Rect,
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
  /** Pixel crop in source (display orientation) coordinates, at the export aspect. */
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

function exportFor(device: Device, codec: Codec | undefined): LivelockExport {
  const s = exportSettings(device, { codec });
  return {
    width: s.width,
    height: s.height,
    fps: s.fps,
    codec: s.codec,
    bitrate: s.bitrate,
    maxDurationMs: s.maxDurationMs,
  };
}

/**
 * Build the start() payload for `projects` (playlist order) on `device`.
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
    out.push({
      id: p.id,
      name: p.name,
      sourceUri: p.sourceUri,
      kind: p.kind,
      sourceWidth: p.sourceWidth,
      sourceHeight: p.sourceHeight,
      trim: p.kind === 'gif' ? { startMs: 0, endMs: 0 } : { startMs: p.trim.startMs, endMs: p.trim.endMs },
      crop,
      cropRect: cropRect({ width: p.sourceWidth, height: p.sourceHeight }, aspect, crop),
      speed: p.speed,
    });
  }
  if (out.length === 0) return { ok: false, error: 'no-valid-projects', skipped };
  const payload: LivelockPayload = {
    version: LIVELOCK_PAYLOAD_VERSION,
    export: exportFor(device, opts.codec),
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
