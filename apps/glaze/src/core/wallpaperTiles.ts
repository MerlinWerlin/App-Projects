// Wallpapers tab tile model (T71, docs/MARKET.md "Owner screenshots 18 Oct" L5).
//
// Three sub-tabs, each a 2-column grid of tall rounded tiles:
//   Still: every theme's designed wallpaper, after a "your photo" entry tile.
//   Live:  the user's saved loops (Live Lock Screen videos / GIFs), newest first, then a
//          "Make a live lock screen" tile (the only tile when there are none yet).
//   Pairs: every theme's wallpaper shown as a Lock + Home pair.
//
// `live` is true ONLY for a real saved loop: the LIVE badge is never drawn on a still theme,
// a pair, or an entry tile. `plus` mirrors the theme's own flag.
//
// Links use only what the target screens read:
//   app/wallpaper.tsx reads `theme` and `source`, but its designed editor opens free themes
//   only (getTheme, falling back to the first starter), so a Plus theme links to its theme
//   page (/theme/<id>, which reads any theme and handles the unlock) instead of opening the
//   editor on the wrong wallpaper. The Lock + Home pair card lives on /wallpaper too.
//   app/live/[id].tsx edits one loop; the Live tab (/live) is where new ones start.
//
// T77 (shots-1018 L6): a second row of discovery sub-tabs (All / New / Our picks / Liked, from
// core/discovery.ts) narrows the Still and Pairs grids; Live lists the person's own loops and
// ignores it. Hearts sit on theme and pair tiles only (tileFavouriteId); no counts or ranks.
//
// Pure TS, no React.

import { discoveryThemes, type DiscoveryTab } from './discovery.ts';
import type { Theme } from './themes.ts';

export const WALLPAPER_SUB_TABS = Object.freeze(['still', 'live', 'pairs'] as const);
export type WallpaperSubTab = (typeof WALLPAPER_SUB_TABS)[number];

export function isWallpaperSubTab(v: unknown): v is WallpaperSubTab {
  return typeof v === 'string' && (WALLPAPER_SUB_TABS as readonly string[]).includes(v);
}

export const wallpaperSubTabKey = (tab: WallpaperSubTab): `tabs.wallpapersTab.sub.${WallpaperSubTab}` =>
  `tabs.wallpapersTab.sub.${tab}`;

export type TileKind = 'theme' | 'photo' | 'loop' | 'makeLive' | 'pair';

export type WallpaperTile = {
  id: string;
  kind: TileKind;
  themeId?: string;
  loopId?: string;
  /** True only for a saved loop (a real moving Live Lock Screen). */
  live: boolean;
  /** Plus-only theme. */
  plus: boolean;
  href: string;
};

/** The bits of a theme the tiles need (core/themes.ts Theme satisfies it). */
export type TileTheme = { id: string; plus: boolean };
/** The bits of a saved loop the tiles need (core/loop.ts LoopProject satisfies it). */
export type TileLoop = { id: string; updatedAt: number };

export type TileSources = { themes: readonly TileTheme[]; loops: readonly TileLoop[] };

export const PHOTO_HREF = '/wallpaper?source=photo';
export const LIVE_TAB_HREF = '/live';

export function themeWallpaperHref(theme: TileTheme): string {
  const id = encodeURIComponent(theme.id);
  return theme.plus ? `/theme/${id}` : `/wallpaper?theme=${id}`;
}

export const loopHref = (loopId: string): string => `/live/${encodeURIComponent(loopId)}`;

function uniqueThemes(themes: readonly TileTheme[]): TileTheme[] {
  const seen = new Set<string>();
  const out: TileTheme[] = [];
  for (const th of themes) {
    if (!th || typeof th.id !== 'string' || th.id === '' || seen.has(th.id)) continue;
    seen.add(th.id);
    out.push(th);
  }
  return out;
}

/** Tiles for one sub-tab, in display order. */
export function wallpaperTiles(tab: WallpaperSubTab, src: TileSources): WallpaperTile[] {
  if (tab === 'still') {
    const out: WallpaperTile[] = [{ id: 'photo', kind: 'photo', live: false, plus: false, href: PHOTO_HREF }];
    for (const th of uniqueThemes(src.themes)) {
      out.push({ id: `still-${th.id}`, kind: 'theme', themeId: th.id, live: false, plus: th.plus === true, href: themeWallpaperHref(th) });
    }
    return out;
  }
  if (tab === 'pairs') {
    return uniqueThemes(src.themes).map((th) => ({
      id: `pair-${th.id}`,
      kind: 'pair' as const,
      themeId: th.id,
      live: false,
      plus: th.plus === true,
      href: themeWallpaperHref(th),
    }));
  }
  const seen = new Set<string>();
  const loops = src.loops
    .filter((l) => {
      if (!l || typeof l.id !== 'string' || l.id === '' || seen.has(l.id)) return false;
      seen.add(l.id);
      return true;
    })
    .slice()
    .sort((a, b) => (Number.isFinite(b.updatedAt) ? b.updatedAt : 0) - (Number.isFinite(a.updatedAt) ? a.updatedAt : 0));
  const out: WallpaperTile[] = loops.map((l) => ({ id: `loop-${l.id}`, kind: 'loop' as const, loopId: l.id, live: true, plus: false, href: loopHref(l.id) }));
  out.push({ id: 'makeLive', kind: 'makeLive', live: false, plus: false, href: LIVE_TAB_HREF });
  return out;
}

