// Time-zone maths with Intl only (works offline, no tz database bundled). DST-safe:
//  - a wall time that doesn't exist (spring-forward gap) moves forward by the gap, like a clock would;
//  - a wall time that happens twice (fall-back overlap) means the earlier one.
import type { LocalDate, LocalDateTime, Stamp } from './model.ts';

const MIN = 60_000;
const DAY = 86_400_000;
const fmtCache = new Map<string, Intl.DateTimeFormat>();

function fmt(tz: string): Intl.DateTimeFormat {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    fmtCache.set(tz, f);
  }
  return f;
}

export function isValidZone(tz: string): boolean {
  try {
    fmt(tz);
    return true;
  } catch {
    return false;
  }
}

const RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

export function isLocalDateTime(s: string): boolean {
  const m = RE.exec(s);
  if (!m) return false;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const ms = Date.UTC(y, mo - 1, d, h, mi);
  const back = new Date(ms);
  return back.getUTCDate() === d && back.getUTCMonth() === mo - 1 && h < 24 && mi < 60;
}

/** Wall-clock string read as if it were UTC (a plain number to do maths on). */
export function wallMs(local: LocalDateTime): number {
  const m = RE.exec(local);
  if (!m) throw new Error(`bad local time: ${local}`);
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  return Date.UTC(y, mo - 1, d, h, mi);
}

const pad = (n: number) => String(n).padStart(2, '0');

export function wallString(ms: number): LocalDateTime {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** Wall clock in `tz` at the UTC instant, as wall-ms. */
function wallAt(tz: string, utc: number): number {
  const p: Record<string, number> = {};
  for (const part of fmt(tz).formatToParts(new Date(utc))) if (part.type !== 'literal') p[part.type] = Number(part.value);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute);
}

/** UTC offset of `tz` at the UTC instant, in minutes (Tokyo = +540). */
export function offsetMinutes(tz: string, utc: number): number {
  const floored = Math.floor(utc / MIN) * MIN;
  return Math.round((wallAt(tz, floored) - floored) / MIN);
}

/** UTC instant (ms) of a wall-clock time in a zone. */
export function toUtc(s: Stamp): number {
  const w = wallMs(s.local);
  const before = offsetMinutes(s.tz, w - DAY);
  const after = offsetMinutes(s.tz, w + DAY);
  const hits = [before, after].map((o) => w - o * MIN).filter((t) => wallAt(s.tz, t) === w);
  if (hits.length) return Math.min(...hits);
  // Spring-forward gap: read the time with the offset from before the gap, which lands just after it.
  return w - before * MIN;
}

/** Wall-clock local time in `tz` for a UTC instant. */
export function fromUtc(utc: number, tz: string): LocalDateTime {
  return wallString(wallAt(tz, utc));
}

export const localDate = (local: LocalDateTime): LocalDate => local.slice(0, 10);
export const localTime = (local: LocalDateTime): string => local.slice(11, 16);

/** Minutes between two stamps (b − a), across zones. */
export const minutesBetween = (a: Stamp, b: Stamp) => Math.round((toUtc(b) - toUtc(a)) / MIN);

export function addDays(date: LocalDate, n: number): LocalDate {
  return wallString(wallMs(`${date}T00:00`) + n * DAY).slice(0, 10);
}

/** Whole calendar days from a to b (b − a). */
export const daysBetween = (a: LocalDate, b: LocalDate) => Math.round((wallMs(`${b}T00:00`) - wallMs(`${a}T00:00`)) / DAY);

/** Every date from a to b inclusive. */
export function dateRange(a: LocalDate, b: LocalDate): LocalDate[] {
  const out: LocalDate[] = [];
  for (let d = a; d <= b; d = addDays(d, 1)) out.push(d);
  return out;
}

/** "+1" style day shift of an arrival against its departure, by local calendar date (can be negative). */
export const dayShift = (from: Stamp, to: Stamp) => daysBetween(localDate(from.local), localDate(to.local));

/** Hours difference between two zones at an instant, e.g. Tokyo vs Sydney (+1 in AEST). Minutes precision. */
export const zoneDiffMinutes = (tzA: string, tzB: string, utc: number) => offsetMinutes(tzA, utc) - offsetMinutes(tzB, utc);

export type WallTimeCheck = { kind: 'normal' } | { kind: 'skipped'; usedLocal: LocalDateTime } | { kind: 'repeated' };

/**
 * Whether a wall time is unambiguous in its zone. At a daylight-saving change a time can be skipped (clocks go
 * forward; Satchel reads it as `usedLocal`, the time a clock would show) or happen twice (clocks go back; Satchel
 * uses the first). The item form shows this so the traveller can check it against the ticket.
 */
export function checkWallTime(s: Stamp): WallTimeCheck {
  const w = wallMs(s.local);
  const used = toUtc(s);
  if (wallAt(s.tz, used) !== w) return { kind: 'skipped', usedLocal: fromUtc(used, s.tz) };
  const hits = new Set([offsetMinutes(s.tz, w - DAY), offsetMinutes(s.tz, w + DAY)].map((o) => w - o * MIN).filter((t) => wallAt(s.tz, t) === w));
  return hits.size > 1 ? { kind: 'repeated' } : { kind: 'normal' };
}
