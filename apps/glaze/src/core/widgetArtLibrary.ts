// T221 (owner-1101e): "My widget art" library. Every art piece the user applies from a theme, and
// every photo the Widget Studio copies for the Photo widget, is ADDED to a library in the App Group
// instead of only overwriting the one image per size. Each Glaze "Seamless" widget on the Home
// Screen can then show its own piece (long-press > Edit Widget > Art; iOS 17 AppIntentConfiguration
// in targets/widget/SeamlessWidget.swift + WidgetArtLibrary.swift).
//
// Storage (App Group container `group.com.jared797.glaze`):
//   widget-art/<id>.jpg   one composed image per piece (written by the bridge's saveWidgetArtPiece,
//                         a copy of the seamless-<size>.png it just composed, or of widget-photo.jpg)
//   widget-art/index.json this index (written by the bridge's setWidgetArtIndex, which also deletes
//                         every file in widget-art/ the index no longer lists, then reloads all
//                         widget timelines)
// The widget extension reads index.json (newest first) for the Edit Widget picker. A widget with no
// chosen piece, or whose piece was removed, shows the last applied image (seamless-<size>.png).
//
// Pure TS (Node runs it directly), tested in widgetArtLibrary.test.ts.

export const WIDGET_ART_DIR = 'widget-art';
export const WIDGET_ART_INDEX_FILE = 'index.json';
/** Most pieces kept; adding one more drops the oldest (by `created`). */
export const WIDGET_ART_LIBRARY_CAP = 40;
/** Bridge-side id rule (GlazeWidgetBridgeModule.validArtId): keep the two in sync. */
export const WIDGET_ART_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
/** App Group files the bridge may copy into the library (saveWidgetArtPiece `from`). */
export const WIDGET_ART_SOURCES = ['seamless-small.png', 'seamless-medium.png', 'seamless-large.png', 'widget-photo.jpg'] as const;
export type WidgetArtSourceFile = (typeof WIDGET_ART_SOURCES)[number];

export type WidgetArtSource = 'theme' | 'photo';
export type WidgetArtSize = 'small' | 'medium' | 'large';

export type WidgetArtPiece = {
  id: string;
  /** Shown in the Edit Widget picker (already translated by the app when it was saved). */
  name: string;
  /** Picker subtitle; '' for a photo. */
  themeName: string;
  themeId: string | null;
  source: WidgetArtSource;
  /** File name inside widget-art/. */
  file: string;
  /** ms since epoch. */
  created: number;
  /** width / height of the stored image (0 = unknown). */
  aspect: number;
  /** Widget size the piece was composed for (null for photos). */
  size: WidgetArtSize | null;
};

export type WidgetArtIndex = { v: 1; pieces: WidgetArtPiece[] };

export function emptyLibrary(): WidgetArtIndex {
  return { v: 1, pieces: [] };
}

export function isValidPieceId(id: unknown): id is string {
  return typeof id === 'string' && WIDGET_ART_ID_RE.test(id);
}

export function pieceFileName(id: string): string {
  return `${id}.jpg`;
}

/** FNV-1a 32-bit, base 36. Deterministic, so the same piece always gets the same id. */
export function shortHash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

const slug = (s: string): string => s.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');

/** Id of a theme's art piece at one widget size: same theme + option + size = same piece (deduped). */
export function themePieceId(themeId: string, optionId: string, size: WidgetArtSize): string {
  const raw = `t-${slug(themeId)}-${slug(optionId)}-${size}`;
  if (raw.length <= 64 && isValidPieceId(raw)) return raw;
  return `t-${shortHash(`${themeId}\u0000${optionId}`)}-${size}`;
}

/** Id of a user photo (by its local URI): picking the same photo again does not add a copy. */
export function photoPieceId(uri: string): string {
  return `p-${shortHash(uri)}`;
}

const str = (v: unknown, max = 120): string => (typeof v === 'string' ? v.slice(0, max) : '');
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);

function normalisePiece(raw: unknown): WidgetArtPiece | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!isValidPieceId(r.id)) return null;
  const size = r.size === 'small' || r.size === 'medium' || r.size === 'large' ? r.size : null;
  return {
    id: r.id,
    name: str(r.name) || r.id,
    themeName: str(r.themeName),
    themeId: typeof r.themeId === 'string' ? r.themeId.slice(0, 120) : null,
    source: r.source === 'photo' ? 'photo' : 'theme',
    file: pieceFileName(r.id),
    created: num(r.created),
    aspect: num(r.aspect),
    size,
  };
}

/** Tolerant read of index.json: anything broken gives an empty library; duplicate ids keep the newest. */
export function parseLibrary(raw: string | null | undefined): WidgetArtIndex {
  if (typeof raw !== 'string' || raw.length === 0) return emptyLibrary();
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return emptyLibrary();
  }
  if (!data || typeof data !== 'object' || (data as { v?: unknown }).v !== 1) return emptyLibrary();
  const list = (data as { pieces?: unknown }).pieces;
  if (!Array.isArray(list)) return emptyLibrary();
  let lib = emptyLibrary();
  for (const item of list) {
    const p = normalisePiece(item);
    if (!p) continue;
    const prev = lib.pieces.find((q) => q.id === p.id);
    if (prev && prev.created >= p.created) continue;
    lib = { v: 1, pieces: [...lib.pieces.filter((q) => q.id !== p.id), p] };
  }
  return lib;
}

export function serializeLibrary(lib: WidgetArtIndex): string {
  return JSON.stringify({ v: 1, pieces: listPieces(lib) });
}

/** Newest first; ties by id so the order is stable. This is the Edit Widget picker order too. */
export function listPieces(lib: WidgetArtIndex): WidgetArtPiece[] {
  return [...lib.pieces].sort((a, b) => b.created - a.created || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export type AddResult = { lib: WidgetArtIndex; added: boolean; evicted: string[] };

/**
 * Adds a piece (or refreshes one with the same id: newer details, moved to the top). Over `cap`,
 * the oldest pieces are dropped and listed in `evicted` (the bridge deletes their files).
 */
export function addPiece(lib: WidgetArtIndex, piece: Omit<WidgetArtPiece, 'file'> & { file?: string }, cap = WIDGET_ART_LIBRARY_CAP): AddResult {
  const p = normalisePiece(piece);
  if (!p) return { lib, added: false, evicted: [] };
  const existed = lib.pieces.some((q) => q.id === p.id);
  const merged = listPieces({ v: 1, pieces: [p, ...lib.pieces.filter((q) => q.id !== p.id)] });
  const keep = Math.max(1, Math.floor(cap));
  // Never evict the piece just added, even if its clock is behind.
  const ordered = [p, ...merged.filter((q) => q.id !== p.id)];
  const kept = ordered.slice(0, keep);
  const evicted = ordered.slice(keep).map((q) => q.id);
  return { lib: { v: 1, pieces: listPieces({ v: 1, pieces: kept }) }, added: !existed, evicted };
}

export function removePiece(lib: WidgetArtIndex, id: string): WidgetArtIndex {
  return { v: 1, pieces: lib.pieces.filter((p) => p.id !== id) };
}
