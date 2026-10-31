// T106 public holidays: computus, nth-weekday rules, weekend shifts, Japan's substitute days, the trip filter per
// stop zone, and the table's coverage (every country >= 5 a year with a notes line that has words in the catalogue).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { en } from '../i18n/en.ts';
import {
  COUNTRY_HOLIDAYS,
  easterSunday,
  HOLIDAY_COUNTRIES,
  HOLIDAY_YEARS,
  holidayStops,
  holidaysBetween,
  holidaysByDate,
  holidaysForYear,
  holidaysOn,
  holidayTodayIn,
  holidayTodayOnTrip,
  NOTE_CODES,
  nthWeekday,
  orthodoxEaster,
  outsideYears,
  tripHolidays,
  uncoveredStops,
  weekdayOf,
} from './holidays.ts';
import type { Item, ItemKind, Trip } from './model.ts';
import { toUtc } from './tz.ts';

const names = (iso2: string, from: string, to: string) => holidaysBetween(iso2, from, to).map((h) => `${h.date} ${h.name}${h.substitute ? ' *' : ''}`);
const dateOf = (iso2: string, y: number, name: string, substitute = false) =>
  holidaysForYear(iso2, y).filter((h) => h.name === name && !!h.substitute === substitute).map((h) => h.date);

test('Easter Sunday 2024-2030 matches the published dates', () => {
  const want: Record<number, string> = { 2024: '2024-03-31', 2025: '2025-04-20', 2026: '2026-04-05', 2027: '2027-03-28', 2028: '2028-04-16', 2029: '2029-04-01', 2030: '2030-04-21' };
  for (const [y, d] of Object.entries(want)) {
    assert.equal(easterSunday(Number(y)), d, y);
    assert.equal(weekdayOf(d), 0, `${d} is a Sunday`);
  }
});

test('Orthodox Easter 2025 and 2026 (and nearby years)', () => {
  assert.equal(orthodoxEaster(2025), '2025-04-20'); // same Sunday as the Western date that year
  assert.equal(orthodoxEaster(2026), '2026-04-12');
  assert.equal(orthodoxEaster(2024), '2024-05-05');
  assert.equal(orthodoxEaster(2027), '2027-05-02');
  // Greece follows it: Clean Monday 48 days before, Orthodox Good Friday 2 days before.
  assert.deepEqual(dateOf('GR', 2026, 'Clean Monday'), ['2026-02-23']);
  assert.deepEqual(dateOf('GR', 2026, 'Orthodox Good Friday'), ['2026-04-10']);
  assert.deepEqual(dateOf('GR', 2026, 'Orthodox Easter Monday'), ['2026-04-13']);
});

test('Japan Golden Week 2026: Shōwa Day, then 3-6 May with the Sunday substitute on Wednesday 6 May', () => {
  assert.deepEqual(names('JP', '2026-04-25', '2026-05-10'), [
    '2026-04-29 Shōwa Day',
    '2026-05-03 Constitution Memorial Day',
    '2026-05-04 Greenery Day',
    '2026-05-05 Children’s Day',
    '2026-05-06 Constitution Memorial Day *',
  ]);
  // September 2026: the weekday between Respect for the Aged Day and the equinox is a citizens' holiday.
  assert.deepEqual(names('JP', '2026-09-15', '2026-09-30'), ['2026-09-21 Respect for the Aged Day', '2026-09-22 Citizens’ Holiday', '2026-09-23 Autumnal Equinox Day']);
  assert.deepEqual(dateOf('JP', 2026, 'Vernal Equinox Day'), ['2026-03-20']);
  assert.deepEqual(dateOf('JP', 2027, 'Vernal Equinox Day'), ['2027-03-21']);
});

test('US Thanksgiving 2026 is 26 November; nth and last weekday rules', () => {
  assert.deepEqual(dateOf('US', 2026, 'Thanksgiving Day'), ['2026-11-26']);
  assert.deepEqual(dateOf('US', 2026, 'Memorial Day'), ['2026-05-25']);
  assert.deepEqual(dateOf('US', 2026, 'Labor Day'), ['2026-09-07']);
  assert.equal(nthWeekday(2026, 2, 1, -1), '2026-02-23');
  assert.equal(nthWeekday(2026, 12, 4, -1), '2026-12-31');
});

test('UK late May (Spring) bank holiday 2026 is 25 May; Boxing Day on a Saturday moves to Monday 28 December', () => {
  assert.deepEqual(dateOf('GB', 2026, 'Spring bank holiday'), ['2026-05-25']);
  assert.deepEqual(dateOf('GB', 2026, 'Early May bank holiday'), ['2026-05-04']);
  assert.deepEqual(dateOf('GB', 2026, 'Boxing Day', true), ['2026-12-28']);
  // Christmas on a Saturday (2027): Monday 27 for Christmas, Tuesday 28 for Boxing Day (a Sunday).
  assert.deepEqual(dateOf('GB', 2027, 'Christmas Day', true), ['2027-12-27']);
  assert.deepEqual(dateOf('GB', 2027, 'Boxing Day', true), ['2027-12-28']);
});

