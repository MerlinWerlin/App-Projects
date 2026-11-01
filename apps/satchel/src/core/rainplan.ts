// T140 rainy-day plan B (owner-1031 D, deepen Trips + Places to go). From forecasts already cached on the phone
// (src/native/weather.ts; nothing is fetched for this), each outdoor plan of a trip day is checked for rain, thunder,
// snow or sleet in its own hours:
//  - activity bookings marked outdoor (Item.setting) or guessed outdoor from their name: their start..end on the
//    booking's own clock (no end: DEFAULT_ACTIVITY_MIN); a plan that fills the whole day (00:00 start with no end, or a
//    multi-day activity's middle days) is checked over the daytime hours DAYTIME_FROM..DAYTIME_TO;
//  - Plan my day stops: ideas planned for the day and saved places added to the day (src/core/dayplan.ts), marked or
//    guessed outdoor; they have no time, so they are checked over the daytime hours, in the zone of the stop the
//    traveller is at that day.
// A flagged plan gets a Plan B: indoor saved ideas in the same city (within CITY_M of the plan), and the driest day of
// the forecast window in that same city, for the same wall-clock hours (DST-safe: the wall clock is moved, never the UTC
// instant). Moving a booking keeps its own zone and local times; every change returns an undo. A forecast older than
// 48 h (weather.ts freshness 'stale') still flags, with its age, so the UI can say it may have changed.
// T142: a flag can be dismissed on this phone (RAIN_DISMISSED_KEY, per trip, never in the trip or its file); saved
// places carry their own mark (SavedPlace.setting); indoor ideas with no map spot are offered by the plan's city name
// (planCity / ideaNamesCity, folded) after the ones within CITY_M.
// Pure TS, no React Native imports.
import { zoneFromCity } from './airports.ts';
import { countryForZone } from './emergency.ts';
import { ideaSpot, ideasOn, planIdea, readIdeas, upsertIdea, type Idea } from './ideas.ts';
import { addPlaceToDay, dayPlanRow, readDayPlans, removePlaceFromDay, type DayPlanRow } from './dayplan.ts';
import type { Item, LocalDate, LocalDateTime, Stamp, Trip } from './model.ts';
import { stopForDate } from './outfits.ts';
import { savedPlaces } from './places.ts';
import { guessSetting, markOf, type PlanMark, type PlanSetting } from './plansetting.ts';
import { haversineMeters, validLatLon, type LatLon } from './poi.ts';
import { shiftStamp } from './tripcopy.ts';
import { addDays, checkWallTime, daysBetween, fromUtc, isLocalDateTime, isValidZone, localDate, localTime, toUtc } from './tz.ts';
import { freshness, symbolGroup, type Forecast, type Freshness, type WeatherGroup } from './weather.ts';

const MIN = 60_000;
const HOUR = 60 * MIN;

/** Weather that spoils an outdoor plan. */
export const WET_GROUPS: readonly WeatherGroup[] = ['rain', 'sleet', 'snow', 'thunder'];
/** Without a symbol, this much precipitation per hour of a period counts as wet (mm). */
export const WET_MM_PER_HOUR = 0.3;
/** An activity booked without an end is taken to last this long. */
export const DEFAULT_ACTIVITY_MIN = 120;
/** Untimed and all-day plans are checked over these local hours (start inclusive, end exclusive). */
export const DAYTIME_FROM = '08:00';
export const DAYTIME_TO = '20:00';
/** A forecast place this close to a plan is used for it (metres). */
export const NEAR_M = 50_000;
/** "Same city" for indoor ideas and for days to move to (metres, straight line). */
export const CITY_M = 30_000;
/** Indoor ideas offered per flagged plan. */
export const MAX_SWAPS = 3;

// ---------------------------------------------------------------------------------------------- marks

export function itemMark(item: Pick<Item, 'title' | 'place' | 'setting'>): PlanMark {
  return markOf(item.setting, guessSetting(item.title, item.place?.name));
}

