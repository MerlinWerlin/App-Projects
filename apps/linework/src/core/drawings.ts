// "My drawings" (T67, docs/MARKET.md §2.3 + §4.7): a free local gallery of paper-check snapshots.
// Pure TS. Newest first, cap 200. Own copies are stored as names relative to the drawings folder, because the
// iOS app container path changes after updates/reinstalls; full uris are rebuilt on load. Never gated by Plus.

export type Size = { width: number; height: number };

/** How the reference sat on the paper when the snapshot was taken (lets the full view line it up again). */
export type DrawingFit = {
  /** Trace screen size the snapshot covered. */
  view: Size;
  /** Overlay base size on that screen. */
  base: Size;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  mirror: boolean;
};

export type Drawing = {
  id: string;
  createdAt: number;
  /** The snapshot of the paper (own copy in the drawings folder). */
  photoUri: string;
  /** The traced photo / outline (own copy), when the reference was a photo. */
  sourceUri?: string;
  /** The template id, when the reference was a template. */
  templateId?: string;
  photoWidth?: number;
  photoHeight?: number;
  fit?: DrawingFit;
};

export const DRAWINGS_CAP = 200;

export type AddDrawingResult = { list: Drawing[]; evicted: Drawing[] };

/** Adds `d` (replacing any entry with the same id), newest first; returns entries pushed past the cap. */
export function addDrawing(list: readonly Drawing[], d: Drawing): AddDrawingResult {
  const all = sortNewest([d, ...list.filter((x) => x.id !== d.id)]);
  return { list: all.slice(0, DRAWINGS_CAP), evicted: all.slice(DRAWINGS_CAP) };
}

export type RemoveDrawingResult = { list: Drawing[]; removed: Drawing | null };

export function removeDrawing(list: readonly Drawing[], id: string): RemoveDrawingResult {
  const removed = list.find((d) => d.id === id) ?? null;
  return { list: list.filter((d) => d.id !== id), removed };
}

/** Newest first; stable for equal times. */
export function sortNewest(list: readonly Drawing[]): Drawing[] {
  return list
    .map((d, i) => ({ d, i }))
    .sort((a, b) => b.d.createdAt - a.d.createdAt || a.i - b.i)
    .map((e) => e.d);
}

/** A short unique-enough id: time + random suffix (`rand` in [0, 1)). Safe as a file-name stem. */
export function newDrawingId(now: number, rand: number): string {
  const r = Math.floor(Math.abs(rand) * 36 ** 6)
    .toString(36)
    .padStart(6, '0')
    .slice(0, 6);
  return `${Math.max(0, Math.floor(now)).toString(36)}-${r}`;
}

/** Every local file a drawing owns (photo, and the source copy when it has one). */
export function drawingFiles(d: Drawing): string[] {
  return d.sourceUri ? [d.photoUri, d.sourceUri] : [d.photoUri];
}

const SEGMENT = '/drawings/';

function withSlash(dir: string): string {
  return dir.endsWith('/') ? dir : `${dir}/`;
}

function hasScheme(ref: string): boolean {
  return /^[A-Za-z][A-Za-z0-9+.-]*:/.test(ref);
}

/** What to persist: a name relative to `dir` for own copies (also stale absolute paths), else the uri as is. */
export function toDrawingRef(uri: string, dir: string): string {
  const base = withSlash(dir);
  if (uri.startsWith(base) && uri.length > base.length) return uri.slice(base.length);
  if (uri.startsWith('file://') || uri.startsWith('/')) {
    const i = uri.lastIndexOf(SEGMENT);
    if (i >= 0 && uri.length > i + SEGMENT.length) return uri.slice(i + SEGMENT.length);
  }
  return uri;
}

/** Full uri for a stored ref: relative names resolve against `dir`; other uris come back unchanged. */
export function fromDrawingRef(ref: string, dir: string): string {
  if (!hasScheme(ref) && !ref.startsWith('/')) return `${withSlash(dir)}${ref}`;
  const name = toDrawingRef(ref, dir);
  return name !== ref ? `${withSlash(dir)}${name}` : ref;
}

