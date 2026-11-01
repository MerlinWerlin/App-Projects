import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { en } from '../i18n/en.ts';
import { demoTrip } from './demo.ts';
import {
  addContent,
  addFromPacking,
  addLogEntry,
  BAG_MATERIALS,
  BAG_SIZES,
  BAG_TYPES,
  cleanLostBag,
  cleanValue,
  descriptionProgress,
  descriptionText,
  editContent,
  EMPTY_LOST_BAG,
  flightName,
  flightRoute,
  flightsOf,
  isEmptyDescription,
  isLostBagKey,
  isLostBagKeyOf,
  kitTrips,
  lostBagKey,
  normaliseLog,
  photoUris,
  removeContent,
  removeLogEntry,
  reportFlight,
  reportText,
  rowDraft,
  stayLines,
  TEXT_KEYS,
  totalsText,
  valueTotals,
  withPhoto,
  type ContentRow,
  type LostBag,
  type Words,
} from './lostbag.ts';
import type { Item, Trip } from './model.ts';
import { buildTripFile } from './tripfile.ts';
import { toUtc } from './tz.ts';

const fresh = (): LostBag => cleanLostBag(null);
/** Real catalogue words, like the UI passes them. */
const w: Words = (key, vars) => {
  const s = (en as Record<string, string>)[`lostbag.${key}`];
  assert.ok(s !== undefined, `missing lostbag.${key}`);
  return vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s;
};
let n = 0;
const newId = () => `r${++n}`;

const flight = (id: string, start: string, end: string, extra: Partial<Item> = {}): Item => ({
  id,
  tripId: 't1',
  kind: 'flight',
  title: `Flight ${id}`,
  start: { local: start, tz: 'Europe/London' },
  end: { local: end, tz: 'Europe/Paris' },
  attachments: [],
  ...extra,
});

// ----------------------------------------------------------------------------------------------- keys and cleaning

test('keys: one per trip + bag, recognisable, scoped to the trip', () => {
  assert.equal(lostBagKey('t1', 'checked'), 'satchel.lostbag.v1.t1.checked');
  assert.notEqual(lostBagKey('t1', 'carry'), lostBagKey('t2', 'carry'));
  assert.equal(isLostBagKey(lostBagKey('t1', 'x')), true);
  assert.equal(isLostBagKey('satchel.lostbag.v1.'), false);
  assert.equal(isLostBagKey('satchel.stay.v1.a'), false);
  assert.equal(isLostBagKeyOf(lostBagKey('t1', 'x'), 't1'), true);
  assert.equal(isLostBagKeyOf(lostBagKey('t10', 'x'), 't1'), false);
  assert.equal(isLostBagKeyOf(lostBagKey('t1', 'x'), ''), false);
});

test('cleanLostBag: junk gives the empty card, never throws', () => {
  for (const raw of [null, undefined, 3, 'x', [], { type: 'yacht', size: 9, contents: 'no', log: {}, photos: [] }]) {
    const b = cleanLostBag(raw);
    assert.deepEqual(b, { ...EMPTY_LOST_BAG, photos: { outside: null, contents: null }, contents: [], log: [] });
    assert.equal(isEmptyDescription(b), true);
  }
});

