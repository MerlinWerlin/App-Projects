// T68 (run 86 follow-ups): journal photos in trip files, journal photo paths after the app's container moves,
// the usual-sleep setting, the call finder looking past today, and translated country names.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { awakeHours, CALL_DAYS_AHEAD, callDays, callWindows, nextCall, planFor, type Leg } from './jetlag.ts';
import {
  checkFileJournal,
  entryFromDraft,
  fileJournalPhotos,
  importJournal,
  journalPhotoSize,
  newJournalDraft,
  readJournal,
  upsertEntry,
  withJournalFiles,
  type JournalEntry,
  type JournalPhoto,
} from './journal.ts';
import type { Item, Trip } from './model.ts';
import { DEFAULT_APP_PREFS, normaliseAppPrefs, normaliseSleep, sleepLimits, sleepOk, stepSleep } from './settings.ts';
import { rebaseJournal, rebaseTrips } from './tickets.ts';
import { localCountryName } from './travelstats.ts';
import { buildTripFile, importTripFile, MAX_TRIP_FILE_CHARS, parseTripFile, parseTripFileText, type TripFile } from './tripfile.ts';
import { toUtc } from './tz.ts';

const NOW = '2026-10-31T09:00:00.000Z';
let n = 0;
const ids = (prefix: string) => `${prefix}_t68_${++n}`;
const photo = (i: number, size: number | null = 1500 * i): JournalPhoto => ({
  id: `ph${i}`,
  uri: `file:///var/mobile/Containers/Data/Application/OLD/Documents/attachments/ph${i}.jpg`,
  name: `ph${i}.jpg`,
  mime: 'image/jpeg',
  ...(size === null ? {} : { size }),
});
const B64 = (s: string) => Buffer.from(s).toString('base64');

function trip(): Trip {
  const items: Item[] = [
    { id: 'f1', tripId: 't', kind: 'flight', title: 'LHR-HND', start: { local: '2026-11-01T11:00', tz: 'Europe/London' }, end: { local: '2026-11-02T08:00', tz: 'Asia/Tokyo' }, attachments: [] },
  ];
  let t: Trip = { id: 't', name: 'Japan', startDate: '2026-11-01', endDate: '2026-11-06', homeTz: 'Europe/London', items, places: [], createdAt: NOW };
  t = upsertEntry(t, entryFromDraft({ ...newJournalDraft('2026-11-02'), note: 'Landed', photos: [photo(1), photo(2)] }, ids, undefined, NOW));
  t = upsertEntry(t, entryFromDraft({ ...newJournalDraft('2026-11-03'), note: 'Temples', photos: [photo(3, null)] }, ids, undefined, NOW));
  return t;
}
const allBytes = { ph1: B64('one'), ph2: B64('two'), ph3: B64('three') };

// ---- 1. journal photos in the trip file ----

test('photos stay out by default: the file counts them and import says how many were left out', () => {
  const built = buildTripFile(trip(), {}, { now: NOW });
  assert.equal(built.file.journal_photos, undefined);
  assert.equal(built.photosSkipped, 0);
  assert.equal(fileJournalPhotos(built.file.trip.journal), 3);
  const parsed = parseTripFileText(JSON.stringify(built.file));
  assert.ok(parsed.ok);
  const imp = importTripFile(parsed.file, ids, NOW);
  assert.deepEqual(imp.journalFiles, []);
  assert.equal(imp.journalPhotosLeftOut, 3);
  assert.deepEqual(readJournal(imp.trip).flatMap((e) => e.photos), []);
});

