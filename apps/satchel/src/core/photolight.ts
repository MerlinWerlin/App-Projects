// T139 Photo light, fully offline: golden hour and blue hour for a place on a local date, in the place's own IANA
// zone, built on the T70 solar model in src/core/sun.ts (NOAA declination + equation of time; sunrise / sunset come
// from sunDay). Pure TypeScript (no React Native), so Node runs it.
// Definitions (photographers' usual working bands, by the sun's geometric elevation, no refraction):
//   blue hour   = elevation from -6 to -4 degrees (just before sunrise, just after sunset)
//   golden hour = elevation from -4 to +6 degrees (around sunrise and sunset)
// Method: the elevation is sampled every 5 minutes across the local day (00:00 to the next 00:00 in the zone, so a
// 23 or 25 hour DST day is handled by the zone itself), and every crossing of -6, -4 and +6 degrees is refined by
// bisection to a few seconds. That makes the polar cases fall out on their own: a day where the sun never drops to
// +6 has no golden hour, a white night has golden light across midnight and no blue hour, and a polar-night day can
// have a short golden or blue spell around noon. Windows are clipped to the local day (`fromMidnight` / `toMidnight`
// say so); nextGoodLight joins a window running on over midnight with its continuation.
import type { LocalDate, LocalDateTime, Trip } from './model.ts';
import { tripZoneAt } from './journal.ts';
import { stopForDate } from './outfits.ts';
import { haversineMeters, validLatLon, type LatLon } from './poi.ts';
import { lightLeftMin, solarPosition, sunDay, type SunDay } from './sun.ts';
import { addDays, daysBetween, fromUtc, isValidZone, localDate, toUtc } from './tz.ts';
import { weatherStops, type WeatherStop } from './weather.ts';

const MIN = 60_000;
const DAY = 86_400_000;
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Band edges in degrees of solar elevation. */
export const BLUE_LOW = -6;
export const GOLDEN_LOW = -4;
export const GOLDEN_HIGH = 6;
/** Sampling step across the day; crossings are then refined to about REFINE_MS. */
const STEP_MS = 5 * MIN;
const REFINE_MS = 5_000;
/** Spells shorter than this are not worth calling a window. */
const MIN_WINDOW_MS = MIN;
/** How many days ahead nextGoodLight looks (a polar-night stretch can have none for weeks). */
export const NEXT_SEARCH_DAYS = 3;
/** The most trip days the card works out (a very long trip still draws fast). */
export const MAX_LIGHT_DAYS = 90;

/** Geometric elevation of the sun's centre in degrees, at a UTC instant, seen from lat / lon. */
export function solarElevation(lat: number, lon: number, utc: number): number {
  const { declination, eqTimeMin } = solarPosition(utc);
  const minutesUtc = (((utc % DAY) + DAY) % DAY) / MIN;
  const trueSolar = minutesUtc + eqTimeMin + 4 * lon;
  const hourAngle = rad(trueSolar / 4 - 180);
  const phi = rad(lat);
  const s = Math.sin(phi) * Math.sin(declination) + Math.cos(phi) * Math.cos(declination) * Math.cos(hourAngle);
  return deg(Math.asin(Math.max(-1, Math.min(1, s))));
}

export type LightKind = 'blue' | 'golden';
type Band = 'night' | LightKind | 'day';

const bandOf = (el: number): Band => (el < BLUE_LOW ? 'night' : el < GOLDEN_LOW ? 'blue' : el <= GOLDEN_HIGH ? 'golden' : 'day');

export type LightWindow = {
  kind: LightKind;
  /** Before the sun's highest point, after it, or (sun never higher than the band) spanning it. */
  part: 'morning' | 'evening' | 'midday';
  startUtc: number;
  endUtc: number;
  /** Wall clocks in the place's zone, rounded to the minute. */
  start: LocalDateTime;
  end: LocalDateTime;
  /** The window was already on at local midnight (it carries on from the night before). */
  fromMidnight: boolean;
  /** The window is still on at the next local midnight. */
  toMidnight: boolean;
};

/**
 * Why a day has fewer windows than the usual four: 'noGolden' (the sun stays above +6 all day), 'noBlue' (white
 * night: the sun never drops to -4), 'lowSun' (the sun never gets above +6: golden light all day), 'dark' (the sun
 * never gets above -6). Null on an ordinary day.
 */
