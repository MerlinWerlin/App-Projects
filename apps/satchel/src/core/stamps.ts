// T103 Passport stamps (owner-1031 D, "less bland"): every country and city a traveller has been to earns one
// original illustrated stamp, worked out on the phone from the saved trips (no network). Pure TypeScript.
//
//   places       every booking's start and end stop (its own IANA zone): the start of a journey leg (flight, train,
//                ferry, bus) is a "departed" stop, everything else (a leg's end, a hotel, an activity, a car pick-up,
//                a note) an "arrived" stop. Country from the zone (countryForZone). City: a hotel's own town (its
//                address, Your travels' rule), else the zone's city ("Asia/Tokyo" -> Tokyo) when no hotel in that
//                zone names a town for the trip. The home country and home city earn stamps too (the demo trip
//                leaves from Sydney, so it gives AU as well as JP).
//   which count  only stops whose own local date is on or before today, on trips that have started: an upcoming
//                trip gives no stamp, and a trip that is on gives stamps only for the stops already reached.
//   dedupe       one stamp per place for life (countries by ISO code; cities by folded name within their country);
//                the stamp keeps the first stop ever made there (earliest real instant), its date read in that
//                stop's own zone, its mark (arrived / departed) and the trip it came from.
//   look         shape, tilt and ink are picked from a hash of the place key only, so a stamp never changes between
//                opens, devices or trip edits elsewhere. Shapes are original geometry (round, oval, rectangle,
//                triangle-ish, hexagon): no real country's stamp design and no national emblems.
//   continents   ISO code -> continent table below (seven-continent model; transcontinental countries are put where
//                most of their people live).
// stampsText() is the share text (place, date, mark only: no booking details).
import { cityFromAddress, isDemoTrip, tripSpan, zoneCity } from './travelstats.ts';
import { countryForZone } from './emergency.ts';
import { isTransport, type Item, type LocalDate, type LocalDateTime, type Trip } from './model.ts';
import { isLocalDateTime, isValidZone, localDate, toUtc, wallMs } from './tz.ts';

export const STAMP_SHAPES = ['round', 'oval', 'rect', 'triangle', 'hexagon'] as const;
export type StampShape = (typeof STAMP_SHAPES)[number];

/** Ink slots; the colours live in src/theme/tokens.ts stampInks (light + dark, AA on the stamp paper). */
export const STAMP_INKS = ['navy', 'rust', 'forest', 'plum', 'teal', 'crimson'] as const;
export type StampInk = (typeof STAMP_INKS)[number];

/** Largest tilt either way, in degrees. */
export const MAX_TILT = 12;

export type Continent = 'africa' | 'antarctica' | 'asia' | 'europe' | 'northAmerica' | 'oceania' | 'southAmerica';
export const CONTINENTS: readonly Continent[] = ['africa', 'antarctica', 'asia', 'europe', 'northAmerica', 'oceania', 'southAmerica'];

const CONTINENT_CODES: Record<Continent, string> = {
  africa:
    'DZ AO BJ BW BF BI CV CM CF TD KM CG CD CI DJ EG GQ ER SZ ET GA GM GH GN GW KE LS LR LY MG MW ML MR MU YT MA MZ NA NE NG RE RW SH ST SN SC SL SO ZA SS SD TZ TG TN UG EH ZM ZW',
  antarctica: 'AQ TF BV HM',
  asia: 'AF AM AZ BH BD BT BN KH CN CY GE HK IN ID IR IQ IL JP JO KZ KW KG LA LB MO MY MV MN MM NP KP OM PK PS PH QA SA SG KR LK SY TW TJ TH TL TR TM AE UZ VN YE IO CX CC',
  europe: 'AX AL AD AT BY BE BA BG HR CZ DK EE FO FI FR DE GI GR GG VA HU IS IE IM IT JE XK LV LI LT LU MT MD MC ME NL MK NO PL PT RO RU SM RS SK SI ES SJ SE CH UA GB',
  northAmerica: 'AI AG AW BS BB BZ BM BQ VG CA KY CR CU CW DM DO SV GL GD GP GT HT HN JM MQ MX MS NI PA PR BL KN LC MF PM VC SX TT TC US VI UM',
  oceania: 'AS AU CK FJ PF GU KI MH FM NR NC NZ NU NF MP PW PG PN WS SB TK TO TV VU WF',
  southAmerica: 'AR BO BR CL CO EC FK GF GY PY PE SR UY VE GS',
};

