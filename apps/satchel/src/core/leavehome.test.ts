// T124 leaving home: template, own rows, due time from the first journey across zones, nudge, share text, .satchel
// round trip and the phone-only guard for Wi-Fi and alarm codes.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { Item, Trip } from './model.ts';
import {
  addOwnRow,
  addTask,
  cleanCodes,
  firstDeparture,
  hasCodes,
  LEAVE_TEMPLATE,
  LEAVEHOME_CODES_KEY,
  leaveDue,
  leaveNudge,
  leaveProgress,
  missingTemplate,
  nextLeaveNudge,
  readFileLeavingHome,
  readLeavingHome,
  removeRow,
  removeTask,
  renameRow,
  restoreTemplate,
  setRowDone,
  sitterNoteText,
  startLeavingHome,
  stripPhoneOnly,
  taskDays,
  templateRows,
  tripStops,
  untickAll,
  withNote,
  type NoteWords,
} from './leavehome.ts';
import { buildTripFile, importTripFile, parseTripFileText } from './tripfile.ts';
import { toUtc } from './tz.ts';
import { en } from '../i18n/en.ts';

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const NOW_ISO = '2027-03-30T00:00:00.000Z';

let n = 0;
const newId = (p: string) => `${p}_${++n}`;

const item = (o: Partial<Item> & Pick<Item, 'id' | 'kind' | 'start'>): Item => ({ tripId: 't1', title: o.kind, attachments: [], ...o }) as Item;

// Sydney 07:00 flight on 1 Apr; a hotel in Tokyo; a train earlier in wall-clock but later in real time.
const flight = item({ id: 'f1', kind: 'flight', title: 'Sydney to Tokyo', start: { local: '2027-04-01T07:00', tz: 'Australia/Sydney' }, end: { local: '2027-04-01T16:00', tz: 'Asia/Tokyo' } });
const hotel = item({
  id: 'h1',
  kind: 'hotel',
  title: 'Hotel',
  start: { local: '2027-04-01T15:00', tz: 'Asia/Tokyo' },
  end: { local: '2027-04-05T11:00', tz: 'Asia/Tokyo' },
  place: { id: 'p1', name: 'Hotel Asakusa', phone: '+81 3 0000 0000' },
});
const hotel2 = item({ id: 'h2', kind: 'hotel', title: 'Kyoto Inn', start: { local: '2027-04-05T15:00', tz: 'Asia/Tokyo' }, end: { local: '2027-04-07T10:00', tz: 'Asia/Tokyo' } });

const trip = (o: Partial<Trip> = {}): Trip => ({
  id: 't1',
  name: 'Tokyo',
  startDate: '2027-04-01',
  endDate: '2027-04-07',
  homeTz: 'Australia/Sydney',
  items: [hotel2, hotel, flight],
  createdAt: NOW_ISO,
  ...o,
});

const at = (local: string, tz: string) => toUtc({ local, tz });

// ---------------------------------------------------------------- template and editing

test('template: twelve rows in the stated order, each with a catalogue string', () => {
  assert.deepEqual([...LEAVE_TEMPLATE], ['bins', 'plants', 'fridge', 'climate', 'windows', 'chargers', 'mail', 'pets', 'spareKey', 'lights', 'valuables', 'docs']);
  for (const id of LEAVE_TEMPLATE) assert.ok((en as Record<string, string>)[`leavehome.tpl.${id}`], id);
  const rows = templateRows(newId);
  assert.equal(rows.length, 12);
  assert.ok(rows.every((r) => r.done === false && r.tpl && !r.label));
  assert.equal(new Set(rows.map((r) => r.id)).size, 12);
});

