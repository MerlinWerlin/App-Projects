import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  ARRIVAL_DISMISS_KEY,
  arrivalForTrips,
  arrivalView,
  arrivingCountry,
  countryStrip,
  DISMISS_MAX,
  dismissArrival,
  flagEmoji,
  homeCountryFor,
  isDismissed,
  normaliseDismissed,
  tripCountries,
  type ArrivalTables,
} from './arrival.ts';
import type { EmergencyTable } from './emergency.ts';
import type { EssentialsTable } from './essentials.ts';
import type { Item, ItemKind, Trip } from './model.ts';
import type { PhraseTable } from './phrases.ts';
import { toUtc } from './tz.ts';

const read = <T>(f: string) => JSON.parse(readFileSync(new URL(`../content/${f}`, import.meta.url), 'utf8')) as T;
const tables: ArrivalTables = {
  essentials: read<EssentialsTable>('country_essentials.json'),
  emergency: read<EmergencyTable>('emergency_numbers.json'),
  phrases: read<PhraseTable>('phrases.json'),
};
const empty: ArrivalTables = {
  essentials: { version: 1, rule: '', countries: [] },
  emergency: { version: 1, rule: '', countries: [] },
  phrases: { version: 1, phrases: [], languages: [] },
};

let n = 0;
function item(kind: ItemKind, start: [string, string], end?: [string, string], extra: Partial<Item> = {}): Item {
  n++;
  return { id: `i${n}`, tripId: 't', kind, title: `${kind} ${n}`, start: { local: start[0], tz: start[1] }, end: end ? { local: end[0], tz: end[1] } : undefined, attachments: [], ...extra };
}
function trip(homeTz: string, items: Item[], extra: Partial<Trip> = {}): Trip {
  return { id: 't1', name: 'Test', startDate: '2026-12-01', endDate: '2026-12-14', homeTz, items, createdAt: '2026-10-01T00:00:00Z', ...extra };
}
const at = (local: string, tz: string) => toUtc({ local, tz });

const SYD = 'Australia/Sydney';
const TYO = 'Asia/Tokyo';
const PAR = 'Europe/Paris';
const ZRH = 'Europe/Zurich';
const LON = 'Europe/London';

// Sydney -> Tokyo (hotel with a map position) -> home.
const hotel = item('hotel', ['2026-12-01T19:30', TYO], ['2026-12-05T11:00', TYO], { place: { id: 'p', name: 'Shinjuku Inn', lat: 35.69, lon: 139.7 } });
const japan = trip(SYD, [
  item('flight', ['2026-12-01T09:30', SYD], ['2026-12-01T17:45', TYO]),
  hotel,
  item('activity', ['2026-12-02T10:00', TYO], ['2026-12-02T12:00', TYO]),
  item('flight', ['2026-12-05T13:00', TYO], ['2026-12-06T00:30', SYD]),
]);
const opts = (now: number, extra: Partial<Parameters<typeof arrivalView>[1]> = {}) => ({ now, phoneZone: SYD, tables, ...extra });

test('flags: regional-indicator emoji for a two-letter code, null for anything else', () => {
  assert.equal(flagEmoji('JP'), '\u{1F1EF}\u{1F1F5}');
  assert.equal(flagEmoji(' fr '), '\u{1F1EB}\u{1F1F7}');
  for (const bad of [null, undefined, '', 'J', 'JPN', '1A', 'É1']) assert.equal(flagEmoji(bad), null);
});

test('home country: Settings wins, else the trip home zone, else null', () => {
  assert.equal(homeCountryFor(japan, 'gb'), 'GB');
  assert.equal(homeCountryFor(japan, null), 'AU');
  assert.equal(homeCountryFor({ homeTz: 'Etc/UTC' }, undefined), null);
});

test('trip countries: in booking order, home left out, each once with its first and last day', () => {
  const cs = tripCountries(japan, 'AU');
  assert.deepEqual(cs.map((c) => c.iso2), ['JP']);
  assert.equal(cs[0].firstDay, '2026-12-01');
  assert.equal(cs[0].lastDay, '2026-12-05');
  assert.equal(cs[0].firstAt, at('2026-12-01T17:45', TYO));
});

