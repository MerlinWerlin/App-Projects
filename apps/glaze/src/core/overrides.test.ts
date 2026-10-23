// Per-app icon overrides keyed by app + theme, the custom-image library and the v1 -> v2 migration.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_THEMES_KEY,
  DEFAULT_STYLE,
  NO_THEME_KEY,
  STUDIO_STORE_VERSION,
  addApps,
  addImage,
  applyToAllThemes,
  customisedAppIds,
  defaultStudioState,
  deleteCustomApp,
  deleteImage,
  effectiveOverride,
  imagesInUse,
  isCustomised,
  keepOnlyInTheme,
  libraryImages,
  mapImageUris,
  parseStudioState,
  restoreThemeArtwork,
  serializeStudioState,
  setOverride,
  setThemeOverride,
  specsForTheme,
  studioSpecs,
  usesAllThemes,
  type StudioState,
} from './studio.ts';

const IMG_A = 'file:///doc/icons/clash-1760000000000.png';
const IMG_B = 'file:///doc/icons/clash-1760000000999.png';
const T0 = 1760000000000;

function base(themeId: string | null = 'floral'): StudioState {
  return { ...addApps(defaultStudioState(), ['camera', 'spotify', 'mail']), themeId };
}

test('store version is 2', () => {
  assert.equal(STUDIO_STORE_VERSION, 2);
  assert.match(serializeStudioState(defaultStudioState()), /"version":2/);
});

test('precedence: theme override > all-themes override > theme style', () => {
  let s = base('floral');
  // Nothing set: the theme style shows.
  assert.equal(studioSpecs(s).find((x) => x.appId === 'camera')?.glyph, 'camera');
  assert.equal(isCustomised(s, 'floral', 'camera'), false);

  s = applyToAllThemes(s, 'camera', { glyph: 'aperture' }, T0);
  assert.equal(effectiveOverride(s, 'floral', 'camera')?.glyph, 'aperture');
  assert.equal(effectiveOverride(s, 'midnight-ink', 'camera')?.glyph, 'aperture');
  assert.equal(usesAllThemes(s, 'floral', 'camera'), true);

  s = setThemeOverride(s, 'floral', 'camera', { glyph: 'eye' }, T0);
  assert.equal(effectiveOverride(s, 'floral', 'camera')?.glyph, 'eye');
  assert.equal(effectiveOverride(s, 'midnight-ink', 'camera')?.glyph, 'aperture', 'other themes keep the all-themes one');
  assert.equal(studioSpecs(s).find((x) => x.appId === 'camera')?.glyph, 'eye');
  assert.equal(usesAllThemes(s, 'floral', 'camera'), false);

  // Other apps in the theme are untouched.
  assert.equal(studioSpecs(s).find((x) => x.appId === 'spotify')?.glyph, 'music');
  assert.deepEqual([...customisedAppIds(s, 'floral')], ['camera']);
  assert.equal(isCustomised(s, 'floral', 'spotify'), false);
});

test('an override in one theme does not change another theme', () => {
  let s = base('floral');
  s = setOverride(s, 'spotify', { overrideImage: IMG_A }, T0);
  assert.equal(s.themeOverrides.floral.spotify.overrideImage, IMG_A);
  assert.equal(isCustomised(s, 'midnight-ink', 'spotify'), false);
  const other = specsForTheme(s, 'midnight-ink', DEFAULT_STYLE).find((x) => x.appId === 'spotify');
  assert.equal(other?.overrideImage, undefined);
  const mine = specsForTheme(s, 'floral', DEFAULT_STYLE).find((x) => x.appId === 'spotify');
  assert.equal(mine?.overrideImage, IMG_A);
});

test('no theme applied uses the "custom" key', () => {
  const s = setOverride(base(null), 'mail', { label: 'Post' });
  assert.deepEqual(Object.keys(s.themeOverrides), [NO_THEME_KEY]);
  assert.equal(studioSpecs(s).find((x) => x.appId === 'mail')?.label, 'Post');
});

test('setOverride edits the all-themes override when that is what the app shows', () => {
  let s = applyToAllThemes(base('floral'), 'camera', { glyph: 'aperture' }, T0);
  s = setOverride(s, 'camera', { glyph: 'aperture', label: 'Snap' }, T0);
  assert.equal(s.themeOverrides.floral, undefined);
  assert.deepEqual(s.themeOverrides[ALL_THEMES_KEY].camera, { glyph: 'aperture', label: 'Snap' });
});

