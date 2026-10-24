// Live Lock Screen loop maths (docs/PLAN.md §3, §4 /(tabs)/live, §6).
// Pure TypeScript: no React Native or Expo imports, so Node runs it directly.

export type LoopKind = 'video' | 'gif';
export type LoopSpeed = 0.5 | 1 | 1.5;

export type Trim = { startMs: number; endMs: number };

/**
 * Crop is normalised so it survives any display size:
 * - scale: 1 = the largest Lock Screen-aspect rect that fits the source, up to MAX_SCALE.
 * - offsetX / offsetY: -1 (left/top edge) .. 0 (centred) .. 1 (right/bottom edge).
 */
export type Crop = { scale: number; offsetX: number; offsetY: number };

export type LoopProject = {
  id: string;
  name: string;
  sourceUri: string;
  kind: LoopKind;
  /** 0 when unknown (e.g. GIFs picked from Photos). */
  sourceDurationMs: number;
  sourceWidth: number;
  sourceHeight: number;
  trim: Trim;
  crop: Crop;
  speed: LoopSpeed;
  createdAt: number;
  updatedAt: number;
};

export type Size = { width: number; height: number };
export type Rect = { x: number; y: number; width: number; height: number };

export const MIN_TRIM_MS = 500;
export const MAX_LOOP_MS = 15_000;
export const MIN_SCALE = 1;
export const MAX_SCALE = 4;
export const SPEEDS: readonly LoopSpeed[] = [0.5, 1, 1.5];
export const DEFAULT_CROP: Crop = { scale: 1, offsetX: 0, offsetY: 0 };

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const finite = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

export function isSpeed(v: unknown): v is LoopSpeed {
  return v === 0.5 || v === 1 || v === 1.5;
}

// ---------------------------------------------------------------------------
// Trim

/**
 * Longest stretch of source you may pick at a given speed so the exported loop
 * (source length / speed) never exceeds MAX_LOOP_MS.
 */
export function maxTrimMs(speed: LoopSpeed = 1): number {
  return Math.round(MAX_LOOP_MS * Math.min(1, speed));
}

/** Length of the finished loop after speed is applied. */
export function loopDurationMs(trim: Trim, speed: LoopSpeed = 1): number {
  return Math.max(0, Math.round((trim.endMs - trim.startMs) / speed));
}

export type TrimOptions = {
  /** Which handle the user moved; the other one stays put where possible. Default 'start'. */
  anchor?: 'start' | 'end';
  speed?: LoopSpeed;
};

/**
 * Clamp a trim range: inside the source, at least MIN_TRIM_MS long and at most
 * maxTrimMs(speed) long. Sources shorter than MIN_TRIM_MS use their full length;
 * an unknown duration (0) gives { 0, 0 }.
 */
export function clampTrim(trim: Trim, sourceDurationMs: number, opts: TrimOptions = {}): Trim {
  const dur = Math.max(0, Math.round(finite(sourceDurationMs, 0)));
  if (dur <= MIN_TRIM_MS) return { startMs: 0, endMs: dur };
  const maxLen = Math.max(MIN_TRIM_MS, maxTrimMs(opts.speed ?? 1));
  let s = Math.round(finite(trim.startMs, 0));
  let e = Math.round(finite(trim.endMs, dur));
  if (opts.anchor === 'end') {
    e = clamp(e, MIN_TRIM_MS, dur);
    s = clamp(s, Math.max(0, e - maxLen), e - MIN_TRIM_MS);
  } else {
    s = clamp(s, 0, dur - MIN_TRIM_MS);
    e = clamp(e, s + MIN_TRIM_MS, Math.min(dur, s + maxLen));
  }
  return { startMs: s, endMs: e };
}

/** Position (ms) under an x coordinate on a trim track of `trackWidth`. */
export function msAtX(x: number, trackWidth: number, sourceDurationMs: number): number {
  if (!(trackWidth > 0) || !(sourceDurationMs > 0)) return 0;
  return Math.round(clamp(x / trackWidth, 0, 1) * sourceDurationMs);
}

/** x coordinate of a time on a trim track of `trackWidth`. */
export function xAtMs(ms: number, trackWidth: number, sourceDurationMs: number): number {
  if (!(trackWidth > 0) || !(sourceDurationMs > 0)) return 0;
  return clamp(ms / sourceDurationMs, 0, 1) * trackWidth;
}

/**
 * "4.5 s" style label. The UI passes `unit` to put the seconds (rounded to 0.1) into its
 * translated, locale-formatted unit string (e.g. `(value) => t('live.seconds', { value })`);
 * without it the label is the English "4.5 s".
 */