/** ISO 3166 alpha-2 -> continent. */
export const CONTINENT_OF: Readonly<Record<string, Continent>> = (() => {
  const out: Record<string, Continent> = {};
  for (const c of CONTINENTS) for (const code of CONTINENT_CODES[c].split(' ')) out[code] = c;
  return out;
})();

/** The continent of a country, falling back to the zone's area when the code is not in the table. */
export function continentFor(iso2: string, zone?: string): Continent | null {
  const c = CONTINENT_OF[iso2.toUpperCase()];
  if (c) return c;
  const area = zone?.split('/')[0];
  if (area === 'Europe') return 'europe';
  if (area === 'Africa') return 'africa';
  if (area === 'Asia') return 'asia';
  if (area === 'Australia' || area === 'Pacific') return 'oceania';
  if (area === 'Antarctica') return 'antarctica';
  return null;
}

export type StampKind = 'country' | 'city';
export type StampMark = 'arrived' | 'departed';

export type StampLook = { shape: StampShape; tilt: number; ink: StampInk; seed: number };

export type PassportStamp = StampLook & {
  /** "c:JP" or "t:JP:tokyo": stable for life, the hash input for the look. */
  key: string;
  kind: StampKind;
  iso2: string;
  /** The town, for city stamps. */
  city: string | null;
  continent: Continent | null;
  /** The first stop's local date in its own zone. */
  date: LocalDate;
  local: LocalDateTime;
  zone: string;
  mark: StampMark;
  tripId: string;
  tripName: string;
  /** From a demo / sample trip. */
  demo: boolean;
};

export type StampCounts = { countries: number; cities: number; continents: number; stamps: number };

export type StampCollection = {
  /** Newest first (date, then time, then countries before cities, then key). */
  stamps: PassportStamp[];
  counts: StampCounts;
  /** Demo trips left out because includeDemo was off. */
  demoLeftOut: number;
};

export type StampOptions = {
  includeDemo?: boolean;
  /** English country name for a code: lets a trailing country in a hotel address be skipped. */
  countryName?: (iso2: string) => string | null | undefined;
  /** The "today" to use for one trip (the recap's demo preview); defaults to `today`. */
  todayFor?: (trip: Trip) => LocalDate;
};

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/** FNV-1a, 32 bit: the same number for the same text on every engine. */
export function stampHash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Shape, tilt (whole degrees, -MAX_TILT..MAX_TILT, never 0) and ink for a place key. */
export function stampLook(key: string): StampLook {
  const h = stampHash(key);
  const shape = STAMP_SHAPES[h % STAMP_SHAPES.length];
  const ink = STAMP_INKS[(h >>> 8) % STAMP_INKS.length];
  const raw = ((h >>> 16) % (2 * MAX_TILT)) - MAX_TILT; // -12..11
  const tilt = raw >= 0 ? raw + 1 : raw; // -12..-1, 1..12
  return { shape, tilt, ink, seed: (h >>> 4) % 9973 };
}

export const countryKey = (iso2: string) => `c:${iso2.toUpperCase()}`;
export const cityKey = (iso2: string, city: string) => `t:${iso2.toUpperCase()}:${fold(city)}`;

type Stop = { zone: string; local: LocalDateTime; mark: StampMark; item: Item };

/** Every readable stop of a booking: its start (departed for a journey leg) and its end (arrived). */
function stopsOf(i: Item): Stop[] {
  const out: Stop[] = [];
  const ok = (s: { local: string; tz: string } | undefined) => !!s && isLocalDateTime(s.local) && isValidZone(s.tz);
  if (ok(i.start)) out.push({ zone: i.start.tz, local: i.start.local, mark: isTransport(i.kind) ? 'departed' : 'arrived', item: i });
  if (isTransport(i.kind) && ok(i.end)) out.push({ zone: (i.end as { tz: string }).tz, local: (i.end as { local: string }).local, mark: 'arrived', item: i });
  return out;
}

const instant = (s: Stop) => {
  try {
    return toUtc({ local: s.local, tz: s.zone });
  } catch {
    return wallMs(s.local);
  }
};

type Candidate = { key: string; kind: StampKind; iso2: string; city: string | null; stop: Stop; at: number; trip: Trip };

