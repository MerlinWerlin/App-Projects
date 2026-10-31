// T95 Arrival card: when a trip reaches a new country (today's stop by the bookings, or the first booking there
// lands later today), a "Welcome to <country>" card pulls together what Satchel already holds offline:
//   - local time there and the difference from home (the trip's home zone, else the phone's)
//   - the traveller's own saved rate (Spending / converter) with what 10 / 50 / 100 is worth. Satchel bundles no
//     country -> currency table, so the currency is the trip's own: the one spent on days in this country, else the
//     converter's first choice. No rate or no home currency: money is null and the card offers the converter.
//   - plugs, voltage and driving side from src/content/country_essentials.json (always "verify locally")
//   - emergency numbers from src/content/emergency_numbers.json (always "verify locally")
//   - two phrase cards (hello, thank you) when phrases.json carries the country's language
//   - a hotel in this country with a map position, for the way-back shortcut
// plus a "Countries on this trip" strip with regional-indicator flags. Dismissed per country per trip; the memory
// is a list of "tripId|ISO" strings kept on the phone (usePersisted). Missing data is null, never guessed. A trip
// that never leaves the home country has no countries and shows nothing. Pure TypeScript; Node runs it directly.
import { convertAmount, defaultLocal, rateDates } from './convert.ts';
import { countryForZone, displayRow, FALLBACK_NUMBER, findCountry, type EmergencyTable, type NumberLine } from './emergency.ts';
import { displayEssentials, findEssentials, type DrivingSide, type EssentialsTable } from './essentials.ts';
import { clockPair } from './glance.ts';
import { homeZone, zoneAt } from './jetlag.ts';
import type { LocalDate, Trip } from './model.ts';
import { languageForCountry, phraseCard, type PhraseCard, type PhraseLang, type PhraseTable } from './phrases.ts';
import { currencyDigits, MAX_MINOR, rateFor, readSpending } from './spending.ts';
import { sortItems, zonesReadable } from './timeline.ts';
import { tileSeed, tripSpan } from './travelstats.ts';
import { fromUtc, localDate, toUtc } from './tz.ts';
import { hotelKey } from './wayback.ts';

/** Where dismissals are kept on the phone (usePersisted). */
export const ARRIVAL_DISMISS_KEY = 'satchel.arrival.dismissed.v1';
/** Oldest dismissals are dropped past this many. */
export const DISMISS_MAX = 200;

const ISO2 = /^[A-Z]{2}$/;

// ------------------------------------------------------------------ flags

/** The flag emoji for an ISO 3166-1 alpha-2 code (two regional-indicator letters), or null for anything else. */
export function flagEmoji(iso2: string | null | undefined): string | null {
  const code = typeof iso2 === 'string' ? iso2.trim().toUpperCase() : '';
  if (!ISO2.test(code)) return null;
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

// ------------------------------------------------------------------ dismiss memory

export const dismissKey = (tripId: string, iso2: string) => `${tripId}|${iso2.toUpperCase()}`;

/** Stored dismissals, read defensively: strings only, each once. */
export function normaliseDismissed(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const v of raw) if (typeof v === 'string' && v.includes('|') && !out.includes(v)) out.push(v);
  return out.slice(-DISMISS_MAX);
}

export const isDismissed = (raw: unknown, tripId: string, iso2: string): boolean => normaliseDismissed(raw).includes(dismissKey(tripId, iso2));

/** Adds one dismissal (newest last), keeping at most DISMISS_MAX. */
export function dismissArrival(raw: unknown, tripId: string, iso2: string): string[] {
  const key = dismissKey(tripId, iso2);
  const list = normaliseDismissed(raw).filter((k) => k !== key);
  list.push(key);
  return list.slice(-DISMISS_MAX);
}

// ------------------------------------------------------------------ which countries, which one now

