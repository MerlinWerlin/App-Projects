// T83 trip covers: which illustrated scene a trip shows. Pure TypeScript (Node runs it directly).
//
// Order of choice:
//   1. the user's own pick (`trip.cover`), when it is a scene this build knows (an unknown id is ignored, so a file
//      from a newer Satchel still opens with an automatic cover);
//   2. words in the trip name ("Ski week", "Beach break"), then in the bookings' titles and places;
//   3. the cities the trip visits (hotel / booking places and the zones' cities), from a small city table;
//   4. the countries of the bookings' zones, from a country table (NZ / CH -> mountains, Maldives -> island, ...);
//      a mountain country in its winter months becomes snow;
//   5. otherwise a scene picked from a hash of the trip id, so the same trip always gets the same cover.
import { countryForZone } from './emergency.ts';
import type { Item, Place, Trip } from './model.ts';

export const COVER_SCENES = ['city', 'mountains', 'coast', 'oldtown', 'countryside', 'snow', 'desert', 'island'] as const;
export type CoverId = (typeof COVER_SCENES)[number];

export const isCoverId = (x: unknown): x is CoverId => typeof x === 'string' && (COVER_SCENES as readonly string[]).includes(x);

/** Lowercase without accents or punctuation, padded with spaces so keywords match whole words. */
export function foldWords(s: string): string {
  return ` ${s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()} `;
}

/** Words (whole words, folded) that point at a scene. Multi-word entries match as a phrase. */
export const COVER_KEYWORDS: Record<CoverId, readonly string[]> = {
  city: ['city', 'downtown', 'skyline', 'metro', 'conference', 'business', 'citybreak'],
  mountains: ['mountain', 'mountains', 'hike', 'hiking', 'trek', 'trekking', 'alps', 'alpine', 'peak', 'peaks', 'climb', 'climbing', 'national park', 'lake', 'lakes', 'fjord', 'fjords', 'valley'],
  coast: ['beach', 'beaches', 'coast', 'coastal', 'seaside', 'bay', 'surf', 'surfing', 'riviera', 'harbour', 'harbor', 'cliffs', 'shore', 'lighthouse', 'sea'],
  oldtown: ['old town', 'old city', 'medieval', 'historic', 'castle', 'castles', 'temple', 'temples', 'shrine', 'shrines', 'cathedral', 'heritage', 'ruins'],
  countryside: ['countryside', 'village', 'villages', 'farm', 'farmstay', 'vineyard', 'vineyards', 'wine', 'winery', 'cottage', 'road trip', 'roadtrip', 'camping', 'cycling', 'meadow'],
  snow: ['ski', 'skiing', 'snow', 'snowboard', 'snowboarding', 'winter', 'aurora', 'northern lights', 'glacier', 'arctic', 'chalet', 'polar'],
  desert: ['desert', 'dune', 'dunes', 'safari', 'oasis', 'sahara', 'outback', 'canyon', 'camel'],
  island: ['island', 'islands', 'isle', 'isles', 'isla', 'atoll', 'tropical', 'lagoon', 'reef', 'snorkel', 'snorkelling', 'snorkeling', 'diving', 'honeymoon'],
};

/**
 * Cities (folded) whose look is clear enough to name: big skylines, old towns, mountain and beach towns.
 * Also matched against zone cities ("Asia/Tokyo" -> tokyo), so Japan splits into city (Tokyo, Osaka) and old town
 * (Kyoto, Nara) by name.
 */
