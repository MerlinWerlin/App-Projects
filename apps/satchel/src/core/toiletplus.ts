// Toilet finder, deeper (T79). Pure logic for the Toilets tab: filter chips with counts (Free, Wheelchair,
// Changing table, Open now, Unisex), the open/closed line per row from opening_hours (src/core/openinghours.ts),
// "My toilets" (a star, a private note and thumbs up/down, stored on the phone only), saved toilets near the search
// point pinned to the top, and the "Recently used" list (last 10 opened in Apple Maps). No React Native imports.
import { hoursStatusAt, type HoursStatus } from './openinghours.ts';
import { haversineMeters, type LatLon } from './poi.ts';
import { isAlwaysOpen, nearestToilets, type Toilet, type ToiletHit } from './toilets.ts';

// ------------------------------------------------------------------------------------------------------ filters

export const FILTERS = ['free', 'wheelchair', 'changingTable', 'openNow', 'unisex'] as const;
export type FilterId = (typeof FILTERS)[number];

const isYes = (v: string | undefined) => !!v && ['yes', 'designated', 'true', '1'].includes(v.trim().toLowerCase());

export const isFree = (t: Pick<Toilet, 'fee'>) => ['no', 'free'].includes(t.fee?.trim().toLowerCase() ?? '');
export const hasWheelchair = (t: Pick<Toilet, 'wheelchair'>) => isYes(t.wheelchair);
export const hasChangingTable = (t: Pick<Toilet, 'changing_table'>) => isYes(t.changing_table) || t.changing_table?.trim().toLowerCase() === 'limited';
export const isUnisex = (t: Pick<Toilet, 'unisex'>) => isYes(t.unisex);

/** A row with its open/closed status worked out once. */
export type Row = { hit: ToiletHit; status: HoursStatus };

/** Does the row pass one chip? 'Open now' only drops places known to be closed; unknown hours stay. */
export function passes(r: Row, f: FilterId): boolean {
  switch (f) {
    case 'free':
      return isFree(r.hit);
    case 'wheelchair':
      return hasWheelchair(r.hit);
    case 'changingTable':
      return hasChangingTable(r.hit);
    case 'unisex':
      return isUnisex(r.hit);
    case 'openNow':
      return r.status.state !== 'closed';
  }
}

export function applyFilters<R extends Row>(rows: readonly R[], active: readonly FilterId[]): R[] {
  return rows.filter((r) => active.every((f) => passes(r, f)));
}

/**
 * How many rows each chip would show: the other active chips plus this one (so an active chip's count is what's on
 * screen, and an inactive chip says what turning it on would leave).
 */
export function filterCounts(rows: readonly Row[], active: readonly FilterId[]): Record<FilterId, number> {
  const out = {} as Record<FilterId, number>;
  for (const f of FILTERS) {
    const set = active.includes(f) ? active : [...active, f];
    out[f] = applyFilters(rows, set).length;
  }
  return out;
}

export function toggleFilter(active: readonly FilterId[], f: FilterId): FilterId[] {
  const on = active.includes(f) ? active.filter((x) => x !== f) : [...active, f];
  return FILTERS.filter((x) => on.includes(x));
}

/** Stored filter list -> valid ids in display order (anything else dropped). */
export function parseFilters(raw: unknown): FilterId[] {
  if (!Array.isArray(raw)) return [];
  return FILTERS.filter((f) => raw.includes(f));
}

// ------------------------------------------------------------------------------------------------ hours per row

/** Open/closed for a toilet now, in the zone of the place searched. 24/7 shortcuts to open. */
export function statusFor(t: Pick<Toilet, 'opening_hours'>, utc: number, tz: string): HoursStatus {
  if (isAlwaysOpen(t.opening_hours)) return { state: 'open' };
  return hoursStatusAt(t.opening_hours, utc, tz);
}

