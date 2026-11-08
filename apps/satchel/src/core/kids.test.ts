import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { en } from '../i18n/en.ts';
import type { HelpTable } from './helpcards.ts';
import {
  AGE_BANDS,
  bandForAge,
  bandsOf,
  BRIEF_MIN,
  cleanKids,
  countryOn,
  EMPTY_KIDS,
  importKids,
  isKidFriendly,
  journeyLength,
  journeyReminders,
  kidFriendlyCount,
  kidFriendlyOnly,
  kidsBrief,
  kidsForFile,
  kidsKey,
  KIDS_LINE_IDS,
  lostCardText,
  lostKidCard,
  mergeKidsPacking,
  missingKidsRows,
  PACK_ALL,
  PACK_ROWS,
  packRowsFor,
  packSuggestionId,
  readFileKids,
  REMINDERS,
  removeChild,
  saveChild,
  setExportNames,
  setParent,
  stayOn,
  toggleKidFriendly,
  tripReminders,
  type AgeBand,
  type KidsData,
  type KidsTable,
} from './kids.ts';
import type { Item, Trip } from './model.ts';
import type { PackList } from './packing.ts';
import type { PhraseTable } from './phrases.ts';
import { buildTripFile, importTripFile, parseTripFileText } from './tripfile.ts';
import { toUtc } from './tz.ts';

const readRoot = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const HELP = JSON.parse(readRoot('src/content/helpcards.json')) as HelpTable;
const PHRASES = JSON.parse(readRoot('src/content/phrases.json')) as PhraseTable;
const TABLE = JSON.parse(readRoot('src/content/kids.json')) as KidsTable;
const w = (row: string) => (en as Record<string, string>)[`kids.pack.${row}`] ?? row;
let seq = 0;
const newId = (p: string) => `${p}_${++seq}`;

const item = (id: string, kind: Item['kind'], start: string, startTz: string, end: string | null, endTz = startTz, extra: Partial<Item> = {}): Item => ({
  id,
  tripId: 't1',
  kind,
  title: `${kind} ${id}`,
  start: { local: start, tz: startTz },
  ...(end ? { end: { local: end, tz: endTz } } : {}),
  attachments: [],
  ...extra,
});

// Sydney -> Tokyo (stay) -> train to Kyoto (stay) -> Seoul by air (stay) -> home.
const trip: Trip = {
  id: 't1',
  name: 'Family trip',
  startDate: '2026-12-01',
  endDate: '2026-12-10',
  homeTz: 'Australia/Sydney',
  createdAt: '2026-10-01T00:00:00Z',
  items: [
    item('f1', 'flight', '2026-12-01T09:00', 'Australia/Sydney', '2026-12-01T17:30', 'Asia/Tokyo'),
    item('h1', 'hotel', '2026-12-01T19:00', 'Asia/Tokyo', '2026-12-04T10:00', 'Asia/Tokyo', { title: 'Tokyo flat', place: { id: 'p1', name: 'Hotel Sakura', address: '1-2-3 Asakusa, Taito, Tokyo', localAddress: '東京都台東区浅草1-2-3', phone: '+81 3 1234 5678' } }),
    item('r1', 'train', '2026-12-04T11:00', 'Asia/Tokyo', '2026-12-04T13:15', 'Asia/Tokyo'),
    item('c1', 'car', '2026-12-04T14:00', 'Asia/Tokyo', '2026-12-06T10:00', 'Asia/Tokyo'),
    item('h2', 'hotel', '2026-12-04T15:00', 'Asia/Tokyo', '2026-12-07T10:00', 'Asia/Tokyo', { title: 'Kyoto inn', place: { id: 'p2', name: 'Kyoto Inn', address: '5 Gion, Kyoto' } }),
    item('b1', 'bus', '2026-12-06T12:00', 'Asia/Tokyo', '2026-12-06T12:40', 'Asia/Tokyo'),
    item('f2', 'flight', '2026-12-07T12:00', 'Asia/Tokyo', '2026-12-07T14:20', 'Asia/Seoul'),
    item('h3', 'hotel', '2026-12-07T16:00', 'Asia/Seoul', '2026-12-10T10:00', 'Asia/Seoul', { title: 'Seoul stay', place: { id: 'p3', name: 'Han River Hotel', address: '10 Mapo-ro, Seoul', localAddress: '서울 마포로 10' } }),
    item('f3', 'flight', '2026-12-10T13:00', 'Asia/Seoul', '2026-12-11T00:30', 'Australia/Sydney'),
  ],
};