test('cleanLostBag: keeps good fields, cuts long text, drops bad rows and duplicate ids', () => {
  const b = cleanLostBag({
    type: 'suitcase',
    colour: '  Navy  ',
    size: 'large',
    material: 'hard',
    marks: 'x'.repeat(900),
    tag: ' AB123456 ',
    photos: { outside: { uri: 'attachments/a.jpg', mime: 'image/jpeg', takenAt: 'T' }, contents: { uri: '' } },
    contents: [
      { id: 'a', label: 'Jacket', value: 8000, currency: 'GBP' },
      { id: 'a', label: 'Dup', value: 1, currency: 'GBP' },
      { id: 'b', label: '  ', value: 1, currency: 'GBP' },
      { id: 'c', label: 'Camera', value: 1.5, currency: 'EUR' },
      { id: 'd', label: 'Shoes', value: 500, currency: 'eur' },
      { label: 'No id' },
    ],
    currency: 'GBP',
    flightId: 'f1',
    reference: ' LHR12345 ',
    log: [{ id: 'l1', date: '2026-11-02', note: ' Called ' }],
  });
  assert.equal(b.type, 'suitcase');
  assert.equal(b.colour, 'Navy');
  assert.equal(b.marks.length, 500);
  assert.equal(b.tag, 'AB123456');
  assert.equal(b.photos.outside?.uri, 'attachments/a.jpg');
  assert.equal(b.photos.contents, null);
  assert.deepEqual(b.contents.map((r) => [r.id, r.value, r.currency]), [
    ['a', 8000, 'GBP'],
    ['c', null, 'EUR'],
    ['d', null, ''],
  ]);
  assert.equal(b.reference, 'LHR12345');
  assert.equal(b.flightId, 'f1');
  assert.equal(b.log.length, 1);
  assert.equal(b.log[0].note, 'Called');
  assert.equal(isEmptyDescription(b), false);
});

test('descriptionProgress counts the nine parts of the card', () => {
  assert.deepEqual(descriptionProgress(fresh()), { done: 0, total: 9 });
  const b = cleanLostBag({ type: 'backpack', colour: 'Red', tag: '1', contents: [{ id: 'a', label: 'Hat' }] });
  assert.deepEqual(descriptionProgress(b), { done: 4, total: 9 });
});

// ----------------------------------------------------------------------------------------------- edits

test('withPhoto: sets, replaces (old file to delete) and clears', () => {
  const p1 = { uri: 'attachments/1.jpg', mime: 'image/jpeg', takenAt: 'a' };
  const p2 = { uri: 'attachments/2.jpg', mime: 'image/jpeg', takenAt: 'b' };
  const a = withPhoto(fresh(), 'outside', p1);
  assert.equal(a.replaced, null);
  const b = withPhoto(a.next, 'outside', p2);
  assert.equal(b.replaced, '/attachments/1.jpg'.slice(1));
  const c = withPhoto(withPhoto(b.next, 'contents', p1).next, 'outside', null);
  assert.equal(c.replaced, 'attachments/2.jpg');
  assert.deepEqual(photoUris(c.next), ['attachments/1.jpg']);
  assert.deepEqual(photoUris(withPhoto(c.next, 'contents', p1).next), ['attachments/1.jpg']);
  assert.equal(withPhoto(c.next, 'contents', p1).replaced, null);
});

test('addContent: label required, value optional, read in the currency’s own decimals', () => {
  let b = fresh();
  assert.equal(addContent(b, '  ', '', 'EUR', 'x').error, 'empty');
  assert.equal(addContent(b, 'Hat', '12', 'EU', 'x').error, 'currency');
  assert.equal(addContent(b, 'Hat', 'abc', 'EUR', 'x').error, 'value');
  assert.equal(addContent(b, 'Hat', '12.3456', 'EUR', 'x').error, 'value');
  assert.equal(addContent(b, 'Hat', '1.5', 'JPY', 'x').error, 'value');
  b = addContent(b, ' Rain   jacket ', '45,50', 'eur', 'a').next;
  b = addContent(b, 'Camera', '12000', 'JPY', 'b').next;
  b = addContent(b, 'Socks', '', 'XYZ!', 'c').next;
  b = addContent(b, 'Ring', '1.500', 'KWD', 'd').next;
  assert.deepEqual(b.contents, [
    { id: 'a', label: 'Rain jacket', value: 4550, currency: 'EUR' },
    { id: 'b', label: 'Camera', value: 12000, currency: 'JPY' },
    { id: 'c', label: 'Socks', value: null, currency: '' },
    { id: 'd', label: 'Ring', value: 1500, currency: 'KWD' },
  ]);
  // The last currency used for a value is remembered for the next row.
  assert.equal(b.currency, 'KWD');
  assert.deepEqual(removeContent(b, 'b').contents.map((r) => r.id), ['a', 'c', 'd']);
  // Values above the cap are typos.
  assert.equal(addContent(fresh(), 'Car', '99999999', 'USD', 'z').error, 'value');
  assert.equal(cleanValue(-1), null);
  assert.equal(cleanValue(0), 0);
});