test('start, tick, own row, rename, remove, put back, untick', () => {
  let t = startLeavingHome(trip(), newId, NOW_ISO);
  let lh = readLeavingHome(t);
  assert.ok(lh);
  assert.equal(lh.rows.length, 12);
  assert.equal(lh.updatedAt, NOW_ISO);
  // Starting again keeps the list.
  assert.equal(startLeavingHome(t, newId), t);

  const bins = lh.rows[0].id;
  t = setRowDone(t, bins, true);
  assert.deepEqual(leaveProgress(readLeavingHome(t)), { done: 1, total: 12, open: 11 });

  t = addOwnRow(t, '  Turn off the water  ', newId);
  assert.equal(addOwnRow(t, '   ', newId), t, 'blank words are ignored');
  lh = readLeavingHome(t)!;
  const own = lh.rows[lh.rows.length - 1];
  assert.equal(own.label, 'Turn off the water');
  assert.equal(own.tpl, undefined);

  t = renameRow(t, lh.rows[1].id, 'Water the fern');
  assert.equal(readLeavingHome(t)!.rows[1].label, 'Water the fern');
  t = renameRow(t, lh.rows[1].id, '');
  assert.equal(readLeavingHome(t)!.rows[1].label, undefined, 'blank words put a usual row back to its own words');
  t = renameRow(t, own.id, '');
  assert.equal(readLeavingHome(t)!.rows.at(-1)!.label, 'Turn off the water', 'an own row keeps its words');

  // Remove two usual rows and put them back in template order.
  const fridge = lh.rows[2].id;
  const docs = lh.rows[11].id;
  t = removeRow(removeRow(t, fridge), docs);
  assert.deepEqual(missingTemplate(readLeavingHome(t)), ['fridge', 'docs']);
  t = restoreTemplate(t, newId);
  lh = readLeavingHome(t)!;
  assert.deepEqual(missingTemplate(lh), []);
  assert.deepEqual(
    lh.rows.map((r) => r.tpl ?? 'own'),
    [...LEAVE_TEMPLATE, 'own'],
    'usual rows back in template order, own row last',
  );
  assert.equal(restoreTemplate(t, newId), t, 'nothing missing: unchanged');

  t = untickAll(t);
  assert.equal(leaveProgress(readLeavingHome(t)).done, 0);
});

test('reading is defensive: junk rows dropped, duplicates once, unknown fields kept', () => {
  const t = trip({
    leavingHome: {
      rows: [
        { id: 'a', tpl: 'bins', done: true },
        { id: 'a', tpl: 'plants', done: false },
        { id: 'b', tpl: 'nope' as 'bins', done: false },
        { id: '', label: 'x', done: false },
        { id: 'c', label: 'Own', done: 'yes' as unknown as boolean, futureRow: 1 } as never,
        null as never,
      ],
      futureField: 'kept',
    } as never,
  });
  const lh = readLeavingHome(t)!;
  assert.deepEqual(lh.rows.map((r) => r.id), ['a', 'c']);
  assert.equal(lh.rows[1].done, false);
  assert.equal((lh.rows[1] as unknown as { futureRow: number }).futureRow, 1);
  assert.equal((lh as unknown as { futureField: string }).futureField, 'kept');
  assert.equal(readLeavingHome(trip({ leavingHome: 'bad' as never })), null);
  assert.equal(readLeavingHome(trip()), null);
});

// ---------------------------------------------------------------- sitter note

test('note: text fields saved trimmed-or-dropped, tasks kept, codes never taken', () => {
  let t = addTask(trip(), 'daily', 'Feed the cat', newId);
  t = withNote(t, { address: '1 Home St', pets: '', bins: 'Tuesday night', wifiPassword: 'hunter2' } as never);
  const note = readLeavingHome(t)!.note!;
  assert.equal(note.address, '1 Home St');
  assert.equal(note.pets, undefined);
  assert.equal(note.tasks?.length, 1);
  assert.equal(JSON.stringify(t).includes('hunter2'), false);
  t = addTask(t, '2027-04-03', 'Bins back in', newId);
  t = addTask(t, 'bad' as never, 'Defaults to daily', newId);
  assert.deepEqual(readLeavingHome(t)!.note!.tasks!.map((x) => x.when), ['daily', '2027-04-03', 'daily']);
  assert.equal(addTask(t, 'daily', '  ', newId), t);
  const id = readLeavingHome(t)!.note!.tasks![0].id;
  t = removeTask(t, id);
  assert.equal(readLeavingHome(t)!.note!.tasks!.length, 2);
});

test('taskDays: the trip dates, at most 45', () => {
  assert.deepEqual(taskDays({ startDate: '2027-04-01', endDate: '2027-04-03' }), ['2027-04-01', '2027-04-02', '2027-04-03']);
  assert.equal(taskDays({ startDate: '2027-01-01', endDate: '2027-12-31' }).length, 45);
  assert.deepEqual(taskDays({ startDate: '2027-04-03', endDate: '2027-04-01' }), []);
});