test('arriving by date and zone: later today, then here once landed, nothing before the day or after leaving', () => {
  // the day before: nothing
  assert.equal(arrivingCountry(japan, at('2026-11-30T12:00', SYD), 'AU'), null);
  // flight day, still at home in Sydney: Japan's first booking lands later today in Tokyo
  assert.deepEqual(arrivingCountry(japan, at('2026-12-01T08:00', SYD), 'AU'), { iso2: 'JP', zone: TYO, when: 'today' });
  // in the air (zoneAt is the departure zone, home): still "today"
  assert.equal(arrivingCountry(japan, at('2026-12-01T12:00', SYD), 'AU')?.when, 'today');
  // landed
  assert.deepEqual(arrivingCountry(japan, at('2026-12-01T18:30', TYO), 'AU'), { iso2: 'JP', zone: TYO, when: 'here' });
  assert.equal(arrivingCountry(japan, at('2026-12-03T09:00', TYO), 'AU')?.when, 'here');
  // back home
  assert.equal(arrivingCountry(japan, at('2026-12-06T08:00', SYD), 'AU'), null);
});

test('a trip that ends in a country (no flight home) stops welcoming after its last day', () => {
  const oneWay = trip(SYD, [item('flight', ['2026-12-01T09:30', SYD], ['2026-12-01T17:45', TYO]), item('hotel', ['2026-12-01T19:00', TYO], ['2026-12-03T10:00', TYO])], { endDate: '2026-12-03' });
  assert.equal(arrivingCountry(oneWay, at('2026-12-03T20:00', TYO), 'AU')?.iso2, 'JP');
  assert.equal(arrivingCountry(oneWay, at('2026-12-04T09:00', TYO), 'AU'), null);
});

test('multi-country trip: each stop in turn, and the strip marks been / now / ahead', () => {
  const euro = trip(LON, [
    item('flight', ['2026-12-01T08:00', LON], ['2026-12-01T10:20', PAR]),
    item('hotel', ['2026-12-01T14:00', PAR], ['2026-12-04T10:00', PAR]),
    item('train', ['2026-12-04T11:00', PAR], ['2026-12-04T15:00', ZRH]),
    item('hotel', ['2026-12-04T16:00', ZRH], ['2026-12-07T10:00', ZRH]),
    item('flight', ['2026-12-07T12:00', ZRH], ['2026-12-07T13:00', LON]),
  ]);
  assert.deepEqual(tripCountries(euro, 'GB').map((c) => c.iso2), ['FR', 'CH']);
  assert.equal(arrivingCountry(euro, at('2026-12-02T09:00', PAR), 'GB')?.iso2, 'FR');
  // on the train to Zurich (zoneAt = Paris while under way)
  assert.equal(arrivingCountry(euro, at('2026-12-04T12:00', PAR), 'GB')?.iso2, 'FR');
  assert.deepEqual(arrivingCountry(euro, at('2026-12-04T15:30', ZRH), 'GB'), { iso2: 'CH', zone: ZRH, when: 'here' });
  const strip = countryStrip(euro, at('2026-12-05T09:00', ZRH), 'GB', tables);
  assert.deepEqual(strip.map((s) => [s.iso2, s.country, s.state]), [['FR', 'France', 'been'], ['CH', 'Switzerland', 'now']]);
  const early = countryStrip(euro, at('2026-11-20T09:00', LON), 'GB', tables);
  assert.deepEqual(early.map((s) => s.state), ['ahead', 'ahead']);
  // Paris dismissed: Zurich still welcomes you
  const d = dismissArrival([], 't1', 'FR');
  assert.equal(arrivalView(euro, { now: at('2026-12-02T09:00', PAR), phoneZone: LON, tables, dismissed: d }), null);
  assert.equal(arrivalView(euro, { now: at('2026-12-05T09:00', ZRH), phoneZone: LON, tables, dismissed: d })?.iso2, 'CH');
});

test('home-country trips show nothing', () => {
  const domestic = trip(SYD, [item('flight', ['2026-12-01T09:00', SYD], ['2026-12-01T10:30', 'Australia/Melbourne']), item('hotel', ['2026-12-01T14:00', 'Australia/Melbourne'], ['2026-12-03T10:00', 'Australia/Melbourne'])]);
  assert.deepEqual(tripCountries(domestic, 'AU'), []);
  assert.equal(arrivalView(domestic, opts(at('2026-12-02T09:00', 'Australia/Melbourne'))), null);
  assert.deepEqual(countryStrip(domestic, at('2026-12-02T09:00', SYD), 'AU', tables), []);
  // home set to Japan in Settings: the Japan trip is a home trip too
  assert.equal(arrivalView(japan, opts(at('2026-12-02T09:00', TYO), { homeIso2: 'JP' })), null);
});