test('with "Include journal photos" on, the bytes travel and come back as new photos', () => {
  const built = buildTripFile(trip(), {}, { now: NOW, journalPhotos: allBytes });
  assert.equal(built.photosSkipped, 0);
  assert.deepEqual(built.file.journal_photos?.map((p) => p.id), ['ph1', 'ph2', 'ph3']);
  const text = JSON.stringify(built.file);
  assert.ok(!text.includes('Containers'), 'no device paths in the file');
  assert.equal(fileJournalPhotos(built.file.trip.journal), 0);
  assert.equal(built.file.trip.journal?.[0].photoFiles?.length, 2);
  const parsed = parseTripFileText(text);
  assert.ok(parsed.ok);
  const imp = importTripFile(parsed.file, ids, NOW);
  assert.equal(imp.journalPhotosLeftOut, 0);
  assert.equal(imp.journalFiles.length, 3);
  assert.deepEqual(imp.journalFiles.map((f) => Buffer.from(f.data_base64, 'base64').toString()), ['one', 'two', 'three']);
  for (const f of imp.journalFiles) assert.ok(!['ph1', 'ph2', 'ph3'].includes(f.photoId), 'photo ids are new');
  // written paths fill in; a photo whose file couldn't be written is dropped
  const written: Record<string, string> = {};
  for (const f of imp.journalFiles.slice(0, 2)) written[f.photoId] = `file:///new/attachments/${f.photoId}.jpg`;
  const done = readJournal(withJournalFiles(imp.trip, written));
  assert.deepEqual(done.map((e) => e.photos.length), [2, 0]);
  assert.equal(done[0].photos[0].uri, written[imp.journalFiles[0].photoId]);
  assert.equal(done[0].photos[0].size, 1500);
  assert.equal(done[0].photos[0].name, 'ph1.jpg');
});

test('unreadable photos and photos that would make the file too big are left out and counted', () => {
  const built = buildTripFile(trip(), {}, { now: NOW, journalPhotos: { ph1: allBytes.ph1, ph3: '' } });
  assert.equal(built.photosSkipped, 2);
  assert.deepEqual(built.file.journal_photos?.map((p) => p.id), ['ph1']);
  assert.equal(fileJournalPhotos(built.file.trip.journal), 2);
  const huge = 'A'.repeat(MAX_TRIP_FILE_CHARS - 3 * 1024 * 1024);
  const big = buildTripFile(trip(), {}, { now: NOW, journalPhotos: { ph1: huge, ph2: huge, ph3: allBytes.ph3 } });
  assert.deepEqual(big.file.journal_photos?.map((p) => p.id), ['ph1', 'ph3']);
  assert.equal(big.photosSkipped, 1);
  assert.ok(JSON.stringify(big.file).length <= MAX_TRIP_FILE_CHARS);
});

test('photo lists must match their bytes; older files without photoFiles still import', () => {
  const g = JSON.parse(JSON.stringify(buildTripFile(trip(), {}, { now: NOW, journalPhotos: allBytes }).file)) as TripFile;
  const err = (patch: Partial<TripFile> | Record<string, unknown>) => {
    const r = parseTripFile({ ...g, ...patch });
    return r.ok ? 'ok' : `${r.error}:${r.detail}`;
  };
  assert.equal(err({}), 'ok');
  assert.equal(err({ journal_photos: g.journal_photos!.slice(1) }), 'damaged:journal-photos');
  assert.equal(err({ journal_photos: [...g.journal_photos!, g.journal_photos![0]] }), 'damaged:journal-photos');
  assert.equal(err({ journal_photos: [{ ...g.journal_photos![0], data_base64: 'not base64!' }, ...g.journal_photos!.slice(1)] }), 'damaged:journal-photos');
  assert.equal(err({ journal_photos: 'lots' }), 'damaged:journal-photos');
  const e0 = g.trip.journal![0];
  assert.equal(checkFileJournal({ journal: [{ ...e0, photoFiles: [{ id: 'x' }] }] }), false);
  assert.equal(checkFileJournal({ journal: [{ ...e0, photoFiles: 'x' }] }), false);
  assert.equal(checkFileJournal({ journal: [e0, { ...g.trip.journal![1], id: 'other', photoFiles: e0.photoFiles }] }), false, 'a photo listed twice');
  // a T64 file: no photoFiles, no journal_photos
  const old = JSON.parse(JSON.stringify(buildTripFile(trip(), {}, { now: NOW }).file)) as TripFile;
  const r = parseTripFile(old);
  assert.ok(r.ok);
  assert.equal(importTripFile(r.file, ids, NOW).journalPhotosLeftOut, 3);
  // importJournal keeps its T64 behaviour (no photos)
  assert.deepEqual(importJournal(g.trip.journal, ids, new Map())?.flatMap((e) => e.photos), []);
});

