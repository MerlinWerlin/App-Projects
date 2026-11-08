// T156 step-free travel: needs on the phone, toilets order + quick filter, the OSM wheelchair tag through the pack
// pipeline (and lifts), per-booking access notes in .satchel files, the travel-assistance rows and the help-card lines.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { POI_TAGS, overpassQuery, toPois } from '../../tools/maps/pois.mjs';
import type { HelpTable } from './helpcards.ts';
import type { Item, Trip } from './model.ts';
import { OFFERED_POI_CATEGORIES, packPoiSet, parsePackPoiFile } from './packpois.ts';
import { readiness, toFix } from './readiness.ts';
import {
  accessFlagsFor,
  accessibleCount,
  accessibleFirst,
  accessibleOnly,
  airportAssistance,
  assistanceCheck,
  copyAccess,
  hasAccessNeeds,
  needsAssistance,
  needsCard,
  needsCardText,
  readAccess,
  readPrefs,
  setAccessibleOnly,
  STEPFREE_KEY,
  stepfreeTableProblems,
  toggleAccessFlag,
  toggleNeed,
  toiletAccessTier,
  wheelchairLevel,
  withAccess,
  type StepFreeTable,
} from './stepfree.ts';
import { ALL_PARTS, copyTrip } from './tripcopy.ts';
import { buildTripFile, importTripFile, parseTripFileText } from './tripfile.ts';

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const HELP = JSON.parse(read('../content/helpcards.json')) as HelpTable;
const SF = JSON.parse(read('../content/stepfree_lines.json')) as StepFreeTable;

// ---- needs ----

test('needs: phone-only key, cleaned on read, fixed order, quick filter needs a need', () => {
  assert.equal(STEPFREE_KEY, 'satchel.stepfree.v1');
  for (const junk of [null, undefined, 7, 'x', [], { needs: 'wheelchair' }]) assert.deepEqual(readPrefs(junk), { needs: [], accessibleOnly: false });
  assert.deepEqual(readPrefs({ needs: ['pram', 'bogus', 'wheelchair', 'pram'], accessibleOnly: true }), { needs: ['wheelchair', 'pram'], accessibleOnly: true });
  let p = toggleNeed(readPrefs(null), 'walkLimited');
  p = toggleNeed(p, 'wheelchair');
  assert.deepEqual(p.needs, ['wheelchair', 'walkLimited']);
  assert.ok(hasAccessNeeds(p));
  p = setAccessibleOnly(p, true);
  assert.equal(p.accessibleOnly, true);
  p = toggleNeed(toggleNeed(p, 'wheelchair'), 'walkLimited');
  assert.deepEqual(p, { needs: [], accessibleOnly: false }, 'no needs left turns the filter off');
  assert.equal(setAccessibleOnly(p, true).accessibleOnly, false, 'cannot turn the filter on with no needs');
  assert.equal(hasAccessNeeds(null), false);
});

test('needs never go into a trip file (phone only)', () => {
  const src = read('./tripfile.ts') + read('./trips.ts') + read('./model.ts');
  assert.ok(!src.includes('STEPFREE_KEY') && !src.includes('satchel.stepfree'));
});

// ---- OSM tag ----

test('wheelchair tag: yes / designated -> yes, limited, no; anything else unknown', () => {
  assert.equal(wheelchairLevel('yes'), 'yes');
  assert.equal(wheelchairLevel(' Designated '), 'yes');
  assert.equal(wheelchairLevel('limited'), 'limited');
  assert.equal(wheelchairLevel('no'), 'no');
  for (const v of [undefined, null, '', 'maybe', 3, 'bad;yes']) assert.equal(wheelchairLevel(v), undefined);
});

// ---- toilets ----

const T = (id: string, wheelchair?: string, changing_table?: string, pinned = false) => ({ id, wheelchair, changing_table, pinned });

test('toilets: tiers by need (step needs read wheelchair, a pram reads the changing table)', () => {
  assert.equal(toiletAccessTier(T('a', 'yes'), ['wheelchair']), 2);
  assert.equal(toiletAccessTier(T('a', 'limited'), ['stepFree']), 1);
  assert.equal(toiletAccessTier(T('a', 'no'), ['walkLimited']), 0);
  assert.equal(toiletAccessTier(T('a', 'yes'), ['pram']), 0, 'a pram alone does not read the wheelchair tag');
  assert.equal(toiletAccessTier(T('a', undefined, 'yes'), ['pram']), 2);
  assert.equal(toiletAccessTier(T('a', 'limited', 'yes'), ['wheelchair', 'pram']), 2);
  assert.equal(toiletAccessTier(T('a', undefined, 'limited'), ['pram']), 1);
  assert.equal(toiletAccessTier(T('a', 'yes', 'yes'), []), 0);
});

