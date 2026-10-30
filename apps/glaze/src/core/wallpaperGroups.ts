// T176 premium UI (docs/PREMIUM_UI.md §3.9): the Wallpapers tab reads as editorial sections, one
// per wallpaper group, instead of one long grid:
//   yours  made from the person's own photos and videos (the photo entry, saved loops, "make one")
//   free   the designed wallpapers of the free themes (still tiles and Lock + Home pairs)
//   plus   the Plus themes' wallpapers
// Presentation only: the tiles, their order and their links still come from core/wallpaperTiles.
// Only the unfiltered views are grouped ("All" on Still and Pairs, and Live). The New / Our picks /
// Liked views keep their own order (newest, picks, most recent like) as one headerless grid, so
// grouping never reorders them. In the unfiltered views the tiles already come photo first, then
// free, then Plus (core/plusThemes ALL_THEMES order), so the stable split keeps that order too.
// Each group is split into its own rows, so a row never mixes two groups, and the first row of a
// group carries the section header. Pure; the screen renders what this returns.
import { GRID_COLUMNS, tileRows, type WallpaperTile } from './wallpaperTiles.ts';

export const WALLPAPER_GROUPS = Object.freeze(['yours', 'free', 'plus'] as const);
export type WallpaperGroup = (typeof WALLPAPER_GROUPS)[number];

/** The bits of a tile the grouping needs (WallpaperTile satisfies it). */
export type GroupTile = Pick<WallpaperTile, 'kind' | 'plus'>;

export function wallpaperGroupOf(tile: GroupTile): WallpaperGroup {
  if (tile.kind === 'theme' || tile.kind === 'pair') return tile.plus ? 'plus' : 'free';
  return 'yours';
}

/** Rows of the grid plus, for grouped views, the group whose header opens a row (by row index). */
export type WallpaperGroupRows<T> = { rows: T[][]; headers: ReadonlyMap<number, WallpaperGroup> };

/**
 * Rows of `columns` tiles. `grouped` splits the tiles per group (WALLPAPER_GROUPS order, tiles in
 * their given order within a group; empty groups are left out, so no header without tiles) and
 * marks each group's first row. Ungrouped is exactly tileRows() with no headers.
 */
export function wallpaperGroupRows<T extends GroupTile>(tiles: readonly T[], grouped: boolean, columns: number = GRID_COLUMNS): WallpaperGroupRows<T> {
  if (!grouped) return { rows: tileRows(tiles, columns), headers: new Map() };
  const rows: T[][] = [];
  const headers = new Map<number, WallpaperGroup>();
  for (const group of WALLPAPER_GROUPS) {
    const members = tiles.filter((x) => wallpaperGroupOf(x) === group);
    if (members.length === 0) continue;
    headers.set(rows.length, group);
    rows.push(...tileRows(members, columns));
  }
  return { rows, headers };
}

/** Whether a Wallpapers view is grouped: Live always, Still and Pairs on "All" only. */
export function wallpaperViewGrouped(tab: 'still' | 'live' | 'pairs', discovery: string): boolean {
  return tab === 'live' || discovery === 'all';
}

/** i18n keys for a group's editorial header (eyebrow, title, body) under tabs.wallpapersTab.groups. */
export function wallpaperGroupKeys(group: WallpaperGroup): { eyebrow: string; title: string; body: string } {
  const base = `tabs.wallpapersTab.groups.${group}`;
  return { eyebrow: `${base}.eyebrow`, title: `${base}.title`, body: `${base}.body` };
}
