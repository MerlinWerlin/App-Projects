// Local drawing progress for Home (T69, docs/MARKET.md §2.4/§5): how many tracing sessions, how long, and a calm
// day streak. Pure: src/native/progress.ts stores it in AsyncStorage. Nothing leaves the phone.

export type Progress = {
  /** Trace sessions long enough to count (≥ MIN_SESSION_MS). */
  sessions: number;
  /** Total traced time in milliseconds (each session capped at MAX_SESSION_MS). */
  tracedMs: number;
  /** Local days with at least one session, 'YYYY-MM-DD', ascending, unique, at most DAYS_CAP. */
  days: string[];
};

/** `sessions` counts trace sessions, not saved drawings (My drawings counts those; T80). */
export type ProgressSummary = { sessions: number; minutes: number; streak: number };

export const MIN_SESSION_MS = 20_000;
export const MAX_SESSION_MS = 3 * 60 * 60 * 1000;
export const DAYS_CAP = 400;

export const EMPTY_PROGRESS: Progress = { sessions: 0, tracedMs: 0, days: [] };

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Local calendar day of a date as 'YYYY-MM-DD'. */
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseDay(key: string): Date | null {
  const m = DAY_RE.exec(key);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const date = new Date(y, mo - 1, d, 12);
  // Rejects impossible days such as 2026-02-31 (which Date would roll over).
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return date;
}

/** The local day before a 'YYYY-MM-DD' key (noon-anchored, so DST changes never skip or repeat a day). */
export function previousDay(key: string): string | null {
  const date = parseDay(key);
  if (!date) return null;
  return dayKey(new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1, 12));
}

function normaliseDays(days: readonly string[]): string[] {
  const unique = Array.from(new Set(days.filter((d) => parseDay(d) !== null))).sort();
  return unique.length > DAYS_CAP ? unique.slice(unique.length - DAYS_CAP) : unique;
}

/**
 * Adds one trace session (focus → blur of the Trace screen). Sessions shorter than 20 s are ignored (a peek, not a
 * drawing); one session counts at most 3 h (a phone left on the stand). The end is clamped to `now` so a wrong clock
 * cannot add time from the future. Returns the same object when nothing changes.
 */
export function recordSession(state: Progress, startMs: number, endMs: number, now: number): Progress {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || !Number.isFinite(now)) return state;
  const end = Math.min(endMs, now);
  const length = end - startMs;
  if (!(length >= MIN_SESSION_MS)) return state;
  const counted = Math.min(length, MAX_SESSION_MS);
  return {
    sessions: state.sessions + 1,
    tracedMs: state.tracedMs + counted,
    days: normaliseDays([...state.days, dayKey(new Date(end))]),
  };
}

/** Consecutive days with a session, ending today, or yesterday if nothing yet today. 0 when the run is broken. */
export function currentStreak(state: Progress, todayKey: string): number {
  const set = new Set(state.days);
  let cursor: string | null = todayKey;
  if (!set.has(todayKey)) cursor = previousDay(todayKey);
  let streak = 0;
  while (cursor && set.has(cursor)) {
    streak += 1;
    cursor = previousDay(cursor);
  }
  return streak;
}

/** Numbers for the Home card: trace sessions, whole minutes traced, current streak in days. */
export function summary(state: Progress, todayKey: string): ProgressSummary {
  return {
    sessions: state.sessions,
    minutes: Math.floor(state.tracedMs / 60_000),
    streak: currentStreak(state, todayKey),
  };
}

function count(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
}

/** Stored JSON (any shape) → valid Progress; bad fields fall back to zero / empty. */
export function sanitizeProgress(raw: unknown): Progress {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_PROGRESS, days: [] };
  const r = raw as Record<string, unknown>;
  const days = Array.isArray(r.days) ? r.days.filter((d): d is string => typeof d === 'string') : [];
  return { sessions: count(r.sessions), tracedMs: count(r.tracedMs), days: normaliseDays(days) };
}

/** Stored text → Progress; null, empty or broken JSON gives empty progress. */
export function parseProgress(text: string | null | undefined): Progress {
  if (!text) return sanitizeProgress(null);
  try {
    return sanitizeProgress(JSON.parse(text));
  } catch {
    return sanitizeProgress(null);
  }
}
