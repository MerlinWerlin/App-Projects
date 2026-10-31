// T75 smart packing: trip nights counted in the bookings' own zones, clothes quantities with a "laundry on the trip"
// cap, opt-in suggestions (forecast, else daylight / latitude-season only where that is reliable, plus a plug
// adapter from the country essentials table), and the list as plain text for the share sheet.
// Rules the screen relies on:
//   - suggestions are never added on their own: the traveller taps Add (acceptSuggestion) or dismisses them;
//   - a suggestion already on the list (same suggestion, same label, or an item that clearly covers it, such as
//     "Sun protection" for sunscreen or a generic "Plug adapter") is never offered again, so re-running is safe;
//   - dismissed suggestion ids are stored on the list and stay dismissed;
//   - nothing here edits a traveller's labels or ticks.
// Pure TypeScript: wording comes from the screen (labels, share-text words); temperatures are degrees Celsius.
import type { Item, LocalDate, Stamp, Trip } from './model.ts';
import { countryForZone } from './emergency.ts';
import { adapterHint, findEssentials, type EssentialsTable } from './essentials.ts';
import { groupByCategory, normaliseLabel, progress, qtyFor, sortByCategory, type PackItem, type PackList, type QtyRule, type Template } from './packing.ts';
import { sunDay } from './sun.ts';
import { addDays, daysBetween } from './tz.ts';
import { STALE_AFTER_MS, type WeatherDay } from './weather.ts';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const isDate = (s: unknown): s is LocalDate => typeof s === 'string' && DATE.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
const stampDate = (s: Stamp | undefined): LocalDate | null => {
  const d = typeof s?.local === 'string' ? s.local.slice(0, 10) : '';
  return isDate(d) ? d : null;
};

// ---------------------------------------------------------------- nights

/** A booking may reach this many days outside the trip's dates and still count (the overnight flight home). */
export const NIGHTS_SLACK_DAYS = 1;

/**
 * Nights away, from the dates printed on the bookings, each read in its own zone (a Tokyo check-out is a Tokyo
 * date, the flight home lands on a Sydney date), widened from the trip's own start / end dates. Only dates, never
 * elapsed hours, so a daylight-saving change mid-trip and the phone's own zone change nothing. A booking more than
 * a day outside the trip's dates (a typo, an old booking) is ignored. 0 for a day trip; never negative.
 */
export function tripNightsInZones(trip: Pick<Trip, 'startDate' | 'endDate' | 'items'>): number {
  const valid = isDate(trip.startDate) && isDate(trip.endDate);
  let first: LocalDate | null = valid ? trip.startDate : null;
  let last: LocalDate | null = valid ? trip.endDate : null;
  const lo = valid ? addDays(trip.startDate, -NIGHTS_SLACK_DAYS) : null;
  const hi = valid ? addDays(trip.endDate, NIGHTS_SLACK_DAYS) : null;
  for (const it of trip.items ?? []) {
    for (const d of [stampDate(it.start), stampDate(it.end)]) {
      if (!d) continue;
      if (lo && hi && (d < lo || d > hi)) continue;
      if (!first || d < first) first = d;
      if (!last || d > last) last = d;
    }
  }
  if (!first || !last) return 0;
  return Math.max(0, daysBetween(first, last));
}

// ---------------------------------------------------------------- quantities

/** With laundry on the trip, clothes are packed for this many nights at most (wash every few days). */
export const LAUNDRY_EVERY_NIGHTS = 4;

/** A clothes quantity for the trip: the template rule over the nights, capped as if the trip were 4 nights with laundry. */
export function clothesQty(rule: QtyRule | null | undefined, nights: number, laundry: boolean): number | undefined {
  const n = Math.max(0, Math.floor(Number.isFinite(nights) ? nights : 0));
  return qtyFor(rule, laundry ? Math.min(n, LAUNDRY_EVERY_NIGHTS) : n);
}

export type RuleIndex = Map<string, { rule: QtyRule; category: string }>;