test('a Sunday fixed holiday is observed on the Monday where the rule says so, and not where it does not', () => {
  // Singapore National Day, Sunday 9 August 2026 -> Monday 10 August.
  assert.deepEqual(names('SG', '2026-08-08', '2026-08-11'), ['2026-08-09 National Day', '2026-08-10 National Day *']);
  // US Independence Day: Sunday 4 July 2027 -> Monday 5 July; Saturday 4 July 2026 -> Friday 3 July.
  assert.deepEqual(dateOf('US', 2027, 'Independence Day', true), ['2027-07-05']);
  assert.deepEqual(dateOf('US', 2026, 'Independence Day', true), ['2026-07-03']);
  // US New Year's Day on a Saturday (2028) is observed on Friday 31 December 2027.
  assert.ok(names('US', '2027-12-30', '2028-01-02').includes('2027-12-31 New Year’s Day *'));
  // South Africa: Sunday -> Monday, but not when the Monday is already a holiday (Christmas Sunday 2033, Day of Goodwill Monday).
  assert.deepEqual(dateOf('ZA', 2026, 'Heritage Day', true), []); // Thursday
  assert.deepEqual(dateOf('ZA', 2027, 'Freedom Day', true), []); // Tuesday
  assert.deepEqual(dateOf('ZA', 2026, 'Workers’ Day', true), []); // Friday
  assert.deepEqual(dateOf('ZA', 2026, 'Youth Day', true), []);
  assert.deepEqual(dateOf('ZA', 2026, 'National Women’s Day', true), ['2026-08-10']); // Sunday 9 August
  assert.deepEqual(dateOf('ZA', 2033, 'Christmas Day', true), []);
  // Australia Day moves only off a Sunday; France never moves a holiday.
  assert.deepEqual(dateOf('AU', 2026, 'Australia Day', true), []);
  assert.deepEqual(dateOf('FR', 2026, 'Bastille Day', true), []);
  assert.deepEqual(dateOf('NL', 2025, 'King’s Day', true), ['2025-04-26']); // Sunday 27 April -> Saturday
});

test('day-of-week rules: Swedish Midsummer, Icelandic First Day of Summer, Irish St Brigid, Canadian Victoria Day', () => {
  assert.deepEqual(dateOf('SE', 2026, 'Midsummer Day'), ['2026-06-20']);
  assert.deepEqual(dateOf('SE', 2026, 'All Saints’ Day'), ['2026-10-31']);
  assert.deepEqual(dateOf('IS', 2026, 'First Day of Summer'), ['2026-04-23']);
  assert.deepEqual(dateOf('IE', 2026, 'St Brigid’s Day'), ['2026-02-02']);
  assert.deepEqual(dateOf('IE', 2030, 'St Brigid’s Day'), ['2030-02-01']); // 1 February 2030 is a Friday
  assert.deepEqual(dateOf('CA', 2026, 'Victoria Day'), ['2026-05-18']);
  assert.deepEqual(dateOf('MX', 2026, 'Transfer of Federal Executive Power'), []);
  assert.deepEqual(dateOf('MX', 2030, 'Transfer of Federal Executive Power'), ['2030-10-01']);
  assert.deepEqual(dateOf('PL', 2024, 'Christmas Eve'), []);
  assert.deepEqual(dateOf('PL', 2025, 'Christmas Eve'), ['2025-12-24']);
  assert.deepEqual(dateOf('DK', 2024, 'Great Prayer Day'), []);
});

test('every country: at least 35 countries, each with at least 5 holidays every covered year and a notes line in the catalogue', () => {
  assert.ok(HOLIDAY_COUNTRIES.length >= 35, `${HOLIDAY_COUNTRIES.length} countries`);
  for (const iso of ['AU', 'NZ', 'GB', 'IE', 'US', 'CA', 'FR', 'DE', 'IT', 'ES', 'PT', 'NL', 'BE', 'CH', 'AT', 'GR', 'SE', 'NO', 'DK', 'FI', 'PL', 'CZ', 'HU', 'HR', 'JP', 'KR', 'SG', 'TH', 'MX', 'BR', 'AR', 'CL', 'ZA', 'IS']) {
    assert.ok(iso in COUNTRY_HOLIDAYS, iso);
  }
  const cat = en as Record<string, string>;
  for (const iso of HOLIDAY_COUNTRIES) {
    const c = COUNTRY_HOLIDAYS[iso];
    assert.equal(c.iso2, iso);
    assert.ok(c.notes.length >= 1, `${iso} has a notes line`);
    for (const n of c.notes) assert.ok(cat[`holidays.note.${n}`], `${iso} note ${n} has words`);
    for (let y = HOLIDAY_YEARS.from; y <= HOLIDAY_YEARS.to; y++) {
      const list = holidaysForYear(iso, y).filter((h) => h.date.startsWith(String(y)) && !h.substitute);
      assert.ok(list.length >= 5, `${iso} ${y}: ${list.length}`);
      for (const h of list) assert.match(h.date, /^\d{4}-\d{2}-\d{2}$/);
    }
  }
  for (const n of NOTE_CODES) assert.ok(cat[`holidays.note.${n}`], n);
  assert.deepEqual(holidaysForYear('XX', 2026), []);
  assert.deepEqual(holidaysForYear('FR', HOLIDAY_YEARS.to + 1), []);
});

