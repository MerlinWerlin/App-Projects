import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CLOCK_BAND,
  COLLAGE_SPACINGS,
  COLLAGE_STYLES,
  MAX_PHOTOS,
  MIN_PHOTOS,
  clampPhotoCount,
  collageBackground,
  collageRects,
  collageStyleKey,
  coverFit,
  cycleLayout,
  defaultGutter,
  layoutFor,
  layoutsFor,
  leafCount,
  rectsOverlap,
  scaleRects,
  spacingOptions,
  splitSpan,
  type CollageRect,
  type CollageSize,
} from './collage.ts';

const SIZES: CollageSize[] = [
  { width: 1290, height: 2796 }, // 6.7" / 6.9"
  { width: 1179, height: 2556 }, // 6.1"
  { width: 1170, height: 2532 },
  { width: 1080, height: 2340 }, // mini
  { width: 750, height: 1334 }, // SE
  { width: 1320, height: 2868 },
];

function eachLayout(fn: (n: number, id: string, size: CollageSize) => void): void {
  for (let n = MIN_PHOTOS; n <= MAX_PHOTOS; n++) for (const l of layoutsFor(n)) for (const s of SIZES) fn(n, l.id, s);
}

function bandRange(size: CollageSize): [number, number] {
  return [Math.floor(size.height * CLOCK_BAND.top), Math.ceil(size.height * CLOCK_BAND.bottom)];
}

test('every count 2..6 has several layouts with unique ids, clock-clear ones first', () => {
  for (let n = MIN_PHOTOS; n <= MAX_PHOTOS; n++) {
    const list = layoutsFor(n);
    assert.ok(list.length >= 4, `n=${n}`);
    assert.equal(new Set(list.map((l) => l.id)).size, list.length);
    assert.ok(list.filter((l) => l.clockClear).length >= 3);
    assert.equal(list[0].clockClear, true);
    const firstFull = list.findIndex((l) => !l.clockClear);
    assert.ok(list.slice(firstFull).every((l) => !l.clockClear), 'clear layouts come first');
    for (const l of list) {
      assert.equal(l.count, n);
      assert.equal(leafCount(l.tree), n, `${n}/${l.id} holds n photos`);
      assert.ok(COLLAGE_STYLES.includes(l.style));
    }
  }
});

test('clampPhotoCount keeps n in 2..6', () => {
  assert.equal(clampPhotoCount(0), 2);
  assert.equal(clampPhotoCount(1), 2);
  assert.equal(clampPhotoCount(-4), 2);
  assert.equal(clampPhotoCount(4.9), 4);
  assert.equal(clampPhotoCount(7), 6);
  assert.equal(clampPhotoCount(100), 6);
  assert.equal(clampPhotoCount(Number.NaN), 2);
  assert.equal(clampPhotoCount(Number.POSITIVE_INFINITY), 2);
  assert.deepEqual(layoutsFor(9), layoutsFor(6));
  assert.deepEqual(layoutsFor(1), layoutsFor(2));
  assert.equal(collageRects(9, 'grid-clear', SIZES[0]).rects.length, 6);
  assert.equal(collageRects(1, 'grid-clear', SIZES[0]).rects.length, 2);
});

test('rects: right count, whole pixels, inside the canvas, at least 1 px', () => {
  eachLayout((n, id, size) => {
    const { rects, layout } = collageRects(n, id, size);
    assert.equal(layout.id, id);
    assert.equal(rects.length, n, `${n}/${id}`);
    for (const r of rects) {
      for (const v of [r.x, r.y, r.w, r.h, r.r]) assert.ok(Number.isInteger(v), `${n}/${id} integer ${v}`);
      assert.ok(r.x >= 0 && r.y >= 0, `${n}/${id}`);
      assert.ok(r.w >= 1 && r.h >= 1);
      assert.ok(r.x + r.w <= size.width, `${n}/${id} right edge`);
      assert.ok(r.y + r.h <= size.height, `${n}/${id} bottom edge`);
      assert.ok(r.r * 2 <= Math.min(r.w, r.h));
    }
  });
});

