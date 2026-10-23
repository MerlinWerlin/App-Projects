import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COLLAGE_DRAFT_KEY,
  applyCopies,
  collageClockInk,
  collageDir,
  isOwnCopy,
  parseCollageDraft,
  photoExtension,
  planCollageCopies,
  resolveCollageUri,
  restoreCollageDraft,
  serializeCollageDraft,
  staleCollageCopies,
  type CollageDraft,
} from './collageStore.ts';

const DOC = 'file:///var/mobile/Containers/Data/Application/AAA/Documents/';
const DIR = `${DOC}collage/`;
const CACHE = 'file:///var/mobile/Containers/Data/Application/AAA/Library/Caches/ImagePicker/';

const picked = [
  { uri: `${CACHE}one.HEIC`, width: 3024, height: 4032 },
  { uri: `${CACHE}two.jpg?x=1`, width: 4032, height: 3024 },
  { uri: `${CACHE}three`, width: 1200, height: 1600 },
];

test('collageDir appends collage/ to the documents folder', () => {
  assert.equal(collageDir(DOC), DIR);
  assert.equal(collageDir(DOC.slice(0, -1)), DIR);
  assert.equal(collageDir(null), null);
  assert.equal(COLLAGE_DRAFT_KEY, 'glaze.collage.draft.v1');
});

test('photoExtension reads the extension, lower-case, default jpg', () => {
  assert.equal(photoExtension(`${CACHE}one.HEIC`), 'heic');
  assert.equal(photoExtension(`${CACHE}two.jpg?x=1`), 'jpg');
  assert.equal(photoExtension(`${CACHE}three`), 'jpg');
});

test('planCollageCopies copies every picked photo into the documents folder, never the cache', () => {
  const plan = planCollageCopies(picked, DIR, '1729300000000');
  assert.deepEqual(
    plan.map((s) => s.to),
    [`${DIR}1729300000000-0.heic`, `${DIR}1729300000000-1.jpg`, `${DIR}1729300000000-2.jpg`],
  );
  for (const s of plan) assert.ok(s.to && s.to.startsWith(DIR) && !s.to.startsWith(CACHE));
});

test('planCollageCopies keeps photos that are already our copies and sanitises the stamp', () => {
  const plan = planCollageCopies([{ uri: `${DIR}old-0.jpg`, width: 10, height: 10 }, picked[0]], DIR, '12:3/4');
  assert.equal(plan[0].to, `${DIR}old-0.jpg`);
  assert.equal(plan[1].to, `${DIR}1234-1.heic`);
  assert.ok(isOwnCopy(`${DIR}x.jpg`, DIR));
  assert.ok(!isOwnCopy(`${CACHE}x.jpg`, DIR));
  assert.ok(!isOwnCopy(`${DIR}x.jpg`, null));
});

test('planCollageCopies without a documents folder keeps the originals', () => {
  assert.deepEqual(planCollageCopies(picked, null, '1').map((s) => s.to), [null, null, null]);
});

test('applyCopies takes successful copies and keeps the original on a failed copy', () => {
  const out = applyCopies(picked, [`${DIR}a.heic`, null, `${DIR}c.jpg`]);
  assert.deepEqual(out.map((p) => p.uri), [`${DIR}a.heic`, picked[1].uri, `${DIR}c.jpg`]);
  assert.equal(out[0].width, 3024);
  assert.notEqual(out[0], picked[0]);
});

test('a cleared picker cache does not break a saved collage (D82-1)', () => {
  // Pick, copy into app storage, save the draft.
  const plan = planCollageCopies(picked, DIR, '42');
  const photos = applyCopies(picked, plan.map((s) => s.to));
  const raw = serializeCollageDraft({ photos, layoutId: 'grid-3', spacing: 'wide', themeId: 'peach' });
  // iOS purges the picker cache: only files in our documents folder still exist.
  const files = new Set(photos.map((p) => p.uri));
  const exists = (uri: string) => !uri.startsWith(CACHE) && files.has(uri);
  const draft = parseCollageDraft(raw);
  assert.ok(draft);
  const res = restoreCollageDraft(draft, DIR, exists);
  assert.equal(res.missing, 0);
  assert.ok(res.draft);
  assert.equal(res.draft.photos.length, 3);
  assert.equal(res.draft.layoutId, 'grid-3');
  assert.equal(res.draft.spacing, 'wide');
  assert.equal(res.draft.themeId, 'peach');
  for (const p of res.draft.photos) assert.ok(p.uri.startsWith(DIR));
});

test('without copies the same purge would lose the collage (why T97 exists)', () => {
  const raw = serializeCollageDraft({ photos: picked, layoutId: 'grid-3', spacing: 'thin', themeId: null });
  const draft = parseCollageDraft(raw);
  assert.ok(draft);
  const res = restoreCollageDraft(draft, DIR, (uri) => !uri.startsWith(CACHE));
  assert.equal(res.draft, null);
  assert.equal(res.missing, 3);
});

