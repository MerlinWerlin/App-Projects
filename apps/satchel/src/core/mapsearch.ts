// Search on the Map (T94, owner-1031 D). One offline search box over everything Satchel already holds: bookings
// and their places, places-to-go ideas, saved places, dropped pins (Find my way back), toilets kept on the phone
// (saved / recently used, and those in downloaded city packs), downloaded city POIs and the bundled demo points.
// Matching is case- and accent-insensitive (Japanese kana and kanji pass through unchanged); ranking is
// prefix > word start > anywhere in the name > other words (kind, category, trip, address), then nearer first when a
// position is known. Recent searches are kept on the phone only (the UI stores them through AsyncStorage) and can
// be cleared. Pure TypeScript, no React Native imports, no network.
import { bookingPins, distanceParts, validLatLon, type LatLon, type Poi } from './poi.ts';
import { readIdeas, ideaSpot } from './ideas.ts';
import type { ItemKind, Trip } from './model.ts';
import { savedPins } from './places.ts';
import type { Toilet } from './toilets.ts';
import { cardinal, distanceTo, initialBearing, walkTime, type Compass16, type WaybackPin } from './wayback.ts';

// ----------------------------------------------------------------------------------------------- normalisation

const FOLD: Record<string, string> = { ß: 'ss', æ: 'ae', œ: 'oe', ø: 'o', đ: 'd', ð: 'd', ł: 'l', þ: 'th', ı: 'i', ħ: 'h' };

/**
 * Lower case, Latin accents removed ("Café Señor" -> "cafe senor"), full-width letters and digits made plain,
 * apostrophes dropped, other punctuation and spaces collapsed to one space. Kana and kanji pass through as they are
 * (the voiced marks on kana are kept: が stays が; half-width katakana become full width).
 */
