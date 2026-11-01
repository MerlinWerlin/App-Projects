// T136 outfit planner: category words, wardrobe from the packing list, the trip's days on its own zones, wear counts
// with laundry resets, hints, editing, today's outfit, the weather stop for a day and the .satchel / catalogue guards.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Item, Trip } from './model.ts';
import {
  addExtra,
  clearSlot,
  copyDayOutfit,
  GARMENT_CATS,
  GARMENT_WORDS,
  guessGarment,
  outfitComplete,
  outfitDates,
  outfitToday,
  packKey,
  plannedCount,
  previousOutfitDay,
  readFileOutfits,
  readOutfits,
  removeExtra,
  setLaundryDay,
  setPiece,
  setPieceCat,
  slotPieces,
  sortPieces,
  SPARE_AT,
  stopForDate,
  todayOutfit,
  wardrobe,
  wearCounts,
  wearHint,
  type Piece,
  type TripOutfits,
} from './outfits.ts';
import { buildTripFile, importTripFile, parseTripFileText } from './tripfile.ts';
import { toUtc } from './tz.ts';
import { en } from '../i18n/en.ts';

const NOW = '2027-04-01T00:00:00.000Z';
let n = 0;
const newId = (p: string) => `${p}_${++n}`;

const trip = (extra: Partial<Trip> = {}): Trip => ({
  id: 't1',
  name: 'Lisbon',
  startDate: '2027-04-01',
  endDate: '2027-04-07',
  homeTz: 'Australia/Sydney',
  items: [],
  createdAt: NOW,
  ...extra,
});

const pack = [
  { label: 'Linen shirt', category: 'clothes', qty: 2 },
  { label: 'Shorts', category: 'clothes' },
  { label: 'Sandals', category: 'clothes' },
  { label: 'Socks', category: 'clothes', qty: 5 },
  { label: 'Underwear', category: 'clothes' },
  { label: 'Passport', category: 'documents' },
  { label: 'Rain jacket', category: 'misc' },
  { label: 'Comfortable things', category: 'clothes' },
];

// ---------------------------------------------------------------- category words

test('guessGarment: the packing templates’ clothes words and everyday names', () => {
  const cases: [string, ReturnType<typeof guessGarment>][] = [
    ['Comfortable tops', 'top'],
    ['Work shirts or tops', 'top'],
    ['T-shirts', 'top'],
    ['Short-sleeve shirt', 'top'],
    ['Dress shirt', 'top'],
    ['Comfortable trousers or shorts', 'bottom'],
    ['Trousers or skirts', 'bottom'],
    ['Jeans', 'bottom'],
    ['Waterproof snow trousers', 'bottom'],
    ['Leggings', 'bottom'],
    ['Evening outfit', 'dress'],
    ['Summer dresses', 'dress'],
    ['Swimwear', 'dress'],
    ['Swimming costume', 'dress'],
    ['Jumpsuit', 'dress'],
    ['Rain jacket', 'layer'],
    ['Warm layer for evenings', 'layer'],
    ['Thermal base layers', 'layer'],
    ['Beach cover-up', 'layer'],
    ['Weather-appropriate outerwear', 'layer'],
    ['Hoodie', 'layer'],
    ['Comfortable walking shoes', 'shoes'],
    ['Hiking boots or shoes', 'shoes'],
    ['Dress shoes', 'shoes'],
    ['Flip-flops', 'shoes'],
    ['Sandals', 'shoes'],
    ['Sun hat', 'accessory'],
    ['Warm hat or neck warmer', 'accessory'],
    ['Warm gloves', 'accessory'],
    ['Sunglasses', 'accessory'],
    ['Scarf', 'accessory'],
    ['Underwear', 'skip'],
    ['Comfortable socks', 'skip'],
    ['Sleepwear', 'skip'],
    ['Pyjamas', 'skip'],
    ['Passport', null],
    ['Phone charger', null],
    ['', null],
  ];
  for (const [label, want] of cases) assert.equal(guessGarment(label), want, label);
});

test('garment word list: every category has words, no word in two places, all lower-case letters', () => {
  const seen = new Map<string, string>();
  for (const [cat, words] of Object.entries(GARMENT_WORDS)) {
    assert.ok(words.length >= 5, cat);
    for (const w of words) {
      assert.match(w, /^[a-z]+$/, w);
      assert.ok(!seen.has(w), `${w} in ${cat} and ${seen.get(w)}`);
      seen.set(w, cat);
    }
  }
  assert.deepEqual(Object.keys(GARMENT_WORDS).sort(), [...GARMENT_CATS, 'skip'].sort());
});

