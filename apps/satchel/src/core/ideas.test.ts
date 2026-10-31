import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  categoryCounts,
  draftFromIdea,
  findIdea,
  groupIdeas,
  ideaDayKeys,
  ideaDayNumber,
  ideaFromDraft,
  ideaJournalDay,
  ideasOn,
  ideaStats,
  importIdeas,
  isWebLink,
  newIdeaDraft,
  planIdea,
  plannedSpots,
  readFileIdeas,
  readIdeas,
  removeIdea,
  sameIdeaDraft,
  setIdeaDone,
  topIdeas,
  upsertIdea,
  validateIdea,
  webLink,
  type Idea,
} from './ideas.ts';
import type { Item, Trip } from './model.ts';
import { buildTripFile, importTripFile, parseTripFile, parseTripFileText } from './tripfile.ts';
import { routeView, tripRoute } from './triproute.ts';
import { toUtc } from './tz.ts';

const NOW = '2026-10-31T09:00:00.000Z';
let n = 0;
const ids = (prefix: string) => `${prefix}_i${++n}`;

function trip(ideas?: Idea[]): Trip {
  const items: Item[] = [
    { id: 'h1', tripId: 't', kind: 'hotel', title: 'Hotel', start: { local: '2026-11-02T15:00', tz: 'Asia/Tokyo' }, end: { local: '2026-11-05T10:00', tz: 'Asia/Tokyo' }, place: { id: 'pl', name: 'Hotel', lat: 35.68, lon: 139.76 }, attachments: [] },
  ];
  return { id: 't', name: 'Japan', startDate: '2026-11-01', endDate: '2026-11-05', homeTz: 'Asia/Tokyo', items, createdAt: NOW, ...(ideas ? { ideas } : {}) };
}
const idea = (id: string, extra: Partial<Idea> = {}): Idea => ({ id, name: `Idea ${id}`, category: 'see', createdAt: `2026-10-0${id.length}T00:00:00Z`, ...extra });

test('readIdeas: absent on older trips, unreadable rows skipped, unknown fields and categories handled', () => {
  assert.deepEqual(readIdeas(trip()), []);
  assert.deepEqual(readIdeas({ ideas: 'nope' as unknown as Idea[] }), []);
  const rows = [
    { id: 'a', name: 'Castle', category: 'see', createdAt: NOW, future: { x: 1 } },
    { id: 'b', name: 'Mystery', category: 'party', createdAt: NOW },
    { id: 'c', category: 'eat' },
    null,
    { id: 'a', name: 'Duplicate', category: 'eat', createdAt: NOW },
    { id: 'd', name: 'Bad spot', category: 'do', createdAt: NOW, lat: 200, lon: 0, day: '2026-13-40', done: 'yes' },
  ];
  const list = readIdeas({ ideas: rows as unknown as Idea[] });
  assert.deepEqual(list.map((i) => i.id), ['a', 'b', 'd']);
  assert.deepEqual((list[0] as Idea & { future?: unknown }).future, { x: 1 });
  assert.equal(list[1].category, 'other');
  assert.equal(list[2].lat, undefined);
  assert.equal(list[2].day, undefined);
  assert.equal(list[2].done, undefined);
});

test('links open only for http(s) web addresses', () => {
  assert.equal(webLink(' https://example.com/menu?x=1 '), 'https://example.com/menu?x=1');
  assert.equal(webLink('http://castle.jp'), 'http://castle.jp');
  assert.equal(isWebLink('HTTPS://EXAMPLE.ORG'), true);
  for (const bad of ['', 'example.com', 'ask at the hotel', 'javascript:alert(1)', 'file:///etc/passwd', 'tel:+81312345678', 'https://', 'https://exa mple.com', 'ftp://example.com', 'https://localhost', undefined]) {
    assert.equal(webLink(bad), null, String(bad));
  }
});

