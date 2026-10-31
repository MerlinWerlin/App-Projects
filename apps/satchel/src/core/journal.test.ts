import assert from 'node:assert/strict';
import { test } from 'node:test';
import { demoTrip } from './demo.ts';
import {
  addPhotos,
  checkFileJournal,
  defaultJournalDay,
  draftFromEntry,
  droppedPhotos,
  entriesOn,
  entryFromDraft,
  entryPlace,
  fileJournalPhotos,
  findEntry,
  groupJournal,
  journalFiles,
  journalForFile,
  journalStats,
  journalToday,
  MAX_JOURNAL_NOTE,
  MAX_JOURNAL_PHOTOS,
  newJournalDraft,
  photosLeft,
  readJournal,
  removeEntry,
  removePhoto,
  showTodayPrompt,
  tripZoneAt,
  upsertEntry,
  validateJournal,
  type JournalEntry,
  type JournalPhoto,
} from './journal.ts';
import type { Item, SavedPlace, Trip } from './model.ts';
import { tripFiles } from './tickets.ts';
import { buildTripFile, importTripFile, parseTripFile, parseTripFileText, type TripFile } from './tripfile.ts';
import { toUtc } from './tz.ts';

const NOW = '2026-10-26T09:00:00.000Z';
let n = 0;
const ids = (prefix: string) => `${prefix}_j${++n}`;
const photo = (i: number): JournalPhoto => ({ id: `ph${i}`, uri: `file:///docs/attachments/ph${i}.jpg`, name: `ph${i}.jpg`, mime: 'image/jpeg', size: 1000 * i });
const place: SavedPlace = { id: 'p1', name: 'Fushimi Inari', lat: 34.9671, lon: 135.7727, savedAt: '2026-10-20T01:00:00Z' };

/** Sydney home, flight to Tokyo on day 1 (lands next morning Tokyo time), then a Tokyo hotel. */
function trip(): Trip {
  const items: Item[] = [
    { id: 'f1', tripId: 't', kind: 'flight', title: 'SYD-HND', start: { local: '2026-11-01T21:00', tz: 'Australia/Sydney' }, end: { local: '2026-11-02T05:00', tz: 'Asia/Tokyo' }, attachments: [] },
    { id: 'h1', tripId: 't', kind: 'hotel', title: 'Hotel', start: { local: '2026-11-02T15:00', tz: 'Asia/Tokyo' }, end: { local: '2026-11-06T10:00', tz: 'Asia/Tokyo' }, attachments: [] },
  ];
  return { id: 't', name: 'Japan', startDate: '2026-11-01', endDate: '2026-11-06', homeTz: 'Australia/Sydney', items, places: [place], createdAt: NOW };
}
const at = (local: string, tz: string) => toUtc({ local, tz });

test('the traveller\'s zone follows landed journeys, not the phone', () => {
  const t = trip();
  assert.equal(tripZoneAt(t, at('2026-11-01T12:00', 'Australia/Sydney')), 'Australia/Sydney');
  // mid-flight: still the zone you left from
  assert.equal(tripZoneAt(t, at('2026-11-02T01:00', 'Asia/Tokyo')), 'Australia/Sydney');
  assert.equal(tripZoneAt(t, at('2026-11-02T06:00', 'Asia/Tokyo')), 'Asia/Tokyo');
  assert.equal(tripZoneAt(t, at('2026-11-04T12:00', 'Asia/Tokyo')), 'Asia/Tokyo');
  // 23:30 Tokyo on 3 Nov is already 4 Nov in Sydney: the page is for 3 Nov
  assert.equal(journalToday(t, at('2026-11-03T23:30', 'Asia/Tokyo')), '2026-11-03');
  // an unreadable zone falls back to UTC, never throws
  assert.equal(tripZoneAt({ ...t, homeTz: 'Mars/Base', items: [] }, Date.UTC(2026, 10, 1)), 'UTC');
});

