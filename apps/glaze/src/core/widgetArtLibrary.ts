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
// T237: a piece may carry `live` (src/core/liveArt.ts LiveArtSpec): the widget draws the live value
// (time, date, battery, countdown, focus timer) over it. Absent on older records = plain art.

import { parseLiveArtSpec, type LiveArtSpec } from './liveArt.ts';

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
  /** T237: what the widget draws live over this piece; absent = a picture only. */
  live?: LiveArtSpec;
  /**
   * T252: position of an auto-added theme piece among its theme's pieces of the same size (0 = the
   * first on the shelf). A widget whose piece was removed by a theme swap shows the new theme's
   * piece in the same slot (resolveWidgetPiece). Absent on photos and older records.
   */
  slot?: number;
};

/** T252: what a removed auto-added piece was (size + slot), so its widgets can be remapped. */
export type RetiredPiece = { size: WidgetArtSize | null; slot: number | null };
/** T252: most retired ids remembered (oldest forgotten first). */
export const WIDGET_ART_RETIRED_CAP = 120;

export type WidgetArtIndex = {
  v: 1;
  pieces: WidgetArtPiece[];
  /** T238: the theme whose auto-added art is kept (the widget falls back to its first piece). */
  currentThemeId?: string | null;
  /** T238: the one-time clean-up version already run (WIDGET_ART_MIGRATION). */
  migrated?: number;
  /**
   * T252: auto-added pieces removed by a theme swap, by id. Widgets still configured with one of
   * these ids show the current theme's piece of the same size + slot (WidgetArtStore.resolve).
   */
  retired?: Record<string, RetiredPiece>;
};

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
    // T237 (additive): keep a valid live spec, drop a broken one.
    ...liveField(r.live),
    // T252 (additive): slot of an auto-added theme piece.
    ...slotField(r.slot),
  };
}

function slotField(raw: unknown): { slot?: number } {
  return typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 && raw < 1000 ? { slot: raw } : {};
}

function readRetired(raw: unknown): Record<string, RetiredPiece> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const out: Record<string, RetiredPiece> = {};
  let n = 0;
  const entries = Object.entries(raw as Record<string, unknown>);
  // Keep the newest (last written) entries when over the cap.
  for (const [id, v] of entries.slice(Math.max(0, entries.length - WIDGET_ART_RETIRED_CAP))) {
    if (!isValidPieceId(id) || !v || typeof v !== 'object') continue;
    const r = v as Record<string, unknown>;
    const size = r.size === 'small' || r.size === 'medium' || r.size === 'large' ? r.size : null;
    const slot = slotField(r.slot).slot ?? null;
    out[id] = { size, slot };
    n++;
  }
  return n > 0 ? out : undefined;
}

function liveField(raw: unknown): { live?: LiveArtSpec } {
  const live = parseLiveArtSpec(raw);
  return live ? { live } : {};
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
  const meta = readMeta(data as Record<string, unknown>);
  for (const item of list) {
    const p = normalisePiece(item);
    if (!p) continue;
    const prev = lib.pieces.find((q) => q.id === p.id);
    if (prev && prev.created >= p.created) continue;
    lib = { v: 1, pieces: [...lib.pieces.filter((q) => q.id !== p.id), p] };
  }
  return { ...lib, ...meta };
}

function readMeta(r: Record<string, unknown>): Pick<WidgetArtIndex, 'currentThemeId' | 'migrated' | 'retired'> {
  const out: Pick<WidgetArtIndex, 'currentThemeId' | 'migrated' | 'retired'> = {};
  if (typeof r.currentThemeId === 'string' && r.currentThemeId.length > 0) out.currentThemeId = r.currentThemeId.slice(0, 120);
  if (typeof r.migrated === 'number' && Number.isFinite(r.migrated) && r.migrated > 0) out.migrated = Math.floor(r.migrated);
  const retired = readRetired(r.retired);
  if (retired) out.retired = retired;
  return out;
}

export function serializeLibrary(lib: WidgetArtIndex): string {
  return JSON.stringify({ v: 1, pieces: listPieces(lib), ...readMeta(lib as unknown as Record<string, unknown>) });
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
  const p0 = normalisePiece(piece);
  if (!p0) return { lib, added: false, evicted: [] };
  const prev = lib.pieces.find((q) => q.id === p0.id);
  const existed = prev !== undefined;
  // T252: re-applying an auto-added piece ("Use on my widget") keeps its slot.
  const p: WidgetArtPiece = p0.slot === undefined && prev?.slot !== undefined ? { ...p0, slot: prev.slot } : p0;
  const merged = listPieces({ v: 1, pieces: [p, ...lib.pieces.filter((q) => q.id !== p.id)] });
  const keep = Math.max(1, Math.floor(cap));
  // Never evict the piece just added, even if its clock is behind.
  const ordered = [p, ...merged.filter((q) => q.id !== p.id)];
  const kept = ordered.slice(0, keep);
  const evicted = ordered.slice(keep).map((q) => q.id);
  return { lib: { ...lib, v: 1, pieces: listPieces({ v: 1, pieces: kept }) }, added: !existed, evicted };
}

