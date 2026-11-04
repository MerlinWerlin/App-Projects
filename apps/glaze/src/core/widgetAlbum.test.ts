import { test } from 'node:test';
import assert from 'node:assert/strict';
import { albumNames, albumIndex, orphanedAlbumPhotos } from './widgetAlbum.ts';
import { nativeWidgetSupported, requiredNativeWidgetVersion } from './widgetDelivery.ts';
import { THEMES } from './themes.ts';
import { generateWidgetSet } from './widgetSets.ts';
import { initialStudioState, selectCatalogueWidget, updateCatalogueDraft, serialiseStudioState, parseStudioState,
  currentCatalogueDraft, studioCatalogue, studioCataloguePayload } from './widgetStudio.ts';
const local = 'pick-12345678-1234-1234-1234-123456789abc.jpg';
const ref = `album-${'a'.repeat(40)}.jpg`;

test('album drafts survive restart and publish shared references without exposing private paths', () => {
  const set = generateWidgetSet(THEMES[0]);
  let state = selectCatalogueWidget(initialStudioState(set), 'photoAlbum', 'medium');
  state = updateCatalogueDraft(state, { albumPhotos: [local], rotateMinutes: 180, text: { caption: 'Our mountains' } });
  state = updateCatalogueDraft(state, { photoRefs: [ref] });
  const restored = parseStudioState(serialiseStudioState(state), set);
  assert.ok(restored);
  assert.deepEqual(currentCatalogueDraft(restored).albumPhotos, [local]);
  assert.deepEqual(currentCatalogueDraft(restored).photoRefs, [ref]);
  const payload = studioCataloguePayload(set, studioCatalogue(set), restored);
  const album = JSON.parse(payload).catalogue.specs.find((s: {kind: string; size: string}) => s.kind === 'photoAlbum' && s.size === 'medium');
  assert.deepEqual(album.photoRefs, [ref]);
  assert.equal(album.rotateMinutes, 180);
  assert.ok(!payload.includes(local));
  const replaced = updateCatalogueDraft(restored, { albumPhotos: [] });
  assert.deepEqual(currentCatalogueDraft(replaced).photoRefs, []);
  assert.deepEqual(currentCatalogueDraft(restored).photoRefs, [ref]);
});
test('only bounded owned photo names are accepted, never paths, URLs or stale arbitrary names', () => {
  assert.deepEqual(albumNames([local, local, '../x.jpg', 'file:///private/pic.jpg', ref, null]), [local]);
  assert.deepEqual(albumNames([ref, ref, local, `album-${'a'.repeat(40)}.jpg\n`], true), [ref]);
  const many = Array.from({length: 30}, (_, i) => `album-${i.toString(16).padStart(40, '0')}.jpg`);
  assert.equal(albumNames(many, true).length, 12);
});
test('rotation changes at interval boundaries, wraps, and is independent of locale and DST', () => {
  for (const minutes of [15, 30, 60, 180, 360, 720, 1440]) {
    const boundary = new Date(minutes * 60000 * 4);
    assert.equal(albumIndex(new Date(+boundary - 1), minutes, 3), 0);
    assert.equal(albumIndex(boundary, minutes, 3), 1);
    assert.equal(albumIndex(new Date(-1), minutes, 3), 2);
    assert.equal(albumIndex(boundary, minutes, 0), 0);
  }
  assert.equal(albumIndex(new Date(NaN), 15, 3), 0);
  for (const size of ['small','medium','large']) {
    assert.ok(nativeWidgetSupported('photoAlbum', size));
    assert.equal(requiredNativeWidgetVersion('photoAlbum', size), 4);
  }
  assert.equal(nativeWidgetSupported('photoAlbum', 'accessoryCircular'), false);
});
test('album cleanup keeps copies used by other sizes or themes and ignores foreign filenames', () => {
  const owned = {catalogueDrafts: {medium: {albumPhotos: [local, '../secret.jpg']}}};
  assert.deepEqual(orphanedAlbumPhotos({one: owned}, {two: JSON.stringify(owned)}), []);
  assert.deepEqual(orphanedAlbumPhotos({one: owned}, {}), [local]);
  assert.deepEqual(orphanedAlbumPhotos({bad: 'invalid JSON'}, {}), []);
});
