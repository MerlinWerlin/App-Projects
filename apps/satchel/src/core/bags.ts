// T99 Bags (owner-1031 D, deepen Packing). Every packing row can sit in a bag: three built-in bags (Carry-on,
// Personal item, Checked) plus the traveller's own bags with a colour and a cabin / hold choice. Rows can carry an
// optional weight; a bag can carry a weight limit the traveller types (no airline data ships). "Carry-on only" moves
// every row out of the hold bags into the carry-on and remembers where each came from, so switching it off puts them
// back. Gentle hints (spare batteries / power banks and medicines in the cabin, liquids in small containers in a clear
// bag) are general guidance only; the screen labels them "verify with your airline".
//
// Bags live on the packing list (PackList.bags / carryOnOnly; PackItem.bag / weightG / movedFrom) and so travel in
// .satchel files with it. Bag ids are local to the list and are kept on import (rows get new ids; their bag link stays).
// Pure and immutable like packing.ts: every edit returns a new list. Junk from storage or a file is cleaned, never fatal.
import type { CardColour } from './loyalty.ts';
import { CARD_COLOURS } from './loyalty.ts';
import { categoryOf, normaliseLabel, type PackItem, type PackList } from './packing.ts';
import { decimalMark, parseNumber, roundTo, type UnitSystem } from './units.ts';

export type BagKind = 'carry' | 'personal' | 'checked' | 'own';
export const BAG_KINDS: readonly BagKind[] = ['carry', 'personal', 'checked', 'own'];

export type Bag = {
  id: string;
  kind: BagKind;
  /** The traveller's name for an own bag (built-in bags take their name from the catalogue). */
  name?: string;
  colour: CardColour;
  /** Own bags only: true when it goes in the hold (checked), false or absent for a cabin bag. */
  hold?: boolean;
  /** Weight limit the traveller typed, in grams. */
  limitG?: number;
};

export const CARRY_ID = 'carry';
export const PERSONAL_ID = 'personal';
export const CHECKED_ID = 'checked';

/** The three built-in bags, in display order. They can be recoloured and given a limit, never removed. */
export const DEFAULT_BAGS: readonly Bag[] = Object.freeze([
  { id: CARRY_ID, kind: 'carry', colour: 'sea' },
  { id: PERSONAL_ID, kind: 'personal', colour: 'teal' },
  { id: CHECKED_ID, kind: 'checked', colour: 'rust' },
] as Bag[]);
const BUILT_IN = new Map(DEFAULT_BAGS.map((b) => [b.id, b]));

export const MAX_BAGS = 12;
export const MAX_BAG_NAME = 40;
/** Largest weight a row or a limit can have: 200 kg (anything above is a typo). */
export const MAX_GRAMS = 200_000;
export const OWN_BAG_COLOUR: CardColour = 'plum';

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Whole grams from 1 to MAX_GRAMS, or undefined. */
export function cleanGrams(v: unknown): number | undefined {
  if (typeof v !== 'number' || !Number.isFinite(v)) return undefined;
  const g = Math.round(v);
  return g >= 1 && g <= MAX_GRAMS ? g : undefined;
}

const cleanName = (v: unknown) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, MAX_BAG_NAME) : '');

function cleanBag(v: unknown): Bag | null {
  if (!isObj(v) || typeof v.id !== 'string' || !v.id) return null;
  const builtIn = BUILT_IN.get(v.id);
  const kind: BagKind | null = builtIn ? builtIn.kind : v.kind === 'own' ? 'own' : null;
  if (!kind) return null;
  const colour = (CARD_COLOURS as readonly unknown[]).includes(v.colour) ? (v.colour as CardColour) : builtIn?.colour ?? OWN_BAG_COLOUR;
  const name = cleanName(v.name);
  if (kind === 'own' && !name) return null;
  // Unknown keys are kept (a later build's bag fields survive this one), known ones replaced by their clean value.
  const { name: _n, hold: _h, limitG: _l, ...rest } = v;
  const bag: Bag = { ...(rest as Bag), id: v.id, kind, colour };
  if (kind === 'own') bag.name = name;
  if (kind === 'own' && v.hold === true) bag.hold = true;
  const limit = cleanGrams(v.limitG);
  if (limit !== undefined) bag.limitG = limit;
  return bag;
}

