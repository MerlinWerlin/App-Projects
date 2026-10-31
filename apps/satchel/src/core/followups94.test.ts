// T100 run-94 follow-ups: shared packing text by bag, bag hints in other languages, trusted contacts from the
// emergency card, remembered ticks, back to the hotel and "does it fit" in Plan my day.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { bagHints, isBatteryItem, isLiquidItem, isMedicineItem, type Bag } from './bags.ts';
import { dayPlan, dayPlanRow, importDayPlans, nightHotel, planPoints, readDayPlans, setBackToHotel, setStopStay, STAY_MAX, STAY_MIN, STAY_STEP_MIN, stepStay, STOP_VISIT_MIN } from './dayplan.ts';
import { bagsInUse, groupByBag, packingTextByBag, type BagTextWords } from './followups94.ts';
import type { Idea } from './ideas.ts';
import type { Item, Trip } from './model.ts';
import type { PackItem, PackList } from './packing.ts';
import { cardContactsToTrust, cleanTicks, MAX_CONTACTS, SAFE_TICKS_KEY, tickedIds, ticksToStore, toggleTick, type SafeContact } from './safecheck.ts';
import { COVERS_INTL, packingText } from './smartpack.ts';
import { en } from '../i18n/en.ts';
import { followups94 } from '../i18n/en/followups94.ts';

// ------------------------------------------------------------------------------------------- packing text

const row = (id: string, label: string, category: string, extra: Partial<PackItem> = {}): PackItem => ({ id, label, done: false, category, ...extra });
const NAMES: Record<string, string> = { carry: 'Carry-on', personal: 'Personal item', checked: 'Checked bag' };
const words: BagTextWords = {
  title: 'Kyoto · Packing list',
  progress: (d, t) => `${d} of ${t} packed`,
  category: (c) => c.toUpperCase(),
  qty: (n) => `× ${n}`,
  empty: 'Nothing yet',
  bag: (b: Bag) => (b.kind === 'own' ? b.name ?? '' : NAMES[b.kind]!),
  noBag: 'Not in a bag yet',
};

test('shared text without bags in use is exactly the category text', () => {
  const list: PackList = { tripId: 't', items: [row('a', 'Passport', 'documents'), row('b', 'Socks', 'clothes', { qty: 3 })] };
  assert.equal(bagsInUse(list), false);
  assert.equal(packingTextByBag(list, words), packingText(list, words));
  // Bags set up but no row in one yet: still by category.
  const set: PackList = { ...list, bags: [{ id: 'carry', kind: 'carry', colour: 'sea' }] };
  assert.equal(bagsInUse(set), false);
  assert.equal(packingTextByBag(set, words), packingText(set, words));
});

test('shared text with bags in use: one block per bag in bag order (own bags too), then rows not in a bag', () => {
  const list: PackList = {
    tripId: 't',
    bags: [
      { id: 'carry', kind: 'carry', colour: 'sea' },
      { id: 'personal', kind: 'personal', colour: 'teal' },
      { id: 'checked', kind: 'checked', colour: 'rust' },
      { id: 'b1', kind: 'own', name: 'Camera bag', colour: 'plum' },
    ],
    items: [
      row('a', 'Socks', 'clothes', { bag: 'checked', qty: 4 }),
      row('b', 'Passport', 'documents', { bag: 'personal', done: true }),
      row('c', 'Charger', 'tech', { bag: 'carry' }),
      row('d', 'Lens', 'tech', { bag: 'b1' }),
      row('e', 'Umbrella', 'misc'),
      row('f', 'Power bank', 'tech', { bag: 'gone' }),
    ],
  };
  assert.equal(bagsInUse(list), true);
  assert.deepEqual(
    groupByBag(list).map((g) => [g.bag?.id ?? null, g.items.map((i) => i.id)]),
    [['carry', ['c']], ['personal', ['b']], ['checked', ['a']], ['b1', ['d']], [null, ['f', 'e']]],
  );
  assert.equal(
    packingTextByBag(list, words, (i) => i.qty),
    [
      'Kyoto · Packing list\n1 of 6 packed',
      'Carry-on\n☐ Charger',
      'Personal item\n☑ Passport',
      'Checked bag\n☐ Socks × 4',
      'Camera bag\n☐ Lens',
      'Not in a bag yet\n☐ Power bank\n☐ Umbrella',
    ].join('\n\n') + '\n',
  );
});