/** Ideas: own mark, else the name / spot name, else the category (eat and shop read as indoor). */
export function ideaMark(idea: Pick<Idea, 'name' | 'spotName' | 'category' | 'setting'>): PlanMark {
  const g = guessSetting(idea.name, idea.spotName) ?? (idea.category === 'eat' || idea.category === 'shop' ? 'indoor' : null);
  return markOf(idea.setting, g);
}

/** Saved places: the traveller's own mark (T142, SavedPlace.setting), else a guess from the name only. */
export const placeMark = (p: { name: string; setting?: unknown }): PlanMark => markOf(p.setting, guessSetting(p.name));

/** T142: sets (or clears) a saved place's mark. Unknown id: the trip unchanged. */
export function setPlaceSetting(trip: Trip, placeId: string, setting: PlanSetting | null): Trip {
  const list = savedPlaces(trip);
  if (!list.some((p) => p.id === placeId)) return trip;
  return {
    ...trip,
    places: list.map((p) => {
      if (p.id !== placeId) return p;
      const { setting: _s, ...rest } = p;
      return setting ? { ...rest, setting } : rest;
    }),
  };
}

/** Sets (or, with null, clears) an activity booking's mark. Unknown id: the trip unchanged. */
export function setItemSetting(trip: Trip, itemId: string, setting: PlanSetting | null): Trip {
  if (!trip.items.some((i) => i.id === itemId)) return trip;
  return {
    ...trip,
    items: trip.items.map((i) => {
      if (i.id !== itemId) return i;
      const { setting: _s, ...rest } = i;
      return setting ? { ...rest, setting } : rest;
    }),
  };
}

/** Sets (or clears) an idea's mark. */
export function setIdeaSetting(trip: Trip, ideaId: string, setting: PlanSetting | null, now = new Date().toISOString()): Trip {
  const prev = readIdeas(trip).find((i) => i.id === ideaId);
  if (!prev) return trip;
  const { setting: _s, ...rest } = prev;
  return upsertIdea(trip, { ...rest, ...(setting ? { setting } : {}), updatedAt: now });
}

// ---------------------------------------------------------------------------------------------- forecasts

/** A forecast already on the phone for one of the trip's stops (weather.ts weatherStops + native cachedForecast). */
export type RainSource = LatLon & {
  key: string;
  name: string;
  tz: string;
  fromDate: LocalDate;
  toDate: LocalDate;
  /** Null when nothing is cached for this stop. */
  forecast: Forecast | null;
  /** From the cache only (always true here: this feature never fetches); kept for freshness(). */
  fromCache?: boolean;
};

/** How old a forecast is, for "Forecast from 3 h ago". */
export type ForecastAge = { unit: 'now' | 'min' | 'h' | 'd'; n: number };
export function forecastAge(asOf: number, now: number): ForecastAge {
  const ms = Math.max(0, now - asOf);
  if (ms < 5 * MIN) return { unit: 'now', n: 0 };
  if (ms < HOUR) return { unit: 'min', n: Math.floor(ms / MIN) };
  if (ms < 48 * HOUR) return { unit: 'h', n: Math.floor(ms / HOUR) };
  return { unit: 'd', n: Math.floor(ms / (24 * HOUR)) };
}

/** One forecast period, used once (the 1-hour steps first, then the 6-hour ones, never counted twice). */
type Period = { from: number; to: number; group: WeatherGroup | null; precip: number | null };

function periods(f: Forecast): Period[] {
  const out: Period[] = [];
  let coveredUntil = -Infinity;
  for (const p of f.points) {
    if (p.hours === null || p.at < coveredUntil) continue;
    const to = p.at + p.hours * HOUR;
    coveredUntil = to;
    out.push({ from: p.at, to, group: symbolGroup(p.symbol), precip: p.precip });
  }
  return out;
}

const SEVERITY: Record<WeatherGroup, number> = { clear: 0, partly: 1, cloudy: 2, fog: 3, rain: 4, sleet: 5, snow: 6, thunder: 7 };