export const COVER_CITIES: Record<string, CoverId> = {
  // skylines
  tokyo: 'city', osaka: 'city', yokohama: 'city', seoul: 'city', shanghai: 'city', beijing: 'city', 'hong kong': 'city', shenzhen: 'city',
  singapore: 'city', taipei: 'city', bangkok: 'city', 'kuala lumpur': 'city', manila: 'city', jakarta: 'city', mumbai: 'city',
  'new york': 'city', chicago: 'city', toronto: 'city', 'los angeles': 'city', 'san francisco': 'city', seattle: 'city', boston: 'city',
  london: 'city', paris: 'city', berlin: 'city', frankfurt: 'city', madrid: 'city', milan: 'city', 'sao paulo': 'city', 'mexico city': 'city',
  sydney: 'city', melbourne: 'city', auckland: 'city', dubai: 'city', doha: 'city', 'abu dhabi': 'city', istanbul: 'city', johannesburg: 'city',
  // old towns
  kyoto: 'oldtown', nara: 'oldtown', kanazawa: 'oldtown', takayama: 'oldtown', prague: 'oldtown', krakow: 'oldtown', tallinn: 'oldtown', riga: 'oldtown',
  vilnius: 'oldtown', bruges: 'oldtown', florence: 'oldtown', venice: 'oldtown', rome: 'oldtown', siena: 'oldtown', lisbon: 'oldtown', porto: 'oldtown',
  seville: 'oldtown', granada: 'oldtown', toledo: 'oldtown', edinburgh: 'oldtown', york: 'oldtown', salzburg: 'oldtown', ljubljana: 'oldtown',
  dubrovnik: 'oldtown', budapest: 'oldtown', vienna: 'oldtown', amsterdam: 'oldtown', copenhagen: 'oldtown', stockholm: 'oldtown',
  marrakech: 'oldtown', fez: 'oldtown', 'hoi an': 'oldtown', 'luang prabang': 'oldtown', 'chiang mai': 'oldtown', cusco: 'oldtown', cartagena: 'oldtown',
  // mountains and snow towns
  queenstown: 'mountains', interlaken: 'mountains', zermatt: 'snow', innsbruck: 'mountains', chamonix: 'snow', kathmandu: 'mountains', pokhara: 'mountains',
  banff: 'mountains', niseko: 'snow', hakuba: 'snow', sapporo: 'snow', whistler: 'snow', aspen: 'snow', reykjavik: 'snow', tromso: 'snow', rovaniemi: 'snow',
  // coast
  nice: 'coast', cannes: 'coast', barcelona: 'coast', malaga: 'coast', 'cape town': 'coast', 'rio de janeiro': 'coast', honolulu: 'island', 'gold coast': 'coast',
  split: 'coast', positano: 'coast', amalfi: 'coast', cascais: 'coast', 'san diego': 'coast', miami: 'coast', 'da nang': 'coast', okinawa: 'island',
  // desert
  'las vegas': 'desert', phoenix: 'desert', 'alice springs': 'desert', riyadh: 'desert', muscat: 'desert', amman: 'desert', cairo: 'desert', luxor: 'desert',
  // countryside
  cotswolds: 'countryside', tuscany: 'countryside', provence: 'countryside', bordeaux: 'countryside', napa: 'countryside',
  normandy: 'countryside', dordogne: 'countryside', burgundy: 'countryside', champagne: 'countryside', loire: 'countryside', 'lake district': 'mountains',
  // T84: a few more French and other cities that trips often name
  lyon: 'oldtown', strasbourg: 'oldtown', avignon: 'oldtown', marseille: 'coast', biarritz: 'coast', 'saint malo': 'coast',
  hanoi: 'city', 'ho chi minh city': 'city', delhi: 'city', 'new delhi': 'city', vancouver: 'city', montreal: 'city', 'buenos aires': 'city', lima: 'city',
  // islands
  bali: 'island', phuket: 'island', 'koh samui': 'island', santorini: 'island', mykonos: 'island', mallorca: 'island', ibiza: 'island', tenerife: 'island',
  nadi: 'island', papeete: 'island', 'port louis': 'island', mahe: 'island', boracay: 'island', langkawi: 'island', zanzibar: 'island',
};

