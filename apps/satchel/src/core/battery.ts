// Low-battery essentials mode rules (docs/spec/FLOWS.md §9, EDGE_CASES.md "Low-battery essentials mode").
// Pure TS: the battery reading comes in from src/native/battery.ts; nothing here touches the phone.
// - Offer (never force) essentials when the level is at or below the threshold and the phone isn't charging.
// - "Not now" dismisses the offer for this low episode only; the episode ends when the battery recovers or the
//   phone starts charging, and a later drop offers again.
// - The manual switch shows essentials whatever the battery says, until the user turns it off; automatic offers
//   never change it.
// - An unknown battery level is never guessed: no automatic offer, manual mode still works.
import type { Item, Trip } from './model.ts';
import { isTransport } from './model.ts';
import { primaryTicket } from './tickets.ts';
import { span } from './timeline.ts';

/** Default threshold as a fraction of a full battery (PLAN §3: below 20%). T10 adds a setting for it. */
export const DEFAULT_THRESHOLD = 0.2;
export const MIN_THRESHOLD = 0.05;
export const MAX_THRESHOLD = 0.5;
/** The level must climb this far above the threshold to end a low episode, so 20/21 jitter doesn't re-offer. */
export const RECOVER_MARGIN = 0.02;

export const ESSENTIALS_KEY = 'satchel.essentials.v1';

export type EssentialsPrefs = {
  /** The manual switch: essentials on regardless of battery until turned off. */
  manual: boolean;
  /** Fraction 0..1 at or below which essentials is offered. */
  threshold: number;
};

export const DEFAULT_ESSENTIALS: EssentialsPrefs = { manual: false, threshold: DEFAULT_THRESHOLD };

/** What the phone reported; null wherever it couldn't say (Expo Go web, simulator, a failed call). */
export type BatteryReading = { level: number | null; charging: boolean | null; lowPower: boolean | null };

export const UNKNOWN_READING: BatteryReading = { level: null, charging: null, lowPower: null };

/**
 * A raw level from the battery API as a fraction 0..1, or null when it isn't a real reading.
 * iOS simulators and some devices report -1; anything outside 0..1 or not finite is treated as unknown.
 */
export function normaliseLevel(raw: unknown): number | null {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0 || raw > 1) return null;
  // Phones report a 32-bit float (20% arrives as 0.20000000298...), which would miss the "at or below" check at
  // exactly the threshold while the banner shows 20%. Four decimals keeps sub-percent detail and drops the noise.
  return Math.round(raw * 10_000) / 10_000;
}

/** A threshold kept to a sensible range (5% to 50%); anything unusable falls back to the default. */
export function clampThreshold(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return DEFAULT_THRESHOLD;
  return Math.min(MAX_THRESHOLD, Math.max(MIN_THRESHOLD, raw));
}

/** Stored prefs made safe: unknown fields dropped, wrong types replaced by defaults. */
export function normalisePrefs(raw: unknown): EssentialsPrefs {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return { manual: o.manual === true, threshold: o.threshold === undefined ? DEFAULT_THRESHOLD : clampThreshold(o.threshold) };
}

/** Whole percent for display (0.183 -> 18), or null when the level is unknown. */
export function percent(level: number | null): number | null {
  return level === null ? null : Math.round(level * 100);
}

/** At or below the threshold and not charging. Unknown level is never low; unknown charging counts as not charging. */
export function isLow(r: BatteryReading, threshold: number = DEFAULT_THRESHOLD): boolean {
  if (r.level === null) return false;
  if (r.charging === true) return false;
  return r.level <= clampThreshold(threshold);
}

/** A low episode: from the battery going low until it recovers (or charging starts). Dismissal lives inside it. */
export type Episode = { low: boolean; dismissed: boolean };

export const NO_EPISODE: Episode = { low: false, dismissed: false };

/**
 * Next episode state for a new reading. Entering low starts a fresh episode (not dismissed). Staying low keeps
 * the dismissal. Charging, or climbing above threshold + RECOVER_MARGIN, ends it. An unknown level changes nothing
 * (we never infer one), except that charging still ends the episode.
 */
