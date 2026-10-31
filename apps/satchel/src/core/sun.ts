// T70 daylight, fully offline: sunrise, sunset and civil twilight for a latitude / longitude on a local calendar
// date, with times as wall clocks in the place's own IANA zone. Pure TypeScript (no React Native).
// Method: the NOAA solar position algorithm (the NOAA Solar Calculator spreadsheet: Meeus-based mean anomaly,
// equation of centre, apparent longitude, obliquity, declination and equation of time), solved around the local
// solar noon nearest the place's wall-clock noon on that date, with each event refined at its own instant.
// Sunrise / sunset use the standard 0.833 degrees below the horizon (refraction + the sun's radius); civil twilight
// is 6 degrees below. Accuracy is about a minute away from the poles; nothing here is a navigation aid.
// Polar cases: when the sun never crosses the horizon that day, `polar` says which ('day' or 'night') and sunrise /
// sunset are null. Civil dawn / dusk are null on their own when the sky stays at least that bright all night (white
// nights) or never gets that bright (deep polar night); `twilightAllNight` marks the first.
import type { LocalDate, LocalDateTime } from './model.ts';
import { fromUtc, isValidZone, toUtc } from './tz.ts';
import { validLatLon } from './poi.ts';

const MIN = 60_000;
const DAY = 86_400_000;
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Degrees below the horizon for each event (centre of the sun). */
export const SUNRISE_DEPRESSION = 0.833;
export const CIVIL_DEPRESSION = 6;

type Solar = { declination: number; eqTimeMin: number };

/** NOAA solar declination (radians) and equation of time (minutes) at a UTC instant. */
export function solarPosition(utc: number): Solar {
  const jd = utc / DAY + 2440587.5;
  const t = (jd - 2451545) / 36525;
  const l0 = (((280.46646 + t * (36000.76983 + t * 0.0003032)) % 360) + 360) % 360;
  const m = 357.52911 + t * (35999.05029 - 0.0001537 * t);
  const e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
  const mr = rad(m);
  const c = Math.sin(mr) * (1.914602 - t * (0.004817 + 0.000014 * t)) + Math.sin(2 * mr) * (0.019993 - 0.000101 * t) + Math.sin(3 * mr) * 0.000289;
  const trueLong = l0 + c;
  const omega = 125.04 - 1934.136 * t;
  const lambda = trueLong - 0.00569 - 0.00478 * Math.sin(rad(omega));
  const eps0 = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(rad(omega));
  const declination = Math.asin(Math.sin(rad(eps)) * Math.sin(rad(lambda)));
  const y = Math.tan(rad(eps) / 2) ** 2;
  const l0r = rad(l0);
  const eq =
    y * Math.sin(2 * l0r) - 2 * e * Math.sin(mr) + 4 * e * y * Math.sin(mr) * Math.cos(2 * l0r) - 0.5 * y * y * Math.sin(4 * l0r) - 1.25 * e * e * Math.sin(2 * mr);
  return { declination, eqTimeMin: 4 * deg(eq) };
}

/** UTC instant of the solar noon (sun due south / north) nearest `near`. */
function solarNoonNear(lon: number, near: number): number {
  let noon = near;
  for (let i = 0; i < 3; i++) {
    const dayStart = Math.floor(noon / DAY) * DAY;
    let n = dayStart + (720 - 4 * lon - solarPosition(noon).eqTimeMin) * MIN;
    if (n - near > DAY / 2) n -= DAY;
    else if (near - n > DAY / 2) n += DAY;
    noon = n;
  }
  return noon;
}

/** cos of the hour angle at which the sun's centre is `depression` degrees below the horizon. */
function cosHourAngle(lat: number, declination: number, depression: number): number {
  const phi = rad(lat);
  return Math.cos(rad(90 + depression)) / (Math.cos(phi) * Math.cos(declination)) - Math.tan(phi) * Math.tan(declination);
}

type Crossing = { utc: number } | { never: 'above' | 'below' };

