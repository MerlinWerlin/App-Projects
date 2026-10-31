// OSM opening_hours evaluator (T79), pure and offline. Handles the forms toilets are actually tagged with:
//   '24/7' · 'Mo-Fr 08:00-18:00' · 'Mo-Fr 08:00-18:00; Sa,Su 10:00-16:00' · 'Mo-Su 06:00-24:00'
//   past midnight ('22:00-02:00', '18:00-26:00') · several ranges ('08:00-12:00,13:00-17:00')
//   'off' / 'closed' (alone or after days) · day lists and wrapping ranges ('Mo,We,Fr', 'Fr-Mo')
//   additional rules after a comma ('Mo-Fr 08:00-18:00, Sa 10:00-14:00') · 'open' after days.
// Semantics follow the OSM spec: rules apply left to right; a ';' rule replaces what earlier rules said about the
// days it names, a ',' rule adds to them. Anything else (sunrise/sunset, PH/SH, months, dates, weeks, '+', comments,
// '||' fallbacks, 'unknown', typos) gives state 'unknown': we never guess whether a toilet is open.
// T80: public holiday rules ('PH off', 'PH 10:00-14:00', 'Su,PH off') are set aside rather than giving up: the
// weekday hours still show, and the status carries `holidays: true` so the screen adds "Public holidays may differ".
// A value that is only about public holidays stays unknown.
// The caller passes the wall clock in the place's own zone ('YYYY-MM-DDTHH:MM'); `hoursStatusAt` does that from a
// UTC instant with src/core/tz.ts (Intl only, works offline).
import type { LocalDateTime } from './model.ts';
import { fromUtc, isValidZone } from './tz.ts';

export type HoursState = 'open' | 'closed' | 'unknown';

export type HoursStatus = {
  state: HoursState;
  /** When open and it closes within the coming week: the closing wall time 'HH:MM' ('24:00' for midnight). */
  closesAt?: string;
  /** Whole days from today to the closing time (0 = today, 1 = after midnight tonight...). */
  closesInDays?: number;
  /** When closed and it opens again within the coming week: the opening wall time 'HH:MM'. */
  opensAt?: string;
  /** Whole days from today to the opening (0 = later today, 1 = tomorrow...). */
  opensInDays?: number;
  /** T80: the value also has public holiday (PH) rules, which are not applied; show a holiday caveat. */
  holidays?: true;
};

const DAY = 1440;
const WEEK = 7 * DAY;
const DAYS = ['mo', 'tu', 'we', 'th', 'fr', 'sa', 'su'] as const;
const UNKNOWN: HoursStatus = { state: 'unknown' };

type Interval = [number, number]; // minutes from the start of the day; end may pass 1440 (spills into the next day)
type Rule = { days: number[] | null; times: Interval[] | 'off'; additive: boolean };

const dayIndex = (s: string): number => DAYS.indexOf(s.toLowerCase() as (typeof DAYS)[number]);

/** 'Mo', 'Mo-Fr', 'Fr-Mo' (wraps), 'Mo,We,Fr' -> day indexes (0 = Monday); null when not a weekday selector. */
export function parseDays(sel: string): number[] | null {
  const out = new Set<number>();
  for (const part of sel.split(',')) {
    const m = /^([A-Za-z]{2})(?:-([A-Za-z]{2}))?$/.exec(part.trim());
    if (!m) return null;
    const a = dayIndex(m[1]);
    const b = m[2] === undefined ? a : dayIndex(m[2]);
    if (a < 0 || b < 0) return null;
    for (let d = a; ; d = (d + 1) % 7) {
      out.add(d);
      if (d === b) break;
    }
  }
  return out.size ? [...out].sort((x, y) => x - y) : null;
}

const TIME = /^(\d{1,2}):(\d{2})$/;

function minutes(s: string): number | null {
  const m = TIME.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (mi > 59 || h > 48 || h * 60 + mi > 2 * DAY) return null;
  return h * 60 + mi;
}