/** Template item id -> its quantity rule (items without a rule are left out). */
export function ruleIndex(templates: Template[]): RuleIndex {
  const out: RuleIndex = new Map();
  for (const t of templates) for (const i of t.items) if (i.qty_rule && !out.has(i.id)) out.set(i.id, { rule: i.qty_rule, category: i.category });
  return out;
}

export type QtyContext = { nights: number; laundry: boolean; rules: RuleIndex };

/**
 * The quantity a row shows. Template rows are worked out again from the trip's nights (so a longer trip or the
 * laundry switch updates them); laundry only caps clothes. Rows without a rule show their stored quantity, if any.
 */
export function itemQty(item: PackItem, ctx: QtyContext): number | undefined {
  const r = item.templateItemId ? ctx.rules.get(item.templateItemId) : undefined;
  if (!r) return typeof item.qty === 'number' && item.qty >= 1 ? Math.floor(item.qty) : undefined;
  const clothes = (item.category ?? r.category) === 'clothes';
  return clothesQty(r.rule, ctx.nights, ctx.laundry && clothes);
}

export const isLaundry = (list: PackList | null | undefined) => list?.laundry === true;
export const setLaundry = (list: PackList, on: boolean): PackList => (isLaundry(list) === on ? list : { ...list, laundry: on });

// ---------------------------------------------------------------- suggestions

export const SUGGESTION_KINDS = ['umbrella', 'rain_jacket', 'warm_layer', 'gloves_hat', 'sun_hat', 'sunscreen', 'eye_mask', 'plug_adapter'] as const;
export type SuggestionKind = (typeof SUGGESTION_KINDS)[number];

export type SuggestionReason =
  | { kind: 'forecast_rain'; days: number }
  | { kind: 'forecast_cold'; lowC: number }
  | { kind: 'forecast_hot'; highC: number }
  | { kind: 'season_cold' }
  | { kind: 'season_tropics' }
  | { kind: 'daylight_long' }
  | { kind: 'plugs'; countries: string[]; plugs: string[]; some: boolean; voltageDiffers: boolean };

export type Suggestion = {
  /** Stable across runs ("umbrella", "plug_adapter:G"): what dismissals and added rows remember. */
  id: string;
  kind: SuggestionKind;
  /** Category the row joins when added. */
  category: string;
  /** Plug letters for a plug adapter ("G"; "A", "B"). */
  plugs?: string[];
  reason: SuggestionReason;
};

const CATEGORY: Record<SuggestionKind, string> = {
  umbrella: 'misc',
  rain_jacket: 'clothes',
  warm_layer: 'clothes',
  gloves_hat: 'clothes',
  sun_hat: 'clothes',
  sunscreen: 'health',
  eye_mask: 'misc',
  plug_adapter: 'tech',
};

/** Thresholds (degrees Celsius, mm). A day is wet with rain-type weather or at least 1 mm forecast. */
export const RAIN_MM = 1;
export const COLD_LOW_C = 8;
export const FREEZING_LOW_C = 0;
export const HOT_HIGH_C = 27;
/** Latitude-season rules are used only where they are reliable: winter at 50 degrees or more, and the tropics. */
export const WINTER_LAT = 50;
export const TROPIC_LAT = 23.44;
/** Daylight of 18 hours or more (or white nights / midnight sun) makes an eye mask worth suggesting. */
export const LONG_DAY_MIN = 18 * 60;
/** Longest trip the daylight / season rules look at, in days. */
const MAX_DAYS = 62;

const WET = new Set(['rain', 'sleet', 'thunder']);

export type SmartInput = {
  trip: Pick<Trip, 'startDate' | 'endDate' | 'items' | 'homeTz'>;
  now: number;
  /** The cached forecast's daily summary for `place` (in the place's zone) and when it was issued; null if none is cached. */
  forecast?: { days: readonly WeatherDay[]; asOf: number } | null;
  /** Where the forecast and daylight are for (the trip's current or next destination). */
  place?: { lat: number; lon: number; tz: string } | null;
  /** Country essentials table and the home country (ISO 3166-1 alpha-2), for the plug adapter. */
  essentials?: { table: EssentialsTable; home: string | null } | null;
};