/** The morning (-1) or evening (+1) crossing of a depression angle around one solar noon, refined at its instant. */
function crossing(lat: number, noon: number, depression: number, side: -1 | 1): Crossing {
  let at = noon;
  for (let i = 0; i < 4; i++) {
    const { declination } = solarPosition(at);
    const ch = cosHourAngle(lat, declination, depression);
    if (ch > 1) return { never: 'below' }; // the sun stays below that angle: it never gets that high
    if (ch < -1) return { never: 'above' }; // the sun stays above that angle all day
    // One degree of hour angle is four minutes; the equation of time drifts under a few seconds in half a day.
    at = noon + side * deg(Math.acos(ch)) * 4 * MIN;
  }
  return { utc: at };
}

export type SunDay = {
  date: LocalDate;
  tz: string;
  /** Set when the sun stays up all day ('day') or never rises ('night'); then sunrise and sunset are null. */
  polar: 'day' | 'night' | null;
  sunrise: LocalDateTime | null;
  sunset: LocalDateTime | null;
  /** UTC instants of the same events (for "light left"). */
  sunriseUtc: number | null;
  sunsetUtc: number | null;
  /** Start of civil twilight in the morning and its end in the evening (sun 6 degrees below the horizon). */
  civilDawn: LocalDateTime | null;
  civilDusk: LocalDateTime | null;
  /** The sky never gets darker than civil twilight that night (white nights near the poles). */
  twilightAllNight: boolean;
  solarNoon: LocalDateTime;
  /** Minutes between sunrise and sunset (1440 in polar day, 0 in polar night). */
  daylightMin: number;
};

/** Sun times for a place on its local date, in its zone. Null for an invalid position, date or zone. */
export function sunDay(lat: number, lon: number, date: LocalDate, tz: string): SunDay | null {
  if (!validLatLon(lat, lon) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !isValidZone(tz)) return null;
  let wallNoon: number;
  try {
    wallNoon = toUtc({ local: `${date}T12:00`, tz });
  } catch {
    return null;
  }
  const noon = solarNoonNear(lon, wallNoon);
  const rise = crossing(lat, noon, SUNRISE_DEPRESSION, -1);
  const set = crossing(lat, noon, SUNRISE_DEPRESSION, 1);
  const dawn = crossing(lat, noon, CIVIL_DEPRESSION, -1);
  const dusk = crossing(lat, noon, CIVIL_DEPRESSION, 1);
  const wall = (c: Crossing) => ('utc' in c ? fromUtc(c.utc, tz) : null);
  const ms = (c: Crossing) => ('utc' in c ? c.utc : null);
  const polar = 'never' in rise ? (rise.never === 'above' ? 'day' : 'night') : null;
  const riseMs = ms(rise);
  const setMs = ms(set);
  return {
    date,
    tz,
    polar,
    sunrise: polar ? null : wall(rise),
    sunset: polar ? null : wall(set),
    sunriseUtc: polar ? null : riseMs,
    sunsetUtc: polar ? null : setMs,
    civilDawn: wall(dawn),
    civilDusk: wall(dusk),
    twilightAllNight: 'never' in dawn && dawn.never === 'above',
    solarNoon: fromUtc(noon, tz),
    daylightMin: polar === 'day' ? 1440 : polar === 'night' ? 0 : riseMs !== null && setMs !== null ? Math.round((setMs - riseMs) / MIN) : 0,
  };
}

/**
 * Minutes of daylight left at `now`: until today's sunset while the sun is up, null before sunrise, after sunset or
 * in polar night; Infinity in polar day (the UI says "the sun stays up today").
 */
export function lightLeftMin(day: SunDay, now: number): number | null {
  if (day.polar === 'day') return Infinity;
  if (day.polar || day.sunriseUtc === null || day.sunsetUtc === null) return null;
  if (now < day.sunriseUtc || now >= day.sunsetUtc) return null;
  return Math.floor((day.sunsetUtc - now) / MIN);
}

/** "3 h 10 m" / "45 m": a daylight span for the compact line. */
export function formatSpan(min: number): string {
  const m = Math.max(0, Math.floor(min));
  if (m < 60) return `${m} m`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} m`;
}