// ---------------------------------------------------------------------------------- discovery

/** Whether the discovery row (All / New / Our picks / Liked) applies to a sub-tab. */
export const discoveryApplies = (tab: WallpaperSubTab): boolean => tab !== 'live';

export type DiscoverySources = {
  themes: readonly Theme[];
  loops: readonly TileLoop[];
  today: Date | string;
  /** Liked wallpaper (theme) ids, oldest like first, as stored. */
  liked: readonly string[];
};

/**
 * Tiles for a sub-tab narrowed by a discovery tab. 'all' is exactly wallpaperTiles(); any other
 * discovery tab lists only matching theme/pair tiles in that tab's own order (newest, our picks,
 * most recent like) without the "your photo" entry. Live ignores discovery.
 */
export function discoverWallpaperTiles(tab: WallpaperSubTab, discovery: DiscoveryTab, src: DiscoverySources): WallpaperTile[] {
  if (!discoveryApplies(tab) || discovery === 'all') return wallpaperTiles(tab, { themes: src.themes, loops: src.loops });
  const pool = discoveryThemes(src.themes, discovery, { today: src.today, liked: src.liked });
  return wallpaperTiles(tab, { themes: pool, loops: src.loops }).filter((tile) => tile.kind === 'theme' || tile.kind === 'pair');
}

/** The id a tile's heart likes (its theme), or undefined for tiles without a heart. */
export function tileFavouriteId(tile: WallpaperTile): string | undefined {
  return (tile.kind === 'theme' || tile.kind === 'pair') && tile.themeId ? tile.themeId : undefined;
}

// ---------------------------------------------------------------------------------- grid maths

export const GRID_COLUMNS = 2;
/** Tall tiles: about a phone screen's shape (19.5 : 9 ≈ 2.17), slightly shorter so two rows show. */
export const TILE_ASPECT = 2;
/** Tiles drawn on first render; more come in pages as the list scrolls (keeps SVG cost low). */
export const INITIAL_TILE_COUNT = 8;
export const TILE_PAGE = 8;

export type GridSize = { tileWidth: number; tileHeight: number };

/**
 * Width and height of each tile in a `columns`-wide grid inside `containerWidth` points,
 * with `gap` points between columns. Floors to whole points so two tiles plus the gap
 * never overflow the row.
 */
export function gridTileSize(containerWidth: number, gap: number, columns: number = GRID_COLUMNS, aspect: number = TILE_ASPECT): GridSize {
  const cols = Number.isFinite(columns) && columns >= 1 ? Math.floor(columns) : 1;
  const g = Number.isFinite(gap) && gap > 0 ? gap : 0;
  const w = Number.isFinite(containerWidth) && containerWidth > 0 ? containerWidth : 0;
  const tileWidth = Math.max(0, Math.floor((w - g * (cols - 1)) / cols));
  const a = Number.isFinite(aspect) && aspect > 0 ? aspect : TILE_ASPECT;
  return { tileWidth, tileHeight: Math.round(tileWidth * a) };
}

/** Size of each half (Lock, Home) of a pair tile: two phone-shaped halves side by side. */
export function pairHalfSize(tileWidth: number, gap: number, screenAspect: number = 19.5 / 9): { width: number; height: number } {
  const w = Math.max(0, Math.floor((Math.max(0, tileWidth) - Math.max(0, gap)) / 2));
  return { width: w, height: Math.round(w * screenAspect) };
}

/** How many tiles to show after `pages` extra pages, never more than there are. */
export function visibleTileCount(total: number, pages: number): number {
  const p = Number.isFinite(pages) && pages > 0 ? Math.floor(pages) : 0;
  return Math.max(0, Math.min(total, INITIAL_TILE_COUNT + p * TILE_PAGE));
}

/** Split tiles into rows of `columns` (the last row may be short). */
export function tileRows<T>(tiles: readonly T[], columns: number = GRID_COLUMNS): T[][] {
  const cols = columns >= 1 ? Math.floor(columns) : 1;
  const rows: T[][] = [];
  for (let i = 0; i < tiles.length; i += cols) rows.push(tiles.slice(i, i + cols));
  return rows;
}

/** i18n keys the Wallpapers tab looks up (for completeness tests). */
export const WALLPAPER_TILE_STRING_KEYS = Object.freeze([
  'subtitle',
  'subTabs',
  'sub.still',
  'sub.live',
  'sub.pairs',
  'liveBadge',
  'photoTile',
  'photoTileHint',
  'themeTileA11y',
  'themeTileHint',
  'plusTileHint',
  'loopTileA11y',
  'loopTileHint',
  'makeLiveTile',
  'makeLiveHint',
  'pairTileA11y',
  'pairLock',
  'pairHome',
  'liveEmpty',
  'showMore',
] as const);

export function wallpaperTilesI18nKeys(): string[] {
  return WALLPAPER_TILE_STRING_KEYS.map((k) => `tabs.wallpapersTab.${k}`);
}
