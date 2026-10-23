import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getById } from './catalogue.ts';
import { contrastRatio } from './colour.ts';
import { contrastWarnings } from './iconspec.ts';
import {
  DEFAULT_STYLE,
  GLYPH_SIZES,
  MY_APPS_CATEGORY,
  POPULAR_APP_IDS,
  STYLE_PALETTE,
  addApps,
  addCustomApp,
  addPopularApps,
  backgroundBase,
  customAppId,
  defaultStudioState,
  deleteCustomApp,
  makeBackground,
  moveApp,
  normalizeUrlScheme,
  parseStudioState,
  pickerResults,
  removeApp,
  sanitizeStyle,
  serializeStudioState,
  setOverride,
  setStyle,
  studioApps,
  studioSpecs,
  toggleApp,
  applyThemeStyle,
  clearThemeShape,
  setThemeShape,
  themeShapeFor,
  themeStyleWithShape,
  STUDIO_STORE_VERSION,
  type StudioState,
} from './studio.ts';

test('default state is empty with the plum glaze style', () => {
  const s = defaultStudioState();
  assert.deepEqual(s.selected, []);
  assert.deepEqual(s.customApps, []);
  assert.deepEqual(s.themeOverrides, {});
  assert.deepEqual(s.images, []);
  assert.equal(s.themeId, null);
  assert.equal(s.wallpaperColour, null);
  assert.deepEqual(s.style, DEFAULT_STYLE);
  assert.notEqual(s.style, DEFAULT_STYLE, 'state gets its own copy');
});

test('default style keeps white glyphs at ≥ 3:1 on both gradient stops', () => {
  const bg = DEFAULT_STYLE.background;
  assert.equal(bg.kind, 'gradient');
  if (bg.kind !== 'gradient') return;
  assert.ok(contrastRatio(DEFAULT_STYLE.glyphColour, bg.from) >= 3);
  assert.ok(contrastRatio(DEFAULT_STYLE.glyphColour, bg.to) >= 3);
});

test('popular apps and palette are sane', () => {
  for (const id of POPULAR_APP_IDS) assert.ok(getById(id), `${id} is in the catalogue`);
  assert.ok(POPULAR_APP_IDS.length >= 12);
  assert.equal(STYLE_PALETTE.length, 12);
  assert.deepEqual(GLYPH_SIZES.map((g) => g.scale), [0.45, 0.55, 0.65]);
});

test('round-trips through serialize/parse', () => {
  let s = addApps(defaultStudioState(), ['spotify', 'camera']);
  const r = addCustomApp(s, { name: 'Corner Café', urlScheme: 'cornercafe' });
  assert.ok(r.ok);
  if (!r.ok) return;
  s = setOverride(r.state, 'spotify', { label: 'Tunes', glyphColour: '#ff0000', overrideImage: 'file:///doc/icons/a.jpg' });
  s = setStyle(s, { shape: 'circle', showLabel: false, glyphScale: 0.65 });
  s = { ...s, themeId: 'dusk', wallpaperColour: '#123456' };
  const back = parseStudioState(serializeStudioState(s));
  assert.deepEqual(back, s);
});

test('corrupt or foreign data gives defaults', () => {
  for (const bad of [null, undefined, '', '{', 'null', '42', '[]', '"x"', '{"version":99,"selected":["camera"]}']) {
    assert.deepEqual(parseStudioState(bad), defaultStudioState(), String(bad));
  }
});

test('partially bad data is repaired, not discarded', () => {
  const json = JSON.stringify({
    version: 1,
    selected: ['camera', 'nope', 'camera', 7, 'custom-bike', 'custom-ghost'],
    customApps: [
      { id: 'custom-bike', name: ' Bike ', urlScheme: 'bike', glyph: '' },
      { id: 'custom-bike', name: 'Dup' },
      { id: 'bad-id', name: 'X' },
      { id: 'custom-noname', name: '  ' },
      'junk',
    ],
    style: { shape: 'hexagon', background: { kind: 'solid', colour: 'nope' }, glyphColour: '#abc', glyphScale: 5, showLabel: 'yes' },
    overrides: { camera: { label: '  Snap ', glyph: 7, background: { kind: 'glass', tint: '#000', opacity: 3 } }, nope: { label: 'x' }, phone: {} },
    themeId: '',
    wallpaperColour: 'blue',
  });
  const s = parseStudioState(json);
  assert.deepEqual(s.selected, ['camera', 'custom-bike']);
  assert.deepEqual(s.customApps, [{ id: 'custom-bike', name: 'Bike', urlScheme: 'bike://', glyph: 'monogram' }]);
  assert.equal(s.style.shape, DEFAULT_STYLE.shape);
  assert.deepEqual(s.style.background, DEFAULT_STYLE.background);
  assert.equal(s.style.glyphColour, '#AABBCC');
  assert.equal(s.style.glyphScale, 0.9);
  assert.equal(s.style.showLabel, true);
  assert.deepEqual(s.themeOverrides.custom, { camera: { label: 'Snap', background: { kind: 'glass', tint: '#000000', opacity: 1 } } });
  assert.equal(s.themeId, null);
  assert.equal(s.wallpaperColour, null);
});

