// T106 Public holidays on your trip: public holidays computed by rule, offline, for the countries travellers visit
// most. Rules are: a fixed date, a day relative to Easter (Gregorian computus) or Orthodox Easter (Julian computus,
// shown on the Gregorian calendar), the nth or last weekday of a month, the first given weekday on or after a date,
// plus simple weekend shifts ("falls on a Sunday: the Monday is off"). Each country lists what it leaves out
// (regional days, lunar / Islamic / Hindu calendar days, days set each year by decree) so the screen can say so.
//
// Written from general knowledge on 2026-10-31 (HOLIDAYS_CHECKED) for the years HOLIDAY_YEARS covers; a day we were
// not sure of is left out rather than guessed, and the screen always says "general guidance, verify locally".
// Holiday names are English proper names (like the country names in src/content tables); every other word on screen
// is in src/i18n/en/holidays.ts. Which country a stop is in comes from the trip's own bookings and zones
// (arrival.ts tripCountries, jetlag.ts zoneAt, emergency.ts countryForZone), never from location.
// Pure TypeScript; Node runs it directly.
import { tripCountries } from './arrival.ts';
import { countryForZone } from './emergency.ts';
import { zoneAt } from './jetlag.ts';
import type { LocalDate, Trip } from './model.ts';
import { tripSpan } from './travelstats.ts';
import { fromUtc, localDate } from './tz.ts';

export const HOLIDAYS_CHECKED = '2026-10-31';
/** Years the rules are written for. Outside them nothing is shown (rules change; we don't guess). */
export const HOLIDAY_YEARS = { from: 2023, to: 2035 } as const;

/** What a country's list leaves out; each code has a sentence in src/i18n/en/holidays.ts (holidays.note.<code>). */
export const NOTE_CODES = [
  'regional', // state, province, canton or city days
  'lunar', // Chinese / Korean lunar-calendar days
  'islamic', // Islamic-calendar days
  'hindu', // Hindu-calendar days (e.g. Deepavali)
  'buddhist', // Buddhist lunar days
  'decree', // days moved or added each year by decree (bridge days, extra days)
  'oneoff', // one-off days (royal events, elections)
  'eves', // eves that are not public holidays but where most places close
  'optional', // optional days (Carnival, Corpus Christi in Brazil)
  'gbNations', // the UK's nations differ
  'jpNewYear', // Japan: 2-3 January and year-end closures
  'jpEquinox', // Japan: equinox days by formula
  'krSubstitute', // Korea: substitute days next to lunar holidays
  'mxHolyWeek', // Mexico: Holy Thursday and Good Friday
  'grMayDay', // Greece: May Day moved when it falls near Easter
  'nzMatariki', // New Zealand: Matariki dates set in law
] as const;
export type NoteCode = (typeof NOTE_CODES)[number];

/** 0 = Sunday … 6 = Saturday. */
type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;
const SUN = 0, MON = 1, THU = 4, FRI = 5, SAT = 6;

/**
 * How a fixed day moves off a weekend:
 *   weekend   Saturday or Sunday → the next weekday that isn't already a holiday (UK / NZ / AU substitute days)
 *   sunday    Sunday → the next day that isn't already a holiday
 *   sunMon    Sunday → the Monday, unless the Monday is already a holiday (South Africa)
 *   us        Saturday → the Friday before, Sunday → the Monday after (US federal)
 *   sunSat    Sunday → the Saturday before (Netherlands, King's Day)
 */
export type Shift = 'weekend' | 'sunday' | 'sunMon' | 'us' | 'sunSat';

type When =
  | { k: 'fixed'; m: number; d: number }
  | { k: 'easter'; off: number }
  | { k: 'orthodox'; off: number }
  | { k: 'nth'; m: number; wd: Weekday; n: number } // n = 1..5, or -1 for the last
  | { k: 'onOrAfter'; m: number; d: number; wd: Weekday }
  | { k: 'table'; dates: Readonly<Record<number, string>> } // MM-DD by year, for days set in law year by year
  | { k: 'custom'; f: (y: number) => LocalDate | null };

export type Rule = {
  name: string;
  when: When;
  shift?: Shift;
  /** Only from / up to this year (a holiday added or dropped in the covered years). */
  from?: number;
  to?: number;
  /** Not kept everywhere in the country (the screen says so). */
  partial?: boolean;
};

export type CountryHolidays = {
  iso2: string;
  rules: readonly Rule[];
  notes: readonly NoteCode[];
  /** Japan: substitute days for Sundays and the "citizens' holiday" between two holidays. */
  jp?: boolean;
};

export type Holiday = {
  date: LocalDate;
  iso2: string;
  name: string;
  /** A day off in place of a holiday that fell on a weekend (or Japan's in-between day). */
  substitute?: boolean;
  /** Not kept everywhere in the country. */
  partial?: boolean;
};

// ------------------------------------------------------------------ dates

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (y: number, m: number, d: number): LocalDate => `${y}-${pad(m)}-${pad(d)}`;
const toMs = (date: LocalDate) => Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)));
const fromMs = (ms: number): LocalDate => {
  const d = new Date(ms);
  return ymd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
};
const DAY = 86_400_000;
export const shiftDate = (date: LocalDate, n: number): LocalDate => fromMs(toMs(date) + n * DAY);
export const weekdayOf = (date: LocalDate): Weekday => new Date(toMs(date)).getUTCDay() as Weekday;

/** Western (Gregorian) Easter Sunday: the anonymous Gregorian algorithm (Meeus / Jones / Butcher). */
export function easterSunday(y: number): LocalDate {
  const a = y % 19;
  const b = Math.floor(y / 100);
  const c = y % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return ymd(y, month, day);
}

