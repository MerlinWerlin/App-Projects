// Recent-images list logic (PLAN §5): dedupe by uri, newest first, cap 12. Pure TS.
// Own copies are stored as names relative to the images folder, because the iOS app container
// path changes after updates/reinstalls; full uris are rebuilt on load.

export type RecentItem = { uri: string; addedAt: number; width?: number; height?: number };

export const RECENT_CAP = 12;

export type AddResult = { list: RecentItem[]; evicted: RecentItem[] };

/** Adds (or moves) `item` to the front. Returns the new list and any items pushed past the cap. */
export function addRecent(list: readonly RecentItem[], item: RecentItem): AddResult {
  const rest = list.filter((r) => r.uri !== item.uri);
  const prev = list.find((r) => r.uri === item.uri);
  const merged: RecentItem = {
    uri: item.uri,
    addedAt: item.addedAt,
    ...dims(item.width ?? prev?.width, item.height ?? prev?.height),
  };
  const all = [merged, ...rest];
  return { list: all.slice(0, RECENT_CAP), evicted: all.slice(RECENT_CAP) };
}

export function removeRecent(list: readonly RecentItem[], uri: string): RecentItem[] {
  return list.filter((r) => r.uri !== uri);
}

const IMAGES_SEGMENT = '/images/';

function withSlash(dir: string): string {
  return dir.endsWith('/') ? dir : `${dir}/`;
}

/** True for file:// uris and bare absolute paths (the only kinds that can point into our folder). */
function isLocalPath(uri: string): boolean {
  return uri.startsWith('file://') || uri.startsWith('/');
}

function hasScheme(ref: string): boolean {
  return /^[A-Za-z][A-Za-z0-9+.-]*:/.test(ref);
}

/** Name after the last '/images/' of a local path, or null if there is none. */
function nameInImages(uri: string): string | null {
  if (!isLocalPath(uri)) return null;
  const i = uri.lastIndexOf(IMAGES_SEGMENT);
  if (i < 0) return null;
  const name = uri.slice(i + IMAGES_SEGMENT.length);
  return name.length > 0 ? name : null;
}

/**
 * What to persist for `uri`: a name relative to `imagesDir` for our own copies (including stale
 * absolute paths from an older container), otherwise the uri unchanged (content://, ph://, ...).
 */
export function toStoredRef(uri: string, imagesDir: string): string {
  const dir = withSlash(imagesDir);
  if (uri.startsWith(dir) && uri.length > dir.length) return uri.slice(dir.length);
  return nameInImages(uri) ?? uri;
}

/** Full uri for a stored ref: relative names (and legacy absolute paths) resolve against `imagesDir`. */
export function fromStoredRef(ref: string, imagesDir: string): string {
  const dir = withSlash(imagesDir);
  if (!hasScheme(ref) && !ref.startsWith('/')) return `${dir}${ref}`;
  const name = nameInImages(ref);
  return name != null ? `${dir}${name}` : ref;
}

/** JSON to persist: own copies become relative names so they survive container path changes. */
export function serializeRecent(list: readonly RecentItem[], imagesDir: string): string {
  return JSON.stringify(list.map((r) => ({ ...r, uri: toStoredRef(r.uri, imagesDir) })));
}

/**
 * Parses stored JSON; anything malformed is dropped. Result is deduped, newest first, capped.
 * With `imagesDir`, stored refs (relative names or legacy absolute uris) become full uris in it.
 */
export function parseRecent(json: string | null, imagesDir?: string): RecentItem[] {
  if (json == null) return [];
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  const all: RecentItem[] = [];
  for (const v of raw) {
    const it = toItem(v);
    if (it) all.push(imagesDir != null ? { ...it, uri: fromStoredRef(it.uri, imagesDir) } : it);
  }
  // Sort before deduping so the newest entry for a uri wins (stable sort keeps ties in order).
  all.sort((a, b) => b.addedAt - a.addedAt);
  const items: RecentItem[] = [];
  const seen = new Set<string>();
  for (const it of all) {
    if (!seen.has(it.uri)) {
      seen.add(it.uri);
      items.push(it);
    }
  }
  return items.slice(0, RECENT_CAP);
}

function toItem(v: unknown): RecentItem | null {
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  if (typeof o.uri !== 'string' || o.uri.length === 0) return null;
  if (typeof o.addedAt !== 'number' || !Number.isFinite(o.addedAt)) return null;
  return { uri: o.uri, addedAt: o.addedAt, ...dims(o.width, o.height) };
}

function dims(w: unknown, h: unknown): { width?: number; height?: number } {
  const out: { width?: number; height?: number } = {};
  if (typeof w === 'number' && Number.isFinite(w) && w > 0) out.width = w;
  if (typeof h === 'number' && Number.isFinite(h) && h > 0) out.height = h;
  return out;
}