test('shared text by bag: empty bags are left out, the laundry note stays under the progress', () => {
  const list: PackList = { tripId: 't', items: [row('a', 'Socks', 'clothes', { bag: 'checked' })] };
  const text = packingTextByBag(list, { ...words, note: 'Laundry on the trip' });
  assert.equal(text, 'Kyoto · Packing list\n0 of 1 packed\nLaundry on the trip\n\nChecked bag\n☐ Socks\n');
});

// ------------------------------------------------------------------------------------------- bag hints

test('bag hints read item names in the synonym table languages', () => {
  for (const l of ['Powerbank', 'Akku', 'Batterie externe', 'Batería externa', 'Pilas', 'Batterijen']) assert.ok(isBatteryItem({ label: l }), l);
  for (const l of ['Medikamente', 'Médicaments', 'Medicamentos', 'Farmaci', 'Medicijnen', 'Insulina']) assert.ok(isMedicineItem({ label: l }), l);
  for (const l of ['Sonnencreme', 'Crème solaire', 'Champú', 'Duschgel', 'Dentifricio', 'Tandpasta', 'Kulturbeutel']) assert.ok(isLiquidItem({ label: l }), l);
  // Smart packing's own sun-cream synonyms all count as liquids.
  for (const l of COVERS_INTL.sunscreen) assert.ok(isLiquidItem({ label: l }), l);
  // Whole words only: no false hits inside other words.
  for (const l of ['Batteriefach-Deckel? no', 'Socken', 'Reisepass', 'Kamera']) assert.equal(isMedicineItem({ label: l }), false, l);
  assert.equal(isBatteryItem({ label: 'Schlafsack' }), false);
  assert.equal(isLiquidItem({ label: 'Pullover', category: 'clothes' }), false);
});

test('a German power bank and medicines in the checked bag get the cabin hints; French sun cream in the carry-on gets the liquids hint', () => {
  const list: PackList = {
    tripId: 't',
    items: [
      row('a', 'Powerbank 20000', 'misc', { bag: 'checked' }),
      row('b', 'Medikamente', 'misc', { bag: 'checked' }),
      row('c', 'Crème solaire', 'misc', { bag: 'carry' }),
      row('d', 'Pullover', 'clothes', { bag: 'checked' }),
    ],
  };
  const hints = bagHints(list);
  assert.deepEqual(
    hints.map((h) => [h.kind, h.itemIds]),
    [
      ['battery', ['a']],
      ['medicine', ['b']],
      ['liquids', ['c']],
    ],
  );
});

// ------------------------------------------------------------------------------------------- trusted contacts

const trusted = (id: string, phone: string, name = ''): SafeContact => ({ id, name, phone });

test('emergency card people not yet trusted are offered once each, in card order', () => {
  const card = [
    { id: 'e1', name: ' Mum ', phone: '+44 7700 900123', relation: 'Mother' },
    { id: 'e2', name: 'Sam', phone: '+61 400 000 111' },
    { id: 'e3', name: 'No number', phone: '' },
    { id: 'e4', name: 'Bad', phone: 'call me' },
    { id: 'e5', name: 'Mum again', phone: '+447700900123' },
  ];
  const offers = cardContactsToTrust(card, [trusted('s1', '+61400000111', 'Sam')]);
  assert.deepEqual(offers, [{ key: 'e1', name: 'Mum', phone: '+447700900123', relation: 'Mother' }]);
  assert.deepEqual(cardContactsToTrust(card, []).map((o) => o.key), ['e1', 'e2']);
  assert.deepEqual(cardContactsToTrust(null, []), []);
  assert.deepEqual(cardContactsToTrust([null as never, { phone: '12345' }], []), [{ key: 'card_1', name: '', phone: '12345' }]);
});

