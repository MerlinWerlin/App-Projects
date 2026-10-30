// T177 (owner brief 31 Oct, docs/OWNER_1031.md): what the Themes tab gallery lists. Two editorial
// sections, in this order:
//   1. "New collection": every theme in the remote catalogue (catalog.json on the pack host),
//      data-driven, so a later batch of packs shows up with no app change. While the catalogue is
//      still empty (first launch, offline, a 404) the section shows calm skeleton cards in the
//      final shape, never an error.
//   2. "Starters": exactly the three bundled art-pack themes (GALLERY_STARTER_IDS).
// The older built-in sets (the starter showcase, themesNew / themesStoryPlay lists, Space, the Plus
// packs) leave the gallery only: their data modules stay, so getAnyTheme() still resolves a theme a
// person already applied (theme page, widgets, saved state).
// Search and the Liked filter narrow both sections; a filtered section with no match is left out.
// Pure TS (Node-tested in src/core/premiumGallery.test.ts); the screen just renders the rows.

import { ART_PACK_THEMES } from './artPackThemes.ts';
import type { ArtPackTheme } from './artPack.ts';
import { searchThemes } from './categories.ts';
import type { Theme } from './themes.ts';

/** The bundled themes the gallery keeps, in display order (owner-1031: Deep Sea, Starry Night, Sunset Dunes). */
export const GALLERY_STARTER_IDS: readonly string[] = Object.freeze(['deep-sea', 'starry-night', 'sunset-dunes']);

/** Gallery sections, top to bottom. */
export const GALLERY_SECTIONS = Object.freeze(['collection', 'starters'] as const);
export type GallerySectionId = (typeof GALLERY_SECTIONS)[number];

/** The gallery's two filters (pills under the title): everything, or the themes liked on this device. */
export const GALLERY_FILTERS = Object.freeze(['all', 'liked'] as const);
export type GalleryFilter = (typeof GALLERY_FILTERS)[number];

/** Skeleton cards shown in the New collection while the catalogue is still empty. */
export const GALLERY_SKELETON_CARDS = 4;

/** Cards per row: two on phones (the catalogue thumbs are 240 px wide), three on wide screens, one when very narrow. */
export function galleryColumns(width: number): number {
  if (!Number.isFinite(width) || width < 340) return 1;
  return width >= 700 ? 3 : 2;
}

/** Card width for `columns` cards between the side gutters with `gap` between them (whole points). */
export function galleryCardWidth(width: number, columns: number, gutter: number, gap: number): number {
  const cols = Math.max(1, Math.floor(columns));
  const w = Number.isFinite(width) ? width : 0;
  return Math.max(0, Math.floor((w - gutter * 2 - gap * (cols - 1)) / cols));
}

/** The three bundled starters, in GALLERY_STARTER_IDS order (an id missing from `pool` is skipped). */
export function galleryStarters<T extends { id: string } = ArtPackTheme>(pool: readonly T[] = ART_PACK_THEMES as unknown as readonly T[]): T[] {
  const out: T[] = [];
  for (const id of GALLERY_STARTER_IDS) {
    const t = pool.find((x) => x.id === id);
    if (t) out.push(t);
  }
  return out;
}

/** One row of the gallery list. */
export type GalleryRow<T> =
  | { kind: 'head'; key: string; section: GallerySectionId }
  | { kind: 'cards'; key: string; section: GallerySectionId; themes: readonly T[] }
  /** Placeholder cards in the final shape (New collection while the catalogue is empty). */
  | { kind: 'skeleton'; key: string; count: number }
  /** Filtering found nothing: no search match, or nothing liked yet. */
  | { kind: 'empty'; key: string; reason: 'noMatches' | 'noLiked' };

