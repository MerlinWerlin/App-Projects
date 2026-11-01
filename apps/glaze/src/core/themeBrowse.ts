// T253 (owner-1101h #4, docs/OWNER_1101H.md): the Themes front page with categories and All themes,
// fast with 100+ themes. Pure TS (Node-tested in src/core/themeBrowse.test.ts); the screen
// (app/(tabs)/themes.tsx) only renders what this returns.
//
// Every theme (catalogue pack or bundled starter) carries an optional `category` string in its data
// (catalog.json entry / themes/<id>/meta.json). It is matched tolerantly (case, "&" / "and",
// punctuation and spacing are ignored; "cozy" reads as "cosy") against the fixed list below; a
// missing or unknown category files the theme under More, which is always last.
//
// The page has two shapes:
//   - home: a category chip row (in the list header), then one section per non-empty category
//     (header with "See all" + a horizontal art-led rail of at most RAIL_MAX cards), then
//     "All themes": every theme as rows of thumbnail cards, scrolled by the page's virtualised list;
//   - grid: a chip (a category or All themes), "See all", a search or the Liked filter: one
//     virtualised thumbnail grid (FlatList numColumns + getItemLayout from gridItemLayout).
// T254: nothing here downloads a pack. Listing reads catalogue metadata and thumbnail URLs only
// (src/core/themeBrowse.test.ts guards it).

import { foldForSearch, searchThemes } from './categories.ts';
import type { Theme } from './themes.ts';

/** The browse categories in their fixed display order (owner-1101h). More is added last. */
export const BROWSE_CATEGORIES = Object.freeze([
  { id: 'space-night', name: 'Space & Night' },
  { id: 'nature', name: 'Nature' },
  { id: 'ocean-water', name: 'Ocean & Water' },
  { id: 'cute-cosy', name: 'Cute & Cosy' },
  { id: 'sweets-treats', name: 'Sweets & Treats' },
  { id: 'dreamy-pastel', name: 'Dreamy & Pastel' },
  { id: 'moody-dark', name: 'Moody & Dark' },
  { id: 'abstract-art', name: 'Abstract & Art' },
  { id: 'seasonal', name: 'Seasonal' },
  { id: 'city-retro', name: 'City & Retro' },
] as const);

export type NamedBrowseCategoryId = (typeof BROWSE_CATEGORIES)[number]['id'];
export const MORE_CATEGORY = 'more' as const;
export type BrowseCategoryId = NamedBrowseCategoryId | typeof MORE_CATEGORY;

/** Every category id in display order, More last. */
export const BROWSE_CATEGORY_IDS: readonly BrowseCategoryId[] = Object.freeze([...BROWSE_CATEGORIES.map((c) => c.id), MORE_CATEGORY]);

/** English canonical names (the catalogue's spelling; the screen shows the translated label). */
export const BROWSE_CATEGORY_NAMES: Readonly<Record<BrowseCategoryId, string>> = Object.freeze({
  ...(Object.fromEntries(BROWSE_CATEGORIES.map((c) => [c.id, c.name])) as Record<NamedBrowseCategoryId, string>),
  more: 'More',
});

/** i18n keys of the category labels (themes namespace, src/i18n/ns/themes/*.ts `browse.category`). */
export const BROWSE_CATEGORY_LABEL_KEYS = Object.freeze({
  'space-night': 'themes.browse.category.spaceNight',
  nature: 'themes.browse.category.nature',
  'ocean-water': 'themes.browse.category.oceanWater',
  'cute-cosy': 'themes.browse.category.cuteCosy',
  'sweets-treats': 'themes.browse.category.sweetsTreats',
  'dreamy-pastel': 'themes.browse.category.dreamyPastel',
  'moody-dark': 'themes.browse.category.moodyDark',
  'abstract-art': 'themes.browse.category.abstractArt',
  seasonal: 'themes.browse.category.seasonal',
  'city-retro': 'themes.browse.category.cityRetro',
  more: 'themes.browse.category.more',
} as const);

/** i18n key of a category label. */
export function browseCategoryLabelKey<K extends BrowseCategoryId>(id: K): (typeof BROWSE_CATEGORY_LABEL_KEYS)[K] {
  return BROWSE_CATEGORY_LABEL_KEYS[id];
}

export function isBrowseCategoryId(x: unknown): x is BrowseCategoryId {
  return typeof x === 'string' && (BROWSE_CATEGORY_IDS as readonly string[]).includes(x);
}