test('toilets: with needs, pinned stay first, then full, then limited, nearest order kept inside each', () => {
  const rows = [T('pin', undefined, undefined, true), T('near'), T('lim', 'limited'), T('far-yes', 'yes'), T('no', 'no'), T('yes2', 'designated')];
  assert.deepEqual(accessibleFirst(rows, ['wheelchair']).map((r) => r.id), ['pin', 'far-yes', 'yes2', 'lim', 'near', 'no']);
  assert.deepEqual(accessibleFirst(rows, []).map((r) => r.id), rows.map((r) => r.id), 'no needs: unchanged');
  assert.equal(accessibleCount(rows, ['wheelchair']), 3);
});

test('toilets: quick filter only when on and needs are set', () => {
  const rows = [T('a'), T('b', 'yes'), T('c', undefined, 'yes')];
  assert.deepEqual(accessibleOnly(rows, { needs: ['wheelchair'], accessibleOnly: true }).map((r) => r.id), ['b']);
  assert.deepEqual(accessibleOnly(rows, { needs: ['pram'], accessibleOnly: true }).map((r) => r.id), ['c']);
  assert.equal(accessibleOnly(rows, { needs: ['wheelchair'], accessibleOnly: false }).length, 3);
  assert.equal(accessibleOnly(rows, { needs: [], accessibleOnly: true }).length, 3);
});

// ---- pack pipeline: wheelchair kept, lifts added (additive, format 2) ----

test('pipeline: places keep the wheelchair tag, lifts are a new place category, app reads both', () => {
  assert.deepEqual(POI_TAGS.lift, [['highway', 'elevator']]);
  assert.equal(Object.keys(POI_TAGS).at(-1), 'lift', 'added last so no earlier match changes');
  assert.ok(overpassQuery([135, 34, 136, 35]).includes('nwr["highway"="elevator"]'));
  const file = toPois(
    [
      { type: 'node', id: 1, lat: 35, lon: 135.7, tags: { amenity: 'toilets', wheelchair: 'yes', changing_table: 'yes' } },
      { type: 'node', id: 2, lat: 35.01, lon: 135.71, tags: { amenity: 'cafe', name: 'Kissa', wheelchair: 'limited' } },
      { type: 'node', id: 3, lat: 35.02, lon: 135.72, tags: { highway: 'elevator', wheelchair: 'yes' } },
      { type: 'node', id: 4, lat: 35.03, lon: 135.73, tags: { amenity: 'pharmacy', name: 'P', wheelchair: 'no' } },
      { type: 'node', id: 5, lat: 35.04, lon: 135.74, tags: { amenity: 'restaurant', name: 'No tag' } },
    ],
    '2026-11-01',
  );
  assert.equal(file.format, 2);
  assert.deepEqual(file.places.map((p) => [p.category, p.wheelchair]), [['food', 'limited'], ['lift', 'yes'], ['pharmacy', 'no'], ['food', undefined]]);
  assert.ok(!('wheelchair' in file.places[3]), 'absent when OSM has no tag');
  const r = parsePackPoiFile(JSON.stringify(file));
  assert.ok(r.ok);
  assert.equal(r.dropped, 0);
  assert.deepEqual(r.pois.map((p) => [p.category, p.wheelchair]), [['toilets', 'yes'], ['food', 'limited'], ['lift', 'yes'], ['pharmacy', 'no'], ['food', undefined]]);
  assert.ok(OFFERED_POI_CATEGORIES.includes('lift'));
  const set = packPoiSet({ id: 'kyoto', name: 'Kyoto', bbox: [135, 34, 136, 36] }, r.pois, (c) => `[${c}]`);
  assert.equal(set.pois.find((p) => p.category === 'lift')?.wheelchair, 'yes');
  assert.equal(set.pois.find((p) => p.name === 'No tag')?.wheelchair, undefined);
  // An unknown tag value from a pack is dropped, never shown.
  const odd = parsePackPoiFile({ places: [{ id: 'n1', lat: 1, lon: 1, category: 'food', wheelchair: 'sometimes' }] });
  assert.ok(odd.ok && !('wheelchair' in odd.pois[0]));
});

// ---- booking access notes ----

const item = (over: Partial<Item>): Item => ({
  id: 'i1',
  tripId: 'trip',
  kind: 'flight',
  title: 'SYD to HND',
  start: { local: '2027-04-01T21:00', tz: 'Australia/Sydney' },
  end: { local: '2027-04-02T05:30', tz: 'Asia/Tokyo' },
  attachments: [],
  ...over,
});