/** The places one trip reached by `today`, before deduplication (several stops per place). */
function tripCandidates(trip: Trip, today: LocalDate, isCountry: (s: string) => boolean): Candidate[] {
  if (tripSpan(trip).start > today) return [];
  const items = Array.isArray(trip.items) ? trip.items : [];
  const hotelCity = new Map<string, string>();
  const zonesWithHotelCity = new Set<string>();
  for (const i of items) {
    if (i.kind !== 'hotel') continue;
    const city = cityFromAddress(i.place?.address, isCountry);
    if (!city || !i.start || !isValidZone(i.start.tz)) continue;
    hotelCity.set(i.id, city);
    zonesWithHotelCity.add(i.start.tz);
  }
  const out: Candidate[] = [];
  for (const i of items) {
    for (const stop of stopsOf(i)) {
      if (localDate(stop.local) > today) continue;
      const iso2 = countryForZone(stop.zone);
      if (!iso2) continue;
      const at = instant(stop);
      out.push({ key: countryKey(iso2), kind: 'country', iso2, city: null, stop, at, trip });
      const city = i.kind === 'hotel' && hotelCity.has(i.id) ? (hotelCity.get(i.id) as string) : zonesWithHotelCity.has(stop.zone) ? null : zoneCity(stop.zone);
      if (city) out.push({ key: cityKey(iso2, city), kind: 'city', iso2, city, stop, at, trip });
    }
  }
  return out;
}

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Newest first: date, then local time, then countries before cities, then key. */
export function byNewest(a: PassportStamp, b: PassportStamp): number {
  if (a.local !== b.local) return a.local < b.local ? 1 : -1;
  if (a.kind !== b.kind) return a.kind === 'country' ? -1 : 1;
  return cmp(a.key, b.key);
}

export function countStamps(stamps: readonly PassportStamp[]): StampCounts {
  const countries = new Set<string>();
  const continents = new Set<Continent>();
  let cities = 0;
  for (const s of stamps) {
    countries.add(s.iso2);
    if (s.continent) continents.add(s.continent);
    if (s.kind === 'city') cities++;
  }
  return { countries: countries.size, cities, continents: continents.size, stamps: stamps.length };
}

/** Every stamp earned across the trips, deduplicated by place (see the file header). */
export function stampCollection(trips: readonly Trip[], today: LocalDate, opts: StampOptions = {}): StampCollection {
  const list = (Array.isArray(trips) ? trips : []).filter((t) => t && typeof t === 'object');
  const counted = opts.includeDemo ? list : list.filter((t) => !isDemoTrip(t));
  const names = new Set<string>();
  if (opts.countryName) {
    for (const t of counted)
      for (const i of t.items ?? [])
        for (const z of [i.start?.tz, i.end?.tz]) {
          const c = z ? countryForZone(z) : null;
          const n = c ? opts.countryName(c) : null;
          if (n) names.add(fold(n));
        }
  }
  const isCountry = (s: string) => names.has(fold(s));
  const first = new Map<string, Candidate>();
  for (const t of counted) {
    const day = opts.todayFor ? opts.todayFor(t) : today;
    for (const c of tripCandidates(t, day, isCountry)) {
      const had = first.get(c.key);
      if (!had || c.at < had.at || (c.at === had.at && cmp(c.trip.id, had.trip.id) < 0)) first.set(c.key, c);
    }
  }
  const stamps: PassportStamp[] = [...first.values()].map((c) => ({
    ...stampLook(c.key),
    key: c.key,
    kind: c.kind,
    iso2: c.iso2,
    city: c.city,
    continent: continentFor(c.iso2, c.stop.zone),
    date: localDate(c.stop.local),
    local: c.stop.local,
    zone: c.stop.zone,
    mark: c.stop.mark,
    tripId: c.trip.id,
    tripName: c.trip.name,
    demo: isDemoTrip(c.trip),
  }));
  stamps.sort(byNewest);
  return { stamps, counts: countStamps(stamps), demoLeftOut: list.length - counted.length };
}

export type TripStamps = {
  /** Every place the trip reached, as its lifetime stamp (newest first). */
  stamps: PassportStamp[];
  /** Keys of the stamps first earned on this trip ("First stamp"). */
  firsts: Set<string>;
};

/** The recap's stamps: the trip's places drawn as their lifetime stamps, with the ones first earned here marked. */
export function stampsForTrip(collection: StampCollection, trip: Trip, today: LocalDate, opts: Pick<StampOptions, 'countryName'> = {}): TripStamps {
  const own = stampCollection([trip], today, { includeDemo: true, countryName: opts.countryName }).stamps;
  const byKey = new Map(collection.stamps.map((s) => [s.key, s]));
  // A place missing from the collection (the trip is a demo left out there) shows the trip's own stamp.
  const stamps = own.map((s) => byKey.get(s.key) ?? s).sort(byNewest);
  const firsts = new Set(stamps.filter((s) => s.tripId === trip.id).map((s) => s.key));
  return { stamps, firsts };
}