// ---------------------------------------------------------------- wardrobe

test('wardrobe: clothes and garment-named rows, minus underwear and socks; own pieces after; one per name', () => {
  const o: TripOutfits = { extras: [{ id: 'of_a', label: 'Silk scarf', cat: 'accessory' }], cats: { [packKey('Comfortable things')]: 'bottom' } };
  const w = wardrobe(o, [...pack, { label: ' linen  SHIRT ' }]);
  assert.deepEqual(
    w.map((p) => [p.label, p.cat, p.source]),
    [
      ['Linen shirt', 'top', 'packing'],
      ['Shorts', 'bottom', 'packing'],
      ['Sandals', 'shoes', 'packing'],
      ['Rain jacket', 'layer', 'packing'],
      ['Comfortable things', 'bottom', 'packing'],
      ['Silk scarf', 'accessory', 'own'],
    ],
  );
  assert.equal(w[0].qty, 2);
  // An unguessable clothes row with no choice is a top; socks come back once given a category.
  assert.equal(wardrobe(null, [{ label: 'Comfortable things', category: 'clothes' }])[0].cat, 'top');
  assert.equal(wardrobe({ cats: { [packKey('Socks')]: 'accessory' } }, pack).some((p) => p.label === 'Socks'), true);
  assert.deepEqual(wardrobe(null, null), []);
  assert.deepEqual(sortPieces(w).map((p) => p.cat), ['top', 'bottom', 'bottom', 'layer', 'shoes', 'accessory']);
});

test('packKey folds case and spaces, so a renewed packing row id never matters', () => {
  assert.equal(packKey('  Linen   Shirt '), 'p:linen shirt');
});

// ---------------------------------------------------------------- the trip's days

test('outfitDates: the trip dates, widened by bookings on their own clocks', () => {
  assert.deepEqual(outfitDates(trip({ startDate: '2027-04-01', endDate: '2027-04-03' })), ['2027-04-01', '2027-04-02', '2027-04-03']);
  // A flight that leaves Sydney on 31 Mar (its own clock) and lands in Lisbon on 1 Apr widens the start, not the end.
  const flight = { id: 'f', tripId: 't1', kind: 'flight', title: 'Out', start: { local: '2027-03-31T22:00', tz: 'Australia/Sydney' }, end: { local: '2027-04-01T09:00', tz: 'Europe/Lisbon' }, attachments: [] } as Item;
  const back = { id: 'b', tripId: 't1', kind: 'flight', title: 'Back', start: { local: '2027-04-03T23:30', tz: 'Europe/Lisbon' }, end: { local: '2027-04-05T06:00', tz: 'Australia/Sydney' }, attachments: [] } as Item;
  const d = outfitDates(trip({ startDate: '2027-04-01', endDate: '2027-04-03', items: [flight, back] }));
  assert.equal(d[0], '2027-03-31');
  assert.equal(d[d.length - 1], '2027-04-05');
  // A booking with an unreadable zone is ignored; an end before the start reads as a one-day trip.
  const bad = { ...flight, start: { local: '2027-01-01T10:00', tz: 'Not/AZone' }, end: undefined } as Item;
  assert.deepEqual(outfitDates(trip({ startDate: '2027-04-01', endDate: '2027-03-01', items: [bad] })), ['2027-04-01']);
  assert.deepEqual(outfitDates(trip({ startDate: 'junk' })), []);
  // Capped for a very long trip.
  assert.equal(outfitDates(trip({ startDate: '2027-01-01', endDate: '2027-12-31' })).length, 90);
});

test('outfitToday: read in the zone of the last booking reached (date line safe)', () => {
  const flight = { id: 'f', tripId: 't1', kind: 'flight', title: 'Out', start: { local: '2027-04-01T10:00', tz: 'Australia/Sydney' }, end: { local: '2027-04-01T20:00', tz: 'Europe/Lisbon' }, attachments: [] } as Item;
  const t = trip({ items: [flight] });
  // 23:30 in Lisbon on 2 Apr is already 3 Apr in Sydney (home); the planner says 2 Apr.
  const at = toUtc({ local: '2027-04-02T23:30', tz: 'Europe/Lisbon' });
  assert.equal(outfitToday(t, at), '2027-04-02');
  // Before the flight, still on home time.
  assert.equal(outfitToday(t, toUtc({ local: '2027-04-01T08:00', tz: 'Australia/Sydney' })), '2027-04-01');
});

