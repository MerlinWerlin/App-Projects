import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { demoTrip } from './demo.ts';
import {
  cardSide,
  carCountries,
  checklistProgress,
  checklistSteps,
  cleanRental,
  compareReturn,
  convertWhole,
  EMPTY_RENTAL,
  findDriving,
  fuelFraction,
  guideSections,
  hasDriving,
  isEmptyRental,
  isRentalKey,
  kmToMi,
  limitPairs,
  miToKm,
  parseOdo,
  photoCount,
  photoUris,
  rentalKey,
  rentalKeysToDrop,
  RETURN_BUFFER_MIN,
  returnPlan,
  rowProblems,
  searchDriving,
  stepTravel,
  tripDrivingBanners,
  withPhoto,
  withReading,
  type DrivingRow,
  type DrivingTable,
} from './driving.ts';
import type { Item, Trip } from './model.ts';
import { buildTripFile } from './tripfile.ts';
import { toUtc } from './tz.ts';

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

const row = (o: Partial<DrivingRow>): DrivingRow => ({
  iso2: 'JP',
  country: 'Japan',
  side: 'left',
  speed: 'kmh',
  idp: 'often',
  seatbelts: 'Belts for all.',
  phone: 'Hands-free only.',
  fuel: { petrol: 'Gasorin', diesel: 'Keiyu' },
  tolls: 'Expressways are tolled.',
  note: null,
  sources: ['https://www.gov.uk/foreign-travel-advice/japan'],
  checked: '2026-11-01',
  recheck: false,
  ...o,
});
const TABLE: DrivingTable = {
  version: 1,
  rule: 'verify locally',
  countries: [
    row({}),
    row({ iso2: 'FR', country: 'France', side: 'right', idp: 'not_usually', tolls: null, recheck: true }),
    row({ iso2: 'GB', country: 'United Kingdom', side: 'left', speed: 'mph', idp: 'not_usually' }),
    row({ iso2: 'AU', country: 'Australia', side: 'left', idp: null }),
  ],
};

const car = (id: string, start: [string, string], end?: [string, string]): Item => ({
  id,
  tripId: 't',
  kind: 'car',
  title: 'Car',
  start: { local: start[0], tz: start[1] },
  ...(end ? { end: { local: end[0], tz: end[1] } } : {}),
  attachments: [],
});

// ----------------------------------------------------------------------------------------------- lookup

test('findDriving: by code, case and spaces ignored; unknown or bad codes give null', () => {
  assert.equal(findDriving(TABLE, 'jp')?.country, 'Japan');
  assert.equal(findDriving(TABLE, ' gb ')?.speed, 'mph');
  assert.equal(findDriving(TABLE, 'XX'), null);
  assert.equal(findDriving(TABLE, 'JPN'), null);
  assert.equal(findDriving(TABLE, null), null);
  assert.equal(hasDriving(TABLE, 'FR'), true);
  assert.equal(hasDriving(TABLE, ''), false);
});

test('searchDriving: name prefix first, then contains; code match; empty gives all by name', () => {
  assert.deepEqual(searchDriving(TABLE, '').map((r) => r.iso2), ['AU', 'FR', 'JP', 'GB']);
  assert.deepEqual(searchDriving(TABLE, 'fr').map((r) => r.iso2), ['FR']);
  assert.deepEqual(searchDriving(TABLE, 'an').map((r) => r.iso2), ['FR', 'JP']);
  assert.deepEqual(searchDriving(TABLE, 'gb').map((r) => r.iso2), ['GB']);
});

test('rowProblems: a good row has none; missing side / unit / source are caught', () => {
  assert.deepEqual(rowProblems(row({})), []);
  assert.deepEqual(rowProblems(row({ side: 'middle' as never })), ['side']);
  assert.deepEqual(rowProblems(row({ speed: 'knots' as never })), ['speed']);
  assert.deepEqual(rowProblems(row({ sources: [] })), ['sources']);
  assert.deepEqual(rowProblems(row({ sources: ['http://x.com'] })), ['sources']);
  assert.deepEqual(rowProblems(row({ fuel: { petrol: '', diesel: 'x' } })), ['fuel']);
  assert.deepEqual(rowProblems(row({ idp: 'maybe' as never, checked: '1 Nov' })), ['idp', 'checked']);
});