/** Spelling variants folded to the canonical word before matching. */
const WORD_ALIASES: Readonly<Record<string, string>> = Object.freeze({ cozy: 'cosy', pastels: 'pastel', sweet: 'sweets', treat: 'treats' });

/**
 * The comparable key of a category string: accents and case folded, "&" / "+" / the word "and"
 * dropped, every non-letter-or-digit run removed, a few spelling variants unified.
 * "Space & Night", "space-night", " SPACE and night " and "Space/Night" all give "spacenight".
 */
export function browseCategoryKey(raw: string): string {
  return foldForSearch(raw)
    .replace(/[&+]/g, ' ')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 0 && w !== 'and')
    .map((w) => WORD_ALIASES[w] ?? w)
    .join('');
}

const KEY_TO_ID: ReadonlyMap<string, BrowseCategoryId> = new Map(
  BROWSE_CATEGORY_IDS.flatMap((id): [string, BrowseCategoryId][] => [
    [browseCategoryKey(id), id],
    [browseCategoryKey(BROWSE_CATEGORY_NAMES[id]), id],
  ]),
);

/** A catalogue / meta `category` value as a category id; missing, empty or unknown → 'more'. Never throws. */
export function parseBrowseCategory(raw: unknown): BrowseCategoryId {
  const first = Array.isArray(raw) ? raw.find((x) => typeof x === 'string') : raw;
  if (typeof first !== 'string') return MORE_CATEGORY;
  const s = first.slice(0, 80);
  if (!s.trim()) return MORE_CATEGORY;
  return KEY_TO_ID.get(browseCategoryKey(s)) ?? MORE_CATEGORY;
}

/** What browsing needs from a theme: its id, and (optional) its parsed or raw category. */
export type Browsable = { id: string; browseCategory?: unknown; category?: unknown };

/** A theme's category: its parsed `browseCategory`, else its raw `category`, else More. */
export function browseCategoryOf(t: Browsable): BrowseCategoryId {
  if (isBrowseCategoryId(t.browseCategory)) return t.browseCategory;
  return parseBrowseCategory(t.category);
}

/**
 * Every theme the page lists, once: catalogue themes in catalogue order, then the bundled themes
 * (a bundled theme with a catalogue id is listed once, as the bundled one, at its catalogue place).
 */
export function browseThemes<R extends { id: string }, S extends { id: string }>(remote: readonly R[], bundled: readonly S[]): (R | S)[] {
  const bundledById = new Map(bundled.map((t) => [t.id, t]));
  const seen = new Set<string>();
  const out: (R | S)[] = [];
  for (const t of remote) {
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    out.push(bundledById.get(t.id) ?? t);
  }
  for (const t of bundled) {
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    out.push(t);
  }
  return out;
}

export type BrowseSection<T> = { id: BrowseCategoryId; themes: readonly T[] };

/** Themes grouped by category in the fixed order; empty categories left out; More last; input order kept inside a group. */
export function groupByCategory<T extends Browsable>(themes: readonly T[]): BrowseSection<T>[] {
  const groups = new Map<BrowseCategoryId, T[]>();
  for (const t of themes) {
    const id = browseCategoryOf(t);
    const g = groups.get(id);
    if (g) g.push(t);
    else groups.set(id, [t]);
  }
  const out: BrowseSection<T>[] = [];
  for (const id of BROWSE_CATEGORY_IDS) {
    const g = groups.get(id);
    if (g && g.length > 0) out.push({ id, themes: g });
  }
  return out;
}

/** Themes of one category, in input order. */
export function themesOfCategory<T extends Browsable>(themes: readonly T[], id: BrowseCategoryId): T[] {
  return themes.filter((t) => browseCategoryOf(t) === id);
}

/**
 * Search over every theme: name, mood line, tags (src/core/categories.ts searchThemes) plus the
 * theme's browse category name ("ocean" finds Ocean & Water themes). Case- and accent-insensitive,
 * every word must match; order kept. An empty query returns every theme.
 */
export function searchBrowse<T extends Theme & Browsable>(themes: readonly T[], query: string): T[] {
  const words = foldForSearch(query ?? '')
    .split(/[\s,]+/)
    .filter((w) => w.length > 0);
  if (words.length === 0) return [...themes];
  const direct = new Set(searchThemes(themes, query).map((t) => t.id));
  return themes.filter((t) => {
    if (direct.has(t.id)) return true;
    const cat = foldForSearch(BROWSE_CATEGORY_NAMES[browseCategoryOf(t)]);
    const h = foldForSearch([t.name, t.tagline, ...(t.tags ?? []), cat].join(' '));
    return words.every((w) => h.includes(w));
  });
}