// ---------------------------------------------------------------- due time across zones

test('firstDeparture: earliest journey by real instant across zones, not by wall clock', () => {
  // A train at 04:30 Tokyo on 1 Apr is 06:30 Sydney (daylight time): before the 07:00 Sydney flight.
  const train = item({ id: 'tr', kind: 'train', start: { local: '2027-04-01T04:30', tz: 'Asia/Tokyo' } });
  assert.equal(firstDeparture(trip({ items: [flight, train] }))?.item?.id, 'tr');
  // A 06:30 bus in Perth is 09:30 Sydney: after the flight even though its wall clock is earlier.
  const bus = item({ id: 'bus', kind: 'bus', start: { local: '2027-04-01T06:30', tz: 'Australia/Perth' } });
  assert.equal(firstDeparture(trip({ items: [bus, flight] }))?.item?.id, 'f1');
  // Journeys before other bookings: an earlier hotel doesn't count while a journey exists.
  const earlyHotel = item({ id: 'eh', kind: 'hotel', start: { local: '2027-03-31T15:00', tz: 'Australia/Sydney' } });
  assert.equal(firstDeparture(trip({ items: [earlyHotel, flight] }))?.item?.id, 'f1');
  // No journey: the first booking; notes and unreadable zones skipped.
  const note = item({ id: 'n', kind: 'note', start: { local: '2027-03-01T00:00', tz: 'Australia/Sydney' } });
  const broken = item({ id: 'x', kind: 'flight', start: { local: '2027-03-01T00:00', tz: 'Mars/Base' } });
  assert.equal(firstDeparture(trip({ items: [note, broken, hotel] }))?.item?.id, 'h1');
  // Nothing timed: start date at 00:00 home zone.
  const d = firstDeparture(trip({ items: [] }));
  assert.deepEqual(d?.stamp, { local: '2027-04-01T00:00', tz: 'Australia/Sydney' });
  assert.equal(d?.item, undefined);
  assert.equal(firstDeparture(trip({ items: [], startDate: 'soon' })), null);
});

test('leaveDue: today / tomorrow / later / gone on the departure clock, not the phone', () => {
  const t = trip();
  // 31 Mar 10:00 Sydney: tomorrow.
  assert.equal(leaveDue(t, at('2027-03-31T10:00', 'Australia/Sydney'))?.when, 'tomorrow');
  // 1 Apr 05:00 Sydney, two hours before the flight.
  const early = at('2027-04-01T05:00', 'Australia/Sydney');
  const d = leaveDue(t, early)!;
  assert.equal(d.when, 'today');
  assert.equal(d.time, '07:00');
  // The same instant is still 31 Mar in UTC; the answer stays "today" (counted on the departure's clock).
  assert.equal(new Date(early).toISOString().slice(0, 10), '2027-03-31');
  assert.equal(leaveDue(t, at('2027-03-29T12:00', 'Australia/Sydney'))?.when, 'later');
  assert.equal(leaveDue(t, at('2027-03-29T12:00', 'Australia/Sydney'))?.days, 3);
  assert.equal(leaveDue(t, at('2027-04-01T07:00', 'Australia/Sydney'))?.when, 'gone');
  // Start-date fallback has no time.
  assert.equal(leaveDue(trip({ items: [] }), at('2027-03-31T10:00', 'Australia/Sydney'))?.time, '');
});

test('leaveNudge: today/tomorrow while the list is not started or not finished; none when all ticked or gone', () => {
  const tomorrow = at('2027-03-31T10:00', 'Australia/Sydney');
  const t = trip();
  const notStarted = leaveNudge(t, tomorrow);
  assert.equal(notStarted?.when, 'tomorrow');
  assert.equal(notStarted?.started, false);
  let started = startLeavingHome(t, newId);
  assert.equal(leaveNudge(started, tomorrow)?.progress.open, 12);
  for (const r of readLeavingHome(started)!.rows) started = setRowDone(started, r.id, true);
  assert.equal(leaveNudge(started, tomorrow), null, 'all ticked');
  assert.equal(leaveNudge(t, at('2027-03-25T10:00', 'Australia/Sydney')), null, 'a week away');
  assert.equal(leaveNudge(t, at('2027-04-02T10:00', 'Australia/Sydney')), null, 'gone');
  // nextLeaveNudge picks the sooner departure.
  const other = trip({ id: 't2', items: [item({ id: 'f2', kind: 'flight', start: { local: '2027-03-31T18:00', tz: 'Australia/Sydney' } })] });
  assert.equal(nextLeaveNudge([t, other], tomorrow)?.trip.id, 't2');
  assert.equal(nextLeaveNudge([], tomorrow), null);
});

