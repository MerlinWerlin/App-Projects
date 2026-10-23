import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEVICES } from './loop.ts';
import { isHex } from './colour.ts';
import {
  MAX_BLOBS,
  MAX_GRAIN_DOTS,
  MAX_SHAPES,
  WALLPAPER_KINDS,
  WALLPAPER_PATTERNS,
  WALLPAPER_SIZES,
  averageColour,
  exportPlan,
  isValidWallpaper,
  layoutWallpaper,
  nextSeed,
  randomise,
  sizeForScreen,
  wallpaperErrors,
  wallpaperSize,
  type WallpaperLayout,
  type WallpaperParams,
} from './wallpaper.ts';

const COLS = ['#3A1235', '#7A2E6B', '#E0794F'];

function allParams(seed: number): WallpaperParams[] {
  const out: WallpaperParams[] = [];
  for (const kind of WALLPAPER_KINDS) {
    if (kind === 'pattern') {
      for (const pattern of WALLPAPER_PATTERNS) out.push({ kind, pattern, colours: COLS, seed, angle: 160, grain: 0.3 });
    } else {
      out.push({ kind, colours: COLS, seed, angle: 160, grain: 0.3 });
    }
  }
  return out;
}

function nums(d: string): number[] {
  return (d.match(/-?\d*\.?\d+(?:e-?\d+)?/g) ?? []).map(Number);
}

function assertInBounds(l: WallpaperLayout) {
  const { width: w, height: h } = l;
  const eps = 0.011;
  const inX = (x: number) => x >= -eps && x <= w + eps;
  const inY = (y: number) => y >= -eps && y <= h + eps;
  assert.ok(isHex(l.base));
  if (l.gradient) {
    const v = l.gradient.vector;
    for (const n of [v.x1, v.y1, v.x2, v.y2]) assert.ok(n >= 0 && n <= 1, `vector ${n}`);
    for (const s of l.gradient.stops) {
      assert.ok(s.offset >= 0 && s.offset <= 1);
      assert.ok(isHex(s.colour));
    }
  }
  for (const b of l.blobs) {
    assert.ok(inX(b.cx) && inY(b.cy), `blob centre ${b.cx},${b.cy}`);
    assert.ok(b.r > 0 && b.r <= Math.max(w, h));
    assert.ok(b.opacity > 0 && b.opacity <= 1);
  }
  for (const s of l.shapes) {
    assert.ok(s.opacity > 0 && s.opacity <= 1);
    if (s.type === 'rect') {
      assert.ok(inX(s.x) && inY(s.y) && inX(s.x + s.width) && inY(s.y + s.height), `rect ${JSON.stringify(s)}`);
      assert.ok(s.width > 0 && s.height > 0);
    } else if (s.type === 'circle') {
      assert.ok(inX(s.cx) && inY(s.cy) && s.r > 0, `circle ${JSON.stringify(s)}`);
    } else {
      assert.match(s.d, /^M/);
      assert.ok(!/NaN|Infinity|undefined/.test(s.d));
      const n = nums(s.d);
      assert.equal(n.length % 2, 0);
      for (let i = 0; i < n.length; i += 2) assert.ok(inX(n[i]) && inY(n[i + 1]), `path point ${n[i]},${n[i + 1]}`);
    }
  }
  for (const g of l.grain) {
    assert.ok(inX(g.cx) && inY(g.cy) && g.r > 0);
    assert.ok(g.opacity > 0 && g.opacity <= 1);
  }
}

test('layout is deterministic for the same seed', () => {
  for (const p of allParams(42)) {
    assert.deepEqual(layoutWallpaper(p, 390, 844), layoutWallpaper({ ...p, colours: [...p.colours] }, 390, 844));
  }
});

test('a different seed gives a different layout (for seeded kinds)', () => {
  for (const p of allParams(42)) {
    const a = layoutWallpaper(p, 390, 844);
    const b = layoutWallpaper({ ...p, seed: 43 }, 390, 844);
    assert.notDeepEqual(a, b, `${p.kind}/${p.pattern ?? ''}`);
  }
});

test('every primitive stays inside the canvas', () => {
  for (const seed of [0, 1, 7, 99, 123456]) {
    for (const p of allParams(seed)) {
      for (const [w, h] of [[390, 844], [1320, 2868], [60, 130]]) assertInBounds(layoutWallpaper(p, w, h));
    }
  }
});