/** The trip's dates, first to last (at most MAX_DAYS); empty when the dates are unreadable. */
function tripDates(trip: Pick<Trip, 'startDate' | 'endDate'>): LocalDate[] {
  if (!isDate(trip.startDate) || !isDate(trip.endDate) || trip.endDate < trip.startDate) return [];
  const out: LocalDate[] = [];
  for (let d = trip.startDate; d <= trip.endDate && out.length < MAX_DAYS; d = addDays(d, 1)) out.push(d);
  return out;
}

const make = (kind: SuggestionKind, reason: SuggestionReason, extra: Partial<Suggestion> = {}): Suggestion => ({ id: kind, kind, category: CATEGORY[kind], reason, ...extra });

/** Forecast days that fall on the trip's dates, or [] when no forecast is cached or it is over 48 hours old. */
export function forecastTripDays(input: Pick<SmartInput, 'trip' | 'now' | 'forecast'>): WeatherDay[] {
  const f = input.forecast;
  if (!f || !Array.isArray(f.days) || !Number.isFinite(f.asOf) || input.now - f.asOf > STALE_AFTER_MS) return [];
  const dates = new Set(tripDates(input.trip));
  return f.days.filter((d) => dates.has(d.date) && Number.isFinite(d.high) && Number.isFinite(d.low));
}

function weatherSuggestions(input: SmartInput): Suggestion[] {
  const days = forecastTripDays(input);
  const out: Suggestion[] = [];
  if (days.length) {
    const wet = days.filter((d) => (d.group !== null && WET.has(d.group)) || d.precipMm >= RAIN_MM).length;
    if (wet) {
      out.push(make('umbrella', { kind: 'forecast_rain', days: wet }));
      out.push(make('rain_jacket', { kind: 'forecast_rain', days: wet }));
    }
    const low = Math.min(...days.map((d) => d.low));
    const high = Math.max(...days.map((d) => d.high));
    if (low <= COLD_LOW_C) out.push(make('warm_layer', { kind: 'forecast_cold', lowC: low }));
    if (low <= FREEZING_LOW_C) out.push(make('gloves_hat', { kind: 'forecast_cold', lowC: low }));
    if (high >= HOT_HIGH_C) {
      out.push(make('sun_hat', { kind: 'forecast_hot', highC: high }));
      out.push(make('sunscreen', { kind: 'forecast_hot', highC: high }));
    }
    return out;
  }
  // No forecast for the trip's dates: latitude and season, only where they are reliable. Mid-latitudes say nothing.
  const p = input.place;
  const dates = tripDates(input.trip);
  if (!p || !Number.isFinite(p.lat) || Math.abs(p.lat) > 90 || !dates.length) return out;
  const winter = p.lat >= 0 ? [12, 1, 2] : [6, 7, 8];
  if (Math.abs(p.lat) >= WINTER_LAT && dates.some((d) => winter.includes(Number(d.slice(5, 7))))) {
    out.push(make('warm_layer', { kind: 'season_cold' }));
    out.push(make('gloves_hat', { kind: 'season_cold' }));
  } else if (Math.abs(p.lat) < TROPIC_LAT) {
    out.push(make('sun_hat', { kind: 'season_tropics' }));
    out.push(make('sunscreen', { kind: 'season_tropics' }));
  }
  return out;
}

/** Astronomy works offline and is exact enough: very long days or white nights on the trip suggest an eye mask. */
function daylightSuggestions(input: SmartInput): Suggestion[] {
  const p = input.place;
  if (!p) return [];
  for (const d of tripDates(input.trip)) {
    const s = sunDay(p.lat, p.lon, d, p.tz);
    if (!s) return [];
    if (s.polar === 'day' || s.twilightAllNight || s.daylightMin >= LONG_DAY_MIN) return [make('eye_mask', { kind: 'daylight_long' })];
  }
  return [];
}

const zonesOf = (i: Item): string[] => [i.start?.tz, i.end?.tz].filter((z): z is string => typeof z === 'string' && !!z);

/** The home country: the one saved in Settings, else the country of the trip's home zone. Null when neither maps. */
export function homeCountryFor(table: EssentialsTable, stored: unknown, trip: Pick<Trip, 'homeTz'>): string | null {
  if (typeof stored === 'string') {
    const row = findEssentials(table, stored);
    if (row) return row.iso2;
  }
  return findEssentials(table, countryForZone(trip.homeTz))?.iso2 ?? null;
}

