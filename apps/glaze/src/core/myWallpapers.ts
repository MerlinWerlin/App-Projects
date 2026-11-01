// "My wallpapers" on the Wallpapers tab (T186, owner-1101 #4). Pure, Node-runnable.
//
// Every wallpaper the person saves to Photos from inside Glaze (a photo collage, a theme or photo
// wallpaper from the wallpaper maker, a still frame of a Live Photo clip) is also kept as a copy
// in the app's own documents folder (`<documents>/my-wallpapers/`) and listed here, newest first,
// so it can be opened, saved to Photos again or deleted. The list lives in AsyncStorage under
// MY_WALLPAPERS_KEY (src/store/myWallpapers.ts does the I/O). Nothing leaves the device.

export const MY_WALLPAPERS_KEY = 'glaze.myWallpapers.v1';
export const MY_WALLPAPERS_DIR = 'my-wallpapers/';
/** Oldest entries beyond this many are dropped (and their copies deleted) when a new one arrives. */
export const MY_WALLPAPERS_MAX = 60;

export const MY_WALLPAPER_KINDS = Object.freeze(['collage', 'theme', 'live'] as const);
export type MyWallpaperKind = (typeof MY_WALLPAPER_KINDS)[number];

export type MyWallpaper = {
  id: string;
  kind: MyWallpaperKind;
  /** file:// URI of our own PNG copy. */
  uri: string;
  width: number;
  height: number;
  createdAt: number;
  /** Theme the wallpaper came from (theme wallpapers, collages with a theme background). */
  themeId?: string;
  /** Live Photo clip (src/store/loops) the still frame came from. */
  loopId?: string;
};

export type MyWallpapersState = { items: MyWallpaper[] };

export const EMPTY_MY_WALLPAPERS: MyWallpapersState = Object.freeze({ items: [] }) as MyWallpapersState;

export function isMyWallpaperKind(v: unknown): v is MyWallpaperKind {
  return typeof v === 'string' && (MY_WALLPAPER_KINDS as readonly string[]).includes(v);
}

/** i18n key for a kind label (tabs.wallpapersTab.mine.kind.*). */
export const myWallpaperKindKey = (kind: MyWallpaperKind): string => `tabs.wallpapersTab.mine.kind.${kind}`;

/** `<documents>/my-wallpapers/` or null when the documents folder is unavailable. */
export function myWallpapersDir(documentDirectory: string | null | undefined): string | null {
  if (!documentDirectory) return null;
  return documentDirectory.endsWith('/') ? `${documentDirectory}${MY_WALLPAPERS_DIR}` : `${documentDirectory}/${MY_WALLPAPERS_DIR}`;
}

/** A file-name-safe id from a time stamp and a random suffix. */
export function myWallpaperId(now: number, rand: string): string {
  const r = rand.replace(/[^a-z0-9]/gi, '').slice(0, 8) || '0';
  return `${Math.max(0, Math.floor(now)).toString(36)}-${r}`;
}

/** Where the copy of entry `id` lives. */
export function myWallpaperFile(dir: string, id: string): string {
  return `${dir}${id.replace(/[^a-z0-9_-]/gi, '')}.png`;
}

function validItem(x: unknown): MyWallpaper | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  if (typeof o.id !== 'string' || !o.id || typeof o.uri !== 'string' || !o.uri) return null;
  if (!isMyWallpaperKind(o.kind)) return null;
  const width = typeof o.width === 'number' && Number.isFinite(o.width) && o.width > 0 ? Math.round(o.width) : 0;
  const height = typeof o.height === 'number' && Number.isFinite(o.height) && o.height > 0 ? Math.round(o.height) : 0;
  if (!width || !height) return null;
  const createdAt = typeof o.createdAt === 'number' && Number.isFinite(o.createdAt) ? o.createdAt : 0;
  const item: MyWallpaper = { id: o.id, kind: o.kind, uri: o.uri, width, height, createdAt };
  if (typeof o.themeId === 'string' && o.themeId) item.themeId = o.themeId;
  if (typeof o.loopId === 'string' && o.loopId) item.loopId = o.loopId;
  return item;
}