test('dismiss memory: per country per trip, defensive read, capped', () => {
  assert.equal(ARRIVAL_DISMISS_KEY, 'satchel.arrival.dismissed.v1');
  let d = dismissArrival(undefined, 't1', 'jp');
  assert.deepEqual(d, ['t1|JP']);
  d = dismissArrival(d, 't1', 'JP');
  assert.deepEqual(d, ['t1|JP']);
  assert.equal(isDismissed(d, 't1', 'JP'), true);
  assert.equal(isDismissed(d, 't2', 'JP'), false);
  assert.equal(isDismissed(d, 't1', 'FR'), false);
  assert.deepEqual(normaliseDismissed({ a: 1 }), []);
  assert.deepEqual(normaliseDismissed(['x|Y', 3, null, 'nopipe', 'x|Y']), ['x|Y']);
  let many: string[] = [];
  for (let i = 0; i < DISMISS_MAX + 10; i++) many = dismissArrival(many, `t${i}`, 'JP');
  assert.equal(many.length, DISMISS_MAX);
  assert.equal(many[many.length - 1], `t${DISMISS_MAX + 9}|JP`);
  const now = at('2026-12-02T09:00', TYO);
  assert.ok(arrivalView(japan, opts(now)));
  assert.equal(arrivalView(japan, opts(now, { dismissed: ['t1|JP'] })), null);
  assert.ok(arrivalView({ ...japan, id: 'other' }, opts(now, { dismissed: ['t1|JP'] })));
});

test('the card: time vs home, saved rate rows, power, emergency, phrases, hotel, strip', () => {
  const withMoney = { ...japan, budget: { currency: 'AUD' }, rates: { JPY: 0.0102 }, ratesUpdated: { JPY: { day: '2026-11-28', rate: 0.0102 } } };
  const v = arrivalView(withMoney, opts(at('2026-12-02T09:00', TYO)));
  assert.ok(v);
  assert.equal(v.country, 'Japan');
  assert.equal(v.flag, '\u{1F1EF}\u{1F1F5}');
  assert.equal(v.when, 'here');
  assert.deepEqual(v.clock, { time: '09:00', homeTime: '11:00', homeZone: SYD, diffMinutes: -120 });
  assert.ok(v.money);
  assert.equal(v.money.local, 'JPY');
  assert.equal(v.money.home, 'AUD');
  assert.equal(v.money.rateDay, '2026-11-28');
  // 10 yen is worth 10 cents, so the rows scale to 100 / 500 / 1,000 yen
  assert.deepEqual(v.money.rows, [{ local: 100, home: 102 }, { local: 500, home: 510 }, { local: 1000, home: 1020 }]);
  assert.equal(v.moneyMissing, null);
  assert.ok(v.power);
  assert.equal(v.power.driving, 'left');
  assert.equal(v.power.verifyLocally, true);
  assert.ok(v.power.plugs?.includes('A'));
  assert.ok(v.emergency);
  assert.deepEqual(v.emergency.lines.map((l) => l.number), ['110', '119']);
  assert.equal(v.emergency.fallback, null);
  assert.equal(v.emergency.verifyLocally, true);
  assert.equal(v.phrases?.lang, 'ja');
  assert.deepEqual(v.phrases?.cards.map((c) => c.id), ['hello', 'thanks']);
  assert.equal(v.hotelTarget, `hotel:${hotel.id}`);
  assert.deepEqual(v.countries.map((c) => [c.iso2, c.state]), [['JP', 'now']]);
  assert.ok(['map', 'wallet', 'trips', 'toilets'].includes(v.tone));
});