test('default day and the Today\'s page prompt', () => {
  const t = trip();
  assert.equal(defaultJournalDay(t, at('2026-10-20T12:00', 'Australia/Sydney')), '2026-11-01');
  assert.equal(defaultJournalDay(t, at('2026-11-04T12:00', 'Asia/Tokyo')), '2026-11-04');
  assert.equal(defaultJournalDay(t, at('2026-12-01T12:00', 'Asia/Tokyo')), '2026-11-06');
  assert.equal(showTodayPrompt(t, at('2026-10-31T12:00', 'Australia/Sydney')), false);
  assert.equal(showTodayPrompt(t, at('2026-11-03T12:00', 'Asia/Tokyo')), true);
  assert.equal(showTodayPrompt(t, at('2026-11-07T12:00', 'Asia/Tokyo')), false);
});

test('add, edit and delete entries', () => {
  let t = trip();
  assert.deepEqual(readJournal(t), []);
  const d = { ...newJournalDraft('2026-11-02'), note: '  Ramen at midnight  ', mood: 'joyful' as const, weather: 'rain' as const, placeId: 'p1' };
  assert.deepEqual(validateJournal(d), []);
  const e = entryFromDraft(d, ids, undefined, NOW);
  assert.equal(e.note, 'Ramen at midnight');
  assert.equal(e.createdAt, NOW);
  assert.equal(e.updatedAt, undefined);
  t = upsertEntry(t, e);
  assert.equal(readJournal(t).length, 1);
  assert.equal(findEntry(t, e.id)?.mood, 'joyful');
  assert.equal(entryPlace(t, e)?.name, 'Fushimi Inari');

  const edited = entryFromDraft({ ...draftFromEntry(e), note: 'Ramen, then karaoke', mood: undefined }, ids, e, '2026-11-03T00:00:00.000Z');
  assert.equal(edited.id, e.id);
  assert.equal(edited.createdAt, NOW);
  assert.equal(edited.updatedAt, '2026-11-03T00:00:00.000Z');
  assert.equal(edited.mood, undefined);
  t = upsertEntry(t, edited);
  assert.equal(readJournal(t).length, 1);
  assert.equal(readJournal(t)[0].note, 'Ramen, then karaoke');

  const second = entryFromDraft({ ...newJournalDraft('2026-11-02'), note: 'Second page' }, ids, undefined, NOW);
  t = upsertEntry(t, second);
  assert.equal(entriesOn(t, '2026-11-02').length, 2);
  t = removeEntry(t, e.id);
  assert.deepEqual(readJournal(t).map((x) => x.id), [second.id]);
  assert.equal(findEntry(t, e.id), undefined);
  // the original trip object is never changed
  assert.equal(trip().journal, undefined);
});

test('validation and the note cap', () => {
  assert.deepEqual(validateJournal(newJournalDraft('2026-11-02')), ['empty']);
  assert.deepEqual(validateJournal({ ...newJournalDraft('2026-11-02'), weather: 'sunny' }), []);
  assert.deepEqual(validateJournal({ ...newJournalDraft('2026-02-30'), note: 'x' }), ['day']);
  assert.ok(validateJournal({ ...newJournalDraft('2026-11-02'), photos: Array.from({ length: 7 }, (_, i) => photo(i)) }).includes('photos'));
  const long = entryFromDraft({ ...newJournalDraft('2026-11-02'), note: 'a'.repeat(MAX_JOURNAL_NOTE + 50) }, ids, undefined, NOW);
  assert.equal(long.note.length, MAX_JOURNAL_NOTE);
  // a place link that no longer exists on the trip shows nothing
  assert.equal(entryPlace({ ...trip(), places: [] }, { ...long, placeId: 'p1' }), undefined);
});

