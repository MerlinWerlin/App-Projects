import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseHex,
  hexToRgb,
  rgbToHex,
  normalizeHex,
  rgbToHsl,
  hslToRgb,
  hexToHsl,
  hslToHex,
  mix,
  lighten,
  darken,
  withAlpha,
  gradient,
  gradientStops,
  relativeLuminance,
  contrastRatio,
  meetsContrast,
  bestTextOn,
  seededRandom,
  paletteFromPixels,
  paletteClusters,
} from './colour.ts';

const near = (a: number, b: number, eps: number, msg?: string) =>
  assert.ok(Math.abs(a - b) <= eps, msg ?? `${a} not within ${eps} of ${b}`);

test('parseHex accepts #RGB and #RRGGBB, rejects junk', () => {
  assert.deepEqual(parseHex('#fff'), { r: 255, g: 255, b: 255 });
  assert.deepEqual(parseHex('#7A2E6B'), { r: 122, g: 46, b: 107 });
  assert.deepEqual(parseHex('e0794f'), { r: 224, g: 121, b: 79 });
  assert.deepEqual(parseHex(' #abc '), { r: 170, g: 187, b: 204 });
  for (const bad of ['', '#', '#ff', '#ggg', '#12345', '#1234567', 'red']) {
    assert.equal(parseHex(bad), null, bad);
  }
  assert.throws(() => hexToRgb('nope'));
});

test('rgbToHex formats uppercase #RRGGBB and clamps', () => {
  assert.equal(rgbToHex({ r: 0, g: 0, b: 0 }), '#000000');
  assert.equal(rgbToHex({ r: 300, g: -4, b: 15.6 }), '#FF0010');
  assert.equal(normalizeHex('#a1b'), '#AA11BB');
});

test('rgb <-> hsl round-trips and matches known values', () => {
  assert.deepEqual(rgbToHsl({ r: 255, g: 0, b: 0 }), { h: 0, s: 1, l: 0.5 });
  const blue = hexToHsl('#0000FF');
  near(blue.h, 240, 1e-9);
  near(blue.s, 1, 1e-9);
  near(blue.l, 0.5, 1e-9);
  assert.equal(hexToHsl('#808080').s, 0);
  assert.deepEqual(hslToRgb({ h: 120, s: 1, l: 0.25 }), { r: 0, g: 128, b: 0 });
  assert.equal(hslToHex({ h: 0, s: 0, l: 1 }), '#FFFFFF');
  for (const hex of ['#7A2E6B', '#E0794F', '#2C7A54', '#A2620F', '#F6F3F5', '#121013', '#123456']) {
    assert.equal(hslToHex(hexToHsl(hex)), hex);
  }
});

test('mix, lighten, darken, withAlpha', () => {
  assert.equal(mix('#000000', '#FFFFFF', 0), '#000000');
  assert.equal(mix('#000000', '#FFFFFF', 1), '#FFFFFF');
  assert.equal(mix('#000000', '#FFFFFF', 0.5), '#808080');
  assert.equal(mix('#FF0000', '#0000FF', 2), '#0000FF'); // t clamped
  assert.equal(lighten('#000000', 1), '#FFFFFF');
  assert.equal(darken('#FFFFFF', 0.5), '#808080');
  assert.ok(relativeLuminance(lighten('#7A2E6B', 0.1)) > relativeLuminance('#7A2E6B'));
  assert.equal(withAlpha('#abc', 0.5), '#AABBCC80');
});

test('gradient stops are evenly mixed and hit the ends', () => {
  assert.deepEqual(gradient('#000000', '#FFFFFF', 3), ['#000000', '#808080', '#FFFFFF']);
  const g = gradient('#7A2E6B', '#E0794F', 6);
  assert.equal(g.length, 6);
  assert.equal(g[0], '#7A2E6B');
  assert.equal(g[5], '#E0794F');
  assert.deepEqual(gradientStops(['#FF0000', '#00FF00', '#0000FF'], 5), [
    '#FF0000',
    '#808000',
    '#00FF00',
    '#008080',
    '#0000FF',
  ]);
  assert.deepEqual(gradient('#000', '#fff', 1), ['#000000']);
  assert.deepEqual(gradient('#000', '#fff', 0), []);
});