test('size note: photo count, bytes known, photos saved without a size', () => {
  assert.deepEqual(journalPhotoSize(trip()), { count: 3, bytes: 4500, unknown: 1 });
  assert.deepEqual(journalPhotoSize({ journal: undefined }), { count: 0, bytes: 0, unknown: 0 });
});

// ---- 2. journal photo paths after iOS moves the container ----

const NEW_DIR = 'file:///var/mobile/Containers/Data/Application/NEW/Documents/';

test('journal photo paths rebase onto this install, relative paths resolve, others are left alone', () => {
  const t = trip();
  const j = t.journal as JournalEntry[];
  const out = rebaseJournal(j, NEW_DIR);
  assert.notEqual(out, j);
  assert.equal(out[0].photos[0].uri, `${NEW_DIR}attachments/ph1.jpg`);
  assert.equal(out[1].photos[0].uri, `${NEW_DIR}attachments/ph3.jpg`);
  assert.equal(rebaseJournal(out, NEW_DIR), out, 'nothing moved: same array');
  const rel = [{ ...j[0], photos: [{ ...j[0].photos[0], uri: 'attachments/ph1.jpg' }, { ...j[0].photos[1], uri: 'file:///elsewhere/ph2.jpg' }] }];
  const r = rebaseJournal(rel, NEW_DIR);
  assert.equal(r[0].photos[0].uri, `${NEW_DIR}attachments/ph1.jpg`);
  assert.equal(r[0].photos[1].uri, 'file:///elsewhere/ph2.jpg');
  assert.equal(rebaseJournal(j, null), j);
  const junk = [null, { id: 'x' }, { id: 'y', photos: [null, { uri: 7 }] }] as unknown as JournalEntry[];
  assert.equal(rebaseJournal(junk, NEW_DIR), junk);
});

test('rebaseTrips now covers journal photos too, keeping untouched trips by reference', () => {
  const moved = trip();
  const fine: Trip = { ...trip(), id: 'fine', journal: rebaseJournal(trip().journal as JournalEntry[], NEW_DIR) };
  const input = [moved, fine];
  const out = rebaseTrips(input, NEW_DIR);
  assert.notEqual(out, input);
  assert.equal(readJournal(out[0])[0].photos[1].uri, `${NEW_DIR}attachments/ph2.jpg`);
  assert.equal(out[0].items, moved.items, 'bookings untouched');
  assert.equal(out[1], fine);
  assert.equal(rebaseTrips(out, NEW_DIR), out);
});

// ---- 3. usual sleep, call finder past today ----

test('usual sleep: defaults 23:00 to 07:00, stored values checked, steps of 30 minutes with limits', () => {
  assert.equal(DEFAULT_APP_PREFS.sleepBed, '23:00');
  assert.equal(DEFAULT_APP_PREFS.sleepWake, '07:00');
  assert.deepEqual(normaliseSleep('00:30', '08:00'), { sleepBed: '00:30', sleepWake: '08:00' });
  assert.deepEqual(normaliseSleep('24:00', '07:00'), { sleepBed: '23:00', sleepWake: '07:00' });
  assert.deepEqual(normaliseSleep('7pm', 3), { sleepBed: '23:00', sleepWake: '07:00' });
  assert.deepEqual(normaliseSleep('06:00', '07:00'), { sleepBed: '23:00', sleepWake: '07:00' }, 'one hour of sleep is refused');
  assert.equal(normaliseAppPrefs({ sleepBed: '22:30', sleepWake: '06:30' }).sleepBed, '22:30');
  const p = { sleepBed: '23:00', sleepWake: '07:00' };
  assert.deepEqual(stepSleep(p, 'bed', 1), { sleepBed: '23:30', sleepWake: '07:00' });
  assert.deepEqual(stepSleep({ sleepBed: '23:30', sleepWake: '07:00' }, 'bed', 1), { sleepBed: '00:00', sleepWake: '07:00' }, 'wraps past midnight');
  assert.deepEqual(stepSleep(p, 'wake', -1), { sleepBed: '23:00', sleepWake: '06:30' });
  assert.deepEqual(stepSleep({ sleepBed: '23:10', sleepWake: '07:00' }, 'bed', -1).sleepBed, '23:00', 'snaps to the grid');
  // at least 4 h asleep: wake can't come earlier than 03:00 after a 23:00 bedtime
  assert.deepEqual(stepSleep({ sleepBed: '23:00', sleepWake: '03:00' }, 'wake', -1), { sleepBed: '23:00', sleepWake: '03:00' });
  assert.deepEqual(sleepLimits({ sleepBed: '23:00', sleepWake: '03:00' }, 'wake'), { canLower: false, canRaise: true });
  // at least 6 h awake
  assert.equal(sleepOk('13:00', '07:00'), true);
  assert.equal(sleepOk('12:30', '07:00'), false);
});