test('rects never overlap', () => {
  eachLayout((n, id, size) => {
    const { rects } = collageRects(n, id, size);
    for (let i = 0; i < rects.length; i++)
      for (let j = i + 1; j < rects.length; j++) assert.equal(rectsOverlap(rects[i], rects[j]), false, `${n}/${id} ${i}-${j}`);
  });
});

test('gutters are respected between neighbours and at the outer margin', () => {
  eachLayout((n, id, size) => {
    const g = defaultGutter(size);
    const { rects } = collageRects(n, id, size, { gutter: g });
    for (const r of rects) {
      assert.ok(r.x >= g && r.y >= g, `${n}/${id} margin`);
      assert.ok(size.width - (r.x + r.w) >= g && size.height - (r.y + r.h) >= g);
    }
    // Any two tiles sharing a vertical span are at least a gutter apart horizontally, and vice versa.
    for (let i = 0; i < rects.length; i++)
      for (let j = 0; j < rects.length; j++) {
        if (i === j) continue;
        const a = rects[i];
        const b = rects[j];
        const shareRows = a.y < b.y + b.h && b.y < a.y + a.h;
        const shareCols = a.x < b.x + b.w && b.x < a.x + a.w;
        if (shareRows && a.x + a.w <= b.x) assert.ok(b.x - (a.x + a.w) >= g, `${n}/${id} h-gap`);
        if (shareCols && a.y + a.h <= b.y) assert.ok(b.y - (a.y + a.h) >= g, `${n}/${id} v-gap`);
      }
  });
});

test('clock-clear layouts keep every photo out of the clock band (and report it)', () => {
  eachLayout((n, id, size) => {
    const res = collageRects(n, id, size);
    const [top, bottom] = bandRange(size);
    if (!res.layout.clockClear) {
      assert.equal(res.band, null);
      return;
    }
    assert.deepEqual(res.band, { y: top, h: bottom - top });
    for (const r of res.rects) {
      assert.ok(r.y >= bottom, `${n}/${id} starts below the band`);
      assert.equal(rectsOverlap(r, { x: 0, y: top, w: size.width, h: bottom - top }), false);
    }
  });
});

test('full-bleed grid fills the canvas minus margins (no wasted band)', () => {
  const size = SIZES[0];
  const { rects } = collageRects(4, 'grid-full', size, { gutter: 0, radius: 0 });
  const area = rects.reduce((a, r) => a + r.w * r.h, 0);
  assert.equal(area, size.width * size.height);
  assert.ok(rects.some((r) => r.y === 0));
});

test('non-scatter layouts tile their area exactly (gutter 0)', () => {
  for (let n = MIN_PHOTOS; n <= MAX_PHOTOS; n++)
    for (const l of layoutsFor(n)) {
      if (l.scatter) continue;
      const size = SIZES[1];
      const { rects, band } = collageRects(n, l.id, size, { gutter: 0, radius: 0 });
      const area = rects.reduce((a, r) => a + r.w * r.h, 0);
      const top = band ? band.y + band.h : 0;
      assert.equal(area, size.width * (size.height - top), `${n}/${l.id}`);
    }
});

test('scatter tiles sit inside the plain offset cells', () => {
  for (let n = MIN_PHOTOS; n <= MAX_PHOTOS; n++) {
    const plain = collageRects(n, 'offset-clear', SIZES[0]).rects;
    const sc = collageRects(n, 'scatter-clear', SIZES[0]).rects;
    sc.forEach((r, i) => {
      const c = plain[i];
      assert.ok(r.x >= c.x && r.y >= c.y && r.x + r.w <= c.x + c.w && r.y + r.h <= c.y + c.h, `${n}/${i}`);
    });
    assert.ok(sc.some((r, i) => r.w < plain[i].w || r.h < plain[i].h), 'actually inset');
  }
});