const isWet = (p: Period): boolean => {
  if (p.group) return WET_GROUPS.includes(p.group);
  return p.precip !== null && p.precip >= WET_MM_PER_HOUR * ((p.to - p.from) / HOUR);
};

/** The weather in a window: when wet weather starts in it, the worst kind, wet hours and mm (prorated by overlap). */
export type WindowWeather = {
  /** 'full': the forecast spans the whole window; 'part': only some of it; 'none': none of it. */
  coverage: 'full' | 'part' | 'none';
  /** First wet instant inside the window (clipped to its start), or null when dry. */
  wetFrom: number | null;
  /** Worst wet group in the window (null when dry, or wet from precipitation alone). */
  group: WeatherGroup | null;
  wetHours: number;
  mm: number;
};

export function windowWeather(f: Forecast, from: number, to: number): WindowWeather {
  let wetFrom: number | null = null;
  let group: WeatherGroup | null = null;
  let wetMs = 0;
  let mm = 0;
  let first = Infinity;
  let last = -Infinity;
  for (const p of periods(f)) {
    const a = Math.max(p.from, from);
    const b = Math.min(p.to, to);
    if (b <= a) continue;
    first = Math.min(first, p.from);
    last = Math.max(last, p.to);
    const share = (b - a) / (p.to - p.from);
    if (p.precip !== null) mm += p.precip * share;
    if (!isWet(p)) continue;
    wetMs += b - a;
    if (wetFrom === null || a < wetFrom) wetFrom = a;
    if (p.group && WET_GROUPS.includes(p.group) && (!group || SEVERITY[p.group] > SEVERITY[group])) group = p.group;
  }
  const coverage = first === Infinity ? 'none' : first <= from && last >= to ? 'full' : 'part';
  return { coverage, wetFrom, group, wetHours: Math.round((wetMs / HOUR) * 10) / 10, mm: Math.round(mm * 10) / 10 };
}

// ---------------------------------------------------------------------------------------------- plans of a day

export type RainPlanKind = 'item' | 'idea' | 'place';

export type OutdoorPlan = {
  /** `item:<id>`, `idea:<id>`, `place:<id>`. */
  key: string;
  kind: RainPlanKind;
  id: string;
  name: string;
  day: LocalDate;
  /** The clock the plan is read on (the booking's own zone; the day's stop zone for untimed stops). */
  tz: string;
  /** The hours checked (UTC ms). */
  from: number;
  to: number;
  /** Untimed (a Plan my day stop) or filling the whole day: checked over the daytime hours. */
  allDay: boolean;
  /** A booking's own local start / end on that day (absent for untimed stops). */
  startLocal?: LocalDateTime;
  endLocal?: LocalDateTime;
  at: LatLon | null;
  mark: PlanMark;
};

const utc = (s: Stamp | undefined): number | null => {
  if (!s || typeof s.local !== 'string' || !isLocalDateTime(s.local) || !isValidZone(s.tz)) return null;
  try {
    return toUtc(s);
  } catch {
    return null;
  }
};

/** The daytime window of a local date in a zone (DST-safe through toUtc). */
export function daytime(day: LocalDate, tz: string): { from: number; to: number } {
  return { from: toUtc({ local: `${day}T${DAYTIME_FROM}`, tz }), to: toUtc({ local: `${day}T${DAYTIME_TO}`, tz }) };
}

const placeAt = (p: Item['place']): LatLon | null => (p && validLatLon(p.lat, p.lon) ? { lat: p.lat as number, lon: p.lon as number } : null);

