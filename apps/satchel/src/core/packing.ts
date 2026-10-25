// Packing lists: one per trip, started from one or more templates (src/content/packing_templates.json) or empty.
// Pure and immutable: every edit returns a new list. The UI owns persistence (key 'satchel.packing.v1').
import type { PackingItem, PackingList, Trip } from './model.ts';
import { zonesReadable } from './timeline.ts';
import { daysBetween, minutesBetween } from './tz.ts';

// ---------------------------------------------------------------- templates (shape of the bundled JSON)

/** Quantity rules present in the data. Anything else is ignored (no quantity shown). */
export type QtyRule = { rule: 'per_day' | 'per_2_days'; max: number };
export type TemplateItem = { id: string; label: string; category: string; qty_rule: QtyRule | null; conditions: string[] };
export type Template = { id: string; name: string; trip_types: string[]; items: TemplateItem[] };
export type TemplateFile = { version: number; templates: Template[] };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

function parseRule(v: unknown): QtyRule | null {
  if (!isObj(v)) return null;
  const { rule, max } = v;
  if ((rule === 'per_day' || rule === 'per_2_days') && typeof max === 'number' && max >= 1) return { rule, max: Math.floor(max) };
  return null;
}

/** Reads the bundled JSON defensively: malformed templates or items are dropped, unknown qty rules become null. */
export function parseTemplates(data: unknown): TemplateFile {
  if (!isObj(data) || !Array.isArray(data.templates)) return { version: 0, templates: [] };
  const templates: Template[] = [];
  for (const t of data.templates) {
    if (!isObj(t) || typeof t.id !== 'string' || typeof t.name !== 'string' || !Array.isArray(t.items)) continue;
    const items: TemplateItem[] = [];
    for (const i of t.items) {
      if (!isObj(i) || typeof i.id !== 'string' || typeof i.label !== 'string' || !i.label.trim()) continue;
      items.push({
        id: i.id,
        label: i.label.trim(),
        category: typeof i.category === 'string' && i.category ? i.category : 'misc',
        qty_rule: parseRule(i.qty_rule),
        conditions: strs(i.conditions),
      });
    }
    templates.push({ id: t.id, name: t.name, trip_types: strs(t.trip_types), items });
  }
  return { version: typeof data.version === 'number' ? data.version : 0, templates };
}

// ---------------------------------------------------------------- list types

/** Display order of categories. Categories not listed here sort after these (alphabetically), and 'misc' is last. */
export const CATEGORY_ORDER = ['documents', 'money', 'clothes', 'toiletries', 'health', 'tech', 'outdoor', 'kids', 'misc'] as const;
export const CUSTOM_CATEGORY = 'misc';

/** A packing row. Extends the model's PackingItem with optional template details (stored alongside). */
export type PackItem = PackingItem & {
  category?: string;
  /** Suggested quantity from the template's qty_rule and the trip length. */
  qty?: number;
  /** Template item it came from (absent for items the traveller added). */
  templateItemId?: string;
};
export type PackList = Omit<PackingList, 'items'> & { items: PackItem[]; templates?: string[] };
/** Stored under 'satchel.packing.v1': tripId -> list. */
export type PackStore = Record<string, PackList>;
export const PACKING_KEY = 'satchel.packing.v1';
/** Stable fallback for usePersisted (a module-level constant). */
export const EMPTY_STORE: PackStore = Object.freeze({}) as PackStore;

export const categoryOf = (i: PackItem) => i.category || CUSTOM_CATEGORY;

function categoryRank(c: string): [number, string] {
  if (c === 'misc') return [2, ''];
  const i = (CATEGORY_ORDER as readonly string[]).indexOf(c);
  return i >= 0 ? [0, String(i).padStart(2, '0')] : [1, c];
}
export function compareCategories(a: string, b: string): number {
  const [ra, sa] = categoryRank(a);
  const [rb, sb] = categoryRank(b);
  return ra - rb || (sa < sb ? -1 : sa > sb ? 1 : 0);
}

/** Lower-case, trimmed, single-spaced, punctuation-free: "Plug  adapter!" and "plug adapter" are the same item. */
export const normaliseLabel = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

// ---------------------------------------------------------------- trip facts

/** Nights between start and end dates (0 for a day trip, never negative). */
export const tripNights = (trip: Pick<Trip, 'startDate' | 'endDate'>) => Math.max(0, daysBetween(trip.startDate, trip.endDate));

/** Suggested quantity for a rule and trip length, capped at the rule's max; at least 1. Unknown or no rule: undefined. */
export function qtyFor(rule: QtyRule | null | undefined, nights: number): number | undefined {
  if (!rule) return undefined;
  const n = Math.max(0, Math.floor(nights));
  if (rule.rule === 'per_day') return Math.min(rule.max, Math.max(1, n));
  if (rule.rule === 'per_2_days') return Math.min(rule.max, Math.max(1, Math.ceil(n / 2)));
  return undefined;
}