test('guideSections: known first, unsure (null) last, the note only when there is one', () => {
  assert.deepEqual(guideSections(row({})).map((s) => s.id), ['idp', 'seatbelts', 'phone', 'fuel', 'tolls']);
  const s = guideSections(row({ idp: null, note: 'Zero alcohol.' }));
  assert.deepEqual(s.map((x) => `${x.id}:${x.known}`), ['seatbelts:true', 'phone:true', 'fuel:true', 'tolls:true', 'note:true', 'idp:false']);
});

// ----------------------------------------------------------------------------------------------- units

test('km <-> mi: exact factor both ways; whole-number conversion; bad input is null', () => {
  assert.equal(miToKm(1), 1.609344);
  assert.ok(Math.abs(kmToMi(1.609344) - 1) < 1e-12);
  assert.ok(Math.abs(kmToMi(miToKm(123.4)) - 123.4) < 1e-9);
  assert.equal(convertWhole(50, 'kmh'), 31);
  assert.equal(convertWhole(100, 'km'), 62);
  assert.equal(convertWhole(70, 'mph'), 113);
  assert.equal(convertWhole(30, 'mi'), 48);
  assert.equal(convertWhole(0, 'km'), 0);
  assert.equal(convertWhole(-1, 'km'), null);
  assert.equal(convertWhole(Number.NaN, 'mi'), null);
});

test('limitPairs: common limits in the local unit with the other unit', () => {
  assert.deepEqual(limitPairs('kmh').slice(0, 3), [{ value: 30, other: 19 }, { value: 50, other: 31 }, { value: 80, other: 50 }]);
  assert.deepEqual(limitPairs('mph').at(-1), { value: 70, other: 113 });
});

// ----------------------------------------------------------------------------------------------- car bookings

test('carCountries: pick-up then drop-off country; non-car items and bad zones give none', () => {
  assert.deepEqual(carCountries(car('c', ['2026-11-02T09:00', 'Asia/Tokyo'], ['2026-11-04T09:00', 'Asia/Tokyo'])), ['JP']);
  assert.deepEqual(carCountries(car('c', ['2026-11-02T09:00', 'Europe/Paris'], ['2026-11-04T09:00', 'Europe/London'])), ['FR', 'GB']);
  assert.deepEqual(carCountries(car('c', ['2026-11-02T09:00', 'Not/AZone'])), []);
  assert.deepEqual(carCountries({ ...car('c', ['2026-11-02T09:00', 'Asia/Tokyo']), kind: 'hotel' }), []);
});

test('tripDrivingBanners: one per covered car country in booking order, home left out; card side', () => {
  const trip = {
    items: [
      car('b', ['2026-11-06T09:00', 'Europe/Paris'], ['2026-11-07T09:00', 'Europe/Paris']),
      car('a', ['2026-11-02T09:00', 'Asia/Tokyo'], ['2026-11-04T09:00', 'Asia/Tokyo']),
      car('c', ['2026-11-08T09:00', 'Asia/Tokyo']),
      car('x', ['2026-11-09T09:00', 'America/Lima']),
      { ...car('h', ['2026-11-02T09:00', 'Australia/Sydney']), kind: 'hotel' as const },
    ],
  };
  const b = tripDrivingBanners(trip, TABLE);
  assert.deepEqual(b.map((x) => [x.iso2, x.side, x.itemIds.join(',')]), [['JP', 'left', 'a,c'], ['FR', 'right', 'b']]);
  assert.equal(cardSide(b), 'mixed');
  assert.deepEqual(tripDrivingBanners(trip, TABLE, 'jp').map((x) => x.iso2), ['FR']);
  assert.equal(cardSide(tripDrivingBanners(trip, TABLE, 'FR')), 'left');
  assert.equal(cardSide([]), null);
  assert.deepEqual(tripDrivingBanners({ items: [] }, TABLE), []);
});

// ----------------------------------------------------------------------------------------------- checklist