const withKids = (bands: AgeBand[], extra: Partial<KidsData> = {}): KidsData => {
  let d: KidsData = { ...EMPTY_KIDS, ...extra };
  bands.forEach((b, n) => {
    const r = saveChild(d, ['Mia', 'Leo', 'Ava', 'Sam'][n] ?? `Kid${n}`, b, `k${n}`);
    assert.ok(r.ok);
    d = r.data;
  });
  return d;
};

// ----------------------------------------------------------------------------------------------- age bands

test('age bands: whole years map to baby / toddler / child / teen, adults and junk to none', () => {
  assert.deepEqual(AGE_BANDS, ['baby', 'toddler', 'child', 'teen']);
  assert.equal(bandForAge(0), 'baby');
  assert.equal(bandForAge(0.8), 'baby');
  assert.equal(bandForAge(1), 'toddler');
  assert.equal(bandForAge(3), 'toddler');
  assert.equal(bandForAge(4), 'child');
  assert.equal(bandForAge(12), 'child');
  assert.equal(bandForAge(13), 'teen');
  assert.equal(bandForAge(17), 'teen');
  assert.equal(bandForAge(18), null);
  assert.equal(bandForAge(-1), null);
  assert.equal(bandForAge(Number.NaN), null);
  // Bands in the order they are travelling, each once.
  assert.deepEqual(bandsOf(withKids(['teen', 'baby', 'teen'])), ['baby', 'teen']);
});

test('children: first name and band only, cleaned on read; bad rows dropped, no birth date kept', () => {
  const d = cleanKids({
    children: [
      { id: 'a', name: '  Mia   Rose ', band: 'toddler', birthDate: '2024-01-02' },
      { id: 'a', name: 'Dup', band: 'child' },
      { id: 'b', name: '', band: 'child' },
      { id: 'c', name: 'Leo', band: 'adult' },
      'junk',
    ],
    parentPhone: ' +61 400 000 000 ',
    exportNames: 'yes',
    kidFriendly: ['i1', 'i1', 3, ''],
  });
  assert.deepEqual(d.children, [{ id: 'a', name: 'Mia Rose', band: 'toddler' }]);
  assert.equal(d.parentPhone, '+61 400 000 000');
  assert.equal(d.exportNames, false);
  assert.deepEqual(d.kidFriendly, ['i1']);
  assert.deepEqual(cleanKids(null), EMPTY_KIDS);
  assert.deepEqual(cleanKids([1, 2]), EMPTY_KIDS);
  assert.equal(JSON.stringify(cleanKids({ children: [{ id: 'a', name: 'Mia', band: 'baby', birthDate: '2026-01-01', age: 0 }] })).includes('2026-01-01'), false);
  // Save, update, remove; empty names and a 13th child refused.
  let k = withKids(['baby']);
  assert.deepEqual(saveChild(k, '   ', 'child', 'x'), { ok: false, reason: 'name' });
  const up = saveChild(k, 'Mila', 'toddler', 'k0');
  assert.ok(up.ok);
  k = up.data;
  assert.deepEqual(k.children, [{ id: 'k0', name: 'Mila', band: 'toddler' }]);
  assert.deepEqual(removeChild(k, 'k0').children, []);
  let full = EMPTY_KIDS;
  for (let n = 0; n < 12; n++) {
    const r = saveChild(full, `K${n}`, 'child', `id${n}`);
    assert.ok(r.ok);
    full = r.data;
  }
  assert.deepEqual(saveChild(full, 'One more', 'child', 'id99'), { ok: false, reason: 'full' });
  assert.equal(setParent(k, ' Jo ', ' 0400 ').parentName, 'Jo');
  assert.equal(kidsKey('t1'), 'satchel.kids.v1.t1');
});