test('photo cap: six per page, extra picks refused', () => {
  assert.equal(MAX_JOURNAL_PHOTOS, 6);
  let photos: JournalPhoto[] = [];
  assert.equal(photosLeft(photos), 6);
  const r1 = addPhotos(photos, [photo(1), photo(2), photo(3), photo(4)]);
  photos = r1.photos;
  assert.equal(r1.refused.length, 0);
  const r2 = addPhotos(photos, [photo(5), photo(6), photo(7), photo(8)]);
  assert.deepEqual(r2.added.map((p) => p.id), ['ph5', 'ph6']);
  assert.deepEqual(r2.refused.map((p) => p.id), ['ph7', 'ph8']);
  photos = r2.photos;
  assert.equal(photos.length, 6);
  assert.equal(photosLeft(photos), 0);
  assert.equal(addPhotos(photos, [photo(9)]).photos.length, 6);
  photos = removePhoto(photos, 'ph2');
  assert.equal(photosLeft(photos), 1);
  // entryFromDraft never stores more than the cap even if a draft somehow holds more
  const e = entryFromDraft({ ...newJournalDraft('2026-11-02'), photos: Array.from({ length: 9 }, (_, i) => photo(i)) }, ids, undefined, NOW);
  assert.equal(e.photos.length, 6);
});

test('dropped photos and trip files include journal photos', () => {
  assert.deepEqual(droppedPhotos([photo(1), photo(2)], [photo(2)]), [photo(1).uri]);
  const e = entryFromDraft({ ...newJournalDraft('2026-11-02'), photos: [photo(1), photo(2)] }, ids, undefined, NOW);
  const t = upsertEntry(trip(), e);
  assert.deepEqual(journalFiles(t), [photo(1).uri, photo(2).uri]);
  assert.deepEqual(tripFiles(t), [photo(1).uri, photo(2).uri]);
  // a malformed stored journal never breaks clean-up
  assert.deepEqual(tripFiles({ ...trip(), journal: [{ bad: true }] as unknown as JournalEntry[] }), []);
});

test('grouping by trip day: date order, day numbers, cycling colours, pages outside the dates', () => {
  let t = trip();
  const add = (day: string, note: string, createdAt: string, photos: JournalPhoto[] = []) => {
    t = upsertEntry(t, entryFromDraft({ ...newJournalDraft(day), note, photos }, ids, undefined, createdAt));
  };
  add('2026-11-03', 'later', '2026-11-03T12:00:00Z');
  add('2026-11-03', 'earlier', '2026-11-03T01:00:00Z', [photo(1), photo(2)]);
  add('2026-11-01', 'first', '2026-11-01T10:00:00Z');
  add('2026-11-05', 'fifth', '2026-11-05T10:00:00Z');
  add('2026-11-09', 'after the dates moved', '2026-11-09T10:00:00Z');
  const g = groupJournal(t);
  assert.deepEqual(g.map((d) => d.day), ['2026-11-01', '2026-11-03', '2026-11-05', '2026-11-09']);
  assert.deepEqual(g.map((d) => d.dayNumber), [1, 3, 5, null]);
  assert.deepEqual(g.map((d) => d.tone), [0, 2, 0, 0]);
  assert.deepEqual(g[1].entries.map((e) => e.note), ['earlier', 'later']);
  assert.equal(g[1].photoCount, 2);
  assert.deepEqual(journalStats(t), { entries: 5, days: 4, photos: 2 });
  assert.deepEqual(groupJournal(trip()), []);
});

test('readJournal skips malformed stored rows', () => {
  const good = entryFromDraft({ ...newJournalDraft('2026-11-02'), note: 'ok' }, ids, undefined, NOW);
  const t = { ...trip(), journal: [good, { id: 'x' }, null, { ...good, id: 'y', day: 'soon' }] as unknown as JournalEntry[] };
  assert.deepEqual(readJournal(t).map((e) => e.id), [good.id]);
  assert.deepEqual(readJournal({ journal: 'nope' as unknown as JournalEntry[] }), []);
});

// ---- .satchel round trip ----