/** Countries (ISO 3166 alpha-2) whose usual look picks a scene. Countries not listed fall through to the hash. */
export const COVER_COUNTRIES: Record<string, CoverId> = {
  // mountains
  NZ: 'mountains', CH: 'mountains', AT: 'mountains', NP: 'mountains', BT: 'mountains', NO: 'mountains', LI: 'mountains', AD: 'mountains',
  PE: 'mountains', BO: 'mountains', KG: 'mountains', TJ: 'mountains', GE: 'mountains', AM: 'mountains', SI: 'mountains', MN: 'mountains',
  // snow
  IS: 'snow', FI: 'snow', GL: 'snow', SJ: 'snow', AQ: 'snow',
  // islands
  MV: 'island', FJ: 'island', MU: 'island', SC: 'island', BS: 'island', BB: 'island', JM: 'island', LC: 'island', AG: 'island', KN: 'island',
  VC: 'island', GD: 'island', DM: 'island', TT: 'island', CU: 'island', DO: 'island', PR: 'island', AW: 'island', CW: 'island', KY: 'island',
  VG: 'island', VI: 'island', TC: 'island', BM: 'island', PF: 'island', NC: 'island', WS: 'island', TO: 'island', VU: 'island', CK: 'island',
  KI: 'island', MH: 'island', FM: 'island', PW: 'island', TV: 'island', NR: 'island', SB: 'island', MT: 'island', CY: 'island', CV: 'island',
  ST: 'island', KM: 'island', LK: 'island', PH: 'island', ID: 'island', GU: 'island', MP: 'island', RE: 'island', YT: 'island',
  // desert
  AE: 'desert', QA: 'desert', SA: 'desert', OM: 'desert', BH: 'desert', KW: 'desert', JO: 'desert', EG: 'desert', MA: 'desert', DZ: 'desert',
  TN: 'desert', LY: 'desert', NE: 'desert', ML: 'desert', TD: 'desert', MR: 'desert', SD: 'desert', EH: 'desert', NA: 'desert', IL: 'desert',
  // coast
  GR: 'coast', HR: 'coast', PT: 'coast', ME: 'coast', AL: 'coast', MC: 'coast', AU: 'coast', BR: 'coast', ZA: 'coast', CR: 'coast', BZ: 'coast', UY: 'coast',
  // old towns
  IT: 'oldtown', CZ: 'oldtown', EE: 'oldtown', LV: 'oldtown', LT: 'oldtown', BE: 'oldtown', VA: 'oldtown', SM: 'oldtown', MO: 'oldtown',
  // countryside
  IE: 'countryside', FR: 'countryside', NL: 'countryside', DK: 'countryside', LU: 'countryside', SK: 'countryside', RO: 'countryside', HU: 'countryside',
  // big-city countries
  SG: 'city', HK: 'city', KR: 'city', JP: 'city', TW: 'city', US: 'city', GB: 'city', DE: 'city', AR: 'city', MX: 'city', TR: 'city', CN: 'city',
};

/** Countries in the southern hemisphere among the mountain ones (their winter is June to August). */
const SOUTHERN = new Set(['NZ', 'PE', 'BO', 'AR', 'CL', 'AU', 'ZA']);

/** Weights: the trip name says most about the trip, then the bookings' words, cities, then countries. */
const W_NAME = 12;
const W_ITEM_WORD = 3;
/** A city named in a booking's place or address (a hotel in Kyoto beats the zone, which says Tokyo for all Japan). */
const W_CITY = 6;
/** The city a zone is named after, once per zone: a hint only, since one zone covers a whole country (Pacific/Auckland is all of New Zealand). */
const W_ZONE_CITY = 1;
/**
 * T84: the zone's city when its country's scene is a general one (city, old town, countryside): a trip in
 * Europe/Paris with no address is far more likely Paris than the French countryside, so the city beats the country.
 * Countries known for a landscape (NZ mountains, Maldives islands, UAE desert) keep it: the hint stays W_ZONE_CITY.
 */
const W_ZONE_CITY_STRONG = 3;
const W_COUNTRY = 2;
/** Country scenes that say little about one city in that country (so the zone's city may outweigh them). */
const GENERAL_SCENES: ReadonlySet<CoverId> = new Set(['city', 'oldtown', 'countryside']);

const placesOf = (i: Item): Place[] => [i.place, i.from, i.to].filter((p): p is Place => !!p);

function keywordScenes(text: string): CoverId[] {
  const w = foldWords(text);
  const out: CoverId[] = [];
  for (const id of COVER_SCENES) if (COVER_KEYWORDS[id].some((k) => w.includes(` ${k} `))) out.push(id);
  return out;
}

function cityScenes(text: string): CoverId[] {
  const w = foldWords(text);
  const out: CoverId[] = [];
  for (const city of Object.keys(COVER_CITIES)) if (w.includes(` ${city} `)) out.push(COVER_CITIES[city]);
  return out;
}

/** "Tokyo" from "Asia/Tokyo". */
const zoneCity = (tz: string) => (tz.split('/').pop() ?? '').replace(/_/g, ' ');