/** Parse the stored list; anything unreadable becomes an empty list, bad entries are skipped. */
export function parseMyWallpapers(raw: string | null | undefined): MyWallpapersState {
  if (!raw) return { items: [] };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { items: [] };
  }
  const list = data && typeof data === 'object' && Array.isArray((data as { items?: unknown }).items) ? (data as { items: unknown[] }).items : [];
  const seen = new Set<string>();
  const items: MyWallpaper[] = [];
  for (const x of list) {
    const item = validItem(x);
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    items.push(item);
  }
  return { items: sortMyWallpapers(items) };
}

export function serializeMyWallpapers(state: MyWallpapersState): string {
  return JSON.stringify({ items: state.items });
}

/** Newest first; ties keep their order. */
export function sortMyWallpapers(items: readonly MyWallpaper[]): MyWallpaper[] {
  return items
    .map((x, i) => ({ x, i }))
    .sort((a, b) => b.x.createdAt - a.x.createdAt || a.i - b.i)
    .map((e) => e.x);
}

/**
 * Add `item` at the front (replacing an entry with the same id). Returns the new state and the
 * entries dropped past `max`, whose copies the caller deletes.
 */
export function addMyWallpaper(
  state: MyWallpapersState,
  item: MyWallpaper,
  max: number = MY_WALLPAPERS_MAX,
): { state: MyWallpapersState; dropped: MyWallpaper[] } {
  const rest = state.items.filter((x) => x.id !== item.id);
  const all = sortMyWallpapers([item, ...rest]);
  const keep = Math.max(1, Math.floor(max));
  return { state: { items: all.slice(0, keep) }, dropped: all.slice(keep) };
}

/** Remove entry `id`. Returns the new state and the removed entry (null when it wasn't there). */
export function removeMyWallpaper(state: MyWallpapersState, id: string): { state: MyWallpapersState; removed: MyWallpaper | null } {
  const removed = state.items.find((x) => x.id === id) ?? null;
  if (!removed) return { state, removed: null };
  return { state: { items: state.items.filter((x) => x.id !== id) }, removed };
}

/** Every i18n key the "My wallpapers" area and the Wallpapers tab sections look up. */
export function myWallpapersI18nKeys(): string[] {
  const keys = [
    'tabs.wallpapers',
    'tabs.live',
    'tabs.wallpapersTab.subtitle',
    'tabs.wallpapersTab.liveEntry.eyebrow',
    'tabs.wallpapersTab.liveEntry.title',
    'tabs.wallpapersTab.liveEntry.body',
    'tabs.wallpapersTab.liveEntry.action',
    'tabs.wallpapersTab.liveEntry.hint',
    'tabs.wallpapersTab.collageEntry.eyebrow',
    'tabs.wallpapersTab.collageEntry.title',
    'tabs.wallpapersTab.collageEntry.body',
    'tabs.wallpapersTab.mine.eyebrow',
    'tabs.wallpapersTab.mine.title',
    'tabs.wallpapersTab.mine.body',
    'tabs.wallpapersTab.mine.empty',
    'tabs.wallpapersTab.mine.loading',
    'tabs.wallpapersTab.mine.itemA11y',
    'tabs.wallpapersTab.mine.itemHint',
    'tabs.wallpapersTab.mine.saveAgain',
    'tabs.wallpapersTab.mine.saved',
    'tabs.wallpapersTab.mine.failed',
    'tabs.wallpapersTab.mine.missing',
    'tabs.wallpapersTab.mine.deleteTitle',
    'tabs.wallpapersTab.mine.deleteBody',
    'tabs.wallpapersTab.mine.openClip',
    'common.delete',
    'common.cancel',
    'common.close',
    'common.back',
    ...MY_WALLPAPER_KINDS.map(myWallpaperKindKey),
  ];
  return [...new Set(keys)].sort();
}
