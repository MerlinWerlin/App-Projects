// Templates screen "shelf" (T75, DESIGN_V2 §7 + MARKET "Design reference 18 Oct" §2): the horizontal row of big
// category bubbles above the grid. Bubbles are single-select: All, New (the most recently added set), then the
// categories in a fixed, friendly order. Collections (occasions, seasons, styles) and Favourites stay separate
// toggles, so they still combine with a bubble exactly as the v1 chips did. Pure TS, tested in templateShelf.test.ts.
import { CATEGORIES, isTemplateCategory, type Template, type TemplateCategory } from './templates.ts';

/** What the bubble row is set to: everything, the newest set, or one category. */
export type Shelf = 'all' | 'new' | TemplateCategory;

/** Route value for the New bubble (/templates?category=new). */
export const NEW_SHELF_PARAM = 'new';

/**
 * Categories that make up the "New" bubble: the set added most recently. T65 (18 Oct 2026) added Cute & chibi; fb-1022 (22 Oct 2026) added Heroes, Game world, Movie night, Fairy tales and Kids; fb-1022b added Sea life and the kawaii batches (NEW_ID_PREFIXES).
 * When a new set ships (T71 …), put its category here and drop the old one.
 */
export const NEW_SETS: readonly TemplateCategory[] = ['heroes', 'game', 'movies', 'fairytales', 'kids', 'sealife', 'trade'];

/**
 * Batches that joined an older category and still count as New (fb-1022b, D110-2): the kawaii food/friends batches
 * live in Cute & chibi next to the T65 pieces, so they are picked by id prefix.
 */
export const NEW_ID_PREFIXES: readonly string[] = ['kawaii-'];

/** Bubble order after All and New: the most asked-for first (market-1018), then the rest of the catalogue. */
export const SHELF_ORDER: readonly TemplateCategory[] = [
  'trade',
  'heroes',
  'game',
  'movies',
  'fairytales',
  'kids',
  'animals',
  'flowers',
  'cute',
  'lettering',
  'wildlife',
  'sealife',
  'faces',
  'mandalas',
  'patterns',
  'places',
  'fantasy',
  'stilllife',
  'shapes',
];

export function isNewTemplate(t: Template, sets: readonly TemplateCategory[] = NEW_SETS): boolean {
  return sets.includes(t.category) || NEW_ID_PREFIXES.some((p) => t.id.startsWith(p));
}

/** Templates in the newest set, catalogue order kept. */
export function newTemplates(templates: readonly Template[], sets: readonly TemplateCategory[] = NEW_SETS): Template[] {
  return templates.filter((t) => isNewTemplate(t, sets));
}

/** Shelf from the `category` route param: 'new', a category id, otherwise 'all'. */
export function parseShelf(value: unknown): Shelf {
  const raw = Array.isArray(value) ? value[0] : value;
  const v = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (v === NEW_SHELF_PARAM) return 'new';
  return isTemplateCategory(v) ? v : 'all';
}

/** The category filter a shelf implies (All and New filter by pool, not by category). */
export function shelfCategory(shelf: Shelf): TemplateCategory | null {
  return shelf === 'all' || shelf === 'new' ? null : shelf;
}

/** The templates a shelf searches in: the newest set for New, the whole library otherwise. */
export function shelfPool(templates: readonly Template[], shelf: Shelf, sets: readonly TemplateCategory[] = NEW_SETS): readonly Template[] {
  return shelf === 'new' ? newTemplates(templates, sets) : templates;
}

/**
 * The bubbles to show, in order: All, New (only when the newest set has art), then categories in SHELF_ORDER
 * (any catalogue category missing from it is appended in catalogue order). Categories with no art are hidden,
 * except the current one, so a deep link to an empty category still shows its selected bubble.
 */
export function shelfBubbles(
  templates: readonly Template[],
  current: Shelf = 'all',
  sets: readonly TemplateCategory[] = NEW_SETS,
): Shelf[] {
  const have = new Set(templates.map((t) => t.category));
  const order = [...SHELF_ORDER, ...CATEGORIES.map((c) => c.id).filter((id) => !SHELF_ORDER.includes(id))];
  const out: Shelf[] = ['all'];
  if (templates.some((t) => isNewTemplate(t, sets)) || current === 'new') out.push('new');
  for (const id of order) if (have.has(id) || id === current) out.push(id);
  return out;
}

/** The template whose art is drawn inside a bubble: the first one in the shelf's pool (undefined for none). */
export function shelfGlyph(templates: readonly Template[], shelf: Shelf, sets: readonly TemplateCategory[] = NEW_SETS): Template | undefined {
  if (shelf === 'all') return templates[0];
  if (shelf === 'new') return templates.find((t) => isNewTemplate(t, sets));
  return templates.find((t) => t.category === shelf);
}