test('sanitizeStyle on garbage returns a copy of the default', () => {
  const s = sanitizeStyle('x');
  assert.deepEqual(s, DEFAULT_STYLE);
  s.background = { kind: 'solid', colour: '#000000' };
  assert.equal(DEFAULT_STYLE.background.kind, 'gradient');
});

test('studioApps/studioSpecs follow selected order and include custom apps', () => {
  let s = addApps(defaultStudioState(), ['spotify', 'camera']);
  const r = addCustomApp(s, { name: 'Bike Club' });
  assert.ok(r.ok);
  if (!r.ok) return;
  s = moveApp(r.state, 2, 0);
  assert.deepEqual(studioApps(s).map((a) => a.id), ['custom-bike-club', 'spotify', 'camera']);
  s = setOverride(s, 'camera', { label: 'Snap', glyph: 'aperture' });
  const specs = studioSpecs(s);
  assert.deepEqual(specs.map((x) => x.label), ['Bike Club', 'Spotify', 'Snap']);
  assert.equal(specs[0].urlScheme, null);
  assert.equal(specs[0].glyph, 'monogram');
  assert.equal(specs[0].monogram?.text, 'BC');
  assert.equal(specs[1].urlScheme, 'spotify:');
  assert.equal(specs[2].glyph, 'aperture');
  assert.equal(specs[1].shape, DEFAULT_STYLE.shape);
  assert.deepEqual(contrastWarnings(specs), []);
});

test('studioApps skips ids that no longer resolve', () => {
  const s: StudioState = { ...defaultStudioState(), selected: ['camera', 'gone', 'custom-x'] };
  assert.deepEqual(studioApps(s).map((a) => a.id), ['camera']);
});

test('toggle / remove / addPopular', () => {
  let s = toggleApp(defaultStudioState(), 'camera');
  assert.deepEqual(s.selected, ['camera']);
  s = toggleApp(s, 'unknown-app');
  assert.deepEqual(s.selected, ['camera']);
  s = toggleApp(s, 'camera');
  assert.deepEqual(s.selected, []);
  s = addPopularApps(addApps(s, ['spotify']));
  assert.equal(s.selected[0], 'spotify');
  assert.equal(new Set(s.selected).size, s.selected.length);
  assert.ok(s.selected.length >= 12);
  s = removeApp(s, 'spotify');
  assert.ok(!s.selected.includes('spotify'));
});

test('moveApp clamps and ignores bad indexes', () => {
  const s = addApps(defaultStudioState(), ['camera', 'phone', 'mail']);
  assert.deepEqual(moveApp(s, 0, 9).selected, ['phone', 'mail', 'camera']);
  assert.equal(moveApp(s, -1, 0), s);
  assert.equal(moveApp(s, 1, 1), s);
});

test('URL schemes are normalised and validated', () => {
  assert.equal(normalizeUrlScheme(''), null);
  assert.equal(normalizeUrlScheme('   '), null);
  assert.equal(normalizeUrlScheme(null), null);
  assert.equal(normalizeUrlScheme('myapp'), 'myapp://');
  assert.equal(normalizeUrlScheme(' myapp:// '), 'myapp://');
  assert.equal(normalizeUrlScheme('tel:'), 'tel:');
  assert.equal(normalizeUrlScheme('com.example.app'), 'com.example.app://');
  assert.equal(normalizeUrlScheme('my app'), undefined);
  assert.equal(normalizeUrlScheme('1app'), undefined);
  assert.equal(normalizeUrlScheme('://x'), undefined);
});

