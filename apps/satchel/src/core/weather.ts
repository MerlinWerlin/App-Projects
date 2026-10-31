// T70 weather: a pure parser and summariser for MET Norway Locationforecast 2.0 "compact" JSON, plus the choices the
// trip card needs (which place, which days, how fresh, which unit). No React Native; the fetch and cache live in
// src/native/weather.ts. Data: Norwegian Meteorological Institute (MET Norway), CC BY 4.0, credited wherever the
// forecast shows ("Weather data: MET Norway").
// Written from the documented schema (api.met.no/weatherapi/locationforecast/2.0/documentation), not from a live
// response, because the cloud build box cannot reach api.met.no:
//   properties.meta.updated_at
//   properties.timeseries[].time                                   (ISO UTC; hourly at first, then 6-hourly)
//   properties.timeseries[].data.instant.details.air_temperature  (deg C)
//   properties.timeseries[].data.next_1_hours | next_6_hours | next_12_hours .summary.symbol_code
//   properties.timeseries[].data.next_1_hours | next_6_hours .details.precipitation_amount (mm)
//   next_6_hours.details.air_temperature_max / _min when present
// Everything is read defensively: a malformed step is skipped, a response with no usable step parses to null.
import type { Item, LocalDate, Stamp, Trip } from './model.ts';
import { validLatLon, type LatLon } from './poi.ts';
import { savedPlaces } from './places.ts';
import { addDays, daysBetween, fromUtc, isValidZone, localDate, toUtc } from './tz.ts';

const HOUR = 3_600_000;
export const STALE_AFTER_MS = 48 * HOUR;
/** Locationforecast reaches about nine days ahead; no point asking for a trip further out than this. */
export const FORECAST_HORIZON_DAYS = 9;
export const CARD_DAYS = 5;

// ---- Icon groups (the UI maps each to an @expo/vector-icons Ionicons glyph and a label) ----

export const WEATHER_GROUPS = ['clear', 'partly', 'cloudy', 'fog', 'rain', 'sleet', 'snow', 'thunder'] as const;
export type WeatherGroup = (typeof WEATHER_GROUPS)[number];

/** Worse weather wins ties (an umbrella day beats a cloudy one). */
const SEVERITY: Record<WeatherGroup, number> = { clear: 0, partly: 1, cloudy: 2, fog: 3, rain: 4, sleet: 5, snow: 6, thunder: 7 };

/**
 * MET symbol code ("partlycloudy_day", "lightrainshowersandthunder_night", "heavysnow") to one of the eight groups;
 * null for anything unrecognised. The _day / _night / _polartwilight suffix is ignored.
 */
export function symbolGroup(code: unknown): WeatherGroup | null {
  if (typeof code !== 'string' || !code) return null;
  const s = code.toLowerCase().replace(/_(day|night|polartwilight)$/, '');
  if (s.includes('thunder')) return 'thunder';
  if (s.includes('sleet')) return 'sleet';
  if (s.includes('snow')) return 'snow';
  if (s.includes('rain')) return 'rain';
  if (s === 'fog') return 'fog';
  if (s === 'cloudy') return 'cloudy';
  if (s === 'partlycloudy' || s === 'fair') return 'partly';
  if (s === 'clearsky') return 'clear';
  return null;
}

// ---- Parsing ----

/** One forecast step, trimmed to what Satchel uses (this is what the cache stores). */
export type ForecastPoint = {
  /** UTC ms of the step. */
  at: number;
  temp: number | null;
  /** The period the step's summary covers (1 or 6 hours; 12 when only next_12_hours is given), with its symbol and rain. */
  hours: 1 | 6 | 12 | null;
  symbol: string | null;
  precip: number | null;
  tMax: number | null;
  tMin: number | null;
};

export type Forecast = { asOf: number; points: ForecastPoint[] };

const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const iso = (v: unknown): number | null => {
  if (typeof v !== 'string') return null;
  const ms = Date.parse(v);
  return Number.isFinite(ms) ? ms : null;
};