test('unknown layout id falls back to the first layout; odd options are sanitised', () => {
  const a = collageRects(3, 'nope', SIZES[0]);
  assert.equal(a.layout.id, layoutsFor(3)[0].id);
  const b = collageRects(3, null, SIZES[0], { gutter: -5, radius: Number.NaN, margin: Number.POSITIVE_INFINITY });
  assert.equal(b.rects.length, 3);
  const huge = collageRects(6, 'strips-clear', { width: 100, height: 200 }, { gutter: 1000 });
  for (const r of huge.rects) assert.ok(r.w >= 1 && r.h >= 1 && r.x + r.w <= 100 && r.y + r.h <= 200);
  const custom = collageRects(2, 'grid-clear', SIZES[0], { band: { top: 0.1, bottom: 0.5 } });
  assert.ok(custom.rects.every((r) => r.y >= Math.ceil(SIZES[0].height * 0.5)));
  assert.deepEqual(collageRects(4, 'grid-full', { width: 0, height: 0 }).rects, []);
});

test('radius clamps to half the short side and spacing presets', () => {
  const { rects } = collageRects(6, 'strips-clear', SIZES[4], { radius: 10_000 });
  for (const r of rects) assert.equal(r.r, Math.floor(Math.min(r.w, r.h) / 2));
  assert.deepEqual(spacingOptions('none', SIZES[0]), { gutter: 0, radius: 0 });
  const thin = spacingOptions('thin', SIZES[0]);
  const wide = spacingOptions('wide', SIZES[0]);
  assert.ok(wide.gutter > thin.gutter && thin.gutter > 0);
  assert.deepEqual([...COLLAGE_SPACINGS], ['none', 'thin', 'wide']);
});

test('layouts scale with device size (same shape on every phone)', () => {
  const a = collageRects(5, 'hero-clear', SIZES[0]).rects;
  const b = collageRects(5, 'hero-clear', SIZES[3]).rects;
  a.forEach((r, i) => {
    assert.ok(Math.abs(r.x / SIZES[0].width - b[i].x / SIZES[3].width) < 0.01);
    assert.ok(Math.abs(r.w / SIZES[0].width - b[i].w / SIZES[3].width) < 0.01);
  });
});

test('hero layout: the first photo is the biggest', () => {
  for (let n = MIN_PHOTOS; n <= MAX_PHOTOS; n++) {
    const { rects } = collageRects(n, 'hero-clear', SIZES[0]);
    const areas = rects.map((r) => r.w * r.h);
    assert.ok(areas.slice(1).every((a) => a <= areas[0]), `n=${n}`);
  }
});

test('cycleLayout wraps both ways', () => {
  const list = layoutsFor(4);
  assert.equal(cycleLayout(4, list[0].id).id, list[1].id);
  assert.equal(cycleLayout(4, list[list.length - 1].id).id, list[0].id);
  assert.equal(cycleLayout(4, list[0].id, -1).id, list[list.length - 1].id);
  assert.equal(cycleLayout(4, list[0].id, list.length).id, list[0].id);
  assert.equal(cycleLayout(4, 'missing').id, list[1].id);
  assert.equal(layoutFor(4, list[2].id).id, list[2].id);
});

test('splitSpan: exact gutters, covers the span, integer sizes', () => {
  const s = splitSpan(10, 1000, [1, 2, 1], 20);
  assert.deepEqual(
    s.map((x) => x.size).reduce((a, b) => a + b, 0) + 40,
    1000,
  );
  assert.equal(s[0].start, 10);
  assert.equal(s[1].start - (s[0].start + s[0].size), 20);
  assert.equal(s[2].start - (s[1].start + s[1].size), 20);
  assert.equal(s[2].start + s[2].size, 1010);
  assert.deepEqual(splitSpan(0, 100, [], 5), []);
  const tight = splitSpan(0, 5, [1, 1, 1], 50);
  assert.ok(tight.every((x) => x.size >= 1));
});

