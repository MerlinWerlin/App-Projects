// Template discovery (T24): search, filters, occasion/style collections, facet counts, and the
// recent-templates / favourites list logic. Pure TS; every function takes the template list as an
// argument so it works for any library size and can be tested with fixtures.
import {
  CATEGORIES,
  LEVELS,
  templateLevel,
  type Template,
  type TemplateCategory,
  type TemplateLevel,
} from './templates.ts';

// ---------------------------------------------------------------------------------------------
// Collections (occasions & styles)

export type TemplateCollectionId =
  | 'birthday'
  | 'christmas'
  | 'wedding'
  | 'thanks'
  | 'halloween'
  | 'botanical'
  | 'vintage'
  | 'whimsical'
  | 'kids';

export type TemplateCollection = {
  id: TemplateCollectionId;
  label: string;
  /** Short chip label for tight rows (Home). Defaults to label. */
  shortLabel?: string;
  /** A template is in the collection if it has any of these tags... */
  tags: readonly string[];
  /** ...or (when given) any of these levels. */
  levels?: readonly TemplateLevel[];
};

export const COLLECTIONS: readonly TemplateCollection[] = [
  { id: 'birthday', label: 'Birthday cards', shortLabel: 'Birthday', tags: ['birthday'] },
  { id: 'christmas', label: 'Christmas', tags: ['christmas'] },
  { id: 'wedding', label: 'Wedding & love', tags: ['wedding', 'love'] },
  { id: 'thanks', label: 'Thank you', tags: ['thanks'] },
  { id: 'halloween', label: 'Halloween', tags: ['halloween'] },
  { id: 'botanical', label: 'Botanical', tags: ['botanical'] },
  { id: 'vintage', label: 'Vintage & gothic', tags: ['vintage', 'gothic'] },
  { id: 'whimsical', label: 'Whimsical', tags: ['whimsical'] },
  { id: 'kids', label: 'For kids & beginners', shortLabel: 'For kids', tags: ['cute'], levels: ['beginner'] },
];

/** Route value meaning "favourites only" (e.g. /templates?collection=favorites). */
export const FAVORITES_PARAM = 'favorites';

export function getCollection(id: string | null | undefined): TemplateCollection | undefined {
  if (!id) return undefined;
  return COLLECTIONS.find((c) => c.id === id);
}

export function collectionLabel(id: TemplateCollectionId, short = false): string {
  const c = getCollection(id);
  if (!c) return id;
  return short ? (c.shortLabel ?? c.label) : c.label;
}

export function inCollection(t: Template, c: TemplateCollection): boolean {
  if (c.levels && c.levels.includes(templateLevel(t))) return true;
  const tags = t.tags ?? [];
  return tags.some((tag) => c.tags.includes(tag.toLowerCase()));
}

export function levelLabel(level: TemplateLevel): string {
  return LEVELS.find((l) => l.id === level)?.label ?? level;
}

// ---------------------------------------------------------------------------------------------
// Route params

function first(value: unknown): string | null {
  const v = Array.isArray(value) ? value[0] : value;
  return typeof v === 'string' ? v.trim().toLowerCase() : null;
}

export function parseLevel(value: unknown): TemplateLevel | null {
  const v = first(value);
  return v && LEVELS.some((l) => l.id === v) ? (v as TemplateLevel) : null;
}

/** Collection id from a route param; 'favorites'/'favourites' and unknown values → null. */
export function parseCollection(value: unknown): TemplateCollectionId | null {
  const v = first(value);
  return getCollection(v)?.id ?? null;
}

/** True when a route param asks for favourites only. */
export function isFavoritesParam(value: unknown): boolean {
  const v = first(value);
  return v === 'favorites' || v === 'favourites';
}

export function parseQuery(value: unknown): string {
  const v = Array.isArray(value) ? value[0] : value;
  return typeof v === 'string' ? v.slice(0, 80) : '';
}

// ---------------------------------------------------------------------------------------------
// Search