function period(data: Record<string, unknown>): Pick<ForecastPoint, 'hours' | 'symbol' | 'precip' | 'tMax' | 'tMin'> {
  for (const [key, hours] of [
    ['next_1_hours', 1],
    ['next_6_hours', 6],
    ['next_12_hours', 12],
  ] as const) {
    const p = obj(data[key]);
    if (!p) continue;
    const summary = obj(p.summary);
    const details = obj(p.details);
    const symbol = typeof summary?.symbol_code === 'string' ? summary.symbol_code : null;
    const precip = num(details?.precipitation_amount);
    if (symbol === null && precip === null) continue;
    return { hours, symbol, precip: precip === null ? null : Math.max(0, precip), tMax: num(details?.air_temperature_max), tMin: num(details?.air_temperature_min) };
  }
  return { hours: null, symbol: null, precip: null, tMax: null, tMin: null };
}

/** A Locationforecast compact response (already JSON-parsed) as a Forecast, or null if nothing usable is in it. */
export function parseForecast(raw: unknown, fetchedAt?: number): Forecast | null {
  const props = obj(obj(raw)?.properties);
  const series = props?.timeseries;
  if (!props || !Array.isArray(series)) return null;
  const points: ForecastPoint[] = [];
  for (const step of series) {
    const s = obj(step);
    const at = iso(s?.time);
    const data = obj(s?.data);
    if (at === null || !data) continue;
    const temp = num(obj(obj(data.instant)?.details)?.air_temperature);
    const p = period(data);
    if (temp === null && p.hours === null) continue;
    points.push({ at, temp, ...p });
  }
  if (!points.length) return null;
  points.sort((a, b) => a.at - b.at);
  const asOf = iso(obj(props.meta)?.updated_at) ?? fetchedAt ?? points[0].at;
  return { asOf, points };
}

/** A cached Forecast read back from storage (any earlier shape or damage reads as null). */
export function normaliseForecast(v: unknown): Forecast | null {
  const o = obj(v);
  const asOf = num(o?.asOf);
  if (asOf === null || !Array.isArray(o?.points)) return null;
  const points: ForecastPoint[] = [];
  for (const raw of o.points) {
    const p = obj(raw);
    const at = num(p?.at);
    if (!p || at === null) continue;
    const hours = p.hours === 1 || p.hours === 6 || p.hours === 12 ? p.hours : null;
    points.push({ at, temp: num(p.temp), hours, symbol: typeof p.symbol === 'string' ? p.symbol : null, precip: num(p.precip), tMax: num(p.tMax), tMin: num(p.tMin) });
  }
  return points.length ? { asOf, points } : null;
}

// ---- Daily summary ----

export type WeatherDay = {
  date: LocalDate;
  /** Degrees Celsius, unrounded (format with formatTemp). */
  high: number;
  low: number;
  group: WeatherGroup | null;
  /** Total precipitation in mm over the steps that start on this local date. */
  precipMm: number;
};

/** Daytime hours used to pick the day's icon (local wall clock, start inclusive, end exclusive). */
const DAY_FROM = 6;
const DAY_TO = 21;

/**
 * Per local date in the place's zone: high / low from the instant temperatures (and any 6-hour max / min), the
 * precipitation of non-overlapping periods (each counted on the date it starts; a 6-hour period across midnight
 * counts on the first day), and the icon group that covers most daytime hours (worse weather wins a tie; any
 * daytime thunder shows thunder). A date with fewer than two temperatures is left out (the ragged forecast end).
 */
