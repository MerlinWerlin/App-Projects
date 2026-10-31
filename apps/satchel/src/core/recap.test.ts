import assert from 'node:assert/strict';
import { test } from 'node:test';
import { demoTrip } from './demo.ts';
import { withSampleSpending } from './demoExtras.ts';
import type { JournalEntry, JournalMood } from './journal.ts';
import type { Expense, Item, Place, Trip } from './model.ts';
import { bestDay, MOOD_POINTS, moodCounts, photoStrip, recapPhase, recapText, recapTrips, tripRecap, type RecapWords } from './recap.ts';
import { addDays } from './tz.ts';

const item = (id: string, x: Partial<Item> & Pick<Item, 'kind' | 'start'>): Item => ({ id, tripId: 't', title: id, attachments: [], ...x });
const trip = (id: string, x: Partial<Trip> = {}): Trip => ({
  id,
  name: id,
  startDate: '2026-03-01',
  endDate: '2026-03-05',
  homeTz: 'Australia/Sydney',
  items: [],
  createdAt: '2026-01-01T00:00:00Z',
  ...x,
});
const page = (id: string, day: string, mood?: JournalMood, photos = 0, note = ''): JournalEntry => ({
  id,
  day,
  note,
  photos: Array.from({ length: photos }, (_, k) => ({ id: `${id}-p${k}`, uri: `attachments/${id}-${k}.jpg`, name: `${k}.jpg`, mime: 'image/jpeg' })),
  ...(mood ? { mood } : {}),
  createdAt: `${day}T10:00:00Z`,
});
const exp = (id: string, amount: number, currency: string, category: Expense['category'], day = '2026-03-02'): Expense => ({ id, amount, currency, category, day });
const SYD: Place = { id: 'syd', name: 'Sydney', lat: -33.9366, lon: 151.1658 };
const HND: Place = { id: 'hnd', name: 'Haneda', lat: 35.5447, lon: 139.7682 };

const words: RecapWords = {
  heading: (n) => `Trip recap: ${n}`,
  dates: (r, d) => `${r} · ${d} days`,
  soFar: (n, d) => `Day ${n} of ${d} so far`,
  cities: (l) => `Cities: ${l}`,
  countries: (l) => `Countries: ${l}`,
  distance: (km, flown) => `${km} km travelled (${flown} km flown)`,
  spent: (a) => `Spent: ${a}`,
  category: (c, a) => `${c} ${a}`,
  unrated: (l) => `Not converted (no rate): ${l}`,
  moods: (l) => `Moods: ${l}`,
  mood: (m) => m,
  best: (d, m) => `Best day: ${d} (${m})`,
  bestOutside: (d, m) => `Best day: ${d} (${m})`,
  dayLabel: (n) => `Day ${n}`,
  been: (l) => `Been there: ${l}`,
  footer: 'Made with Satchel',
};
const textOpts = { formatRange: (a: string, b: string) => `${a} – ${b}`, formatDay: (d: string) => d, countryName: (c: string) => (c === 'JP' ? 'Japan' : c) };

test('empty trip: zeros everywhere, nothing invented', () => {
  const r = tripRecap(trip('e'), '2026-04-01');
  assert.equal(r.phase, 'past');
  assert.equal(r.available, true);
  assert.equal(r.days, 5);
  assert.equal(r.daysSoFar, 5);
  assert.deepEqual(r.cities, []);
  assert.deepEqual(r.countries, []);
  assert.deepEqual(r.distance, { legs: 0, measured: 0, unmeasured: 0, km: 0, flights: 0, flownKm: 0 });
  assert.deepEqual(r.spending, { home: null, totalHome: null, categories: [], unrated: [], count: 0 });
  assert.deepEqual(r.journal, { pages: 0, days: 0, photos: 0, moods: [] });
  assert.deepEqual(r.strip, []);
  assert.deepEqual(r.ideas, { total: 0, done: 0, been: [] });
  assert.equal(r.bestDay, null);
  const text = recapText(r, words, { ...textOpts, includeSpending: true });
  assert.equal(text, 'Trip recap: e\n2026-03-01 – 2026-03-05 · 5 days\n\nMade with Satchel');
});

test('phase: upcoming trips have no recap yet; on-now trips count days so far', () => {
  const t = trip('p');
  assert.equal(recapPhase(t, '2026-02-28'), 'upcoming');
  assert.equal(recapPhase(t, '2026-03-01'), 'active');
  assert.equal(recapPhase(t, '2026-03-06'), 'past');
  const up = tripRecap(t, '2026-02-01');
  assert.equal(up.available, false);
  assert.equal(up.daysSoFar, 0);
  const on = tripRecap(t, '2026-03-03');
  assert.equal(on.daysSoFar, 3);
  assert.match(recapText(on, words, textOpts), /Day 3 of 5 so far/);
});