test('custom apps: validation, unique ids, delete', () => {
  const s0 = defaultStudioState();
  const bad = addCustomApp(s0, { name: '  ' });
  assert.equal(bad.ok, false);
  const badScheme = addCustomApp(s0, { name: 'X', urlScheme: 'has space' });
  assert.equal(badScheme.ok, false);
  const a = addCustomApp(s0, { name: 'Gym!' });
  assert.ok(a.ok);
  if (!a.ok) return;
  assert.equal(a.id, 'custom-gym');
  assert.deepEqual(a.state.selected, ['custom-gym']);
  assert.equal(customAppId(a.state, 'Gym'), 'custom-gym-2');
  assert.equal(customAppId(a.state, '★★'), 'custom-app');
  let s = setOverride(a.state, 'custom-gym', { label: 'Lift' });
  s = deleteCustomApp(s, 'custom-gym');
  assert.deepEqual(s.customApps, []);
  assert.deepEqual(s.selected, []);
  assert.deepEqual(s.themeOverrides, {});
});

test('setOverride with null or an empty override clears it', () => {
  let s = setOverride(defaultStudioState(), 'camera', { label: 'Snap' });
  assert.deepEqual(s.themeOverrides.custom.camera, { label: 'Snap' });
  s = setOverride(s, 'camera', { label: '   ' });
  assert.equal(s.themeOverrides.custom?.camera, undefined);
  s = setOverride(setOverride(s, 'camera', { glyph: 'eye' }), 'camera', null);
  assert.deepEqual(s.themeOverrides, {});
});

test('makeBackground builds each kind from one colour', () => {
  assert.deepEqual(makeBackground('solid', '#abc'), { kind: 'solid', colour: '#AABBCC' });
  const g = makeBackground('gradient', '#2D4F8C');
  assert.equal(g.kind, 'gradient');
  if (g.kind === 'gradient') {
    assert.equal(g.from, '#2D4F8C');
    assert.notEqual(g.to, g.from);
    assert.equal(g.angle, 135);
  }
  const glass = makeBackground('glass', '#7A2E6B', { kind: 'glass', tint: '#000000', opacity: 0.3 });
  assert.deepEqual(glass, { kind: 'glass', tint: '#7A2E6B', opacity: 0.3 });
  assert.equal(backgroundBase(glass), '#7A2E6B');
  assert.equal(backgroundBase(g), '#2D4F8C');
  assert.equal(makeBackground('solid', 'nope').kind, 'solid');
});

test('pickerResults: search, categories and custom apps', () => {
  const r = addCustomApp(defaultStudioState(), { name: 'Spot Check' });
  assert.ok(r.ok);
  if (!r.ok) return;
  const s = r.state;
  const spot = pickerResults(s, 'spot', null);
  assert.equal(spot[0].id, 'custom-spot-check');
  assert.ok(spot.some((x) => x.id === 'spotify'));
  const sys = pickerResults(s, '', 'System');
  assert.ok(sys.length > 10);
  assert.ok(sys.every((x) => x.category === 'System'));
  const mine = pickerResults(s, '', MY_APPS_CATEGORY);
  assert.deepEqual(mine.map((x) => x.id), ['custom-spot-check']);
  assert.ok(pickerResults(s, '', null, 5).length === 5);
  assert.deepEqual(pickerResults(s, 'zzzzqqq', null), []);
});

// ---------------------------------------------------------------- T26: shape per theme

test('square is a valid stored shape (style and override)', () => {
  assert.equal(sanitizeStyle({ ...DEFAULT_STYLE, shape: 'square' }).shape, 'square');
  assert.equal(sanitizeStyle({ ...DEFAULT_STYLE, shape: 'hexagon' }).shape, DEFAULT_STYLE.shape);
});