/** The list's bags: built-in ones first (always present), then own bags; duplicates and junk dropped. */
export function bagsOf(list: Pick<PackList, 'bags'> | null | undefined): Bag[] {
  const raw: unknown[] = Array.isArray(list?.bags) ? (list.bags as unknown[]) : [];
  const byId = new Map<string, Bag>();
  for (const r of raw) {
    const b = cleanBag(r);
    if (b && !byId.has(b.id)) byId.set(b.id, b);
  }
  const out: Bag[] = DEFAULT_BAGS.map((d) => byId.get(d.id) ?? { ...d });
  for (const b of byId.values()) if (b.kind === 'own' && out.length < MAX_BAGS) out.push(b);
  return out;
}

/** True for a bag that travels with you in the cabin (carry-on, personal item, own cabin bags). */
export const isCabin = (bag: Pick<Bag, 'kind' | 'hold'>) => bag.kind === 'carry' || bag.kind === 'personal' || (bag.kind === 'own' && bag.hold !== true);

export const isCarryOnOnly = (list: Pick<PackList, 'carryOnOnly'> | null | undefined) => list?.carryOnOnly === true;

/** Bags offered on the screen: with Carry-on only switched on, the hold bags are hidden. */
export const visibleBags = (list: PackList): Bag[] => bagsOf(list).filter((b) => !isCarryOnOnly(list) || isCabin(b));

/**
 * The list with its bag data cleaned: bags as bagsOf gives them (written only when the list already had bags), row
 * bag links to unknown bags dropped, weights and moved-from links cleaned. A list with no bag data is returned as is.
 */
export function cleanBagData<L extends PackList | Omit<PackList, 'tripId'>>(list: L): L {
  const hasBags = list.bags !== undefined;
  const hasRows = list.items.some((i) => 'bag' in i || 'weightG' in i || 'movedFrom' in i);
  if (!hasBags && !hasRows && list.carryOnOnly === undefined) return list;
  const bags = bagsOf(list);
  const ids = new Set(bags.map((b) => b.id));
  const items = list.items.map((i) => {
    if (!('bag' in i || 'weightG' in i || 'movedFrom' in i)) return i;
    const { bag, weightG, movedFrom, ...rest } = i;
    const out: PackItem = rest;
    if (typeof bag === 'string' && ids.has(bag)) out.bag = bag;
    const w = cleanGrams(weightG);
    if (w !== undefined) out.weightG = w;
    if (typeof movedFrom === 'string' && ids.has(movedFrom) && out.bag) out.movedFrom = movedFrom;
    return out;
  });
  const { bags: _b, carryOnOnly: _c, ...rest } = list;
  const next: Omit<PackList, 'tripId'> = { ...rest, items };
  if (hasBags) next.bags = bags;
  if (list.carryOnOnly === true) next.carryOnOnly = true;
  return next as L;
}

/** The row's bag, or null when it has none yet (or its bag is gone). */
export function bagOfItem(list: PackList, item: PackItem): Bag | null {
  if (!item.bag) return null;
  return bagsOf(list).find((b) => b.id === item.bag) ?? null;
}

// ---------------------------------------------------------------- where things usually go

const has = (label: string, words: readonly string[]) => {
  const l = ` ${normaliseLabel(label)} `;
  return words.some((w) => l.includes(` ${w} `) || l.includes(` ${w}s `));
};
const BATTERY_WORDS = ['power bank', 'powerbank', 'battery', 'batteries', 'spare battery', 'battery pack', 'lithium', 'vape', 'e cigarette'];
const MEDICINE_WORDS = ['medication', 'medicine', 'meds', 'prescription', 'pill', 'tablet', 'insulin', 'inhaler', 'epipen'];
const LIQUID_WORDS = [
  'shampoo', 'conditioner', 'toothpaste', 'sunscreen', 'sun cream', 'sun protection', 'sunblock', 'lotion', 'gel', 'liquid', 'perfume',
  'cologne', 'mouthwash', 'sanitiser', 'sanitizer', 'lens solution', 'moisturiser', 'moisturizer', 'cream', 'spray', 'drink',
  'toiletries', 'wash kit', 'body wash', 'shower gel', 'aerosol',
];