test('restore theme artwork removes the override but keeps the image in the library', () => {
  let s = setThemeOverride(base('floral'), 'floral', 'camera', { overrideImage: IMG_A }, T0);
  assert.deepEqual(s.images.map((i) => i.uri), [IMG_A]);
  s = restoreThemeArtwork(s, 'floral', 'camera');
  assert.equal(isCustomised(s, 'floral', 'camera'), false);
  assert.deepEqual(s.themeOverrides, {});
  assert.deepEqual(s.images.map((i) => i.uri), [IMG_A]);
  assert.ok(imagesInUse(s).has(IMG_A), 'library entry keeps the file safe');
  // Re-apply from the library to another app in another theme.
  s = setThemeOverride(s, 'midnight-ink', 'spotify', { overrideImage: s.images[0].uri }, T0 + 5);
  assert.equal(s.images.length, 1, 'no duplicate entry');
  assert.equal(effectiveOverride(s, 'midnight-ink', 'spotify')?.overrideImage, IMG_A);
});

test('restore also clears an all-themes override the app was showing', () => {
  let s = applyToAllThemes(base('floral'), 'camera', { overrideImage: IMG_A }, T0);
  s = restoreThemeArtwork(s, 'floral', 'camera');
  assert.equal(isCustomised(s, 'floral', 'camera'), false);
  assert.deepEqual(s.images.map((i) => i.uri), [IMG_A]);
});

test('use in all themes replaces theme-specific overrides; keepOnlyInTheme turns it off', () => {
  let s = setThemeOverride(base('floral'), 'midnight-ink', 'camera', { glyph: 'eye' }, T0);
  s = applyToAllThemes(s, 'camera', { glyph: 'aperture' }, T0);
  assert.equal(effectiveOverride(s, 'midnight-ink', 'camera')?.glyph, 'aperture');
  assert.equal(s.themeOverrides['midnight-ink'], undefined);
  s = keepOnlyInTheme(s, 'floral', 'camera');
  assert.equal(effectiveOverride(s, 'floral', 'camera')?.glyph, 'aperture');
  assert.equal(isCustomised(s, 'midnight-ink', 'camera'), false);
  assert.equal(s.themeOverrides[ALL_THEMES_KEY], undefined);
  // keepOnlyInTheme without an all-themes override is a no-op.
  assert.equal(keepOnlyInTheme(s, 'floral', 'camera'), s);
});

test('library dedupes by uri and lists newest first', () => {
  let s = base();
  const a = addImage(s, IMG_A, T0, 'Clash floral');
  s = a.state;
  const again = addImage(s, ` ${IMG_A} `, T0 + 100);
  assert.equal(again.state, s, 'same uri: unchanged state');
  assert.equal(again.image?.id, a.image?.id);
  s = addImage(s, IMG_B, T0 + 1).state;
  assert.deepEqual(libraryImages(s).map((i) => i.uri), [IMG_B, IMG_A]);
  assert.equal(new Set(s.images.map((i) => i.id)).size, 2);
  assert.equal(s.images[0].label, 'Clash floral');
  assert.equal(addImage(s, '   ', T0).image, null);
  // Dedupe also holds through parse (corrupt duplicates / duplicate ids).
  const json = JSON.stringify({
    ...JSON.parse(serializeStudioState(s)),
    images: [...s.images, { id: s.images[0].id, uri: IMG_A, addedAt: 1 }, { id: s.images[0].id, uri: 'file:///x.png', addedAt: -4 }, 'junk', { uri: '' }],
  });
  const back = parseStudioState(json);
  assert.deepEqual(back.images.map((i) => i.uri), [IMG_A, IMG_B, 'file:///x.png']);
  assert.equal(new Set(back.images.map((i) => i.id)).size, 3);
  assert.equal(back.images[2].addedAt, 0);
});