// ------------------------------------------------------------------ what the page shows

/** Which view: the home overview, every theme as a grid, or one category as a grid. */
export type BrowseView = 'home' | 'all' | BrowseCategoryId;

export const BROWSE_FILTERS = Object.freeze(['all', 'liked'] as const);
export type BrowseFilter = (typeof BROWSE_FILTERS)[number];

/** Cards per category rail before "See all" (the rest is one tap away). */
export const RAIL_MAX = 10;
/** Skeleton cards shown while the catalogue's first load is still running. */
export const BROWSE_SKELETON_CARDS = 4;

/** Whether the list is narrowed by a search or the Liked filter. */
export function browseFiltering(query: string | undefined, filter: BrowseFilter | undefined): boolean {
  return (query ?? '').trim().length > 0 || filter === 'liked';
}

/** 'home' only for the plain overview; any chip, See all, search or Liked shows the grid. */
export function browseMode(view: BrowseView, query: string | undefined, filter: BrowseFilter | undefined): 'home' | 'grid' {
  return view === 'home' && !browseFiltering(query, filter) ? 'home' : 'grid';
}

export type BrowseChip = { id: 'all' | BrowseCategoryId; count: number };

/** The chip row: All themes, then each non-empty category in order (More last). */
export function browseChips<T>(sections: readonly BrowseSection<T>[], total: number): BrowseChip[] {
  return [{ id: 'all', count: total }, ...sections.map((s) => ({ id: s.id, count: s.themes.length }))];
}

/** A chip tap: the chip's grid, or back home when that chip is already selected. */
export function nextBrowseView(current: BrowseView, chip: 'all' | BrowseCategoryId): BrowseView {
  return current === chip ? 'home' : chip;
}

/** A list row of the home view. */
export type BrowseRow<T> =
  | { kind: 'head'; key: string; section: BrowseCategoryId | 'all'; count: number }
  | { kind: 'rail'; key: string; section: BrowseCategoryId; themes: readonly T[] }
  | { kind: 'cards'; key: string; themes: readonly T[] }
  | { kind: 'skeleton'; key: string; count: number };

export type BrowseHomeInput<T> = {
  themes: readonly T[];
  /** Thumbnail cards per row in the All themes section (gridColumns). */
  columns: number;
  /** True while the catalogue's first load is running (skeleton row under the sections). */
  waiting?: boolean;
  railMax?: number;
};

/**
 * Home rows: per non-empty category a header (with the category's full count, for "See all") and
 * one rail of at most `railMax` cards; then, while the first catalogue load runs, a skeleton row;
 * then the All themes header and every theme in rows of `columns` thumbnails. Keys are stable.
 */
export function browseHomeRows<T extends Browsable>(input: BrowseHomeInput<T>): BrowseRow<T>[] {
  const columns = Math.max(1, Math.floor(input.columns) || 1);
  const railMax = Math.max(1, Math.floor(input.railMax ?? RAIL_MAX));
  const rows: BrowseRow<T>[] = [];
  for (const s of groupByCategory(input.themes)) {
    rows.push({ kind: 'head', key: `head:${s.id}`, section: s.id, count: s.themes.length });
    rows.push({ kind: 'rail', key: `rail:${s.id}`, section: s.id, themes: s.themes.slice(0, railMax) });
  }
  if (input.waiting) rows.push({ kind: 'skeleton', key: 'skeleton', count: BROWSE_SKELETON_CARDS });
  if (input.themes.length > 0) {
    rows.push({ kind: 'head', key: 'head:all', section: 'all', count: input.themes.length });
    for (let i = 0; i < input.themes.length; i += columns) {
      rows.push({ kind: 'cards', key: `all:${input.themes[i].id}`, themes: input.themes.slice(i, i + columns) });
    }
  }
  return rows;
}

export type BrowseGridInput<T> = {
  themes: readonly T[];
  view: BrowseView;
  query?: string;
  filter?: BrowseFilter;
  liked?: Iterable<string>;
};

/** The grid's themes: the view's category (or all), then Liked, then the search; order kept. */
export function browseGridThemes<T extends Theme & Browsable>(input: BrowseGridInput<T>): T[] {
  let list: readonly T[] = input.view === 'home' || input.view === 'all' ? input.themes : themesOfCategory(input.themes, input.view);
  if (input.filter === 'liked') {
    const liked = new Set(input.liked ?? []);
    list = list.filter((t) => liked.has(t.id));
  }
  return searchBrowse(list, input.query ?? '');
}

