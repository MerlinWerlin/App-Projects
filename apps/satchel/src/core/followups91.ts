// T88 run-91 follow-ups (the offline parts). Pure TypeScript, no React Native or Expo imports.
//   sample journal   a few labelled sample pages on the demo trip (notes, moods, weather chips; no photos) so Trip
//                    recap has moods and a best day on the sample trip. Fresh demo seeds get them; a demo trip
//                    already on a phone gets them once (a one-time flag, DEMO_JOURNAL_KEY) and only while its
//                    journal is empty, so the traveller's own pages are never touched and nothing is duplicated.
//   recap preview    the demo trip's recap opens before its dates as a preview of the whole sample trip
//                    (recapToday), so the sample shows what a recap looks like; real trips keep the honest
//                    "opens when the trip starts" state.
//   Trips tab card   the trip the Trips tab's recap card opens: the latest finished real trip, else the demo trip
//                    when there is no finished real trip (latestRecapTrip).
//   essentials       membership cards in Low-battery essentials, in the Wallet's order (essentialsCards).
//   card photo       an optional photo on a loyalty card, copied into Satchel's own folder; which file to remove
//                    when a photo is replaced, removed or its card deleted (stalePhoto, cardPhotoFiles).
import { DEMO_TRIP_ID } from './demoExtras.ts';
import type { JournalEntry, JournalMood, JournalWeather } from './journal.ts';
import { displayNumber, sortCards, type LoyaltyCard } from './loyalty.ts';
import type { LocalDate, Trip } from './model.ts';
import { isDemoTrip, tripSpan } from './travelstats.ts';
import { addDays } from './tz.ts';

// ---------------------------------------------------------------- sample journal

/** Set once the one-time sample-journal pass has run on this phone (AsyncStorage). */
export const DEMO_JOURNAL_KEY = 'satchel.demoJournal.v1';

/** Sample pages: day offset from the trip start, mood, weather and an obviously sample note. */
const SAMPLE_PAGES: readonly { id: string; day: number; mood: JournalMood; weather: JournalWeather; note: string }[] = [
  { id: 'demo-j1', day: 0, mood: 'tired', weather: 'cloudy', note: 'Sample page: long flight, straight to the hotel and an early night.' },
  { id: 'demo-j2', day: 1, mood: 'joyful', weather: 'sunny', note: 'Sample page: breakfast at the fish market, then a slow walk along the river.' },
  { id: 'demo-j3', day: 2, mood: 'adventurous', weather: 'partly', note: 'Sample page: got lost in the backstreets and found a tiny ramen bar.' },
  { id: 'demo-j4', day: 4, mood: 'relaxed', weather: 'rain', note: 'Sample page: rainy train ride to Kyoto, tea and a nap at the inn.' },
  { id: 'demo-j5', day: 5, mood: 'joyful', weather: 'sunny', note: 'Sample page: up through the shrine gates early, almost nobody there.' },
  { id: 'demo-j6', day: 5, mood: 'grateful', weather: 'sunny', note: 'Sample page: market snacks for dinner and a long talk on the way back.' },
  { id: 'demo-j7', day: 7, mood: 'grateful', weather: 'partly', note: 'Sample page: last morning in Gion, one more coffee before the airport.' },
];

export const SAMPLE_JOURNAL_IDS: readonly string[] = SAMPLE_PAGES.map((p) => p.id);
export const isSampleJournalEntry = (e: Pick<JournalEntry, 'id'>): boolean => SAMPLE_JOURNAL_IDS.includes(e.id);

/** The sample pages dated from `start` (the trip's first day). */
export function sampleJournal(start: LocalDate, now = new Date().toISOString()): JournalEntry[] {
  return SAMPLE_PAGES.map((p) => ({ id: p.id, day: addDays(start, p.day), note: p.note, photos: [], mood: p.mood, weather: p.weather, createdAt: now }));
}