/**
 * One plug adapter suggestion per distinct set of destination plug types the home plugs don't (all) fit:
 * "Plug adapter: type G" for the UK and Ireland together. Countries come from the bookings' zones in trip order.
 * Nothing when the home country or a destination's plugs are unknown (never a guess).
 */
function plugSuggestions(input: SmartInput): Suggestion[] {
  const e = input.essentials;
  if (!e?.home) return [];
  const home = findEssentials(e.table, e.home);
  if (!home) return [];
  const countries: string[] = [];
  for (const it of input.trip.items ?? []) {
    for (const z of zonesOf(it)) {
      const c = countryForZone(z);
      if (c && c !== home.iso2 && !countries.includes(c)) countries.push(c);
    }
  }
  const byPlugs = new Map<string, Suggestion>();
  for (const iso of countries) {
    const dest = findEssentials(e.table, iso);
    if (!dest) continue;
    const hint = adapterHint(dest, home);
    if (hint.verdict !== 'adapter' && hint.verdict !== 'some') continue;
    const plugs = [...new Set(dest.plugs ?? [])].sort();
    if (!plugs.length) continue;
    const key = plugs.join('');
    const prev = byPlugs.get(key);
    if (prev && prev.reason.kind === 'plugs') {
      prev.reason.countries.push(dest.country);
      prev.reason.some = prev.reason.some && hint.verdict === 'some';
      prev.reason.voltageDiffers = prev.reason.voltageDiffers || hint.voltageDiffers;
      continue;
    }
    byPlugs.set(key, {
      id: `plug_adapter:${key}`,
      kind: 'plug_adapter',
      category: CATEGORY.plug_adapter,
      plugs,
      reason: { kind: 'plugs', countries: [dest.country], plugs, some: hint.verdict === 'some', voltageDiffers: hint.voltageDiffers },
    });
  }
  return [...byPlugs.values()];
}

/** Every suggestion the trip's data supports, before the list is consulted. Missing data simply gives fewer. */
export function smartSuggestions(input: SmartInput): Suggestion[] {
  const all = [...weatherSuggestions(input), ...daylightSuggestions(input), ...plugSuggestions(input)];
  const seen = new Set<string>();
  return all.filter((s) => (seen.has(s.id) ? false : (seen.add(s.id), true)));
}

/** Phrases (normalised) that mean a row already covers a suggestion, whatever the traveller called it. */
export const COVERS: Record<Exclude<SuggestionKind, 'plug_adapter'>, readonly string[]> = {
  umbrella: ['umbrella', 'brolly'],
  rain_jacket: ['rain jacket', 'raincoat', 'rain coat', 'poncho', 'rain shell', 'waterproof jacket', 'waterproof coat', 'weatherproof coat', 'waterproof insulated jacket', 'waterproof layer'],
  warm_layer: ['warm layer', 'warm travel layer', 'warm mid layer', 'extra layer', 'fleece', 'jumper', 'sweater', 'hoodie', 'thermal', 'down jacket', 'insulated jacket'],
  gloves_hat: ['gloves', 'warm hat', 'beanie', 'neck warmer'],
  sun_hat: ['sun hat', 'cap'],
  sunscreen: ['sunscreen', 'sun cream', 'suncream', 'sunblock', 'sun protection'],
  eye_mask: ['eye mask', 'sleep mask'],
};

const hasPhrase = (label: string, phrase: string) => ` ${label} `.includes(` ${phrase} `);

/** Plug letters named on an adapter row ("plug adapter types a b" -> A, B); null for a generic adapter. */
function adapterLetters(norm: string): string[] | null {
  const words = norm.split(' ');
  const at = words.findIndex((w) => w === 'type' || w === 'types');
  if (at < 0) return null;
  const out: string[] = [];
  for (const w of words.slice(at + 1)) {
    if (w === 'and' || w === 'or') continue;
    if (/^[a-n]$/.test(w)) out.push(w.toUpperCase());
    else if (/^[a-n]+$/.test(w) && w.length <= 4 && out.length === 0) out.push(...w.toUpperCase().split(''));
    else break;
  }
  return out;
}

