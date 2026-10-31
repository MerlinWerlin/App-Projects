// T80 run-89 follow-ups, the pure parts: the remembered day/month order and the "Saved" marks for Paste a booking,
// the remembered weather stop per trip, and which "Nearest toilet" request the Toilets tab should still run.
// Everything here reads stored values defensively (anything unreadable falls back to the default).
import type { ItemKind } from './model.ts';

// ---------------------------------------------------------------------------------------------- paste: date order

export const PASTE_DATE_ORDER_KEY = 'satchel.paste.dateOrder.v1';
export type DateOrder = 'dayFirst' | 'monthFirst';
export const DEFAULT_DATE_ORDER: DateOrder = 'dayFirst';

/** The stored day/month choice; day first unless month first was chosen. */
export const parseDateOrder = (raw: unknown): DateOrder => (raw === 'monthFirst' ? 'monthFirst' : 'dayFirst');

// ------------------------------------------------------------------------------------------- paste: saved cards

export const PASTE_SAVED_KEY = 'satchel.paste.saved.v1';
/** How many saved pastes are remembered (oldest dropped first). */
export const PASTE_SAVED_KEEP = 60;

export type SavedPaste = { fp: string; tripId: string; itemId: string; at: number };

type Fingerprintable = {
  kind: ItemKind;
  draft: { title: string; startDate: string; startTime: string; fromName: string; toName: string; placeName: string; number: string; ref: string };
};

const norm = (s: string | undefined) => (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * What identifies a pasted card as found in the text (before any edits in the form): kind, start, number, reference,
 * places and title. The same paste read again gives the same fingerprint; a different booking a different one.
 */
export function pasteFingerprint(b: Fingerprintable): string {
  const d = b.draft;
  return [b.kind, d.startDate, d.startTime, d.number, d.ref, d.fromName, d.toName, d.placeName, d.title].map(norm).join('|');
}

/** Stored saved-paste list, keeping only well-formed entries. */
export function parseSavedPastes(raw: unknown): SavedPaste[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (x): x is SavedPaste =>
      !!x && typeof x === 'object' && typeof x.fp === 'string' && !!x.fp && typeof x.tripId === 'string' && typeof x.itemId === 'string' && typeof x.at === 'number',
  );
}

/** The list with this save recorded (newest first, one entry per fingerprint and trip, at most PASTE_SAVED_KEEP). */
export function recordPasteSaved(raw: unknown, entry: SavedPaste): SavedPaste[] {
  const rest = parseSavedPastes(raw).filter((x) => !(x.fp === entry.fp && x.tripId === entry.tripId));
  return [entry, ...rest].slice(0, PASTE_SAVED_KEEP);
}

/**
 * Whether this card was already saved into this trip from Paste a booking, and the booking is still there (a
 * booking deleted since then no longer counts, so the card can be saved again normally).
 */
export function pasteSavedIn(list: readonly SavedPaste[], fp: string, trip: { id: string; items: readonly { id: string }[] } | undefined): boolean {
  if (!trip) return false;
  return list.some((x) => x.fp === fp && x.tripId === trip.id && trip.items.some((it) => it.id === x.itemId));
}

// --------------------------------------------------------------------------------------- weather: stop per trip

export const WEATHER_STOP_KEY = 'satchel.weather.stop.v1';
/** How many trips' stop choices are remembered (least recently chosen dropped first). */
export const WEATHER_STOP_KEEP = 60;

const picks = (raw: unknown): Record<string, string> => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) if (typeof v === 'string' && v) out[k] = v;
  return out;
};

/** The stop key chosen for this trip, or null. */
export function weatherStopFor(raw: unknown, tripId: string): string | null {
  return picks(raw)[tripId] ?? null;
}

/** The stored choices with this trip's stop set (moved to the newest place; oldest dropped beyond the cap). */
export function withWeatherStop(raw: unknown, tripId: string, key: string): Record<string, string> {
  const cur = picks(raw);
  delete cur[tripId];
  const entries = [...Object.entries(cur), [tripId, key] as [string, string]];
  return Object.fromEntries(entries.slice(-WEATHER_STOP_KEEP));
}

/** The remembered stop when it is still one of the trip's stops, else null (the card falls back to its default). */
export function validStop(picked: string | null, stops: readonly { key: string }[]): string | null {
  return picked && stops.some((s) => s.key === picked) ? picked : null;
}

// ------------------------------------------------------------------------------------------ toilets: find nonce

/**
 * Which "Nearest toilet" request to run now: the first nonce not handled yet, from the in-memory request (works when
 * the Toilets tab is already open) or the route param. Nothing while a search is busy (it runs once that ends).
 */
export function nextFindNonce(candidates: readonly (string | null | undefined)[], handled: ReadonlySet<string>, busy: boolean): string | null {
  if (busy) return null;
  for (const c of candidates) if (typeof c === 'string' && c && !handled.has(c)) return c;
  return null;
}