test('per-theme shape: chosen shape is remembered per theme and survives a round trip', () => {
  let s = defaultStudioState();
  assert.deepEqual(s.themeShapes, {});
  assert.equal(themeShapeFor(s, 'cloud-nine', 'squircle'), 'squircle');
  s = setThemeShape(s, 'cloud-nine', 'circle');
  s = setThemeShape(s, 'matcha-cafe', 'square');
  assert.equal(themeShapeFor(s, 'cloud-nine', 'squircle'), 'circle');
  assert.equal(themeShapeFor(s, 'matcha-cafe', 'blob'), 'square');
  assert.equal(themeShapeFor(s, 'retro-diner', 'blob'), 'blob');
  // Not the applied theme: the studio style is untouched.
  assert.equal(s.style.shape, DEFAULT_STYLE.shape);
  const back = parseStudioState(serializeStudioState(s));
  assert.deepEqual(back.themeShapes, { 'cloud-nine': 'circle', 'matcha-cafe': 'square' });
  // Bad input is a no-op.
  assert.equal(setThemeShape(s, '', 'circle'), s);
  assert.equal(setThemeShape(s, '*', 'circle'), s);
  assert.equal(setThemeShape(s, 'x', 'hexagon' as never), s);
  // Clearing goes back to the theme's own shape.
  assert.equal(themeShapeFor(clearThemeShape(s, 'cloud-nine'), 'cloud-nine', 'rounded'), 'rounded');
  assert.equal(clearThemeShape(s, 'nope'), s);
});

test('per-theme shape: changing the applied theme\'s shape changes the exported specs', () => {
  let s = addApps(defaultStudioState(), ['camera', 'mail']);
  s = applyThemeStyle(s, { ...DEFAULT_STYLE, shape: 'rounded' }, 'cloud-nine', '#112233');
  assert.equal(s.themeId, 'cloud-nine');
  assert.equal(s.wallpaperColour, '#112233');
  assert.ok(studioSpecs(s).every((x) => x.shape === 'rounded'));
  s = setThemeShape(s, 'cloud-nine', 'square');
  assert.equal(s.style.shape, 'square');
  assert.ok(studioSpecs(s).every((x) => x.shape === 'square'));
  // The Icon Studio's shape control records the choice for the applied theme too.
  s = setStyle(s, { shape: 'blob' });
  assert.equal(s.themeShapes['cloud-nine'], 'blob');
  // With no theme applied, a style change records nothing.
  const none = setStyle(defaultStudioState(), { shape: 'circle' });
  assert.deepEqual(none.themeShapes, {});
});

test('applying a theme uses the shape chosen for it, else the theme\'s own', () => {
  let s = setThemeShape(defaultStudioState(), 'celestial-night', 'circle');
  const themeStyle = { ...DEFAULT_STYLE, shape: 'squircle' as const };
  s = applyThemeStyle(s, themeStyle, 'celestial-night');
  assert.equal(s.style.shape, 'circle');
  assert.equal(s.wallpaperColour, null);
  s = applyThemeStyle(s, themeStyle, 'moon-phase', '#000000');
  assert.equal(s.style.shape, 'squircle');
  // Choices for other themes are kept when switching.
  assert.equal(s.themeShapes['celestial-night'], 'circle');
  assert.equal(themeStyleWithShape(s, 'celestial-night', themeStyle).shape, 'circle');
  assert.equal(themeStyleWithShape(s, 'moon-phase', themeStyle).shape, 'squircle');
  // Bad wallpaper colours are not stored.
  assert.equal(applyThemeStyle(s, themeStyle, 'moon-phase', 'nope').wallpaperColour, null);
});

test('themeShapes: v2 data without it loads; junk entries are dropped; version unchanged', () => {
  assert.equal(STUDIO_STORE_VERSION, 2);
  const legacy = parseStudioState(JSON.stringify({ version: 2, selected: ['camera'], themeId: 'cloud-nine' }));
  assert.deepEqual(legacy.themeShapes, {});
  assert.deepEqual(legacy.selected, ['camera']);
  const v1 = parseStudioState(JSON.stringify({ version: 1, selected: ['camera'], overrides: { camera: { label: 'Cam' } } }));
  assert.deepEqual(v1.themeShapes, {});
  assert.equal(v1.themeOverrides.custom.camera.label, 'Cam');
  const junk = parseStudioState(
    JSON.stringify({
      version: 2,
      themeShapes: { ok: 'square', bad: 'hexagon', '*': 'circle', '': 'circle', n: 5, ['x'.repeat(80)]: 'blob' },
    }),
  );
  assert.deepEqual(junk.themeShapes, { ok: 'square' });
  assert.deepEqual(parseStudioState(JSON.stringify({ version: 2, themeShapes: ['square'] })).themeShapes, {});
});
