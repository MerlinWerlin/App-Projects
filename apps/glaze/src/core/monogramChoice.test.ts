// T82: the user's own monogram letters (IconOverrideSheet), and withMonogram, which keeps the
// HomeMock previews and the Android pinned-shortcut PNGs in step with resolveSpec (iOS install).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contrastRatio } from './colour.ts';
import {
  previewMonogram,
  resolveSpec,
  specContrast,
  withMonogram,
  type IconApp,
  type MonogramDrawable,
  type IconSpec,
  type IconStyle,
} from './iconspec.ts';
import { MONOGRAM_GLYPH, MONOGRAM_MAX_GRAPHEMES, buildMonogram, cleanMonogramText, graphemes } from './monogram.ts';
import { DEFAULT_STYLE, defaultStudioState, effectiveOverride, sanitizeOverride, setThemeOverride } from './studio.ts';

const style: IconStyle = {
  shape: 'squircle',
  background: { kind: 'solid', colour: '#FFFFFF' },
  glyphColour: '#FFFFFF',
  glyphSet: 'feather',
  showLabel: true,
  glyphScale: 0.55,
};
const bike: IconApp = { id: 'custom-bike', name: 'Bike Club', urlScheme: 'bike://', glyph: MONOGRAM_GLYPH };
const camera: IconApp = { id: 'camera', name: 'Camera', urlScheme: 'camera://', glyph: 'camera' };

test('cleanMonogramText: 1–2 letter-like graphemes, upper-cased', () => {
  assert.equal(cleanMonogramText('ab'), 'AB');
  assert.equal(cleanMonogramText('  x '), 'X');
  assert.equal(cleanMonogramText('abc'), 'AB');
  assert.equal(cleanMonogramText('a.b!'), 'AB');
  assert.equal(cleanMonogramText('1p'), '1P');
  assert.equal(cleanMonogramText('ée'), 'ÉE');
  assert.equal(cleanMonogramText('微信'), '微信');
  assert.equal(cleanMonogramText('👩‍💻z'), '👩‍💻Z');
  assert.equal(cleanMonogramText('ß'), 'ß');
  for (const bad of ['', '   ', '!!', '—', null, undefined, 42, {}]) assert.equal(cleanMonogramText(bad), '');
  for (const s of ['abcdef', '😀😀😀', '🇬🇧🇫🇷🇩🇪', 'ééé']) {
    assert.ok(graphemes(cleanMonogramText(s)).length <= MONOGRAM_MAX_GRAPHEMES, s);
  }
});

test('buildMonogram: custom letters win, unusable custom falls back to the name', () => {
  assert.equal(buildMonogram('Bike Club', '#000000', ['#FFFFFF'], 0.55, 'rx')?.text, 'RX');
  assert.equal(buildMonogram('Bike Club', '#000000', ['#FFFFFF'], 0.55, '  ')?.text, 'BC');
  assert.equal(buildMonogram('Bike Club', '#000000', ['#FFFFFF'], 0.55, null)?.text, 'BC');
  // Custom letters still letter an app whose name has none.
  assert.equal(buildMonogram('!!!', '#000000', ['#FFFFFF'], 0.55, 'q')?.text, 'Q');
  // Font scale follows the custom text's length.
  const one = buildMonogram('Bike Club', '#000000', ['#FFFFFF'], 0.55, 'r');
  const two = buildMonogram('Bike Club', '#000000', ['#FFFFFF'], 0.55, 'rx');
  assert.ok((one?.fontScale ?? 0) > (two?.fontScale ?? 1));
});