// ---------------------------------------------------------------- counts, laundry, hints

const pieces: Piece[] = [
  { key: 'p:linen shirt', label: 'Linen shirt', cat: 'top', source: 'packing', qty: 2 },
  { key: 'p:shorts', label: 'Shorts', cat: 'bottom', source: 'packing' },
  { key: 'p:sandals', label: 'Sandals', cat: 'shoes', source: 'packing' },
  { key: 'of_1', label: 'Party dress', cat: 'dress', source: 'own' },
];
const dates = ['2027-04-01', '2027-04-02', '2027-04-03', '2027-04-04', '2027-04-05', '2027-04-06'];

test('wear counts: daytime + evening on one day count once; laundry starts again the next day', () => {
  const o: TripOutfits = {
    days: [
      { date: '2027-04-01', day: ['p:shorts', 'p:sandals'], evening: ['p:sandals'] },
      { date: '2027-04-02', day: ['p:shorts', 'p:sandals'] },
      { date: '2027-04-03', day: ['p:shorts', 'p:sandals'], laundry: true },
      { date: '2027-04-04', day: ['p:shorts', 'p:sandals'] },
      { date: '2027-04-05', day: ['p:sandals', 'p:gone'] },
      { date: '2027-04-06', day: ['p:sandals'] },
      { date: '2027-05-01', day: ['p:shorts'] },
    ],
  };
  const w = wearCounts(o, dates, pieces);
  assert.deepEqual(w.get('p:shorts'), { total: 4, peak: 3, sinceWash: 1 });
  assert.deepEqual(w.get('p:sandals'), { total: 6, peak: 3, sinceWash: 3 });
  assert.deepEqual(w.get('of_1'), { total: 0, peak: 0, sinceWash: 0 });
  assert.equal(w.has('p:gone'), false, 'a piece no longer in the wardrobe is not counted');
  // Up to a day: since the last wash up to and including it (the wash on 3 Apr counts that evening).
  assert.equal(wearCounts(o, dates, pieces, '2027-04-03').get('p:shorts')?.sinceWash, 3);
  assert.equal(wearCounts(o, dates, pieces, '2027-04-04').get('p:shorts')?.sinceWash, 1);
  // Without the laundry day the run keeps going.
  const noWash = { days: o.days?.map((d) => ({ ...d, laundry: undefined })) };
  assert.equal(wearCounts(noWash, dates, pieces).get('p:sandals')?.peak, 6);
});

test('hints: never worn (only once something is planned), worn SPARE_AT+ days between washes unless enough are packed', () => {
  assert.equal(SPARE_AT, 4);
  assert.equal(wearHint({ total: 0, peak: 0, sinceWash: 0 }, {}, 3), 'never');
  assert.equal(wearHint({ total: 0, peak: 0, sinceWash: 0 }, {}, 0), null);
  assert.equal(wearHint({ total: 5, peak: 4, sinceWash: 1 }, {}, 5), 'spare');
  assert.equal(wearHint({ total: 5, peak: 3, sinceWash: 1 }, {}, 5), null);
  assert.equal(wearHint({ total: 5, peak: 4, sinceWash: 1 }, { qty: 4 }, 5), null, 'four packed for four days');
  assert.equal(wearHint(undefined, {}, 2), null);
});

// ---------------------------------------------------------------- editing