// ----------------------------------------------------------------------------------------------- packing merge

const list = (items: PackList['items'], extra: Partial<PackList> = {}): PackList => ({ tripId: 't1', items, ...extra });

test('packing rows by band: each row once, band order, shared rows last; none without children', () => {
  assert.deepEqual(packRowsFor([]), []);
  const both = packRowsFor(['baby', 'toddler']);
  assert.equal(new Set(both).size, both.length);
  assert.equal(both.filter((r) => r === 'nappies').length, 1);
  assert.deepEqual(both.slice(-PACK_ALL.length), [...PACK_ALL]);
  assert.ok(packRowsFor(['teen']).includes('charger'));
  assert.equal(packRowsFor(['teen']).includes('nappies'), false);
  // Every row has its catalogue label.
  for (const b of AGE_BANDS) for (const r of [...PACK_ROWS[b], ...PACK_ALL]) assert.ok((en as Record<string, string>)[`kids.pack.${r}`], r);
});

test('packing merge keeps own rows untouched and never adds a row twice', () => {
  const own = [
    { id: 'o1', label: 'Passport', done: true, category: 'documents' },
    { id: 'o2', label: 'nappies', done: true, category: 'misc' }, // own row, same label in another case
    { id: 'o3', label: 'Snacks for the journey', done: false, category: 'misc', qty: 3 },
  ];
  const start = list(own, { dismissed: [packSuggestionId('wipes')] });
  const m = mergeKidsPacking(start, ['toddler'], w, newId);
  // Own rows are all still there, unchanged (ticks, categories, quantities).
  for (const o of own) assert.deepEqual(m.list.items.find((i) => i.id === o.id), o);
  // No label appears twice; the own "nappies" and "Snacks" rows stand in for the band's; dismissed "wipes" stays out.
  const labels = m.list.items.map((i) => i.label.toLowerCase());
  assert.equal(new Set(labels).size, labels.length);
  assert.equal(m.list.items.some((i) => i.suggestionId === packSuggestionId('wipes')), false);
  assert.equal(m.list.items.some((i) => i.suggestionId === packSuggestionId('nappies')), false);
  const addedRows = m.list.items.filter((i) => i.suggestionId?.startsWith('kids:'));
  assert.equal(addedRows.length, m.added);
  assert.ok(m.added > 0);
  assert.ok(addedRows.every((i) => i.category === 'kids' && i.done === false));
  // Running it again adds nothing (also after the traveller ticks or renames an added row).
  const again = mergeKidsPacking(m.list, ['toddler'], w, newId);
  assert.equal(again.added, 0);
  assert.equal(again.list, m.list);
  const renamed: PackList = { ...m.list, items: m.list.items.map((i) => (i.suggestionId === packSuggestionId('comfort') ? { ...i, label: 'Bunny', done: true } : i)) };
  assert.equal(mergeKidsPacking(renamed, ['toddler'], w, newId).added, 0);
  // A new band adds only its own missing rows.
  const withBaby = mergeKidsPacking(m.list, ['baby', 'toddler'], w, newId);
  assert.deepEqual(missingKidsRows(withBaby.list, ['baby', 'toddler'], w), []);
  assert.ok(withBaby.list.items.some((i) => i.suggestionId === packSuggestionId('bottles')));
  // An empty list gets every row.
  assert.equal(mergeKidsPacking(list([]), ['child'], w, newId).added, packRowsFor(['child']).length);
});