/** Days after a trip ends that its stamps are still shown as new on the Passport page. */
export const FRESH_DAYS = 14;

/**
 * The newly finished trip whose first stamps the Passport page highlights: the trip that ended most recently (before
 * today, within FRESH_DAYS) and earned at least one stamp first. Null when there is none.
 */
export function freshTrip(collection: StampCollection, trips: readonly Trip[], today: LocalDate, days = FRESH_DAYS): { tripId: string; tripName: string; stamps: PassportStamp[] } | null {
  let best: { trip: Trip; end: LocalDate } | null = null;
  for (const t of trips) {
    const s = collection.stamps.some((x) => x.tripId === t.id);
    if (!s) continue;
    const end = tripSpan(t).end;
    if (end >= today) continue;
    const since = Math.round((wallMs(`${today}T00:00`) - wallMs(`${end}T00:00`)) / 86400000);
    if (since > days) continue;
    if (!best || end > best.end || (end === best.end && cmp(t.id, best.trip.id) < 0)) best = { trip: t, end };
  }
  if (!best) return null;
  const id = best.trip.id;
  return { tripId: id, tripName: best.trip.name, stamps: collection.stamps.filter((s) => s.tripId === id) };
}

/** Stamps in pages of `size`, newest first (the Passport's paper pages). */
export function stampPages<T>(stamps: readonly T[], size = 6): T[][] {
  const n = Math.max(1, Math.floor(size));
  const out: T[][] = [];
  for (let i = 0; i < stamps.length; i += n) out.push(stamps.slice(i, i + n));
  return out;
}