test('demo trip: Tokyo and Kyoto in Japan, measured legs, yen converted to AUD with the sample rate', () => {
  const start = '2026-10-01';
  const d = withSampleSpending(demoTrip(start, '2026-09-01T00:00:00Z'), '2026-09-01T00:00:00Z');
  const r = tripRecap(d, '2026-10-31', { countryName: (c) => (c === 'JP' ? 'Japan' : null) });
  assert.equal(r.demo, true);
  assert.equal(r.phase, 'past');
  assert.equal(r.days, 9);
  assert.deepEqual(r.cities, ['Kyoto', 'Tokyo']);
  assert.deepEqual(r.countries, ['JP']);
  assert.equal(r.distance.legs, 3);
  assert.equal(r.distance.measured, 3);
  assert.equal(r.distance.flights, 2);
  // Sydney–Haneda ~7,800 km, Kansai–Sydney ~7,800 km, Tokyo–Kyoto ~370 km
  assert.ok(r.distance.flownKm > 15000 && r.distance.flownKm < 16000, String(r.distance.flownKm));
  assert.ok(r.distance.km - r.distance.flownKm > 300 && r.distance.km - r.distance.flownKm < 450);
  // 11,900 yen at 0.0102 = A$121.38 in total; food 6,000 yen = A$61.20 is the biggest
  assert.equal(r.spending.home, 'AUD');
  assert.equal(r.spending.totalHome, 12138);
  assert.deepEqual(r.spending.unrated, []);
  assert.equal(r.spending.categories[0].category, 'food');
  assert.equal(r.spending.categories[0].home, 6120);
  assert.deepEqual(
    r.spending.categories.map((c) => c.category),
    ['food', 'transport', 'shopping', 'activities'],
  );
  const sum = r.spending.categories.reduce((s, c) => s + (c.home ?? 0), 0);
  assert.equal(sum, 12138);
  // the demo is still a recap while in progress
  const mid = tripRecap(d, addDays(start, 2));
  assert.equal(mid.phase, 'active');
  assert.equal(mid.distance.legs, 1);
});

test('demo share text never carries booking codes, seats, notes or attachments', () => {
  const d = withSampleSpending(demoTrip('2026-10-01', '2026-09-01T00:00:00Z'), '2026-09-01T00:00:00Z');
  const text = recapText(tripRecap(d, '2026-10-31'), words, { ...textOpts, includeSpending: true });
  for (const secret of ['DMO4KX', 'H-58213', 'JR-90314', 'GG-7781', '34K', '41A', 'Car 7', 'shoes off', 'Ramen lunch', 'sample)']) assert.ok(!text.includes(secret), secret);
  assert.match(text, /Cities: Kyoto, Tokyo/);
  assert.match(text, /Countries: Japan/);
  assert.match(text, /Spent: A\$121\.38/);
  assert.match(text, /km travelled/);
});

test('multi-currency: rated currencies convert, unrated ones are listed apart and never guessed', () => {
  const t = trip('m', {
    budget: { currency: 'AUD' },
    rates: { JPY: 0.01 },
    expenses: [exp('1', 5000, 'AUD', 'food'), exp('2', 10000, 'JPY', 'food'), exp('3', 2500, 'EUR', 'stay'), exp('4', 1000, 'EUR', 'food'), exp('5', 900, 'THB', 'shopping')],
  });
  const r = tripRecap(t, '2026-04-01').spending;
  assert.equal(r.home, 'AUD');
  assert.equal(r.totalHome, 5000 + 10000);
  assert.deepEqual(r.unrated, [
    { currency: 'EUR', amount: 3500 },
    { currency: 'THB', amount: 900 },
  ]);
  const food = r.categories.find((c) => c.category === 'food')!;
  assert.equal(food.home, 15000);
  assert.equal(food.partial, true);
  assert.equal(food.fraction, 1);
  const stay = r.categories.find((c) => c.category === 'stay')!;
  assert.equal(stay.home, null);
  assert.equal(stay.partial, true);
  assert.equal(stay.fraction, 0);
  assert.equal(r.categories[0].category, 'food');
  const text = recapText(tripRecap(t, '2026-04-01'), words, { ...textOpts, includeSpending: true });
  assert.match(text, /Spent: A\$150\.00/);
  assert.match(text, /Not converted \(no rate\): €35\.00, THB\s?9\.00/);
  // spending only goes in when asked
  assert.ok(!recapText(tripRecap(t, '2026-04-01'), words, textOpts).includes('Spent'));
});