test('no offers once the trusted list is full', () => {
  const full = Array.from({ length: MAX_CONTACTS }, (_, i) => trusted(`s${i}`, `+100000000${i}`));
  assert.deepEqual(cardContactsToTrust([{ id: 'e', name: 'X', phone: '+4412345678' }], full), []);
});

// ------------------------------------------------------------------------------------------- remembered ticks

test('ticks: nothing remembered ticks everyone; a remembered untick stays; contacts added later start ticked', () => {
  const a = trusted('a', '+111');
  const b = trusted('b', '+222');
  const c = trusted('c', '+333');
  assert.deepEqual([...tickedIds(null, [a, b])], ['a', 'b']);
  assert.deepEqual([...tickedIds('junk', [a, b])], ['a', 'b']);
  const stored = toggleTick(null, [a, b], 'b');
  assert.deepEqual(stored, { ticked: ['a'], known: ['a', 'b'] });
  // Round trip through storage (JSON) and a fresh screen.
  const again = JSON.parse(JSON.stringify(stored));
  assert.deepEqual([...tickedIds(again, [a, b])], ['a']);
  assert.deepEqual([...tickedIds(again, [a, b, c])], ['a', 'c'], 'a new contact is ticked');
  assert.deepEqual(toggleTick(again, [a, b], 'b'), { ticked: ['a', 'b'], known: ['a', 'b'] });
  assert.deepEqual(toggleTick(again, [a, b], 'zz'), { ticked: ['a'], known: ['a', 'b'] }, 'an unknown id changes nothing');
  assert.deepEqual(ticksToStore([a, b], new Set(['b', 'gone'])), { ticked: ['b'], known: ['a', 'b'] });
  assert.deepEqual(cleanTicks({ ticked: ['a', 'a', 3, ''], known: 'x' }), { ticked: ['a'], known: [] });
});

test('ticks stay on this phone: the key is never part of a trip file', () => {
  assert.equal(SAFE_TICKS_KEY, 'satchel.safeTicks.v1');
  for (const p of ['src/core/tripfile.ts', 'src/core/model.ts', 'src/ui/TripExport.tsx', 'src/ui/TripImport.tsx']) {
    let text = '';
    try {
      text = readFileSync(p, 'utf8');
    } catch {
      continue;
    }
    assert.doesNotMatch(text, /safeTicks|SAFE_TICKS/, p);
  }
});

// ------------------------------------------------------------------------------------------- plan my day

const DAY = '2027-04-03';
const TZ = 'Asia/Tokyo';
const H = { lat: 35.7, lon: 139.7 };
const at = (dLat: number, dLon: number) => ({ lat: H.lat + dLat, lon: H.lon + dLon });
const hotel = (id = 'h1', from = '2027-04-01T15:00', to = '2027-04-05T11:00', p = H): Item => ({
  id,
  tripId: 't',
  kind: 'hotel',
  title: `Hotel ${id}`,
  start: { local: from, tz: TZ },
  end: { local: to, tz: TZ },
  place: { id: `p-${id}`, name: `Hotel ${id}`, ...p },
  attachments: [],
});
const activity = (id: string, local: string, p: { lat: number; lon: number }, end?: string): Item => ({
  id,
  tripId: 't',
  kind: 'activity',
  title: `Booking ${id}`,
  start: { local, tz: TZ },
  ...(end ? { end: { local: end, tz: TZ } } : {}),
  place: { id: `p-${id}`, name: `Place ${id}`, ...p },
  attachments: [],
});
const idea = (id: string, p: { lat: number; lon: number }): Idea => ({ id, name: `Idea ${id}`, category: 'see', ...p, day: DAY, createdAt: '2027-03-01T00:00:00.000Z' });
const trip = (items: Item[], ideas: Idea[] = [], extra: Partial<Trip> = {}): Trip => ({
  id: 't',
  name: 'Tokyo',
  startDate: '2027-04-01',
  endDate: '2027-04-05',
  homeTz: 'Australia/Sydney',
  items,
  ideas,
  createdAt: '2027-01-01T00:00:00.000Z',
  ...extra,
});