export function dailySummary(f: Forecast, tz: string): WeatherDay[] {
  if (!isValidZone(tz)) return [];
  type Acc = { temps: number[]; precip: number; hasPrecip: boolean; groupHours: Map<WeatherGroup, number>; thunder: boolean };
  const days = new Map<LocalDate, Acc>();
  const acc = (d: LocalDate): Acc => {
    let a = days.get(d);
    if (!a) {
      a = { temps: [], precip: 0, hasPrecip: false, groupHours: new Map(), thunder: false };
      days.set(d, a);
    }
    return a;
  };
  let coveredUntil = -Infinity;
  for (const p of f.points) {
    const wall = fromUtc(p.at, tz);
    const a = acc(localDate(wall));
    if (p.temp !== null) a.temps.push(p.temp);
    if (p.hours === null || p.at < coveredUntil) continue;
    coveredUntil = p.at + p.hours * HOUR;
    if (p.hours === 6) {
      if (p.tMax !== null) a.temps.push(p.tMax);
      if (p.tMin !== null) a.temps.push(p.tMin);
    }
    if (p.precip !== null) {
      a.precip += p.precip;
      a.hasPrecip = true;
    }
    const g = symbolGroup(p.symbol);
    if (!g) continue;
    // Hours of this period that fall in the daytime window of its start date.
    const startHour = Number(wall.slice(11, 13)) + Number(wall.slice(14, 16)) / 60;
    const daytime = Math.max(0, Math.min(startHour + p.hours, DAY_TO) - Math.max(startHour, DAY_FROM));
    if (daytime <= 0) continue;
    a.groupHours.set(g, (a.groupHours.get(g) ?? 0) + daytime);
    if (g === 'thunder') a.thunder = true;
  }
  const out: WeatherDay[] = [];
  for (const [date, a] of [...days.entries()].sort(([x], [y]) => (x < y ? -1 : 1))) {
    if (a.temps.length < 2) continue;
    let group: WeatherGroup | null = a.thunder ? 'thunder' : null;
    if (!group) {
      let best = -1;
      for (const [g, h] of a.groupHours) {
        if (h > best || (h === best && group && SEVERITY[g] > SEVERITY[group])) {
          best = h;
          group = g;
        }
      }
    }
    out.push({ date, high: Math.max(...a.temps), low: Math.min(...a.temps), group, precipMm: Math.round(a.precip * 10) / 10 });
  }
  return out;
}

/** The summary for one date, or null when the forecast does not reach it. */
export const dayOn = (days: readonly WeatherDay[], date: LocalDate): WeatherDay | null => days.find((d) => d.date === date) ?? null;

// ---- Freshness ----

export type Freshness = 'fresh' | 'cached' | 'stale';

/** 'fresh' just fetched; 'cached' shown from storage (offline or a failed fetch); 'stale' when the forecast is over 48 h old. */
export function freshness(asOf: number, now: number, fromCache: boolean): Freshness {
  if (now - asOf > STALE_AFTER_MS) return 'stale';
  return fromCache ? 'cached' : 'fresh';
}

// ---- Units ----

export const TEMP_UNITS = ['c', 'f'] as const;
export type TempUnit = (typeof TEMP_UNITS)[number];
/** AsyncStorage key for the Settings choice (Celsius by default). */
export const TEMP_UNIT_KEY = 'satchel.tempUnit.v1';
export const DEFAULT_TEMP_UNIT: TempUnit = 'c';
export const normaliseTempUnit = (v: unknown): TempUnit => (v === 'f' ? 'f' : 'c');

/** Whole degrees in the chosen unit ("12°", "-3°", "54°"); the unit letter is in the card header. */
export function formatTemp(celsius: number, unit: TempUnit): string {
  const v = unit === 'f' ? (celsius * 9) / 5 + 32 : celsius;
  const r = Math.round(v);
  return `${Object.is(r, -0) ? 0 : r}°`;
}

/** "0", "0.4", "12": precipitation in mm with at most one decimal (whole numbers from 10 mm). */
export function formatMm(mm: number): string {
  if (mm <= 0) return '0';
  if (mm >= 10) return String(Math.round(mm));
  return String(Math.round(mm * 10) / 10);
}

// ---- Request ----

/** MET asks for at most four decimals (more only defeats their cache). */
export const roundCoord = (n: number) => Math.round(n * 1e4) / 1e4;

export const MET_URL = 'https://api.met.no/weatherapi/locationforecast/2.0/compact';

export function forecastUrl(at: LatLon): string {
  return `${MET_URL}?lat=${roundCoord(at.lat)}&lon=${roundCoord(at.lon)}`;
}

