import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { demoTrip } from './demo.ts';
import { withSampleIdeas, withSampleSpending } from './demoExtras.ts';
import {
  cardPhotoFiles,
  essentialsCards,
  isRecapPreview,
  isSampleJournalEntry,
  latestRecapTrip,
  recapToday,
  SAMPLE_JOURNAL_IDS,
  sampleJournal,
  seedSampleJournal,
  stalePhoto,
  unusedPicks,
  withSampleJournal,
} from './followups91.ts';
import { isMood, isWeather, readJournal } from './journal.ts';
import { cardFromDraft, cleanCard, cleanCards, draftFromCard, newCardDraft, type LoyaltyCard } from './loyalty.ts';
import type { Trip } from './model.ts';
import { tripRecap } from './recap.ts';
import { en } from '../i18n/en.ts';
import { inSpecGroups } from '../i18n/specsync.ts';

const NOW = '2026-10-31T00:00:00Z';
const demo = demoTrip('2026-11-03', NOW);
const real = (id: string, startDate: string, endDate: string): Trip => ({ id, name: id, startDate, endDate, homeTz: 'Australia/Sydney', items: [], createdAt: NOW });

// ---- sample journal

test('sample journal: labelled sample pages with valid moods and weather, no photos, inside the demo dates', () => {
  const pages = sampleJournal(demo.startDate, NOW);
  assert.ok(pages.length >= 5);
  assert.deepEqual(pages.map((p) => p.id), [...SAMPLE_JOURNAL_IDS]);
  for (const p of pages) {
    assert.ok(p.note.startsWith('Sample page'), p.note);
    assert.ok(isMood(p.mood) && isWeather(p.weather));
    assert.deepEqual(p.photos, []);
    assert.ok(p.day >= demo.startDate && p.day <= demo.endDate, p.day);
    assert.ok(isSampleJournalEntry(p));
  }
  // they read back through the defensive journal reader
  assert.equal(readJournal(withSampleJournal(demo, NOW)).length, pages.length);
});

test('sample journal: demo only, once, never over the traveller’s own pages', () => {
  const seeded = withSampleJournal(demo, NOW);
  assert.equal(seeded.journal?.length, SAMPLE_JOURNAL_IDS.length);
  assert.equal(withSampleJournal(seeded, NOW), seeded, 'second pass changes nothing');
  const own: Trip = { ...demo, journal: [{ id: 'mine', day: demo.startDate, note: 'mine', photos: [], createdAt: NOW }] };
  assert.equal(withSampleJournal(own, NOW), own);
  const other = real('r1', '2026-01-01', '2026-01-05');
  assert.equal(withSampleJournal(other, NOW), other);
  // an imported copy of the demo (demo flag, new id) is left alone: only the seeded demo gets samples
  const copy: Trip = { ...demo, id: 'copy1' };
  assert.equal(withSampleJournal(copy, NOW), copy);
});

test('seedSampleJournal: the same list when nothing changes, otherwise only the demo trip gains pages', () => {
  const list = [real('r1', '2026-01-01', '2026-01-05'), demo];
  const next = seedSampleJournal(list, NOW);
  assert.notEqual(next, list);
  assert.equal(next[0], list[0]);
  assert.equal(next[1]!.journal?.length, SAMPLE_JOURNAL_IDS.length);
  assert.equal(seedSampleJournal(next, NOW), next, 'running it again never duplicates');
  const noDemo = [real('r1', '2026-01-01', '2026-01-05')];
  assert.equal(seedSampleJournal(noDemo, NOW), noDemo);
});

test('sample trip recap: moods and a best day (day 6, joyful) with the sample pages', () => {
  const t = withSampleJournal(withSampleIdeas(withSampleSpending(demo, NOW), NOW), NOW);
  const r = tripRecap(t, recapToday(t, '2026-11-20'));
  assert.equal(r.available, true);
  assert.ok(r.journal.moods.length >= 4);
  assert.equal(r.journal.moods[0]!.mood, 'joyful');
  assert.equal(r.journal.photos, 0);
  assert.ok(r.bestDay);
  assert.equal(r.bestDay!.dayNumber, 6);
  assert.equal(r.bestDay!.mood, 'joyful');
  assert.equal(r.bestDay!.score, 5);
});

// ---- recap preview

test('recapToday: an upcoming demo trip previews its whole span; real trips and started demos keep today', () => {
  assert.equal(recapToday(demo, '2026-10-31'), '2026-11-12');
  assert.equal(isRecapPreview(demo, '2026-10-31'), true);
  const r = tripRecap(withSampleJournal(demo, NOW), recapToday(demo, '2026-10-31'));
  assert.equal(r.available, true);
  assert.equal(r.phase, 'past');
  assert.equal(recapToday(demo, '2026-11-05'), '2026-11-05');
  assert.equal(isRecapPreview(demo, '2026-11-05'), false);
  const up = real('u1', '2027-01-01', '2027-01-05');
  assert.equal(recapToday(up, '2026-10-31'), '2026-10-31');
  assert.equal(isRecapPreview(up, '2026-10-31'), false);
  assert.equal(tripRecap(up, recapToday(up, '2026-10-31')).available, false, 'real upcoming trips keep the honest state');
});

