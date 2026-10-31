// T84 run-90 follow-ups: sample ideas on the demo trip, a day's ideas in the traveller's order (See on map numbers
// follow it), stable companion avatar tones, and tuned automatic covers.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { autoCover } from './covers.ts';
import { demoTrip } from './demo.ts';
import { DEMO_TRIP_ID, SAMPLE_IDEA_IDS, withSampleIdeas, withSampleSpending } from './demoExtras.ts';
import { companionToneIndex } from './followups90.ts';
import { canMoveIdea, draftFromIdea, findIdea, groupIdeas, ideaFromDraft, ideaSpot, ideasOn, isWebLink, moveIdea, planIdea, plannedSpots, readIdeas, type Idea } from './ideas.ts';
import type { Item, Trip } from './model.ts';
import { tripRoute } from './triproute.ts';
import { addDays } from './tz.ts';

const NOW = '2026-10-31T09:00:00.000Z';

// ---- 1. sample ideas ----

test('demo: sample ideas seed once, labelled sample, with a Tokyo day spot, a Kyoto day and a web link', () => {
  const base = withSampleSpending(demoTrip('2026-11-10', NOW), NOW);
  const t = withSampleIdeas(base, NOW);
  const list = readIdeas(t);
  assert.ok(list.length >= 3 && list.length <= 4);
  assert.deepEqual(list.map((i) => i.id), [...SAMPLE_IDEA_IDS]);
  for (const i of list) assert.match(i.name, /\(sample\)/);
  // planned for a demo day, with a spot near Tokyo or Kyoto
  const planned = list.filter((i) => i.day && ideaSpot(i));
  assert.ok(planned.length >= 1);
  const near = (i: Idea, lat: number, lon: number) => Math.abs(i.lat! - lat) < 0.2 && Math.abs(i.lon! - lon) < 0.2;
  assert.ok(planned.some((i) => near(i, 35.68, 139.77) || near(i, 35.01, 135.77)));
  for (const i of list) if (i.day) assert.ok(i.day >= t.startDate && i.day <= t.endDate);
  assert.ok(list.some((i) => isWebLink(i.link) && i.link!.startsWith('https://')));
  // on See on map, after the day's bookings
  const day1 = tripRoute(t, { ideas: true }).days.find((d) => d.date === addDays(t.startDate, 1))!;
  assert.deepEqual(day1.stops.map((s) => s.role), ['place', 'idea']);
  // idempotent; other trips and a demo trip with ideas of its own untouched; plain demoTrip has none
  assert.equal(withSampleIdeas(t), t);
  const mine = { ...base, id: 'mine', demo: false };
  assert.equal(withSampleIdeas(mine), mine);
  assert.equal(demoTrip('2026-11-10').ideas, undefined);
  assert.equal(t.id, DEMO_TRIP_ID);
});