/** An activity's hours on `day` on its own clock, or null when it isn't on that day / can't be read. */
export function itemWindow(item: Item, day: LocalDate): Pick<OutdoorPlan, 'from' | 'to' | 'allDay' | 'startLocal' | 'endLocal'> | null {
  const start = utc(item.start);
  if (start === null) return null;
  const tz = item.start.tz;
  const endRaw = utc(item.end);
  const end = endRaw !== null && endRaw > start ? endRaw : start + DEFAULT_ACTIVITY_MIN * MIN;
  const dayFrom = toUtc({ local: `${day}T00:00`, tz });
  const dayTo = toUtc({ local: `${addDays(day, 1)}T00:00`, tz });
  if (end <= dayFrom || start >= dayTo) return null;
  const midnightNoEnd = localTime(item.start.local) === '00:00' && endRaw === null;
  if (midnightNoEnd || (start <= dayFrom && end >= dayTo)) return { ...daytime(day, tz), allDay: true };
  return { from: Math.max(start, dayFrom), to: Math.min(end, dayTo), allDay: false, startLocal: item.start.local, ...(item.end && endRaw !== null ? { endLocal: item.end.local } : {}) };
}

type StopLike = LatLon & { tz: string; fromDate: LocalDate; toDate: LocalDate };

/** Outdoor plans of `day`: activity bookings, then ideas planned that day, then saved places added to the day. */
export function outdoorPlans(trip: Trip, day: LocalDate, stops: readonly StopLike[]): OutdoorPlan[] {
  const out: OutdoorPlan[] = [];
  for (const it of Array.isArray(trip.items) ? trip.items : []) {
    if (it.kind !== 'activity') continue;
    const mark = itemMark(it);
    if (mark.setting !== 'outdoor') continue;
    const w = itemWindow(it, day);
    if (!w) continue;
    out.push({ key: `item:${it.id}`, kind: 'item', id: it.id, name: it.title, day, tz: it.start.tz, ...w, at: placeAt(it.place), mark });
  }
  const stop = stopForDate(stops, day);
  const tz = stop && isValidZone(stop.tz) ? stop.tz : isValidZone(trip.homeTz) ? trip.homeTz : null;
  if (!tz) return out;
  const w = daytime(day, tz);
  for (const idea of ideasOn(trip, day)) {
    if (idea.done) continue;
    const mark = ideaMark(idea);
    if (mark.setting !== 'outdoor') continue;
    out.push({ key: `idea:${idea.id}`, kind: 'idea', id: idea.id, name: idea.name, day, tz, ...w, allDay: true, at: ideaSpot(idea), mark });
  }
  const added = new Set((dayPlanRow(trip, day)?.places ?? []).map((p) => p.placeId));
  for (const p of savedPlaces(trip)) {
    if (!added.has(p.id)) continue;
    const mark = placeMark(p);
    if (mark.setting !== 'outdoor') continue;
    out.push({ key: `place:${p.id}`, kind: 'place', id: p.id, name: p.name, day, tz, ...w, allDay: true, at: { lat: p.lat, lon: p.lon }, mark });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------- flags

export type IndoorSwap = {
  ideaId: string;
  name: string;
  /** Straight-line metres from the plan; null when unknown (an idea with no map spot). */
  m: number | null;
  guessed: boolean;
  /** T142: found by the city its name / spot name / note names (no map spot), as the city table names it. */
  city?: string;
};
export type MoveTo = { date: LocalDate; dry: boolean; wetHours: number; mm: number; /** The moved start falls in a clock change in its zone. */ clock: 'normal' | 'skipped' | 'repeated' };

export type RainFlag = {
  plan: OutdoorPlan;
  sourceKey: string;
  /** First wet instant in the plan's hours and its time on the plan's own clock ('HH:mm'). */
  wetFrom: number;
  wetLocal: string;
  /** Wet from the start of the plan's hours still ahead (the UI says "Rain during" rather than "Rain from"). */
  fromStart: boolean;
  group: WeatherGroup | null;
  wetHours: number;
  mm: number;
  freshness: Freshness;
  asOf: number;
  age: ForecastAge;
  swaps: IndoorSwap[];
  move: MoveTo | null;
};

/** The cached forecast that speaks for a plan: the nearest within NEAR_M of its spot, else the day's stop. */
export function sourceFor(plan: Pick<OutdoorPlan, 'at' | 'day'>, sources: readonly RainSource[]): RainSource | null {
  const withData = sources.filter((s) => s.forecast);
  if (plan.at) {
    let best: { s: RainSource; m: number } | null = null;
    for (const s of withData) {
      const m = haversineMeters(plan.at, s);
      if (m <= NEAR_M && (!best || m < best.m)) best = { s, m };
    }
    return best?.s ?? null;
  }
  const s = stopForDate(sources, plan.day);
  return s?.forecast ? s : null;
}

/** Where the plan is: its own spot, else the forecast place. */
const planPlace = (plan: OutdoorPlan, src: RainSource): LatLon => plan.at ?? { lat: src.lat, lon: src.lon };

// ---------------------------------------------------------------------------------------------- cities by name (T142)

/** Lower case with accents and marks folded away ("Zürich" -> "zurich"), punctuation as spaces. */
export const foldCity = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}']+/gu, ' ')
    .trim();

/** The first known city (src/core/airports.ts tables, as named there) in the texts, read folded; one in another country than `tz` is skipped. */
function cityIn(texts: readonly (string | undefined)[], tz: string | null): string | null {
  const own = tz ? countryForZone(tz) : undefined;
  for (const text of texts) {
    if (typeof text !== 'string' || !text.trim()) continue;
    const c = zoneFromCity(foldCity(text));
    if (c && (!own || countryForZone(c.tz) === own)) return c.city;
  }
  return null;
}

/**
 * T142: the city an outdoor plan is in, by name: its own address / place name / title (a booking), spot name / name
 * (an idea) or address / name (a saved place), else the stay booked over that day. Null when none names a known city.
 */
export function planCity(trip: Trip, plan: Pick<OutdoorPlan, 'kind' | 'id' | 'day' | 'tz'>): string | null {
  let own: (string | undefined)[] = [];
  if (plan.kind === 'item') {
    const it = trip.items.find((i) => i.id === plan.id);
    if (it) own = [it.place?.address, it.place?.name, it.title];
  } else if (plan.kind === 'idea') {
    const i = readIdeas(trip).find((x) => x.id === plan.id);
    if (i) own = [i.spotName, i.name];
  } else {
    const p = savedPlaces(trip).find((x) => x.id === plan.id);
    if (p) own = [p.address, p.name];
  }
  const mine = cityIn(own, plan.tz);
  if (mine) return mine;
  for (const h of Array.isArray(trip.items) ? trip.items : []) {
    if (h.kind !== 'hotel' || typeof h.start?.local !== 'string' || !isLocalDateTime(h.start.local)) continue;
    const from = localDate(h.start.local);
    const to = h.end && isLocalDateTime(h.end.local) ? localDate(h.end.local) : from;
    if (from > plan.day || plan.day > to) continue;
    const c = cityIn([h.place?.address, h.place?.name, h.title], isValidZone(h.start.tz) ? h.start.tz : plan.tz);
    if (c) return c;
  }
  return null;
}

/** Whether a city name appears as whole words in an idea's spot name, name or note (both folded: case and accents). An idea with no spot keeps no spot name (ideas.ts), so for those it is the name or the note. */
export function ideaNamesCity(i: Pick<Idea, 'spotName' | 'name' | 'note'>, city: string): boolean {
  const c = foldCity(city);
  return !!c && [i.spotName, i.name, i.note].some((t) => typeof t === 'string' && ` ${foldCity(t)} `.includes(` ${c} `));
}

/**
 * Indoor ideas for a flagged plan: unplanned or planned that day, not been yet. First those with a spot within CITY_M
 * of the plan (own marks first, then nearest); then (T142) those with no map spot whose name / note names
 * the plan's city (planCity; folded, accent-insensitive), own marks first, then by name. Up to MAX_SWAPS in all.
 */
export function indoorSwaps(trip: Trip, plan: OutdoorPlan, near: LatLon): IndoorSwap[] {
  const out: (IndoorSwap & { own: number })[] = [];
  const byName: (IndoorSwap & { own: number })[] = [];
  let city: string | null | undefined;
  for (const i of readIdeas(trip)) {
    if (i.done || (plan.kind === 'idea' && i.id === plan.id)) continue;
    if (i.day && i.day !== plan.day) continue;
    const mark = ideaMark(i);
    if (mark.setting !== 'indoor') continue;
    const spot = ideaSpot(i);
    if (!spot) {
      if (city === undefined) city = planCity(trip, plan);
      if (city && ideaNamesCity(i, city)) byName.push({ ideaId: i.id, name: i.name, m: null, guessed: mark.guessed, own: mark.guessed ? 1 : 0, city });
      continue;
    }
    const m = haversineMeters(near, spot);
    if (m > CITY_M) continue;
    out.push({ ideaId: i.id, name: i.name, m: Math.round(m), guessed: mark.guessed, own: mark.guessed ? 1 : 0 });
  }
  const byNameOrder = (a: { name: string }, b: { name: string }) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  return [
    ...out.sort((a, b) => a.own - b.own || (a.m ?? 0) - (b.m ?? 0) || byNameOrder(a, b)),
    ...byName.sort((a, b) => a.own - b.own || byNameOrder(a, b)),
  ]
    .slice(0, MAX_SWAPS)
    .map(({ own: _o, ...s }) => s);
}

/** The plan's window on another date: a booking's same wall-clock hours in its own zone; untimed: that day's daytime. */
export function windowOn(trip: Trip, plan: OutdoorPlan, date: LocalDate): { from: number; to: number; clock: MoveTo['clock'] } | null {
  if (plan.kind !== 'item') return { ...daytime(date, plan.tz), clock: 'normal' };
  const item = trip.items.find((i) => i.id === plan.id);
  if (!item) return null;
  const moved = shiftItem(item, daysBetween(plan.day, date));
  const w = itemWindow(moved, date);
  if (!w) return null;
  const c = isLocalDateTime(moved.start.local) && isValidZone(moved.start.tz) ? checkWallTime(moved.start).kind : 'normal';
  return { from: w.from, to: w.to, clock: c };
}

/**
 * The driest other day of the trip in the forecast window, in the same city, for the plan's hours: the fewest wet
 * hours, then the least rain, then the earliest. Only days the forecast fully covers, still ahead, and inside the trip.
 * Null unless it is drier than the flagged day.
 */
export function driestDay(trip: Trip, plan: OutdoorPlan, src: RainSource, stops: readonly StopLike[], now: number, current: Pick<WindowWeather, 'wetHours' | 'mm'>): MoveTo | null {
  if (!src.forecast) return null;
  const near = planPlace(plan, src);
  const today = localDate(fromUtc(now, plan.tz));
  let best: MoveTo | null = null;
  for (let d = trip.startDate > today ? trip.startDate : today; d <= trip.endDate; d = addDays(d, 1)) {
    if (d === plan.day) continue;
    const there = stopForDate(stops, d);
    if (there && haversineMeters(there, near) > CITY_M) continue;
    const w = windowOn(trip, plan, d);
    if (!w || w.from <= now) continue;
    const ww = windowWeather(src.forecast, w.from, w.to);
    if (ww.coverage !== 'full') continue;
    if (!best || ww.wetHours < best.wetHours || (ww.wetHours === best.wetHours && ww.mm < best.mm)) best = { date: d, dry: ww.wetHours === 0, wetHours: ww.wetHours, mm: ww.mm, clock: w.clock };
  }
  if (!best) return null;
  return best.wetHours < current.wetHours || (best.wetHours === current.wetHours && best.mm < current.mm) ? best : null;
}

/**
 * Every outdoor plan of `day` with wet weather in its hours, by the time the wet weather starts. Plans already over,
 * and plans without a cached forecast for their place and hours, are left out (no forecast: no flag).
 */
export function rainFlags(trip: Trip, day: LocalDate, sources: readonly RainSource[], now: number): RainFlag[] {
  const out: RainFlag[] = [];
  for (const plan of outdoorPlans(trip, day, sources)) {
    if (plan.to <= now) continue;
    const src = sourceFor(plan, sources);
    if (!src?.forecast) continue;
    const from = Math.max(plan.from, now);
    const ww = windowWeather(src.forecast, from, plan.to);
    if (ww.coverage === 'none' || ww.wetFrom === null) continue;
    const near = planPlace(plan, src);
    out.push({
      plan,
      sourceKey: src.key,
      wetFrom: ww.wetFrom,
      wetLocal: localTime(fromUtc(ww.wetFrom, plan.tz)),
      fromStart: ww.wetFrom <= from,
      group: ww.group,
      wetHours: ww.wetHours,
      mm: ww.mm,
      freshness: freshness(src.forecast.asOf, now, src.fromCache !== false),
      asOf: src.forecast.asOf,
      age: forecastAge(src.forecast.asOf, now),
      swaps: indoorSwaps(trip, plan, near),
      move: driestDay(trip, plan, src, sources, now, ww),
    });
  }
  return out.sort((a, b) => a.wetFrom - b.wetFrom || (a.plan.key < b.plan.key ? -1 : 1));
}

/** Flags for each listed day (the trip screen's day cards). */
export function rainByDay(trip: Trip, days: readonly LocalDate[], sources: readonly RainSource[], now: number): Map<LocalDate, RainFlag[]> {
  const out = new Map<LocalDate, RainFlag[]>();
  if (!sources.some((s) => s.forecast)) return out;
  for (const d of days) {
    const f = rainFlags(trip, d, sources, now);
    if (f.length) out.set(d, f);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------- changes + undo

/** A booking moved by whole days on its own wall clock (same local times, same zones). */
export function shiftItem(item: Item, days: number): Item {
  if (!days) return item;
  return { ...item, start: shiftStamp(item.start, days), ...(item.end ? { end: shiftStamp(item.end, days) } : {}) };
}

/** What puts a change back: the booking or idea as it was, or the Plan my day rows of the days touched. */
export type RainUndo =
  | { kind: 'item'; item: Item }
  | { kind: 'idea'; idea: Idea }
  | { kind: 'dayPlans'; days: LocalDate[]; rows: DayPlanRow[] };

export type RainChange = { trip: Trip; undo: RainUndo };

/** Moves the plan to `date`: a booking by whole days on its own clock, an idea to that day, a saved place's day plan. */
export function movePlan(trip: Trip, plan: Pick<OutdoorPlan, 'kind' | 'id' | 'day'>, date: LocalDate, now = new Date().toISOString()): RainChange | null {
  if (date === plan.day) return null;
  if (plan.kind === 'item') {
    const item = trip.items.find((i) => i.id === plan.id);
    if (!item) return null;
    const moved = shiftItem(item, daysBetween(plan.day, date));
    return { trip: { ...trip, items: trip.items.map((i) => (i.id === item.id ? moved : i)) }, undo: { kind: 'item', item } };
  }
  if (plan.kind === 'idea') {
    const idea = readIdeas(trip).find((i) => i.id === plan.id);
    if (!idea) return null;
    return { trip: planIdea(trip, idea.id, date, now), undo: { kind: 'idea', idea } };
  }
  const days = [plan.day, date];
  const rows = readDayPlans(trip).filter((r) => days.includes(r.day));
  const next = addPlaceToDay(removePlaceFromDay(trip, plan.day, plan.id, now), date, plan.id, now);
  return next === trip ? null : { trip: next, undo: { kind: 'dayPlans', days, rows } };
}

/** Plans an indoor idea for the plan's day instead (the outdoor plan stays where it is until moved). */
export function swapToIdea(trip: Trip, ideaId: string, day: LocalDate, now = new Date().toISOString()): RainChange | null {
  const idea = readIdeas(trip).find((i) => i.id === ideaId);
  if (!idea) return null;
  return { trip: planIdea(trip, ideaId, day, now), undo: { kind: 'idea', idea } };
}

/** Puts back what a change replaced (a booking or idea deleted since stays deleted). */
export function applyUndo(trip: Trip, u: RainUndo): Trip {
  if (u.kind === 'item') return trip.items.some((i) => i.id === u.item.id) ? { ...trip, items: trip.items.map((i) => (i.id === u.item.id ? u.item : i)) } : trip;
  if (u.kind === 'idea') return readIdeas(trip).some((i) => i.id === u.idea.id) ? upsertIdea(trip, u.idea) : trip;
  const keep = readDayPlans(trip).filter((r) => !u.days.includes(r.day));
  const list = [...keep, ...u.rows];
  const { dayPlans: _d, ...rest } = trip;
  return list.length ? { ...rest, dayPlans: list } : (rest as Trip);
}

// ---------------------------------------------------------------------------------------------- dismissals (T142, phone only)

/** AsyncStorage key: { [tripId]: rain flag ids dismissed }. Never part of the trip or its .satchel file. */
export const RAIN_DISMISSED_KEY = 'satchel.rain.dismissed.v1';
export type RainDismissals = Record<string, string[]>;
export const NO_RAIN_DISMISSALS: RainDismissals = {};
/** Most ids kept per trip (oldest go first). */
export const MAX_RAIN_DISMISSED = 200;

/** A flag's id for dismissing it: the plan on its day (moving the plan to another day flags it afresh there). */
export const rainFlagId = (f: { plan: Pick<OutdoorPlan, 'key' | 'day'> }): string => `${f.plan.key}@${f.plan.day}`;

/** A trip's dismissed rain flag ids from stored data of any shape (bad entries dropped). */
export function rainDismissedFor(store: unknown, tripId: string): string[] {
  if (!store || typeof store !== 'object' || Array.isArray(store)) return [];
  const list = (store as Record<string, unknown>)[tripId];
  return Array.isArray(list) ? [...new Set(list.filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length <= 300))] : [];
}

const tidyRain = (store: unknown): RainDismissals => {
  const out: RainDismissals = {};
  if (store && typeof store === 'object' && !Array.isArray(store))
    for (const k of Object.keys(store)) {
      const list = rainDismissedFor(store, k);
      if (list.length) out[k] = list;
    }
  return out;
};

export function dismissRain(store: unknown, tripId: string, flagId: string): RainDismissals {
  const out = tidyRain(store);
  out[tripId] = [...rainDismissedFor(out, tripId).filter((x) => x !== flagId), flagId].slice(-MAX_RAIN_DISMISSED);
  return out;
}

/** Shows the dismissed flags of one day again (or of the whole trip without a day). */
export function restoreRain(store: unknown, tripId: string, day?: LocalDate): RainDismissals {
  const out = tidyRain(store);
  const keep = day ? rainDismissedFor(out, tripId).filter((x) => !x.endsWith(`@${day}`)) : [];
  if (keep.length) out[tripId] = keep;
  else delete out[tripId];
  return out;
}

/** Flags split into those shown and how many are dismissed on this phone. */
export function withoutDismissed(flags: readonly RainFlag[], dismissed: readonly string[]): { flags: RainFlag[]; dismissed: number } {
  if (!dismissed.length) return { flags: [...flags], dismissed: 0 };
  const off = new Set(dismissed);
  const shown = flags.filter((f) => !off.has(rainFlagId(f)));
  return { flags: shown, dismissed: flags.length - shown.length };
}

// ---------------------------------------------------------------------------------------------- Your day

/** The Your day row: the first flag of today whose plan isn't over and isn't dismissed (null when none). */
export function briefRain(trip: Trip, today: LocalDate, sources: readonly RainSource[], now: number, dismissed: readonly string[] = []): { flag: RainFlag; more: number } | null {
  const { flags } = withoutDismissed(rainFlags(trip, today, sources, now), dismissed);
  return flags.length ? { flag: flags[0]!, more: flags.length - 1 } : null;
}