/** Which line a row shows under its name: a string key and its values, or null when hours are unknown. */
export type HoursLine =
  | { key: 'toiletplus.hours.open'; vars: Record<string, never> }
  | { key: 'toiletplus.hours.openCloses' | 'toiletplus.hours.openClosesTomorrow'; vars: { time: string } }
  | { key: 'toiletplus.hours.closed'; vars: Record<string, never> }
  | { key: 'toiletplus.hours.closedOpens' | 'toiletplus.hours.closedOpensTomorrow'; vars: { time: string } }
  | { key: 'toiletplus.hours.closedOpensDay'; vars: { time: string; day: DayKey } };

export type DayKey = `toiletplus.day.${0 | 1 | 2 | 3 | 4 | 5 | 6}`;

/**
 * The line for a status. `weekdayToday` is 0 = Monday ... 6 = Sunday at the place (for "opens Mon 09:00").
 * Closing after midnight tonight reads "closes 02:00" when it's the small hours (still the same night), and
 * "closes tomorrow" only when it's a day or more away.
 */
export function hoursLine(s: HoursStatus, weekdayToday: number): HoursLine | null {
  if (s.state === 'unknown') return null;
  if (s.state === 'open') {
    if (!s.closesAt) return { key: 'toiletplus.hours.open', vars: {} };
    const days = s.closesInDays ?? 0;
    if (days <= 0 || (days === 1 && s.closesAt <= '06:00')) return { key: 'toiletplus.hours.openCloses', vars: { time: s.closesAt } };
    return { key: 'toiletplus.hours.openClosesTomorrow', vars: { time: s.closesAt } };
  }
  if (!s.opensAt) return { key: 'toiletplus.hours.closed', vars: {} };
  const days = s.opensInDays ?? 0;
  if (days <= 0) return { key: 'toiletplus.hours.closedOpens', vars: { time: s.opensAt } };
  if (days === 1) return { key: 'toiletplus.hours.closedOpensTomorrow', vars: { time: s.opensAt } };
  const d = (((weekdayToday + days) % 7) + 7) % 7;
  return { key: 'toiletplus.hours.closedOpensDay', vars: { time: s.opensAt, day: `toiletplus.day.${d as 0 | 1 | 2 | 3 | 4 | 5 | 6}` } };
}

/** 0 = Monday ... 6 = Sunday for a 'YYYY-MM-DD...' wall date. */
export function weekdayOf(local: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(local);
  if (!m) return 0;
  return (new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay() + 6) % 7;
}

// -------------------------------------------------------------------------------------------------- my toilets

export type Vote = 'up' | 'down' | null;
export type SavedToilet = { toilet: Toilet; note: string; vote: Vote; savedAt: number };
export type RecentToilet = { toilet: Toilet; at: number };

export const NOTE_MAX = 280;
export const RECENT_MAX = 10;
export const SAVED_MAX = 200;
/** Saved toilets within this distance of the search point are pinned to the top. */
export const PIN_RADIUS_M = 2500;

const validToilet = (v: unknown): Toilet | null => {
  if (!v || typeof v !== 'object') return null;
  const r = v as Record<string, unknown>;
  if (typeof r.id !== 'string' || !r.id || typeof r.lat !== 'number' || typeof r.lon !== 'number') return null;
  if (!Number.isFinite(r.lat) || !Number.isFinite(r.lon) || Math.abs(r.lat) > 90 || Math.abs(r.lon) > 180) return null;
  const t: Toilet = { id: r.id, lat: r.lat, lon: r.lon };
  for (const k of ['name', 'fee', 'wheelchair', 'changing_table', 'opening_hours', 'access', 'unisex', 'operator'] as const) {
    if (typeof r[k] === 'string' && (r[k] as string).trim()) t[k] = (r[k] as string).trim();
  }
  return t;
};

/** Just the toilet fields (drops distance etc. from a hit) so storage stays small and stable. */
export function plainToilet(t: Toilet): Toilet {
  return validToilet(t) ?? { id: t.id, lat: t.lat, lon: t.lon };
}

export const cleanNote = (s: string) => s.replace(/\s+$/g, '').slice(0, NOTE_MAX);