/** Orthodox Easter Sunday on the Gregorian calendar: Meeus' Julian algorithm plus the 13-day gap (1900-2099). */
export function orthodoxEaster(y: number): LocalDate {
  const a = y % 4;
  const b = y % 7;
  const c = y % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31);
  const day = ((d + e + 114) % 31) + 1;
  return shiftDate(ymd(y, month, day), 13);
}

/** The nth (1-based) given weekday of a month, or the last one with n = -1. */
export function nthWeekday(y: number, m: number, wd: Weekday, n: number): LocalDate {
  if (n < 0) {
    const last = shiftDate(ymd(m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1, 1), -1);
    return shiftDate(last, -((weekdayOf(last) - wd + 7) % 7));
  }
  const first = ymd(y, m, 1);
  return shiftDate(first, ((wd - weekdayOf(first) + 7) % 7) + (n - 1) * 7);
}

/** The first given weekday on or after a date ("the Saturday between 20 and 26 June"). */
export function onOrAfter(y: number, m: number, d: number, wd: Weekday): LocalDate {
  const start = ymd(y, m, d);
  return shiftDate(start, (wd - weekdayOf(start) + 7) % 7);
}

/** Japan's equinox days by the formula the Cabinet Office uses (valid 1980-2099; officially confirmed each February). */
export function jpEquinox(y: number, season: 'spring' | 'autumn'): LocalDate {
  const base = season === 'spring' ? 20.8431 : 23.2488;
  const day = Math.floor(base + 0.242194 * (y - 1980) - Math.floor((y - 1980) / 4));
  return ymd(y, season === 'spring' ? 3 : 9, day);
}

function dateOf(w: When, y: number): LocalDate | null {
  switch (w.k) {
    case 'fixed':
      return ymd(y, w.m, w.d);
    case 'easter':
      return shiftDate(easterSunday(y), w.off);
    case 'orthodox':
      return shiftDate(orthodoxEaster(y), w.off);
    case 'nth':
      return nthWeekday(y, w.m, w.wd, w.n);
    case 'onOrAfter':
      return onOrAfter(y, w.m, w.d, w.wd);
    case 'table':
      return w.dates[y] ? `${y}-${w.dates[y]}` : null;
    case 'custom':
      return w.f(y);
  }
}

// ------------------------------------------------------------------ rule shorthands

const fixed = (m: number, d: number, name: string, extra: Partial<Rule> = {}): Rule => ({ name, when: { k: 'fixed', m, d }, ...extra });
const easter = (off: number, name: string, extra: Partial<Rule> = {}): Rule => ({ name, when: { k: 'easter', off }, ...extra });
const orth = (off: number, name: string): Rule => ({ name, when: { k: 'orthodox', off } });
const nth = (m: number, wd: Weekday, n: number, name: string, extra: Partial<Rule> = {}): Rule => ({ name, when: { k: 'nth', m, wd, n }, ...extra });
const after = (m: number, d: number, wd: Weekday, name: string): Rule => ({ name, when: { k: 'onOrAfter', m, d, wd } });

const NEW_YEAR = 'New Year’s Day';
const GOOD_FRIDAY = 'Good Friday';
const EASTER_SUNDAY = 'Easter Sunday';
const EASTER_MONDAY = 'Easter Monday';
const ASCENSION = 'Ascension Day';
const WHIT_SUNDAY = 'Whit Sunday';
const WHIT_MONDAY = 'Whit Monday';
const CORPUS = 'Corpus Christi';
const LABOUR = 'Labour Day';
const ASSUMPTION = 'Assumption Day';
const ALL_SAINTS = 'All Saints’ Day';
const IMMACULATE = 'Immaculate Conception';
const CHRISTMAS = 'Christmas Day';
const BOXING = 'Boxing Day';
const ST_STEPHEN = 'St Stephen’s Day';
const EPIPHANY = 'Epiphany';
const MAUNDY = 'Maundy Thursday';
const CHRISTMAS_EVE = 'Christmas Eve';

/** New Zealand's Matariki, set in law year by year (Te Kāhui o Matariki Public Holiday Act 2022 schedule). */
const MATARIKI: Record<number, string> = { 2023: '07-14', 2024: '06-28', 2025: '06-20', 2026: '07-10', 2027: '06-25', 2028: '07-14', 2029: '07-06', 2030: '06-21' };

/** Ireland's St Brigid's Day: the first Monday in February, or 1 February when that is a Friday (from 2023). */
const stBrigid = (y: number): LocalDate => (weekdayOf(ymd(y, 2, 1)) === FRI ? ymd(y, 2, 1) : nthWeekday(y, 2, MON, 1));

/** Greece: May Day stands unless it falls in the fortnight around Orthodox Easter, when the date is set by decree. */
const grMayDay = (y: number): LocalDate | null => {
  const may1 = ymd(y, 5, 1);
  const e = orthodoxEaster(y);
  return may1 >= shiftDate(e, -7) && may1 <= shiftDate(e, 7) ? null : may1;
};

// ------------------------------------------------------------------ the table

