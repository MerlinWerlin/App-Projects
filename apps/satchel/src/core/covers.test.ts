import assert from 'node:assert/strict';
import { test } from 'node:test';
import { COVER_ART, COVER_H, COVER_PAINTS, COVER_W, MAX_SHAPES, sceneShapes } from './coverArt.ts';
import { autoCover, COVER_CITIES, COVER_COUNTRIES, COVER_SCENES, coverScores, fallbackCover, foldWords, hashString, isCoverId, readCover, tripCover, withCover } from './covers.ts';
import { demoTrip } from './demo.ts';
import type { Item, Trip } from './model.ts';
import { buildTripFile, importTripFile, parseTripFile, parseTripFileText } from './tripfile.ts';
import { parseStoredTrips, tripFromDraft } from './trips.ts';

const NOW = '2026-10-31T09:00:00.000Z';

function trip(over: Partial<Trip> = {}, items: Partial<Item>[] = []): Trip {
  return {
    id: 'trip_test',
    name: 'Holiday',
    startDate: '2026-05-01',
    endDate: '2026-05-08',
    homeTz: 'Europe/London',
    createdAt: NOW,
    ...over,
    items: items.map((i, n) => ({
      id: `i${n}`,
      tripId: 'trip_test',
      kind: 'hotel',
      title: 'Stay',
      start: { local: '2026-05-01T15:00', tz: 'Europe/London' },
      attachments: [],
      ...i,
    })) as Item[],
  };
}
const stay = (tz: string, extra: Partial<Item> = {}): Partial<Item> => ({ kind: 'hotel', title: 'Hotel', start: { local: '2026-05-01T15:00', tz }, end: { local: '2026-05-05T11:00', tz }, ...extra });

test('scene ids: eight, unique, known to isCoverId', () => {
  assert.equal(COVER_SCENES.length, 8);
  assert.equal(new Set(COVER_SCENES).size, 8);
  for (const id of COVER_SCENES) assert.ok(isCoverId(id));
  for (const bad of ['', 'City', 'beach', 3, null, undefined, {}]) assert.equal(isCoverId(bad), false);
});

test('tables only point at known scenes', () => {
  for (const v of Object.values(COVER_CITIES)) assert.ok(isCoverId(v));
  for (const [k, v] of Object.entries(COVER_COUNTRIES)) {
    assert.match(k, /^[A-Z]{2}$/);
    assert.ok(isCoverId(v));
  }
  for (const k of Object.keys(COVER_CITIES)) assert.equal(foldWords(k).trim(), k, `${k} is folded`);
});

test('foldWords: accents, case and punctuation', () => {
  assert.equal(foldWords('Zürich & São-Paulo!'), ' zurich sao paulo ');
});

test('trip name keywords win', () => {
  assert.equal(autoCover(trip({ name: 'Ski week' })), 'snow');
  assert.equal(autoCover(trip({ name: 'Beach break' })), 'coast');
  assert.equal(autoCover(trip({ name: 'Island hopping' })), 'island');
  assert.equal(autoCover(trip({ name: 'Desert safari' })), 'desert');
  assert.equal(autoCover(trip({ name: 'Wine & villages' })), 'countryside');
  assert.equal(autoCover(trip({ name: 'Medieval castles' })), 'oldtown');
  assert.equal(autoCover(trip({ name: 'Hiking the Alps' })), 'mountains');
  // the name beats the destination country
  assert.equal(autoCover(trip({ name: 'Ski trip' }, [stay('Asia/Dubai')])), 'snow');
  // whole words only: "bayside" is not "bay", "seaside" is coast
  assert.notEqual(coverScores(trip({ name: 'Bayswater' })).coast, 8);
});

test('Japan splits by city: Tokyo is a skyline, Kyoto an old town', () => {
  assert.equal(autoCover(trip({ name: 'Japan' }, [stay('Asia/Tokyo')])), 'city');
  assert.equal(autoCover(trip({ name: 'Japan' }, [stay('Asia/Tokyo', { place: { id: 'p', name: 'Ryokan', address: 'Higashiyama, Kyoto, Japan' } })])), 'oldtown');
  assert.equal(autoCover(trip({ name: 'Kyoto' })), 'oldtown');
});