export function normalize(s: string): string {
  let out = String(s ?? '').toLowerCase();
  try {
    out = out.normalize('NFKD').replace(/[̀-ͯ]/g, '').normalize('NFC');
  } catch {
    // engine without String.prototype.normalize: accents stay, plain-letter searches still work
  }
  return out
    .replace(/[ßæœøđðłþıħ]/g, (c) => FOLD[c] ?? c)
    .replace(/['’`]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

// ------------------------------------------------------------------------------------------------------ entries

/** What a result is. Order is also the tie-break when two results rank the same at the same distance. */
export const SEARCH_KINDS = ['booking', 'saved', 'idea', 'pin', 'toilet', 'place', 'sample'] as const;
export type SearchKind = (typeof SEARCH_KINDS)[number];

export type SearchEntry = LatLon & {
  /** Unique across all kinds, e.g. 'booking:<itemId>:place'. */
  key: string;
  kind: SearchKind;
  name: string;
  /** Second line in the result (trip name, category...), already translated by the caller. */
  detail?: string;
  /** Other words that also find it (kind word, category, address, booking title). Ranked below name matches. */
  terms?: string[];
  /** The data comes from OpenStreetMap (the UI shows the attribution). */
  osm?: boolean;
  /** Bundled sample point or a place saved from one: not a real place. */
  sample?: boolean;
  /** Booking item id, for "Open booking". */
  itemId?: string;
};

/** Labels the caller translates: the word for each kind and a category label. */
export type Labels = {
  kind: (k: SearchKind) => string;
  category: (id: string) => string;
  ideaCategory: (id: string) => string;
  bookingKind: (k: ItemKind) => string;
  pin: (p: WaybackPin) => string;
};

const words = (...xs: (string | undefined | null)[]) => xs.filter((x): x is string => typeof x === 'string' && x.trim() !== '');

/** Every located place on a booking (place, from, to), one per spot and name per trip. */
export function bookingEntries(trips: readonly Trip[], l: Labels): SearchEntry[] {
  const items = new Map(trips.flatMap((t) => t.items.map((i) => [i.id, { item: i, trip: t }] as const)));
  return bookingPins(trips).map((b) => {
    const found = items.get(b.itemId);
    const role = b.id.slice(b.id.lastIndexOf(':') + 1);
    const place = role === 'from' ? found?.item.from : role === 'to' ? found?.item.to : found?.item.place;
    return {
      key: `booking:${b.id}`,
      kind: 'booking' as const,
      name: b.name || b.title,
      detail: words(l.bookingKind(b.kind), found?.trip.name).join(' · '),
      terms: words(l.kind('booking'), l.bookingKind(b.kind), b.title, place?.address, place?.localAddress, found?.trip.name),
      lat: b.lat,
      lon: b.lon,
      itemId: b.itemId,
    };
  });
}

/** Places-to-go ideas that have a map spot. */
export function ideaEntries(trips: readonly Trip[], l: Labels): SearchEntry[] {
  const out: SearchEntry[] = [];
  for (const trip of trips) {
    for (const idea of readIdeas(trip)) {
      const at = ideaSpot(idea);
      if (!at) continue;
      out.push({
        key: `idea:${trip.id}:${idea.id}`,
        kind: 'idea',
        name: idea.name,
        detail: words(l.ideaCategory(idea.category), trip.name).join(' · '),
        terms: words(l.kind('idea'), l.ideaCategory(idea.category), idea.spotName, trip.name),
        ...at,
      });
    }
  }
  return out;
}

/** Places saved on a trip. */
export function savedEntries(trips: readonly Trip[], l: Labels): SearchEntry[] {
  return savedPins(trips).map((s) => ({
    key: `saved:${s.id}`,
    kind: 'saved' as const,
    name: s.name,
    detail: words(s.category ? l.category(s.category) : null, s.tripName).join(' · '),
    terms: words(l.kind('saved'), s.category ? l.category(s.category) : null, s.tripName),
    lat: s.lat,
    lon: s.lon,
    ...(s.sample ? { sample: true } : {}),
  }));
}

/** Pins dropped with Find my way back. */
export function pinEntries(pins: readonly WaybackPin[], l: Labels): SearchEntry[] {
  return pins
    .filter((p) => validLatLon(p.lat, p.lon))
    .map((p) => ({ key: `pin:${p.id}`, kind: 'pin' as const, name: l.pin(p), terms: words(l.kind('pin')), lat: p.lat, lon: p.lon }));
}

/** Toilets held on the phone (saved, recently used, from city packs). Most have no name: they go by the kind word. */
export function toiletEntries(toilets: readonly Toilet[], l: Labels, detail?: string): SearchEntry[] {
  const seen = new Set<string>();
  const out: SearchEntry[] = [];
  for (const t of toilets) {
    if (!t || seen.has(t.id) || !validLatLon(t.lat, t.lon)) continue;
    seen.add(t.id);
    const name = t.name?.trim() || l.kind('toilet');
    out.push({ key: `toilet:${t.id}`, kind: 'toilet', name, detail, terms: words(l.kind('toilet'), l.category('toilets')), lat: t.lat, lon: t.lon, osm: true });
  }
  return out;
}

/** A named or categorised place from a downloaded city pack's pois.json `places[]` (pack contract, any format). */
export type PackPlace = LatLon & { id: string; category: string; name?: string };

/** pois.json `places[]` (text or parsed); [] for anything malformed. Deduped by id. */
export function parsePackPlaces(json: unknown): PackPlace[] {
  let data = json;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return [];
    }
  }
  const list = data && typeof data === 'object' ? (data as { places?: unknown }).places : undefined;
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: PackPlace[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const id = typeof r.id === 'string' ? r.id.trim() : '';
    const category = typeof r.category === 'string' ? r.category.trim() : '';
    if (!id || !category || seen.has(id) || !validLatLon(r.lat, r.lon)) continue;
    seen.add(id);
    const name = typeof r.name === 'string' && r.name.trim() ? r.name.trim() : undefined;
    out.push({ id, category, lat: r.lat as number, lon: r.lon as number, ...(name ? { name } : {}) });
  }
  return out;
}

/** Downloaded city POIs; an unnamed one goes by its category label. */
export function packPlaceEntries(places: readonly PackPlace[], city: string, l: Labels): SearchEntry[] {
  return places.map((p) => {
    const cat = l.category(p.category);
    return { key: `place:${p.id}`, kind: 'place' as const, name: p.name || cat, detail: words(cat, city).join(' · '), terms: words(cat, city), lat: p.lat, lon: p.lon, osm: true };
  });
}

/** The bundled demo points (sample: not real places). */
export function sampleEntries(pois: readonly Poi[], city: string, l: Labels): SearchEntry[] {
  return pois.map((p) => {
    const cat = l.category(p.category);
    return { key: `sample:${p.id}`, kind: 'sample' as const, name: p.name, detail: words(cat, city).join(' · '), terms: words(cat, city), lat: p.lat, lon: p.lon, sample: true };
  });
}

// ------------------------------------------------------------------------------------------------------ search

export type Prepared = SearchEntry & { nName: string; nWords: string[]; nTerms: string[] };

/** Normalise once (a city pack can hold thousands of points); search then runs on every keystroke. */
export function prepare(entries: readonly SearchEntry[]): Prepared[] {
  const seen = new Set<string>();
  const out: Prepared[] = [];
  for (const e of entries) {
    if (seen.has(e.key) || !validLatLon(e.lat, e.lon)) continue;
    seen.add(e.key);
    const nName = normalize(e.name);
    out.push({ ...e, nName, nWords: nName.split(' ').filter(Boolean), nTerms: (e.terms ?? []).map(normalize).filter(Boolean) });
  }
  return out;
}

/** 0 name starts with the query, 1 a word of the name does, 2 the name contains it, 3 every query word is found in the name or other words. */
export type Tier = 0 | 1 | 2 | 3;

export function matchTier(e: Pick<Prepared, 'nName' | 'nWords' | 'nTerms'>, nq: string): Tier | null {
  if (!nq) return null;
  if (e.nName.startsWith(nq)) return 0;
  if (e.nName.includes(` ${nq}`)) return 1;
  if (e.nName.includes(nq)) return 2;
  const hay = [e.nName, ...e.nTerms];
  const qWords = nq.split(' ').filter(Boolean);
  if (qWords.every((w) => hay.some((h) => h.includes(w)))) return 3;
  return null;
}

export type SearchHit = Prepared & {
  tier: Tier;
  /** Straight-line metres from the known position, null without one. */
  meters: number | null;
  bearing: number | null;
  dir: Compass16 | null;
  walk: { minutes: number; h: number; m: number } | null;
};

export const MAX_HITS = 40;
/** Two results with the same name closer than this are the same spot (a saved place made from a sample point). */
export const SAME_RESULT_M = 15;

const kindRank = (k: SearchKind) => SEARCH_KINDS.indexOf(k);

/**
 * Matching entries, best first: tier, then distance when `from` is known (nearer first), then kind, then shorter
 * name, then name. A spot that two kinds hold under the same name shows once (the higher kind). At most `limit`.
 */
export function search(entries: readonly Prepared[], query: string, from: LatLon | null = null, limit = MAX_HITS): SearchHit[] {
  const nq = normalize(query);
  if (!nq) return [];
  const pos = from && validLatLon(from.lat, from.lon) ? from : null;
  const hits: SearchHit[] = [];
  for (const e of entries) {
    const tier = matchTier(e, nq);
    if (tier === null) continue;
    const meters = pos ? distanceTo(pos, e) : null;
    const bearing = pos ? initialBearing(pos, e) : null;
    hits.push({ ...e, tier, meters, bearing, dir: bearing == null ? null : cardinal(bearing, 8), walk: walkTime(meters) });
  }
  hits.sort(
    (a, b) =>
      a.tier - b.tier ||
      (a.meters ?? Infinity) - (b.meters ?? Infinity) ||
      kindRank(a.kind) - kindRank(b.kind) ||
      a.nName.length - b.nName.length ||
      (a.nName < b.nName ? -1 : a.nName > b.nName ? 1 : 0),
  );
  const out: SearchHit[] = [];
  for (const h of hits) {
    if (out.length >= Math.max(0, limit)) break;
    const dup = out.some((o) => o.nName === h.nName && (distanceTo(o, h) ?? Infinity) <= SAME_RESULT_M);
    if (!dup) out.push(h);
  }
  return out;
}

export type SearchState = 'idle' | 'none' | 'results';

/** idle: nothing typed (show recent searches); none: typed but nothing found; results. */
export function searchState(query: string, hits: readonly unknown[]): SearchState {
  if (!normalize(query)) return 'idle';
  return hits.length ? 'results' : 'none';
}

/** Distance split ('350' 'm') for the UI; null without a position. */
export const hitDistance = (h: Pick<SearchHit, 'meters'>) => (h.meters == null ? null : distanceParts(h.meters));

/** True when any shown result is OpenStreetMap data (the UI then shows the attribution). */
export const needsOsmCredit = (hits: readonly Pick<SearchEntry, 'osm'>[]) => hits.some((h) => h.osm === true);

// ------------------------------------------------------------------------------------------------------ recents

export const MAPSEARCH_RECENTS_KEY = 'satchel.mapsearch.recents.v1';
export const RECENTS_MAX = 8;
export const QUERY_MAX = 80;

const cleanQuery = (s: unknown) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, QUERY_MAX).trim() : '');

/** The stored list, read defensively: strings only, cleaned, deduped (same text ignoring case and accents), capped. */
export function parseRecents(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const r of raw) {
    const q = cleanQuery(r);
    const n = normalize(q);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(q);
    if (out.length >= RECENTS_MAX) break;
  }
  return out;
}

/** Newest first; the same search again moves to the top (with the latest spelling); at most RECENTS_MAX. */
export function pushRecent(list: readonly string[], query: string): string[] {
  const q = cleanQuery(query);
  const n = normalize(q);
  if (!n) return parseRecents(list);
  return parseRecents([q, ...parseRecents(list).filter((x) => normalize(x) !== n)]);
}

export const removeRecent = (list: readonly string[], query: string): string[] => parseRecents(list).filter((x) => normalize(x) !== normalize(query));

export const clearRecents = (): string[] => [];