/** '08:00-12:00,13:00-17:00' -> intervals; an end at or before the start runs past midnight. Null when malformed. */
export function parseTimes(sel: string): Interval[] | null {
  const out: Interval[] = [];
  for (const part of sel.split(',')) {
    const m = /^([^-]+)-([^-]+)$/.exec(part.trim());
    if (!m) return null;
    const s = minutes(m[1]);
    let e = minutes(m[2]);
    if (s === null || e === null || s >= DAY) return null;
    if (e <= s) e += DAY;
    if (e - s > DAY) return null;
    out.push([s, e]);
  }
  return out.length ? out : null;
}

/** One rule (no ';'). Returns the rules it holds (a ',' followed by a weekday starts an additional rule). */
function parseRule(raw: string, additive: boolean): Rule[] | null {
  const text = raw.trim().replace(/\s+/g, ' ').replace(/ ?- ?/g, '-').replace(/ ?, ?/g, ',');
  if (!text) return null;
  // Split additional rules: ", Sa 10:00-14:00" (a comma after a time or off/open, then a weekday selector).
  const pieces = text.replace(/(\d|off|closed|open),(?=[A-Za-z]{2}(?:[-,: ]|$))/gi, '$1\u0000').split('\u0000');
  if (pieces.length > 1) {
    const all: Rule[] = [];
    for (let i = 0; i < pieces.length; i++) {
      const r = parseRule(pieces[i], i === 0 ? additive : true);
      if (!r) return null;
      all.push(...r);
    }
    return all;
  }
  if (/^24\/7$/.test(text)) return [{ days: null, times: [[0, DAY]], additive }];
  const tokens = text.split(' ');
  let days: number[] | null = null;
  let i = 0;
  const first = tokens[0].replace(/:$/, '');
  if (/^[A-Za-z]{2}([-,][A-Za-z]{2})*$/.test(first)) {
    days = parseDays(first);
    if (!days) return null;
    i = 1;
  }
  const rest = tokens.slice(i);
  if (rest.length === 0) return days ? [{ days, times: [[0, DAY]], additive }] : null;
  if (rest.length !== 1) return null;
  const word = rest[0].toLowerCase();
  if (word === 'off' || word === 'closed') return [{ days, times: 'off', additive }];
  if (word === 'open') return [{ days, times: [[0, DAY]], additive }];
  if (word === '24/7') return [{ days, times: [[0, DAY]], additive }];
  const times = parseTimes(rest[0]);
  return times ? [{ days, times, additive }] : null;
}

/** Things we deliberately don't evaluate: any of them makes the whole value unknown. */
const UNSUPPORTED = /sunrise|sunset|dawn|dusk|\bPH\b|\bSH\b|easter|week|\+|"|\[|\]|\|\||\bunknown\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b|\d{4}/i;

/**
 * T80: the value with its public holiday rules set aside. A ';' rule whose day selector names PH is dropped ('PH off',
 * 'PH 10:00-14:00'); PH beside weekdays is taken out of the list ('Sa,PH 10:00-14:00' -> 'Sa 10:00-14:00').
 * `holidays` says whether anything was set aside. PH anywhere else is left in, so the value stays unknown.
 */
export function withoutHolidays(value: string): { rest: string; holidays: boolean } {
  let holidays = false;
  const kept: string[] = [];
  for (const part of value.split(';')) {
    const m = /^\s*((?:[A-Za-z]{2}(?:\s*-\s*[A-Za-z]{2})?\s*,\s*)*PH(?:\s*,\s*[A-Za-z]{2}(?:\s*-\s*[A-Za-z]{2})?)*)(:?)(?=\s|$)(.*)$/.exec(part);
    if (!m) {
      kept.push(part);
      continue;
    }
    holidays = true;
    const days = m[1]
      .split(',')
      .map((d) => d.trim())
      .filter((d) => d && d !== 'PH');
    if (days.length) kept.push(` ${days.join(',')}${m[2]}${m[3]}`);
  }
  return { rest: kept.join(';').trim(), holidays };
}

