import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composite, contrastRatio, meetsAA, parseColor, relativeLuminance, withAlpha } from './contrast.ts';
import { darkV2, lightV2, pastelAt, radiusV2, shadowV2, typeV2, type PaletteV2 } from '../theme/tokensV2.ts';

const near = (a: number, b: number, eps = 0.01) => assert.ok(Math.abs(a - b) <= eps, `${a} ≈ ${b}`);

test('parseColor handles hex, short hex, 8-digit hex and rgba', () => {
  assert.deepEqual(parseColor('#fff'), { r: 255, g: 255, b: 255, a: 1 });
  assert.deepEqual(parseColor('#3B5BDB'), { r: 59, g: 91, b: 219, a: 1 });
  assert.equal(parseColor('#00000080').a, 128 / 255);
  assert.deepEqual(parseColor('rgba(255, 143, 177, 0.18)'), { r: 255, g: 143, b: 177, a: 0.18 });
  assert.deepEqual(parseColor('rgb(1,2,3)'), { r: 1, g: 2, b: 3, a: 1 });
  assert.throws(() => parseColor('blue'));
});

test('WCAG reference values', () => {
  near(relativeLuminance('#FFFFFF'), 1);
  near(relativeLuminance('#000000'), 0);
  near(contrastRatio('#000000', '#FFFFFF'), 21);
  near(contrastRatio('#FFFFFF', '#FFFFFF'), 1);
  // #767676 on white is the classic 4.54:1 AA threshold grey
  near(contrastRatio('#767676', '#FFFFFF'), 4.54);
  assert.equal(contrastRatio('#123456', '#FEDCBA'), contrastRatio('#FEDCBA', '#123456'));
  assert.ok(meetsAA('#767676', '#FFFFFF'));
  assert.ok(!meetsAA('#999999', '#FFFFFF'));
  assert.ok(meetsAA('#949494', '#FFFFFF', { large: true }));
});

test('composite and withAlpha', () => {
  assert.deepEqual(composite(parseColor('rgba(0,0,0,0.5)'), parseColor('#FFFFFF')), { r: 127.5, g: 127.5, b: 127.5, a: 1 });
  assert.equal(withAlpha('#FF8FB1', 0.18), 'rgba(255,143,177,0.18)');
  assert.equal(darkV2.pastels[1], withAlpha(darkV2.bubblegum, 0.18));
});

// Every text-on-fill pair DESIGN_V2 uses. Pastels can sit on paper or on a card (translucent in dark), so both.
function pairs(p: PaletteV2): Array<[string, string, string, string?]> {
  const out: Array<[string, string, string, string?]> = [];
  for (const text of ['graphite', 'muted'] as const) {
    for (const fill of ['paper', 'card', 'card2', 'inkSoft'] as const) out.push([`${text} on ${fill}`, p[text], p[fill]]);
    p.pastels.forEach((fill, i) => {
      out.push([`${text} on pastel ${i} over paper`, p[text], fill, p.paper]);
      out.push([`${text} on pastel ${i} over card`, p[text], fill, p.card]);
    });
  }
  out.push(['onInk on ink', p.onInk, p.ink]);
  // ink as link / plain button text and status text on the grouped backgrounds
  for (const text of ['ink', 'ok', 'warn'] as const) for (const fill of ['paper', 'card', 'card2'] as const) out.push([`${text} on ${fill}`, p[text], p[fill]]);
  return out;
}

for (const [scheme, p] of [['light', lightV2], ['dark', darkV2]] as const) {
  test(`v2 ${scheme}: every text-on-fill pair is ≥ 4.5:1`, () => {
    const fails = pairs(p)
      .map(([name, fg, bg, backdrop]) => ({ name, ratio: contrastRatio(fg, bg, backdrop ?? p.paper) }))
      .filter((r) => r.ratio < 4.5)
      .map((r) => `${r.name} ${r.ratio.toFixed(2)}`);
    assert.deepEqual(fails, []);
  });
}

test('v2 tokens: same keys in light and dark, v1 names kept, six pastels', () => {
  assert.deepEqual(Object.keys(lightV2).sort(), Object.keys(darkV2).sort());
  for (const k of ['paper', 'card', 'line', 'graphite', 'muted', 'ink', 'inkSoft', 'ok', 'warn', 'onInk']) assert.ok(k in lightV2, k);
  assert.equal(lightV2.pastels.length, 6);
  assert.equal(darkV2.pastels.length, 6);
  assert.equal(pastelAt(lightV2, 7), lightV2.pastels[1]);
  assert.equal(pastelAt(lightV2, -1), lightV2.pastels[5]);
});

test('v2 radii, elevation and type scale match the spec', () => {
  assert.deepEqual({ ...radiusV2 }, { xs: 10, sm: 14, md: 20, lg: 28, xl: 36, pill: 999 });
  assert.ok(shadowV2.e1.shadowOpacity < shadowV2.e2.shadowOpacity && shadowV2.e2.shadowOpacity < shadowV2.e3.shadowOpacity);
  assert.ok(shadowV2.e1.elevation < shadowV2.e2.elevation && shadowV2.e2.elevation < shadowV2.e3.elevation);
  assert.deepEqual(typeV2.largeTitle, { fontSize: 34, lineHeight: 41, fontWeight: '700' });
  assert.equal(typeV2.headline.fontSize, 17);
  for (const s of Object.values(typeV2)) assert.ok(s.lineHeight > s.fontSize);
});