// ---------------------------------------------------------------- share text

const words: NoteWords = {
  title: 'Looking after our place',
  away: (r) => `We're away ${r}.`,
  range: (a, b) => `${a}–${b}`,
  day: (d) => d,
  address: 'Address',
  everyDay: 'Every day',
  tasks: 'Tasks',
  pets: 'Pets',
  plants: 'Plants',
  bins: 'Bins',
  wifi: 'Wi-Fi',
  wifiName: (x) => `Network: ${x}`,
  wifiPassword: (x) => `Password: ${x}`,
  alarm: (x) => `Alarm code: ${x}`,
  call: 'Who to call',
  stops: "Where we'll be",
  stop: (s, r) => `${r}: ${s.name}, ${s.city}`,
  extra: 'Also',
  empty: 'Thank you.',
};

test('sitterNoteText: dates, address, tasks by day, pets/plants/bins, call, stops; codes only when switched on', () => {
  let t = withNote(trip(), { address: '1 Home St', pets: 'Cat: half a pouch', plants: 'Fern Sundays', bins: 'Tuesday night', contactName: 'Alex', contactPhone: '0400 000 000', extra: 'Fuse box in the laundry' });
  t = addTask(t, '2027-04-04', 'Bins back in', newId);
  t = addTask(t, 'daily', 'Feed the cat', newId);
  t = addTask(t, '2027-04-02', 'Water the pots', newId);
  const codes = { wifiName: 'HomeNet', wifiPassword: 'hunter2', alarmCode: '4711' };
  const plain = sitterNoteText(t, words, { codes });
  assert.equal(
    plain,
    [
      'Looking after our place',
      "We're away 2027-04-01–2027-04-07.",
      'Address\n1 Home St',
      'Tasks\nEvery day:\n- Feed the cat\n2027-04-02:\n- Water the pots\n2027-04-04:\n- Bins back in',
      'Pets\nCat: half a pouch',
      'Plants\nFern Sundays',
      'Bins\nTuesday night',
      'Who to call\nAlex · 0400 000 000',
      "Where we'll be\n2027-04-01–2027-04-05: Hotel Asakusa, Tokyo\n2027-04-05–2027-04-07: Kyoto Inn, Tokyo",
      'Also\nFuse box in the laundry',
    ].join('\n\n') + '\n',
  );
  assert.ok(!plain.includes('hunter2') && !plain.includes('4711') && !plain.includes('HomeNet'), 'codes off by default');
  const withWifi = sitterNoteText(t, words, { codes, wifi: true });
  assert.ok(withWifi.includes('Wi-Fi\nNetwork: HomeNet\nPassword: hunter2'));
  assert.ok(!withWifi.includes('4711'));
  assert.ok(sitterNoteText(t, words, { codes, alarm: true }).includes('Alarm code: 4711'));
  // Empty note: title, dates and stops only.
  const bare = sitterNoteText(trip({ items: [] }), words);
  assert.equal(bare, "Looking after our place\n\nWe're away 2027-04-01–2027-04-07.\n");
  assert.equal(sitterNoteText(trip({ items: [], startDate: '', endDate: '' }), words), 'Looking after our place\n\nThank you.\n');
});

test('tripStops: hotels in real-time order with name, city and phone', () => {
  assert.deepEqual(tripStops(trip()), [
    { name: 'Hotel Asakusa', city: 'Tokyo', from: '2027-04-01', to: '2027-04-05', phone: '+81 3 0000 0000' },
    { name: 'Kyoto Inn', city: 'Tokyo', from: '2027-04-05', to: '2027-04-07' },
  ]);
});

// ---------------------------------------------------------------- .satchel and the phone-only guard

