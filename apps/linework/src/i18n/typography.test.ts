import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BODY_LINE_RATIO,
  DISPLAY_LINE_RATIO,
  fontFaceFor,
  fontFamilyFor,
  fontWeightFor,
  lineHeightFor,
  scaledLineHeight,
  type FontMap,
} from './typography.ts';
import { LOCALES } from './core.ts';

const LATIN: FontMap = {
  display: 'Fraunces_600SemiBold',
  displayBold: 'Fraunces_700Bold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodyBold: 'Inter_600SemiBold',
};

test('Latin line heights match the existing screens (16 → 23, 15 → 22)', () => {
  assert.equal(BODY_LINE_RATIO, 1.45);
  assert.equal(lineHeightFor(16, 'latin'), 23);
  assert.equal(lineHeightFor(15, 'latin'), 22);
  assert.equal(lineHeightFor(28, 'latin', DISPLAY_LINE_RATIO), 34);
});

test('CJK, Devanagari and Arabic get taller lines: round(size × ratio × scale)', () => {
  assert.equal(lineHeightFor(16, 'cjk'), Math.round(16 * 1.45 * 1.15)); // 27
  assert.equal(lineHeightFor(16, 'devanagari'), Math.round(16 * 1.45 * 1.3)); // 30
  assert.equal(lineHeightFor(16, 'arabic'), Math.round(16 * 1.45 * 1.25)); // 29
  assert.equal(lineHeightFor(16, 'devanagari'), 30);
  for (const s of ['cjk', 'devanagari', 'arabic'] as const) {
    for (const size of [12, 14, 16, 20, 28, 34]) assert.ok(lineHeightFor(size, s) > lineHeightFor(size, 'latin'), `${s} ${size}`);
  }
});

test('line heights are whole numbers and never below the font size', () => {
  for (const { script } of LOCALES) {
    for (let size = 10; size <= 40; size++) {
      const lh = lineHeightFor(size, script);
      assert.ok(Number.isInteger(lh));
      assert.ok(lh >= size);
    }
  }
  assert.equal(lineHeightFor(0, 'latin'), 0);
  assert.equal(lineHeightFor(Number.NaN, 'latin'), 0);
});

test('brand fonts for Latin, system font (undefined) plus a weight for other scripts', () => {
  assert.equal(fontFamilyFor('display', 'latin', LATIN), 'Fraunces_600SemiBold');
  assert.equal(fontFamilyFor('bodyBold', 'latin', LATIN), 'Inter_600SemiBold');
  assert.equal(fontWeightFor('bodyBold', 'latin'), undefined);
  for (const s of ['cjk', 'devanagari', 'arabic'] as const) {
    assert.equal(fontFamilyFor('body', s, LATIN), undefined);
    assert.equal(fontFamilyFor('displayBold', s, LATIN), undefined);
    assert.equal(fontWeightFor('displayBold', s), '700');
    assert.equal(fontWeightFor('body', s), '400');
  }
});

test('fontFaceFor: Latin is exactly the brand family (no weight key); other scripts system font + weight', () => {
  assert.deepEqual(fontFaceFor('display', 'latin', LATIN), { fontFamily: 'Fraunces_600SemiBold' });
  assert.deepEqual(fontFaceFor('bodyMedium', 'latin', LATIN), { fontFamily: 'Inter_500Medium' });
  assert.equal('fontWeight' in fontFaceFor('bodyBold', 'latin', LATIN), false);
  for (const s of ['cjk', 'devanagari', 'arabic'] as const) {
    const face = fontFaceFor('bodyBold', s, LATIN);
    assert.ok('fontFamily' in face, 'fontFamily key present so it overrides a StyleSheet brand font');
    assert.equal(face.fontFamily, undefined);
    assert.equal(face.fontWeight, '600');
    assert.equal(fontFaceFor('displayBold', s, LATIN).fontWeight, '700');
    assert.equal(fontFaceFor('body', s, LATIN).fontWeight, '400');
  }
});

test('scaledLineHeight keeps every Latin line height used by the screens and grows it for other scripts', () => {
  // Latin line heights fixed in app/*.tsx and src/ui/*.tsx (fontSize → lineHeight): 11→14, 13→18, 14→20, 15→21,
  // 16→22, 16→23, 17→24, 17→25, 22→28.
  for (const v of [14, 18, 20, 21, 22, 23, 24, 25, 28]) {
    assert.equal(scaledLineHeight(v, 'latin'), v);
    for (const s of ['cjk', 'devanagari', 'arabic'] as const) assert.ok(scaledLineHeight(v, s) > v, `${s} ${v}`);
  }
  assert.equal(scaledLineHeight(21, 'cjk'), 24);
  assert.equal(scaledLineHeight(21, 'devanagari'), 27);
  assert.equal(scaledLineHeight(21, 'arabic'), 26);
  // Same as lineHeightFor with the screen's own ratio.
  for (const { script } of LOCALES) {
    for (const [size, latin] of [[15, 21], [16, 23], [13, 18], [17, 25]] as const) {
      assert.equal(scaledLineHeight(latin, script), lineHeightFor(size, script, latin / size));
    }
  }
  assert.equal(scaledLineHeight(0, 'latin'), 0);
  assert.equal(scaledLineHeight(Number.NaN, 'arabic'), 0);
});
