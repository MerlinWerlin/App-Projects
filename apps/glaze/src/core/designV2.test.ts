import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isHex } from './colour.ts';
import {
  AA_TEXT,
  ELEVATION_LEVELS,
  MATERIAL_NAMES,
  PASTEL_NAMES,
  boxShadowFor,
  compositeOver,
  darkV2,
  elevationV2,
  hasSeparator,
  iconTileRadius,
  interpolateClamp,
  largeTitleFrame,
  largeTitleRanges,
  largeTitleSnapAt,
  largeTitleSnapped,
  lightV2,
  materialChecks,
  materialContrast,
  materialsV2,
  paletteChecks,
  paletteV2,
  radiusV2,
  rowPosition,
  scrimColour,
  scrimV2,
  separatorInset,
  sizeV2,
  spaceV2,
  typeV2,
  type PaletteV2,
} from './designV2.ts';

const schemes = [
  ['light', lightV2],
  ['dark', darkV2],
] as const;

function colours(p: PaletteV2): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(p)) {
    if (typeof v === 'string') out.push(v);
    else if (k === 'glaze') out.push(...(v as string[]));
    else for (const pastel of Object.values(v as Record<string, { fill: string; ink: string }>)) out.push(pastel.fill, pastel.ink);
  }
  return out;
}

test('both palettes have the same keys, all valid hex colours, six pastels each', () => {
  assert.deepEqual(Object.keys(lightV2).sort(), Object.keys(darkV2).sort());
  for (const [, p] of schemes) {
    for (const c of colours(p)) assert.ok(isHex(c), c);
    assert.deepEqual(Object.keys(p.pastels).sort(), [...PASTEL_NAMES].sort());
  }
  assert.equal(paletteV2('dark'), darkV2);
  assert.equal(paletteV2('light'), lightV2);
  assert.equal(paletteV2(null), lightV2);
});

test('every palette pairing meets WCAG AA (text 4.5:1, tertiary/large 3:1)', () => {
  for (const [name, p] of schemes) {
    const failing = paletteChecks(p).filter((c) => !c.ok).map((c) => `${name} ${c.name} ${c.ratio.toFixed(2)} < ${c.min}`);
    assert.deepEqual(failing, []);
  }
});

test('pastel tiles carry AA text, and the soft pastels really are light in light mode', () => {
  for (const n of PASTEL_NAMES) {
    const c = paletteChecks(lightV2).find((x) => x.name === `pastel.${n}`);
    assert.ok(c && c.ratio >= AA_TEXT, n);
  }
  // Pastel-forward: the fills are soft (close to white) in light mode, and dark-mode fills are deep.
  for (const n of PASTEL_NAMES) {
    assert.ok(materialContrast('#FFFFFF', { tint: lightV2.pastels[n].fill, alpha: 1, blurIntensity: 0, fallback: '' }) < 1.6, n);
    assert.ok(materialContrast('#000000', { tint: darkV2.pastels[n].fill, alpha: 1, blurIntensity: 0, fallback: '' }) < 2.6, n);
  }
});

test('glass materials keep text AA over a pure black and a pure white backdrop', () => {
  for (const [name, p] of schemes) {
    const failing = materialChecks(p, name).filter((c) => !c.ok).map((c) => `${name} ${c.name} ${c.ratio.toFixed(2)}`);
    assert.deepEqual(failing, []);
    for (const m of MATERIAL_NAMES) {
      const mat = materialsV2[name][m];
      assert.ok(mat.alpha > 0 && mat.alpha < 1, `${name}.${m} must be translucent`);
      assert.ok(isHex(mat.fallback));
    }
  }
});

test('compositeOver blends a translucent tint over a backdrop', () => {
  assert.equal(compositeOver('#FFFFFF', 1, '#000000'), '#FFFFFF');
  assert.equal(compositeOver('#FFFFFF', 0, '#000000'), '#000000');
  assert.equal(compositeOver('#FFFFFF', 0.5, '#000000'), '#808080');
});

test('type scale follows the iOS sizes and every line height fits its size', () => {
  assert.equal(typeV2.largeTitle.fontSize, 34);
  assert.equal(typeV2.title1.fontSize, 28);
  assert.equal(typeV2.title2.fontSize, 22);
  assert.equal(typeV2.title3.fontSize, 20);
  assert.equal(typeV2.body.fontSize, 17);
  assert.equal(typeV2.footnote.fontSize, 13);
  for (const [k, s] of Object.entries(typeV2)) assert.ok(s.lineHeight >= s.fontSize * 1.15, k);
  const sizes = [typeV2.largeTitle, typeV2.title1, typeV2.title2, typeV2.title3, typeV2.body, typeV2.footnote, typeV2.caption2].map((s) => s.fontSize);
  assert.deepEqual([...sizes].sort((a, b) => b - a), sizes);
});

test('radii, sizes and spacing respect the brief (cards 22-28, pill 999, 48 pt targets)', () => {
  for (const r of [radiusV2.group, radiusV2.card, radiusV2.cardLarge]) assert.ok(r >= 22 && r <= 28, String(r));
  assert.equal(radiusV2.pill, 999);
  for (const [k, v] of Object.entries(sizeV2)) if (k !== 'rowIcon') assert.ok(v >= 48, k);
  for (const v of Object.values(spaceV2)) assert.equal(v % 2, 0);
});