function journalTrip(): Trip {
  let t = trip();
  t = upsertEntry(t, entryFromDraft({ ...newJournalDraft('2026-11-02'), note: 'Landed. مرحبا 🍜', mood: 'tired', weather: 'rain', placeId: 'p1', photos: [photo(1), photo(2), photo(3)] }, ids, undefined, NOW));
  t = upsertEntry(t, entryFromDraft({ ...newJournalDraft('2026-11-03'), note: 'Temples', weather: 'sunny' }, ids, undefined, NOW));
  return t;
}

test('journal round-trips through a trip file as text only', () => {
  const original = journalTrip();
  const { file } = buildTripFile(original, {}, { now: NOW });
  const text = JSON.stringify(file);
  assert.ok(!text.includes('file:///docs/attachments/ph'), 'no photo paths in the file');
  assert.equal(file.trip.journal?.length, 2);
  assert.equal(file.trip.journal?.[0].photoCount, 3);
  assert.equal(fileJournalPhotos(file.trip.journal), 3);
  const parsed = parseTripFileText(text);
  assert.ok(parsed.ok);
  const imp = importTripFile(parsed.file, ids, NOW).trip;
  const j = readJournal(imp);
  assert.equal(j.length, 2);
  assert.deepEqual(
    j.map(({ id: _i, placeId: _p, photos: _ph, ...e }) => e),
    readJournal(original).map(({ id: _i, placeId: _p, photos: _ph, ...e }) => e),
  );
  for (const e of j) {
    assert.ok(!readJournal(original).some((o) => o.id === e.id), 'entry ids are new');
    assert.deepEqual(e.photos, []);
  }
  // the place link follows the imported place's new id
  assert.notEqual(j[0].placeId, 'p1');
  assert.equal(j[0].placeId, imp.places?.[0].id);
  assert.equal(entryPlace(imp, j[0])?.name, 'Fushimi Inari');
  assert.equal(j[1].placeId, undefined);
});

test('a trip with no journal writes no journal key; old files without one still import', () => {
  const { file } = buildTripFile(trip(), {}, { now: NOW });
  assert.equal('journal' in file.trip, false);
  assert.equal(journalForFile(trip()), undefined);
  const old = JSON.parse(JSON.stringify(buildTripFile(demoTrip('2026-11-01', NOW), {}, { now: NOW }).file)) as Record<string, unknown>;
  delete (old.trip as Record<string, unknown>).journal;
  const r = parseTripFile(old);
  assert.ok(r.ok);
  const t = importTripFile(r.file, ids, NOW).trip;
  assert.equal(t.journal, undefined);
  assert.deepEqual(readJournal(t), []);
});

test('malformed journals reject the file; unknown moods are dropped; dangling place links go', () => {
  const g = JSON.parse(JSON.stringify(buildTripFile(journalTrip(), {}, { now: NOW }).file)) as TripFile;
  const e0 = g.trip.journal![0];
  const err = (journal: unknown) => {
    const r = parseTripFile({ ...g, trip: { ...g.trip, journal } });
    return r.ok ? 'ok' : r.error;
  };
  assert.equal(err(g.trip.journal), 'ok');
  assert.equal(err('lots'), 'damaged');
  assert.equal(err([{ ...e0, day: '2026-02-30' }]), 'damaged');
  assert.equal(err([{ ...e0, note: 7 }]), 'damaged');
  assert.equal(err([{ ...e0, photoCount: -1 }]), 'damaged');
  assert.equal(err([e0, e0]), 'damaged');
  assert.equal(checkFileJournal({}), true);

  const r = parseTripFile({ ...g, trip: { ...g.trip, journal: [{ ...e0, mood: 'ecstatic', weather: 'fog', placeId: 'gone', photos: [{ uri: 'x' }] }] } });
  assert.ok(r.ok);
  const [e] = readJournal(importTripFile(r.file, ids, NOW).trip);
  assert.equal(e.mood, undefined);
  assert.equal(e.weather, undefined);
  assert.equal(e.placeId, undefined);
  assert.deepEqual(e.photos, []);
});