test('country table: mountains, islands, desert', () => {
  assert.equal(autoCover(trip({}, [stay('Pacific/Auckland')])), 'mountains'); // the zone covers all of New Zealand
  assert.equal(autoCover(trip({}, [stay('Pacific/Auckland', { place: { id: 'p', name: 'Harbour hotel', address: '1 Queen St, Auckland' } })])), 'city');
  assert.equal(autoCover(trip({}, [stay('Europe/Zurich')])), 'mountains');
  assert.equal(autoCover(trip({}, [stay('Indian/Maldives')])), 'island');
  assert.equal(autoCover(trip({}, [stay('Asia/Qatar')])), 'desert');
  assert.equal(autoCover(trip({}, [stay('Africa/Casablanca')])), 'desert');
  assert.equal(autoCover(trip({}, [stay('Atlantic/Reykjavik')])), 'snow');
  assert.equal(autoCover(trip({}, [stay('Europe/Rome')])), 'oldtown');
});

test('a mountain country in its winter becomes snow (south: June-August)', () => {
  const zurich = (startDate: string, endDate: string) => trip({ startDate, endDate }, [stay('Europe/Zurich')]);
  assert.equal(autoCover(zurich('2026-01-10', '2026-01-17')), 'snow');
  assert.equal(autoCover(zurich('2026-07-10', '2026-07-17')), 'mountains');
  assert.equal(autoCover(zurich('2026-11-25', '2026-12-03')), 'snow');
  const nz = (startDate: string, endDate: string) => trip({ name: 'NZ', startDate, endDate }, [stay('Pacific/Auckland')]);
  assert.equal(autoCover(nz('2026-07-01', '2026-07-10')), 'snow');
  assert.equal(autoCover(nz('2026-01-01', '2026-01-10')), 'mountains');
});

test('the home zone does not count', () => {
  const t = trip({ homeTz: 'Asia/Dubai', name: 'Trip' }, [stay('Asia/Dubai')]);
  assert.deepEqual(Object.values(coverScores(t)).filter((n) => n > 0), []);
});

test('fallback: deterministic hash of the trip id, spread over every scene', () => {
  assert.equal(hashString('abc'), hashString('abc'));
  assert.notEqual(hashString('abc'), hashString('abd'));
  const t = trip({ id: 'trip_xyz', name: 'Trip' });
  assert.equal(autoCover(t), fallbackCover('trip_xyz'));
  assert.equal(autoCover(t), autoCover({ ...t }));
  const seen = new Set<string>();
  for (let i = 0; i < 200; i++) seen.add(fallbackCover(`trip_${i}`));
  assert.equal(seen.size, 8);
  assert.ok(isCoverId(fallbackCover('')));
});

test('user choice overrides; unknown ids are ignored', () => {
  const t = trip({ name: 'Ski week' });
  assert.equal(tripCover({ ...t, cover: 'desert' }), 'desert');
  assert.equal(tripCover({ ...t, cover: 'volcano' }), 'snow');
  assert.equal(tripCover({ ...t, cover: '' }), 'snow');
  assert.equal(withCover(t, 'island').cover, 'island');
  assert.equal('cover' in withCover({ ...t, cover: 'island' }, null), false);
  assert.equal('cover' in withCover(t, 'volcano'), false);
});

test('readCover keeps plain ids only', () => {
  assert.equal(readCover('island'), 'island');
  assert.equal(readCover('volcano-2'), 'volcano-2');
  for (const bad of [3, null, '', 'Island', '<b>', 'x'.repeat(40), { id: 'city' }]) assert.equal(readCover(bad), undefined);
});