test('restoreCollageDraft re-points copies after iOS moves the app container', () => {
  const moved = 'file:///var/mobile/Containers/Data/Application/OLD/Documents/collage/42-0.jpg';
  assert.equal(resolveCollageUri(moved, DIR), `${DIR}42-0.jpg`);
  assert.equal(resolveCollageUri(`${CACHE}a.jpg`, DIR), `${CACHE}a.jpg`);
  assert.equal(resolveCollageUri(moved, null), moved);
  const draft: CollageDraft = {
    photos: [
      { uri: moved, width: 10, height: 10 },
      { uri: moved.replace('42-0', '42-1'), width: 10, height: 10 },
    ],
    layoutId: 'strips-2',
    spacing: 'none',
    themeId: null,
  };
  const res = restoreCollageDraft(draft, DIR, (u) => u.startsWith(DIR));
  assert.deepEqual(res.draft?.photos.map((p) => p.uri), [`${DIR}42-0.jpg`, `${DIR}42-1.jpg`]);
});

test('restoreCollageDraft drops missing photos and gives up below two', () => {
  const draft: CollageDraft = {
    photos: [0, 1, 2].map((i) => ({ uri: `${DIR}s-${i}.jpg`, width: 10, height: 10 })),
    layoutId: 'grid-3',
    spacing: 'thin',
    themeId: null,
  };
  const two = restoreCollageDraft(draft, DIR, (u) => !u.endsWith('s-1.jpg'));
  assert.equal(two.missing, 1);
  assert.equal(two.draft?.photos.length, 2);
  const one = restoreCollageDraft(draft, DIR, (u) => u.endsWith('s-0.jpg'));
  assert.equal(one.draft, null);
  assert.equal(one.missing, 2);
});

test('parseCollageDraft rejects junk and repairs fields', () => {
  assert.equal(parseCollageDraft(null), null);
  assert.equal(parseCollageDraft(''), null);
  assert.equal(parseCollageDraft('{'), null);
  assert.equal(parseCollageDraft('[]'), null);
  assert.equal(parseCollageDraft(JSON.stringify({ v: 2, photos: [] })), null);
  const one = JSON.stringify({ v: 1, photos: [{ uri: 'a', width: 1, height: 1 }] });
  assert.equal(parseCollageDraft(one), null);
  const odd = parseCollageDraft(
    JSON.stringify({
      v: 1,
      photos: [
        { uri: 'a', width: 1.4, height: 2.6 },
        { uri: '', width: 1, height: 1 },
        { uri: 'b', width: -1, height: 1 },
        { uri: 'c', width: 3, height: 3 },
        ...Array.from({ length: 8 }, (_, i) => ({ uri: `x${i}`, width: 5, height: 5 })),
      ],
      layoutId: 7,
      spacing: 'huge',
      themeId: 3,
    }),
  );
  assert.ok(odd);
  assert.equal(odd.photos.length, 6);
  assert.deepEqual(odd.photos[0], { uri: 'a', width: 1, height: 3 });
  assert.equal(odd.photos[1].uri, 'c');
  assert.equal(odd.layoutId, '');
  assert.equal(odd.spacing, 'thin');
  assert.equal(odd.themeId, null);
});

test('serializeCollageDraft keeps at most six photos and round-trips', () => {
  const photos = Array.from({ length: 8 }, (_, i) => ({ uri: `${DIR}p${i}.jpg`, width: 9, height: 16 }));
  const d = parseCollageDraft(serializeCollageDraft({ photos, layoutId: 'hero-6', spacing: 'none', themeId: 't' }));
  assert.ok(d);
  assert.equal(d.photos.length, 6);
  assert.equal(d.layoutId, 'hero-6');
});

test('staleCollageCopies lists only files the draft no longer uses', () => {
  const keep = [
    { uri: `${DIR}9-0.jpg`, width: 1, height: 1 },
    { uri: `${CACHE}x.jpg`, width: 1, height: 1 },
  ];
  assert.deepEqual(staleCollageCopies(['9-0.jpg', '8-0.jpg', '8-1.heic', '', 'sub/a.jpg'], DIR, keep), ['8-0.jpg', '8-1.heic']);
});

test('collageClockInk stays white on dark or mid backgrounds and turns dark on very light ones', () => {
  assert.equal(collageClockInk({ from: '#101018', to: '#2A1B3D' }).ink, '#FFFFFF');
  assert.equal(collageClockInk({ from: '#E86A92', to: '#7A4FD0' }).ink, '#FFFFFF');
  const light = collageClockInk({ from: '#FFF8E7', to: '#FDEFF4' });
  assert.equal(light.ink, '#1C1C1E');
  assert.match(light.shadow, /255,255,255/);
});