const STOPWORDS = new Set(['a', 'an', 'and', 'the', 'of', 'for', 'with', 'to', 'in', 'on']);
const ALIASES: ReadonlyMap<string, string> = new Map([
  ['xmas', 'christmas'],
  ['thankyou', 'thanks'],
]);

/**
 * Lower-case words of `s`, Latin accents stripped, split on anything that is not a letter, digit or
 * combining mark (so localized names in any script tokenize too: Devanagari vowel signs stay in the word).
 */
export function tokenize(s: string): string[] {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}\p{M}]+/u)
    .filter((w) => w.length > 0);
}

/** Query tokens: stopwords dropped (unless that would leave nothing), simple aliases applied. */
export function queryTokens(query: string): string[] {
  const all = tokenize(query);
  const kept = all.filter((w) => !STOPWORDS.has(w));
  return (kept.length > 0 ? kept : all).map((w) => ALIASES.get(w) ?? w);
}

const NON_ASCII = /[^\x00-\x7f]/;

/**
 * Prefix match, plus a light plural rule so 'roses' finds 'rose' and 'foxes' finds 'fox'. Non-ASCII tokens
 * also match inside a word, since scripts like Japanese and Chinese write names without spaces.
 */
function wordMatches(word: string, token: string): boolean {
  if (word.startsWith(token)) return true;
  if (NON_ASCII.test(token) && word.includes(token)) return true;
  if (token.length > word.length && word.length >= 3) {
    const rest = token.slice(word.length);
    return token.startsWith(word) && (rest === 's' || rest === 'es');
  }
  return false;
}

const anyWord = (words: readonly string[], token: string) => words.some((w) => wordMatches(w, token));

export const SCORE = { name: 100, nameExact: 20, tag: 10, category: 1 } as const;

export type SearchIndexEntry = { name: string[]; tags: string[]; category: string[] };

/**
 * Optional display-language names (the UI passes its translations), searched in addition to the English
 * name, tags and labels so a query in the app's language finds templates too. Core stays i18n-free.
 */
export type SearchLocalizer = {
  name?: (t: Template) => string;
  category?: (category: TemplateCategory) => string;
  level?: (level: TemplateLevel) => string;
};

function categoryWords(category: TemplateCategory, loc?: SearchLocalizer): string[] {
  const label = CATEGORIES.find((c) => c.id === category)?.label ?? category;
  const words = [...tokenize(label), category];
  if (loc?.category) words.push(...tokenize(loc.category(category)));
  return words;
}

export function indexTemplate(t: Template, loc?: SearchLocalizer): SearchIndexEntry {
  const level = templateLevel(t);
  const tags = (t.tags ?? []).flatMap((tag) => tokenize(tag));
  tags.push(...tokenize(levelLabel(level)));
  if (loc?.level) tags.push(...tokenize(loc.level(level)));
  const name = tokenize(t.name);
  if (loc?.name) name.push(...tokenize(loc.name(t)));
  return { name, tags, category: categoryWords(t.category, loc) };
}

/**
 * Relevance of a template for query tokens: 0 when any token matches nothing (all tokens must match).
 * Each token scores by its best field: name (100, +20 for a whole-word hit) > tag/level (10) > category (1).
 */
export function scoreEntry(entry: SearchIndexEntry, tokens: readonly string[]): number {
  let total = 0;
  for (const tok of tokens) {
    let best = 0;
    if (anyWord(entry.name, tok)) best = SCORE.name + (entry.name.includes(tok) ? SCORE.nameExact : 0);
    else if (anyWord(entry.tags, tok)) best = SCORE.tag;
    else if (anyWord(entry.category, tok)) best = SCORE.category;
    if (best === 0) return 0;
    total += best;
  }
  return total;
}

export function scoreTemplate(t: Template, query: string): number {
  const tokens = queryTokens(query);
  if (tokens.length === 0) return 1;
  return scoreEntry(indexTemplate(t), tokens);
}