test('night hotel: checked in on or before the day and out after it (the new hotel on a moving day)', () => {
  const a = hotel('a', '2027-04-01T15:00', '2027-04-03T10:00', at(0, 0));
  const b = hotel('b', '2027-04-03T15:00', '2027-04-05T10:00', at(0.02, 0.02));
  const t = trip([a, b]);
  assert.equal(nightHotel(t, '2027-04-01')?.itemId, 'a');
  assert.equal(nightHotel(t, DAY)?.itemId, 'b');
  assert.equal(nightHotel(t, '2027-04-05'), null, 'check-out day of the last hotel');
});

test('back to hotel: off by default; on adds a last leg from the last stop, counted in the totals, and ends the map line', () => {
  const t0 = trip([hotel()], [idea('a', at(0, 0.01))]);
  const off = dayPlan(t0, DAY);
  assert.equal(off.backToHotel, false);
  assert.equal(off.back, undefined);
  assert.equal(off.night?.itemId, 'h1');
  const t1 = setBackToHotel(t0, DAY, true, '2027-04-03T08:00:00.000Z');
  assert.equal(dayPlanRow(t1, DAY)?.backToHotel, true);
  const on = dayPlan(t1, DAY);
  assert.equal(on.backToHotel, true);
  assert.ok(on.back);
  assert.equal(on.back!.from.name, 'Idea a');
  assert.equal(on.back!.to.name, 'Hotel h1');
  assert.ok(on.back!.minutes > 0);
  assert.equal(on.minutes, off.minutes + on.back!.minutes);
  assert.ok(Math.abs(on.walkM - (off.walkM + on.back!.walkM)) < 1e-6);
  assert.deepEqual(planPoints(on).at(-1), { lat: H.lat, lon: H.lon });
  assert.equal(planPoints(on).length, planPoints(off).length + 1);
  // Per day: another day is untouched; switching off removes the (otherwise empty) row.
  assert.equal(dayPlanRow(t1, '2027-04-02'), undefined);
  assert.equal(setBackToHotel(t1, DAY, true), t1, 'no change');
  const t2 = setBackToHotel(t1, DAY, false);
  assert.equal(t2.dayPlans, undefined);
});

test('back to hotel: no leg without a hotel that night, or when the day ends on a departure', () => {
  const noNight = setBackToHotel(trip([hotel('h1', '2027-04-01T15:00', '2027-04-03T10:00')], [idea('a', at(0, 0.01))]), DAY, true);
  const p = dayPlan(noNight, DAY);
  assert.equal(p.night, null);
  assert.equal(p.back, undefined);
  assert.equal(p.backToHotel, true, 'the choice is still remembered');
  const flight: Item = {
    id: 'f',
    tripId: 't',
    kind: 'flight',
    title: 'Flight out',
    start: { local: `${DAY}T18:00`, tz: TZ },
    end: { local: `${DAY}T21:00`, tz: 'Asia/Seoul' },
    from: { id: 'pf', name: 'HND', lat: 35.55, lon: 139.78 },
    to: { id: 'pt', name: 'ICN', lat: 37.46, lon: 126.44 },
    attachments: [],
  } as Item;
  const dep = dayPlan(setBackToHotel(trip([hotel(), flight]), DAY, true), DAY);
  assert.equal(dep.stops.at(-1)?.role, 'to', 'the day ends on landing in Seoul');
  assert.equal(dep.back, undefined, 'no walk back to Tokyo from another city');
  // A departure with no arrival that day (an overnight flight): you are on the way, no walk back.
  const overnight = { ...flight, end: { local: '2027-04-04T07:00', tz: 'Asia/Seoul' } } as Item;
  const night = dayPlan(setBackToHotel(trip([hotel(), overnight]), DAY, true), DAY);
  assert.equal(night.stops.at(-1)?.role, 'from');
  assert.equal(night.back, undefined);
});