export function removePiece(lib: WidgetArtIndex, id: string): WidgetArtIndex {
  return { ...lib, v: 1, pieces: lib.pieces.filter((p) => p.id !== id) };
}

// ---------------------------------------------------------------- T238 clean-up (owner-1101g #6)
// "My widget art" piled up: every theme added its art and nothing went. Now:
// - a piece the person added themselves (source 'photo': their own photo) stays until they delete it;
// - every other piece is AUTO-ADDED theme art (unknown / missing source from older versions counts
//   as auto-added, normalisePiece maps it to 'theme'), and only the current theme's is kept:
//   applying a theme (or adding a theme's art) replaces the previous theme's pieces;
// - a one-time migration (WIDGET_ART_MIGRATION, flag `migrated` in index.json) drops leftovers from
//   older versions and other themes;
// - Manage: removeMany / clearAll.
// A widget whose piece went falls back to the current theme's first piece (index `currentThemeId`,
// targets/widget/WidgetArtLibrary.swift), else the last applied image for its size.

/** The clean-up version; index.json `migrated` >= this means it already ran. */
export const WIDGET_ART_MIGRATION = 1101;

/** True for a piece the person added themselves (never removed automatically). */
export function isUserPiece(p: WidgetArtPiece): boolean {
  return p.source === 'photo';
}

export type CleanResult = { lib: WidgetArtIndex; keep: string[]; remove: string[] };

function split(lib: WidgetArtIndex, drop: (p: WidgetArtPiece) => boolean): { keep: WidgetArtPiece[]; remove: string[] } {
  const keep: WidgetArtPiece[] = [];
  const remove: string[] = [];
  for (const p of lib.pieces) {
    if (drop(p)) remove.push(p.id);
    else keep.push(p);
  }
  return { keep, remove };
}

/**
 * A theme was applied (or its art added): keep the person's own pieces and `themeId`'s pieces,
 * remove every other auto-added piece. Records `themeId` as the index's current theme.
 */
export function replaceThemeArt(lib: WidgetArtIndex, themeId: string | null): CleanResult {
  const current = typeof themeId === 'string' && themeId.length > 0 ? themeId.slice(0, 120) : null;
  const { keep, remove } = split(lib, (p) => !isUserPiece(p) && (current === null || p.themeId !== current));
  const next: WidgetArtIndex = { ...lib, v: 1, pieces: listPieces({ v: 1, pieces: keep }) };
  if (current) next.currentThemeId = current;
  else delete next.currentThemeId;
  const retired = retire(lib.retired, lib.pieces.filter((p) => remove.includes(p.id)), next.pieces);
  if (retired) next.retired = retired;
  else delete next.retired;
  return { lib: next, keep: next.pieces.map((p) => p.id), remove };
}

/**
 * T252: the retired map after `gone` pieces were removed: their size + slot are remembered (newest
 * last, capped), and ids that are in the library again (`present`) are forgotten. undefined = empty.
 */
export function retire(
  prev: Record<string, RetiredPiece> | undefined,
  gone: readonly WidgetArtPiece[],
  present: readonly WidgetArtPiece[],
): Record<string, RetiredPiece> | undefined {
  const here = new Set(present.map((p) => p.id));
  const entries: [string, RetiredPiece][] = [];
  for (const [id, r] of Object.entries(prev ?? {})) {
    if (!here.has(id) && !gone.some((g) => g.id === id)) entries.push([id, r]);
  }
  for (const g of gone) {
    if (isUserPiece(g) || here.has(g.id)) continue;
    entries.push([g.id, { size: g.size, slot: g.slot ?? null }]);
  }
  const kept = entries.slice(Math.max(0, entries.length - WIDGET_ART_RETIRED_CAP));
  if (kept.length === 0) return undefined;
  const out: Record<string, RetiredPiece> = {};
  for (const [id, r] of kept) out[id] = r;
  return out;
}

/**
 * One-time clean-up after an update: the same rule as replaceThemeArt for the theme in use
 * (`currentThemeId`; null = the index's own current theme, else the theme of the newest auto-added
 * piece). Runs once per `version`: an index already at `version` comes back unchanged (remove = []).
 */