export function parseSaved(raw: unknown): SavedToilet[] {
  if (!Array.isArray(raw)) return [];
  const out: SavedToilet[] = [];
  const seen = new Set<string>();
  for (const v of raw) {
    if (!v || typeof v !== 'object') continue;
    const r = v as Record<string, unknown>;
    const toilet = validToilet(r.toilet);
    if (!toilet || seen.has(toilet.id)) continue;
    seen.add(toilet.id);
    out.push({
      toilet,
      note: typeof r.note === 'string' ? cleanNote(r.note) : '',
      vote: r.vote === 'up' || r.vote === 'down' ? r.vote : null,
      savedAt: typeof r.savedAt === 'number' && Number.isFinite(r.savedAt) ? r.savedAt : 0,
    });
  }
  return out.slice(0, SAVED_MAX);
}

export function parseRecent(raw: unknown): RecentToilet[] {
  if (!Array.isArray(raw)) return [];
  const out: RecentToilet[] = [];
  const seen = new Set<string>();
  for (const v of raw) {
    if (!v || typeof v !== 'object') continue;
    const r = v as Record<string, unknown>;
    const toilet = validToilet(r.toilet);
    if (!toilet || seen.has(toilet.id) || typeof r.at !== 'number' || !Number.isFinite(r.at)) continue;
    seen.add(toilet.id);
    out.push({ toilet, at: r.at });
  }
  return out.sort((a, b) => b.at - a.at).slice(0, RECENT_MAX);
}

export const isSaved = (saved: readonly SavedToilet[], id: string) => saved.some((s) => s.toilet.id === id);
export const savedOf = (saved: readonly SavedToilet[], id: string) => saved.find((s) => s.toilet.id === id) ?? null;

/** Star on/off. Newest first; capped at SAVED_MAX. */
export function toggleSaved(saved: readonly SavedToilet[], t: Toilet, now: number): SavedToilet[] {
  if (isSaved(saved, t.id)) return saved.filter((s) => s.toilet.id !== t.id);
  return [{ toilet: plainToilet(t), note: '', vote: null, savedAt: now }, ...saved].slice(0, SAVED_MAX);
}

export function setNote(saved: readonly SavedToilet[], id: string, note: string): SavedToilet[] {
  return saved.map((s) => (s.toilet.id === id ? { ...s, note: cleanNote(note) } : s));
}

/** Tapping the vote you already gave clears it. */
export function setVote(saved: readonly SavedToilet[], id: string, vote: 'up' | 'down'): SavedToilet[] {
  return saved.map((s) => (s.toilet.id === id ? { ...s, vote: s.vote === vote ? null : vote } : s));
}

/** Opened in Apple Maps: to the front, deduped, last RECENT_MAX kept. */
export function pushRecent(recent: readonly RecentToilet[], t: Toilet, now: number): RecentToilet[] {
  return [{ toilet: plainToilet(t), at: now }, ...recent.filter((r) => r.toilet.id !== t.id)].slice(0, RECENT_MAX);
}

// ------------------------------------------------------------------------------------------------- arrangement

export type Arranged = ToiletHit & { pinned: boolean };

/**
 * Results with saved toilets near the search point first (nearest first among them, including saved ones the
 * search didn't return), then the rest nearest first. Thumbs-down saved toilets aren't pinned.
 */
export function arrange(hits: readonly ToiletHit[], saved: readonly SavedToilet[], from: LatLon, radius = PIN_RADIUS_M): Arranged[] {
  const pinIds = new Set(saved.filter((s) => s.vote !== 'down' && haversineMeters(from, s.toilet) <= radius).map((s) => s.toilet.id));
  const byId = new Map(hits.map((h) => [h.id, h]));
  const extra = saved.filter((s) => pinIds.has(s.toilet.id) && !byId.has(s.toilet.id)).map((s) => s.toilet);
  const pinned = [...hits.filter((h) => pinIds.has(h.id)), ...nearestToilets(extra, from, extra.length)].sort((a, b) => a.meters - b.meters);
  return [...pinned.map((h) => ({ ...h, pinned: true })), ...hits.filter((h) => !pinIds.has(h.id)).map((h) => ({ ...h, pinned: false }))];
}