/** Compact stamp date ("12 MAR 2026"), from the wall date (never shifted by the phone's zone). */
export function stampDate(date: LocalDate, lang = 'en'): string {
  try {
    const f = new Intl.DateTimeFormat(lang, { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
    return f.format(new Date(wallMs(`${date}T00:00`))).replace(/\./g, '').toUpperCase();
  } catch {
    return date;
  }
}

// ---- drawing geometry (src/ui/Stamp.tsx turns this into react-native-svg) ----

/** The stamp canvas is STAMP_BOX x STAMP_BOX, centred on (STAMP_C, STAMP_C). */
export const STAMP_BOX = 120;
export const STAMP_C = 60;

export type Glyph = { ch: string; x: number; y: number; rotate: number };
export type StampGeometry = {
  /** Outer and inner outlines (closed paths). */
  outer: string;
  inner: string;
  /** Where the place name goes: along an arc (glyphs) or a straight line (x, y, width). */
  top: { arc: true; rx: number; ry: number } | { arc: false; y: number; width: number };
  bottom: { arc: true; rx: number; ry: number } | { arc: false; y: number; width: number };
  /** Vertical centre of the middle block (code + date). */
  middle: number;
  /** Width the middle lines may use. */
  middleWidth: number;
};

const r1 = (n: number) => Math.round(n * 10) / 10;
const polygon = (pts: ReadonlyArray<readonly [number, number]>) => `M${pts.map(([x, y]) => `${r1(x)} ${r1(y)}`).join(' L')} Z`;
const ellipse = (rx: number, ry: number) =>
  `M${STAMP_C - rx} ${STAMP_C} A${rx} ${ry} 0 1 0 ${STAMP_C + rx} ${STAMP_C} A${rx} ${ry} 0 1 0 ${STAMP_C - rx} ${STAMP_C} Z`;
const hexagon = (r: number) =>
  polygon(Array.from({ length: 6 }, (_, k) => [STAMP_C + r * Math.cos((Math.PI / 3) * k), STAMP_C + r * Math.sin((Math.PI / 3) * k)] as const));
const triangle = (inset: number) =>
  // a soft-cornered "triangle-ish" pennant: wide top, blunted point at the bottom
  polygon([
    [8 + inset, 14 + inset * 0.6],
    [112 - inset, 14 + inset * 0.6],
    [112 - inset, 30 + inset * 0.2],
    [66 - inset * 0.3, 108 - inset * 1.4],
    [54 + inset * 0.3, 108 - inset * 1.4],
    [8 + inset, 30 + inset * 0.2],
  ]);

export function stampGeometry(shape: StampShape): StampGeometry {
  switch (shape) {
    case 'round':
      return { outer: ellipse(56, 56), inner: ellipse(36, 36), top: { arc: true, rx: 46, ry: 46 }, bottom: { arc: true, rx: 46, ry: 46 }, middle: 60, middleWidth: 62 };
    case 'oval':
      return { outer: ellipse(58, 44), inner: ellipse(42, 29), top: { arc: true, rx: 50, ry: 36.5 }, bottom: { arc: true, rx: 50, ry: 36.5 }, middle: 60, middleWidth: 74 };
    case 'hexagon':
      return { outer: hexagon(57), inner: hexagon(38), top: { arc: true, rx: 43, ry: 43 }, bottom: { arc: true, rx: 43, ry: 43 }, middle: 60, middleWidth: 62 };
    case 'triangle':
      return { outer: triangle(0), inner: triangle(7), top: { arc: false, y: 30, width: 92 }, bottom: { arc: false, y: 82, width: 40 }, middle: 54, middleWidth: 64 };
    case 'rect':
    default:
      return {
        outer: polygon([[6, 22], [114, 22], [114, 98], [6, 98]]),
        inner: polygon([[13, 29], [107, 29], [107, 91], [13, 91]]),
        top: { arc: false, y: 42, width: 88 },
        bottom: { arc: false, y: 84, width: 88 },
        middle: 62,
        middleWidth: 88,
      };
  }
}

/** Width of one capital at `size` (a little generous, so text never overruns its arc). */
export const glyphWidth = (size: number) => size * 0.68;

/** Text that fits `room` at `size` (shrinks to minSize, then cuts with an ellipsis). */
export function fitText(text: string, room: number, size: number, minSize = 7): { text: string; size: number } {
  const chars = [...text.toUpperCase()];
  let s = size;
  while (s > minSize && chars.length * glyphWidth(s) > room) s -= 0.5;
  const max = Math.max(1, Math.floor(room / glyphWidth(s)));
  if (chars.length <= max) return { text: chars.join(''), size: s };
  return { text: `${chars.slice(0, Math.max(1, max - 1)).join('').trimEnd()}…`, size: s };
}

/**
 * Glyphs of `text` along the top (reading left to right over the top) or bottom (left to right under the bottom) of
 * an ellipse centred on the canvas. The arc used is at most ~200 degrees; longer text shrinks, then is cut.
 */
export function arcGlyphs(text: string, rx: number, ry: number, where: 'top' | 'bottom', size: number): { glyphs: Glyph[]; size: number } {
  const r = (rx + ry) / 2;
  const room = r * ((where === 'top' ? 200 : 140) * Math.PI) / 180;
  const fit = fitText(text, room, size);
  const chars = [...fit.text];
  const step = glyphWidth(fit.size) / r; // radians per glyph
  const mid = (chars.length - 1) / 2;
  const glyphs = chars.map((ch, i) => {
    const a = where === 'top' ? -Math.PI / 2 + (i - mid) * step : Math.PI / 2 - (i - mid) * step;
    const x = STAMP_C + rx * Math.cos(a);
    const y = STAMP_C + ry * Math.sin(a);
    const deg = (a * 180) / Math.PI + (where === 'top' ? 90 : -90);
    return { ch, x: r1(x), y: r1(y), rotate: r1(deg) };
  });
  return { glyphs, size: fit.size };
}

/** Small paper-coloured specks where the ink "missed" (stable per stamp), as [x, y, r]. */
export function inkSpecks(seed: number, n = 7): Array<[number, number, number]> {
  const out: Array<[number, number, number]> = [];
  let h = seed * 2654435761 >>> 0;
  for (let i = 0; i < n; i++) {
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
    const a = ((h % 360) * Math.PI) / 180;
    const d = 30 + ((h >>> 9) % 26);
    const r = 0.8 + ((h >>> 17) % 12) / 10;
    out.push([r1(STAMP_C + d * Math.cos(a)), r1(STAMP_C + d * Math.sin(a)), r1(r)]);
  }
  return out;
}

// ---- share text ----

export type StampWords = {
  heading: string;
  counts: (c: StampCounts) => string;
  line: (place: string, date: string, mark: StampMark) => string;
  footer: string;
};

/** Plain share text for a page (or the whole passport): place, date and mark only. */
export function stampsText(stamps: readonly PassportStamp[], w: StampWords, placeName: (s: PassportStamp) => string, formatDate: (d: LocalDate) => string): string {
  const lines = [w.heading, w.counts(countStamps(stamps)), ''];
  for (const s of stamps) lines.push(w.line(placeName(s), formatDate(s.date), s.mark));
  lines.push('', w.footer);
  return lines.join('\n');
}