test('coverFit fills the tile and crops the overflow, centred', () => {
  // Landscape photo into a square: crop the sides.
  const f = coverFit({ width: 4000, height: 3000 }, { w: 300, h: 300 });
  assert.equal(f.scale, 0.1);
  assert.deepEqual(f.crop, { x: 500, y: 0, width: 3000, height: 3000 });
  assert.deepEqual(f.draw, { x: -50, y: 0, width: 400, height: 300 });
  // Portrait photo into a wide strip: crop top and bottom.
  const g = coverFit({ width: 1000, height: 2000 }, { w: 500, h: 250 });
  assert.equal(g.scale, 0.5);
  assert.deepEqual(g.crop, { x: 0, y: 750, width: 1000, height: 500 });
  assert.equal(g.draw.width, 500);
  assert.equal(g.draw.height, 1000);
  assert.equal(g.draw.y, -375);
  // The drawn photo always covers the tile.
  for (const img of [{ width: 640, height: 480 }, { width: 3024, height: 4032 }, { width: 100, height: 100 }])
    for (const tile of [{ w: 591, h: 812 }, { w: 1200, h: 300 }, { w: 33, h: 999 }]) {
      const c = coverFit(img, tile);
      assert.ok(c.draw.x <= 1e-9 && c.draw.y <= 1e-9);
      assert.ok(c.draw.x + c.draw.width >= tile.w - 1e-6);
      assert.ok(c.draw.y + c.draw.height >= tile.h - 1e-6);
      assert.ok(Math.abs(c.crop.width / c.crop.height - tile.w / tile.h) < 1e-6);
      assert.ok(c.crop.x >= 0 && c.crop.y >= 0 && c.crop.x + c.crop.width <= img.width + 1e-6 && c.crop.y + c.crop.height <= img.height + 1e-6);
    }
});

test('coverFit focus and degenerate input', () => {
  const top = coverFit({ width: 1000, height: 2000 }, { w: 500, h: 250 }, { x: 0.5, y: 0 });
  assert.equal(top.crop.y, 0);
  const bottom = coverFit({ width: 1000, height: 2000 }, { w: 500, h: 250 }, { x: 0.5, y: 5 });
  assert.equal(bottom.crop.y, 1500);
  const zero = coverFit({ width: 0, height: 100 }, { w: 10, h: 10 });
  assert.equal(zero.scale, 0);
  assert.deepEqual(zero.crop, { x: 0, y: 0, width: 0, height: 0 });
  assert.equal(coverFit({ width: 10, height: 10 }, { w: Number.NaN, h: 5 }).scale, 0);
});

test('scaleRects maps canvas px to preview points', () => {
  const rects: CollageRect[] = [{ x: 129, y: 258, w: 645, h: 1290, r: 52 }];
  assert.deepEqual(scaleRects(rects, 1290, 129), [{ x: 12.9, y: 25.8, w: 64.5, h: 129, r: 5.2 }]);
  assert.deepEqual(scaleRects(rects, 0, 100)[0].w, 0);
});

test('collageBackground picks the first and last theme colours', () => {
  assert.deepEqual(collageBackground(['#111111', '#222222', '#333333'], '#000000'), { from: '#111111', to: '#333333' });
  assert.deepEqual(collageBackground([], '#ABCDEF'), { from: '#ABCDEF', to: '#ABCDEF' });
  assert.deepEqual(collageBackground(null, '#ABCDEF'), { from: '#ABCDEF', to: '#ABCDEF' });
  assert.deepEqual(collageBackground(['red', '#123456'], '#000000'), { from: '#123456', to: '#123456' });
});

test('style keys are under wallpaper.collage.style', () => {
  assert.equal(collageStyleKey('hero'), 'wallpaper.collage.style.hero');
});

test('collage core stays offline and device-only (no network, no RN)', async () => {
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const src = readFileSync(join(process.cwd(), 'src/core/collage.ts'), 'utf8');
  for (const bad of ['fetch(', 'XMLHttpRequest', "from 'react", 'from "react', 'expo-']) assert.equal(src.includes(bad), false, bad);
});