test('editing a trip keeps its cover', () => {
  const prev = { ...trip(), cover: 'coast' };
  const edited = tripFromDraft({ name: 'Renamed', startDate: prev.startDate, endDate: prev.endDate, homeTz: prev.homeTz }, prev, NOW);
  assert.equal(edited.cover, 'coast');
  assert.equal('cover' in tripFromDraft({ name: 'New', startDate: '2026-01-01', endDate: '2026-01-02', homeTz: 'UTC' }), false);
});

test('stored trips keep the cover', () => {
  const t = { ...trip(), cover: 'snow' };
  assert.equal(parseStoredTrips(JSON.stringify([t]))?.[0].cover, 'snow');
});

test('.satchel export and import keep the cover; junk is dropped without refusing the file', () => {
  const t: Trip = { ...demoTrip('2026-11-01', NOW), cover: 'island' };
  const { file } = buildTripFile(t, {}, { now: NOW });
  assert.equal(file.trip.cover, 'island');
  const parsed = parseTripFileText(JSON.stringify(file));
  assert.ok(parsed.ok);
  if (!parsed.ok) return;
  assert.equal(parsed.file.trip.cover, 'island');
  let n = 0;
  const imported = importTripFile(parsed.file, (p) => `${p}_${n++}`, NOW);
  assert.equal(imported.trip.cover, 'island');
  assert.equal(tripCover(imported.trip), 'island');
  // a scene from a newer Satchel is kept but shows the automatic cover here
  const newer = parseTripFile({ ...file, trip: { ...file.trip, cover: 'volcano' } });
  assert.ok(newer.ok && newer.file.trip.cover === 'volcano');
  if (newer.ok) assert.equal(tripCover({ ...t, cover: newer.file.trip.cover }), autoCover(t));
  const junk = parseTripFile({ ...file, trip: { ...file.trip, cover: { evil: true } } });
  assert.ok(junk.ok);
  if (junk.ok) assert.equal('cover' in junk.file.trip, false);
  // older files without a cover import as before
  const { cover: _c, ...noCover } = file.trip;
  const old = parseTripFile({ ...file, trip: noCover });
  assert.ok(old.ok && !('cover' in old.file.trip));
});

test('art: every scene stays small, inside the canvas, and uses palette slots only', () => {
  const slots = new Set<string>(COVER_PAINTS);
  for (const id of COVER_SCENES) {
    const art = COVER_ART[id];
    assert.ok(art, id);
    for (const dark of [false, true]) {
      const shapes = sceneShapes(id, dark);
      assert.ok(shapes.length >= 5 && shapes.length + 3 <= MAX_SHAPES, `${id} ${shapes.length}`);
      for (const s of shapes) {
        assert.ok(s.fill || s.stroke, `${id} shape paints something`);
        if (s.fill) assert.ok(slots.has(s.fill));
        if (s.stroke) assert.ok(slots.has(s.stroke));
        if (s.k === 'path') {
          assert.doesNotMatch(s.d, /NaN|undefined/);
          assert.ok(s.d.length < 4000, `${id} path is light`);
        }
      }
    }
    // the sun / moon sits inside the part every crop keeps
    assert.ok(art.sun.cx - art.sun.r >= 40 && art.sun.cx + art.sun.r <= COVER_W - 40, `${id} sun x`);
    assert.ok(art.sun.cy - art.sun.r >= 66 && art.sun.cy + art.sun.r <= COVER_H, `${id} sun y`);
  }
  // stars only at night
  assert.ok(sceneShapes('city', true).length > sceneShapes('city', false).length);
});

test('tokens: a day and a night palette for every scene, every slot a hex colour', async () => {
  const { coverPalettes } = await import('../theme/tokens.ts');
  for (const mode of ['light', 'dark'] as const)
    for (const id of COVER_SCENES) for (const slot of COVER_PAINTS) assert.match(coverPalettes[mode][id][slot], /^#[0-9A-F]{6}$/, `${mode} ${id} ${slot}`);
  // the two versions really differ (night is not just the day palette)
  for (const id of COVER_SCENES) assert.notEqual(coverPalettes.light[id].sky0, coverPalettes.dark[id].sky0);
});
