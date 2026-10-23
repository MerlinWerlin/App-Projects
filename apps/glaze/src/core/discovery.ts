// T77 (shots-1018 L6): Discovery sub-tabs on the Themes tab: All / New / Our picks / Liked.
//
// Honesty rules (docs/MARKET.md "What users hate", paywallGuard.test.ts):
// - "Our picks" is a fixed editorial order written here by the Glaze team. It is never derived from
//   downloads, likes or any other user data, and the UI labels it as our picks, not "popular".
// - "Liked" is the person's own hearts, stored only on this device (src/store/favourites.ts,
//   AsyncStorage `glaze.favourites.v1`). Nothing is uploaded, and no like counts exist anywhere.
// - No counts or ranks are shown for any of these lists.
//
// A sub-tab composes with the category bubbles and search: the screen filters the sub-tab's list
// by category/query, and themesInCategory/searchThemes keep the order this file sets.
//
// The Wallpapers tab (core/wallpaperTiles.ts discoverWallpaperTiles) uses the same tabs and the
// same picks on its Still and Pairs grids; its hearts are a separate device-local list
// (WALLPAPER_FAVOURITES_KEY) of theme ids whose wallpaper was liked.
//
// Pure TS, no React.

import { isNew } from './categories.ts';
import type { Theme } from './themes.ts';

export const DISCOVERY_TABS = Object.freeze(['all', 'new', 'picks', 'liked'] as const);
export type DiscoveryTab = (typeof DISCOVERY_TABS)[number];

export function isDiscoveryTab(v: unknown): v is DiscoveryTab {
  return typeof v === 'string' && (DISCOVERY_TABS as readonly string[]).includes(v);
}

/** i18n key for a sub-tab label (`themes` namespace). */
export const discoveryTabKey = (tab: DiscoveryTab): `themes.discover.${DiscoveryTab}` => `themes.discover.${tab}`;

/**
 * "Our picks": a hand-chosen editorial order (free and Plus themes mixed). Changing it is a
 * product decision made here, never computed from usage.
 */
export const OUR_PICKS: readonly string[] = Object.freeze([
  'still-water',
  'cherry-blossom',
  'tenmoku',
  'celestial-night',
  'aurora-veil',
  'matcha-cafe',
  'night-drive',
  'lantern-row',
  'cottage-garden',
  'gilded-noir',
  'pressed-violet',
  'sakura-sprint',
]);

// ---------------------------------------------------------------------------------- favourites

/** AsyncStorage key for the device-local favourites (liked theme ids). */
export const FAVOURITES_KEY = 'glaze.favourites.v1';
/** AsyncStorage key for liked wallpapers (theme ids whose wallpaper was hearted on the Wallpapers tab). */
export const WALLPAPER_FAVOURITES_KEY = 'glaze.wallpaperFavourites.v1';
/** Upper bound so a corrupt or runaway list can't grow without limit. */
export const MAX_FAVOURITES = 500;

/** Liked ids, oldest like first. Unknown shapes, non-strings and repeats are dropped. */
export function parseFavourites(raw: string | null | undefined): string[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  const ids = data && typeof data === 'object' && Array.isArray((data as { liked?: unknown }).liked) ? (data as { liked: unknown[] }).liked : [];
  const out: string[] = [];
  for (const x of ids) {
    if (typeof x === 'string' && x.length > 0 && x.length <= 120 && !out.includes(x)) out.push(x);
  }
  return out.slice(-MAX_FAVOURITES);
}

export function serializeFavourites(liked: readonly string[]): string {
  return JSON.stringify({ liked: [...liked] });
}

export function isFavourite(liked: readonly string[], id: string): boolean {
  return liked.includes(id);
}

/** Likes `id` (appended, so it becomes the newest like) or unlikes it. Returns a new list. */
export function toggleFavourite(liked: readonly string[], id: string): string[] {
  if (liked.includes(id)) return liked.filter((x) => x !== id);
  return [...liked, id].slice(-MAX_FAVOURITES);
}

// ---------------------------------------------------------------------------------- lists

export type DiscoveryContext = {
  today: Date | string;
  /** Liked ids, oldest like first (as stored). */
  liked: readonly string[];
};

/** Themes flagged new (categories.ts isNew), newest `addedAt` first; ties keep catalogue order. */
export function newestThemes<T extends Theme>(themes: readonly T[], today: Date | string): T[] {
  return themes
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => isNew(t, today))
    .sort((a, b) => (b.t.addedAt ?? '').localeCompare(a.t.addedAt ?? '') || a.i - b.i)
    .map(({ t }) => t);
}

/** Themes in OUR_PICKS order; picks not in `themes` are skipped. */
export function pickedThemes<T extends Theme>(themes: readonly T[], picks: readonly string[] = OUR_PICKS): T[] {
  const byId = new Map(themes.map((t) => [t.id, t] as const));
  const out: T[] = [];
  for (const id of picks) {
    const t = byId.get(id);
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

/** Liked themes, most recent like first; ids no longer in the catalogue are skipped. */
export function likedThemes<T extends Theme>(themes: readonly T[], liked: readonly string[]): T[] {
  const byId = new Map(themes.map((t) => [t.id, t] as const));
  const out: T[] = [];
  for (let i = liked.length - 1; i >= 0; i--) {
    const t = byId.get(liked[i]);
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

/** The list for one sub-tab, before category/search filtering. 'all' returns `themes` unchanged. */
export function discoveryThemes<T extends Theme>(themes: readonly T[], tab: DiscoveryTab, ctx: DiscoveryContext): T[] {
  switch (tab) {
    case 'new':
      return newestThemes(themes, ctx.today);
    case 'picks':
      return pickedThemes(themes);
    case 'liked':
      return likedThemes(themes, ctx.liked);
    default:
      return [...themes];
  }
}

/** Every i18n key the sub-tabs and heart button look up (for completeness tests). */
export function discoveryI18nKeys(): string[] {
  const keys: string[] = DISCOVERY_TABS.map(discoveryTabKey);
  for (const k of ['label', 'picksNote', 'newEmpty', 'likedEmpty', 'likedEmptyBody']) keys.push(`themes.discover.${k}`);
  for (const k of ['add', 'remove', 'hint']) keys.push(`themes.like.${k}`);
  // Wallpapers tab (same sub-tab labels and picks note; its own heading, empty states and heart).
  for (const k of ['label', 'newEmpty', 'likedEmpty', 'likedEmptyBody']) keys.push(`tabs.wallpapersTab.discover.${k}`);
  for (const k of ['add', 'remove', 'hint']) keys.push(`tabs.wallpapersTab.like.${k}`);
  return keys.sort();
}