export type LightNote = 'noGolden' | 'noBlue' | 'lowSun' | 'dark' | null;

export type PhotoDay = {
  date: LocalDate;
  tz: string;
  lat: number;
  lon: number;
  /** Sunrise, sunset, civil twilight and the polar flag from src/core/sun.ts. */
  sun: SunDay;
  /** Every blue and golden window of the local day, in time order. */
  windows: LightWindow[];
  /** UTC bounds of the local day [00:00, next 00:00) in the zone. */
  dayStartUtc: number;
  dayEndUtc: number;
  /** Instant of the sun's highest point inside the day, and its elevation. */
  peakUtc: number;
  maxElevation: number;
  minElevation: number;
  note: LightNote;
};

const roundMin = (utc: number) => Math.round(utc / MIN) * MIN;

/** Bisect for the instant between a and b where elevation crosses `edge` (a and b on opposite sides). */
function refine(lat: number, lon: number, a: number, b: number, edge: number): number {
  let lo = a;
  let hi = b;
  const loAbove = solarElevation(lat, lon, lo) >= edge;
  while (hi - lo > REFINE_MS) {
    const mid = (lo + hi) / 2;
    if (solarElevation(lat, lon, mid) >= edge === loAbove) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** UTC bounds of a local date in a zone, or null for an unreadable date / zone. */
function dayBounds(date: LocalDate, tz: string): { from: number; to: number } | null {
  try {
    const from = toUtc({ local: `${date}T00:00`, tz });
    const to = toUtc({ local: `${addDays(date, 1)}T00:00`, tz });
    return to > from ? { from, to } : null;
  } catch {
    return null;
  }
}

type Spell = { band: Band; from: number; to: number };

/**
 * Samples the elevation from `from` to `to` every STEP_MS, refines every crossing of -6 / -4 / +6 degrees, and
 * returns the stretches in one band each (neighbours in the same band joined), with the samples and the best one.
 */
function bandSpells(lat: number, lon: number, from: number, to: number): { times: number[]; els: number[]; peak: number; spells: Spell[] } {
  const times: number[] = [];
  for (let at = from; at < to; at += STEP_MS) times.push(at);
  times.push(to);
  const els = times.map((at) => solarElevation(lat, lon, at));
  const cuts: number[] = [];
  let peak = 0;
  for (let i = 0; i < times.length; i++) {
    if (els[i] > els[peak]) peak = i;
    if (i === 0) continue;
    for (const edge of [BLUE_LOW, GOLDEN_LOW, GOLDEN_HIGH]) {
      if (els[i - 1] >= edge !== els[i] >= edge) cuts.push(refine(lat, lon, times[i - 1], times[i], edge));
    }
  }
  cuts.sort((a, b) => a - b);
  const edges = [from, ...cuts, to];
  const spells: Spell[] = [];
  for (let i = 1; i < edges.length; i++) {
    const a = edges[i - 1];
    const b = edges[i];
    if (b <= a) continue;
    const band = bandOf(solarElevation(lat, lon, (a + b) / 2));
    const last = spells[spells.length - 1];
    if (last && last.band === band) last.to = b;
    else spells.push({ band, from: a, to: b });
  }
  return { times, els, peak, spells };
}

/** Golden and blue hour for a place on its local date, in its zone. Null for a bad position, date or zone. */
export function photoDay(lat: number, lon: number, date: LocalDate, tz: string): PhotoDay | null {
  if (!validLatLon(lat, lon) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !isValidZone(tz)) return null;
  const sun = sunDay(lat, lon, date, tz);
  const bounds = dayBounds(date, tz);
  if (!sun || !bounds) return null;
  const { from, to } = bounds;

  const { times, els, peak, spells } = bandSpells(lat, lon, from, to);

  // The sun's highest point, refined around the best sample (golden-section style narrowing).
  let lo = times[Math.max(0, peak - 1)];
  let hi = times[Math.min(times.length - 1, peak + 1)];
  while (hi - lo > REFINE_MS) {
    const m1 = lo + (hi - lo) / 3;
    const m2 = hi - (hi - lo) / 3;
    if (solarElevation(lat, lon, m1) < solarElevation(lat, lon, m2)) lo = m1;
    else hi = m2;
  }
  const peakUtc = (lo + hi) / 2;
  const maxElevation = Math.max(solarElevation(lat, lon, peakUtc), ...els);
  const minElevation = Math.min(...els);

  const windows: LightWindow[] = [];
  for (const s of spells) {
    if (s.band !== 'blue' && s.band !== 'golden') continue;
    if (s.to - s.from < MIN_WINDOW_MS) continue;
    const part = s.to <= peakUtc ? 'morning' : s.from >= peakUtc ? 'evening' : 'midday';
    windows.push({
      kind: s.band,
      part,
      startUtc: s.from,
      endUtc: s.to,
      start: fromUtc(roundMin(s.from), tz),
      end: fromUtc(roundMin(s.to), tz),
      fromMidnight: s.from === from,
      toMidnight: s.to === to,
    });
  }

  const note: LightNote =
    maxElevation < BLUE_LOW ? 'dark' : minElevation > GOLDEN_HIGH ? 'noGolden' : maxElevation <= GOLDEN_HIGH ? 'lowSun' : minElevation >= GOLDEN_LOW ? 'noBlue' : null;
  return { date, tz, lat, lon, sun, windows, dayStartUtc: from, dayEndUtc: to, peakUtc, maxElevation, minElevation, note };
}

export const goldenWindows = (d: PhotoDay) => d.windows.filter((w) => w.kind === 'golden');
export const blueWindows = (d: PhotoDay) => d.windows.filter((w) => w.kind === 'blue');

/** The window `now` is in, if any. */
export const windowAt = (d: PhotoDay, now: number): LightWindow | null => d.windows.find((w) => w.startUtc <= now && now < w.endUtc) ?? null;

/** T142: how far either side of the local day dayWindows looks for the rest of a window running over midnight. */
const JOIN_REACH_MS = 12 * 3_600_000;

/** A window of the day as the day card lists it: joined across midnight with the part on the next / previous day. */
export type DayWindow = LightWindow & {
  /** Started on the evening before (it is still on at this day's 00:00). */
  carried: boolean;
  /** Runs on past this day's midnight into the next day. */
  spills: boolean;
};

/**
 * T142: the day's windows for the day card, each joined across local midnight with its continuation, so a golden or
 * blue hour from 23:41 to 00:37 (high-latitude summer) reads "23:41–00:37" on both days instead of being cut at
 * midnight, and a spell with under a minute on one side of midnight is not lost. `start` / `end` are then the real
 * wall clocks (dates may differ from the day's); `fromMidnight` / `toMidnight` stay true only when the window runs on
 * for more than JOIN_REACH_MS past the day (all-day golden light, a white night at the pole), where the clipped
 * times are kept as before.
 */
export function dayWindows(d: PhotoDay): DayWindow[] {
  const reachFrom = d.dayStartUtc - JOIN_REACH_MS;
  const reachTo = d.dayEndUtc + JOIN_REACH_MS;
  const { spells } = bandSpells(d.lat, d.lon, reachFrom, reachTo);
  const out: DayWindow[] = [];
  for (const s of spells) {
    if (s.band !== 'blue' && s.band !== 'golden') continue;
    if (s.to <= d.dayStartUtc || s.from >= d.dayEndUtc || s.to - s.from < MIN_WINDOW_MS) continue;
    const openStart = s.from <= reachFrom;
    const openEnd = s.to >= reachTo;
    const from = openStart ? d.dayStartUtc : s.from;
    const to = openEnd ? d.dayEndUtc : s.to;
    out.push({
      kind: s.band,
      part: to <= d.peakUtc ? 'morning' : from >= d.peakUtc ? 'evening' : 'midday',
      startUtc: from,
      endUtc: to,
      start: fromUtc(roundMin(from), d.tz),
      end: fromUtc(roundMin(to), d.tz),
      fromMidnight: openStart,
      toMidnight: openEnd,
      carried: !openStart && s.from < d.dayStartUtc,
      spills: !openEnd && s.to > d.dayEndUtc,
    });
  }
  return out;
}

export type LightLeft = {
  /** Minutes of daylight left (src/core/sun.ts lightLeftMin): null before sunrise / after sunset / polar night; Infinity in polar day. */
  daylightMin: number | null;
  /** Minutes of golden plus blue light still to come today (from now, or what is left of the one under way). */
  goodMin: number;
  goldenMin: number;
  blueMin: number;
};

/** "Light left today" at `now` for a photo day. */
export function lightLeftToday(d: PhotoDay, now: number): LightLeft {
  let goldenMin = 0;
  let blueMin = 0;
  for (const w of d.windows) {
    if (w.endUtc <= now) continue;
    const m = Math.floor((w.endUtc - Math.max(w.startUtc, now)) / MIN);
    if (w.kind === 'golden') goldenMin += m;
    else blueMin += m;
  }
  return { daylightMin: lightLeftMin(d.sun, now), goodMin: goldenMin + blueMin, goldenMin, blueMin };
}

export type NextLight = {
  window: LightWindow;
  /** 'now': under way (minutes = left); 'next': still to come (minutes = until it starts). */
  state: 'now' | 'next';
  minutes: number;
};

/**
 * The good-light window under way at `now`, else the next one, looking up to NEXT_SEARCH_DAYS local days ahead.
 * `kinds` narrows it (golden only for the Your day row). A window that runs on over midnight is joined with its
 * continuation, so a white night reads as one golden spell. Null when none comes in that time (deep polar night,
 * or high polar day with no golden hour).
 */
export function nextGoodLight(lat: number, lon: number, tz: string, now: number, kinds: readonly LightKind[] = ['golden', 'blue']): NextLight | null {
  if (!isValidZone(tz) || !validLatLon(lat, lon)) return null;
  const first = localDate(fromUtc(now, tz));
  const list: LightWindow[] = [];
  for (let i = -1; i <= NEXT_SEARCH_DAYS; i++) {
    const d = photoDay(lat, lon, addDays(first, i), tz);
    if (!d) continue;
    for (const w of d.windows) {
      const last = list[list.length - 1];
      if (last && last.toMidnight && w.fromMidnight && last.kind === w.kind && last.endUtc === w.startUtc) {
        list[list.length - 1] = { ...last, endUtc: w.endUtc, end: w.end, toMidnight: w.toMidnight };
      } else list.push(w);
    }
  }
  const hit = list.find((w) => kinds.includes(w.kind) && w.endUtc > now);
  if (!hit) return null;
  return hit.startUtc <= now
    ? { window: hit, state: 'now', minutes: Math.max(0, Math.floor((hit.endUtc - now) / MIN)) }
    : { window: hit, state: 'next', minutes: Math.max(0, Math.ceil((hit.startUtc - now) / MIN)) };
}

// ------------------------------------------------------------------ the sun-arc illustration

export type ArcState = 'before' | 'up' | 'after' | 'polarDay' | 'polarNight';
/** Where the sun sits on the drawn arc: f is 0 at sunrise, 1 at sunset (polar day: local midnight to midnight). */
export type ArcPos = { state: ArcState; f: number };

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export function sunArc(d: PhotoDay, now: number): ArcPos {
  const s = d.sun;
  if (s.polar === 'day') return { state: 'polarDay', f: clamp01((now - d.dayStartUtc) / (d.dayEndUtc - d.dayStartUtc)) };
  if (s.polar === 'night' || s.sunriseUtc === null || s.sunsetUtc === null) return { state: 'polarNight', f: 0.5 };
  if (now < s.sunriseUtc) return { state: 'before', f: 0 };
  if (now >= s.sunsetUtc) return { state: 'after', f: 1 };
  return { state: 'up', f: clamp01((now - s.sunriseUtc) / (s.sunsetUtc - s.sunriseUtc)) };
}

/** The part of a window above the horizon, as [f0, f1] on the arc; null when none of it is (blue hour, polar night). */
export function arcSpan(d: PhotoDay, w: LightWindow): [number, number] | null {
  const s = d.sun;
  let a: number;
  let b: number;
  if (s.polar === 'day') {
    const len = d.dayEndUtc - d.dayStartUtc;
    a = (w.startUtc - d.dayStartUtc) / len;
    b = (w.endUtc - d.dayStartUtc) / len;
  } else if (s.sunriseUtc !== null && s.sunsetUtc !== null && !s.polar) {
    const len = s.sunsetUtc - s.sunriseUtc;
    a = (w.startUtc - s.sunriseUtc) / len;
    b = (w.endUtc - s.sunriseUtc) / len;
  } else return null;
  const f0 = clamp01(a);
  const f1 = clamp01(b);
  return f1 - f0 > 0.002 ? [f0, f1] : null;
}

// ------------------------------------------------------------------ trips, places and ideas

export type LightPlace = LatLon & { name: string; tz: string };
export type LightDay = { date: LocalDate; place: LightPlace; day: PhotoDay };

const toPlace = (s: WeatherStop): LightPlace => ({ name: s.name, lat: s.lat, lon: s.lon, tz: s.tz });

/**
 * Photo light for one trip day at that day's stay or place: the weather card's stops (src/core/weather.ts, the
 * bookings with coordinates, each in its own booking's zone) picked for the date the way the outfit planner does
 * (src/core/outfits.ts stopForDate). Null when the trip has no coordinates.
 */
export function lightDayFor(trip: Trip, date: LocalDate, now: number, stops: readonly WeatherStop[] = weatherStops(trip, now)): LightDay | null {
  const stop = stopForDate(stops, date);
  if (!stop) return null;
  const day = photoDay(stop.lat, stop.lon, date, stop.tz);
  return day ? { date, place: toPlace(stop), day } : null;
}

/** The trip's dates the card offers (first MAX_LIGHT_DAYS). */
export function lightDates(trip: Trip): LocalDate[] {
  const out: LocalDate[] = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trip.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(trip.endDate)) return out;
  for (let d = trip.startDate; d <= trip.endDate && out.length < MAX_LIGHT_DAYS; d = addDays(d, 1)) out.push(d);
  return out;
}

/** The day the card opens on: today where the traveller is while the trip is on, else its first day (last once over). */
export function defaultLightDate(trip: Trip, now: number): LocalDate {
  const today = localDate(fromUtc(now, tripZoneAt(trip, now)));
  if (today < trip.startDate) return trip.startDate;
  if (today > trip.endDate) return trip.endDate;
  return today;
}

/**
 * The Your day row: today's golden hour still to come (or under way) at today's place. Null when it is over for
 * today or there is none (polar summer), or the trip has no coordinates.
 */
export function briefLight(trip: Trip, today: LocalDate, now: number): { place: LightPlace; window: LightWindow; state: 'now' | 'next' } | null {
  const ld = lightDayFor(trip, today, now);
  if (!ld) return null;
  const w = goldenWindows(ld.day).find((x) => x.endUtc > now);
  if (!w) return null;
  return { place: ld.place, window: w, state: w.startUtc <= now ? 'now' : 'next' };
}

/**
 * The zone for a spot with no zone of its own (a saved place or an idea): the zone of the trip's nearest stop with
 * coordinates, else the zone the traveller is in on the trip (journal.ts tripZoneAt).
 */
export function zoneForSpot(trip: Trip, at: LatLon, now: number, stops: readonly WeatherStop[] = weatherStops(trip, now)): string {
  let best: WeatherStop | null = null;
  let bestM = Infinity;
  for (const s of stops) {
    const m = haversineMeters(s, at);
    if (m < bestM && isValidZone(s.tz)) {
      best = s;
      bestM = m;
    }
  }
  return best ? best.tz : tripZoneAt(trip, now);
}

/**
 * Photo light at a spot on the trip: on `date` when given (an idea's planned day), else today while the trip is on,
 * else its first day (last once over). Null for an unreadable spot.
 */
export function spotLight(trip: Trip, at: LatLon, date: LocalDate | null, now: number): PhotoDay | null {
  if (!validLatLon(at.lat, at.lon)) return null;
  const tz = zoneForSpot(trip, at, now);
  let day = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
  if (!day) {
    const today = localDate(fromUtc(now, tz));
    day = today < trip.startDate ? trip.startDate : today > trip.endDate ? trip.endDate : today;
  }
  return photoDay(at.lat, at.lon, day, tz);
}

/**
 * T146: the windows for a saved place's or idea's Photo light line, joined across local midnight like the day card
 * (dayWindows), split by kind in time order. A golden / blue hour from 23:52 to 00:56 then reads "23:52–00:56" on the
 * line instead of "from 23:52"; one carried over from the evening before keeps `carried` so the line can say so.
 */
export function spotWindows(d: PhotoDay): { golden: DayWindow[]; blue: DayWindow[] } {
  const all = dayWindows(d);
  return { golden: all.filter((w) => w.kind === 'golden'), blue: all.filter((w) => w.kind === 'blue') };
}

/** Whole days from today (in the place's zone) to a photo day: 0 today, 1 tomorrow, negative in the past. */
export const daysAway = (d: PhotoDay, now: number) => daysBetween(localDate(fromUtc(now, d.tz)), d.date);