/** The home country: the one set in Settings, else the country of the trip's home zone. Null when neither maps. */
export function homeCountryFor(trip: Pick<Trip, 'homeTz'>, homeIso2: string | null | undefined): string | null {
  const set = typeof homeIso2 === 'string' ? homeIso2.trim().toUpperCase() : '';
  if (ISO2.test(set)) return set;
  return countryForZone(trip.homeTz);
}

export type TripCountry = {
  iso2: string;
  /** The first zone the bookings use there. */
  zone: string;
  /** First and last moments (UTC ms) the bookings put you there: an arrival stamp, a check-in, an activity. */
  firstAt: number;
  lastAt: number;
  /** firstAt / lastAt as calendar days in that zone. */
  firstDay: LocalDate;
  lastDay: LocalDate;
};

/**
 * Countries the trip visits, in the order the bookings reach them, home left out. A journey counts for where it
 * lands (end stamp) and where it leaves from (start stamp); notes and unreadable zones are skipped.
 */
export function tripCountries(trip: Pick<Trip, 'items'>, home: string | null): TripCountry[] {
  const out: TripCountry[] = [];
  for (const i of sortItems(trip.items)) {
    if (!zonesReadable(i) || i.kind === 'note') continue;
    for (const s of [i.start, i.end]) {
      if (!s) continue;
      const iso2 = countryForZone(s.tz);
      if (!iso2 || iso2 === home) continue;
      const at = toUtc(s);
      if (!Number.isFinite(at)) continue;
      const day = localDate(s.local);
      const hit = out.find((c) => c.iso2 === iso2);
      if (!hit) out.push({ iso2, zone: s.tz, firstAt: at, lastAt: at, firstDay: day, lastDay: day });
      else {
        if (at < hit.firstAt) Object.assign(hit, { firstAt: at, firstDay: day, zone: s.tz });
        if (at > hit.lastAt) Object.assign(hit, { lastAt: at, lastDay: day });
      }
    }
  }
  return out.sort((a, b) => a.firstAt - b.firstAt);
}

export type Arriving = { iso2: string; zone: string; when: 'here' | 'today' };

/**
 * The country the card welcomes you to at `now`, or null:
 *   here   the bookings put you in a trip country now (zoneAt), and the trip has not ended there
 *   today  you are not there yet (home, in the air, elsewhere) but your first booking in a trip country is later
 *          today, read on that country's own calendar
 * Never from location or the phone's zone.
 */
export function arrivingCountry(trip: Trip, now: number, home: string | null): Arriving | null {
  const countries = tripCountries(trip, home);
  if (!countries.length) return null;
  const end = tripSpan(trip).end;
  const hereZone = zoneAt(trip, now);
  const hereIso = countryForZone(hereZone);
  const here = hereIso ? countries.find((c) => c.iso2 === hereIso) : undefined;
  if (here && hereZone && localDate(fromUtc(now, hereZone)) <= end) return { iso2: here.iso2, zone: hereZone, when: 'here' };
  const today = countries.find((c) => c.firstAt > now && localDate(fromUtc(now, c.zone)) === c.firstDay);
  return today ? { iso2: today.iso2, zone: today.zone, when: 'today' } : null;
}

// ------------------------------------------------------------------ the card

/** Local amounts for the quick rows (scaled by a power of ten for currencies whose unit is worth very little). */
export const ARRIVAL_STEPS = [10, 50, 100] as const;

export type MoneyRow = { local: number; home: number };
export type ArrivalMoney = { local: string; home: string; rate: number; rateDay: LocalDate | null; rows: MoneyRow[] };

export type ArrivalPower = {
  plugs: string | null;
  voltage: string | null;
  frequency: string | null;
  driving: DrivingSide | null;
  checked: string | null;
  sourceHosts: string[];
  verifyLocally: true;
};

export type ArrivalEmergency = {
  lines: NumberLine[];
  /** No dialable number in the table: the card shows FALLBACK_NUMBER and points to the Emergency tab. */
  fallback: string | null;
  checked: string | null;
  verifyLocally: true;
};

