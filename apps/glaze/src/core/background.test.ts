import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BACKGROUNDS_VERSION,
  MAX_TINT,
  OVERLAY_GRAIN_DOTS,
  backgroundFor,
  defaultBackground,
  orphanedPhoto,
  overlayLayout,
  parseBackgrounds,
  photoFileName,
  referencedPhotoUris,
  sanitizeBackground,
  serializeBackgrounds,
  setBackground,
  usesPhoto,
  type ThemeBackground,
} from './background.ts';
import { THEMES } from './themes.ts';

const uri = 'file:///var/mobile/Containers/Data/Application/X/Documents/backgrounds/garden-abc.jpg';
const photo: ThemeBackground = {
  source: 'photo',
  photoUri: uri,
  imageW: 4032,
  imageH: 3024,
  transform: { scale: 2, offsetX: 0.5, offsetY: -0.25 },
  overlay: { tint: 0.3, grain: true, border: false },
};

test('default is the theme design with no overlay', () => {
  assert.deepEqual(defaultBackground(), { source: 'theme', overlay: { tint: 0, grain: false, border: false } });
  assert.deepEqual(backgroundFor({}, 'glaze'), defaultBackground());
});

test('round trip keeps a photo background exactly', () => {
  const state = setBackground({}, 'glaze', photo);
  const back = parseBackgrounds(serializeBackgrounds(state));
  assert.deepEqual(back, { glaze: photo });
  assert.equal(JSON.parse(serializeBackgrounds(state)).v, BACKGROUNDS_VERSION);
  assert.ok(usesPhoto(backgroundFor(back, 'glaze')));
});

test('bad input becomes the theme default', () => {
  for (const raw of [null, undefined, '', '{', '[]', '"x"', '42', 'null']) assert.deepEqual(parseBackgrounds(raw), {});
  assert.deepEqual(sanitizeBackground(null), defaultBackground());
  assert.deepEqual(sanitizeBackground('photo'), defaultBackground());
  // Photo chosen but the uri is missing / not a file / the size is junk → theme design.
  assert.equal(sanitizeBackground({ ...photo, photoUri: undefined }).source, 'theme');
  assert.equal(sanitizeBackground({ ...photo, photoUri: 'javascript:alert(1)' }).source, 'theme');
  assert.equal(sanitizeBackground({ ...photo, imageW: 0 }).source, 'theme');
  assert.equal(sanitizeBackground({ ...photo, imageH: NaN }).source, 'theme');
  assert.equal(sanitizeBackground({ ...photo, source: 'video' }).source, 'theme');
});

test('values are clamped: tint 0..0.6, transform in range, booleans strict', () => {
  const b = sanitizeBackground({
    ...photo,
    transform: { scale: 40, offsetX: -7, offsetY: 'x' },
    overlay: { tint: 5, grain: 'yes', border: 1 },
  });
  assert.deepEqual(b.transform, { scale: 5, offsetX: -1, offsetY: 0 });
  assert.deepEqual(b.overlay, { tint: MAX_TINT, grain: false, border: false });
  assert.equal(sanitizeBackground({ ...photo, overlay: { tint: -1 } }).overlay.tint, 0);
  assert.equal(sanitizeBackground({ ...photo, overlay: { tint: 0.30000000004 } }).overlay.tint, 0.3);
  assert.deepEqual(sanitizeBackground({ ...photo, transform: undefined }).transform, { scale: 1, offsetX: 0, offsetY: 0 });
});

test('switching back to the theme design keeps the photo for later', () => {
  const s1 = setBackground({}, 'glaze', photo);
  const s2 = setBackground(s1, 'glaze', { ...backgroundFor(s1, 'glaze'), source: 'theme' });
  const b = backgroundFor(parseBackgrounds(serializeBackgrounds(s2)), 'glaze');
  assert.equal(b.source, 'theme');
  assert.equal(b.photoUri, uri);
  assert.equal(usesPhoto(b), false);
});