export const COUNTRY_HOLIDAYS: Readonly<Record<string, CountryHolidays>> = {
  AU: {
    iso2: 'AU',
    notes: ['regional'],
    rules: [
      fixed(1, 1, NEW_YEAR, { shift: 'weekend' }),
      fixed(1, 26, 'Australia Day', { shift: 'sunday' }),
      easter(-2, GOOD_FRIDAY),
      easter(1, EASTER_MONDAY),
      fixed(4, 25, 'Anzac Day'),
      fixed(12, 25, CHRISTMAS, { shift: 'weekend' }),
      fixed(12, 26, BOXING, { shift: 'weekend' }),
    ],
  },
  NZ: {
    iso2: 'NZ',
    notes: ['regional', 'nzMatariki'],
    rules: [
      fixed(1, 1, NEW_YEAR, { shift: 'weekend' }),
      fixed(1, 2, 'Day after New Year’s Day', { shift: 'weekend' }),
      fixed(2, 6, 'Waitangi Day', { shift: 'weekend' }),
      easter(-2, GOOD_FRIDAY),
      easter(1, EASTER_MONDAY),
      fixed(4, 25, 'Anzac Day', { shift: 'weekend' }),
      nth(6, MON, 1, 'King’s Birthday'),
      { name: 'Matariki', when: { k: 'table', dates: MATARIKI } },
      nth(10, MON, 4, 'Labour Day'),
      fixed(12, 25, CHRISTMAS, { shift: 'weekend' }),
      fixed(12, 26, BOXING, { shift: 'weekend' }),
    ],
  },
  GB: {
    iso2: 'GB',
    notes: ['gbNations', 'oneoff'],
    rules: [
      fixed(1, 1, NEW_YEAR, { shift: 'weekend' }),
      easter(-2, GOOD_FRIDAY),
      nth(5, MON, 1, 'Early May bank holiday'),
      nth(5, MON, -1, 'Spring bank holiday'),
      fixed(12, 25, CHRISTMAS, { shift: 'weekend' }),
      fixed(12, 26, BOXING, { shift: 'weekend' }),
    ],
  },
  IE: {
    iso2: 'IE',
    notes: ['eves'],
    rules: [
      fixed(1, 1, NEW_YEAR, { shift: 'weekend' }),
      { name: 'St Brigid’s Day', when: { k: 'custom', f: stBrigid } },
      fixed(3, 17, 'St Patrick’s Day', { shift: 'weekend' }),
      easter(1, EASTER_MONDAY),
      nth(5, MON, 1, 'May bank holiday'),
      nth(6, MON, 1, 'June bank holiday'),
      nth(8, MON, 1, 'August bank holiday'),
      nth(10, MON, -1, 'October bank holiday'),
      fixed(12, 25, CHRISTMAS, { shift: 'weekend' }),
      fixed(12, 26, ST_STEPHEN, { shift: 'weekend' }),
    ],
  },
  US: {
    iso2: 'US',
    notes: ['regional'],
    rules: [
      fixed(1, 1, NEW_YEAR, { shift: 'us' }),
      nth(1, MON, 3, 'Martin Luther King Jr. Day'),
      nth(2, MON, 3, 'Washington’s Birthday'),
      nth(5, MON, -1, 'Memorial Day'),
      fixed(6, 19, 'Juneteenth', { shift: 'us' }),
      fixed(7, 4, 'Independence Day', { shift: 'us' }),
      nth(9, MON, 1, 'Labor Day'),
      nth(10, MON, 2, 'Columbus Day'),
      fixed(11, 11, 'Veterans Day', { shift: 'us' }),
      nth(11, THU, 4, 'Thanksgiving Day'),
      fixed(12, 25, CHRISTMAS, { shift: 'us' }),
    ],
  },
  CA: {
    iso2: 'CA',
    notes: ['regional'],
    rules: [
      fixed(1, 1, NEW_YEAR, { shift: 'weekend' }),
      easter(-2, GOOD_FRIDAY),
      { ...after(5, 18, MON, 'Victoria Day'), partial: true },
      fixed(7, 1, 'Canada Day', { shift: 'sunday' }),
      nth(9, MON, 1, 'Labour Day'),
      fixed(9, 30, 'National Day for Truth and Reconciliation', { partial: true }),
      nth(10, MON, 2, 'Thanksgiving'),
      fixed(11, 11, 'Remembrance Day', { partial: true }),
      fixed(12, 25, CHRISTMAS, { shift: 'weekend' }),
      fixed(12, 26, BOXING, { shift: 'weekend', partial: true }),
    ],
  },
  FR: {
    iso2: 'FR',
    notes: ['regional'],
    rules: [
      fixed(1, 1, NEW_YEAR),
      easter(1, EASTER_MONDAY),
      fixed(5, 1, LABOUR),
      fixed(5, 8, 'Victory in Europe Day'),
      easter(39, ASCENSION),
      easter(50, WHIT_MONDAY),
      fixed(7, 14, 'Bastille Day'),
      fixed(8, 15, ASSUMPTION),
      fixed(11, 1, ALL_SAINTS),
      fixed(11, 11, 'Armistice Day'),
      fixed(12, 25, CHRISTMAS),
    ],
  },
  DE: {
    iso2: 'DE',
    notes: ['regional'],
    rules: [
      fixed(1, 1, NEW_YEAR),
      easter(-2, GOOD_FRIDAY),
      easter(1, EASTER_MONDAY),
      fixed(5, 1, LABOUR),
      easter(39, ASCENSION),
      easter(50, WHIT_MONDAY),
      fixed(10, 3, 'Day of German Unity'),
      fixed(12, 25, CHRISTMAS),
      fixed(12, 26, 'Second Day of Christmas'),
    ],
  },
  IT: {
    iso2: 'IT',
    notes: ['regional'],
    rules: [
      fixed(1, 1, NEW_YEAR),
      fixed(1, 6, EPIPHANY),
      easter(1, EASTER_MONDAY),
      fixed(4, 25, 'Liberation Day'),
      fixed(5, 1, LABOUR),
      fixed(6, 2, 'Republic Day'),
      fixed(8, 15, 'Ferragosto (Assumption Day)'),
      // T108: a national holiday again from 2026 (law of October 2025 restoring 4 October); no weekend shift in Italy.
      fixed(10, 4, 'Feast of St Francis of Assisi', { from: 2026 }),
      fixed(11, 1, ALL_SAINTS),
      fixed(12, 8, IMMACULATE),
      fixed(12, 25, CHRISTMAS),
      fixed(12, 26, ST_STEPHEN),
    ],
  },
  ES: {
    iso2: 'ES',
    notes: ['regional'],
    rules: [
      fixed(1, 1, NEW_YEAR),
      fixed(1, 6, EPIPHANY),
      easter(-2, GOOD_FRIDAY),
      fixed(5, 1, LABOUR),
      fixed(8, 15, ASSUMPTION),
      fixed(10, 12, 'National Day of Spain'),
      fixed(11, 1, ALL_SAINTS),
      fixed(12, 6, 'Constitution Day'),
      fixed(12, 8, IMMACULATE),
      fixed(12, 25, CHRISTMAS),
    ],
  },
  PT: {
    iso2: 'PT',
    notes: ['regional', 'optional'],
    rules: [
      fixed(1, 1, NEW_YEAR),
      easter(-2, GOOD_FRIDAY),
      easter(0, EASTER_SUNDAY),
      fixed(4, 25, 'Freedom Day'),
      fixed(5, 1, LABOUR),
      easter(60, CORPUS),
      fixed(6, 10, 'Portugal Day'),
      fixed(8, 15, ASSUMPTION),
      fixed(10, 5, 'Republic Day'),
      fixed(11, 1, ALL_SAINTS),
      fixed(12, 1, 'Restoration of Independence'),
      fixed(12, 8, IMMACULATE),
      fixed(12, 25, CHRISTMAS),
    ],
  },
  NL: {
    iso2: 'NL',
    notes: ['eves'],
    rules: [
      fixed(1, 1, NEW_YEAR),
      easter(0, EASTER_SUNDAY),
      easter(1, EASTER_MONDAY),
      fixed(4, 27, 'King’s Day', { shift: 'sunSat' }),
      fixed(5, 5, 'Liberation Day'),
      easter(39, ASCENSION),
      easter(49, WHIT_SUNDAY),
      easter(50, WHIT_MONDAY),
      fixed(12, 25, CHRISTMAS),
      fixed(12, 26, 'Second Day of Christmas'),
    ],
  },
  BE: {
    iso2: 'BE',
    notes: ['regional'],
    rules: [
      fixed(1, 1, NEW_YEAR),
      easter(1, EASTER_MONDAY),
      fixed(5, 1, LABOUR),
      easter(39, ASCENSION),
      easter(50, WHIT_MONDAY),
      fixed(7, 21, 'Belgian National Day'),
      fixed(8, 15, ASSUMPTION),
      fixed(11, 1, ALL_SAINTS),
      fixed(11, 11, 'Armistice Day'),
      fixed(12, 25, CHRISTMAS),
    ],
  },
  CH: {
    iso2: 'CH',
    notes: ['regional'],
    rules: [
      fixed(1, 1, NEW_YEAR),
      easter(-2, GOOD_FRIDAY, { partial: true }),
      easter(1, EASTER_MONDAY, { partial: true }),
      easter(39, ASCENSION),
      easter(50, WHIT_MONDAY, { partial: true }),
      fixed(8, 1, 'Swiss National Day'),
      fixed(12, 25, CHRISTMAS),
      fixed(12, 26, ST_STEPHEN, { partial: true }),
    ],
  },
  AT: {
    iso2: 'AT',
    notes: ['regional'],
    rules: [
      fixed(1, 1, NEW_YEAR),
      fixed(1, 6, EPIPHANY),
      easter(1, EASTER_MONDAY),
      fixed(5, 1, 'National Holiday (Labour Day)'),
      easter(39, ASCENSION),
      easter(50, WHIT_MONDAY),
      easter(60, CORPUS),
      fixed(8, 15, ASSUMPTION),
      fixed(10, 26, 'National Day'),
      fixed(11, 1, ALL_SAINTS),
      fixed(12, 8, IMMACULATE),
      fixed(12, 25, CHRISTMAS),
      fixed(12, 26, ST_STEPHEN),
    ],
  },
  GR: {
    iso2: 'GR',
    notes: ['regional', 'grMayDay'],
    rules: [
      fixed(1, 1, NEW_YEAR),
      fixed(1, 6, EPIPHANY),
      orth(-48, 'Clean Monday'),
      fixed(3, 25, 'Independence Day'),
      orth(-2, 'Orthodox Good Friday'),
      orth(0, 'Orthodox Easter Sunday'),
      orth(1, 'Orthodox Easter Monday'),
      { name: LABOUR, when: { k: 'custom', f: grMayDay } },
      orth(50, 'Whit Monday (Holy Spirit Day)'),
      fixed(8, 15, ASSUMPTION),
      fixed(10, 28, 'Ochi Day'),
      fixed(12, 25, CHRISTMAS),
      fixed(12, 26, 'Synaxis of the Mother of God'),
    ],
  },
  SE: {
    iso2: 'SE',
    notes: ['eves'],
    rules: [
      fixed(1, 1, NEW_YEAR),
      fixed(1, 6, EPIPHANY),
      easter(-2, GOOD_FRIDAY),
      easter(0, EASTER_SUNDAY),
      easter(1, EASTER_MONDAY),
      fixed(5, 1, 'May Day'),
      easter(39, ASCENSION),
      easter(49, WHIT_SUNDAY),
      fixed(6, 6, 'National Day of Sweden'),
      after(6, 20, SAT, 'Midsummer Day'),
      after(10, 31, SAT, ALL_SAINTS),
      fixed(12, 25, CHRISTMAS),
      fixed(12, 26, 'Second Day of Christmas'),
    ],
  },
  NO: {
    iso2: 'NO',
    notes: ['eves'],
    rules: [
      fixed(1, 1, NEW_YEAR),
      easter(-3, MAUNDY),
      easter(-2, GOOD_FRIDAY),
      easter(0, EASTER_SUNDAY),
      easter(1, EASTER_MONDAY),
      fixed(5, 1, LABOUR),
      fixed(5, 17, 'Constitution Day'),
      easter(39, ASCENSION),
      easter(49, WHIT_SUNDAY),
      easter(50, WHIT_MONDAY),
      fixed(12, 25, CHRISTMAS),
      fixed(12, 26, 'Second Day of Christmas'),
    ],
  },
  DK: {
    iso2: 'DK',
    notes: ['eves'],
    rules: [
      fixed(1, 1, NEW_YEAR),
      easter(-3, MAUNDY),
      easter(-2, GOOD_FRIDAY),
      easter(0, EASTER_SUNDAY),
      easter(1, EASTER_MONDAY),
      easter(26, 'Great Prayer Day', { to: 2023 }),
      easter(39, ASCENSION),
      easter(49, WHIT_SUNDAY),
      easter(50, WHIT_MONDAY),
      fixed(12, 25, CHRISTMAS),
      fixed(12, 26, 'Second Day of Christmas'),
    ],
  },
  FI: {
    iso2: 'FI',
    notes: ['eves'],
    rules: [
      fixed(1, 1, NEW_YEAR),
      fixed(1, 6, EPIPHANY),
      easter(-2, GOOD_FRIDAY),
      easter(0, EASTER_SUNDAY),
      easter(1, EASTER_MONDAY),
      fixed(5, 1, 'May Day'),
      easter(39, ASCENSION),
      after(6, 20, SAT, 'Midsummer Day'),
      after(10, 31, SAT, ALL_SAINTS),
      fixed(12, 6, 'Independence Day'),
      fixed(12, 25, CHRISTMAS),
      fixed(12, 26, ST_STEPHEN),
    ],
  },
  PL: {
    iso2: 'PL',
    notes: ['eves'],
    rules: [
      fixed(1, 1, NEW_YEAR),
      fixed(1, 6, EPIPHANY),
      easter(0, EASTER_SUNDAY),
      easter(1, EASTER_MONDAY),
      fixed(5, 1, LABOUR),
      fixed(5, 3, 'Constitution Day'),
      easter(49, 'Pentecost'),
      easter(60, CORPUS),
      fixed(8, 15, ASSUMPTION),
      fixed(11, 1, ALL_SAINTS),
      fixed(11, 11, 'Independence Day'),
      fixed(12, 24, CHRISTMAS_EVE, { from: 2025 }),
      fixed(12, 25, CHRISTMAS),
      fixed(12, 26, 'Second Day of Christmas'),
    ],
  },
  CZ: {
    iso2: 'CZ',
    notes: ['regional'],
    rules: [
      fixed(1, 1, 'Restoration Day of the Czech State'),
      easter(-2, GOOD_FRIDAY),
      easter(1, EASTER_MONDAY),
      fixed(5, 1, LABOUR),
      fixed(5, 8, 'Liberation Day'),
      fixed(7, 5, 'Saints Cyril and Methodius Day'),
      fixed(7, 6, 'Jan Hus Day'),
      fixed(9, 28, 'Czech Statehood Day'),
      fixed(10, 28, 'Independent Czechoslovak State Day'),
      fixed(11, 17, 'Struggle for Freedom and Democracy Day'),
      fixed(12, 24, CHRISTMAS_EVE),
      fixed(12, 25, CHRISTMAS),
      fixed(12, 26, ST_STEPHEN),
    ],
  },
  HU: {
    iso2: 'HU',
    notes: ['decree'],
    rules: [
      fixed(1, 1, NEW_YEAR),
      fixed(3, 15, 'National Day (1848 Revolution)'),
      easter(-2, GOOD_FRIDAY),
      easter(1, EASTER_MONDAY),
      fixed(5, 1, LABOUR),
      easter(50, WHIT_MONDAY),
      fixed(8, 20, 'St Stephen’s Day (State Foundation Day)'),
      fixed(10, 23, 'National Day (1956 Revolution)'),
      fixed(11, 1, ALL_SAINTS),
      fixed(12, 25, CHRISTMAS),
      fixed(12, 26, 'Second Day of Christmas'),
    ],
  },
  HR: {
    iso2: 'HR',
    notes: ['regional'],
    rules: [
      fixed(1, 1, NEW_YEAR),
      fixed(1, 6, EPIPHANY),
      easter(0, EASTER_SUNDAY),
      easter(1, EASTER_MONDAY),
      fixed(5, 1, LABOUR),
      fixed(5, 30, 'Statehood Day'),
      easter(60, CORPUS),
      fixed(6, 22, 'Anti-Fascist Struggle Day'),
      fixed(8, 5, 'Victory and Homeland Thanksgiving Day'),
      fixed(8, 15, ASSUMPTION),
      fixed(11, 1, ALL_SAINTS),
      fixed(11, 18, 'Remembrance Day'),
      fixed(12, 25, CHRISTMAS),
      fixed(12, 26, ST_STEPHEN),
    ],
  },
  JP: {
    iso2: 'JP',
    jp: true,
    notes: ['jpNewYear', 'jpEquinox', 'oneoff'],
    rules: [
      fixed(1, 1, NEW_YEAR),
      nth(1, MON, 2, 'Coming of Age Day'),
      fixed(2, 11, 'National Foundation Day'),
      fixed(2, 23, 'Emperor’s Birthday'),
      { name: 'Vernal Equinox Day', when: { k: 'custom', f: (y) => jpEquinox(y, 'spring') } },
      fixed(4, 29, 'Shōwa Day'),
      fixed(5, 3, 'Constitution Memorial Day'),
      fixed(5, 4, 'Greenery Day'),
      fixed(5, 5, 'Children’s Day'),
      nth(7, MON, 3, 'Marine Day'),
      fixed(8, 11, 'Mountain Day'),
      nth(9, MON, 3, 'Respect for the Aged Day'),
      { name: 'Autumnal Equinox Day', when: { k: 'custom', f: (y) => jpEquinox(y, 'autumn') } },
      nth(10, MON, 2, 'Sports Day'),
      fixed(11, 3, 'Culture Day'),
      fixed(11, 23, 'Labour Thanksgiving Day'),
    ],
  },
  KR: {
    iso2: 'KR',
    notes: ['lunar', 'krSubstitute', 'oneoff'],
    rules: [
      fixed(1, 1, NEW_YEAR),
      fixed(3, 1, 'Independence Movement Day', { shift: 'weekend' }),
      fixed(5, 5, 'Children’s Day', { shift: 'weekend' }),
      fixed(6, 6, 'Memorial Day'),
      fixed(8, 15, 'Liberation Day', { shift: 'weekend' }),
      fixed(10, 3, 'National Foundation Day', { shift: 'weekend' }),
      fixed(10, 9, 'Hangul Day', { shift: 'weekend' }),
      fixed(12, 25, CHRISTMAS, { shift: 'weekend' }),
    ],
  },
  SG: {
    iso2: 'SG',
    notes: ['lunar', 'islamic', 'hindu', 'buddhist'],
    rules: [
      fixed(1, 1, NEW_YEAR, { shift: 'sunday' }),
      easter(-2, GOOD_FRIDAY),
      fixed(5, 1, LABOUR, { shift: 'sunday' }),
      fixed(8, 9, 'National Day', { shift: 'sunday' }),
      fixed(12, 25, CHRISTMAS, { shift: 'sunday' }),
    ],
  },
  TH: {
    iso2: 'TH',
    notes: ['buddhist', 'decree'],
    rules: [
      fixed(1, 1, NEW_YEAR),
      fixed(4, 6, 'Chakri Memorial Day'),
      fixed(4, 13, 'Songkran'),
      fixed(4, 14, 'Songkran'),
      fixed(4, 15, 'Songkran'),
      fixed(5, 1, LABOUR),
      fixed(5, 4, 'Coronation Day'),
      fixed(6, 3, 'Queen Suthida’s Birthday'),
      fixed(7, 28, 'King Vajiralongkorn’s Birthday'),
      fixed(8, 12, 'Queen Mother’s Birthday (Mother’s Day)'),
      fixed(10, 13, 'King Bhumibol Memorial Day'),
      fixed(10, 23, 'Chulalongkorn Day'),
      fixed(12, 5, 'King Bhumibol’s Birthday (Father’s Day)'),
      fixed(12, 10, 'Constitution Day'),
      fixed(12, 31, 'New Year’s Eve'),
    ],
  },
  MX: {
    iso2: 'MX',
    notes: ['mxHolyWeek', 'regional'],
    rules: [
      fixed(1, 1, NEW_YEAR),
      nth(2, MON, 1, 'Constitution Day'),
      nth(3, MON, 3, 'Benito Juárez’s Birthday'),
      fixed(5, 1, LABOUR),
      fixed(9, 16, 'Independence Day'),
      { name: 'Transfer of Federal Executive Power', when: { k: 'custom', f: (y) => (y >= 2024 && (y - 2024) % 6 === 0 ? ymd(y, 10, 1) : null) } },
      nth(11, MON, 3, 'Revolution Day'),
      fixed(12, 25, CHRISTMAS),
    ],
  },
  BR: {
    iso2: 'BR',
    notes: ['optional', 'regional'],
    rules: [
      fixed(1, 1, NEW_YEAR),
      easter(-2, GOOD_FRIDAY),
      fixed(4, 21, 'Tiradentes Day'),
      fixed(5, 1, LABOUR),
      fixed(9, 7, 'Independence Day'),
      fixed(10, 12, 'Our Lady of Aparecida'),
      fixed(11, 2, 'All Souls’ Day'),
      fixed(11, 15, 'Republic Day'),
      fixed(11, 20, 'Black Consciousness Day', { from: 2024 }),
      fixed(12, 25, CHRISTMAS),
    ],
  },
  AR: {
    iso2: 'AR',
    notes: ['decree'],
    rules: [
      fixed(1, 1, NEW_YEAR),
      easter(-48, 'Carnival Monday'),
      easter(-47, 'Carnival Tuesday'),
      fixed(3, 24, 'Day of Remembrance for Truth and Justice'),
      fixed(4, 2, 'Malvinas Day'),
      easter(-2, GOOD_FRIDAY),
      fixed(5, 1, LABOUR),
      fixed(5, 25, 'May Revolution Day'),
      fixed(6, 20, 'Flag Day'),
      fixed(7, 9, 'Independence Day'),
      fixed(12, 8, IMMACULATE),
      fixed(12, 25, CHRISTMAS),
    ],
  },
  CL: {
    iso2: 'CL',
    notes: ['decree'],
    rules: [
      fixed(1, 1, NEW_YEAR),
      easter(-2, GOOD_FRIDAY),
      easter(-1, 'Holy Saturday'),
      fixed(5, 1, LABOUR),
      fixed(5, 21, 'Navy Day'),
      fixed(7, 16, 'Our Lady of Mount Carmel'),
      fixed(8, 15, ASSUMPTION),
      fixed(9, 18, 'Independence Day'),
      fixed(9, 19, 'Army Day'),
      fixed(11, 1, ALL_SAINTS),
      fixed(12, 8, IMMACULATE),
      fixed(12, 25, CHRISTMAS),
    ],
  },
  ZA: {
    iso2: 'ZA',
    notes: ['oneoff'],
    rules: [
      fixed(1, 1, NEW_YEAR, { shift: 'sunMon' }),
      fixed(3, 21, 'Human Rights Day', { shift: 'sunMon' }),
      easter(-2, GOOD_FRIDAY),
      easter(1, 'Family Day'),
      fixed(4, 27, 'Freedom Day', { shift: 'sunMon' }),
      fixed(5, 1, 'Workers’ Day', { shift: 'sunMon' }),
      fixed(6, 16, 'Youth Day', { shift: 'sunMon' }),
      fixed(8, 9, 'National Women’s Day', { shift: 'sunMon' }),
      fixed(9, 24, 'Heritage Day', { shift: 'sunMon' }),
      fixed(12, 16, 'Day of Reconciliation', { shift: 'sunMon' }),
      fixed(12, 25, CHRISTMAS, { shift: 'sunMon' }),
      fixed(12, 26, 'Day of Goodwill', { shift: 'sunMon' }),
    ],
  },
  IS: {
    iso2: 'IS',
    notes: ['eves'],
    rules: [
      fixed(1, 1, NEW_YEAR),
      easter(-3, MAUNDY),
      easter(-2, GOOD_FRIDAY),
      easter(0, EASTER_SUNDAY),
      easter(1, EASTER_MONDAY),
      after(4, 19, THU, 'First Day of Summer'),
      fixed(5, 1, LABOUR),
      easter(39, ASCENSION),
      easter(49, WHIT_SUNDAY),
      easter(50, WHIT_MONDAY),
      fixed(6, 17, 'National Day'),
      nth(8, MON, 1, 'Commerce Day'),
      fixed(12, 25, CHRISTMAS),
      fixed(12, 26, 'Second Day of Christmas'),
    ],
  },
  LU: {
    iso2: 'LU',
    notes: ['regional'],
    rules: [
      fixed(1, 1, NEW_YEAR),
      easter(1, EASTER_MONDAY),
      fixed(5, 1, LABOUR),
      fixed(5, 9, 'Europe Day'),
      easter(39, ASCENSION),
      easter(50, WHIT_MONDAY),
      fixed(6, 23, 'National Day'),
      fixed(8, 15, ASSUMPTION),
      fixed(11, 1, ALL_SAINTS),
      fixed(12, 25, CHRISTMAS),
      fixed(12, 26, ST_STEPHEN),
    ],
  },
  MT: {
    iso2: 'MT',
    notes: ['regional'],
    rules: [
      fixed(1, 1, NEW_YEAR),
      fixed(2, 10, 'Feast of St Paul’s Shipwreck'),
      fixed(3, 19, 'Feast of St Joseph'),
      fixed(3, 31, 'Freedom Day'),
      easter(-2, GOOD_FRIDAY),
      fixed(5, 1, 'Workers’ Day'),
      fixed(6, 7, 'Sette Giugno'),
      fixed(6, 29, 'Feast of St Peter and St Paul'),
      fixed(8, 15, ASSUMPTION),
      fixed(9, 8, 'Victory Day'),
      fixed(9, 21, 'Independence Day'),
      fixed(12, 8, IMMACULATE),
      fixed(12, 13, 'Republic Day'),
      fixed(12, 25, CHRISTMAS),
    ],
  },
  EE: {
    iso2: 'EE',
    notes: ['eves'],
    rules: [
      fixed(1, 1, NEW_YEAR),
      fixed(2, 24, 'Independence Day'),
      easter(-2, GOOD_FRIDAY),
      easter(0, EASTER_SUNDAY),
      fixed(5, 1, 'Spring Day'),
      easter(49, 'Pentecost'),
      fixed(6, 23, 'Victory Day'),
      fixed(6, 24, 'Midsummer Day'),
      fixed(8, 20, 'Day of Restoration of Independence'),
      fixed(12, 24, CHRISTMAS_EVE),
      fixed(12, 25, CHRISTMAS),
      fixed(12, 26, 'Second Day of Christmas'),
    ],
  },
};