test('T130 editContent: a row changes in place (words, value, currency), keeping its id and place', () => {
  let b = fresh();
  b = addContent(b, 'Rain jacket', '45.50', 'EUR', 'a').next;
  b = addContent(b, 'Camera', '12000', 'JPY', 'b').next;
  b = addContent(b, 'Socks', '', '', 'c').next;
  const e = editContent(b, 'b', '  Camera   body ', '350', 'usd');
  assert.equal(e.error, undefined);
  assert.deepEqual(e.next.contents, [
    { id: 'a', label: 'Rain jacket', value: 4550, currency: 'EUR' },
    { id: 'b', label: 'Camera body', value: 35000, currency: 'USD' },
    { id: 'c', label: 'Socks', value: null, currency: '' },
  ]);
  assert.equal(e.next.currency, 'USD', 'the currency just used is remembered');
  // Clearing the value drops it (and its currency); a value added to a row without one reads in the typed currency.
  const cleared = editContent(e.next, 'a', 'Rain jacket', '', 'EUR').next;
  assert.deepEqual(cleared.contents[0], { id: 'a', label: 'Rain jacket', value: null, currency: '' });
  assert.equal(cleared.currency, 'USD');
  assert.deepEqual(editContent(cleared, 'c', 'Socks', '1,500', 'KWD').next.contents[2], { id: 'c', label: 'Socks', value: 1500, currency: 'KWD' });
  // Same errors as adding; the kit stays as it was.
  assert.equal(editContent(b, 'a', ' ', '', 'EUR').error, 'empty');
  assert.equal(editContent(b, 'a', 'Hat', '12', 'EU').error, 'currency');
  assert.equal(editContent(b, 'a', 'Hat', '1.5', 'JPY').error, 'value');
  assert.equal(editContent(b, 'a', 'Hat', '99999999', 'USD').error, 'value');
  assert.equal(editContent(b, 'a', ' ', '', 'EUR').next, b);
  // A row that is gone (removed meanwhile) changes nothing; a full list can still be edited.
  assert.equal(editContent(b, 'zz', 'Hat', '', '').next, b);
  let full = fresh();
  for (let i = 0; i < 60; i++) full = addContent(full, `Thing ${i}`, '', '', `r${i}`).next;
  assert.equal(editContent(full, 'r59', 'Last thing', '', '').next.contents[59].label, 'Last thing');
  // The edit form starts from the row: value as plain text in its own currency's decimals.
  assert.deepEqual(rowDraft(b.contents[0], 'GBP'), { label: 'Rain jacket', value: '45.50', currency: 'EUR' });
  assert.deepEqual(rowDraft(b.contents[1], 'GBP'), { label: 'Camera', value: '12000', currency: 'JPY' });
  assert.deepEqual(rowDraft(b.contents[2], 'GBP'), { label: 'Socks', value: '', currency: 'GBP' });
  const back = editContent(b, 'a', ...(Object.values(rowDraft(b.contents[0], 'GBP')) as [string, string, string]));
  assert.deepEqual(back.next.contents, b.contents, 'saving an unchanged form changes nothing');
});

test('addContent: the list has a limit', () => {
  let b = fresh();
  for (let i = 0; i < 60; i++) b = addContent(b, `Thing ${i}`, '', '', `id${i}`).next;
  assert.equal(addContent(b, 'One more', '', '', 'x').error, 'full');
});

test('addFromPacking: adds missing labels without values, skips duplicates ignoring case', () => {
  const start = addContent(fresh(), 'Rain jacket', '40', 'GBP', 'a').next;
  const r = addFromPacking(start, ['rain  JACKET', 'Charger', ' ', 'charger', 'Passport'], newId);
  assert.equal(r.added, 2);
  assert.deepEqual(r.next.contents.map((c) => [c.label, c.value]), [
    ['Rain jacket', 4000],
    ['Charger', null],
    ['Passport', null],
  ]);
  const again = addFromPacking(r.next, ['Charger'], newId);
  assert.equal(again.added, 0);
  assert.equal(again.next, r.next);
});