// ---------------------------------------------------------------------------------------------
// Filters

export type TemplateFilters = {
  query: string;
  category: TemplateCategory | null;
  level: TemplateLevel | null;
  collection: TemplateCollectionId | null;
  favoritesOnly: boolean;
};

export const NO_FILTERS: TemplateFilters = {
  query: '',
  category: null,
  level: null,
  collection: null,
  favoritesOnly: false,
};

export function hasActiveFilters(f: TemplateFilters): boolean {
  return f.query.trim().length > 0 || f.category !== null || f.level !== null || f.collection !== null || f.favoritesOnly;
}

type Favs = ReadonlySet<string> | readonly string[];

function toSet(favs: Favs): ReadonlySet<string> {
  return Array.isArray(favs) ? new Set(favs as readonly string[]) : (favs as ReadonlySet<string>);
}

function passesFacets(t: Template, f: TemplateFilters, favs: ReadonlySet<string>): boolean {
  if (f.category && t.category !== f.category) return false;
  if (f.level && templateLevel(t) !== f.level) return false;
  if (f.collection) {
    const c = getCollection(f.collection);
    if (c && !inCollection(t, c)) return false;
  }
  if (f.favoritesOnly && !favs.has(t.id)) return false;
  return true;
}

/**
 * Templates matching all filters. With a query, results are ranked by relevance (ties keep catalogue
 * order); without one, catalogue order is kept.
 */
export function searchTemplates(
  templates: readonly Template[],
  f: TemplateFilters,
  favorites: Favs = [],
  loc?: SearchLocalizer,
): Template[] {
  const favs = toSet(favorites);
  const tokens = queryTokens(f.query);
  const hits: { t: Template; score: number; i: number }[] = [];
  templates.forEach((t, i) => {
    if (!passesFacets(t, f, favs)) return;
    const score = tokens.length === 0 ? 1 : scoreEntry(indexTemplate(t, loc), tokens);
    if (score > 0) hits.push({ t, score, i });
  });
  if (tokens.length > 0) hits.sort((a, b) => b.score - a.score || a.i - b.i);
  return hits.map((h) => h.t);
}

export type FilterCounts = {
  /** Results for the filters exactly as given. */
  total: number;
  /** Results if this category were chosen (other filters unchanged); `all` = category cleared. */
  categories: Record<TemplateCategory, number> & { all: number };
  levels: Record<TemplateLevel, number> & { all: number };
  collections: Record<TemplateCollectionId, number>;
  /** Results if favourites-only were switched on. */
  favorites: number;
};

/** Faceted counts: how many results each chip would give, holding the other filters fixed. */
export function filterCounts(
  templates: readonly Template[],
  f: TemplateFilters,
  favorites: Favs = [],
  loc?: SearchLocalizer,
): FilterCounts {
  const favs = toSet(favorites);
  const tokens = queryTokens(f.query);
  const matched = tokens.length === 0 ? templates : templates.filter((t) => scoreEntry(indexTemplate(t, loc), tokens) > 0);

  const categories = { all: 0 } as FilterCounts['categories'];
  for (const c of CATEGORIES) categories[c.id] = 0;
  const levels = { all: 0 } as FilterCounts['levels'];
  for (const l of LEVELS) levels[l.id] = 0;
  const collections = {} as FilterCounts['collections'];
  for (const c of COLLECTIONS) collections[c.id] = 0;
  let total = 0;
  let favCount = 0;

  const noCat = { ...f, category: null };
  const noLevel = { ...f, level: null };
  const noColl = { ...f, collection: null };
  const withFav = { ...f, favoritesOnly: true };
  for (const t of matched) {
    if (passesFacets(t, f, favs)) total++;
    if (passesFacets(t, noCat, favs)) {
      categories.all++;
      categories[t.category] = (categories[t.category] ?? 0) + 1;
    }
    if (passesFacets(t, noLevel, favs)) {
      levels.all++;
      levels[templateLevel(t)]++;
    }
    if (passesFacets(t, noColl, favs)) {
      for (const c of COLLECTIONS) if (inCollection(t, c)) collections[c.id]++;
    }
    if (passesFacets(t, withFav, favs)) favCount++;
  }
  return { total, categories, levels, collections, favorites: favCount };
}