test('WCAG contrast matches known pairs', () => {
  near(relativeLuminance('#000000'), 0, 1e-12);
  near(relativeLuminance('#FFFFFF'), 1, 1e-12);
  near(contrastRatio('#000', '#FFF'), 21, 1e-9);
  near(contrastRatio('#FFF', '#000'), 21, 1e-9);
  near(contrastRatio('#777777', '#FFFFFF'), 4.48, 0.01);
  near(contrastRatio('#767676', '#FFFFFF'), 4.54, 0.01); // the classic "lightest AA grey"
  near(contrastRatio('#FF0000', '#FFFFFF'), 4.0, 0.01);
  near(contrastRatio('#0000FF', '#FFFFFF'), 8.59, 0.01);
  near(contrastRatio('#123456', '#123456'), 1, 1e-12);
  assert.equal(meetsContrast('#767676', '#FFFFFF'), true);
  assert.equal(meetsContrast('#777777', '#FFFFFF'), false);
  assert.equal(meetsContrast('#777777', '#FFFFFF', 3), true);
});

test('bestTextOn picks the more readable of dark and light', () => {
  assert.equal(bestTextOn('#FFFFFF'), '#000000');
  assert.equal(bestTextOn('#000000'), '#FFFFFF');
  assert.equal(bestTextOn('#7A2E6B'), '#FFFFFF');
  assert.equal(bestTextOn('#F6F3F5', '#1E1A1D', '#FFFFFF'), '#1E1A1D');
  assert.equal(bestTextOn('#FFD700'), '#000000');
});

test('seededRandom is deterministic and in [0,1)', () => {
  const a = seededRandom(42);
  const b = seededRandom(42);
  for (let i = 0; i < 100; i++) {
    const x = a();
    assert.equal(x, b());
    assert.ok(x >= 0 && x < 1);
  }
  assert.notEqual(seededRandom(1)(), seededRandom(2)());
});

/** Build RGBA pixels from [hex, count] blocks, adding small deterministic noise. */
function synth(blocks: Array<[string, number]>, noise = 6, seed = 7): number[] {
  const rand = seededRandom(seed);
  const out: number[] = [];
  for (const [hex, count] of blocks) {
    const c = hexToRgb(hex);
    for (let i = 0; i < count; i++) {
      const j = () => Math.round((rand() - 0.5) * 2 * noise);
      out.push(
        Math.min(255, Math.max(0, c.r + j())),
        Math.min(255, Math.max(0, c.g + j())),
        Math.min(255, Math.max(0, c.b + j())),
        255,
      );
    }
  }
  return out;
}

test('paletteFromPixels recovers synthetic clusters sorted by size', () => {
  const px = synth([
    ['#2050C0', 300], // blue, biggest
    ['#E04020', 600], // red
    ['#30A040', 100], // green, smallest
  ]);
  const pal = paletteClusters(px, 3, 1);
  assert.equal(pal.length, 3);
  const expected = ['#E04020', '#2050C0', '#30A040'];
  pal.forEach((c, i) => {
    const want = hexToRgb(expected[i]);
    const got = hexToRgb(c.hex);
    near(got.r, want.r, 6, `${c.hex} vs ${expected[i]}`);
    near(got.g, want.g, 6, `${c.hex} vs ${expected[i]}`);
    near(got.b, want.b, 6, `${c.hex} vs ${expected[i]}`);
  });
  assert.deepEqual(
    pal.map((c) => c.count),
    [600, 300, 100],
  );
  near(pal[0].share, 0.6, 1e-9);
});

test('paletteFromPixels is deterministic for a seed and works with Uint8Array', () => {
  const arr = synth([
    ['#111111', 200],
    ['#EEEEEE', 150],
    ['#7A2E6B', 120],
    ['#E0794F', 80],
  ]);
  const u8 = Uint8Array.from(arr);
  const a = paletteFromPixels(u8, 4, 99);
  const b = paletteFromPixels(arr, 4, 99);
  assert.deepEqual(a, b);
  assert.equal(a.length, 4);
  for (const hex of a) assert.match(hex, /^#[0-9A-F]{6}$/);
});

test('paletteFromPixels ignores transparent pixels and handles few colours', () => {
  const px: number[] = [];
  for (let i = 0; i < 50; i++) px.push(255, 0, 0, 255);
  for (let i = 0; i < 500; i++) px.push(0, 0, 255, 0); // fully transparent, ignored
  assert.deepEqual(paletteFromPixels(px, 5, 3), ['#FF0000']);
  assert.deepEqual(paletteFromPixels([], 3), []);
  assert.deepEqual(paletteFromPixels([0, 0, 0, 0], 3), []);
});