export function migrateLibrary(lib: WidgetArtIndex, currentThemeId: string | null, version = WIDGET_ART_MIGRATION): CleanResult & { ran: boolean } {
  if ((lib.migrated ?? 0) >= version) return { lib, keep: lib.pieces.map((p) => p.id), remove: [], ran: false };
  const newestTheme = listPieces(lib).find((p) => !isUserPiece(p) && p.themeId)?.themeId ?? null;
  const current = currentThemeId || lib.currentThemeId || newestTheme;
  const r = replaceThemeArt(lib, current);
  return { ...r, lib: { ...r.lib, migrated: version }, ran: true };
}

/** Manage > Delete selected. Unknown ids are ignored. */
export function removeMany(lib: WidgetArtIndex, ids: readonly string[]): CleanResult {
  const set = new Set(ids);
  const { keep, remove } = split(lib, (p) => set.has(p.id));
  return { lib: { ...lib, v: 1, pieces: keep }, keep: keep.map((p) => p.id), remove };
}

/** Manage > Clear all: every piece goes (own photos too); the current theme / migration flag stay. */
export function clearAll(lib: WidgetArtIndex): CleanResult {
  return { lib: { ...lib, v: 1, pieces: [] }, keep: [], remove: lib.pieces.map((p) => p.id) };
}

/**
 * The piece a widget shows when its chosen one is gone (mirrors WidgetArtStore.load in Swift):
 * the current theme's newest piece, preferring `size`; null = the last applied image.
 */
export function fallbackPiece(lib: WidgetArtIndex, size: WidgetArtSize | null = null): WidgetArtPiece | null {
  const cur = lib.currentThemeId;
  if (!cur) return null;
  const mine = listPieces(lib).filter((p) => !isUserPiece(p) && p.themeId === cur);
  return mine.find((p) => size !== null && p.size === size) ?? mine[0] ?? null;
}

// ---------------------------------------------------------------- T252 (owner-1101h #3)
// A widget's configured piece may be gone (theme swap, Manage). WidgetArtStore.resolve in
// targets/widget/WidgetArtLibrary.swift mirrors resolveWidgetPiece EXACTLY; keep the two in sync.

const SIZE_ORDER: Record<string, number> = { small: 0, medium: 1, large: 2 };

/** Current-theme ordering: size (small, medium, large, none), slot (none last), newest, id. */
export function byShelf(a: WidgetArtPiece, b: WidgetArtPiece): number {
  const sa = a.size ? SIZE_ORDER[a.size] : 3;
  const sb = b.size ? SIZE_ORDER[b.size] : 3;
  if (sa !== sb) return sa - sb;
  const la = a.slot ?? Number.MAX_SAFE_INTEGER;
  const lb = b.slot ?? Number.MAX_SAFE_INTEGER;
  if (la !== lb) return la - lb;
  return b.created - a.created || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/** The current theme's auto-added pieces in shelf order (byShelf). */
export function currentThemePieces(lib: WidgetArtIndex): WidgetArtPiece[] {
  const cur = lib.currentThemeId;
  if (!cur) return [];
  return lib.pieces.filter((p) => !isUserPiece(p) && p.themeId === cur).sort(byShelf);
}

/**
 * Edit Widget > Art order (suggestedEntities): the current theme's pieces first (byShelf), then
 * every other piece (own photos, art kept from elsewhere) newest first.
 */
export function pickerPieces(lib: WidgetArtIndex): WidgetArtPiece[] {
  const mine = currentThemePieces(lib);
  const ids = new Set(mine.map((p) => p.id));
  return [...mine, ...listPieces(lib).filter((p) => !ids.has(p.id))];
}

/**
 * The piece a widget configured with `id` shows, for a widget of `size`:
 * - `id` when it is still in the library;
 * - else (removed) the current theme's piece of the same size and slot (size = the widget's, else
 *   the removed piece's), else that size's first piece, else the current theme's first piece;
 * - null = no choice / nothing to map to: the widget shows the last applied image for its size
 *   (seamless-<size>.png), else the theme background. Never blank.
 */
export function resolveWidgetPiece(lib: WidgetArtIndex, id: string | null | undefined, size: WidgetArtSize | null): string | null {
  if (!isValidPieceId(id)) return null;
  if (lib.pieces.some((p) => p.id === id)) return id;
  const mine = currentThemePieces(lib);
  if (mine.length === 0) return null;
  const r = lib.retired?.[id];
  const want = size ?? r?.size ?? null;
  const sameSize = want ? mine.filter((p) => p.size === want) : [];
  const sameSlot = r && r.slot !== null ? sameSize.find((p) => p.slot === r.slot) : undefined;
  return (sameSlot ?? sameSize[0] ?? mine[0]).id;
}