export const HOLIDAY_COUNTRIES: readonly string[] = Object.keys(COUNTRY_HOLIDAYS).sort();

export const hasHolidays = (iso2: string | null | undefined): boolean => !!iso2 && iso2.toUpperCase() in COUNTRY_HOLIDAYS;
export const coversYear = (y: number) => y >= HOLIDAY_YEARS.from && y <= HOLIDAY_YEARS.to;

// ------------------------------------------------------------------ one country, one year

/** The day a weekend holiday moves to, given the dates already taken. Null when it doesn't move. */
function shifted(date: LocalDate, shift: Shift, taken: Set<LocalDate>): LocalDate | null {
  const wd = weekdayOf(date);
  switch (shift) {
    case 'us':
      return wd === SAT ? shiftDate(date, -1) : wd === SUN ? shiftDate(date, 1) : null;
    case 'sunSat':
      return wd === SUN ? shiftDate(date, -1) : null;
    case 'sunMon': {
      if (wd !== SUN) return null;
      const mon = shiftDate(date, 1);
      return taken.has(mon) ? null : mon;
    }
    case 'sunday':
    case 'weekend': {
      if (wd !== SUN && !(shift === 'weekend' && wd === SAT)) return null;
      let d = shiftDate(date, 1);
      while (taken.has(d) || weekdayOf(d) === SAT || weekdayOf(d) === SUN) d = shiftDate(d, 1);
      return d;
    }
  }
}

