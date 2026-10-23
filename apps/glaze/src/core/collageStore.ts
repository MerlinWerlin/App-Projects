// Collage photo copies + saved draft (T97, oversight D82-1). Pure, Node-runnable.
//
// The system photo picker hands back files in a temporary cache that iOS may purge at any time.
// A saved collage must reopen, be edited and later serve as a Live Lock source, so the picked
// photos are copied into the app's own documents folder (`<documents>/collage/`) and the draft
// remembers only those copies. These helpers plan the copies, re-point copies after iOS moves the
// app container, parse/validate the saved draft, decide what can be restored from the files that
// still exist, list stale copies to delete, and pick a legible mock-clock ink for the preview.
// Photos never leave the device.
import { COLLAGE_SPACINGS, MAX_PHOTOS, MIN_PHOTOS, type CollageSpacing } from './collage.ts';
import { contrastRatio } from './colour.ts';

export const COLLAGE_DIR = 'collage/';
export const COLLAGE_DRAFT_KEY = 'glaze.collage.draft.v1';

export type CollagePhotoRef = { uri: string; width: number; height: number };

export type CollageDraft = {
  photos: CollagePhotoRef[];
  layoutId: string;
  spacing: CollageSpacing;
  themeId: string | null;
};

export type CopyStep = { from: string; to: string };

/** `<documents>/collage/` or null when the documents folder is unavailable. */
export function collageDir(documentDirectory: string | null | undefined): string | null {
  if (!documentDirectory) return null;
  return documentDirectory.endsWith('/') ? `${documentDirectory}${COLLAGE_DIR}` : `${documentDirectory}/${COLLAGE_DIR}`;
}

/** Image extension from a URI (query/hash ignored), lower-case; 'jpg' when unknown. */
export function photoExtension(uri: string): string {
  const m = /\.([a-z0-9]{2,5})(?:[?#].*)?$/i.exec(uri);
  return (m?.[1] ?? 'jpg').toLowerCase();
}

/** True when `uri` is already one of our own copies in `dir`. */
export function isOwnCopy(uri: string, dir: string | null): boolean {
  return !!dir && uri.startsWith(dir);
}

/**
 * Plan one copy per photo into `dir`, named `<stamp>-<index>.<ext>` so a new pick never
 * overwrites a copy the current draft still uses. Photos already in `dir` are kept as they are.
 * Returns `to: null` for every photo when there is no documents folder (originals are used).
 */
export function planCollageCopies(
  photos: readonly CollagePhotoRef[],
  dir: string | null,
  stamp: string,
): { from: string; to: string | null }[] {
  const safe = stamp.replace(/[^a-z0-9_-]/gi, '') || '0';
  return photos.map((p, i) => {
    if (!dir) return { from: p.uri, to: null };
    if (isOwnCopy(p.uri, dir)) return { from: p.uri, to: p.uri };
    return { from: p.uri, to: `${dir}${safe}-${i}.${photoExtension(p.uri)}` };
  });
}

/**
 * Apply copy results: photo i takes `copied[i]` when it is a string (copy succeeded), else
 * keeps its original URI (best effort; a failed copy never loses the pick).
 */
export function applyCopies(photos: readonly CollagePhotoRef[], copied: readonly (string | null)[]): CollagePhotoRef[] {
  return photos.map((p, i) => {
    const c = copied[i];
    return typeof c === 'string' && c.length > 0 ? { ...p, uri: c } : { ...p };
  });
}

/** iOS can move the app container between updates: re-point our copies at the current folder. */
export function resolveCollageUri(uri: string, dir: string | null): string {
  if (!dir) return uri;
  const m = /\/collage\/([^/]+)$/.exec(uri);
  return m && !uri.startsWith(dir) ? `${dir}${m[1]}` : uri;
}

function isPhoto(v: unknown): v is CollagePhotoRef {
  if (!v || typeof v !== 'object') return false;
  const p = v as Record<string, unknown>;
  return (
    typeof p.uri === 'string' &&
    p.uri.length > 0 &&
    typeof p.width === 'number' &&
    typeof p.height === 'number' &&
    Number.isFinite(p.width) &&
    Number.isFinite(p.height) &&
    p.width > 0 &&
    p.height > 0
  );
}

export function serializeCollageDraft(d: CollageDraft): string {
  return JSON.stringify({
    v: 1,
    photos: d.photos.slice(0, MAX_PHOTOS).map((p) => ({ uri: p.uri, width: p.width, height: p.height })),
    layoutId: d.layoutId,
    spacing: d.spacing,
    themeId: d.themeId,
  });
}

/** Parse a stored draft; null for anything missing, malformed or with fewer than 2 photos. */
export function parseCollageDraft(raw: string | null | undefined): CollageDraft | null {
  if (!raw) return null;
  let o: unknown;
  try {
    o = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!o || typeof o !== 'object') return null;
  const r = o as Record<string, unknown>;
  if (r.v !== 1 || !Array.isArray(r.photos)) return null;
  const photos = r.photos.filter(isPhoto).slice(0, MAX_PHOTOS).map((p) => ({ uri: p.uri, width: Math.round(p.width), height: Math.round(p.height) }));
  if (photos.length < MIN_PHOTOS) return null;
  const spacing = (COLLAGE_SPACINGS as readonly string[]).includes(r.spacing as string) ? (r.spacing as CollageSpacing) : 'thin';
  const layoutId = typeof r.layoutId === 'string' ? r.layoutId : '';
  const themeId = typeof r.themeId === 'string' ? r.themeId : null;
  return { photos, layoutId, spacing, themeId };
}

/**
 * What can be restored from a saved draft, given which files still exist. Copies are re-pointed
 * at the current folder first. Missing photos are dropped; below 2 photos nothing is restored.
 */
export function restoreCollageDraft(
  draft: CollageDraft,
  dir: string | null,
  exists: (uri: string) => boolean,
): { draft: CollageDraft | null; missing: number } {
  const photos = draft.photos.map((p) => ({ ...p, uri: resolveCollageUri(p.uri, dir) }));
  const kept = photos.filter((p) => exists(p.uri));
  const missing = photos.length - kept.length;
  if (kept.length < MIN_PHOTOS) return { draft: null, missing };
  return { draft: { ...draft, photos: kept }, missing };
}

/** File names in `dir` that no photo in `keep` uses any more (safe to delete). */
export function staleCollageCopies(fileNames: readonly string[], dir: string, keep: readonly CollagePhotoRef[]): string[] {
  const used = new Set(keep.filter((p) => p.uri.startsWith(dir)).map((p) => p.uri.slice(dir.length)));
  return fileNames.filter((n) => n.length > 0 && !n.includes('/') && !used.has(n));
}

/**
 * Mock Lock Screen ink for the collage preview: white unless the clock band's background
 * (both gradient ends) is so light that a dark ink reads clearly better.
 */
export function collageClockInk(bg: { from: string; to: string }): { ink: string; shadow: string } {
  const white = '#FFFFFF';
  const dark = '#1C1C1E';
  const w = Math.min(contrastRatio(white, bg.from), contrastRatio(white, bg.to));
  const d = Math.min(contrastRatio(dark, bg.from), contrastRatio(dark, bg.to));
  return w >= 3 || w >= d ? { ink: white, shadow: 'rgba(0,0,0,0.35)' } : { ink: dark, shadow: 'rgba(255,255,255,0.45)' };
}