/** Cache key per place (four-decimal coordinates, so the same spot shares one cache entry). */
export const cacheKey = (at: LatLon) => `satchel.weather.v1.${roundCoord(at.lat)},${roundCoord(at.lon)}`;

/** The identifying User-Agent MET's terms require. */
export const userAgent = (version: string) => `Satchel/${version || '0'} github.com/MerlinWerlin/App-Projects`;

// ---- Which place the trip card shows ----

export type WeatherPlace = LatLon & { name: string; tz: string };

type Candidate = { place: { name: string; lat: number; lon: number }; tz: string; from: number; to: number };

const coords = (p: Item['place']): { name: string; lat: number; lon: number } | null =>
  p && validLatLon(p.lat, p.lon) ? { name: p.name, lat: p.lat as number, lon: p.lon as number } : null;

const utcOf = (s: Stamp | undefined): number | null => {
  if (!s || !isValidZone(s.tz)) return null;
  try {
    return toUtc(s);
  } catch {
    return null;
  }
};

/** Places with coordinates on the trip's bookings, with the time span the traveller is there. */
function candidates(trip: Trip): Candidate[] {
  const out: Candidate[] = [];
  for (const it of trip.items) {
    const start = utcOf(it.start);
    if (start === null) continue;
    const end = utcOf(it.end) ?? start;
    const here = coords(it.place);
    if (here) out.push({ place: here, tz: it.start.tz, from: start, to: Math.max(start, end) });
    const to = coords(it.to);
    if (to) out.push({ place: to, tz: it.end?.tz && isValidZone(it.end.tz) ? it.end.tz : it.start.tz, from: end, to: end });
    const from = coords(it.from);
    if (from && !here && !to) out.push({ place: from, tz: it.start.tz, from: start, to: start });
  }
  return out.sort((a, b) => a.from - b.from);
}

/**
 * The trip's current or next destination: a booking place you are at now (a hotel stay under way), else the latest
 * place reached so far, else the next one ahead. Without any booking coordinates, the first saved place, in the
 * zone of the trip's current or next booking (saved places carry no zone), else the trip's home zone. Null when
 * the trip has no coordinates at all.
 */
export function weatherPlace(trip: Trip, now: number): WeatherPlace | null {
  const list = candidates(trip);
  const pick = list.find((c) => c.from <= now && now < c.to) ?? [...list].reverse().find((c) => c.from <= now) ?? list.find((c) => c.from > now) ?? null;
  if (pick) return { name: pick.place.name, lat: pick.place.lat, lon: pick.place.lon, tz: pick.tz };
  const saved = [...savedPlaces(trip)].sort((a, b) => (a.savedAt < b.savedAt ? -1 : a.savedAt > b.savedAt ? 1 : 0))[0];
  if (!saved) return null;
  const timed = trip.items.map((it) => ({ tz: it.start.tz, at: utcOf(it.start) })).filter((x): x is { tz: string; at: number } => x.at !== null).sort((a, b) => a.at - b.at);
  const zone = (timed.filter((x) => x.at <= now).pop() ?? timed[0])?.tz;
  const tz = zone && isValidZone(zone) ? zone : isValidZone(trip.homeTz) ? trip.homeTz : 'UTC';
  return { name: saved.name, lat: saved.lat, lon: saved.lon, tz };
}

/**
 * The dates the card lists: from today in the place (or the trip's first day, if later) for up to CARD_DAYS days,
 * never past the trip's last day. Empty for a trip that has ended.
 */
export function cardDates(trip: Trip, today: LocalDate, n = CARD_DAYS): LocalDate[] {
  const start = trip.startDate > today ? trip.startDate : today;
  if (start > trip.endDate) return [];
  const out: LocalDate[] = [];
  for (let d = start; d <= trip.endDate && out.length < n; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Whether any listed date is close enough for a forecast to exist (otherwise the app does not ask the network). */
export const forecastReaches = (dates: readonly LocalDate[], today: LocalDate) => dates.some((d) => daysBetween(today, d) <= FORECAST_HORIZON_DAYS);