test('primitive counts are capped, even at full device resolution', () => {
  for (const p of allParams(5)) {
    const l = layoutWallpaper({ ...p, grain: 1 }, 1320, 2868);
    assert.ok(l.blobs.length <= MAX_BLOBS);
    assert.ok(l.shapes.length <= MAX_SHAPES, `${p.pattern} ${l.shapes.length}`);
    assert.ok(l.grain.length <= MAX_GRAIN_DOTS);
  }
  const tiny = layoutWallpaper({ kind: 'pattern', pattern: 'dots', colours: COLS, seed: 1 }, 4000, 9000);
  assert.ok(tiny.shapes.length <= MAX_SHAPES);
});

test('kinds produce the expected primitive families', () => {
  const mesh = layoutWallpaper({ kind: 'mesh', colours: COLS, seed: 3 }, 390, 844);
  assert.ok(mesh.blobs.length >= 3);
  const pat = layoutWallpaper({ kind: 'pattern', pattern: 'checker', colours: COLS, seed: 3 }, 390, 844);
  assert.ok(pat.shapes.length > 10);
  const grain = layoutWallpaper({ kind: 'grain', colours: COLS, seed: 3 }, 390, 844);
  assert.ok(grain.grain.length > 100);
  const plain = layoutWallpaper({ kind: 'gradient', colours: COLS, seed: 3 }, 390, 844);
  assert.equal(plain.grain.length, 0);
  assert.equal(plain.gradient?.stops.length, 3);
  assert.equal(plain.gradient?.stops[2].offset, 1);
});

test('layout tolerates bad input', () => {
  const l = layoutWallpaper({ kind: 'gradient', colours: ['nope'], seed: Number.NaN }, 0, -5);
  assert.ok(l.width >= 1 && l.height >= 1);
  assert.ok(isHex(l.base));
});

test('validation', () => {
  assert.ok(isValidWallpaper({ kind: 'gradient', colours: COLS, seed: 1 }));
  assert.ok(!isValidWallpaper({ kind: 'pattern', colours: COLS, seed: 1 }));
  assert.ok(wallpaperErrors({ kind: 'gradient', colours: ['#000000'], seed: 1 }).length > 0);
  assert.ok(wallpaperErrors({ kind: 'gradient', colours: COLS, seed: 1, grain: 2 }).length > 0);
  assert.ok(wallpaperErrors({ kind: 'gradient', colours: COLS, seed: -1 }).length > 0);
});

test('averageColour', () => {
  assert.equal(averageColour({ kind: 'gradient', colours: ['#000000', '#FFFFFF'], seed: 1 }), '#808080');
  // mesh weights the base twice
  assert.equal(averageColour({ kind: 'mesh', colours: ['#000000', '#FFFFFF'], seed: 1 }), '#555555');
});

test('randomise is deterministic, keeps colours and kind, changes seed', () => {
  const p: WallpaperParams = { kind: 'mesh', colours: COLS, seed: 1, angle: 10 };
  const a = randomise(p, 77);
  assert.deepEqual(a, randomise(p, 77));
  assert.equal(a.seed, 77);
  assert.deepEqual(a.colours, COLS);
  assert.notEqual(a.colours, p.colours);
  assert.equal(a.kind, 'mesh');
  assert.ok(isValidWallpaper(a));
  assert.ok(Number.isInteger(nextSeed(1, 2)) && nextSeed(1, 2) >= 0);
  assert.notEqual(nextSeed(1, 2), nextSeed(1, 3));
});

test('wallpaper sizes match the device table (portrait pixels)', () => {
  assert.equal(WALLPAPER_SIZES.length, DEVICES.length);
  for (const d of DEVICES) {
    const s = wallpaperSize(d.id);
    assert.ok(s);
    assert.equal(s.width, d.pixels.width);
    assert.equal(s.height, d.pixels.height);
    assert.ok(s.height > s.width);
  }
  assert.equal(sizeForScreen(440, 956).id, '6.9');
  assert.equal(sizeForScreen(852, 393).id, '6.1-di');
});

test('export plan lands on exact device pixels', () => {
  for (const s of WALLPAPER_SIZES) {
    const ios = exportPlan(s, 3, 'ios');
    assert.deepEqual(ios.pixels, { width: s.width, height: s.height });
    // iOS view-shot multiplies points by the screen scale.
    assert.equal(Math.round(ios.capture.width * 3), s.width);
    assert.equal(Math.round(ios.capture.height * 3), s.height);
    assert.equal(Math.round(ios.layout.width * 3), s.width);
    const android = exportPlan(s, 2.625, 'android');
    assert.deepEqual(android.capture, { width: s.width, height: s.height });
    assert.ok(Math.abs(android.layout.width * 2.625 - s.width) < 1e-6);
  }
});