test('back to hotel survives reading, keeps a row on its own, and travels through file import', () => {
  const rows = readDayPlans({ dayPlans: [{ day: DAY, backToHotel: true }, { day: '2027-04-04', backToHotel: 'yes' }] as unknown as Trip['dayPlans'] });
  assert.deepEqual(rows, [{ day: DAY, backToHotel: true }]);
  const imported = importDayPlans(rows, { ideas: new Map(), items: new Map(), places: new Map() });
  assert.deepEqual(imported, [{ day: DAY, backToHotel: true }]);
});

test('does it fit: walk + stops against the time between two timed bookings', () => {
  // Two bookings an hour apart, about 1.8 km apart, with two stops in between: 2 x 30 min of stops alone fill the hour.
  const a = activity('a', `${DAY}T10:00`, at(0, 0));
  const b = activity('b', `${DAY}T11:00`, at(0, 0.02));
  const tight = dayPlan(trip([a, b], [idea('x', at(0.001, 0.007)), idea('y', at(0.001, 0.014))]), DAY);
  const bStop = tight.stops.find((s) => s.itemId === 'b')!;
  assert.ok(bStop.fit);
  assert.equal(bStop.fit!.stops, 2);
  assert.equal(bStop.fit!.visitMin, 2 * STOP_VISIT_MIN);
  assert.equal(bStop.fit!.freeMin, 60);
  assert.ok(bStop.fit!.walkMin > 0);
  assert.equal(bStop.fit!.needMin, bStop.fit!.walkMin + 2 * STOP_VISIT_MIN);
  assert.equal(bStop.fit!.ok, false);
  assert.equal(bStop.fit!.after, 'Booking a');
  assert.equal(tight.noFit, 1);
  assert.equal(tight.stops.find((s) => s.itemId === 'a')!.fit, undefined, 'the first timed booking has nothing before it');

  // Same walk, three hours between: fits.
  const roomy = dayPlan(trip([a, activity('b', `${DAY}T13:00`, at(0, 0.02))], [idea('x', at(0.001, 0.007)), idea('y', at(0.001, 0.014))]), DAY);
  const r = roomy.stops.find((s) => s.itemId === 'b')!.fit!;
  assert.equal(r.ok, true);
  assert.equal(r.freeMin, 180);
  assert.equal(roomy.noFit, 0);

  // The earlier booking's end time counts: a 10:00-12:30 tour leaves 30 minutes before a 13:00 booking.
  const tour = dayPlan(trip([activity('a', `${DAY}T10:00`, at(0, 0), `${DAY}T12:30`), activity('b', `${DAY}T13:00`, at(0, 0.02))], [idea('x', at(0.001, 0.01))]), DAY);
  const f = tour.stops.find((s) => s.itemId === 'b')!.fit!;
  assert.equal(f.freeMin, 30);
  assert.equal(f.ok, false);

  // No stops, a short walk, plenty of time: fits and no stops counted.
  const plain = dayPlan(trip([a, activity('b', `${DAY}T12:00`, at(0, 0.005))]), DAY);
  const pf = plain.stops.find((s) => s.itemId === 'b')!.fit!;
  assert.equal(pf.stops, 0);
  assert.equal(pf.visitMin, 0);
  assert.equal(pf.ok, true);
});

// ------------------------------------------------------------------------------------------- strings

test('T100 strings are in the catalogue under f94.', () => {
  const keys = Object.keys(followups94);
  assert.ok(keys.length > 0);
  for (const k of keys) {
    assert.ok(k.startsWith('f94.'), k);
    assert.equal((en as Record<string, string>)[k], (followups94 as Record<string, string>)[k]);
  }
});