test('cleanRental: damaged values never throw; fields are cut and checked', () => {
  for (const raw of [null, undefined, 3, 'x', [], { photos: 'nope', pickup: [], return: 7 }]) {
    assert.deepEqual(cleanRental(raw), EMPTY_RENTAL);
  }
  const c = cleanRental({
    photos: { front: { uri: 'attachments/a.jpg', mime: 'image/jpeg', takenAt: '2026-11-02T00:00:00Z' }, rear: { uri: '' }, left: 5 },
    pickup: { fuel: 8, odo: '12,345' },
    return: { fuel: 9, odo: -3 },
    odoUnit: 'mi',
    deskPhone: '  +81 3 1234 5678  ',
    excess: 'x'.repeat(700),
    travelMin: 45,
  });
  assert.equal(c.photos.front?.uri, 'attachments/a.jpg');
  assert.equal(c.photos.rear, null);
  assert.equal(c.photos.left, null);
  assert.deepEqual(c.pickup, { fuel: 8, odo: 12345 });
  assert.deepEqual(c.return, { fuel: null, odo: null });
  assert.equal(c.odoUnit, 'mi');
  assert.equal(c.deskPhone, '+81 3 1234 5678');
  assert.equal(c.excess.length, 600);
  assert.equal(c.travelMin, 45);
  assert.equal(cleanRental({ travelMin: 2.5 }).travelMin, null);
  assert.equal(cleanRental({ travelMin: 999 }).travelMin, null);
});

test('parseOdo: digits with separators; nothing else', () => {
  assert.equal(parseOdo('12 345'), 12345);
  assert.equal(parseOdo('1.234'), 1234);
  assert.equal(parseOdo(0), 0);
  assert.equal(parseOdo('12a'), null);
  assert.equal(parseOdo('12345678'), null);
  assert.equal(parseOdo(1.5), null);
  assert.equal(parseOdo(''), null);
});

test('photos: set, replace (old file reported), remove; counts and uris', () => {
  const p = (uri: string) => ({ uri, mime: 'image/jpeg', takenAt: '' });
  let { next, replaced } = withPhoto(EMPTY_RENTAL, 'front', p('a.jpg'));
  assert.equal(replaced, null);
  ({ next, replaced } = withPhoto(next, 'front', p('b.jpg')));
  assert.equal(replaced, 'a.jpg');
  ({ next } = withPhoto(next, 'left', p('c.jpg')));
  assert.equal(photoCount(next), 2);
  assert.deepEqual(photoUris(next), ['b.jpg', 'c.jpg']);
  const gone = withPhoto(next, 'left', null);
  assert.equal(gone.replaced, 'c.jpg');
  assert.equal(photoCount(gone.next), 1);
  assert.equal(EMPTY_RENTAL.photos.front, null, 'the empty value is never changed');
});

test('checklist steps and progress: 4 sides + fuel and odometer at pick-up and return', () => {
  assert.equal(isEmptyRental(EMPTY_RENTAL), true);
  assert.deepEqual(checklistProgress(EMPTY_RENTAL), { done: 0, total: 8, pickupDone: false });
  let c = EMPTY_RENTAL;
  for (const s of ['front', 'rear', 'left', 'right'] as const) c = withPhoto(c, s, { uri: `${s}.jpg`, mime: 'image/jpeg', takenAt: '' }).next;
  c = withReading(c, 'pickup', { fuel: 8 });
  c = withReading(c, 'pickup', { odo: 1000 });
  assert.equal(isEmptyRental(c), false);
  assert.deepEqual(checklistProgress(c), { done: 6, total: 8, pickupDone: true });
  assert.deepEqual(checklistSteps(c).filter((s) => !s.done).map((s) => s.id), ['return_fuel', 'return_odo']);
  assert.equal(withReading(c, 'return', { fuel: 12 }).return.fuel, null);
  assert.equal(isEmptyRental({ ...EMPTY_RENTAL, deskPhone: '123' }), false);
});