/** Every holiday rule date for the year, before any shift. */
function baseDates(c: CountryHolidays, y: number): { rule: Rule; date: LocalDate }[] {
  const out: { rule: Rule; date: LocalDate }[] = [];
  for (const rule of c.rules) {
    if ((rule.from && y < rule.from) || (rule.to && y > rule.to)) continue;
    const date = dateOf(rule.when, y);
    if (date) out.push({ rule, date });
  }
  return out;
}

const byDate = (a: Holiday, b: Holiday) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

/**
 * A country's public holidays whose rule falls in year `y`, with their weekend substitutes (which can land in the
 * next or previous year: a US New Year's Day on a Saturday is observed on 31 December). Sorted by date.
 * Unknown country or a year outside HOLIDAY_YEARS: [].
 */
export function holidaysForYear(iso2: string, y: number): Holiday[] {
  const c = COUNTRY_HOLIDAYS[iso2.toUpperCase()];
  if (!c || !coversYear(y)) return [];
  const base = baseDates(c, y);
  const out: Holiday[] = base.map(({ rule, date }) => ({ date, iso2: c.iso2, name: rule.name, ...(rule.partial ? { partial: true } : {}) }));
  const taken = new Set(out.map((h) => h.date));
  if (c.jp) {
    // Citizens' holiday: an ordinary weekday between two holidays. Then a holiday on a Sunday moves to the next day
    // that isn't a holiday (振替休日).
    for (const d of [...taken].sort()) {
      const mid = shiftDate(d, 1);
      if (taken.has(shiftDate(d, 2)) && !taken.has(mid) && weekdayOf(mid) !== SUN) out.push({ date: mid, iso2: c.iso2, name: 'Citizens’ Holiday' });
    }
    for (const h of out) taken.add(h.date);
    for (const h of [...out].sort(byDate)) {
      if (weekdayOf(h.date) !== SUN) continue;
      let d = shiftDate(h.date, 1);
      while (taken.has(d)) d = shiftDate(d, 1);
      taken.add(d);
      out.push({ date: d, iso2: c.iso2, name: h.name, substitute: true });
    }
    return out.sort(byDate);
  }
  for (const { rule, date } of [...base].sort((a, b) => (a.date < b.date ? -1 : 1))) {
    if (!rule.shift) continue;
    const to = shifted(date, rule.shift, taken);
    if (!to) continue;
    taken.add(to);
    out.push({ date: to, iso2: c.iso2, name: rule.name, substitute: true, ...(rule.partial ? { partial: true } : {}) });
  }
  return out.sort(byDate);
}