test('no image is deleted while referenced; explicit library delete clears references', () => {
  let s = setThemeOverride(base('floral'), 'floral', 'camera', { overrideImage: IMG_A, label: 'Snap' }, T0);
  s = setThemeOverride(s, 'midnight-ink', 'spotify', { overrideImage: IMG_A }, T0);
  s = applyToAllThemes(s, 'mail', { overrideImage: IMG_B }, T0);
  assert.deepEqual([...imagesInUse(s)].sort(), [IMG_A, IMG_B]);
  // Restoring every override keeps both files (library entries).
  let r = restoreThemeArtwork(restoreThemeArtwork(restoreThemeArtwork(s, 'floral', 'camera'), 'midnight-ink', 'spotify'), 'floral', 'mail');
  assert.deepEqual([...imagesInUse(r)].sort(), [IMG_A, IMG_B]);
  // Explicit delete: the reference goes too, other fields of the override stay.
  const idA = s.images.find((i) => i.uri === IMG_A)!.id;
  const d = deleteImage(s, idA);
  assert.equal(d.uri, IMG_A);
  assert.equal(imagesInUse(d.state).has(IMG_A), false);
  assert.deepEqual(d.state.themeOverrides.floral.camera, { label: 'Snap' });
  assert.equal(d.state.themeOverrides['midnight-ink'], undefined, 'image-only override removed');
  assert.ok(imagesInUse(d.state).has(IMG_B));
  assert.deepEqual(deleteImage(d.state, 'missing'), { state: d.state, uri: null });
  r = deleteCustomApp(s, 'camera');
  assert.ok(imagesInUse(r).has(IMG_A), 'deleting an app keeps its images');
});

test('migration v1 -> v2: overrides go to the current theme, photos into the library', () => {
  const v1 = JSON.stringify({
    version: 1,
    selected: ['camera', 'spotify'],
    customApps: [],
    style: DEFAULT_STYLE,
    overrides: { camera: { label: 'Snap' }, spotify: { overrideImage: IMG_A }, ghost: { label: 'x' } },
    themeId: 'plum-glaze',
    wallpaperColour: '#112233',
  });
  const s = parseStudioState(v1);
  assert.deepEqual(s.themeOverrides, { 'plum-glaze': { camera: { label: 'Snap' }, spotify: { overrideImage: IMG_A } } });
  assert.equal(s.images.length, 1);
  assert.equal(s.images[0].uri, IMG_A);
  assert.equal(s.images[0].addedAt, T0, 'time read from our file name');
  assert.equal(studioSpecs(s).find((x) => x.appId === 'spotify')?.overrideImage, IMG_A);
  assert.equal((s as unknown as Record<string, unknown>).overrides, undefined);
  // Round-trips as v2.
  assert.deepEqual(parseStudioState(serializeStudioState(s)), s);
  // No theme applied in v1 -> the "custom" key.
  const noTheme = parseStudioState(JSON.stringify({ version: 1, selected: ['camera'], overrides: { camera: { glyph: 'eye' } }, themeId: null }));
  assert.deepEqual(noTheme.themeOverrides, { custom: { camera: { glyph: 'eye' } } });
});

test('v2 parse sanitises keys and overrides and keeps the library invariant', () => {
  const json = JSON.stringify({
    version: 2,
    selected: ['camera'],
    themeOverrides: {
      floral: { camera: { overrideImage: IMG_B, glyph: 7 }, nope: { label: 'x' }, mail: {} },
      '': { camera: { label: 'bad key' } },
      ['k'.repeat(80)]: { camera: { label: 'too long' } },
      '*': { camera: { label: 'All' } },
      empty: {},
      junk: 'x',
    },
    images: 'not a list',
    themeId: 'floral',
  });
  const s = parseStudioState(json);
  assert.deepEqual(s.themeOverrides, { floral: { camera: { overrideImage: IMG_B } }, '*': { camera: { label: 'All' } } });
  assert.deepEqual(s.images.map((i) => i.uri), [IMG_B], 'referenced image added to the library');
  // Newer versions still fall back to defaults.
  assert.deepEqual(parseStudioState(JSON.stringify({ version: 3, selected: ['camera'] })), defaultStudioState());
});

test('mapImageUris re-points overrides and library together', () => {
  let s = setThemeOverride(base('floral'), 'floral', 'camera', { overrideImage: IMG_A }, T0);
  s = mapImageUris(s, (u) => u.replace('file:///doc/', 'file:///new/'));
  const moved = IMG_A.replace('file:///doc/', 'file:///new/');
  assert.equal(s.themeOverrides.floral.camera.overrideImage, moved);
  assert.deepEqual(s.images.map((i) => i.uri), [moved]);
});

test('bad theme keys are ignored', () => {
  const s = base();
  assert.equal(setThemeOverride(s, '   ', 'camera', { label: 'x' }), s);
});