/** Months (1-12) the trip covers, at most twelve. */
function tripMonths(trip: Trip): Set<number> {
  const out = new Set<number>();
  const m0 = Number(trip.startDate.slice(5, 7));
  const y0 = Number(trip.startDate.slice(0, 4));
  const m1 = Number(trip.endDate.slice(5, 7));
  const y1 = Number(trip.endDate.slice(0, 4));
  if (!(m0 >= 1 && m0 <= 12 && m1 >= 1 && m1 <= 12 && y0 > 0 && y1 > 0)) return out;
  let span = (y1 - y0) * 12 + (m1 - m0);
  if (span < 0) span = 0;
  for (let i = 0; i <= Math.min(span, 11); i++) out.add(((m0 - 1 + i) % 12) + 1);
  return out;
}

const isWinter = (iso2: string, months: Set<number>) => {
  const winter = SOUTHERN.has(iso2) ? [6, 7, 8] : [12, 1, 2];
  return winter.some((m) => months.has(m));
};

/** Score of each scene for a trip, from its name, bookings, cities and countries (zero when nothing points anywhere). */
export function coverScores(trip: Trip): Record<CoverId, number> {
  const score = Object.fromEntries(COVER_SCENES.map((id) => [id, 0])) as Record<CoverId, number>;
  const add = (ids: CoverId[], w: number) => {
    for (const id of new Set(ids)) score[id] += w;
  };
  add(keywordScenes(trip.name ?? ''), W_NAME);
  add(cityScenes(trip.name ?? ''), W_NAME);
  const months = tripMonths(trip);
  const zones = new Map<string, number>();
  for (const it of trip.items ?? []) {
    if (it.kind !== 'note') {
      add(keywordScenes(it.title ?? ''), W_ITEM_WORD);
    }
    for (const p of placesOf(it)) {
      const text = `${p.name ?? ''} ${p.address ?? ''}`;
      add(keywordScenes(text), W_ITEM_WORD);
      add(cityScenes(text), W_CITY);
    }
    // Where the trip goes, not where it leaves from: the home zone is skipped; hotels count double.
    const w = it.kind === 'hotel' ? 2 : 1;
    for (const tz of [it.start?.tz, it.end?.tz]) {
      if (!tz || tz === trip.homeTz) continue;
      zones.set(tz, (zones.get(tz) ?? 0) + w);
    }
  }
  for (const p of trip.places ?? []) add(cityScenes(`${p.name ?? ''} ${p.address ?? ''}`), W_CITY);
  const countries = new Set<string>();
  for (const [tz, n] of zones) {
    const city = COVER_CITIES[foldWords(zoneCity(tz)).trim()];
    const iso2 = countryForZone(tz);
    const country = iso2 ? COVER_COUNTRIES[iso2] : undefined;
    if (city && n > 0) score[city] += !country || GENERAL_SCENES.has(country) ? W_ZONE_CITY_STRONG : W_ZONE_CITY;
    if (iso2) countries.add(iso2);
  }
  for (const iso2 of countries) {
    let id = COVER_COUNTRIES[iso2];
    if (!id) continue;
    if (id === 'mountains' && isWinter(iso2, months)) id = 'snow';
    score[id] += W_COUNTRY;
  }
  return score;
}

/** FNV-1a 32-bit hash of a string (stable on every phone). */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** The scene for a trip id when nothing else points anywhere. */
export const fallbackCover = (id: string): CoverId => COVER_SCENES[hashString(id || 'trip') % COVER_SCENES.length];

/** The automatic scene: highest score (earlier in COVER_SCENES wins a tie), else the hash of the trip id. */
export function autoCover(trip: Trip): CoverId {
  const s = coverScores(trip);
  let best: CoverId | null = null;
  for (const id of COVER_SCENES) if (s[id] > 0 && (best === null || s[id] > s[best])) best = id;
  return best ?? fallbackCover(trip.id);
}

/** The scene a trip shows: the user's pick when this build knows it, else the automatic one. */
export const tripCover = (trip: Trip): CoverId => (isCoverId(trip.cover) ? trip.cover : autoCover(trip));

/** The trip with its cover set (a known scene id) or back to automatic (null, '' or an unknown id). */
export function withCover(trip: Trip, cover: string | null | undefined): Trip {
  const { cover: _old, ...rest } = trip;
  return isCoverId(cover) ? { ...rest, cover } : rest;
}

/**
 * A cover value read from storage or a trip file: kept when it is a short plain id (a scene from a newer Satchel is
 * kept so it shows once this phone updates; tripCover ignores it until then), dropped otherwise.
 */
export const readCover = (x: unknown): string | undefined => (typeof x === 'string' && /^[a-z][a-z0-9-]{0,31}$/.test(x) ? x : undefined);