export const isBatteryItem = (i: Pick<PackItem, 'label'>) => has(i.label, BATTERY_WORDS);
export const isMedicineItem = (i: Pick<PackItem, 'label'>) => has(i.label, MEDICINE_WORDS);
/** Liquids, gels, creams and sprays (by name; a toiletries row counts, since a wash kit usually holds some). */
export const isLiquidItem = (i: Pick<PackItem, 'label' | 'category'>) => has(i.label, LIQUID_WORDS) || (i.category ?? '') === 'toiletries';

/**
 * Where a row usually goes when sorted into bags: power banks, medicines, tech and health in the carry-on; papers and
 * money in the personal item; everything else in the checked bag (the carry-on with Carry-on only on).
 */
export function suggestBag(list: PackList, item: PackItem): string {
  if (isBatteryItem(item) || isMedicineItem(item)) return CARRY_ID;
  const c = categoryOf(item);
  if (c === 'documents' || c === 'money') return PERSONAL_ID;
  if (c === 'tech' || c === 'health') return CARRY_ID;
  return isCarryOnOnly(list) ? CARRY_ID : CHECKED_ID;
}

// ---------------------------------------------------------------- edits

const withBags = (list: PackList, bags: Bag[]): PackList => ({ ...list, bags });

/**
 * Puts a row in a bag (null takes it out of every bag). A hold bag is refused while Carry-on only is on. Choosing a
 * bag by hand forgets where Carry-on only moved it from.
 */
export function assignBag(list: PackList, itemId: string, bagId: string | null): PackList {
  const l = cleanBagData(list);
  const item = l.items.find((i) => i.id === itemId);
  if (!item) return list;
  const bags = bagsOf(l);
  if (bagId !== null) {
    const bag = bags.find((b) => b.id === bagId);
    if (!bag || (isCarryOnOnly(l) && !isCabin(bag))) return list;
  }
  if ((item.bag ?? null) === bagId && !item.movedFrom) return list;
  const items = l.items.map((i) => {
    if (i.id !== itemId) return i;
    const { bag: _b, movedFrom: _m, ...rest } = i;
    return bagId === null ? rest : { ...rest, bag: bagId };
  });
  return withBags({ ...l, items }, bags);
}

/** Moves several rows into one bag (the hint's "Move to carry-on"). */
export function moveItems(list: PackList, itemIds: readonly string[], bagId: string): PackList {
  return itemIds.reduce((l, id) => assignBag(l, id, bagId), list);
}

export type SortResult = { list: PackList; sorted: number };

/** Puts every row that has no bag yet where it usually goes (suggestBag). Rows already in a bag are never moved. */
export function sortIntoBags(list: PackList): SortResult {
  const l = cleanBagData(list);
  let sorted = 0;
  const items = l.items.map((i) => {
    if (i.bag) return i;
    sorted++;
    return { ...i, bag: suggestBag(l, i) };
  });
  if (!sorted) return { list, sorted: 0 };
  return { list: withBags({ ...l, items }, bagsOf(l)), sorted };
}

/**
 * Carry-on only. On: every row in a hold bag moves to the carry-on and remembers its bag. Off: rows still in the
 * carry-on go back to the bag they came from (rows moved by hand since then stay where they are).
 */
export function setCarryOnOnly(list: PackList, on: boolean): PackList {
  const l = cleanBagData(list);
  if (isCarryOnOnly(l) === on) return list;
  const bags = bagsOf(l);
  const hold = new Set(bags.filter((b) => !isCabin(b)).map((b) => b.id));
  const items = l.items.map((i) => {
    if (on) return i.bag && hold.has(i.bag) ? { ...i, bag: CARRY_ID, movedFrom: i.bag } : i;
    if (!i.movedFrom) return i;
    const { movedFrom, ...rest } = i;
    return rest.bag === CARRY_ID ? { ...rest, bag: movedFrom } : rest;
  });
  const { carryOnOnly: _c, ...rest } = l;
  return withBags({ ...rest, items, ...(on ? { carryOnOnly: true } : {}) }, bags);
}