test('no home currency: every amount is listed apart in its own currency', () => {
  const t = trip('n', { expenses: [exp('1', 1200, 'JPY', 'food'), exp('2', 300, 'USD', 'other')] });
  const r = tripRecap(t, '2026-04-01').spending;
  assert.equal(r.home, null);
  assert.equal(r.totalHome, null);
  assert.deepEqual(r.unrated, [
    { currency: 'JPY', amount: 1200 },
    { currency: 'USD', amount: 300 },
  ]);
  assert.ok(r.categories.every((c) => c.home === null && c.partial));
});

test('trip with no coordinates: legs are counted but never measured', () => {
  const t = trip('c', {
    items: [
      item('f', { kind: 'flight', from: { id: 'a', name: 'A' }, to: { id: 'b', name: 'B' }, start: { local: '2026-03-01T09:00', tz: 'Australia/Sydney' }, end: { local: '2026-03-01T17:00', tz: 'Asia/Tokyo' } }),
      item('b', { kind: 'bus', start: { local: '2026-03-02T09:00', tz: 'Asia/Tokyo' } }),
      item('h', { kind: 'hotel', start: { local: '2026-03-01T19:00', tz: 'Asia/Tokyo' }, place: { id: 'x', name: 'X', address: '1-1 Shibuya, Tokyo' } }),
    ],
  });
  const r = tripRecap(t, '2026-04-01');
  assert.deepEqual(r.distance, { legs: 2, measured: 0, unmeasured: 2, km: 0, flights: 1, flownKm: 0 });
  assert.deepEqual(r.cities, ['Tokyo']);
  assert.deepEqual(r.countries, ['JP']);
  assert.ok(!recapText(r, words, textOpts).includes('km'));
});

test('legs that have not started yet are left out of an on-now trip', () => {
  const t = trip('l', {
    items: [
      item('1', { kind: 'flight', from: SYD, to: HND, start: { local: '2026-03-01T09:00', tz: 'Australia/Sydney' }, end: { local: '2026-03-01T17:00', tz: 'Asia/Tokyo' } }),
      item('2', { kind: 'flight', from: HND, to: SYD, start: { local: '2026-03-05T09:00', tz: 'Asia/Tokyo' }, end: { local: '2026-03-05T20:00', tz: 'Australia/Sydney' } }),
    ],
  });
  const on = tripRecap(t, '2026-03-03').distance;
  assert.equal(on.legs, 1);
  const done = tripRecap(t, '2026-03-10').distance;
  assert.equal(done.legs, 2);
  assert.equal(done.km, done.flownKm);
  assert.ok(Math.abs(done.km - 2 * on.km) <= 1);
});

test('moods are counted most first; the photo strip keeps page order and skips missing files', () => {
  const t = trip('j', {
    journal: [page('b', '2026-03-02', 'relaxed', 2), page('a', '2026-03-01', 'joyful', 1), page('c', '2026-03-02', 'relaxed'), page('d', '2026-03-03', 'joyful')],
  });
  assert.deepEqual(moodCounts(t), [
    { mood: 'joyful', count: 2 },
    { mood: 'relaxed', count: 2 },
  ]);
  const strip = photoStrip(t);
  assert.deepEqual(
    strip.map((p) => [p.id, p.day]),
    [
      ['a-p0', '2026-03-01'],
      ['b-p0', '2026-03-02'],
      ['b-p1', '2026-03-02'],
    ],
  );
  const missing = trip('k', { journal: [{ ...page('x', '2026-03-01', undefined, 1), photos: [{ id: 'q', uri: '', name: 'q', mime: 'image/jpeg' }] }] });
  assert.deepEqual(photoStrip(missing), []);
  assert.equal(photoStrip(trip('big', { journal: [page('z', '2026-03-01', undefined, 6), page('y', '2026-03-02', undefined, 6)] }), 8).length, 8);
});