// ----------------------------------------------------------------------------------------------- reminders

test('journey reminders by length: short gets the stroller only, medium snacks, long sleep and play', () => {
  assert.equal(journeyLength(60), 'short');
  assert.equal(journeyLength(90), 'medium');
  assert.equal(journeyLength(239), 'medium');
  assert.equal(journeyLength(240), 'long');
  const short = item('s', 'bus', '2026-12-06T12:00', 'Asia/Tokyo', '2026-12-06T12:40');
  const medium = item('m', 'train', '2026-12-04T11:00', 'Asia/Tokyo', '2026-12-04T13:15');
  const long = item('l', 'flight', '2026-12-01T09:00', 'Australia/Sydney', '2026-12-01T17:30', 'Asia/Tokyo'); // 9 h 30 real
  assert.deepEqual(journeyReminders(short, ['toddler']), ['stroller']);
  assert.deepEqual(journeyReminders(short, ['child']), []);
  assert.deepEqual(journeyReminders(medium, ['child']), ['snacks']);
  assert.deepEqual(journeyReminders(medium, ['baby']), ['stroller', 'snacks']);
  assert.deepEqual(journeyReminders(long, ['baby']), ['strollerGate', 'snacks', 'sleep', 'play']);
  assert.deepEqual(journeyReminders(long, ['teen']), ['snacks', 'sleep', 'play']);
  assert.deepEqual(journeyReminders(long, []), []);
  // Hire cars: car seat for the little ones, booster for children, nothing for teens alone.
  const car = item('c', 'car', '2026-12-04T14:00', 'Asia/Tokyo', '2026-12-06T10:00');
  assert.deepEqual(journeyReminders(car, ['baby', 'child']), ['carSeat', 'booster', 'seatCheck']);
  assert.deepEqual(journeyReminders(car, ['child']), ['booster', 'seatCheck']);
  assert.deepEqual(journeyReminders(car, ['teen']), []);
  // Every reminder has its line.
  for (const r of REMINDERS) assert.ok((en as Record<string, string>)[`kids.remind.${r}`], r);
  // The trip list: only what is still ahead, in time order, with something to say.
  const now = toUtc({ local: '2026-12-04T12:00', tz: 'Asia/Tokyo' });
  const rows = tripReminders(trip, withKids(['toddler']), now);
  assert.deepEqual(rows.map((r) => r.item.id), ['r1', 'c1', 'b1', 'f2', 'f3']);
  assert.deepEqual(tripReminders(trip, EMPTY_KIDS, now), []);
});

test('Your day Kids row: the next journey of 2 h+ within 24 h, snack always, sleep when long or at nap time', () => {
  const kids = withKids(['child']);
  // Morning of 4 Dec: the 11:00 train (2 h 15) leaves at nap-free time: snacks only.
  const at = (local: string, tz = 'Asia/Tokyo') => toUtc({ local, tz });
  const b = kidsBrief(trip, kids, at('2026-12-04T08:00'));
  assert.equal(b?.item.id, 'r1');
  assert.equal(b?.minutes, 135);
  assert.ok((b?.minutes ?? 0) >= BRIEF_MIN);
  assert.equal(b?.snack, true);
  assert.equal(b?.sleep, false);
  // The 12:00 flight to Seoul (2 h 20 with the zone change: real 2 h 20) leaves at nap time.
  const f = kidsBrief(trip, kids, at('2026-12-07T06:00'));
  assert.equal(f?.item.id, 'f2');
  assert.equal(f?.sleep, true);
  // The long flight home (13:00, 9 h 30): sleep.
  assert.equal(kidsBrief(trip, kids, at('2026-12-10T07:00', 'Asia/Seoul'))?.item.id, 'f3');
  assert.equal(kidsBrief(trip, kids, at('2026-12-10T07:00', 'Asia/Seoul'))?.sleep, true);
  // The short bus is never the Kids row; nothing more than 24 h out; nothing without children.
  assert.equal(kidsBrief(trip, kids, at('2026-12-05T13:00')), null);
  assert.equal(kidsBrief(trip, EMPTY_KIDS, at('2026-12-04T08:00')), null);
});