test('drafts: new, round trip, validation, unknown fields of the old idea kept', () => {
  const d = newIdeaDraft('2026-11-03', 'eat');
  assert.equal(d.category, 'eat');
  assert.deepEqual(validateIdea(d), ['name']);
  assert.deepEqual(validateIdea({ ...d, name: 'x', day: '2026-02-31' as string, pos: 'nowhere' }), ['day', 'pos']);
  const saved = ideaFromDraft({ ...d, name: '  Ramen bar ', note: ' tonkotsu ', link: ' https://ramen.example/ ', pos: '35.7,139.7', spotName: 'Shop' }, ids, undefined, NOW);
  assert.equal(saved.name, 'Ramen bar');
  assert.equal(saved.note, 'tonkotsu');
  assert.equal(saved.link, 'https://ramen.example/');
  assert.deepEqual([saved.lat, saved.lon, saved.spotName, saved.day], [35.7, 139.7, 'Shop', '2026-11-03']);
  assert.equal(saved.updatedAt, undefined);
  assert.equal(saved.createdAt, NOW);
  assert.ok(sameIdeaDraft(draftFromIdea(saved), { ...d, name: 'Ramen bar', note: 'tonkotsu', link: 'https://ramen.example/', pos: '35.7,139.7', spotName: 'Shop' }));

  const withExtra = { ...saved, future: 'keep me' } as Idea;
  const edited = ideaFromDraft({ ...draftFromIdea(withExtra), pos: '', day: '', note: '' }, ids, withExtra, '2026-11-01T00:00:00Z');
  assert.equal(edited.id, saved.id);
  assert.equal(edited.createdAt, NOW);
  assert.equal(edited.updatedAt, '2026-11-01T00:00:00Z');
  assert.equal((edited as Idea & { future?: string }).future, 'keep me');
  // clearing the spot also drops its name; clearing the day unplans it
  assert.deepEqual([edited.lat, edited.lon, edited.spotName, edited.day, edited.note], [undefined, undefined, undefined, undefined, undefined]);
});

test('add, plan, tick off and remove', () => {
  let t = trip();
  t = upsertIdea(t, idea('a'));
  t = upsertIdea(t, idea('bb', { category: 'eat' }));
  assert.equal(readIdeas(t).length, 2);
  t = planIdea(t, 'a', '2026-11-03', NOW);
  assert.equal(findIdea(t, 'a')?.day, '2026-11-03');
  t = planIdea(t, 'a', null, NOW);
  assert.equal(findIdea(t, 'a')?.day, undefined);
  t = setIdeaDone(t, 'bb', true, NOW);
  assert.equal(findIdea(t, 'bb')?.done, true);
  assert.deepEqual(ideaStats(t), { total: 2, planned: 0, done: 1 });
  t = setIdeaDone(t, 'bb', false, NOW);
  assert.equal(findIdea(t, 'bb')?.done, undefined);
  assert.equal(setIdeaDone(t, 'missing', true), t);
  t = removeIdea(t, 'a');
  assert.deepEqual(readIdeas(t).map((i) => i.id), ['bb']);
});