test('money: the currency spent on days in this country wins; strong currencies keep 10 / 50 / 100', () => {
  const euro = trip(LON, [
    item('flight', ['2026-12-01T08:00', LON], ['2026-12-01T10:20', PAR]),
    item('train', ['2026-12-04T11:00', PAR], ['2026-12-04T15:00', ZRH]),
    item('flight', ['2026-12-07T12:00', ZRH], ['2026-12-07T13:00', LON]),
  ], {
    budget: { currency: 'GBP' },
    rates: { EUR: 0.85, CHF: 0.9 },
    expenses: [
      { id: 'e1', amount: 500, currency: 'CHF', category: 'food', day: '2026-12-05' },
      { id: 'e2', amount: 500, currency: 'EUR', category: 'food', day: '2026-12-02' },
    ],
  });
  const ch = arrivalView(euro, { now: at('2026-12-05T09:00', ZRH), phoneZone: LON, tables });
  assert.equal(ch?.money?.local, 'CHF');
  assert.deepEqual(ch?.money?.rows, [{ local: 1000, home: 900 }, { local: 5000, home: 4500 }, { local: 10000, home: 9000 }]);
  assert.equal(ch?.money?.rateDay, null);
  const fr = arrivalView(euro, { now: at('2026-12-02T09:00', PAR), phoneZone: LON, tables });
  assert.equal(fr?.money?.local, 'EUR');
});

test('missing data falls back gracefully: no home currency, no rate, no table rows', () => {
  const now = at('2026-12-02T09:00', TYO);
  const noHome = arrivalView(japan, opts(now));
  assert.equal(noHome?.money, null);
  assert.equal(noHome?.moneyMissing, 'home');
  const noRate = arrivalView({ ...japan, budget: { currency: 'AUD' } }, opts(now));
  assert.equal(noRate?.money, null);
  assert.equal(noRate?.moneyMissing, 'rate');
  const bare = arrivalView(japan, opts(now, { tables: empty }));
  assert.ok(bare);
  assert.equal(bare.country, 'JP');
  assert.equal(bare.power, null);
  assert.equal(bare.emergency, null);
  assert.equal(bare.phrases, null);
  assert.ok(bare.clock);
  // no hotel with a map position: no wayback target
  const noPin = { ...japan, items: japan.items.map((i) => (i.kind === 'hotel' ? { ...i, place: { id: 'p', name: 'Inn' } } : i)) };
  assert.equal(arrivalView(noPin, opts(now))?.hotelTarget, null);
  // a broken emergency row (nothing dialable) shows the fallback number, never a blank
  const em: EmergencyTable = { version: 1, rule: '', countries: [{ iso2: 'JP', country: 'Japan', general: null, police: null, ambulance: null, fire: null, tourist_police: null, notes: null, source_url: null, source_checked: null } as unknown as EmergencyTable['countries'][number]] };
  const fb = arrivalView(japan, opts(now, { tables: { ...tables, emergency: em } }));
  assert.equal(fb?.emergency?.fallback, '112');
  assert.deepEqual(fb?.emergency?.lines, []);
  // unknown essentials fields stay null (UI: "Not sure, check locally")
  const es: EssentialsTable = { version: 1, rule: '', countries: [{ iso2: 'JP', country: 'Japan', plugs: null, voltage: null, frequency: null, driving: null, calling_code: null, sources: ['https://www.iec.ch/world-plugs'], checked: '2026-10-31' }] };
  const p = arrivalView(japan, opts(now, { tables: { ...tables, essentials: es } }))?.power;
  assert.deepEqual([p?.plugs, p?.voltage, p?.driving], [null, null, null]);
  // a country with no phrase language
  const gb = trip('Asia/Tokyo', [item('flight', ['2026-12-01T09:00', TYO], ['2026-12-01T14:00', LON])]);
  assert.equal(arrivalView(gb, { now: at('2026-12-01T16:00', LON), phoneZone: TYO, tables })?.phrases, null);
});

test('Trips tab: the first trip with an arrival not dismissed', () => {
  const now = at('2026-12-02T09:00', TYO);
  const second = { ...japan, id: 't2', name: 'Second' };
  assert.equal(arrivalForTrips([japan, second], opts(now))?.tripId, 't1');
  assert.equal(arrivalForTrips([japan, second], opts(now, { dismissed: ['t1|JP'] }))?.tripId, 't2');
  assert.equal(arrivalForTrips([japan, second], opts(now, { dismissed: ['t1|JP', 't2|JP'] })), null);
  assert.equal(arrivalForTrips([], opts(now)), null);
});

test('unreadable zones and notes never throw or count', () => {
  const odd = trip(SYD, [item('note', ['2026-12-02T09:00', TYO]), item('hotel', ['2026-12-02T09:00', 'Mars/Base'], ['2026-12-03T09:00', 'Mars/Base'])]);
  assert.deepEqual(tripCountries(odd, 'AU'), []);
  assert.equal(arrivalView(odd, opts(at('2026-12-02T10:00', TYO))), null);
});