export type StripCountry = { iso2: string; country: string; flag: string | null; state: 'been' | 'now' | 'ahead' };

/** Hero gradients the card can wear (theme.hero keys), picked per country so each stop keeps its colour. */
export const ARRIVAL_TONES = ['map', 'wallet', 'trips', 'toilets'] as const;
export type ArrivalTone = (typeof ARRIVAL_TONES)[number];

export type ArrivalView = {
  tripId: string;
  tripName: string;
  iso2: string;
  country: string;
  flag: string | null;
  zone: string;
  when: 'here' | 'today';
  tone: ArrivalTone;
  clock: { time: string; homeTime: string; homeZone: string; diffMinutes: number } | null;
  money: ArrivalMoney | null;
  /** Home currency and rate: what the card is missing for the money row (it offers the converter). */
  moneyMissing: 'home' | 'rate' | null;
  power: ArrivalPower | null;
  emergency: ArrivalEmergency | null;
  phrases: { lang: PhraseLang; cards: PhraseCard[] } | null;
  /** Wayback target key for a hotel in this country with a map position (the stay covering today first). */
  hotelTarget: string | null;
  countries: StripCountry[];
};

export type ArrivalTables = { essentials: EssentialsTable; emergency: EmergencyTable; phrases: PhraseTable };

/** The country's English name from the bundled tables, else its code. */
export function countryNameFrom(tables: Pick<ArrivalTables, 'essentials' | 'emergency'>, iso2: string): string {
  return findEssentials(tables.essentials, iso2)?.country ?? findCountry(tables.emergency, iso2)?.country ?? iso2;
}

/** The smallest power of ten (1 or more) that makes the first quick row worth at least half a home unit. */
function stepScale(rate: number): number {
  let m = 1;
  while (ARRIVAL_STEPS[0] * m * rate < 0.5 && m < 1e6) m *= 10;
  return m;
}