/** Holidays dated from `from` to `to` inclusive (local dates in that country). */
export function holidaysBetween(iso2: string, from: LocalDate, to: LocalDate): Holiday[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || to < from) return [];
  const a = Number(from.slice(0, 4));
  const b = Number(to.slice(0, 4));
  const out: Holiday[] = [];
  for (let y = a - 1; y <= b + 1; y++) for (const h of holidaysForYear(iso2, y)) if (h.date >= from && h.date <= to) out.push(h);
  return out.sort(byDate);
}

/** Holidays on one local date in a country. */
export const holidaysOn = (iso2: string | null | undefined, date: LocalDate): Holiday[] => (iso2 ? holidaysBetween(iso2, date, date) : []);

export const notesFor = (iso2: string): readonly NoteCode[] => COUNTRY_HOLIDAYS[iso2.toUpperCase()]?.notes ?? [];

// ------------------------------------------------------------------ the trip

/** A stop: a country the trip is in, the zone its dates are read in, and the local days the bookings put you there. */
export type HolidayStop = { iso2: string; zone: string; from: LocalDate; to: LocalDate; covered: boolean };

/**
 * The trip's stops for holidays: the countries the bookings reach (arrival.ts tripCountries, home left out), each
 * from its first to its last booked day in its own zone, clipped to the trip's dates. A trip that never leaves home
 * uses the home country over the trip's dates, read in the trip's home zone.
 */