let n = 0;
function item(kind: ItemKind, start: [string, string], end?: [string, string]): Item {
  n++;
  return { id: `i${n}`, tripId: 't', kind, title: `${kind} ${n}`, start: { local: start[0], tz: start[1] }, end: end ? { local: end[0], tz: end[1] } : undefined, attachments: [] };
}
const trip = (homeTz: string, items: Item[], extra: Partial<Trip> = {}): Trip => ({ id: 't1', name: 'Test', startDate: '2026-04-27', endDate: '2026-05-12', homeTz, items, createdAt: '2026-01-01T00:00:00Z', ...extra });
const SYD = 'Australia/Sydney';
const TYO = 'Asia/Tokyo';
const SEL = 'Asia/Seoul';
const LON = 'Europe/London';

// Sydney -> Tokyo 28 Apr - 6 May -> Seoul 6-10 May -> home.
const japanKorea = trip(SYD, [
  item('flight', ['2026-04-28T09:30', SYD], ['2026-04-28T17:45', TYO]),
  item('hotel', ['2026-04-28T19:30', TYO], ['2026-05-06T10:00', TYO]),
  item('flight', ['2026-05-06T13:00', TYO], ['2026-05-06T15:30', SEL]),
  item('hotel', ['2026-05-06T17:00', SEL], ['2026-05-10T10:00', SEL]),
  item('flight', ['2026-05-10T12:00', SEL], ['2026-05-10T23:30', SYD]),
]);

test('trip filter: each stop’s holidays only on the days you are there, read in that stop’s zone', () => {
  const stops = holidayStops(japanKorea, 'AU');
  assert.deepEqual(stops.map((s) => [s.iso2, s.from, s.to]), [['JP', '2026-04-28', '2026-05-06'], ['KR', '2026-05-06', '2026-05-10']]);
  const list = tripHolidays(japanKorea, 'AU');
  assert.deepEqual(list.map((h) => `${h.iso2} ${h.date} ${h.name}${h.substitute ? ' *' : ''}`), [
    'JP 2026-04-29 Shōwa Day',
    'JP 2026-05-03 Constitution Memorial Day',
    'JP 2026-05-04 Greenery Day',
    'JP 2026-05-05 Children’s Day',
    'JP 2026-05-06 Constitution Memorial Day *',
  ]);
  // Korea's Children's Day (5 May) is before you reach Seoul, so it's left out; Anzac Day at home isn't on the trip.
  assert.ok(!list.some((h) => h.iso2 === 'KR'));
  assert.ok(!list.some((h) => h.iso2 === 'AU'));
  assert.equal(list[0].zone, TYO);
  const byDate = holidaysByDate(list);
  assert.equal(byDate.get('2026-05-04')?.[0].name, 'Greenery Day');
  assert.equal(byDate.get('2026-05-07'), undefined);
  assert.deepEqual(uncoveredStops(japanKorea, 'AU'), []);
  assert.equal(outsideYears(japanKorea), false);
});

test('a trip that never leaves home uses the home country; an uncovered country is named', () => {
  const home = trip(LON, [item('hotel', ['2026-05-22T15:00', LON], ['2026-05-26T11:00', LON])], { startDate: '2026-05-22', endDate: '2026-05-26' });
  assert.deepEqual(tripHolidays(home, 'GB').map((h) => h.date), ['2026-05-25']);
  // No home country known: the bookings' own country counts as a stop.
  assert.deepEqual(tripHolidays(home, null).map((h) => h.date), ['2026-05-25']);
  const kathmandu = trip(LON, [item('flight', ['2026-05-01T10:00', LON], ['2026-05-02T08:00', 'Asia/Kathmandu'])]);
  assert.deepEqual(uncoveredStops(kathmandu, 'GB'), ['NP']);
  assert.deepEqual(tripHolidays(kathmandu, 'GB'), []);
});

test('today at the current stop (Your day / arrival card), on that stop’s calendar', () => {
  // 4 May 2026 07:00 in Tokyo is still Sunday 3 May in London (not the Early May bank holiday yet).
  const now = toUtc({ local: '2026-05-04T07:00', tz: TYO });
  assert.deepEqual(holidayTodayIn(TYO, now)?.holidays.map((h) => h.name), ['Greenery Day']);
  assert.equal(holidayTodayIn(TYO, now)?.iso2, 'JP');
  assert.equal(holidayTodayIn(LON, now), null);
  assert.equal(holidayTodayIn(null, now), null);
  assert.deepEqual(holidayTodayOnTrip(japanKorea, now)?.date, '2026-05-04');
  const seoul = toUtc({ local: '2026-05-08T12:00', tz: SEL });
  assert.equal(holidayTodayOnTrip(japanKorea, seoul), null);
  assert.deepEqual(holidaysOn('KR', '2026-05-05').map((h) => h.name), ['Children’s Day']);
});
