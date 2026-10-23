import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contrastRatio } from './colour.ts';
import { resolveSpec, wantsMonogram, type IconStyle } from './iconspec.ts';
import {
  MONOGRAM_GLYPH,
  MONOGRAM_MIN_CONTRAST,
  buildMonogram,
  graphemes,
  monogramColour,
  monogramFontScale,
  monogramText,
} from './monogram.ts';

test('monogramText: words, case, digits, punctuation', () => {
  assert.equal(monogramText('Bike Club'), 'BC');
  assert.equal(monogramText('  hello   world  '), 'HW');
  assert.equal(monogramText('bike'), 'B');
  assert.equal(monogramText('x'), 'X');
  assert.equal(monogramText('myBank'), 'MB');
  assert.equal(monogramText('1Password'), '1P');
  assert.equal(monogramText('365'), '36');
  assert.equal(monogramText('e-Bank'), 'EB');
  assert.equal(monogramText('(Work) Mail!'), 'WM');
  assert.equal(monogramText('Ölçü app'), 'ÖA');
  assert.equal(monogramText('Three Word Name'), 'TW');
});

test('monogramText: never more than 2 graphemes', () => {
  for (const n of ['Bike Club', 'A B C D', 'ABCDEF', '1234567', 'aBcDeF', 'Café Olé Bar']) {
    const g = graphemes(monogramText(n));
    assert.ok(g.length >= 1 && g.length <= 2, `${n} -> ${monogramText(n)}`);
  }
});

test('monogramText: CJK, kana, Hangul and Arabic are safe', () => {
  assert.equal(monogramText('微信'), '微');
  assert.equal(monogramText('カメラ'), 'カ');
  assert.equal(monogramText('카카오톡'), '카');
  const ar = monogramText('بنك الرياض');
  assert.equal(graphemes(ar).length, 2);
  assert.equal(ar, 'با');
});

test('monogramText: emoji are kept whole or skipped for letters', () => {
  assert.equal(monogramText('🚲 Rides'), 'R');
  assert.equal(monogramText('🚲'), '🚲');
  assert.equal(monogramText('👩‍💻'), '👩‍💻');
  assert.equal(monogramText('🇬🇧'), '🇬🇧');
  // No split surrogate halves.
  for (const n of ['🚲', '👩‍💻', '🇬🇧', '😀😀', 'a😀b']) {
    const m = monogramText(n);
    assert.ok(!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(m), `${n} -> lone surrogate`);
  }
});

test('monogramText: nothing letter-like gives empty', () => {
  assert.equal(monogramText(''), '');
  assert.equal(monogramText('   '), '');
  assert.equal(monogramText('!!!'), '');
  assert.equal(monogramText(null), '');
  assert.equal(monogramText(undefined), '');
});

test('graphemes keep combining marks and ZWJ sequences together', () => {
  assert.deepEqual(graphemes('éa'), ['é', 'a']);
  assert.deepEqual(graphemes('👩‍💻x'), ['👩‍💻', 'x']);
  assert.deepEqual(graphemes('👍🏽'), ['👍🏽']);
});

test('font scale: one letter bigger than two, follows glyph scale, stays bounded', () => {
  assert.ok(monogramFontScale('B') > monogramFontScale('BC'));
  assert.ok(monogramFontScale('BC', 0.9) > monogramFontScale('BC', 0.55));
  for (const t of ['B', 'BC', '微']) {
    for (const gs of [0.2, 0.55, 0.9, Number.NaN]) {
      const f = monogramFontScale(t, gs);
      assert.ok(f >= 0.18 && f <= 0.62, `${t} ${gs} -> ${f}`);
    }
  }
});

test('colour reaches 3:1 on every background colour', () => {
  const cases: [string, string[]][] = [
    ['#FFFFFF', ['#FFFFFF']],
    ['#FFFF00', ['#FFFFFF', '#EEEEEE']],
    ['#000000', ['#111111', '#222222']],
    ['#7A2E6B', ['#7A2E6B']],
    ['#FFFFFF', ['#7A2E6B', '#3A1A5B']],
  ];
  for (const [fg, bgs] of cases) {
    const c = monogramColour(fg, bgs);
    for (const b of bgs) assert.ok(contrastRatio(c, b) >= MONOGRAM_MIN_CONTRAST, `${fg} on ${b} -> ${c}`);
  }
  // Already fine: unchanged (normalised).
  assert.equal(monogramColour('#ffffff', ['#7A2E6B']), '#FFFFFF');
  // Garbage colours do not throw.
  assert.equal(monogramColour('nope', []), 'nope');
  assert.equal(monogramColour('nope', ['#FFFFFF']), '#000000');
});

test('buildMonogram returns null when there is nothing to letter', () => {
  assert.equal(buildMonogram('...', '#FFFFFF', ['#000000']), null);
  const m = buildMonogram('Bike Club', '#FFFFFF', ['#000000']);
  assert.deepEqual(m, { text: 'BC', fontScale: monogramFontScale('BC'), colour: '#FFFFFF' });
});

const style: IconStyle = {
  shape: 'squircle',
  background: { kind: 'gradient', from: '#FFFFFF', to: '#F0F0F0', angle: 90 },
  glyphColour: '#FFFFFF',
  glyphSet: 'feather',
  showLabel: true,
  glyphScale: 0.55,
};

test('wantsMonogram: empty, sentinel and unknown glyphs', () => {
  assert.equal(wantsMonogram(''), true);
  assert.equal(wantsMonogram(null), true);
  assert.equal(wantsMonogram(MONOGRAM_GLYPH), true);
  assert.equal(wantsMonogram('not-a-real-glyph'), true);
  assert.equal(wantsMonogram('camera'), false);
});

test('resolveSpec adds a readable monogram only when the app has no glyph', () => {
  const custom = resolveSpec({ id: 'custom-bike', name: 'Bike Club', urlScheme: null, glyph: MONOGRAM_GLYPH }, style);
  assert.equal(custom.monogram?.text, 'BC');
  const col = custom.monogram?.colour ?? '';
  assert.ok(contrastRatio(col, '#FFFFFF') >= 3 && contrastRatio(col, '#F0F0F0') >= 3);

  const relabelled = resolveSpec({ id: 'custom-bike', name: 'Bike Club', urlScheme: null, glyph: '' }, style, { label: 'Rides' });
  assert.equal(relabelled.monogram?.text, 'R');

  const known = resolveSpec({ id: 'camera', name: 'Camera', urlScheme: null, glyph: 'camera' }, style);
  assert.equal('monogram' in known, false);

  // Picking a real glyph in an override replaces the monogram.
  const picked = resolveSpec({ id: 'custom-bike', name: 'Bike Club', urlScheme: null, glyph: MONOGRAM_GLYPH }, style, { glyph: 'star' });
  assert.equal('monogram' in picked, false);
});

test('previewMonogram only for apps without a glyph', async () => {
  const { previewMonogram } = await import('./iconspec.ts');
  assert.equal(previewMonogram('Camera', 'camera', style), undefined);
  assert.equal(previewMonogram('Bike Club', MONOGRAM_GLYPH, style)?.text, 'BC');
  assert.equal(previewMonogram('???', MONOGRAM_GLYPH, style), undefined);
});