test('editing: pieces in and out, clear, laundry, same as before, own pieces, categories', () => {
  let t = trip();
  t = setPiece(t, '2027-04-02', 'day', 'p:shorts', true, NOW);
  t = setPiece(t, '2027-04-02', 'day', 'p:linen shirt', true, NOW);
  t = setPiece(t, '2027-04-02', 'day', 'p:shorts', true, NOW);
  t = setPiece(t, '2027-04-02', 'evening', 'of_1', true, NOW);
  assert.deepEqual(readOutfits(t)?.days, [{ date: '2027-04-02', day: ['p:linen shirt', 'p:shorts'], evening: ['of_1'] }]);
  assert.equal(t.outfits?.updatedAt, NOW);
  t = setLaundryDay(t, '2027-04-02', true, NOW);
  t = copyDayOutfit(t, '2027-04-02', '2027-04-03', NOW);
  assert.deepEqual(readOutfits(t)?.days?.[1], { date: '2027-04-03', day: ['p:linen shirt', 'p:shorts'], evening: ['of_1'] }, 'laundry is not copied');
  assert.equal(previousOutfitDay(readOutfits(t), '2027-04-05', pieces)?.date, '2027-04-03');
  assert.equal(previousOutfitDay(readOutfits(t), '2027-04-02', pieces), null);
  t = clearSlot(t, '2027-04-03', 'evening', NOW);
  t = clearSlot(t, '2027-04-03', 'day', NOW);
  assert.equal(readOutfits(t)?.days?.length, 1, 'an emptied day is removed');
  t = setPiece(t, '2027-04-02', 'day', 'p:shorts', false, NOW);
  assert.deepEqual(readOutfits(t)?.days?.[0].day, ['p:linen shirt']);
  t = setLaundryDay(t, 'junk', true, NOW);
  // Own pieces: category guessed, blank ignored; removing one takes it out of every day and drops its category.
  t = addExtra(t, '  Linen trousers ', newId, undefined, NOW);
  t = addExtra(t, '   ', newId, undefined, NOW);
  t = addExtra(t, 'Mystery item', newId, 'layer', NOW);
  const ex = readOutfits(t)?.extras ?? [];
  assert.deepEqual(ex.map((x) => [x.label, x.cat]), [['Linen trousers', 'bottom'], ['Mystery item', 'layer']]);
  t = setPiece(t, '2027-04-04', 'day', ex[0].id, true, NOW);
  t = setPieceCat(t, ex[0].id, 'dress', NOW);
  t = setPieceCat(t, 'p:shorts', 'accessory', NOW);
  assert.deepEqual(readOutfits(t)?.cats, { [ex[0].id]: 'dress', 'p:shorts': 'accessory' });
  assert.equal(wardrobe(readOutfits(t), null).find((p) => p.key === ex[0].id)?.cat, 'dress');
  t = removeExtra(t, ex[0].id, NOW);
  assert.equal(readOutfits(t)?.days?.some((d) => d.date === '2027-04-04'), false);
  assert.deepEqual(readOutfits(t)?.cats, { 'p:shorts': 'accessory' });
  assert.equal(removeExtra(t, 'nope', NOW), t);
});

test('slots, complete looks, planned days and today’s outfit', () => {
  const o: TripOutfits = { days: [{ date: '2027-04-02', day: ['p:shorts', 'p:linen shirt', 'p:gone'], evening: ['of_1'] }, { date: '2027-04-03', laundry: true }] };
  const day = slotPieces(o.days?.[0] ?? null, 'day', pieces);
  assert.deepEqual(day.map((p) => p.label), ['Shorts', 'Linen shirt']);
  assert.equal(outfitComplete(day), true);
  assert.equal(outfitComplete(slotPieces(o.days?.[0] ?? null, 'evening', pieces)), true, 'a dress is a look');
  assert.equal(outfitComplete([pieces[0], pieces[2]]), false);
  assert.equal(plannedCount(o, dates, pieces), 1);
  const t = trip({ outfits: o });
  assert.deepEqual(todayOutfit(t, '2027-04-02', pieces), { date: '2027-04-02', day, evening: [pieces[3]], laundry: false });
  assert.deepEqual(todayOutfit(t, '2027-04-03', pieces), { date: '2027-04-03', day: [], evening: [], laundry: true });
  assert.equal(todayOutfit(t, '2027-04-04', pieces), null, 'nothing planned');
  assert.equal(todayOutfit({ ...t, outfits: { days: [{ date: '2027-05-02', day: ['p:shorts'] }] } }, '2027-05-02', pieces), null, 'not a trip day');
});

// ---------------------------------------------------------------- reading