/** Whether the list already has this suggestion: added from it, the same label, or a row that clearly covers it. */
export function isCovered(list: PackList, s: Suggestion, label: string): boolean {
  const want = normaliseLabel(label);
  for (const i of list.items) {
    if (i.suggestionId === s.id) return true;
    const n = normaliseLabel(i.label);
    if (want && n === want) return true;
    if (s.kind === 'plug_adapter') {
      if (!/\b(adapter|adaptor)s?\b/.test(n)) continue;
      const letters = adapterLetters(n);
      if (letters === null || letters.length === 0) return true;
      if ((s.plugs ?? []).every((p) => letters.includes(p))) return true;
    } else if (COVERS[s.kind].some((ph) => hasPhrase(n, ph))) {
      return true;
    }
  }
  return false;
}

/** Dismissed suggestion ids stored on the list (junk from older builds reads as none). */
export const dismissedOf = (list: PackList | null | undefined): string[] =>
  Array.isArray(list?.dismissed) ? list.dismissed.filter((x): x is string => typeof x === 'string' && !!x) : [];

/** Suggestions still worth offering: not dismissed and not already on the list. `labelOf` gives the row's label. */
export function openSuggestions(list: PackList, all: readonly Suggestion[], labelOf: (s: Suggestion) => string): Suggestion[] {
  const dismissed = new Set(dismissedOf(list));
  return all.filter((s) => !dismissed.has(s.id) && !isCovered(list, s, labelOf(s)));
}

export type AcceptResult = { list: PackList; added: boolean };

/** Adds a suggestion as an unpacked row (only when the traveller taps Add). Already covered: the list is unchanged. */
export function acceptSuggestion(list: PackList, s: Suggestion, label: string, id: string): AcceptResult {
  const clean = label.trim().replace(/\s+/g, ' ');
  if (!normaliseLabel(clean) || isCovered(list, s, clean) || list.items.some((i) => i.id === id)) return { list, added: false };
  const item: PackItem = { id, label: clean, done: false, category: s.category, suggestionId: s.id };
  return { list: { ...list, items: sortByCategory([...list.items, item]) }, added: true };
}

/** Remembers a dismissal on the list (it stays dismissed on every later run). */
export function dismissSuggestion(list: PackList, id: string): PackList {
  const d = dismissedOf(list);
  return d.includes(id) ? list : { ...list, dismissed: [...d, id] };
}

/** Brings every dismissed suggestion back. */
export const restoreSuggestions = (list: PackList): PackList => (dismissedOf(list).length ? { ...list, dismissed: [] } : list);

// ---------------------------------------------------------------- share as text

export type PackTextWords = {
  /** "Kyoto trip · Packing list" */
  title: string;
  /** "3 of 20 packed" */
  progress: (done: number, total: number) => string;
  category: (c: string) => string;
  /** "× 5" */
  qty: (n: number) => string;
  /** Extra line under the progress, e.g. "Laundry on the trip" (optional). */
  note?: string;
  /** Body when the list has no items. */
  empty: string;
};

/** The list as plain text: title, progress, then each category with ☑ packed / ☐ to pack rows and quantities. */
export function packingText(list: PackList, words: PackTextWords, qtyOf: (i: PackItem) => number | undefined = (i) => i.qty): string {
  const p = progress(list);
  const head = [words.title.trim(), words.progress(p.done, p.total)];
  if (words.note) head.push(words.note);
  const blocks = [head.join('\n')];
  for (const g of groupByCategory(list)) {
    const lines = [words.category(g.category)];
    for (const i of g.items) {
      const q = qtyOf(i);
      lines.push(`${i.done ? '☑' : '☐'} ${i.label.replace(/\s+/g, ' ').trim()}${q ? ` ${words.qty(q)}` : ''}`);
    }
    blocks.push(lines.join('\n'));
  }
  if (!list.items.length) blocks.push(words.empty);
  return `${blocks.join('\n\n')}\n`;
}