test('days: the timeline day keys, day numbers, and the journal day Been there offers', () => {
  const t = trip();
  assert.deepEqual(ideaDayKeys(t), ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05']);
  assert.equal(ideaDayNumber(t, '2026-11-03'), 3);
  assert.equal(ideaDayNumber(t, '2026-11-09'), null);
  assert.equal(ideaJournalDay(t, idea('a', { day: '2026-11-04' })), '2026-11-04');
  // unplanned: today on the trip where the traveller is, else its first day
  assert.equal(ideaJournalDay(t, idea('a'), toUtc({ local: '2026-11-03T12:00', tz: 'Asia/Tokyo' })), '2026-11-03');
  assert.equal(ideaJournalDay(t, idea('a'), toUtc({ local: '2026-10-01T12:00', tz: 'Asia/Tokyo' })), '2026-11-01');
});

test('the list: Unplanned first then by day, open before been-there, category filter', () => {
  const t = trip([
    idea('a', { day: '2026-11-03', category: 'eat' }),
    idea('bb', { done: true }),
    idea('ccc', { category: 'shop' }),
    idea('dddd', { day: '2026-11-02' }),
    idea('eeeee', { day: '2026-11-03', category: 'eat' }),
    idea('ffffff', { day: '2026-11-09' }),
  ]);
  const g = groupIdeas(t);
  assert.deepEqual(g.map((x) => x.key), ['unplanned', '2026-11-02', '2026-11-03', '2026-11-09']);
  assert.deepEqual(g[0].ideas.map((i) => i.id), ['ccc', 'bb']);
  assert.deepEqual([g[1].dayNumber, g[3].dayNumber], [2, null]);
  assert.deepEqual(groupIdeas(t, 'eat').map((x) => [x.key, x.ideas.length]), [['2026-11-03', 2]]);
  assert.deepEqual(groupIdeas(t, 'other'), []);
  assert.deepEqual(ideasOn(t, '2026-11-03').map((i) => i.id), ['a', 'eeeee']);
  assert.deepEqual(categoryCounts(t), { eat: 2, see: 3, do: 0, shop: 1, other: 0 });
  // the trip card: open unplanned first, then planned, been-there last
  assert.deepEqual(topIdeas(t, 3).map((i) => i.id), ['ccc', 'a', 'dddd']);
  assert.equal(topIdeas(t, 10).at(-1)?.id, 'bb');
});

test('See on map: planned ideas with a spot join their day after the bookings, only when asked', () => {
  const t = trip([
    idea('a', { day: '2026-11-02', lat: 35.71, lon: 139.79, category: 'eat' }),
    idea('bb', { day: '2026-11-02' }), // no spot
    idea('ccc', { lat: 35.7, lon: 139.7 }), // not planned
  ]);
  assert.deepEqual(plannedSpots(t).map((s) => s.ideaId), ['a']);
  const plain = tripRoute(t);
  assert.equal(plain.stopCount, 1);
  const r = tripRoute(t, { ideas: true });
  assert.equal(r.stopCount, 2);
  const day = r.days.find((d) => d.date === '2026-11-02')!;
  assert.deepEqual(day.stops.map((s) => [s.key, s.role, s.n]), [['h1:place', 'place', 1], ['idea:a', 'idea', 2]]);
  assert.equal(day.stops[1].ideaId, 'a');
  assert.equal(day.stops[1].category, 'eat');
  assert.equal(day.stops[1].itemId, '');
  assert.equal(day.legs.length, 1);
  assert.equal(routeView(r, '2026-11-02').framePoints.length, 2);
});

test('.satchel files: ideas travel with new ids; old files import fine; unknown fields kept; bad rows dropped', () => {
  const t = trip([idea('a', { day: '2026-11-02', lat: 35.71, lon: 139.79, link: 'https://x.example', note: 'n', done: true }), { ...idea('bb'), future: 7 } as Idea]);
  const { file } = buildTripFile(t, {}, { now: NOW });
  const text = JSON.stringify(file);
  const parsed = parseTripFileText(text);
  assert.ok(parsed.ok);
  if (!parsed.ok) return;
  assert.equal(parsed.file.trip.ideas?.length, 2);
  const imp = importTripFile(parsed.file, ids, NOW);
  const list = readIdeas(imp.trip);
  assert.equal(list.length, 2);
  assert.ok(list.every((i) => i.id !== 'a' && i.id !== 'bb'));
  assert.deepEqual([list[0].day, list[0].lat, list[0].link, list[0].note, list[0].done], ['2026-11-02', 35.71, 'https://x.example', 'n', true]);
  assert.equal((list[1] as Idea & { future?: number }).future, 7);

  // an older file without ideas
  const old = JSON.parse(text);
  delete old.trip.ideas;
  const p2 = parseTripFile(old);
  assert.ok(p2.ok);
  if (p2.ok) assert.equal(importTripFile(p2.file, ids, NOW).trip.ideas, undefined);

  // a file with some rows this build can't read: those are left out, the trip still imports
  const odd = JSON.parse(text);
  odd.trip.ideas = [{ nope: true }, { id: 'z', name: 'Kept', category: 'karaoke', createdAt: NOW }];
  const p3 = parseTripFile(odd);
  assert.ok(p3.ok);
  if (p3.ok) {
    const got = readIdeas(importTripFile(p3.file, ids, NOW).trip);
    assert.deepEqual(got.map((i) => [i.name, i.category]), [['Kept', 'other']]);
  }
  const notList = JSON.parse(text);
  notList.trip.ideas = 'x';
  const p4 = parseTripFile(notList);
  assert.ok(p4.ok);
  if (p4.ok) assert.equal(p4.file.trip.ideas, undefined);

  assert.equal(readFileIdeas(undefined), undefined);
  assert.equal(importIdeas([], ids), undefined);
});