export function serializeDrawings(list: readonly Drawing[], dir: string): string {
  return JSON.stringify(
    list.map((d) => ({
      ...d,
      photoUri: toDrawingRef(d.photoUri, dir),
      ...(d.sourceUri ? { sourceUri: toDrawingRef(d.sourceUri, dir) } : {}),
    })),
  );
}

/**
 * Parses stored JSON; anything malformed is dropped. Result is deduped by id (newest wins), newest first,
 * capped. With `dir`, stored refs become full uris in it.
 */
export function parseDrawings(json: string | null, dir?: string): Drawing[] {
  if (json == null) return [];
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  const all: Drawing[] = [];
  for (const v of raw) {
    const d = sanitizeDrawing(v);
    if (!d) continue;
    all.push(
      dir != null
        ? {
            ...d,
            photoUri: fromDrawingRef(d.photoUri, dir),
            ...(d.sourceUri ? { sourceUri: fromDrawingRef(d.sourceUri, dir) } : {}),
          }
        : d,
    );
  }
  const out: Drawing[] = [];
  const seen = new Set<string>();
  for (const d of sortNewest(all)) {
    if (seen.has(d.id)) continue;
    seen.add(d.id);
    out.push(d);
  }
  return out.slice(0, DRAWINGS_CAP);
}

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 && v.length <= 2048 ? v : undefined;
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function pos(v: unknown): number | undefined {
  const n = num(v);
  return n !== undefined && n > 0 ? n : undefined;
}

function size(v: unknown): Size | undefined {
  if (typeof v !== 'object' || v === null) return undefined;
  const o = v as Record<string, unknown>;
  const width = pos(o.width);
  const height = pos(o.height);
  return width !== undefined && height !== undefined ? { width, height } : undefined;
}

export function sanitizeFit(v: unknown): DrawingFit | undefined {
  if (typeof v !== 'object' || v === null) return undefined;
  const o = v as Record<string, unknown>;
  const view = size(o.view);
  const base = size(o.base);
  const x = num(o.x);
  const y = num(o.y);
  const scale = pos(o.scale);
  const rotation = num(o.rotation);
  if (!view || !base || x === undefined || y === undefined || scale === undefined || rotation === undefined) {
    return undefined;
  }
  return { view, base, x, y, scale, rotation, mirror: o.mirror === true };
}

/** One stored entry, or null when it is unusable. Unknown fields are dropped. */
export function sanitizeDrawing(v: unknown): Drawing | null {
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  if (typeof o.id !== 'string' || !ID_RE.test(o.id)) return null;
  const createdAt = num(o.createdAt);
  const photoUri = str(o.photoUri);
  if (createdAt === undefined || createdAt < 0 || !photoUri) return null;
  const d: Drawing = { id: o.id, createdAt, photoUri };
  const sourceUri = str(o.sourceUri);
  if (sourceUri) d.sourceUri = sourceUri;
  const templateId = str(o.templateId);
  if (templateId) d.templateId = templateId;
  const w = pos(o.photoWidth);
  const h = pos(o.photoHeight);
  if (w !== undefined && h !== undefined) {
    d.photoWidth = w;
    d.photoHeight = h;
  }
  const fit = sanitizeFit(o.fit);
  if (fit) d.fit = fit;
  return d;
}

/**
 * Fit for a full view of a different size: the base and offset scale with the view width (the snapshot
 * fills the view the same way). Without a stored fit the reference is centred at 90% of the shorter side.
 */
export function fitForView(
  fit: DrawingFit | undefined,
  view: Size,
): { base: Size; x: number; y: number; scale: number; rotation: number; mirror: boolean } {
  if (!fit) {
    const s = Math.max(0, Math.min(view.width, view.height) * 0.9);
    return { base: { width: s, height: s }, x: 0, y: 0, scale: 1, rotation: 0, mirror: false };
  }
  const kw = view.width > 0 ? view.width / fit.view.width : 1;
  const kh = view.height > 0 ? view.height / fit.view.height : 1;
  const k = Math.max(kw, kh); // the photo is shown "cover", so the larger factor matches it
  return {
    base: { width: fit.base.width * k, height: fit.base.height * k },
    x: fit.x * k,
    y: fit.y * k,
    scale: fit.scale,
    rotation: fit.rotation,
    mirror: fit.mirror,
  };
}
