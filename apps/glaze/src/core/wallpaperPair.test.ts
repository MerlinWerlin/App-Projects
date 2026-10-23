import test from 'node:test';
import assert from 'node:assert/strict';
import { contrastRatio, relativeLuminance } from './colour.ts';
import { WALLPAPER_SIZES } from './wallpaper.ts';
import { THEMES } from './themes.ts';
import {
  DIM_STEP,
  LABEL_MIN_CONTRAST,
  MAX_DIM,
  PAIR_PRESETS,
  blurForFrame,
  blurPxFor,
  designedColours,
  homeColour,
  homeImageLayout,
  homeVersionFor,
  labelContrastFor,
  neutralGrey,
  overscanFor,
} from './wallpaperPair.ts';

const phone = { width: 1290, height: 2796 };

test('neutralGrey keeps luminance and has no colour', () => {
  for (const c of ['#7A2E6B', '#E0794F', '#2255CC', '#FFFFFF', '#000000']) {
    const g = neutralGrey([c]);
    assert.match(g, /^#([0-9A-F]{2})\1\1$/i);
    assert.ok(Math.abs(relativeLuminance(g) - relativeLuminance(c)) < 0.01, `${c} -> ${g}`);
  }
});

test('homeColour: no wash and no dim is the same colour; full dim is black', () => {
  assert.equal(homeColour('#336699', { colour: '#808080', opacity: 0 }, 0).toUpperCase(), '#336699');
  assert.equal(homeColour('#336699', { colour: '#808080', opacity: 0.4 }, 1).toUpperCase(), '#000000');
});

test('a dark wallpaper keeps the preset dim and passes', () => {
  const h = homeVersionFor({ colours: ['#101020', '#202040'], size: phone });
  assert.equal(h.dim, PAIR_PRESETS.soft.dim);
  assert.ok(h.passes);
  assert.ok(h.labelContrast >= LABEL_MIN_CONTRAST);
});

test('a photo (unknown pixels) plans for white and raises the dim until AA', () => {
  const h = homeVersionFor({ size: phone });
  assert.ok(h.passes);
  assert.ok(h.dim > PAIR_PRESETS.soft.dim);
  assert.ok(h.dim <= MAX_DIM);
  // Minimal: one step less would fail.
  assert.ok(labelContrastFor(['#FFFFFF'], h.wash, h.dim - DIM_STEP) < LABEL_MIN_CONTRAST);
  assert.ok(contrastRatio('#FFFFFF', homeColour('#FFFFFF', h.wash, h.dim)) >= LABEL_MIN_CONTRAST);
});

test('the lightest colour decides: adding a light colour never lowers the dim', () => {
  const dark = homeVersionFor({ colours: ['#223344', '#334455'], size: phone });
  const mixed = homeVersionFor({ colours: ['#223344', '#334455', '#F4E9D8'], size: phone });
  assert.ok(mixed.dim >= dark.dim);
  assert.ok(mixed.passes);
});

test('every built-in theme wallpaper gets a passing Home version on every size', () => {
  for (const th of THEMES) {
    for (const s of WALLPAPER_SIZES) {
      for (const strength of ['soft', 'strong'] as const) {
        const h = homeVersionFor({ colours: designedColours(th.wallpaper), size: s, strength });
        assert.ok(h.passes, `${th.id} ${s.id} ${strength}: ${h.labelContrast}`);
        assert.ok(h.dim >= PAIR_PRESETS[strength].dim && h.dim <= MAX_DIM);
      }
    }
  }
});

test('strong is blurrier and more washed than soft', () => {
  const soft = homeVersionFor({ colours: ['#445566'], size: phone });
  const strong = homeVersionFor({ colours: ['#445566'], size: phone, strength: 'strong' });
  assert.ok(strong.blurPx > soft.blurPx);
  assert.ok(strong.wash.opacity > soft.wash.opacity);
  assert.ok(strong.overscan >= soft.overscan);
});

test('bad colours are ignored (treated as unknown -> white)', () => {
  const h = homeVersionFor({ colours: ['nope', ''], size: phone });
  assert.deepEqual(h, homeVersionFor({ size: phone }));
});

test('blur scales with the short side, so preview and export match', () => {
  assert.equal(blurPxFor(0.02, { width: 1000, height: 2000 }), 20);
  assert.equal(blurPxFor(0.02, { width: 2000, height: 1000 }), 20);
  const h = homeVersionFor({ size: phone });
  const preview = blurForFrame(h, { width: 220, height: 477 });
  assert.ok(Math.abs(preview / 220 - h.blurPx / phone.width) < 0.001);
  assert.equal(blurPxFor(1, { width: 100, height: 100 }), 20); // capped at 0.2
  assert.equal(blurPxFor(0.02, { width: NaN, height: 10 }), 0); // short side clamps to 1
});

test('overscan grows with the blur and is bounded', () => {
  assert.equal(overscanFor(0, phone), 1);
  assert.ok(overscanFor(20, phone) > 1);
  assert.equal(overscanFor(10_000, phone), 1.5);
  assert.equal(overscanFor(NaN, phone), 1);
  const h = homeVersionFor({ size: phone });
  assert.ok(h.overscan > 1 && h.overscan < 1.2);
});

test('homeImageLayout covers the frame, centred, zoomed by overscan', () => {
  const frame = { width: 430, height: 932 };
  const l = homeImageLayout(phone, frame, 1.1);
  assert.ok(l.x <= 0 && l.y <= 0);
  assert.ok(l.x + l.width >= frame.width - 1e-9);
  assert.ok(l.y + l.height >= frame.height - 1e-9);
  assert.ok(Math.abs(-l.x - (l.width - frame.width) / 2) < 1e-9);
  assert.ok(Math.abs(-l.y - (l.height - frame.height) / 2) < 1e-9);
  const plain = homeImageLayout(phone, frame, 1);
  assert.ok(Math.abs(l.width / plain.width - 1.1) < 1e-9);
  // A landscape source still covers a portrait frame.
  const wide = homeImageLayout({ width: 4000, height: 3000 }, frame, 1);
  assert.ok(wide.height >= frame.height - 1e-9 && wide.width >= frame.width);
  // Corrupt overscan falls back to cover.
  assert.deepEqual(homeImageLayout(phone, frame, NaN), plain);
});

test('homeImageLayout keeps the Lock crop and still covers after the zoom', () => {
  const frame = { width: 220, height: 477 };
  const photo = { width: 4032, height: 3024 };
  for (const t of [
    { scale: 1, offsetX: -1, offsetY: 0 },
    { scale: 2.5, offsetX: 1, offsetY: -1 },
    { scale: 5, offsetX: 0.3, offsetY: 0.8 },
  ]) {
    for (const z of [1, 1.07, 1.3]) {
      const l = homeImageLayout(photo, frame, z, t);
      assert.ok(l.x <= 1e-9 && l.y <= 1e-9, JSON.stringify({ t, z, l }));
      assert.ok(l.x + l.width >= frame.width - 1e-9);
      assert.ok(l.y + l.height >= frame.height - 1e-9);
    }
  }
  // z = 1 is exactly the Lock layout.
  const t = { scale: 2, offsetX: 0.5, offsetY: -0.5 };
  const lock = homeImageLayout(photo, frame, 1, t);
  const zoomed = homeImageLayout(photo, frame, 1.2, t);
  assert.ok(Math.abs(zoomed.width / lock.width - 1.2) < 1e-9);
});

test('designedColours includes theme art fills and the pattern alternate', () => {
  const th = THEMES[0];
  const cols = designedColours(th.wallpaper);
  for (const c of th.wallpaper.colours) assert.ok(cols.some((x) => x.toLowerCase() === c.toLowerCase()));
  if (th.wallpaper.art) for (const c of Object.values(th.wallpaper.art.colours)) assert.ok(cols.some((x) => x.toLowerCase() === c.toLowerCase()));
  assert.equal(new Set(cols).size, cols.length);
  assert.deepEqual(designedColours({ colours: ['nope'] }), []);
});