export function holidayStops(trip: Trip, home: string | null): HolidayStop[] {
  const span = tripSpan(trip);
  const clip = (from: LocalDate, to: LocalDate) => ({ from: from < span.start ? span.start : from, to: to > span.end ? span.end : to });
  const countries = tripCountries(trip, home);
  if (!countries.length) {
    if (!home) return [];
    return [{ iso2: home, zone: trip.homeTz, from: span.start, to: span.end, covered: hasHolidays(home) }];
  }
  return countries.map((c) => ({ iso2: c.iso2, zone: c.zone, ...clip(c.firstDay, c.lastDay), covered: hasHolidays(c.iso2) }));
}

export type TripHoliday = Holiday & { zone: string };

/** Holidays on the trip: each stop's own holidays on the days you're there, by date (then country). */
export function tripHolidays(trip: Trip, home: string | null): TripHoliday[] {
  const out: TripHoliday[] = [];
  for (const s of holidayStops(trip, home)) {
    if (!s.covered || s.to < s.from) continue;
    for (const h of holidaysBetween(s.iso2, s.from, s.to)) if (!out.some((o) => o.iso2 === h.iso2 && o.date === h.date && o.name === h.name)) out.push({ ...h, zone: s.zone });
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.iso2 < b.iso2 ? -1 : a.iso2 > b.iso2 ? 1 : 0));
}