test('iconTileRadius gives the superellipse ratio, rounded to half points', () => {
  assert.equal(iconTileRadius(60), 13.5);
  assert.equal(iconTileRadius(30), 6.5);
  assert.equal(iconTileRadius(0), 0);
  assert.equal(iconTileRadius(-4), 0);
  assert.equal(iconTileRadius(Number.NaN), 0);
});

test('elevation levels are layered, monotonic and render as box-shadow lists', () => {
  for (const s of ['light', 'dark'] as const) {
    assert.deepEqual(elevationV2[s].flat, []);
    let prevBlur = 0;
    for (const lvl of ELEVATION_LEVELS.slice(1)) {
      const layers = elevationV2[s][lvl];
      assert.equal(layers.length, 2, `${s}.${lvl} has a contact + ambient layer`);
      const blur = Math.max(...layers.map((l) => l.blur));
      assert.ok(blur > prevBlur, `${s}.${lvl} grows`);
      prevBlur = blur;
      for (const l of layers) assert.ok(l.opacity > 0 && l.opacity <= 0.5);
    }
  }
  assert.equal(boxShadowFor('flat', 'light'), '');
  assert.equal(
    boxShadowFor('card', 'light'),
    '0px 1px 2px 0px rgba(59, 31, 56, 0.06), 0px 6px 16px -2px rgba(59, 31, 56, 0.08)',
  );
});

test('interpolateClamp matches clamped piecewise-linear interpolation', () => {
  assert.equal(interpolateClamp(-5, [0, 10], [0, 1]), 0);
  assert.equal(interpolateClamp(5, [0, 10], [0, 1]), 0.5);
  assert.equal(interpolateClamp(50, [0, 10], [0, 1]), 1);
  assert.equal(interpolateClamp(15, [0, 10, 20], [0, 1, 0]), 0.5);
  assert.equal(interpolateClamp(Number.NaN, [0, 10], [3, 1]), 3);
  assert.throws(() => interpolateClamp(1, [0], [0, 1]));
});

test('large title collapses: visible at rest, inline title + bar material once scrolled', () => {
  const h = sizeV2.largeTitleBlock;
  const rest = largeTitleFrame(0, h);
  assert.deepEqual(rest, { largeOpacity: 1, largeScale: 1, inlineOpacity: 0, barOpacity: 0 });
  const half = largeTitleFrame(h / 2, h);
  assert.equal(half.largeOpacity, 1);
  assert.equal(half.inlineOpacity, 0);
  const done = largeTitleFrame(h * 2, h);
  assert.equal(done.largeOpacity, 0);
  assert.equal(done.inlineOpacity, 1);
  assert.equal(done.barOpacity, 1);
});

test('large title stretches on pull-down overscroll, capped at 1.08', () => {
  const h = 52;
  const pull = largeTitleFrame(-h, h);
  assert.ok(pull.largeScale > 1 && pull.largeScale < 1.08);
  assert.equal(largeTitleFrame(-10_000, h).largeScale, 1.08);
  assert.equal(pull.inlineOpacity, 0);
});

test('large title frame is monotonic while scrolling up', () => {
  const h = 52;
  let prev = largeTitleFrame(0, h);
  for (let y = 1; y <= h * 2; y++) {
    const f = largeTitleFrame(y, h);
    assert.ok(f.largeOpacity <= prev.largeOpacity);
    assert.ok(f.inlineOpacity >= prev.inlineOpacity);
    assert.ok(f.barOpacity >= prev.barOpacity);
    prev = f;
  }
});

test('large title ranges are increasing and equal-length (reanimated interpolate contract)', () => {
  for (const [k, r] of Object.entries(largeTitleRanges(40))) {
    assert.equal(r.input.length, r.output.length, k);
    for (let i = 1; i < r.input.length; i++) assert.ok(r.input[i] > r.input[i - 1], k);
  }
  assert.doesNotThrow(() => largeTitleRanges(0));
  assert.equal(largeTitleSnapped(10, 52), false);
  assert.equal(largeTitleSnapped(40, 52), true);
  assert.equal(largeTitleSnapAt(0), 0.6);
});

test('rowPosition and separators for inset groups', () => {
  assert.equal(rowPosition(0, 1), 'only');
  assert.equal(rowPosition(0, 3), 'first');
  assert.equal(rowPosition(1, 3), 'middle');
  assert.equal(rowPosition(2, 3), 'last');
  assert.equal(hasSeparator('only'), false);
  assert.equal(hasSeparator('last'), false);
  assert.equal(hasSeparator('first'), true);
  assert.ok(separatorInset(true) > separatorInset(false));
});

test('the sheet scrim is a translucent dim in both schemes, darker in dark mode', () => {
  for (const scheme of ['light', 'dark'] as const) {
    const s = scrimV2[scheme];
    assert.ok(isHex(s.tint));
    assert.ok(s.alpha > 0.2 && s.alpha < 0.8);
    assert.match(scrimColour(scheme), /^rgba\(\d+, ?\d+, ?\d+, ?0?\.\d+\)$/);
  }
  assert.ok(scrimV2.dark.alpha >= scrimV2.light.alpha);
});