export type BagDraft = { name: string; colour: CardColour; hold: boolean };
export type BagResult = { list: PackList; error?: 'empty' | 'duplicate' | 'full' };

const nameTaken = (bags: Bag[], name: string, exceptId?: string) =>
  bags.some((b) => b.id !== exceptId && b.kind === 'own' && normaliseLabel(b.name ?? '') === normaliseLabel(name));

/** Adds an own bag. Empty names, a name another own bag has, or a 13th bag leave the list unchanged with a reason. */
export function addBag(list: PackList, draft: BagDraft, id: string): BagResult {
  const l = cleanBagData(list);
  const bags = bagsOf(l);
  const name = cleanName(draft.name);
  if (!normaliseLabel(name)) return { list, error: 'empty' };
  if (nameTaken(bags, name)) return { list, error: 'duplicate' };
  if (bags.length >= MAX_BAGS || bags.some((b) => b.id === id)) return { list, error: 'full' };
  const colour = (CARD_COLOURS as readonly string[]).includes(draft.colour) ? draft.colour : OWN_BAG_COLOUR;
  const bag: Bag = { id, kind: 'own', name, colour, ...(draft.hold ? { hold: true } : {}) };
  return { list: withBags(l, [...bags, bag]) };
}

export type BagPatch = { name?: string; colour?: CardColour; hold?: boolean; limitG?: number | null };

/**
 * Changes a bag. Built-in bags take a colour and a limit only. An own bag switched to the hold while Carry-on only is
 * on has its rows moved to the carry-on (remembering the bag) like the switch does.
 */
export function editBag(list: PackList, id: string, patch: BagPatch): BagResult {
  const l = cleanBagData(list);
  const bags = bagsOf(l);
  const bag = bags.find((b) => b.id === id);
  if (!bag) return { list };
  const next: Bag = { ...bag };
  if (patch.name !== undefined && bag.kind === 'own') {
    const name = cleanName(patch.name);
    if (!normaliseLabel(name)) return { list, error: 'empty' };
    if (nameTaken(bags, name, id)) return { list, error: 'duplicate' };
    next.name = name;
  }
  if (patch.colour && (CARD_COLOURS as readonly string[]).includes(patch.colour)) next.colour = patch.colour;
  if (patch.hold !== undefined && bag.kind === 'own') {
    if (patch.hold) next.hold = true;
    else delete next.hold;
  }
  if (patch.limitG !== undefined) {
    const g = patch.limitG === null ? undefined : cleanGrams(patch.limitG);
    if (g === undefined) delete next.limitG;
    else next.limitG = g;
  }
  let items = l.items;
  if (isCarryOnOnly(l) && isCabin(bag) && !isCabin(next)) {
    items = items.map((i) => (i.bag === id ? { ...i, bag: CARRY_ID, movedFrom: id } : i));
  }
  return { list: withBags({ ...l, items }, bags.map((b) => (b.id === id ? next : b))) };
}

/** Removes an own bag; its rows lose their bag (nothing is deleted). Built-in bags can't be removed. */
export function removeBag(list: PackList, id: string): PackList {
  const l = cleanBagData(list);
  const bags = bagsOf(l);
  const bag = bags.find((b) => b.id === id);
  if (!bag || bag.kind !== 'own') return list;
  const items = l.items.map((i) => {
    if (i.bag !== id && i.movedFrom !== id) return i;
    const { bag: b, movedFrom: _m, ...rest } = i;
    return b === id ? rest : { ...rest, ...(b ? { bag: b } : {}) };
  });
  return withBags({ ...l, items }, bags.filter((b) => b.id !== id));
}