export function formatSeconds(ms: number, unit?: (seconds: number) => string): string {
  const s = Math.max(0, ms) / 1000;
  const rounded = Math.round(s * 10) / 10;
  if (unit) return unit(rounded);
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)} s`;
}

// ---------------------------------------------------------------------------
// Crop

export function clampCrop(crop: Partial<Crop> | null | undefined): Crop {
  const c = crop ?? {};
  return {
    scale: clamp(finite(c.scale, 1), MIN_SCALE, MAX_SCALE),
    offsetX: clamp(finite(c.offsetX, 0), -1, 1),
    offsetY: clamp(finite(c.offsetY, 0), -1, 1),
  };
}

/** Largest rect of `aspect` (width / height) that fits inside `source`, unrounded. */
function baseCropSize(source: Size, aspect: number): Size {
  const a = aspect > 0 ? aspect : 1;
  if (source.width / source.height > a) return { width: source.height * a, height: source.height };
  return { width: source.width, height: source.width / a };
}

/**
 * Pixel crop rect for `source` at the Lock Screen `aspect` (width / height).
 * Always fully inside the source, integer, with even width/height (video encoders
 * want even dimensions) whenever the source allows it.
 */
export function cropRect(source: Size, aspect: number, crop: Crop): Rect {
  const W = Math.max(1, Math.floor(finite(source.width, 1)));
  const H = Math.max(1, Math.floor(finite(source.height, 1)));
  const c = clampCrop(crop);
  const base = baseCropSize({ width: W, height: H }, aspect);
  const even = (v: number, max: number): number => {
    const n = Math.max(1, Math.min(max, Math.floor(v)));
    return n >= 2 ? n - (n % 2) : n;
  };
  const width = even(base.width / c.scale, W);
  const height = even(base.height / c.scale, H);
  const freeX = W - width;
  const freeY = H - height;
  const x = clamp(Math.round((freeX / 2) * (1 + c.offsetX)), 0, freeX);
  const y = clamp(Math.round((freeY / 2) * (1 + c.offsetY)), 0, freeY);
  return { x, y, width, height };
}

/**
 * Apply a pan of (dx, dy) display points, made inside a frame of `frameWidth`
 * points that shows the current crop, to the crop. Dragging right reveals more of
 * the left of the source (the image follows the finger).
 */
export function applyPan(
  crop: Crop,
  dx: number,
  dy: number,
  source: Size,
  aspect: number,
  frameWidth: number,
): Crop {
  const c = clampCrop(crop);
  if (!(frameWidth > 0) || !(source.width > 0) || !(source.height > 0)) return c;
  const base = baseCropSize(source, aspect);
  const cw = base.width / c.scale;
  const ch = base.height / c.scale;
  const pxPerPt = cw / frameWidth;
  const halfFreeX = (source.width - cw) / 2;
  const halfFreeY = (source.height - ch) / 2;
  const offsetX = halfFreeX > 0 ? c.offsetX - (dx * pxPerPt) / halfFreeX : c.offsetX;
  const offsetY = halfFreeY > 0 ? c.offsetY - (dy * pxPerPt) / halfFreeY : c.offsetY;
  return clampCrop({ scale: c.scale, offsetX, offsetY });
}

/**
 * Where to draw the whole source inside a clipping frame of `frameWidth` points
 * (height = frameWidth / aspect) so the frame shows exactly the crop.
 */
export function cropDisplayLayout(
  source: Size,
  aspect: number,
  crop: Crop,
  frameWidth: number,
): { left: number; top: number; width: number; height: number } {
  const c = clampCrop(crop);
  if (!(source.width > 0) || !(source.height > 0) || !(frameWidth > 0)) {
    return { left: 0, top: 0, width: frameWidth, height: frameWidth / (aspect > 0 ? aspect : 1) };
  }
  const base = baseCropSize(source, aspect);
  const cw = base.width / c.scale;
  const ch = base.height / c.scale;
  const k = frameWidth / cw; // points per source pixel
  const x = ((source.width - cw) / 2) * (1 + c.offsetX);
  const y = ((source.height - ch) / 2) * (1 + c.offsetY);
  return { left: -x * k, top: -y * k, width: source.width * k, height: source.height * k };
}

// ---------------------------------------------------------------------------
// Devices and export

export type Device = {
  id: string;
  name: string;
  /** Portrait screen size in points. */
  points: Size;
  /** Portrait screen size in pixels (native resolution). */
  pixels: Size;
  scale: number;
};

/** Portrait Lock Screen sizes, iPhone 12 to iPhone 17 (all hardware HEVC encode). */
export const DEVICES: readonly Device[] = [
  { id: 'mini', name: 'iPhone 12 mini / 13 mini', points: { width: 375, height: 812 }, pixels: { width: 1080, height: 2340 }, scale: 3 },
  { id: '6.1', name: 'iPhone 12 / 12 Pro / 13 / 13 Pro / 14 / 16e', points: { width: 390, height: 844 }, pixels: { width: 1170, height: 2532 }, scale: 3 },
  { id: '6.7', name: 'iPhone 12 Pro Max / 13 Pro Max / 14 Plus', points: { width: 428, height: 926 }, pixels: { width: 1284, height: 2778 }, scale: 3 },
  { id: '6.1-di', name: 'iPhone 14 Pro / 15 / 15 Pro / 16', points: { width: 393, height: 852 }, pixels: { width: 1179, height: 2556 }, scale: 3 },
  { id: '6.7-di', name: 'iPhone 14 Pro Max / 15 Plus / 15 Pro Max / 16 Plus', points: { width: 430, height: 932 }, pixels: { width: 1290, height: 2796 }, scale: 3 },
  { id: '6.3', name: 'iPhone 16 Pro / iPhone 17 / iPhone 17 Pro', points: { width: 402, height: 874 }, pixels: { width: 1206, height: 2622 }, scale: 3 },
  { id: 'air', name: 'iPhone Air', points: { width: 420, height: 912 }, pixels: { width: 1260, height: 2736 }, scale: 3 },
  { id: '6.9', name: 'iPhone 16 Pro Max / 17 Pro Max', points: { width: 440, height: 956 }, pixels: { width: 1320, height: 2868 }, scale: 3 },
];

export const DEFAULT_DEVICE: Device = DEVICES.find((d) => d.id === '6.3') as Device;

/** Portrait width / height of a device's Lock Screen. */
export function lockAspect(device: Device): number {
  return device.pixels.width / device.pixels.height;
}

/**
 * Closest device for a screen size in points (either orientation). Exact matches
 * win; otherwise the nearest by area-and-aspect; non-positive input gives the default.
 */
export function deviceForScreen(widthPt: number, heightPt: number): Device {
  const w = Math.min(widthPt, heightPt);
  const h = Math.max(widthPt, heightPt);
  if (!(w > 0) || !(h > 0)) return DEFAULT_DEVICE;
  let best = DEFAULT_DEVICE;
  let bestScore = Infinity;
  for (const d of DEVICES) {
    const score = Math.abs(d.points.width - w) + Math.abs(d.points.height - h);
    if (score < bestScore) {
      best = d;
      bestScore = score;
    }
  }
  return best;
}

export type Codec = 'hevc' | 'h264';

export type ExportSettings = {
  width: number;
  height: number;
  fps: 30;
  codec: Codec;
  audio: false;
  maxDurationMs: number;
  container: 'mov';
  /** Target average bitrate in bits per second. */
  bitrate: number;
};

/**
 * Target average bitrate (bits/s) for a width x height export at 30 fps: ~0.08 bits/pixel/frame
 * for HEVC, ~1.6x that for H.264; rounded to 100 kbps.
 */
export function exportBitrate(width: number, height: number, codec: Codec): number {
  const bpp = codec === 'hevc' ? 0.08 : 0.13;
  return Math.round((width * height * 30 * bpp) / 100_000) * 100_000;
}

/** Export settings for a device: portrait at native resolution, 30 fps, no audio, ≤ 15 s. */
export function exportSettings(device: Device, opts: { codec?: Codec } = {}): ExportSettings {
  const codec = opts.codec ?? 'hevc';
  const bitrate = exportBitrate(device.pixels.width, device.pixels.height, codec);
  return {
    width: device.pixels.width,
    height: device.pixels.height,
    fps: 30,
    codec,
    audio: false,
    maxDurationMs: MAX_LOOP_MS,
    container: 'mov',
    bitrate,
  };
}

/**
 * Lock Screen areas the system draws over, as fractions of screen height
 * (portrait), used by the LockMock overlay.
 */
export const LOCK_SAFE_AREAS = {
  date: { top: 0.075, height: 0.035 },
  clock: { top: 0.11, height: 0.12 },
  controls: { bottom: 0.04, height: 0.06 },
} as const;

// ---------------------------------------------------------------------------
// Projects

export type NewProjectInput = {
  id: string;
  sourceUri: string;
  kind: LoopKind;
  sourceDurationMs?: number | null;
  sourceWidth: number;
  sourceHeight: number;
  name?: string;
  now?: number;
};

export function newProject(input: NewProjectInput): LoopProject {
  const now = input.now ?? Date.now();
  const dur = Math.max(0, Math.round(finite(input.sourceDurationMs, 0)));
  return {
    id: input.id,
    name: (input.name ?? '').trim() || 'Loop',
    sourceUri: input.sourceUri,
    kind: input.kind,
    sourceDurationMs: dur,
    sourceWidth: Math.max(1, Math.round(finite(input.sourceWidth, 1))),
    sourceHeight: Math.max(1, Math.round(finite(input.sourceHeight, 1))),
    trim: clampTrim({ startMs: 0, endMs: Math.min(dur, MAX_LOOP_MS) }, dur),
    crop: { ...DEFAULT_CROP },
    speed: 1,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * "Loop 3": the lowest unused "Loop N" for N ≥ 1 (compared case-insensitively). The UI passes
 * `nameFor` to use the translated name (e.g. `(n) => t('live.defaultName', { number: n })`).
 */
export function nextLoopName(existing: readonly string[], nameFor: (n: number) => string = (n) => `Loop ${n}`): string {
  const used = new Set(existing.map((n) => n.trim().toLowerCase()));
  for (let i = 1; ; i++) {
    const name = nameFor(i);
    if (!used.has(name.trim().toLowerCase())) return name;
  }
}

/** Validate an unknown value (e.g. parsed JSON) into a project, or null. */
export function sanitizeProject(v: unknown): LoopProject | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (typeof o.id !== 'string' || !o.id) return null;
  if (typeof o.sourceUri !== 'string' || !o.sourceUri) return null;
  const kind: LoopKind = o.kind === 'gif' ? 'gif' : 'video';
  const dur = Math.max(0, Math.round(finite(o.sourceDurationMs, 0)));
  const speed: LoopSpeed = isSpeed(o.speed) ? o.speed : 1;
  const t = (o.trim && typeof o.trim === 'object' ? o.trim : {}) as Partial<Trim>;
  const now = Date.now();
  const createdAt = finite(o.createdAt, now);
  return {
    id: o.id,
    name: typeof o.name === 'string' && o.name.trim() ? o.name : 'Loop',
    sourceUri: o.sourceUri,
    kind,
    sourceDurationMs: dur,
    sourceWidth: Math.max(1, Math.round(finite(o.sourceWidth, 1))),
    sourceHeight: Math.max(1, Math.round(finite(o.sourceHeight, 1))),
    trim: clampTrim({ startMs: finite(t.startMs, 0), endMs: finite(t.endMs, dur) }, dur, { speed }),
    crop: clampCrop(o.crop as Partial<Crop> | undefined),
    speed,
    createdAt,
    updatedAt: finite(o.updatedAt, createdAt),
  };
}

// ---------------------------------------------------------------------------
// Playlist (ordered list of project ids)

export function addToPlaylist(list: readonly string[], id: string): string[] {
  return list.includes(id) ? [...list] : [...list, id];
}

export function removeFromPlaylist(list: readonly string[], id: string): string[] {
  return list.filter((x) => x !== id);
}

/** Move the item at `from` to index `to` (clamped). Out-of-range `from` returns a copy. */
export function movePlaylistItem(list: readonly string[], from: number, to: number): string[] {
  const out = [...list];
  if (from < 0 || from >= out.length) return out;
  const [item] = out.splice(from, 1);
  out.splice(clamp(to, 0, out.length), 0, item);
  return out;
}

/** Next index, wrapping to 0 after the last; -1 for an empty list. */
export function nextPlaylistIndex(current: number, length: number): number {
  if (length <= 0) return -1;
  if (!(current >= 0) || current >= length - 1) return 0;
  return current + 1;
}

/** Total loop time of a playlist (unknown ids and unknown durations count 0). */
export function playlistDurationMs(projects: readonly LoopProject[], ids: readonly string[]): number {
  const byId = new Map(projects.map((p) => [p.id, p]));
  let total = 0;
  for (const id of ids) {
    const p = byId.get(id);
    if (p) total += loopDurationMs(p.trim, p.speed);
  }
  return total;
}

// ---------------------------------------------------------------------------
// Persistence format

export const LOOPS_STORE_VERSION = 1;

export type LoopsState = { projects: LoopProject[]; playlist: string[] };

export function serializeLoopsState(state: LoopsState): string {
  return JSON.stringify({ version: LOOPS_STORE_VERSION, projects: state.projects, playlist: state.playlist });
}

/** Parse stored JSON; corrupt or unknown data gives an empty (or partially recovered) state. */
export function parseLoopsState(json: string | null | undefined): LoopsState {
  const empty: LoopsState = { projects: [], playlist: [] };
  if (!json) return empty;
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return empty;
  }
  if (!raw || typeof raw !== 'object') return empty;
  const o = raw as Record<string, unknown>;
  if (typeof o.version === 'number' && o.version > LOOPS_STORE_VERSION) return empty;
  const projects: LoopProject[] = [];
  const seen = new Set<string>();
  for (const item of Array.isArray(o.projects) ? o.projects : []) {
    const p = sanitizeProject(item);
    if (p && !seen.has(p.id)) {
      seen.add(p.id);
      projects.push(p);
    }
  }
  const playlist: string[] = [];
  for (const id of Array.isArray(o.playlist) ? o.playlist : []) {
    if (typeof id === 'string' && seen.has(id) && !playlist.includes(id)) playlist.push(id);
  }
  return { projects, playlist };
}