test('demo: the app seeds the sample ideas on a fresh demo trip', () => {
  const src = readFileSync(new URL('../state/trips.tsx', import.meta.url), 'utf8');
  assert.match(src, /freshDemo = \(\) => withSampleIdeas\(/);
});

// ---- 3. order within a day ----

const DAY = '2026-11-03';
function ordered(): Trip {
  const items: Item[] = [
    { id: 'b1', tripId: 't', kind: 'activity', title: 'Museum', start: { local: `${DAY}T10:00`, tz: 'Asia/Tokyo' }, place: { id: 'p1', name: 'Museum', lat: 35.7, lon: 139.7 }, attachments: [] },
  ];
  const idea = (id: string, createdAt: string, spot = true, extra: Partial<Idea> = {}): Idea => ({
    id,
    name: id.toUpperCase(),
    category: 'see',
    day: DAY,
    createdAt,
    ...(spot ? { lat: 35.7 + createdAt.length / 1000, lon: 139.71 } : {}),
    ...extra,
  });
  return {
    id: 't',
    name: 'Tokyo',
    startDate: '2026-11-02',
    endDate: '2026-11-05',
    homeTz: 'Australia/Sydney',
    createdAt: NOW,
    items,
    ideas: [idea('a', '2026-10-01T00:00:00Z'), idea('b', '2026-10-02T00:00:00Z'), idea('nospot', '2026-10-02T12:00:00Z', false), idea('c', '2026-10-03T00:00:00Z'), idea('other', '2026-10-01T00:00:00Z', true, { day: '2026-11-04' })],
  };
}
const mapOrder = (t: Trip) => tripRoute(t, { ideas: true }).days.find((d) => d.date === DAY)!.stops.map((s) => `${s.n}:${s.ideaId ?? s.itemId}`);

test('order: without moves, a day keeps the added order; the map numbers ideas after the bookings', () => {
  const t = ordered();
  assert.deepEqual(ideasOn(t, DAY).map((i) => i.id), ['a', 'b', 'nospot', 'c']);
  assert.deepEqual(mapOrder(t), ['1:b1', '2:a', '3:b', '4:c']);
});

test('order: moving an idea stores the day order; the timeline, the list and the map follow it', () => {
  let t = moveIdea(ordered(), 'c', -1, (i) => ideaSpot(i) !== null, NOW);
  // skips past the idea without a spot, so the map really changes
  assert.deepEqual(ideasOn(t, DAY).map((i) => i.id), ['a', 'c', 'b', 'nospot']);
  assert.deepEqual(mapOrder(t), ['1:b1', '2:a', '3:c', '4:b']);
  t = moveIdea(t, 'c', -1, (i) => ideaSpot(i) !== null, NOW);
  assert.deepEqual(mapOrder(t), ['1:b1', '2:c', '3:a', '4:b']);
  assert.deepEqual(groupIdeas(t).find((g) => g.key === DAY)!.ideas.map((i) => i.id), ['c', 'a', 'b', 'nospot']);
  assert.deepEqual(plannedSpots(t).filter((s) => s.day === DAY).map((s) => s.ideaId), ['c', 'a', 'b']);
  assert.deepEqual(readIdeas(t).map((i) => [i.id, i.rank]), [['a', 1], ['b', 2], ['nospot', 3], ['c', 0], ['other', undefined]]);
  // first can't go up; the other day is untouched
  assert.equal(moveIdea(t, 'c', -1), t);
  assert.deepEqual(canMoveIdea(t, 'c'), { up: false, down: true });
  assert.deepEqual(canMoveIdea(t, 'b', (i) => ideaSpot(i) !== null), { up: true, down: false });
  assert.deepEqual(canMoveIdea(t, 'other'), { up: false, down: false });
  // move it back down
  t = moveIdea(t, 'c', 1, (i) => ideaSpot(i) !== null, NOW);
  assert.deepEqual(mapOrder(t), ['1:b1', '2:a', '3:c', '4:b']);
});

test('order: unplanned or unknown ideas do not move; a new idea on the day goes last', () => {
  const t = moveIdea(ordered(), 'c', -1);
  const unplanned = planIdea(t, 'a', null, NOW);
  assert.equal(moveIdea(unplanned, 'a', 1), unplanned);
  assert.equal(moveIdea(t, 'nope', 1), t);
  const added: Trip = { ...t, ideas: [...(t.ideas ?? []), { id: 'd', name: 'D', category: 'eat', day: DAY, createdAt: '2026-09-01T00:00:00Z', lat: 35.71, lon: 139.72 }] };
  assert.equal(ideasOn(added, DAY).at(-1)!.id, 'd');
});

test('order: the rank is cleared when the idea changes day, kept on other edits and in storage', () => {
  const t = moveIdea(ordered(), 'c', -1);
  const c = findIdea(t, 'c')!;
  assert.equal(c.rank, 2);
  // edit the name: rank kept
  const renamed = ideaFromDraft({ ...draftFromIdea(c), name: 'C2' }, () => 'x', c, NOW);
  assert.equal(renamed.rank, 2);
  // another day: cleared, in the editor and via planIdea
  assert.equal('rank' in ideaFromDraft({ ...draftFromIdea(c), day: '2026-11-04' }, () => 'x', c, NOW), false);
  assert.equal('rank' in findIdea(planIdea(t, 'c', '2026-11-04', NOW), 'c')!, false);
  assert.equal(findIdea(planIdea(t, 'c', DAY, NOW), 'c')!.rank, 2);
  // junk ranks and ranks on unplanned ideas are dropped when read
  const junk = readIdeas({ ideas: [{ ...c, rank: -1 }, { ...c, id: 'y', rank: 1.5 }, { ...c, id: 'z', rank: 'x' as unknown as number }, { ...c, id: 'u', day: undefined, rank: 1 }] });
  for (const i of junk) assert.equal('rank' in i, false, i.id);
  assert.equal(readIdeas(JSON.parse(JSON.stringify(t))).find((i) => i.id === 'c')!.rank, 2);
});

// ---- 4. companion tones ----

test('companion tones come from the id: stable across list changes, spread over the palette', () => {
  assert.equal(companionToneIndex('comp_1', 6), companionToneIndex('comp_1', 6));
  const seen = new Set<number>();
  for (let i = 0; i < 60; i++) {
    const k = companionToneIndex(`comp_${i}`, 6);
    assert.ok(k >= 0 && k < 6);
    seen.add(k);
  }
  assert.equal(seen.size, 6);
  assert.equal(companionToneIndex('x', 0), 0);
  const src = readFileSync(new URL('../ui/together.tsx', import.meta.url), 'utf8');
  assert.match(src, /companionToneIndex\(c\.id, COMPANION_TONES\.length\)/);
  assert.doesNotMatch(src, /COMPANION_TONES\[i %/);
});

// ---- 5 / 2. strings in the screens ----

test('settle-up explains the trip rates; idea chips use their own spoken strings', () => {
  const together = readFileSync(new URL('../ui/together.tsx', import.meta.url), 'utf8');
  assert.match(together, /f90\.settle\.ratesHelp/);
  const edit = readFileSync(new URL('../../app/idea-edit.tsx', import.meta.url), 'utf8');
  assert.match(edit, /f90\.ideaCat\.a11y/);
  const ideas = readFileSync(new URL('../ui/ideas.tsx', import.meta.url), 'utf8');
  assert.match(ideas, /f90\.ideaFilter\.catA11y/);
  assert.doesNotMatch(ideas + edit, /journal\.chip/);
});

// ---- 6. covers ----

function dest(tz: string, extra: Partial<Item> = {}, over: Partial<Trip> = {}): Trip {
  return {
    id: 'trip_cover',
    name: 'Holiday',
    startDate: '2026-05-01',
    endDate: '2026-05-08',
    homeTz: 'Australia/Sydney',
    createdAt: NOW,
    ...over,
    items: [{ id: 'h', tripId: 'trip_cover', kind: 'hotel', title: 'Hotel', start: { local: '2026-05-01T15:00', tz }, end: { local: '2026-05-05T11:00', tz }, attachments: [], ...extra } as Item],
  };
}

test('covers: a France / Paris trip without a hotel address gets the city, not the countryside', () => {
  assert.equal(autoCover(dest('Europe/Paris')), 'city');
  assert.equal(autoCover(dest('Europe/Paris', {}, { name: 'France 2027' })), 'city');
  // a named region or village still wins
  assert.equal(autoCover(dest('Europe/Paris', { place: { id: 'p', name: 'Mas des Oliviers', address: 'Gordes, Provence' } })), 'countryside');
  assert.equal(autoCover(dest('Europe/Paris', {}, { name: 'Normandy villages' })), 'countryside');
  assert.equal(autoCover(dest('Europe/Paris', { place: { id: 'p', name: 'Hotel', address: 'Quai, Marseille' } })), 'coast');
  assert.equal(autoCover(dest('Europe/Paris', { place: { id: 'p', name: 'Gîte', address: 'Lyon' } })), 'oldtown');
});

test('covers: a handful of destinations from the zone alone', () => {
  const cases: [string, string][] = [
    ['Europe/London', 'city'],
    ['America/New_York', 'city'],
    ['Asia/Bangkok', 'city'],
    ['Europe/Amsterdam', 'oldtown'],
    ['Europe/Prague', 'oldtown'],
    ['Europe/Rome', 'oldtown'],
    ['Asia/Dubai', 'desert'], // the country's look beats the skyline
    ['Pacific/Auckland', 'mountains'], // one zone for all of New Zealand
    ['Indian/Maldives', 'island'],
    ['Europe/Zurich', 'mountains'],
    ['Asia/Tokyo', 'city'],
  ];
  for (const [tz, scene] of cases) assert.equal(autoCover({ ...dest(tz), homeTz: 'Australia/Perth' }), scene, tz);
  // a Kyoto hotel still beats the Tokyo zone
  assert.equal(autoCover(dest('Asia/Tokyo', { place: { id: 'p', name: 'Inn', address: 'Gion, Kyoto' } })), 'oldtown');
});