/** The trip's currency for this country: most spent (with a rate) on days the trip is there, else the converter's first. */
function moneyFor(trip: Trip, c: TripCountry | undefined): { money: ArrivalMoney | null; missing: 'home' | 'rate' | null } {
  const s = readSpending(trip);
  const home = s.budget?.currency ?? null;
  if (!home) return { money: null, missing: 'home' };
  const spent = new Map<string, number>();
  if (c) for (const e of s.expenses) if (e.currency !== home && rateFor(e.currency, home, s.rates) != null && e.day >= c.firstDay && e.day <= c.lastDay) spent.set(e.currency, (spent.get(e.currency) ?? 0) + 1);
  const ranked = [...spent.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  const local = ranked[0]?.[0] ?? defaultLocal(s, home);
  const rate = local ? rateFor(local, home, s.rates) : null;
  if (!local || rate == null) return { money: null, missing: 'rate' };
  const m = stepScale(rate);
  const rows: MoneyRow[] = [];
  for (const step of ARRIVAL_STEPS) {
    const localMinor = step * m * 10 ** currencyDigits(local);
    const homeMinor = convertAmount(localMinor, local, home, rate);
    if (homeMinor != null && localMinor <= MAX_MINOR) rows.push({ local: localMinor, home: homeMinor });
  }
  if (!rows.length) return { money: null, missing: 'rate' };
  return { money: { local, home, rate, rateDay: rateDates(trip)[local] ?? null, rows }, missing: null };
}

/** A hotel in this country with a map position: the stay covering `today` there first, then the earliest check-in. */
function hotelIn(trip: Trip, iso2: string, now: number): string | null {
  const hotels = sortItems(trip.items).filter(
    (i) => i.kind === 'hotel' && zonesReadable(i) && countryForZone(i.start.tz) === iso2 && typeof i.place?.lat === 'number' && typeof i.place?.lon === 'number' && Number.isFinite(i.place.lat) && Number.isFinite(i.place.lon),
  );
  const covering = hotels.find((i) => toUtc(i.start) <= now && (!i.end || toUtc(i.end) >= now));
  const next = hotels.find((i) => !i.end || toUtc(i.end) >= now);
  const pick = covering ?? next ?? null;
  return pick ? hotelKey(pick.id) : null;
}

/** Everything the card shows for one trip, or null when nothing is arriving, it was dismissed, or it is a home trip. */
export function arrivalView(
  trip: Trip,
  opts: { now: number; homeIso2?: string | null; phoneZone: string; dismissed?: unknown; tables: ArrivalTables },
): ArrivalView | null {
  const home = homeCountryFor(trip, opts.homeIso2);
  const a = arrivingCountry(trip, opts.now, home);
  if (!a || isDismissed(opts.dismissed, trip.id, a.iso2)) return null;
  const countries = tripCountries(trip, home);
  const c = countries.find((x) => x.iso2 === a.iso2);
  const { tables } = opts;

  const hz = homeZone(trip, opts.phoneZone);
  const cp = clockPair(a.zone, hz, opts.now);

  const er = findEssentials(tables.essentials, a.iso2);
  const ed = er ? displayEssentials(er) : null;
  const power: ArrivalPower | null = ed
    ? { plugs: ed.plugs, voltage: ed.voltage, frequency: ed.frequency, driving: ed.driving, checked: ed.checked, sourceHosts: ed.sourceHosts, verifyLocally: true }
    : null;

  const emRow = findCountry(tables.emergency, a.iso2);
  const rd = emRow ? displayRow(emRow) : null;
  const emergency: ArrivalEmergency | null = rd
    ? { lines: rd.lines, fallback: rd.noNumber ? FALLBACK_NUMBER : null, checked: rd.source.kind === 'checked' ? rd.source.date : null, verifyLocally: true }
    : null;

  const lang = languageForCountry(tables.phrases, a.iso2);
  const cards = lang ? (['hello', 'thanks'] as const).map((id) => phraseCard(tables.phrases, lang, id)).filter((x): x is PhraseCard => x !== null) : [];

  const { money, missing } = moneyFor(trip, c);
  return {
    tripId: trip.id,
    tripName: trip.name,
    iso2: a.iso2,
    country: countryNameFrom(tables, a.iso2),
    flag: flagEmoji(a.iso2),
    zone: a.zone,
    when: a.when,
    tone: ARRIVAL_TONES[tileSeed(a.iso2) % ARRIVAL_TONES.length],
    clock: cp ? { time: cp.destTime, homeTime: cp.homeTime, homeZone: hz, diffMinutes: cp.diffMinutes } : null,
    money,
    moneyMissing: missing,
    power,
    emergency,
    phrases: lang && cards.length ? { lang, cards } : null,
    hotelTarget: hotelIn(trip, a.iso2, opts.now),
    countries: countryStrip(trip, opts.now, home, tables, a.iso2),
  };
}

/** The "Countries on this trip" strip: every trip country in order, marked been / now / ahead. */
export function countryStrip(trip: Trip, now: number, home: string | null, tables: Pick<ArrivalTables, 'essentials' | 'emergency'>, current?: string | null): StripCountry[] {
  const cur = current === undefined ? (arrivingCountry(trip, now, home)?.iso2 ?? null) : current;
  return tripCountries(trip, home).map((c) => ({
    iso2: c.iso2,
    country: countryNameFrom(tables, c.iso2),
    flag: flagEmoji(c.iso2),
    state: c.iso2 === cur ? 'now' : c.firstAt <= now ? 'been' : 'ahead',
  }));
}

/** The Trips tab's card: the first trip (in the order given) with a country arriving now that isn't dismissed. */
export function arrivalForTrips(trips: readonly Trip[], opts: Parameters<typeof arrivalView>[1]): ArrivalView | null {
  for (const t of trips) {
    const v = arrivalView(t, opts);
    if (v) return v;
  }
  return null;
}