// ---------------------------------------------------------------------------------------------
// Recent templates & favourites (mirrors src/core/recent.ts: dedupe, newest first, cap)

export type RecentTemplate = { id: string; usedAt: number };

export const RECENT_TEMPLATES_CAP = 12;
/** Sanity cap on stored favourites, so a corrupted store can't grow without bound. */
export const FAVORITES_CAP = 500;

type IsKnown = (id: string) => boolean;

/** Adds (or moves) `id` to the front of the recent list, capped at RECENT_TEMPLATES_CAP. */
export function addRecentTemplate(list: readonly RecentTemplate[], id: string, usedAt: number): RecentTemplate[] {
  if (!id) return [...list];
  return [{ id, usedAt }, ...list.filter((r) => r.id !== id)].slice(0, RECENT_TEMPLATES_CAP);
}

export function removeRecentTemplate(list: readonly RecentTemplate[], id: string): RecentTemplate[] {
  return list.filter((r) => r.id !== id);
}

export function serializeRecentTemplates(list: readonly RecentTemplate[]): string {
  return JSON.stringify(list.map((r) => ({ id: r.id, usedAt: r.usedAt })));
}

/** Parses stored JSON; malformed entries and (with `isKnown`) unknown ids are dropped. Deduped, newest first, capped. */
export function parseRecentTemplates(json: string | null, isKnown?: IsKnown): RecentTemplate[] {
  const raw = parseArray(json);
  const all: RecentTemplate[] = [];
  for (const v of raw) {
    if (typeof v !== 'object' || v === null) continue;
    const o = v as Record<string, unknown>;
    if (typeof o.id !== 'string' || o.id.length === 0) continue;
    if (typeof o.usedAt !== 'number' || !Number.isFinite(o.usedAt)) continue;
    if (isKnown && !isKnown(o.id)) continue;
    all.push({ id: o.id, usedAt: o.usedAt });
  }
  all.sort((a, b) => b.usedAt - a.usedAt);
  const seen = new Set<string>();
  const out: RecentTemplate[] = [];
  for (const r of all) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    out.push(r);
  }
  return out.slice(0, RECENT_TEMPLATES_CAP);
}

/** Toggles `id` in the favourites list: removes it, or adds it at the front (newest first). */
export function toggleFavorite(list: readonly string[], id: string): string[] {
  if (!id) return [...list];
  if (list.includes(id)) return list.filter((x) => x !== id);
  return [id, ...list].slice(0, FAVORITES_CAP);
}

export function isFavorite(list: Favs, id: string): boolean {
  return toSet(list).has(id);
}

export function serializeFavorites(list: readonly string[]): string {
  return JSON.stringify(list);
}

/** Parses stored favourite ids; non-strings, duplicates and (with `isKnown`) unknown ids are dropped. */
export function parseFavorites(json: string | null, isKnown?: IsKnown): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of parseArray(json)) {
    if (typeof v !== 'string' || v.length === 0 || seen.has(v)) continue;
    if (isKnown && !isKnown(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out.slice(0, FAVORITES_CAP);
}

/** Looks ids up in `templates`, keeping their order and skipping any that no longer exist. */
export function resolveTemplateIds(ids: readonly string[], templates: readonly Template[]): Template[] {
  const byId = new Map(templates.map((t) => [t.id, t] as const));
  const out: Template[] = [];
  for (const id of ids) {
    const t = byId.get(id);
    if (t) out.push(t);
  }
  return out;
}

function parseArray(json: string | null): unknown[] {
  if (json == null) return [];
  try {
    const raw: unknown = JSON.parse(json);
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}