test('defaults are dropped and bad theme ids ignored', () => {
  const s = setBackground(setBackground({}, 'glaze', photo), 'glaze', defaultBackground());
  assert.deepEqual(s, {});
  assert.deepEqual(setBackground({}, '../etc', photo), {});
  const parsed = parseBackgrounds(JSON.stringify({ v: 1, themes: { 'bad id!': photo, ok: photo } }));
  assert.deepEqual(Object.keys(parsed), ['ok']);
});

test('migration: unversioned map is read, unknown future version is not', () => {
  const legacy = JSON.stringify({ glaze: photo, dusk: { source: 'theme', overlay: { tint: 0.2 } } });
  const m = parseBackgrounds(legacy);
  assert.deepEqual(m.glaze, photo);
  assert.deepEqual(m.dusk, { source: 'theme', overlay: { tint: 0.2, grain: false, border: false } });
  assert.deepEqual(parseBackgrounds(JSON.stringify({ v: 99, themes: { glaze: photo } })), {});
  assert.deepEqual(parseBackgrounds(JSON.stringify({ v: 1, themes: 'nope' })), {});
});

test('keyed by theme: each theme keeps its own photo', () => {
  let s = setBackground({}, THEMES[0].id, photo);
  s = setBackground(s, THEMES[1].id, { ...photo, photoUri: uri.replace('garden', 'cat') });
  assert.notEqual(backgroundFor(s, THEMES[0].id).photoUri, backgroundFor(s, THEMES[1].id).photoUri);
  assert.equal(referencedPhotoUris(s).size, 2);
});

test('old copy is orphaned only once nothing references it', () => {
  const other = uri.replace('garden', 'cat');
  const shared = { a: photo, b: { ...photo } };
  const replaced = setBackground(shared, 'a', { ...photo, photoUri: other });
  assert.equal(orphanedPhoto(uri, replaced), null, 'theme b still uses it');
  const both = setBackground(replaced, 'b', { ...photo, photoUri: other });
  assert.equal(orphanedPhoto(uri, both), uri);
  assert.equal(orphanedPhoto(undefined, both), null);
});

test('photoFileName is safe and keeps the extension', () => {
  assert.equal(photoFileName('glaze', 36, 'file:///tmp/IMG_1.HEIC'), 'glaze-10.heic');
  assert.equal(photoFileName('../x', 0, 'file:///tmp/a'), 'theme-0.jpg');
  assert.match(photoFileName('dusk', Date.now(), 'ph://abc.png?x=1'), /^dusk-[a-z0-9]+\.png$/);
});

test('overlay layout: tint in the theme colour, border and grain proportional', () => {
  const pal = THEMES[0].palette;
  const none = overlayLayout({ tint: 0, grain: false, border: false }, pal, 100, 200);
  assert.deepEqual(none, { tint: null, border: null, grain: [] });
  const all = overlayLayout({ tint: 0.4, grain: true, border: true }, pal, 100, 200);
  assert.deepEqual(all.tint, { colour: pal.accent.toUpperCase(), opacity: 0.4 });
  assert.equal(all.grain.length, OVERLAY_GRAIN_DOTS);
  for (const d of all.grain) assert.ok(d.cx >= 0 && d.cx <= 100 && d.cy >= 0 && d.cy <= 200);
  assert.ok(all.border && all.border.inner.inset > all.border.outer.inset);
  // Same drawing at 10× size scales by 10 (preview matches export).
  const big = overlayLayout({ tint: 0.4, grain: true, border: true }, pal, 1000, 2000);
  assert.ok(Math.abs((big.border?.outer.inset ?? 0) - (all.border?.outer.inset ?? 0) * 10) < 0.1);
  assert.ok(Math.abs(big.grain[5].cx - all.grain[5].cx * 10) < 0.2);
  // Broken palette colours fall back instead of drawing nothing.
  assert.ok(overlayLayout({ tint: 0.2, grain: false, border: false }, { bg: 'x', surface: 'y', accent: 'z' }, 10, 10).tint);
});