/** Sets (grams) or clears (null) the weight of one of a row's things. */
export function setItemWeight(list: PackList, itemId: string, grams: number | null): PackList {
  const item = list.items.find((i) => i.id === itemId);
  if (!item) return list;
  const g = grams === null ? undefined : cleanGrams(grams);
  if (item.weightG === g) return list;
  return {
    ...list,
    items: list.items.map((i) => {
      if (i.id !== itemId) return i;
      const { weightG: _w, ...rest } = i;
      return g === undefined ? rest : { ...rest, weightG: g };
    }),
  };
}

// ---------------------------------------------------------------- reading

/** A filter on the packing screen: everything, rows with no bag, or one bag. */
export type BagFilter = 'all' | 'none' | string;
export const NO_BAG: BagFilter = 'none';

export function filterItems(list: PackList, filter: BagFilter): PackItem[] {
  if (filter === 'all') return list.items;
  const ids = new Set(bagsOf(list).map((b) => b.id));
  if (filter === NO_BAG) return list.items.filter((i) => !i.bag || !ids.has(i.bag));
  return list.items.filter((i) => i.bag === filter);
}

/** A filter that still makes sense for the list (a removed bag or a hidden hold bag falls back to everything). */
export function validFilter(list: PackList, filter: BagFilter): BagFilter {
  if (filter === 'all' || filter === NO_BAG) return filter;
  return visibleBags(list).some((b) => b.id === filter) ? filter : 'all';
}

export type Tally = {
  /** Rows in the bag. */
  rows: number;
  /** Rows ticked as packed. */
  done: number;
  /** Things in the bag (each row's quantity, 1 when it has none). */
  things: number;
  /** Total weight of the rows that have one (each row's weight times its quantity), grams. */
  weightG: number;
  /** Rows with a weight / without one (the tally says when some are missing). */
  weighed: number;
  unweighed: number;
  limitG?: number;
  /** Grams over the limit (0 when under or no limit). */
  overG: number;
  /** Grams still free under the limit (0 when over or no limit). */
  leftG: number;
};

/** Row quantity: the screen passes smartpack's itemQty; absent or 0 counts as 1. */
export type QtyOf = (i: PackItem) => number | undefined;
const one: QtyOf = () => 1;

export function tallyItems(items: readonly PackItem[], qtyOf: QtyOf = one, limitG?: number): Tally {
  let done = 0;
  let things = 0;
  let weightG = 0;
  let weighed = 0;
  for (const i of items) {
    const q = Math.max(1, Math.floor(qtyOf(i) ?? 1));
    things += q;
    if (i.done) done++;
    const w = cleanGrams(i.weightG);
    if (w !== undefined) {
      weightG += w * q;
      weighed++;
    }
  }
  const limit = cleanGrams(limitG);
  const t: Tally = { rows: items.length, done, things, weightG, weighed, unweighed: items.length - weighed, overG: 0, leftG: 0 };
  if (limit !== undefined) {
    t.limitG = limit;
    t.overG = Math.max(0, weightG - limit);
    t.leftG = Math.max(0, limit - weightG);
  }
  return t;
}

export const bagTally = (list: PackList, bag: Bag, qtyOf?: QtyOf): Tally => tallyItems(filterItems(list, bag.id), qtyOf, bag.limitG);

export type BagSummary = { bag: Bag; tally: Tally };

/** One summary per visible bag, then the rows with no bag (`none`, absent when every row has a bag). */
export function bagSummaries(list: PackList, qtyOf?: QtyOf): { bags: BagSummary[]; none: Tally | null; all: Tally } {
  const bags = visibleBags(list).map((bag) => ({ bag, tally: bagTally(list, bag, qtyOf) }));
  const loose = filterItems(list, NO_BAG);
  return { bags, none: loose.length ? tallyItems(loose, qtyOf) : null, all: tallyItems(list.items, qtyOf) };
}

// ---------------------------------------------------------------- weights in kg / lb