test('access notes: cleaned, only ticks that are on kept, unknown keys dropped, empty removes the field', () => {
  assert.equal(readAccess(null), undefined);
  assert.equal(readAccess({ stepFreeRoom: false, assistance: 'yes', note: '   ' }), undefined);
  assert.deepEqual(readAccess({ lift: true, note: ' ramp\u0007 at  side ', bogus: 1 }), { lift: true, note: 'ramp at side' });
  assert.equal(readAccess({ note: 'x'.repeat(400) })?.note?.length, 300);
  const a = toggleAccessFlag(item({}), 'assistance');
  assert.deepEqual(a.access, { assistance: true });
  const b = toggleAccessFlag(a, 'assistance');
  assert.ok(!('access' in b));
  assert.ok(!('access' in withAccess(item({ access: { lift: true } }), undefined)));
  assert.deepEqual(accessFlagsFor('hotel'), ['stepFreeRoom', 'lift']);
  assert.deepEqual(accessFlagsFor('train'), ['assistance']);
  assert.deepEqual(accessFlagsFor('note'), []);
  assert.deepEqual(copyAccess({ stepFreeRoom: true, assistance: true, lift: true, note: 'n' }), { lift: true, note: 'n' });
  assert.equal(copyAccess({ assistance: true }), undefined);
});

const trip = (items: Item[]): Trip => ({ id: 'trip', name: 'Japan', startDate: '2027-04-01', endDate: '2027-04-08', homeTz: 'Australia/Sydney', items, createdAt: '2027-01-01T00:00:00.000Z' });

test('access notes travel in a .satchel file; a bad value is dropped, never refusing the file', () => {
  const t = trip([item({ access: { assistance: true, note: 'Meets at gate' } }), item({ id: 'h', kind: 'hotel', access: { stepFreeRoom: true, lift: true } })]);
  const text = JSON.stringify(buildTripFile(t, {}).file);
  const parsed = parseTripFileText(text);
  assert.ok(parsed.ok);
  let n = 0;
  const imported = importTripFile(parsed.file, (p) => `${p}_n${++n}`, '2027-01-03T00:00:00.000Z');
  assert.deepEqual(imported.trip.items.map((i) => i.access), [{ assistance: true, note: 'Meets at gate' }, { stepFreeRoom: true, lift: true }]);
  const bad = JSON.parse(text);
  bad.items[0].access = { assistance: 'yes please' };
  const r = parseTripFileText(JSON.stringify(bad));
  assert.ok(r.ok);
  assert.ok(!('access' in r.file.items[0]));
});

test('Plan this trip again keeps the lift and note, not the room request or the assistance booking', () => {
  const t = trip([item({ id: 'h', kind: 'hotel', access: { stepFreeRoom: true, lift: true, note: 'side door' } }), item({ access: { assistance: true } })]);
  let n = 0;
  const items = copyTrip(t, null, { startDate: '2028-04-01', parts: ALL_PARTS, newId: (p) => `${p}${++n}`, now: '2027-05-01T00:00:00.000Z' }).trip.items;
  assert.deepEqual(items[0].access, { lift: true, note: 'side door' });
  assert.ok(!('access' in items[1]));
});

// ---- travel assistance ----

const NOW = Date.parse('2027-03-01T00:00:00Z');
const NEEDS = { needs: ['wheelchair' as const], accessibleOnly: false };

test('assistance row: only with step needs and a journey ahead; pass when every journey is marked', () => {
  const legs = [item({ id: 'f1' }), item({ id: 't1', kind: 'train', start: { local: '2027-04-03T09:00', tz: 'Asia/Tokyo' }, end: { local: '2027-04-03T11:15', tz: 'Asia/Tokyo' } }), item({ id: 'h', kind: 'hotel' })];
  assert.equal(assistanceCheck(trip(legs), { needs: [], accessibleOnly: false }, NOW), null);
  assert.equal(assistanceCheck(trip(legs), { needs: ['pram'], accessibleOnly: false }, NOW), null, 'a pram alone gets no assistance row');
  assert.equal(needsAssistance({ needs: ['walkLimited'] }), true);
  assert.equal(assistanceCheck(trip([item({ kind: 'hotel' })]), NEEDS, NOW), null);
  assert.equal(assistanceCheck(trip(legs), NEEDS, Date.parse('2027-05-01T00:00:00Z')), null, 'all journeys done');
  const none = assistanceCheck(trip(legs), NEEDS, NOW);
  assert.deepEqual(none, { id: 'assistance', status: 'warn', reason: 'none', done: 0, total: 2, fix: { kind: 'assistance', itemId: 'f1' } });
  const some = assistanceCheck(trip([withAccess(legs[0], { assistance: true }), legs[1]]), NEEDS, NOW);
  assert.equal(some?.reason, 'some');
  assert.deepEqual(some?.fix, { kind: 'assistance', itemId: 't1' });
  const all = assistanceCheck(trip([withAccess(legs[0], { assistance: true }), withAccess(legs[1], { assistance: true })]), NEEDS, NOW);
  assert.deepEqual([all?.status, all?.reason, all?.fix], ['pass', 'all', null]);
});