/** Condition tags used by the data: cold, outdoor, kids, flight, intl, beach, business. */
export type Facts = Partial<Record<string, boolean>>;

/** Trip types (from the templates' trip_types) that make a condition true. */
const TYPE_TO_CONDITION: Record<string, string> = {
  cold_weather: 'cold',
  snow: 'cold',
  ski: 'cold',
  outdoors: 'outdoor',
  hiking: 'outdoor',
  camping: 'outdoor',
  kids: 'kids',
  family: 'kids',
  flight: 'flight',
  long_haul: 'flight',
  intl: 'intl',
  multi_country: 'intl',
  beach: 'beach',
  warm_weather: 'beach',
  business: 'business',
  work: 'business',
};

/**
 * What we know about the trip. Chosen templates make their conditions true (choosing "Ski and snow" means cold);
 * a flight booking makes 'flight' true. Nothing is ever inferred false, so items are only left out when the caller
 * says a condition is false.
 */
export function tripFacts(trip: Pick<Trip, 'items'> | null, templates: Template[]): Facts {
  const facts: Facts = {};
  for (const t of templates) {
    for (const type of t.trip_types) {
      const c = TYPE_TO_CONDITION[type];
      if (c) facts[c] = true;
    }
  }
  if (trip?.items.some((i) => i.kind === 'flight')) facts.flight = true;
  return facts;
}

/** An item is included unless one of its conditions is known to be false. */
export const conditionsMet = (conditions: string[], facts: Facts) => conditions.every((c) => facts[c] !== false);

// ---------------------------------------------------------------- building

export type BuildOptions = { nights: number; facts?: Facts };

/**
 * Builds a trip's list from one or more templates, in the order given: items are merged and de-duplicated by
 * normalised label (the first keeps its id and category; the larger quantity wins), then ordered by category.
 * Row ids are `<templateItemId>` so they are stable and unique within the list.
 */
export function buildList(tripId: string, templates: Template[], opts: BuildOptions): PackList {
  const facts = opts.facts ?? {};
  const byLabel = new Map<string, PackItem>();
  for (const t of templates) {
    for (const ti of t.items) {
      if (!conditionsMet(ti.conditions, facts)) continue;
      const key = normaliseLabel(ti.label);
      if (!key) continue;
      const qty = qtyFor(ti.qty_rule, opts.nights);
      const prev = byLabel.get(key);
      if (prev) {
        if (qty !== undefined && (prev.qty === undefined || qty > prev.qty)) byLabel.set(key, { ...prev, qty });
        continue;
      }
      const item: PackItem = { id: ti.id, label: ti.label, done: false, category: ti.category, templateItemId: ti.id };
      if (qty !== undefined) item.qty = qty;
      byLabel.set(key, item);
    }
  }
  const items = sortByCategory([...byLabel.values()]);
  const ids = templates.map((t) => t.id);
  const list: PackList = { tripId, items };
  if (ids.length) {
    list.template = ids[0];
    list.templates = ids;
  }
  return list;
}

export const emptyList = (tripId: string): PackList => ({ tripId, items: [] });

/** Template ids already used by a list (older lists only stored `template`). */
export const listTemplates = (list: PackList): string[] => list.templates ?? (list.template ? [list.template] : []);

export type MergeResult = { list: PackList; added: number };

/**
 * Adds one or more templates to an existing list. Items whose label is already on the list are skipped (the
 * traveller's ticks, renames and quantities are never touched); new items arrive unpacked, in category order,
 * with ids that cannot clash with existing rows. The templates are remembered on the list.
 */
export function addTemplates(list: PackList, templates: Template[], opts: BuildOptions): MergeResult {
  if (!templates.length) return { list, added: 0 };
  const built = buildList(list.tripId, templates, opts);
  const seen = new Set(list.items.map((i) => normaliseLabel(i.label)));
  const ids = new Set(list.items.map((i) => i.id));
  const fresh: PackItem[] = [];
  for (const item of built.items) {
    const key = normaliseLabel(item.label);
    if (seen.has(key)) continue;
    seen.add(key);
    let id = item.id;
    for (let n = 2; ids.has(id); n++) id = `${item.id}~${n}`;
    ids.add(id);
    fresh.push(id === item.id ? item : { ...item, id });
  }
  const used = listTemplates(list);
  const templateIds = [...used, ...templates.map((t) => t.id).filter((id) => !used.includes(id))];
  const next: PackList = { ...list, items: fresh.length ? sortByCategory([...list.items, ...fresh]) : list.items, templates: templateIds };
  if (!next.template && templateIds.length) next.template = templateIds[0];
  return { list: next, added: fresh.length };
}


/** Stable sort by category order (rows keep their order within a category). */
export function sortByCategory(items: PackItem[]): PackItem[] {
  return items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => compareCategories(categoryOf(a.item), categoryOf(b.item)) || a.i - b.i)
    .map((x) => x.item);
}