/** The week as open intervals on 0..WEEK (Monday 00:00 = 0), or null when the value can't be evaluated. */
export function parseOpeningHours(value: string | undefined | null): Interval[] | null {
  if (typeof value !== 'string') return null;
  if (value.length > 255) return null;
  const v = withoutHolidays(value).rest;
  if (!v || v.length > 255 || UNSUPPORTED.test(v)) return null;
  const perDay: Interval[][] = DAYS.map(() => []);
  for (const part of v.split(';')) {
    if (!part.trim()) continue;
    const rules = parseRule(part, false);
    if (!rules) return null;
    for (const r of rules) {
      for (const d of r.days ?? [0, 1, 2, 3, 4, 5, 6]) {
        if (r.times === 'off') perDay[d] = [];
        else perDay[d] = r.additive ? [...perDay[d], ...r.times] : [...r.times];
      }
    }
  }
  const week: Interval[] = [];
  perDay.forEach((list, d) => {
    for (const [s, e] of list) week.push([d * DAY + s, d * DAY + e]);
  });
  return week;
}

/** Merge overlapping or touching intervals (input any order). */
function merge(list: Interval[]): Interval[] {
  const sorted = [...list].sort((a, b) => a[0] - b[0]);
  const out: Interval[] = [];
  for (const [s, e] of sorted) {
    const last = out[out.length - 1];
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else out.push([s, e]);
  }
  return out;
}

const pad = (n: number) => String(n).padStart(2, '0');
const hhmm = (min: number, midnightAs24: boolean): string => {
  const m = ((min % DAY) + DAY) % DAY;
  if (m === 0 && midnightAs24) return '24:00';
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
};

const LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** Open / closed / unknown at a wall-clock time in the place's zone, with the next change when known. */
export function hoursStatus(value: string | undefined | null, local: LocalDateTime): HoursStatus {
  const m = LOCAL.exec(local);
  if (!m) return UNKNOWN;
  const week = parseOpeningHours(value);
  if (!week) return UNKNOWN;
  const st = statusIn(week, m);
  return typeof value === 'string' && withoutHolidays(value).holidays ? { ...st, holidays: true } : st;
}

function statusIn(week: Interval[], m: RegExpExecArray): HoursStatus {
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const weekday = (new Date(Date.UTC(y, mo - 1, d)).getUTCDay() + 6) % 7;
  const today = weekday * DAY;
  const now = today + h * 60 + mi;
  // Three copies of the week so ranges spilling over Sunday night and wrapping queries both work.
  const line = merge([-WEEK, 0, WEEK].flatMap((off) => week.map(([s, e]): Interval => [s + off, e + off])));
  const cur = line.find(([s, e]) => s <= now && now < e);
  if (cur) {
    if (cur[1] - cur[0] >= 2 * WEEK) return { state: 'open' }; // open round the clock
    if (cur[1] - now > WEEK) return { state: 'open' };
    return { state: 'open', closesAt: hhmm(cur[1], true), closesInDays: Math.floor((cur[1] - 1 - today) / DAY) };
  }
  const next = line.find(([s]) => s > now);
  if (!next || next[0] - now > WEEK) return { state: 'closed' };
  return { state: 'closed', opensAt: hhmm(next[0], false), opensInDays: Math.floor((next[0] - today) / DAY) };
}

/** hoursStatus at a UTC instant in an IANA zone; unknown when the zone isn't usable. */
export function hoursStatusAt(value: string | undefined | null, utc: number, tz: string): HoursStatus {
  if (!Number.isFinite(utc) || !isValidZone(tz)) return UNKNOWN;
  return hoursStatus(value, fromUtc(utc, tz));
}