/** Trip holidays keyed by local date, for the timeline's day headers. */
export function holidaysByDate(list: readonly TripHoliday[]): Map<LocalDate, TripHoliday[]> {
  const m = new Map<LocalDate, TripHoliday[]>();
  for (const h of list) m.set(h.date, [...(m.get(h.date) ?? []), h]);
  return m;
}

/** Countries on the trip that this table has no holidays for (the screen names them). */
export const uncoveredStops = (trip: Trip, home: string | null): string[] => [...new Set(holidayStops(trip, home).filter((s) => !s.covered).map((s) => s.iso2))];

/** Whether any trip day falls outside the years the rules cover. */
export function outsideYears(trip: Trip): boolean {
  const s = tripSpan(trip);
  return !coversYear(Number(s.start.slice(0, 4))) || !coversYear(Number(s.end.slice(0, 4)));
}

export type HolidayToday = { iso2: string; date: LocalDate; holidays: Holiday[] };

/** Today's holidays at a given stop zone ("today" read on that zone's calendar). Null when none. */
export function holidayTodayIn(zone: string | null | undefined, now: number): HolidayToday | null {
  const iso2 = countryForZone(zone);
  if (!zone || !iso2) return null;
  const date = localDate(fromUtc(now, zone));
  const holidays = holidaysOn(iso2, date);
  return holidays.length ? { iso2, date, holidays } : null;
}

/** Today's holidays where the bookings put you now (jetlag.ts zoneAt), for Your day. */
export const holidayTodayOnTrip = (trip: Trip, now: number): HolidayToday | null => holidayTodayIn(zoneAt(trip, now), now);