// ----------------------------------------------------------------------------------------------- money

test('valueTotals: per currency in integer minor units, never mixed, A-Z', () => {
  const rows: ContentRow[] = [
    { id: '1', label: 'a', value: 4550, currency: 'EUR' },
    { id: '2', label: 'b', value: 12000, currency: 'JPY' },
    { id: '3', label: 'c', value: null, currency: '' },
    { id: '4', label: 'd', value: 1, currency: 'EUR' },
    { id: '5', label: 'e', value: 0, currency: 'USD' },
    { id: '6', label: 'f', value: 0.5, currency: 'USD' },
  ];
  assert.deepEqual(valueTotals(rows), [
    { currency: 'EUR', minor: 4551, rows: 2 },
    { currency: 'JPY', minor: 12000, rows: 1 },
    { currency: 'USD', minor: 0, rows: 1 },
  ]);
  assert.deepEqual(valueTotals([]), []);
  assert.equal(totalsText(valueTotals(rows.slice(0, 2))), '€45.50 + ¥12,000');
  // Many small values add up exactly (no floating-point drift).
  const many = Array.from({ length: 50 }, (_, i): ContentRow => ({ id: `m${i}`, label: 'x', value: 10, currency: 'USD' }));
  assert.deepEqual(valueTotals(many), [{ currency: 'USD', minor: 500, rows: 50 }]);
});

// ----------------------------------------------------------------------------------------------- log

