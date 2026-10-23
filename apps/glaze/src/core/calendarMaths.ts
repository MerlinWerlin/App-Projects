// Calendar maths for the widget catalogue (T72; docs/WIDGETS.md "Widget catalogue").
//
// Pure: every function takes the moment it works on (`now: Date`) and, optionally, a fixed UTC
// offset in minutes. With an offset the result is the same on every machine (tests, the widget
// extension passing its own offset); without one the Date's local calendar fields are used, so
// "today" rolls over at the device's local midnight. Nothing here reads the clock itself.
//
// Day keys are `YYYY-MM-DD` in the local calendar.

export type DayKey = string;

export type LocalParts = {
  year: number;
  /** 1–12 */
  month: number;
  /** 1–31 */
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** 0 = Sunday … 6 = Saturday */
  weekday: number;
};

const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_DAY = 86_400_000;

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInYear(year: number): number {
  return isLeapYear(year) ? 366 : 365;
}

/** `month` is 1–12. */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** 1-based ordinal day of the year (1 Jan = 1, 31 Dec = 365 or 366). */
export function dayOfYear(year: number, month: number, day: number): number {
  return Math.round((Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 1)) / MS_DAY) + 1;
}

/** Calendar fields of `now`, in the device's local time or at a fixed UTC offset. */
export function localParts(now: Date, utcOffsetMinutes?: number): LocalParts {
  if (typeof utcOffsetMinutes === 'number' && Number.isFinite(utcOffsetMinutes)) {
    const d = new Date(now.getTime() + utcOffsetMinutes * 60_000);
    return {
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      day: d.getUTCDate(),
      hour: d.getUTCHours(),
      minute: d.getUTCMinutes(),
      second: d.getUTCSeconds(),
      weekday: d.getUTCDay(),
    };
  }
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
    hour: now.getHours(),
    minute: now.getMinutes(),
    second: now.getSeconds(),
    weekday: now.getDay(),
  };
}

const pad = (n: number, w = 2): string => String(n).padStart(w, '0');

export function dayKeyOf(year: number, month: number, day: number): DayKey {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

/** Today's local day key. */
export function localDayKey(now: Date, utcOffsetMinutes?: number): DayKey {
  const p = localParts(now, utcOffsetMinutes);
  return dayKeyOf(p.year, p.month, p.day);
}

/** Parse a real calendar day (`2026-02-30` is rejected). */
export function parseDayKey(key: unknown): { year: number; month: number; day: number } | null {
  if (typeof key !== 'string') return null;
  const m = DAY_KEY.exec(key);
  if (!m) return null;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

export function isDayKey(key: unknown): key is DayKey {
  return parseDayKey(key) !== null;
}

function dayNumber(key: DayKey): number {
  const p = parseDayKey(key);
  if (!p) return NaN;
  return Math.round(Date.UTC(p.year, p.month - 1, p.day) / MS_DAY);
}

/** Whole calendar days from `from` to `to` (negative when `to` is earlier). NaN for bad keys. */
export function daysBetween(from: DayKey, to: DayKey): number {
  return dayNumber(to) - dayNumber(from);
}

/** `key` moved by `n` days. Throws on a bad key. */
export function addDays(key: DayKey, n: number): DayKey {
  const num = dayNumber(key);
  if (Number.isNaN(num)) throw new Error(`calendarMaths: bad day key ${key}`);
  const d = new Date((num + n) * MS_DAY);
  return dayKeyOf(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export type Progress = {
  /** Today's ordinal, 1-based (day 203 of 365). Dots up to and including `day` are filled. */
  day: number;
  total: number;
  /** day / total, 0–1. */
  fraction: number;
  /** Whole percent, floored, so 100 only on the last day. */
  percent: number;
  /** Days after today. */
  remaining: number;
};

function progress(day: number, total: number): Progress {
  return { day, total, fraction: day / total, percent: Math.floor((day * 100) / total), remaining: total - day };
}

/** Year progress for the local day of `now` (e.g. 22 Jul 2026 → day 203/365). */
export function yearProgress(now: Date, utcOffsetMinutes?: number): Progress {
  const p = localParts(now, utcOffsetMinutes);
  return progress(dayOfYear(p.year, p.month, p.day), daysInYear(p.year));
}

/** Month progress for the local day of `now` (e.g. 18 Oct → day 18/31). */
export function monthProgress(now: Date, utcOffsetMinutes?: number): Progress {
  const p = localParts(now, utcOffsetMinutes);
  return progress(p.day, daysInMonth(p.year, p.month));
}

export type Countdown = {
  /** Calendar days from today to the target: 0 on the day, negative once it has passed. */
  days: number;
  state: 'upcoming' | 'today' | 'past';
};

/** Days left until `target` (`YYYY-MM-DD`), counted in local calendar days. Null for a bad key. */
export function countdownTo(target: DayKey, now: Date, utcOffsetMinutes?: number): Countdown | null {
  if (!isDayKey(target)) return null;
  const days = daysBetween(localDayKey(now, utcOffsetMinutes), target);
  return { days, state: days > 0 ? 'upcoming' : days === 0 ? 'today' : 'past' };
}

/**
 * Month grid: weeks of 7 cells, each a day number or 0 for padding. `weekStart` 0 = Sunday,
 * 1 = Monday (pass the locale's first weekday).
 */
export function monthGrid(year: number, month: number, weekStart: 0 | 1 = 1): number[][] {
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const lead = (first - weekStart + 7) % 7;
  const n = daysInMonth(year, month);
  const cells: number[] = [...Array(lead).fill(0), ...Array.from({ length: n }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(0);
  const weeks: number[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** Analog clock hand angles in degrees clockwise from 12. The hour hand moves continuously. */
export function handAngles(now: Date, utcOffsetMinutes?: number): { hour: number; minute: number; second: number } {
  const p = localParts(now, utcOffsetMinutes);
  const second = p.second * 6;
  const minute = p.minute * 6 + p.second * 0.1;
  const hour = (p.hour % 12) * 30 + p.minute * 0.5 + p.second / 120;
  return { hour, minute, second };
}

/**
 * The next local midnight after `now` (when day-based widgets and habit trackers roll over).
 * With an offset it is exact; without one it uses the Date's local calendar, so DST days work.
 */
export function nextLocalMidnight(now: Date, utcOffsetMinutes?: number): Date {
  if (typeof utcOffsetMinutes === 'number' && Number.isFinite(utcOffsetMinutes)) {
    const p = localParts(now, utcOffsetMinutes);
    return new Date(Date.UTC(p.year, p.month - 1, p.day + 1) - utcOffsetMinutes * 60_000);
  }
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
}

/**
 * Columns × rows for `count` progress dots in a frame of `aspect` (width / height), choosing the
 * layout with the largest dots that fit. Deterministic.
 */
export function dotGrid(count: number, aspect: number): { columns: number; rows: number } {
  const n = Math.max(1, Math.floor(count));
  const a = aspect > 0 && Number.isFinite(aspect) ? aspect : 1;
  let best = { columns: n, rows: 1, size: 0 };
  for (let columns = 1; columns <= n; columns++) {
    const rows = Math.ceil(n / columns);
    const size = Math.min(a / columns, 1 / rows);
    if (size > best.size + 1e-12) best = { columns, rows, size };
  }
  return { columns: best.columns, rows: best.rows };
}