/**
 * The demo trip with the sample pages. Any other trip, or a demo trip that already has pages (the traveller's own
 * or an earlier seed), is returned unchanged (the same object).
 */
export function withSampleJournal(trip: Trip, now = new Date().toISOString()): Trip {
  if (trip.id !== DEMO_TRIP_ID || !trip.demo) return trip;
  if (Array.isArray(trip.journal) && trip.journal.length > 0) return trip;
  return { ...trip, journal: sampleJournal(trip.startDate, now) };
}

/**
 * The one-time pass for phones that already have the demo trip: the list with sample pages added where
 * withSampleJournal adds them, or the same list when nothing changed. Run only while DEMO_JOURNAL_KEY is unset.
 */
export function seedSampleJournal(trips: Trip[], now = new Date().toISOString()): Trip[] {
  let changed = false;
  const next = trips.map((t) => {
    const n = withSampleJournal(t, now);
    if (n !== t) changed = true;
    return n;
  });
  return changed ? next : trips;
}

// ---------------------------------------------------------------- recap

/**
 * The "today" a trip's recap is worked out for. A demo trip that hasn't started is shown as a preview of the whole
 * sample trip (the day after it ends, so it reads as a finished trip); every other trip uses the real today.
 */
export function recapToday(trip: Trip, today: LocalDate): LocalDate {
  if (!isDemoTrip(trip)) return today;
  const s = tripSpan(trip);
  return today < s.start ? addDays(s.end, 1) : today;
}

/** True when the recap is the demo trip's preview (see recapToday). */
export const isRecapPreview = (trip: Trip, today: LocalDate): boolean => isDemoTrip(trip) && today < tripSpan(trip).start;

/**
 * The trip the Trips tab's recap card opens: the real trip that finished most recently (latest end, then latest
 * start, then id), or, when no real trip has finished, a demo trip (whose recap is always there: a preview before
 * its dates). Null when there is neither.
 */
export function latestRecapTrip(trips: readonly Trip[], today: LocalDate): Trip | null {
  let best: { trip: Trip; start: LocalDate; end: LocalDate } | null = null;
  for (const trip of trips) {
    if (isDemoTrip(trip)) continue;
    const s = tripSpan(trip);
    if (s.end >= today) continue;
    if (!best || s.end > best.end || (s.end === best.end && (s.start > best.start || (s.start === best.start && trip.id < best.trip.id)))) best = { trip, ...s };
  }
  if (best) return best.trip;
  return trips.find((t) => isDemoTrip(t)) ?? null;
}

// ---------------------------------------------------------------- essentials

export type EssentialsCard = { id: string; programme: string; tier?: string; number: string; hasPhoto: boolean };

/** Membership cards for Low-battery essentials: every card (expired ones too: still scannable), Wallet order. */
export function essentialsCards(cards: readonly LoyaltyCard[]): EssentialsCard[] {
  return sortCards(cards).map((c) => ({ id: c.id, programme: c.programme, ...(c.tier ? { tier: c.tier } : {}), number: displayNumber(c.number), hasPhoto: !!c.photo }));
}

// ---------------------------------------------------------------- card photo

/** The photo file a save leaves behind (replaced or removed), to delete once the save is stored; else null. */
export function stalePhoto(prev: Pick<LoyaltyCard, 'photo'> | undefined, next: Pick<LoyaltyCard, 'photo'> | undefined): string | null {
  const old = prev?.photo;
  return old && old !== next?.photo ? old : null;
}

/** Photos picked in the editor that the saved card doesn't keep (picked, then replaced, removed or not saved). */
export function unusedPicks(picked: readonly string[], kept: string | undefined): string[] {
  return [...new Set(picked)].filter((u) => u !== kept);
}

/** Every photo file the given cards hold (for clean-up when cards go). */
export const cardPhotoFiles = (cards: readonly Pick<LoyaltyCard, 'photo'>[]): string[] => cards.flatMap((c) => (c.photo ? [c.photo] : []));