test('latestRecapTrip: newest finished real trip, else the demo, else nothing', () => {
  const today = '2026-10-31';
  const a = real('a', '2026-03-01', '2026-03-10');
  const b = real('b', '2026-08-01', '2026-08-12');
  const on = real('on', '2026-10-28', '2026-11-04');
  const future = real('f', '2027-02-01', '2027-02-04');
  assert.equal(latestRecapTrip([a, demo, b, on, future], today)?.id, 'b');
  assert.equal(latestRecapTrip([on, future, demo], today)?.id, 'demo');
  assert.equal(latestRecapTrip([on, future], today), null);
  assert.equal(latestRecapTrip([], today), null);
  // a trip ending today is not finished yet
  assert.equal(latestRecapTrip([real('t', '2026-10-25', today), a], today)?.id, 'a');
  // equal ends: later start wins
  assert.equal(latestRecapTrip([real('x', '2026-08-05', '2026-08-12'), b], today)?.id, 'x');
});

// ---- loyalty card photo and essentials

const card = (over: Partial<LoyaltyCard> = {}): LoyaltyCard => ({ id: 'c1', kind: 'air', programme: 'Sky Club', number: '123456789012', colour: 'navy', barcode: 'none', createdAt: 1, ...over });

test('card photo: stored, cleaned and round-tripped through the form', () => {
  const uri = 'file:///docs/attachments/card-1-front.jpg';
  assert.equal(cleanCard(card({ photo: uri }))?.photo, uri);
  assert.equal(cleanCard({ ...card(), photo: '' })?.photo, undefined);
  assert.equal(cleanCard({ ...card(), photo: 42 })?.photo, undefined);
  assert.equal(cleanCard({ ...card(), photo: 'x'.repeat(5000) })?.photo, undefined);
  assert.equal(newCardDraft().photo, '');
  const d = draftFromCard(card({ photo: uri }));
  assert.equal(d.photo, uri);
  assert.equal(cardFromDraft(d, 'c1', 1).photo, uri);
  assert.equal('photo' in cardFromDraft({ ...d, photo: '' }, 'c1', 1), false);
  // older stored cards (no photo) still load
  assert.equal(cleanCards([card()])[0]!.photo, undefined);
});

test('card photo: which files to clean up', () => {
  const a = 'file:///d/attachments/a.jpg';
  const b = 'file:///d/attachments/b.jpg';
  assert.equal(stalePhoto({ photo: a }, { photo: b }), a);
  assert.equal(stalePhoto({ photo: a }, {}), a);
  assert.equal(stalePhoto({ photo: a }, { photo: a }), null);
  assert.equal(stalePhoto(undefined, { photo: a }), null);
  assert.equal(stalePhoto({}, { photo: a }), null);
  assert.deepEqual(unusedPicks([a, b, a], b), [a]);
  assert.deepEqual(unusedPicks([a], undefined), [a]);
  assert.deepEqual(cardPhotoFiles([card({ photo: a }), card()]), [a]);
});

test('essentialsCards: every card in Wallet order, number grouped, expired cards kept', () => {
  const list = essentialsCards([
    card({ id: 'h', kind: 'hotel', programme: 'Stay Points', number: 'AB-1', expires: '2020-01-01' }),
    card({ id: 'a', kind: 'air', programme: 'Sky Club', tier: 'Gold', photo: 'file:///d/attachments/x.jpg' }),
  ]);
  assert.deepEqual(list.map((c) => c.id), ['a', 'h']);
  assert.equal(list[0]!.number, '1234 5678 9012');
  assert.equal(list[0]!.tier, 'Gold');
  assert.equal(list[0]!.hasPhoto, true);
  assert.equal(list[1]!.number, 'AB-1');
  assert.equal(list[1]!.hasPhoto, false);
  assert.deepEqual(essentialsCards([]), []);
});

// ---- wiring guards

test('T88 strings are in the catalogue under f91. and mirrored by the spec sync', () => {
  const keys = Object.keys(en).filter((k) => k.startsWith('f91.'));
  assert.ok(keys.length >= 10);
  for (const k of keys) assert.ok(inSpecGroups(k), k);
});

test('T88 wiring: seeding, recap preview, Trips tab card, essentials and card photo are hooked up', () => {
  const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
  const trips = read('src/state/trips.tsx');
  assert.match(trips, /withSampleJournal/);
  assert.match(trips, /DEMO_JOURNAL_KEY/);
  assert.match(read('app/recap/[tripId].tsx'), /recapToday/);
  assert.match(read('src/ui/slots/TripRecapSlot.tsx'), /recapToday/);
  assert.match(read('app/(tabs)/index.tsx'), /RecapHeroCard/);
  assert.match(read('src/ui/slots/EssentialsSlot.tsx'), /EssentialsLoyalty/);
  assert.match(read('src/ui/slots/EssentialsLoyalty.tsx'), /\/loyalty\/\[id\]/);
  assert.match(read('app/loyalty-edit.tsx'), /pickJournalPhotos/);
  assert.match(read('app/loyalty/[id].tsx'), /card\.photo/);
  // card photos stay on the phone: loyalty is never in a trip file
  for (const p of ['src/core/tripfile.ts']) assert.doesNotMatch(read(p), /loyalty/i);
});