/**
 * Suggests one template for the trip: a flight over 8 h or a trip of 14+ nights -> long-haul carry-on;
 * a car hire -> road trip; otherwise city break. Returns null if the suggested id isn't in `templates`.
 */
export function suggestTemplate(trip: Pick<Trip, 'startDate' | 'endDate' | 'items'>, templates: Template[]): string | null {
  const has = (id: string) => templates.some((t) => t.id === id);
  const longFlight = trip.items.some((i) => i.kind === 'flight' && i.end && zonesReadable(i) && minutesBetween(i.start, i.end) > 8 * 60);
  let id = 'city_break';
  if (longFlight || tripNights(trip) >= 14) id = 'longhaul_carryon';
  else if (trip.items.some((i) => i.kind === 'car')) id = 'road_trip';
  if (has(id)) return id;
  return templates[0]?.id ?? null;
}

// ---------------------------------------------------------------- edits (all immutable)

const mapItem = (list: PackList, id: string, fn: (i: PackItem) => PackItem): PackList => {
  if (!list.items.some((i) => i.id === id)) return list;
  return { ...list, items: list.items.map((i) => (i.id === id ? fn(i) : i)) };
};

export const toggleItem = (list: PackList, id: string): PackList => mapItem(list, id, (i) => ({ ...i, done: !i.done }));

export const hasLabel = (list: PackList, label: string, exceptId?: string) => {
  const key = normaliseLabel(label);
  return list.items.some((i) => i.id !== exceptId && normaliseLabel(i.label) === key);
};

export type AddResult = { list: PackList; error?: 'empty' | 'duplicate' };

/** Adds a traveller's own item (category 'misc', unpacked). Empty or duplicate labels leave the list unchanged. */
export function addItem(list: PackList, label: string, id: string): AddResult {
  const clean = label.trim().replace(/\s+/g, ' ');
  if (!normaliseLabel(clean)) return { list, error: 'empty' };
  if (hasLabel(list, clean)) return { list, error: 'duplicate' };
  const item: PackItem = { id, label: clean, done: false, category: CUSTOM_CATEGORY };
  return { list: { ...list, items: sortByCategory([...list.items, item]) } };
}

export const removeItem = (list: PackList, id: string): PackList =>
  list.items.some((i) => i.id === id) ? { ...list, items: list.items.filter((i) => i.id !== id) } : list;

/** Renames an item; an empty label leaves it unchanged. */
export function renameItem(list: PackList, id: string, label: string): PackList {
  const clean = label.trim().replace(/\s+/g, ' ');
  if (!normaliseLabel(clean)) return list;
  return mapItem(list, id, (i) => ({ ...i, label: clean }));
}

/** Unticks every packed item without deleting anything. */
export const resetTicks = (list: PackList): PackList =>
  list.items.some((i) => i.done) ? { ...list, items: list.items.map((i) => (i.done ? { ...i, done: false } : i)) } : list;

// ---------------------------------------------------------------- reading

export type CategoryProgress = { category: string; done: number; total: number };
export type Progress = { done: number; total: number; categories: CategoryProgress[] };

export function progress(list: PackList | null | undefined): Progress {
  const items = list?.items ?? [];
  const by = new Map<string, CategoryProgress>();
  let done = 0;
  for (const i of items) {
    const c = categoryOf(i);
    const p = by.get(c) ?? { category: c, done: 0, total: 0 };
    p.total++;
    if (i.done) {
      p.done++;
      done++;
    }
    by.set(c, p);
  }
  const categories = [...by.values()].sort((a, b) => compareCategories(a.category, b.category));
  return { done, total: items.length, categories };
}

export type Group = { category: string; items: PackItem[] };

/** Items grouped by category in display order. */
export function groupByCategory(list: PackList): Group[] {
  const by = new Map<string, PackItem[]>();
  for (const i of list.items) {
    const c = categoryOf(i);
    by.set(c, [...(by.get(c) ?? []), i]);
  }
  return [...by.entries()].sort(([a], [b]) => compareCategories(a, b)).map(([category, items]) => ({ category, items }));
}

/** Reads one trip's list from the stored record, tolerating junk from older builds. */
export function listFor(store: unknown, tripId: string): PackList | null {
  if (!isObj(store)) return null;
  const l = store[tripId];
  if (!isObj(l) || !Array.isArray(l.items)) return null;
  const items = l.items.filter(
    (i): i is PackItem => isObj(i) && typeof i.id === 'string' && typeof i.label === 'string' && typeof i.done === 'boolean',
  );
  return { ...(l as PackList), tripId, items };
}

export const putList = (store: PackStore, list: PackList): PackStore => ({ ...store, [list.tripId]: list });
export const dropList = (store: PackStore, tripId: string): PackStore => {
  if (!(tripId in store)) return store;
  const next = { ...store };
  delete next[tripId];
  return next;
};