test('normaliseLog: real dates and words only, oldest first, same day keeps typed order, unique ids', () => {
  const log = normaliseLog([
    { id: 'a', date: '2026-11-03', note: 'Third' },
    { id: 'b', date: '2026-11-01', note: '  First   call  ' },
    { id: 'c', date: '2026-11-03', note: 'Fourth' },
    { id: 'a', date: '2026-11-02', note: 'Dup id' },
    { id: 'd', date: '2026-02-30', note: 'Bad date' },
    { id: 'e', date: '2026-11-02', note: '   ' },
    { id: 'f', date: '2026-11-02', note: 'Second' },
    { date: '2026-11-02', note: 'No id' },
    'junk',
  ]);
  assert.deepEqual(log.map((e) => [e.id, e.date, e.note]), [
    ['b', '2026-11-01', 'First call'],
    ['f', '2026-11-02', 'Second'],
    ['a', '2026-11-03', 'Third'],
    ['c', '2026-11-03', 'Fourth'],
  ]);
  assert.deepEqual(normaliseLog('x'), []);
  // At most 60 rows: the newest are kept.
  const long = normaliseLog(Array.from({ length: 70 }, (_, i) => ({ id: `x${i}`, date: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`, note: 'n' })));
  assert.equal(long.length, 60);
  assert.equal(long[long.length - 1].date, '2026-01-28');
});

test('addLogEntry / removeLogEntry', () => {
  let b = fresh();
  assert.equal(addLogEntry(b, '2026-13-01', 'x', 'a'), null);
  assert.equal(addLogEntry(b, '2026-11-01', ' ', 'a'), null);
  b = addLogEntry(b, '2026-11-04', 'Delivered', 'a') ?? b;
  b = addLogEntry(b, '2026-11-02', 'Filed', 'b') ?? b;
  assert.deepEqual(b.log.map((e) => e.id), ['b', 'a']);
  assert.deepEqual(removeLogEntry(b, 'b').log.map((e) => e.id), ['a']);
});

// ----------------------------------------------------------------------------------------------- trip parts

test('flightsOf / reportFlight: real-time order; chosen, else latest landed, else first', () => {
  const f1 = flight('f1', '2026-11-01T08:00', '2026-11-01T10:30', { carrier: 'XQ', number: '101', from: { id: 'a', name: 'London' }, to: { id: 'b', name: 'Paris' }, ref: 'ABC123' });
  const f2 = flight('f2', '2026-11-05T18:00', '2026-11-05T20:30');
  const hotel: Item = { id: 'h', tripId: 't1', kind: 'hotel', title: 'Hotel', start: { local: '2026-11-01T15:00', tz: 'Europe/Paris' }, attachments: [] };
  const trip = { items: [f2, hotel, f1] };
  assert.deepEqual(flightsOf(trip).map((f) => f.id), ['f1', 'f2']);
  const before = toUtc({ local: '2026-10-31T12:00', tz: 'UTC' });
  const between = toUtc({ local: '2026-11-03T12:00', tz: 'UTC' });
  const after = toUtc({ local: '2026-11-06T12:00', tz: 'UTC' });
  assert.equal(reportFlight(trip, null, before)?.id, 'f1');
  assert.equal(reportFlight(trip, null, between)?.id, 'f1');
  assert.equal(reportFlight(trip, null, after)?.id, 'f2');
  assert.equal(reportFlight(trip, 'f2', between)?.id, 'f2');
  assert.equal(reportFlight(trip, 'gone', after)?.id, 'f2');
  assert.equal(reportFlight({ items: [hotel] }, null, after), null);
  assert.equal(flightName(f1), 'XQ 101');
  assert.equal(flightName(f2), 'Flight f2');
  assert.equal(flightRoute(f1), 'London → Paris');
  assert.equal(flightRoute(f2), '');
  assert.equal(flightRoute({ to: { id: 'b', name: 'Paris' } }), '? → Paris');
});

test('stayLines: name, address (or local), phone; nothing for no stay', () => {
  assert.deepEqual(stayLines(null), []);
  assert.deepEqual(stayLines({ title: 'Hotel', place: { id: 'p', name: 'Hôtel Lune', localAddress: '1 rue X', phone: '+33 1' } }), ['Hôtel Lune', '1 rue X', '+33 1']);
  assert.deepEqual(stayLines({ title: ' Flat ' }), ['Flat']);
});

test('kitTrips: under way, then coming up, then recently ended', () => {
  const t = (id: string, startDate: string, endDate: string) => ({ id, startDate, endDate });
  const list = [t('old', '2026-01-01', '2026-01-05'), t('past', '2026-10-01', '2026-10-10'), t('soon2', '2026-12-10', '2026-12-12'), t('now', '2026-10-30', '2026-11-04'), t('soon1', '2026-11-20', '2026-11-22')];
  assert.deepEqual(kitTrips(list, '2026-11-01').map((x) => x.id), ['now', 'soon1', 'soon2', 'past']);
});

// ----------------------------------------------------------------------------------------------- texts

test('every word key the texts use is in the lostbag catalogue', () => {
  for (const k of TEXT_KEYS) assert.ok(`lostbag.${k}` in en, k);
  assert.equal(BAG_TYPES.length + BAG_SIZES.length + BAG_MATERIALS.length + 18, TEXT_KEYS.length);
});

test('descriptionText: only filled fields, contents with values and totals per currency', () => {
  assert.equal(descriptionText(fresh(), 'Checked bag', w), 'Bag description: Checked bag\nNo description yet.');
  let b = cleanLostBag({ type: 'suitcase', colour: 'Navy', size: 'large', tag: 'XQ123456' });
  b = addContent(b, 'Rain jacket', '45.50', 'EUR', 'a').next;
  b = addContent(b, 'Charger', '', '', 'b').next;
  b = addContent(b, 'Camera', '300', 'GBP', 'c').next;
  assert.equal(
    descriptionText(b, ' ', w),
    [
      'Bag description: Bag',
      'Type: Suitcase',
      'Colour: Navy',
      'Size: Large',
      'Bag-tag number: XQ123456',
      '',
      'Contents:',
      '- Rain jacket (€45.50)',
      '- Charger',
      '- Camera (£300.00)',
      '',
      'Total declared value: €45.50 + £300.00',
    ].join('\n'),
  );
});

test('reportText: flight, references, description, delivery address and dated log', () => {
  let b = cleanLostBag({ type: 'backpack', colour: 'Green', reference: 'PARXQ1234' });
  b = addLogEntry(b, '2026-11-02', 'Called: traced to London', 'l1') ?? b;
  const f = flight('f1', '2026-11-01T08:00', '2026-11-01T10:30', { carrier: 'XQ', number: '101', from: { id: 'a', name: 'London' }, to: { id: 'b', name: 'Paris' }, ref: 'ABC123' });
  const text = reportText(
    { bag: b, bagName: 'Checked bag', flight: f, stay: { title: 'Hotel', place: { id: 'p', name: 'Hôtel Lune', address: '1 rue X, Paris' } } },
    w,
    { day: (d) => `day ${d}` },
  );
  assert.equal(
    text,
    [
      'Delayed or missing bag',
      '',
      'Flight: XQ 101, London → Paris, day 2026-11-01',
      'Booking reference: ABC123',
      'File reference: PARXQ1234',
      '',
      'Bag description: Checked bag',
      'Type: Backpack',
      'Colour: Green',
      '',
      'Deliver to:',
      'Hôtel Lune',
      '1 rue X, Paris',
      '',
      'Follow-up log:',
      '- day 2026-11-02: Called: traced to London',
      '',
    ].join('\n'),
  );
  // With nothing known, the report is still a readable text (title + empty description).
  assert.equal(reportText({ bag: fresh(), bagName: 'Carry-on', flight: null, stay: null }, w), 'Delayed or missing bag\n\nBag description: Carry-on\nNo description yet.\n');
  // No airline or legal wording slips into the catalogue: guidance stays generic.
  const words = Object.entries(en).filter(([k]) => k.startsWith('lostbag.')).map(([, v]) => v).join(' ');
  assert.doesNotMatch(words, /entitled|compensation|liab|convention|you must be paid|guarantee/i);
});

// ----------------------------------------------------------------------------------------------- phone-only guard

test('lost-bag data stays on this phone: own key per trip + bag, never in .satchel trip files', () => {
  const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
  for (const p of ['src/core/tripfile.ts', 'src/ui/TripExport.tsx', 'src/ui/TripImport.tsx', 'src/core/model.ts', 'src/state/tripTransfer.ts', 'src/core/packing.ts', 'src/core/bags.ts', 'src/core/tripcopy.ts']) {
    assert.doesNotMatch(read(p), /lostbag|lostBag|satchel\.lostbag/i, p);
  }
  // The key prefix is declared once, in this module, and only the phone-only store reads it.
  assert.equal((read('src/core/lostbag.ts').match(/'satchel\.lostbag\.v1\.'/g) ?? []).length, 1);
  // A trip file built from a trip whose bags have a description, photos, values and a log carries none of them.
  const trip: Trip = demoTrip('2026-11-02', '2026-10-01T00:00:00Z');
  let b = cleanLostBag({ colour: 'Zqcolour', marks: 'Zqmarks', tag: 'Zq99887766', reference: 'ZqRef42', photos: { outside: { uri: 'attachments/zqbag.jpg', mime: 'image/jpeg', takenAt: '' } } });
  b = addContent(b, 'Zqcamera', '123.45', 'EUR', 'a').next;
  b = addLogEntry(b, '2026-11-03', 'Zqcalled', 'l') ?? b;
  const saved = new Map([[lostBagKey(trip.id, 'checked'), b]]);
  assert.equal(saved.size, 1);
  const packing = { tripId: trip.id, items: [{ id: 'p1', label: 'Jacket', category: 'clothes', done: false, bag: 'checked' }], bags: [{ id: 'checked', kind: 'checked', colour: 'rust' }] };
  const built = buildTripFile(trip, {}, { now: '2026-10-31T00:00:00Z', packing } as Parameters<typeof buildTripFile>[2]);
  const file = JSON.stringify(built.file);
  assert.doesNotMatch(file, /satchel\.lostbag|Zqcolour|Zqmarks|Zq99887766|ZqRef42|zqbag|Zqcamera|Zqcalled/i);
});