// ----------------------------------------------------------------------------------------------- lost card

const mia = { id: 'k0', name: 'Mia', band: 'child' as const };

test('lost card picks the stop country language and the stay for the date', () => {
  const data = setParent(EMPTY_KIDS, 'Jo', '+61 400 111 222');
  const card = (date: string) => lostKidCard({ trip, date, child: mia, data, phrases: PHRASES, help: HELP, table: TABLE });
  // 2 Dec: Tokyo stay, Japanese.
  const tokyo = card('2026-12-02');
  assert.equal(tokyo.iso2, 'JP');
  assert.equal(tokyo.lang, 'ja');
  assert.equal(tokyo.ask.en, 'Please call my parent.');
  assert.notEqual(tokyo.ask.local, tokyo.ask.en);
  assert.equal(tokyo.ask.check, true);
  assert.equal(tokyo.unchecked, true);
  assert.ok(tokyo.rows.some((r) => r.value.includes('東京都台東区浅草1-2-3')));
  const call = tokyo.rows.find((r) => r.dial);
  assert.equal(call?.dial, '+61400111222');
  assert.equal(call?.value, 'Jo\n+61 400 111 222');
  // 5 Dec: Kyoto stay. 8 Dec: Seoul stay, Korean.
  assert.ok(card('2026-12-05').rows.some((r) => r.value.startsWith('Kyoto Inn')));
  const seoul = card('2026-12-08');
  assert.equal(seoul.iso2, 'KR');
  assert.equal(seoul.lang, 'ko');
  assert.ok(seoul.rows.some((r) => r.value.includes('서울 마포로 10')));
  // Changeover day: the night's stay decides (checked into Seoul on the 7th).
  assert.equal(stayOn(trip, '2026-12-07')?.id, 'h3');
  assert.equal(countryOn(trip, '2026-12-07'), 'KR');
  // A country we carry no lines for: English only, nothing flagged.
  const home = { ...trip, items: [item('h9', 'hotel', '2026-12-20T15:00', 'Australia/Sydney', '2026-12-22T10:00')] };
  const en1 = lostKidCard({ trip: home, date: '2026-12-21', child: mia, data, phrases: PHRASES, help: HELP, table: TABLE });
  assert.equal(en1.lang, null);
  assert.equal(en1.ask.local, en1.ask.en);
  assert.equal(en1.unchecked, false);
  assert.match(lostCardText(tokyo), /Please call my parent\./);
});

test('lost card phone: own number first, else the emergency card contact; says so when there is none', () => {
  const card = { contacts: [{ id: 'c', name: 'Grandma', phone: '+44 20 7946 0000' }] };
  const fromCard = lostKidCard({ trip, date: '2026-12-02', child: mia, data: EMPTY_KIDS, card, phrases: PHRASES, help: HELP, table: TABLE });
  assert.equal(fromCard.rows.find((r) => r.dial)?.dial, '+442079460000');
  assert.equal(fromCard.noPhone, false);
  const none = lostKidCard({ trip, date: '2026-12-02', child: mia, data: EMPTY_KIDS, phrases: PHRASES, help: HELP, table: TABLE });
  assert.equal(none.noPhone, true);
  assert.equal(none.rows.some((r) => r.dial), false);
});

test('kids lines: every language carries both lines, marked native_check, for a phrase language', () => {
  assert.deepEqual(TABLE.sentences.map((s) => s.id), [...KIDS_LINE_IDS]);
  const codes = PHRASES.languages.map((l) => l.code);
  for (const l of TABLE.languages) {
    assert.ok(codes.includes(l.code), l.code);
    for (const id of KIDS_LINE_IDS) {
      assert.ok(l.lines[id]?.text.trim(), `${l.code} ${id}`);
      assert.equal(l.lines[id]?.native_check, true, `${l.code} ${id}`);
    }
  }
  assert.equal(en['kids.lost.unchecked'], 'checked by a fluent speaker: not yet');
});

