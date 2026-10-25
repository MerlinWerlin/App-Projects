// Display helpers that work offline and on Hermes (only Intl.DateTimeFormat, which Hermes has).
import type { LocalDate, LocalDateTime } from './model.ts';
import { wallMs } from './tz.ts';

/** "Tokyo" from "Asia/Tokyo", "Ho Chi Minh" from "Asia/Ho_Chi_Minh", "UTC" stays. */
export function zoneCity(tz: string): string {
  const last = tz.split('/').pop() ?? tz;
  return last.replace(/_/g, ' ');
}

const dateFmts = new Map<string, Intl.DateTimeFormat>();
function dateFmt(lang: string, opts: Intl.DateTimeFormatOptions, key: string): Intl.DateTimeFormat {
  const k = `${lang}|${key}`;
  let f = dateFmts.get(k);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat(lang, { ...opts, timeZone: 'UTC' });
    } catch {
      f = new Intl.DateTimeFormat('en', { ...opts, timeZone: 'UTC' });
    }
    dateFmts.set(k, f);
  }
  return f;
}

/** "Tue 3 Nov" style day label for a local date (the wall date, not shifted by the phone's zone). */
export const formatDay = (date: LocalDate, lang = 'en') =>
  dateFmt(lang, { weekday: 'short', day: 'numeric', month: 'short' }, 'day').format(new Date(wallMs(`${date}T00:00`)));

/** "3 Nov – 11 Nov" for a trip. */
export const formatRange = (a: LocalDate, b: LocalDate, lang = 'en') => {
  const f = dateFmt(lang, { day: 'numeric', month: 'short' }, 'range');
  return `${f.format(new Date(wallMs(`${a}T00:00`)))} – ${f.format(new Date(wallMs(`${b}T00:00`)))}`;
};

/** "09:30" — 24-hour wall clock, as printed on tickets. */
export const formatTime = (local: LocalDateTime) => local.slice(11, 16);

/** "2h 05m" for minutes; "45m" under an hour; "1d 3h" over a day. */
export function formatDuration(min: number): string {
  const m = Math.max(0, Math.round(min));
  if (m < 60) return `${m}m`;
  if (m < 24 * 60) return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
  return `${Math.floor(m / 1440)}d ${Math.floor((m % 1440) / 60)}h`;
}

/** Today's date in a zone (defaults to the phone's). */
export function todayIn(tz?: string, now = Date.now()): LocalDate {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
  const p: Record<string, string> = {};
  for (const x of f.formatToParts(new Date(now))) p[x.type] = x.value;
  return `${p.year}-${p.month}-${p.day}`;
}

/** The phone's IANA zone, or UTC if unknown. */
export function deviceZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}
