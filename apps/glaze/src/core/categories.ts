// Theme browsing (owner request 16 Oct 2026, R4): categories, search and the "New" badge.
// Pure TS (no React Native / Expo) so Node can run and test it directly.
// Category labels are i18n keys ('themes.category.<id>'); their text lives in the catalogue
// (src/i18n/ns/themes/*.ts).

import { FIRST_CATALOGUE_DATE, type Theme, type ThemeCategoryId } from './themes.ts';

export type ThemeCategory = {
  id: ThemeCategoryId;
  labelKey: `themes.category.${ThemeCategoryId}`;
};

/** Browse categories in chip-row order. 'anime' is anime-style original art only, never characters. */
export const THEME_CATEGORIES: readonly ThemeCategory[] = Object.freeze(
  (['minimal', 'dark', 'pastel', 'nature', 'neon', 'retro', 'anime', 'cute', 'luxury', 'seasonal'] as const).map(
    (id): ThemeCategory => ({ id, labelKey: `themes.category.${id}` }),
  ),
);

export const CATEGORY_IDS: readonly ThemeCategoryId[] = Object.freeze(THEME_CATEGORIES.map((c) => c.id));

export function isCategoryId(id: unknown): id is ThemeCategoryId {
  return typeof id === 'string' && (CATEGORY_IDS as readonly string[]).includes(id);
}

/**
 * Themes that shipped in the first catalogue (dated 12 Oct 2026) never show "New": only themes
 * added after it do, so launch day isn't a wall of badges.
 */
export const LAUNCH_CATALOGUE_DATE: string = FIRST_CATALOGUE_DATE;

/** Days a theme counts as new after its `addedAt`. */
export const NEW_BADGE_DAYS = 21;

/** Themes in a category, in their original order; `null` means all. */
export function themesInCategory<T extends Theme>(themes: readonly T[], id: ThemeCategoryId | null): T[] {
  if (id === null) return [...themes];
  return themes.filter((t) => (t.categories ?? []).includes(id));
}

/** Lower case with accents removed ("Café" → "cafe"), for search matching. */
export function foldForSearch(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase();
}

function haystack(t: Theme): string {
  return foldForSearch([t.name, t.tagline, ...(t.tags ?? []), ...(t.categories ?? [])].join(' '));
}

/**
 * Search themes by name, tagline, tags and category ids. Case- and accent-insensitive; every word
 * of the query must match somewhere (AND). An empty query returns every theme.
 */
export function searchThemes<T extends Theme>(themes: readonly T[], query: string): T[] {
  const words = foldForSearch(query ?? '')
    .split(/[\s,]+/)
    .filter((w) => w.length > 0);
  if (words.length === 0) return [...themes];
  return themes.filter((t) => {
    const h = haystack(t);
    return words.every((w) => h.includes(w));
  });
}

/** Parse an ISO 'YYYY-MM-DD' date to a whole UTC day number, or NaN. */
function dayNumber(iso: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return Number.NaN;
  return Math.floor(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86400000);
}

/** Local calendar day of a Date (or ISO string) as a UTC day number. */
function todayNumber(today: Date | string): number {
  if (typeof today === 'string') return dayNumber(today);
  return Math.floor(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) / 86400000);
}

/**
 * True when the theme was added within the last `days` days (inclusive of the day it was added)
 * and after the launch catalogue. `today` is a Date (its local calendar day) or 'YYYY-MM-DD'.
 * Themes dated in the future count as new.
 */
export function isNew(theme: Pick<Theme, 'addedAt'>, today: Date | string, days: number = NEW_BADGE_DAYS): boolean {
  if (!theme.addedAt) return false;
  const added = dayNumber(theme.addedAt);
  const now = todayNumber(today);
  if (!Number.isFinite(added) || !Number.isFinite(now)) return false;
  if (added <= dayNumber(LAUNCH_CATALOGUE_DATE)) return false;
  return now - added < days;
}

/** How many themes are in each category (every category id present, zero included). */
export function categoryCounts(themes: readonly Theme[]): Record<ThemeCategoryId, number> {
  const out = Object.fromEntries(CATEGORY_IDS.map((id) => [id, 0])) as Record<ThemeCategoryId, number>;
  for (const t of themes) {
    for (const id of new Set(t.categories ?? [])) {
      if (isCategoryId(id)) out[id] += 1;
    }
  }
  return out;
}