// ----------------------------------------------------------------------------------------------- ideas

test('kid-friendly: own marks only, toggled, counted for ideas still on the trip', () => {
  let d = toggleKidFriendly(EMPTY_KIDS, 'i1');
  d = toggleKidFriendly(d, 'i2');
  d = toggleKidFriendly(d, 'i2');
  assert.equal(isKidFriendly(d, 'i1'), true);
  assert.equal(isKidFriendly(d, 'i2'), false);
  const ideas = [{ id: 'i1', name: 'Zoo' }, { id: 'i3', name: 'Playground' }];
  assert.deepEqual(kidFriendlyOnly(ideas, d), [{ id: 'i1', name: 'Zoo' }]);
  // "Playground" is never guessed as kid-friendly.
  assert.equal(kidFriendlyCount(ideas, d), 1);
  assert.equal(kidFriendlyCount([], d), 0);
});

// ----------------------------------------------------------------------------------------------- trip files

test('trip files: children names left out by default; included only when turned on; import keeps them off', () => {
  const kids = withKids(['baby', 'teen']);
  assert.equal(kids.exportNames, false);
  assert.equal(EMPTY_KIDS.exportNames, false);
  assert.equal(kidsForFile(kids), undefined);
  const off = JSON.stringify(buildTripFile(trip, {}, { now: '2026-10-31T00:00:00Z', kids: kidsForFile(kids) }).file);
  assert.doesNotMatch(off, /Mia|Leo|"kids"|satchel\.kids/);
  // On: first names and bands only, no ids, numbers or marks.
  const on = setExportNames(setParent(toggleKidFriendly(kids, 'i1'), 'Jo', '+61 400 999 888'), true);
  const block = kidsForFile(on);
  assert.deepEqual(block, { children: [{ name: 'Mia', band: 'baby' }, { name: 'Leo', band: 'teen' }] });
  const text = JSON.stringify(buildTripFile(trip, {}, { now: '2026-10-31T00:00:00Z', kids: block }).file);
  assert.match(text, /Mia/);
  assert.doesNotMatch(text, /400 999 888|"i1"|exportNames/);
  const parsed = parseTripFileText(text);
  assert.ok(parsed.ok);
  const imp = importTripFile(parsed.file, newId);
  assert.deepEqual(imp.kids?.children.map((c) => [c.name, c.band]), [['Mia', 'baby'], ['Leo', 'teen']]);
  assert.equal(imp.kids?.exportNames, false);
  // A file without the block (or with junk) imports with none.
  assert.equal(importTripFile((parseTripFileText(off) as { ok: true; file: Parameters<typeof importTripFile>[0] }).file, newId).kids, null);
  assert.equal(readFileKids({ children: [{ name: '', band: 'baby' }, { name: 'X', band: 'adult' }] }), undefined);
  assert.equal(importKids(undefined, newId), null);
});

test('kids data stays on this phone: own key, never on the Trip, exported only through kidsForFile', () => {
  const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
  for (const p of ['src/core/model.ts', 'src/core/tripcopy.ts', 'src/core/trips.ts', 'src/core/packing.ts']) assert.doesNotMatch(read(p), /satchel\.kids|kidsKey|KidsData/, p);
  // The key prefix is declared once, here.
  assert.equal((read('src/core/kids.ts').match(/'satchel\.kids\.v1\.'/g) ?? []).length, 1);
  // Export reads the phone store only through kidsForFile (which returns nothing unless turned on).
  const transfer = read('src/state/tripTransfer.ts');
  assert.match(transfer, /kidsForFile\(await readKids\(trip\.id\)\)/);
  assert.doesNotMatch(transfer, /\.children/);
});