test('resolveSpec: override monogramText and choosing Monogram over a real glyph', () => {
  assert.equal(resolveSpec(bike, style).monogram?.text, 'BC');
  assert.equal(resolveSpec(bike, style, { monogramText: 'rx' }).monogram?.text, 'RX');
  // Picking Monogram for an app that has a real glyph.
  const cam = resolveSpec(camera, style, { glyph: MONOGRAM_GLYPH, monogramText: 'k' });
  assert.equal(cam.monogram?.text, 'K');
  // Letters are ignored while a real glyph shows.
  assert.equal('monogram' in resolveSpec(camera, style, { monogramText: 'k' }), false);
  // Contrast correction still applies to custom letters.
  const col = resolveSpec(bike, style, { monogramText: 'zz' }).monogram?.colour ?? '';
  assert.ok(contrastRatio(col, '#FFFFFF') >= 3);
});

test('sanitizeOverride keeps cleaned monogram letters and drops junk', () => {
  assert.deepEqual(sanitizeOverride({ glyph: MONOGRAM_GLYPH, monogramText: 'abc' }), {
    glyph: MONOGRAM_GLYPH,
    monogramText: 'AB',
  });
  assert.equal(sanitizeOverride({ monogramText: '!!' }), null);
  assert.equal(sanitizeOverride({ monogramText: 7 }), null);
  const s = setThemeOverride(defaultStudioState(), 'aurora', 'camera', { glyph: MONOGRAM_GLYPH, monogramText: 'k' });
  assert.deepEqual(effectiveOverride(s, 'aurora', 'camera'), { glyph: MONOGRAM_GLYPH, monogramText: 'K' });
});

test('previewMonogram honours custom letters, never for a real glyph', () => {
  assert.equal(previewMonogram('Bike Club', MONOGRAM_GLYPH, style, 'rx')?.text, 'RX');
  assert.equal(previewMonogram('Camera', 'camera', style, 'rx'), undefined);
});

test('withMonogram matches resolveSpec (iOS install) for HomeMock and the Android path', () => {
  const resolved = [
    resolveSpec(bike, style),
    resolveSpec(bike, style, { monogramText: 'rx' }),
    resolveSpec(camera, style),
    resolveSpec(camera, style, { glyph: MONOGRAM_GLYPH }),
    resolveSpec(bike, DEFAULT_STYLE, { label: 'Rides' }),
  ];
  for (const s of resolved) {
    // Already consistent: the same object comes back (no churn in renders).
    assert.equal(withMonogram(s), s);
  }
  // A hand-built spec without a monogram gets the same one resolveSpec would draw.
  const bare: IconSpec = { ...resolved[0] };
  delete bare.monogram;
  assert.deepEqual(withMonogram(bare).monogram, resolved[0].monogram);
  assert.equal(bare.monogram, undefined, 'input is not mutated');
  // A stale monogram on a real glyph is dropped.
  const stale: IconSpec = { ...resolved[2], monogram: { text: 'X', fontScale: 0.5, colour: '#000000' } };
  const fixed = withMonogram(stale);
  assert.equal('monogram' in fixed, false);
  assert.ok('monogram' in stale, 'input is not mutated');
  // Custom letters already on a spec are kept.
  assert.equal(withMonogram(resolved[1]).monogram?.text, 'RX');
  // Nothing letterable: no monogram, no crash.
  const blank: IconSpec = { ...resolved[0], label: '...' };
  delete blank.monogram;
  assert.equal(withMonogram(blank).monogram, undefined);
  // Lighter preview specs (no appId/label) work too.
  const lite: MonogramDrawable = withMonogram({ glyph: '', glyphColour: '#FFFFFF', glyphScale: 0.55, background: style.background });
  assert.equal(lite.monogram, undefined);
});

test('specContrast measures the monogram colour, not the raw glyph colour', () => {
  // White on white would be 1:1, but the monogram colour is corrected to ≥ 3:1.
  const s = resolveSpec(bike, style);
  assert.ok((specContrast(s) ?? 0) >= 3);
  // A real glyph keeps the raw glyph colour check.
  assert.ok((specContrast(resolveSpec(camera, style)) ?? 99) < 3);
  // A photo override uses the glyph colour (monogram is not drawn).
  assert.ok((specContrast({ ...s, overrideImage: 'file:///x.png' }) ?? 99) < 3);
});