test('best day: highest summed mood points, ties to more photos, then the earlier day; needs points', () => {
  assert.equal(MOOD_POINTS.joyful, 3);
  assert.equal(bestDay(trip('none')), null);
  assert.equal(bestDay(trip('meh', { journal: [page('1', '2026-03-01', 'meh'), page('2', '2026-03-02', 'tired', 3)] })), null);
  const t = trip('b', {
    journal: [
      page('1', '2026-03-01', 'joyful'),
      page('2', '2026-03-02', 'relaxed'),
      page('3', '2026-03-02', 'grateful'),
      page('4', '2026-03-03', 'adventurous', 2),
      page('5', '2026-03-03', 'tired'),
    ],
  });
  // day 2: 2+2 = 4 beats day 1 (3) and day 3 (3+0)
  const b = bestDay(t)!;
  assert.equal(b.day, '2026-03-02');
  assert.equal(b.dayNumber, 2);
  assert.equal(b.score, 4);
  assert.equal(b.pages, 2);
  assert.equal(['relaxed', 'grateful'].includes(b.mood), true);
  // tie on points: the day with more photos wins
  const tie = trip('t', { journal: [page('1', '2026-03-01', 'joyful'), page('2', '2026-03-04', 'adventurous', 1)] });
  assert.equal(bestDay(tie)!.day, '2026-03-04');
  assert.equal(bestDay(tie)!.mood, 'adventurous');
  // full tie: the earlier day
  const even = trip('e', { journal: [page('1', '2026-03-03', 'joyful'), page('2', '2026-03-01', 'joyful')] });
  assert.equal(bestDay(even)!.day, '2026-03-01');
  // a page outside the trip's dates still counts, without a day number
  const out = trip('o', { journal: [page('1', '2026-03-09', 'joyful')] });
  assert.equal(bestDay(out)!.dayNumber, null);
});

test('share text: moods, best day and been-there ideas; journal notes never included', () => {
  const t = trip('s', {
    name: 'Lisbon\nweekend',
    journal: [page('1', '2026-03-02', 'joyful', 1, 'Private diary words')],
    ideas: [
      { id: 'i1', name: 'Tram 28', category: 'do', done: true, createdAt: '' },
      { id: 'i2', name: 'Pastry shop', category: 'eat', createdAt: '' },
    ],
  });
  const r = tripRecap(t, '2026-04-01');
  assert.deepEqual(r.ideas, { total: 2, done: 1, been: [{ id: 'i1', name: 'Tram 28', category: 'do' }] });
  const text = recapText(r, words, textOpts);
  assert.match(text, /^Trip recap: Lisbon weekend\n/);
  assert.match(text, /Moods: joyful 1/);
  assert.match(text, /Best day: Day 2, 2026-03-02 \(joyful\)/);
  assert.match(text, /Been there: Tram 28/);
  assert.ok(!text.includes('Pastry shop'));
  assert.ok(!text.includes('Private diary'));
  assert.ok(!text.includes('attachments/'));
});

test('recapTrips: started trips only, newest first, demo only when asked', () => {
  const list = [trip('old', { startDate: '2025-01-01', endDate: '2025-01-05' }), trip('future', { startDate: '2027-01-01', endDate: '2027-01-02' }), trip('now', { startDate: '2026-10-30', endDate: '2026-11-02' }), demoTrip('2026-09-01')];
  assert.deepEqual(
    recapTrips(list, '2026-10-31').map((t) => t.id),
    ['now', 'old'],
  );
  assert.deepEqual(
    recapTrips(list, '2026-10-31', true).map((t) => t.id),
    ['now', 'demo', 'old'],
  );
});

test('malformed stored rows are skipped, not thrown on', () => {
  const t = trip('bad', {
    journal: [{ nope: 1 } as unknown as JournalEntry, page('ok', '2026-03-01', 'joyful')],
    expenses: [{ id: 'x', amount: -5, currency: 'usd', category: 'food', day: 'x' } as unknown as Expense, exp('y', 100, 'USD', 'food')],
    ideas: [null as unknown as never],
  });
  const r = tripRecap(t, '2026-04-01');
  assert.equal(r.journal.pages, 1);
  assert.equal(r.spending.count, 1);
  assert.equal(r.ideas.total, 0);
});

test('the recap never reads the vault, the emergency card or booking codes', async () => {
  const { readFileSync } = await import('node:fs');
  for (const rel of ['./recap.ts', '../../app/recap/[tripId].tsx', '../ui/slots/TripRecapSlot.tsx', '../ui/RecapList.tsx']) {
    const src = readFileSync(new URL(rel, import.meta.url), 'utf8');
    assert.ok(!/vault|emergency|medicalNotes|insurer|\.ref\b|\.seat\b|attachments\b/i.test(src.replace(/^\s*(\/\/|\*).*$/gm, '')), rel);
  }
});