export function stepEpisode(prev: Episode, r: BatteryReading, threshold: number = DEFAULT_THRESHOLD): Episode {
  const th = clampThreshold(threshold);
  if (r.charging === true) return NO_EPISODE;
  if (r.level === null) return prev;
  if (prev.low) return r.level > th + RECOVER_MARGIN ? NO_EPISODE : prev;
  return r.level <= th ? { low: true, dismissed: false } : NO_EPISODE;
}

/** "Not now": hides the offer for the rest of this low episode. Does nothing outside one. */
export function dismissEpisode(e: Episode): Episode {
  return e.low ? { low: true, dismissed: true } : e;
}

export type BannerState =
  /** Nothing to show. */
  | { kind: 'none' }
  /** Battery low: offer "Open essentials" / "Not now". */
  | { kind: 'offer'; percent: number }
  /** Manual switch on: remind and offer Open / Turn off. */
  | { kind: 'manual' };

/** What the Trips home banner shows. Manual mode wins; otherwise the offer shows in an undismissed low episode. */
export function bannerState(prefs: EssentialsPrefs, e: Episode, r: BatteryReading): BannerState {
  if (prefs.manual) return { kind: 'manual' };
  if (e.low && !e.dismissed && r.level !== null && r.charging !== true) return { kind: 'offer', percent: percent(r.level) ?? 0 };
  return { kind: 'none' };
}

/** Kinds whose ticket the essentials screen shows. Hotels go in the address card; notes have no ticket. */
const TICKET_KINDS = (k: Item['kind']) => isTransport(k) || k === 'activity' || k === 'car';

export type TicketPick = { item: Item; tripId: string; hasTicket: boolean; state: 'now' | 'next' };

/**
 * The ticket for the essentials screen: the transport / activity / car booking happening now or next. One with a
 * saved ticket file beats one without when both are equally soon; a booking with no file only counts for
 * transport (its reference, seat and times still help at the gate). Null when nothing is coming up.
 */
export function nextTicket(trips: Trip[], now: number): TicketPick | null {
  const cands: { item: Item; tripId: string; start: number; end: number; hasTicket: boolean }[] = [];
  for (const trip of trips) {
    for (const item of trip.items) {
      if (!TICKET_KINDS(item.kind)) continue;
      const hasTicket = primaryTicket(item) !== null;
      if (!hasTicket && !isTransport(item.kind)) continue;
      const s = span(item);
      if (s.end < now || (s.end === s.start && s.start < now)) continue;
      cands.push({ item, tripId: trip.id, start: s.start, end: s.end, hasTicket });
    }
  }
  if (!cands.length) return null;
  cands.sort((a, b) => a.start - b.start || Number(b.hasTicket) - Number(a.hasTicket) || a.end - b.end || (a.item.id < b.item.id ? -1 : a.item.id > b.item.id ? 1 : 0));
  const c = cands[0];
  return { item: c.item, tripId: c.tripId, hasTicket: c.hasTicket, state: c.start <= now ? 'now' : 'next' };
}

export type HotelPick = { item: Item; tripId: string; hasAddress: boolean; state: 'now' | 'next' };

/**
 * The hotel for the address card: the stay you're in now (check-in passed, check-out not yet), else the next one.
 * A hotel with no check-out has no known stay, so it can only count as "next" (before its check-in).
 */
export function currentHotel(trips: Trip[], now: number): HotelPick | null {
  let cur: HotelPick | null = null;
  let curStart = -Infinity;
  let next: HotelPick | null = null;
  let nextStart = Infinity;
  for (const trip of trips) {
    for (const item of trip.items) {
      if (item.kind !== 'hotel') continue;
      const s = span(item);
      const hasAddress = !!(item.place?.address?.trim() || item.place?.localAddress?.trim());
      if (s.start <= now && s.end > now) {
        // Overlapping stays: the most recent check-in is where you're sleeping tonight.
        if (s.start > curStart) {
          cur = { item, tripId: trip.id, hasAddress, state: 'now' };
          curStart = s.start;
        }
      } else if (s.start > now && s.start < nextStart) {
        next = { item, tripId: trip.id, hasAddress, state: 'next' };
        nextStart = s.start;
      }
    }
  }
  return cur ?? next;
}

/** The trip a "add a booking" prompt should open: the one on now, else the next, else none. */
export function setupTrip(trips: Trip[], today: string): Trip | null {
  const live = trips.filter((t) => t.endDate >= today).sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0));
  return live[0] ?? null;
}