function roundTrip(t: Trip): Trip {
  const built = buildTripFile(t, {});
  const text = JSON.stringify(built.file);
  const parsed = parseTripFileText(text);
  assert.ok(parsed.ok);
  return importTripFile(parsed.file, newId, NOW_ISO).trip;
}

test('.satchel: the checklist and note travel; older files without one import as before', () => {
  let t = startLeavingHome(trip(), newId, NOW_ISO);
  t = addTask(withNote(t, { address: '1 Home St' }), 'daily', 'Feed the cat', newId);
  const back = roundTrip(t);
  assert.deepEqual(back.leavingHome, t.leavingHome);
  assert.equal(roundTrip(trip()).leavingHome, undefined);
  assert.equal(readFileLeavingHome({ rows: [] }), undefined, 'an empty list is left out');
  assert.equal(readFileLeavingHome('junk'), undefined);
});

test('phone-only guard: Wi-Fi and alarm codes never reach a .satchel file, even if put on the trip by mistake', () => {
  const secrets = ['HomeNet-5G', 'hunter2-secret', '4711-alarm'];
  const t = trip({
    leavingHome: {
      rows: [{ id: 'a', tpl: 'bins', done: false }],
      note: { address: '1 Home St', wifiName: secrets[0], wifiPassword: secrets[1], alarmCode: secrets[2] } as never,
      wifi: { password: secrets[1] },
      alarm: secrets[2],
    } as never,
  });
  const text = JSON.stringify(buildTripFile(t, {}).file);
  for (const s of secrets) assert.ok(!text.includes(s), `file carries ${s}`);
  assert.ok(text.includes('1 Home St'), 'the rest of the note travels');
  // A hand-made file with codes in it imports without them.
  const file = JSON.parse(JSON.stringify(buildTripFile(trip(), {}).file));
  file.trip.leavingHome = { rows: [{ id: 'a', tpl: 'bins', done: false }], note: { address: 'x', wifiPassword: secrets[1] }, alarmCode: secrets[2] };
  const parsed = parseTripFileText(JSON.stringify(file));
  assert.ok(parsed.ok);
  const imported = JSON.stringify(importTripFile(parsed.file, newId).trip);
  for (const s of secrets) assert.ok(!imported.includes(s), `import keeps ${s}`);
  // stripPhoneOnly keeps other fields.
  assert.deepEqual(stripPhoneOnly({ rows: [], note: { address: 'a', alarmCode: '1', futureNote: 2 }, futureTop: 1, wifiName: 'n' }), { rows: [], note: { address: 'a', futureNote: 2 }, futureTop: 1 });
  // The codes have their own phone-only key; the trip-file sources never read it.
  assert.equal(LEAVEHOME_CODES_KEY, 'satchel.leavehome.codes.v1');
  for (const p of ['src/core/tripfile.ts', 'src/ui/TripExport.tsx', 'src/ui/TripImport.tsx', 'src/core/model.ts', 'src/state/tripTransfer.ts', 'src/state/trips.tsx']) {
    assert.doesNotMatch(read(p), /LEAVEHOME_CODES_KEY|satchel\.leavehome|HomeCodes|useHomeCodes|leavehomeCodes/, p);
  }
  // HomeCodes is not a Trip field.
  assert.doesNotMatch(read('src/core/model.ts').split('leavingHome?:')[1].split('\n')[0], /HomeCodes/);
});

test('cleanCodes: strings only, damaged store reads as none', () => {
  assert.deepEqual(cleanCodes({ wifiName: 'Net', wifiPassword: 7, alarmCode: ' ', extra: 'x' }), { wifiName: 'Net' });
  assert.deepEqual(cleanCodes('junk'), {});
  assert.equal(hasCodes({}), false);
  assert.equal(hasCodes({ alarmCode: '1' }), true);
});

test('every leavehome.* key used by the UI exists in the catalogue', () => {
  const keys = new Set(Object.keys(en).filter((k) => k.startsWith('leavehome.')));
  for (const p of ['app/leavehome/[tripId].tsx', 'src/ui/leavehome.tsx']) {
    for (const m of read(p).matchAll(/['`](leavehome\.[A-Za-z.]+)['`]/g)) {
      if (m[1].endsWith('.')) continue;
      assert.ok(keys.has(m[1]), `${p}: ${m[1]}`);
    }
  }
});