export type GalleryInput<R extends Theme, S extends Theme> = {
  /** Catalogue themes (useRemoteArtThemes), in catalogue order. */
  remote: readonly R[];
  /** Bundled starters; defaults to galleryStarters(). */
  starters?: readonly S[];
  /** Cards per row (galleryColumns). */
  columns: number;
  query?: string;
  filter?: GalleryFilter;
  /** Liked theme ids (device-local), for the Liked filter. */
  liked?: Iterable<string>;
};

/** Whether the gallery is narrowed (a search or the Liked filter). */
export function galleryFiltering(query: string | undefined, filter: GalleryFilter | undefined): boolean {
  return (query ?? '').trim().length > 0 || filter === 'liked';
}

/**
 * The gallery's list rows: a header then rows of `columns` cards per section. Unfiltered, the New
 * collection is always first: real cards when the catalogue has packs, skeletons while it is empty.
 * A remote pack with a starter's id is listed once, as the starter (bundled wins).
 */
export function galleryRows<R extends Theme, S extends Theme>(input: GalleryInput<R, S>): GalleryRow<R | S>[] {
  const columns = Math.max(1, Math.floor(input.columns) || 1);
  const starters: readonly S[] = input.starters ?? (galleryStarters() as unknown as S[]);
  const filtering = galleryFiltering(input.query, input.filter);
  const likedIds = input.filter === 'liked' ? new Set(input.liked ?? []) : null;
  const starterIds = new Set(starters.map((t) => t.id));
  const seen = new Set<string>();
  const remote = input.remote.filter((t) => {
    if (starterIds.has(t.id) || seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
  const narrow = <T extends Theme>(list: readonly T[]): readonly T[] => {
    if (!filtering) return list;
    const kept = likedIds ? list.filter((t) => likedIds.has(t.id)) : list;
    return searchThemes(kept, input.query ?? '');
  };

  const rows: GalleryRow<R | S>[] = [];
  const cards = (section: GallerySectionId, list: readonly (R | S)[]) => {
    for (let i = 0; i < list.length; i += columns) {
      rows.push({ kind: 'cards', key: `${section}:${list[i].id}`, section, themes: list.slice(i, i + columns) });
    }
  };

  const collection = narrow(remote);
  if (!filtering && collection.length === 0) {
    rows.push({ kind: 'head', key: 'head:collection', section: 'collection' });
    for (let i = 0; i < GALLERY_SKELETON_CARDS; i += columns) {
      rows.push({ kind: 'skeleton', key: `skeleton:${i}`, count: Math.min(columns, GALLERY_SKELETON_CARDS - i) });
    }
  } else if (collection.length > 0) {
    rows.push({ kind: 'head', key: 'head:collection', section: 'collection' });
    cards('collection', collection);
  }

  const bundled = narrow(starters);
  if (bundled.length > 0) {
    rows.push({ kind: 'head', key: 'head:starters', section: 'starters' });
    cards('starters', bundled);
  }

  if (filtering && collection.length === 0 && bundled.length === 0) {
    const noLiked = input.filter === 'liked' && (input.query ?? '').trim().length === 0;
    rows.push({ kind: 'empty', key: noLiked ? 'empty:liked' : 'empty:search', reason: noLiked ? 'noLiked' : 'noMatches' });
  }
  return rows;
}

/** Ids of the themes the rows list as cards, in order (skeletons and headers excluded). */
export function galleryThemeIds<T extends { id: string }>(rows: readonly GalleryRow<T>[]): string[] {
  return rows.flatMap((r) => (r.kind === 'cards' ? r.themes.map((t) => t.id) : []));
}

/** How many themes the rows list (for the "N matching themes" line while filtering). */
export function galleryMatchCount<T extends { id: string }>(rows: readonly GalleryRow<T>[]): number {
  return galleryThemeIds(rows).length;
}

/** Whether the New collection is still waiting for the catalogue (skeleton rows). */
export function galleryWaiting<T>(rows: readonly GalleryRow<T>[]): boolean {
  return rows.some((r) => r.kind === 'skeleton');
}