test('readOutfits: broken rows dropped, duplicates once, days sorted, unknown fields kept; file read is empty-safe', () => {
  const raw = {
    extras: [{ id: 'of_1', label: '  Scarf ', cat: 'accessory' }, { id: 'of_1', label: 'Dup', cat: 'top' }, { id: 'of_2', label: 'Odd', cat: 'cape' }, { id: '', label: 'x' }, { id: 'of_3', label: '  ' }, 'junk'],
    cats: { 'p:shorts': 'bottom', 'p:x': 'cape', '': 'top' },
    days: [{ date: '2027-04-03', day: ['a', 'a', 7, 'b'] }, { date: '2027-04-01', evening: ['c'], laundry: 'yes' }, { date: 'soon', day: ['d'] }, { date: '2027-04-01', day: ['e'] }, { date: '2027-04-05' }],
    futureField: 1,
    updatedAt: 5,
  };
  assert.deepEqual(readOutfits({ outfits: raw as unknown as TripOutfits }), {
    futureField: 1,
    extras: [{ id: 'of_1', label: 'Scarf', cat: 'accessory' }, { id: 'of_2', label: 'Odd', cat: 'top' }],
    cats: { 'p:shorts': 'bottom' },
    days: [{ date: '2027-04-01', evening: ['c'] }, { date: '2027-04-03', day: ['a', 'b'] }],
  });
  assert.equal(readOutfits({ outfits: 'junk' as unknown as TripOutfits }), null);
  assert.equal(readOutfits({}), null);
  assert.equal(readFileOutfits({ updatedAt: NOW }), undefined);
  assert.equal(readFileOutfits(null), undefined);
  assert.deepEqual(readFileOutfits({ days: [{ date: '2027-04-01', laundry: true }] }), { days: [{ date: '2027-04-01', laundry: true }] });
});

test('.satchel: the plan travels; a damaged plan is cleaned, never refuses the file', () => {
  const o: TripOutfits = { extras: [{ id: 'of_1', label: 'Scarf', cat: 'accessory' }], days: [{ date: '2027-04-02', day: ['p:shorts', 'of_1'], laundry: true }], updatedAt: NOW };
  const built = buildTripFile(trip({ outfits: o }), {});
  const parsed = parseTripFileText(JSON.stringify(built.file));
  assert.ok(parsed.ok);
  const imp = importTripFile(parsed.file, newId);
  assert.deepEqual(imp.trip.outfits, o, 'own piece ids are local to the plan and kept');
  const broken = JSON.parse(JSON.stringify(built.file));
  broken.trip.outfits = { days: 'junk', extras: [{ nope: 1 }] };
  const p2 = parseTripFileText(JSON.stringify(broken));
  assert.ok(p2.ok);
  assert.equal(p2.file.trip.outfits, undefined);
});

// ---------------------------------------------------------------- weather stop for a day

test('stopForDate: the stop covering the day (latest arrived), else the last one reached, else the first', () => {
  const stops = [
    { key: 'a', fromDate: '2027-04-01', toDate: '2027-04-03' },
    { key: 'b', fromDate: '2027-04-03', toDate: '2027-04-05' },
    { key: 'c', fromDate: '2027-04-08', toDate: '2027-04-08' },
  ];
  assert.equal(stopForDate(stops, '2027-04-02')?.key, 'a');
  assert.equal(stopForDate(stops, '2027-04-03')?.key, 'b');
  assert.equal(stopForDate(stops, '2027-04-06')?.key, 'b');
  assert.equal(stopForDate(stops, '2027-03-30')?.key, 'a');
  assert.equal(stopForDate([], '2027-04-02'), null);
});

// ---------------------------------------------------------------- catalogue + UI guards

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (p: string) => readFileSync(root + p, 'utf8');
const UI = ['app/outfits/[tripId].tsx', 'src/ui/outfits.tsx'];

test('every outfits.* key used by the UI exists in the catalogue; every category and hint has its words', () => {
  const keys = new Set(Object.keys(en).filter((k) => k.startsWith('outfits.')));
  for (const p of UI) {
    for (const m of read(p).matchAll(/['`](outfits\.[A-Za-z.]+)['`]/g)) {
      if (m[1].endsWith('.')) continue;
      assert.ok(keys.has(m[1]), `${p}: ${m[1]}`);
    }
  }
  for (const c of GARMENT_CATS) {
    assert.ok(keys.has(`outfits.cat.${c}`), c);
    assert.ok(keys.has(`outfits.cats.${c}`), c);
  }
});

test('outfit UI: theme tokens only (motion is guarded app-wide in src/theme/motion.test.ts), garment art drawn here', () => {
  for (const p of [...UI, 'src/ui/garments.tsx']) {
    const src = read(p);
    assert.doesNotMatch(src, /#[0-9a-fA-F]{3,8}\b|rgba?\(/, `${p} raw colour`);
  }
  assert.match(read('src/ui/garments.tsx'), /react-native-svg/);
});