export type WeightUnit = 'kg' | 'lb';
export const GRAMS_PER_LB = 453.59237;
/** Weights follow the home units (src/core/units.ts defaultSystem): pounds for an imperial home, else kilograms. */
export const weightUnit = (system: UnitSystem): WeightUnit => (system === 'imperial' ? 'lb' : 'kg');

export const gramsToUnit = (g: number, unit: WeightUnit) => (unit === 'lb' ? g / GRAMS_PER_LB : g / 1000);
export const unitToGrams = (v: number, unit: WeightUnit) => Math.round(unit === 'lb' ? v * GRAMS_PER_LB : v * 1000);

/** A weight as a number in the language's format: 2 decimals under 10, 1 decimal above ("0.35", "12.4", "1,5"). */
export function formatWeight(g: number, unit: WeightUnit, lang = 'en'): string {
  const v = gramsToUnit(g, unit);
  const digits = Math.abs(v) < 10 ? 2 : 1;
  try {
    return new Intl.NumberFormat(lang, { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(roundTo(v, digits));
  } catch {
    return String(roundTo(v, digits));
  }
}

/**
 * Typed weight text in `unit` as grams: undefined for empty text (clears the weight), null for text that isn't a
 * weight (negative, zero, over MAX_GRAMS or not a number). Accepts the language's decimal mark.
 */
export function parseWeight(text: string, unit: WeightUnit, lang = 'en'): number | null | undefined {
  if (!text.trim()) return undefined;
  const n = parseNumber(text, decimalMark(lang));
  if (n === null || n <= 0) return null;
  const g = unitToGrams(n, unit);
  return cleanGrams(g) ?? null;
}

/** A weight as text to put back in the field (no grouping, the language's decimal mark). */
export function weightInput(g: number | undefined, unit: WeightUnit, lang = 'en'): string {
  if (g === undefined) return '';
  const v = roundTo(gramsToUnit(g, unit), 2);
  const s = String(v);
  return decimalMark(lang) === ',' ? s.replace('.', ',') : s;
}

// ---------------------------------------------------------------- hints (general guidance)

export type HintKind = 'battery' | 'medicine' | 'liquids' | 'overLimit';
export type BagHint = { kind: HintKind; /** Rows the hint is about. */ itemIds: string[]; /** For overLimit: the bag. */ bagId?: string; overG?: number };

/**
 * Gentle general-guidance hints (the screen adds "verify with your airline"):
 * - battery: spare batteries and power banks in a hold bag (usually cabin only);
 * - medicine: medicines in a hold bag (keep them with you);
 * - liquids: liquids, gels and creams in a cabin bag (usually small containers in one clear bag);
 * - overLimit: a bag whose weighed rows go over the limit the traveller typed.
 */
export function bagHints(list: PackList, qtyOf?: QtyOf): BagHint[] {
  const l = cleanBagData(list);
  const bags = bagsOf(l);
  const byId = new Map(bags.map((b) => [b.id, b]));
  const inHold = (i: PackItem) => {
    const b = i.bag ? byId.get(i.bag) : undefined;
    return !!b && !isCabin(b);
  };
  const inCabin = (i: PackItem) => {
    const b = i.bag ? byId.get(i.bag) : undefined;
    return !!b && isCabin(b);
  };
  const hints: BagHint[] = [];
  const battery = l.items.filter((i) => isBatteryItem(i) && inHold(i)).map((i) => i.id);
  if (battery.length) hints.push({ kind: 'battery', itemIds: battery });
  const meds = l.items.filter((i) => isMedicineItem(i) && inHold(i)).map((i) => i.id);
  if (meds.length) hints.push({ kind: 'medicine', itemIds: meds });
  const liquids = l.items.filter((i) => isLiquidItem(i) && inCabin(i)).map((i) => i.id);
  if (liquids.length) hints.push({ kind: 'liquids', itemIds: liquids });
  for (const bag of visibleBags(l)) {
    const t = bagTally(l, bag, qtyOf);
    if (t.overG > 0) hints.push({ kind: 'overLimit', itemIds: filterItems(l, bag.id).map((i) => i.id), bagId: bag.id, overG: t.overG });
  }
  return hints;
}