test('assistance row joins the readiness card after check-in and is worked on like the others', () => {
  const t = trip([item({ id: 'f1' })]);
  const assistance = assistanceCheck(t, NEEDS, NOW);
  const r = readiness({ trip: t, docs: [], packing: null, card: null, catalog: null, installed: [], now: NOW, assistance });
  assert.equal(r.checks.at(-1)?.id, 'assistance');
  assert.ok(toFix(r).some((c) => c.id === 'assistance'));
  const without = readiness({ trip: t, docs: [], packing: null, card: null, catalog: null, installed: [], now: NOW });
  assert.equal(r.scored, without.scored + 1);
});

test('airport-day row: journeys only, booked or not, late inside the usual 48 hours notice', () => {
  const f = item({ id: 'f1' });
  assert.equal(airportAssistance(f, { needs: [], accessibleOnly: false }, NOW), null);
  assert.equal(airportAssistance(item({ kind: 'hotel' }), NEEDS, NOW), null);
  const early = airportAssistance(f, NEEDS, NOW);
  assert.deepEqual([early?.booked, early?.late], [false, false]);
  const dep = Date.parse('2027-04-01T10:00:00Z'); // 21:00 Sydney (AEDT, +11)
  const soon = airportAssistance(f, NEEDS, dep - 24 * 3_600_000);
  assert.deepEqual(soon, { booked: false, hoursLeft: 24, late: true });
  assert.deepEqual(airportAssistance(withAccess(f, { assistance: true }), NEEDS, dep - 3_600_000), { booked: true, hoursLeft: 1, late: false });
});

test('no company names in the step-free strings or code', () => {
  const text = read('../i18n/en/stepfree.ts') + read('./stepfree.ts');
  for (const banned of ['Qantas', 'Airways', 'Airlines', 'Rail Europe', 'Amtrak', 'JR ', 'Eurostar', 'OmniAccess', 'Google', 'Uber']) assert.ok(!text.includes(banned), banned);
});

// ---- help-card lines ----

test('content: step-free lines exist in every help-card language, each marked for a native check', () => {
  assert.deepEqual(stepfreeTableProblems(SF, HELP), []);
  const broken: StepFreeTable = structuredClone(SF);
  delete (broken.languages[0].lines as Record<string, unknown>).pram;
  broken.languages[1].lines.liftAsk = { text: 'x' };
  broken.languages.pop();
  const p = stepfreeTableProblems(broken, HELP);
  assert.ok(p.some((x) => x.endsWith('pram: missing')));
  assert.ok(p.some((x) => x.includes('liftAsk: not marked')));
  assert.ok(p.some((x) => x.startsWith('language ')));
});

test('needs card: reuses the help-card lines, adds its own, in the local language with English kept', () => {
  const empty = needsCard([], HELP, SF, 'ja');
  assert.equal(empty.lines.length, 0);
  const c = needsCard(['walkLimited', 'wheelchair', 'pram'], HELP, SF, 'ja');
  assert.equal(c.title.en, HELP.sentences.find((s) => s.id === 'needsTitle')?.en);
  assert.deepEqual(c.lines.map((l) => l.id), ['wheelchair', 'pram', 'walkLimited', 'sit', 'liftAsk']);
  const help = HELP.languages.find((l) => l.code === 'ja');
  assert.equal(c.lines[0].local, help?.lines.wheelchair.text, 'wheelchair line is the help-card one');
  assert.equal(c.lines[1].local, 'ベビーカーを使っています。段差のない道はありますか？');
  const text = needsCardText(c);
  assert.ok(text.includes('I use a wheelchair.') && text.includes('エレベーター'));
  // Both step-free needs only add the lift question once.
  const d = needsCard(['wheelchair', 'stepFree'], HELP, SF, 'de');
  assert.deepEqual(d.lines.map((l) => l.id), ['wheelchair', 'stepFree', 'liftAsk']);
  assert.equal(d.lines[2].local, 'Wo ist der Aufzug?');
});