/**
 * The grid view as list rows of `columns` thumbnails each (the same virtualised list as the home
 * view, so the search field in its header keeps focus while the view changes). Every row has the
 * same height, so gridItemLayout gives exact offsets. Keys are stable per first theme.
 */
export function browseGridRows<T extends { id: string }>(themes: readonly T[], columns: number): BrowseRow<T>[] {
  const cols = Math.max(1, Math.floor(columns) || 1);
  const rows: BrowseRow<T>[] = [];
  for (let i = 0; i < themes.length; i += cols) rows.push({ kind: 'cards', key: `grid:${themes[i].id}`, themes: themes.slice(i, i + cols) });
  return rows;
}

/** Why an empty grid is empty (drives its message and one-tap way back). */
export function browseEmptyReason(query: string | undefined, filter: BrowseFilter | undefined): 'noMatches' | 'noLiked' {
  return filter === 'liked' && (query ?? '').trim().length === 0 ? 'noLiked' : 'noMatches';
}

// ------------------------------------------------------------------ geometry (virtualisation)

/** Thumbnail cards per grid row: three on phones, two when very narrow, five on wide screens. */
export function gridColumns(width: number): number {
  if (!Number.isFinite(width) || width < 340) return 2;
  return width >= 700 ? 5 : 3;
}

export type GridGeometry = { cardWidth: number; artHeight: number; cardHeight: number; rowHeight: number };

/**
 * Fixed card geometry, so the grid can use getItemLayout: whole-point card width between the
 * gutters, art at `aspect` (height / width), a fixed `labelHeight` name row, `gap` below each row.
 */
export function gridGeometry(i: { width: number; columns: number; gutter: number; gap: number; aspect: number; labelHeight: number }): GridGeometry {
  const cols = Math.max(1, Math.floor(i.columns) || 1);
  const w = Number.isFinite(i.width) ? i.width : 0;
  const cardWidth = Math.max(0, Math.floor((w - i.gutter * 2 - i.gap * (cols - 1)) / cols));
  const artHeight = Math.round(cardWidth * (Number.isFinite(i.aspect) && i.aspect > 0 ? i.aspect : 1));
  const cardHeight = artHeight + Math.max(0, i.labelHeight);
  return { cardWidth, artHeight, cardHeight, rowHeight: cardHeight + Math.max(0, i.gap) };
}

/** getItemLayout for a fixed-height grid (FlatList numColumns passes the ROW index). */
export function gridItemLayout(rowHeight: number, headerHeight: number, index: number): { length: number; offset: number; index: number } {
  const h = Math.max(0, headerHeight || 0);
  return { length: rowHeight, offset: h + rowHeight * index, index };
}

/**
 * Width of an art-led card in a category rail: about 2.3 cards visible on a phone (the cut card
 * says "scroll sideways"), never wider than 260 pt on big screens. Whole points.
 */
export function railCardWidth(width: number, gutter: number, gap: number): number {
  const w = Number.isFinite(width) ? width : 0;
  return Math.max(0, Math.min(260, Math.floor((w - gutter - gap * 2) / 2.3)));
}

/** getItemLayout for a horizontal rail of fixed-width cards (`gap` after each card). */
export function railItemLayout(cardWidth: number, gap: number, index: number): { length: number; offset: number; index: number } {
  return { length: cardWidth + gap, offset: (cardWidth + gap) * index, index };
}

/**
 * Progressive rendering for the grid: render about one screen of rows first, the same per batch,
 * and keep a small window (5 screens) mounted, so 100+ thumbnails never mount at once.
 */
export function gridWindow(viewportHeight: number, rowHeight: number): { initialNumToRender: number; maxToRenderPerBatch: number; windowSize: number } {
  const rows = rowHeight > 0 && Number.isFinite(viewportHeight) ? Math.ceil(viewportHeight / rowHeight) + 1 : 4;
  const n = Math.min(8, Math.max(2, rows));
  return { initialNumToRender: n, maxToRenderPerBatch: n, windowSize: 5 };
}

/** Rail cards mounted at first (the rest render as the rail scrolls). */
export const RAIL_WINDOW = Object.freeze({ initialNumToRender: 3, maxToRenderPerBatch: 3, windowSize: 3 });