test('awake hours come from the sleep setting; a bedtime after midnight stops at midnight', () => {
  assert.deepEqual(awakeHours(), { from: '07:00', to: '23:00' });
  assert.deepEqual(awakeHours('06:30', '22:00'), { from: '06:30', to: '22:00' });
  assert.deepEqual(awakeHours('08:00', '00:30'), { from: '08:00', to: '24:00' });
  assert.deepEqual(awakeHours('bad', '22:00'), { from: '07:00', to: '23:00' });
});

test('the plan follows the sleep setting', () => {
  const leg: Leg = {
    which: 'outbound',
    fromTz: 'Europe/London',
    toTz: 'Asia/Tokyo',
    departs: { local: '2026-11-01T11:00', tz: 'Europe/London' },
    arrives: { local: '2026-11-02T08:00', tz: 'Asia/Tokyo' },
    shift: 540,
    direction: 'east',
  };
  const def = planFor(leg)!;
  const late = planFor(leg, '08:00', '00:00')!;
  assert.equal(def.before[2].bed, '20:00');
  assert.equal(late.before[2].bed, '21:00');
  assert.equal(late.before[2].wake, '05:00');
});

const LON = 'Europe/London';
test('call finder: today and the next three home days, and the next window may be on a later day', () => {
  const days = callDays(LON, 'Pacific/Auckland', '2026-11-01', awakeHours());
  assert.equal(days.length, CALL_DAYS_AHEAD + 1);
  assert.deepEqual(days.map((d) => d.date), ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04']);
  assert.deepEqual(days[1].windows, callWindows(LON, 'Pacific/Auckland', '2026-11-02', awakeHours()));
  // late evening in London, after today's last window: the next one is tomorrow
  const lastToday = days[0].windows[days[0].windows.length - 1];
  const after = lastToday.endUtc + 60_000;
  const next = nextCall(days, after);
  assert.equal(next?.date, '2026-11-02');
  // during a window, that window is the next one
  assert.equal(nextCall(days, lastToday.startUtc)?.window, lastToday);
  // none at all in range
  const none = callDays(LON, 'Australia/Sydney', '2026-12-01', { from: '09:00', to: '17:00' });
  assert.equal(nextCall(none, toUtc({ local: '2026-12-01T00:00', tz: LON })), null);
});

// ---- 5. translated country names ----

test('country names in the app language, falling back to the English table name', () => {
  assert.equal(localCountryName('JP', 'fr', 'Japan'), 'Japon');
  assert.equal(localCountryName('de', 'de', 'Germany'), 'Deutschland');
  assert.equal(localCountryName('JP', 'en', 'Japan'), 'Japan');
  assert.equal(localCountryName('ZZ', 'de', 'ZZ'), 'ZZ', 'unknown region falls back');
  assert.equal(localCountryName('Japan', 'fr', 'Japan'), 'Japan', 'not a code');
  assert.equal(localCountryName('JP', '@@not a tag', 'Japan'), 'Japan', 'unusable language falls back');
  const saved = (Intl as unknown as Record<string, unknown>).DisplayNames;
  try {
    (Intl as unknown as Record<string, unknown>).DisplayNames = undefined;
    assert.equal(localCountryName('JP', 'it', 'Japan'), 'Japan', 'no DisplayNames in the engine');
  } finally {
    (Intl as unknown as Record<string, unknown>).DisplayNames = saved;
  }
});