test('compareReturn: distance driven in both units, a backwards odometer, less fuel back', () => {
  const c = withReading(withReading({ ...EMPTY_RENTAL, odoUnit: 'km' }, 'pickup', { fuel: 8, odo: 10_000 }), 'return', { fuel: 6, odo: 10_161 });
  assert.deepEqual(compareReturn(c), { driven: { value: 161, other: 100 }, odoBackwards: false, fuelLower: true });
  const mi = withReading(withReading({ ...EMPTY_RENTAL, odoUnit: 'mi' }, 'pickup', { odo: 500 }), 'return', { odo: 600, fuel: 8 });
  assert.deepEqual(compareReturn(mi), { driven: { value: 100, other: 161 }, odoBackwards: false, fuelLower: false });
  const back = withReading(withReading(EMPTY_RENTAL, 'pickup', { odo: 500 }), 'return', { odo: 400 });
  assert.equal(compareReturn(back).driven, null);
  assert.equal(compareReturn(back).odoBackwards, true);
  assert.deepEqual(compareReturn(EMPTY_RENTAL), { driven: null, odoBackwards: false, fuelLower: false });
});

test('fuelFraction: E, quarters, halves, eighths, F', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7, 8].map(fuelFraction), ['E', '1/8', '1/4', '3/8', '1/2', '5/8', '3/4', '7/8', 'F']);
});

test('returnPlan: drop-off on its own clock; leave by = drop-off - travel - buffer; across a DST change', () => {
  const item = car('c', ['2026-11-02T09:00', 'Asia/Tokyo'], ['2026-11-04T10:00', 'Asia/Tokyo']);
  const none = returnPlan(item, null);
  assert.equal(none?.returnAt.local, '2026-11-04T10:00');
  assert.equal(none?.leaveAt, null);
  const p = returnPlan(item, 45);
  assert.equal(p?.leaveAt?.local, '2026-11-04T09:00');
  assert.equal(p?.bufferMin, RETURN_BUFFER_MIN);
  assert.equal(p?.returnAt.utc, toUtc({ local: '2026-11-04T10:00', tz: 'Asia/Tokyo' }));
  // Europe/London falls back at 02:00 on 25 Oct 2026: 03:00 drop-off, 2 h 45 travel + 15 min = 3 h earlier is 01:00 (BST).
  const dst = returnPlan(car('d', ['2026-10-20T09:00', 'Europe/London'], ['2026-10-25T03:00', 'Europe/London']), 165);
  assert.equal(dst?.leaveAt?.local, '2026-10-25T01:00');
  assert.equal(returnPlan(car('e', ['2026-11-02T09:00', 'Asia/Tokyo']), 30), null);
  assert.equal(returnPlan({ ...item, kind: 'hotel' }, 30), null);
  assert.equal(returnPlan(car('f', ['2026-11-02T09:00', 'Asia/Tokyo'], ['bad', 'Asia/Tokyo']), 30), null);
});

test('stepTravel: starts at 30, steps of 5, below 0 clears, capped at 300', () => {
  assert.equal(stepTravel(null, 1), 30);
  assert.equal(stepTravel(null, -1), null);
  assert.equal(stepTravel(30, 1), 35);
  assert.equal(stepTravel(0, -1), null);
  assert.equal(stepTravel(300, 1), 300);
});

// ----------------------------------------------------------------------------------------------- phone-only guard

test('rental checklists stay on this phone: own key per booking, never in .satchel trip files', () => {
  assert.equal(rentalKey('item-1'), 'satchel.rental.v1.item-1');
  assert.notEqual(rentalKey('a'), rentalKey('b'));
  assert.equal(isRentalKey(rentalKey('x')), true);
  assert.equal(isRentalKey('satchel.rental.v1.'), false);
  assert.equal(isRentalKey('satchel.stay.v1.x'), false);
  for (const p of ['src/core/tripfile.ts', 'src/ui/TripExport.tsx', 'src/ui/TripImport.tsx', 'src/core/model.ts', 'src/state/tripTransfer.ts']) {
    assert.doesNotMatch(read(p), /driving\.ts|rentalKey|satchel\.rental|RentalChecklist|deskPhone/i, p);
  }
  // The key prefix is declared once, in the core.
  assert.equal((read('src/core/driving.ts').match(/'satchel\.rental\.v1\.'/g) ?? []).length, 1);
  // A trip file built from a trip whose car booking has a checklist saved carries none of it.
  const base = demoTrip('2026-11-02', '2026-10-01T00:00:00Z');
  const trip: Trip = { ...base, items: [...base.items, { ...car('car-1', ['2026-11-03T09:00', 'Asia/Tokyo'], ['2026-11-05T09:00', 'Asia/Tokyo']), tripId: base.id }] };
  const saved = new Map([[rentalKey('car-1'), cleanRental({ deskPhone: 'Zq0312345678', excess: 'ZqExcess', photos: { front: { uri: 'attachments/ZqFront.jpg' } }, pickup: { odo: 424242 } })]]);
  assert.equal(saved.size, 1);
  const file = JSON.stringify(buildTripFile(trip, {}, { now: '2026-10-31T00:00:00Z' }).file);
  assert.ok(file.includes('car-1'), 'the booking itself travels');
  assert.doesNotMatch(file, /satchel\.rental|Zq0312345678|ZqExcess|ZqFront|424242|deskPhone/);
});

