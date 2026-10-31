// T80: old Widget Studio photo copies are cleaned up once no theme's studio uses them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { THEMES } from './themes.ts';
import { generateWidgetSet } from './widgetSets.ts';
import {
  initialStudioState,
  orphanedStudioPhotos,
  resetDraft,
  serialiseStudioState,
  studioPhotoUris,
  updateDraft,
} from './widgetStudio.ts';

const SET = generateWidgetSet(THEMES[0]);
const A = 'file:///docs/backgrounds/a-1.jpg';
const B = 'file:///docs/backgrounds/b-2.jpg';

function entry(uri: string | null): unknown {
  let s = initialStudioState(SET, 'photo', 'medium');
  if (uri) s = updateDraft(SET, s, { background: { kind: 'photo', uri } });
  return JSON.parse(serialiseStudioState(s)) as unknown;
}

test('studioPhotoUris reads the photo backgrounds of a stored entry and tolerates junk', () => {
  assert.deepEqual(studioPhotoUris(entry(A)), [A]);
  assert.deepEqual(studioPhotoUris(JSON.stringify(entry(A))), [A]);
  assert.deepEqual(studioPhotoUris(entry(null)), []);
  for (const junk of [null, 1, 'nope', [], { drafts: 3 }, { drafts: { x: { background: { kind: 'photo', uri: 'https://x/y.jpg' } } } }]) {
    assert.deepEqual(studioPhotoUris(junk), []);
  }
});

test('a replaced photo is orphaned; one still used anywhere is kept', () => {
  const id = SET.themeId;
  assert.deepEqual(orphanedStudioPhotos({ [id]: entry(A) }, { [id]: entry(B) }), [A]);
  assert.deepEqual(orphanedStudioPhotos({ [id]: entry(A) }, { [id]: entry(A) }), []);
  // Another theme's studio still uses it.
  assert.deepEqual(orphanedStudioPhotos({ [id]: entry(A) }, { [id]: entry(B), other: entry(A) }), []);
  // A wallpaper background points at it.
  assert.deepEqual(orphanedStudioPhotos({ [id]: entry(A) }, { [id]: entry(B) }, [A]), []);
});

test('reset drops the photo copy; files outside the backgrounds folder are never returned', () => {
  const id = SET.themeId;
  let s = initialStudioState(SET, 'photo', 'medium');
  s = updateDraft(SET, s, { background: { kind: 'photo', uri: A } });
  const before = JSON.parse(serialiseStudioState(s)) as unknown;
  const after = JSON.parse(serialiseStudioState(resetDraft(SET, s))) as unknown;
  assert.deepEqual(orphanedStudioPhotos({ [id]: before }, { [id]: after }), [A]);
  const outside = 'file:///docs/other/a.jpg';
  assert.deepEqual(orphanedStudioPhotos({ [id]: entry(outside) }, { [id]: entry(null) }), []);
});

test('the store deletes orphans only after the new state is written, keeping wallpaper photos', () => {
  const src = readFileSync(new URL('../store/widgetStudio.ts', import.meta.url), 'utf8');
  const write = src.indexOf('AsyncStorage.setItem(STUDIO_STORAGE_KEY');
  const clean = src.indexOf('await cleanUpPhotos(prev, all)');
  assert.ok(write > 0 && clean > write);
  assert.match(src, /referencedPhotoUris\(await loadBackgrounds\(\)\)/);
  assert.match(src, /removePhotoCopy\(uri\)/);
});