// ---- T104: per-stop length

test('T104: a stop length the traveller sets counts in the fit check instead of 30 min', () => {
  const a = activity('a', `${DAY}T10:00`, at(0, 0));
  const b = activity('b', `${DAY}T13:00`, at(0, 0.02));
  const t0 = trip([a, b], [idea('x', at(0.001, 0.007)), idea('y', at(0.001, 0.014))]);
  const before = dayPlan(t0, DAY);
  assert.equal(before.stops.find((s) => s.key === 'idea:x')!.stayMin, STOP_VISIT_MIN, 'default stays 30 min');
  assert.equal(before.stops.find((s) => s.itemId === 'b')!.fit!.ok, true);
  const t1 = setStopStay(setStopStay(t0, DAY, 'idea:x', 120, '2027-04-03T08:00:00.000Z'), DAY, 'idea:y', 90);
  assert.deepEqual(dayPlanRow(t1, DAY)?.stays, [{ ideaId: 'x', min: 120 }, { ideaId: 'y', min: 90 }]);
  const after = dayPlan(t1, DAY);
  assert.equal(after.stops.find((s) => s.key === 'idea:x')!.stayMin, 120);
  const fit = after.stops.find((s) => s.itemId === 'b')!.fit!;
  assert.equal(fit.visitMin, 210);
  assert.equal(fit.needMin, fit.walkMin + 210);
  assert.equal(fit.ok, false, '3.5 h of stops no longer fit in 3 h');
  // Back to 30 min clears the stored length; the row goes when nothing else is in it.
  const t2 = setStopStay(setStopStay(t1, DAY, 'idea:x', STOP_VISIT_MIN), DAY, 'idea:y', STOP_VISIT_MIN);
  assert.equal(t2.dayPlans, undefined);
  // Unchanged: same length, a booking key, out of range or off the 15-minute steps.
  assert.equal(setStopStay(t1, DAY, 'idea:x', 120), t1);
  assert.equal(setStopStay(t0, DAY, 'a:place', 60), t0);
  assert.equal(setStopStay(t0, DAY, 'idea:x', 0), t0);
  assert.equal(setStopStay(t0, DAY, 'idea:x', 600), t0);
  assert.equal(setStopStay(t0, DAY, 'idea:x', 40), t0);
});

test('T104: stop length buttons step by 15 min between 15 min and 8 h', () => {
  assert.equal(stepStay(30, 1), 45);
  assert.equal(stepStay(30, -1), 15);
  assert.equal(stepStay(STAY_MIN, -1), null);
  assert.equal(stepStay(STAY_MAX, 1), null);
  assert.equal(stepStay(STAY_STEP_MIN * 4, 1), 75);
});

test('T104: stop lengths are read defensively and travel through file import with new ids', () => {
  const raw = [{ day: DAY, stays: [{ ideaId: 'x', min: 60 }, { ideaId: 'x', min: 90 }, { placeId: 'p', min: 7 }, { itemId: 'a', role: 'place', min: 60 }, { placeId: 'q', min: '60' }, { ideaId: 'z', min: 45, extra: 1 }] }];
  const rows = readDayPlans({ dayPlans: raw as unknown as Trip['dayPlans'] });
  assert.deepEqual(rows, [{ day: DAY, stays: [{ ideaId: 'x', min: 60 }, { ideaId: 'z', min: 45 }] }]);
  const imported = importDayPlans(rows, { ideas: new Map([['x', 'x2']]), items: new Map(), places: new Map() });
  assert.deepEqual(imported, [{ day: DAY, stays: [{ ideaId: 'x2', min: 60 }] }], 'a stop not imported loses its length');
  assert.equal(importDayPlans([{ day: DAY, stays: [{ ideaId: 'gone', min: 60 }] }], { ideas: new Map(), items: new Map(), places: new Map() }), undefined);
});