test('rentalKeysToDrop: a deleted car booking takes its key; other kinds and kept bookings do not', () => {
  const a = car('a', ['2026-11-02T09:00', 'Asia/Tokyo']);
  const h = { ...car('h', ['2026-11-02T09:00', 'Asia/Tokyo']), kind: 'hotel' as const };
  assert.deepEqual(rentalKeysToDrop([a, h], []), [rentalKey('a')]);
  assert.deepEqual(rentalKeysToDrop([a], [{ items: [a] }]), []);
});

// ----------------------------------------------------------------------------------------------- UI source guards

test('driving UI: entry points wired, timed motion only, Ionicons 7 names checked by hand', () => {
  const files = ['app/driving/[iso2].tsx', 'app/rental/[itemId].tsx', 'src/ui/driving.tsx'];
  const src = files.map(read).join('\n');
  assert.doesNotMatch(src, /Animated\.spring|\bspring\(/);
  assert.doesNotMatch(src, /#[0-9a-fA-F]{3,8}\b|rgba?\(/, 'tokens only');
  const CHECKED = new Set([
    'add', 'remove', 'alarm-outline', 'call', 'call-outline', 'camera-outline', 'car-outline', 'checkbox-outline', 'key-outline',
    'search-outline', 'shield-outline', 'speedometer-outline', 'alert-circle-outline', 'chevron-forward', 'information-circle-outline',
    'bulb-outline', 'cash-outline', 'color-fill-outline', 'id-card-outline', 'phone-portrait-outline', 'shield-checkmark-outline',
    'checkmark-done-outline', 'swap-horizontal-outline', 'arrow-back', 'arrow-forward',
  ]);
  const used = new Set<string>();
  for (const m of src.matchAll(/(?:name|icon)=["{]'?([a-z][a-z0-9-]*)'?["}]?/g)) used.add(m[1]);
  for (const m of src.matchAll(/:\s*'([a-z]+(?:-[a-z]+)*-outline)'/g)) used.add(m[1]);
  for (const m of src.matchAll(/\?\s*'([a-z-]+)'\s*:\s*'([a-z-]+)'/g)) if (/outline|arrow|swap/.test(m[1] + m[2])) used.add(m[1]).add(m[2]);
  for (const n of used) if (/[a-z]-[a-z]|^(add|remove|call)$/.test(n) && !['side', 'stage', 'photo'].includes(n)) assert.ok(CHECKED.has(n), `unchecked icon ${n}`);
  assert.ok(used.size > 15);
  // Entry points: trip screen banner, trip card pill, booking slot, arrival card, customs country screen; routes registered.
  assert.match(read('app/trip/[id].tsx'), /<DriveSideBanner trip=\{trip\} \/>/);
  assert.match(read('src/ui/TripPass.tsx'), /<DriveSidePill banners=\{driving\} \/>/);
  assert.match(read('app/item/[id].tsx'), /<ItemRentalSlot item=\{item\} \/>/);
  assert.match(read('src/ui/ArrivalCard.tsx'), /pathname: '\/driving\/\[iso2\]'/);
  assert.match(read('app/customs/[iso2].tsx'), /<DrivingLink iso2=\{row\.iso2\}/);
  assert.match(read('app/_layout.tsx'), /name="driving\/\[iso2\]"/);
  assert.match(read('app/_layout.tsx'), /name="rental\/\[itemId\]"/);
  // Deleting a booking or trip takes its rental checklist and photos with it.
  assert.equal((read('src/state/trips.tsx').match(/forgetRentals\(rentalKeysToDrop\(/g) ?? []).length, 2);
});
