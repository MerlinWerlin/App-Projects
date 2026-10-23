import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SHAPES,
  shapePath,
  squirclePath,
  circlePath,
  roundedRectPath,
  blobPath,
  blobPoints,
  superellipsePoints,
  smoothClosedPath,
  gradientVector,
  glyphBox,
  clampGlyphScale,
  hashSeed,
  hairline,
  fmt,
  GLYPH_SCALE_DEFAULT,
  SHAPE_LABELS,
  SQUARE_RADIUS,
  IOS_MASK_RADIUS,
  IOS_MASK_EXPLAINER,
  iosMaskPath,
  iosMaskPoints,
  shapeChangesOnIphone,
  shapeOnIphoneNote,
} from './shapes.ts';

/** All numbers in a path string. */
function nums(d: string): number[] {
  return (d.match(/-?\d*\.?\d+(?:e-?\d+)?/g) ?? []).map(Number);
}

function assertValidPath(d: string, size: number) {
  assert.match(d, /^M/);
  assert.match(d, /Z$/);
  assert.ok(!/NaN|Infinity|undefined/.test(d), d);
  assert.match(d, /^[MLHVCAZ0-9 .\-e]+$/);
  for (const n of nums(d)) assert.ok(Number.isFinite(n));
  assert.ok(size > 0);
}

test('every shape yields a valid closed path at 180 and 360', () => {
  for (const size of [60, 180, 360]) {
    for (const shape of SHAPES) {
      assertValidPath(shapePath(shape, size, 'camera'), size);
    }
  }
  assert.deepEqual([...SHAPES].sort(), ['blob', 'circle', 'rounded', 'square', 'squircle']);
});

test('squircle points sit on the superellipse and fill the box edges', () => {
  const size = 180;
  const pts = superellipsePoints(size, 5, 64);
  assert.equal(pts.length, 64);
  for (const p of pts) {
    const v = Math.pow(Math.abs((p.x - 90) / 90), 5) + Math.pow(Math.abs((p.y - 90) / 90), 5);
    assert.ok(Math.abs(v - 1) < 1e-9, `off curve: ${v}`);
    assert.ok(p.x >= -1e-9 && p.x <= size + 1e-9 && p.y >= -1e-9 && p.y <= size + 1e-9);
  }
  const xs = pts.map((p) => p.x);
  assert.ok(Math.max(...xs) > 179.99 && Math.min(...xs) < 0.01);
  // Smooth: uses cubic curves only.
  const d = squirclePath(size);
  assert.equal((d.match(/C/g) ?? []).length, 64);
  // Squircle is fuller than a circle: the 45° point is further out than r/√2.
  const diag = pts[8]; // t = 45°
  assert.ok(diag.x - 90 > 90 / Math.SQRT2);
});

test('circle and rounded rect use arcs with the right radius', () => {
  assert.equal(circlePath(180), 'M0 90A90 90 0 1 0 180 90A90 90 0 1 0 0 90Z');
  const r = roundedRectPath(100);
  assert.ok(r.startsWith('M22 0H78A22 22 0 0 1 100 22'), r);
  assert.equal((r.match(/A/g) ?? []).length, 4);
  // Radius fraction is clamped to 0..0.5.
  assert.ok(roundedRectPath(100, 2).startsWith('M50 0H50'));
});

test('blob is deterministic per seed, 6–8 points, stays inside the box', () => {
  assert.equal(blobPath(180, 'spotify-ish'), blobPath(180, 'spotify-ish'));
  assert.equal(blobPath(180, 42), blobPath(180, 42));
  assert.notEqual(blobPath(180, 'camera'), blobPath(180, 'photos'));
  const counts = new Set<number>();
  for (let s = 0; s < 200; s++) {
    const pts = blobPoints(180, s);
    counts.add(pts.length);
    assert.ok(pts.length >= 6 && pts.length <= 8);
    const d = blobPath(180, s);
    assert.equal((d.match(/C/g) ?? []).length, pts.length);
    for (const n of nums(d)) assert.ok(n >= -2 && n <= 182, `blob ${s} escapes box: ${n}`);
  }
  assert.deepEqual([...counts].sort(), [6, 7, 8]);
});

test('smoothClosedPath passes through every point', () => {
  const pts = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
  ];
  const d = smoothClosedPath(pts);
  assert.ok(d.startsWith('M0 0C'));
  assert.ok(d.includes(' 10 0C') && d.includes(' 10 10C') && d.endsWith(' 0 0Z'));
  assert.throws(() => smoothClosedPath(pts.slice(0, 2)));
});

test('gradientVector follows CSS angles', () => {
  assert.deepEqual(gradientVector(180), { x1: 0.5, y1: 0, x2: 0.5, y2: 1 });
  assert.deepEqual(gradientVector(90), { x1: 0, y1: 0.5, x2: 1, y2: 0.5 });
  assert.deepEqual(gradientVector(0), { x1: 0.5, y1: 1, x2: 0.5, y2: 0 });
  assert.deepEqual(gradientVector(270), { x1: 1, y1: 0.5, x2: 0, y2: 0.5 });
  const d = gradientVector(135);
  assert.ok(d.x1 < d.x2 && d.y1 < d.y2);
  assert.deepEqual(gradientVector(NaN), gradientVector(180));
  for (const a of [0, 33, 135, 400, -45]) {
    const v = gradientVector(a);
    for (const n of [v.x1, v.y1, v.x2, v.y2]) assert.ok(n >= 0 && n <= 1);
  }
});

test('glyphBox is centred and scale is clamped', () => {
  assert.deepEqual(glyphBox(180, 0.5), { x: 45, y: 45, size: 90 });
  assert.deepEqual(glyphBox(100, 5), { x: 5, y: 5, size: 90 });
  assert.deepEqual(glyphBox(100, 0), { x: 40, y: 40, size: 20 });
  assert.equal(clampGlyphScale(NaN), GLYPH_SCALE_DEFAULT);
  const b = glyphBox(360, 0.62);
  assert.ok(Math.abs(b.x * 2 + b.size - 360) < 1e-9);
});

test('helpers: hashSeed, fmt, hairline', () => {
  assert.equal(hashSeed(''), 0x811c9dc5);
  assert.equal(hashSeed('camera'), hashSeed('camera'));
  assert.notEqual(hashSeed('camera'), hashSeed('Camera'));
  assert.equal(fmt(1.23456), '1.235');
  assert.equal(fmt(-0.0001), '0');
  assert.equal(hairline(180), 1);
  assert.equal(hairline(360), 2);
  assert.equal(hairline(60), 1);
});

test('square: a plain square with a small documented corner, distinct from rounded', () => {
  assert.equal(SQUARE_RADIUS, 0.04);
  assert.equal(shapePath('square', 100), roundedRectPath(100, SQUARE_RADIUS));
  assert.ok(shapePath('square', 100).startsWith('M4 0H96A4 4 0 0 1 100 4'), shapePath('square', 100));
  assert.notEqual(shapePath('square', 100), shapePath('rounded', 100));
  for (const shape of SHAPES) assert.ok(SHAPE_LABELS[shape].length > 0, shape);
  assert.equal(SHAPE_LABELS.square, 'Square');
});

test('iOS mask: closed continuous rounded square inside the box, straight edges, symmetric', () => {
  for (const size of [48, 60, 180]) {
    const d = iosMaskPath(size);
    assertValidPath(d, size);
    const pts = iosMaskPoints(size);
    for (const p of pts) assert.ok(p.x >= -1e-9 && p.x <= size + 1e-9 && p.y >= -1e-9 && p.y <= size + 1e-9);
    // Touches all four edges (full-bleed square with rounded corners).
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    assert.ok(Math.min(...xs) < 1e-6 && Math.max(...xs) > size - 1e-6);
    assert.ok(Math.min(...ys) < 1e-6 && Math.max(...ys) > size - 1e-6);
    // Mirror symmetric: every point has a partner reflected across the vertical centre line.
    for (const p of pts) assert.ok(pts.some((q) => Math.abs(q.x - (size - p.x)) < 1e-6 && Math.abs(q.y - p.y) < 1e-6));
  }
  // The very corner is cut away (a mask, not a square), but less than a circle would cut.
  const pts = iosMaskPoints(100, 32);
  const diag = pts.reduce((best, p) => (Math.abs(p.x - p.y) < 1e-6 && p.x < 50 && (!best || p.x < best.x) ? p : best), null as null | { x: number; y: number });
  assert.ok(diag, 'has a 45° point on the top-left corner');
  const cut = diag!.x;
  // A plain circular corner of radius 22.37 would sit at r(1 - 1/√2) ≈ 6.55 from the corner.
  assert.ok(cut > 3 && cut < 15, `corner cut ${cut}`);
  assert.ok(IOS_MASK_RADIUS > 0.2 && IOS_MASK_RADIUS < 0.25);
});

test('iPhone copy is honest: circle and blob never promised as true shapes', () => {
  assert.match(IOS_MASK_EXPLAINER, /rounded square/);
  assert.match(IOS_MASK_EXPLAINER, /circle and blob/);
  assert.equal(shapeChangesOnIphone('circle'), true);
  assert.equal(shapeChangesOnIphone('blob'), true);
  for (const s of ['squircle', 'rounded', 'square'] as const) assert.equal(shapeChangesOnIphone(s), false);
  for (const shape of SHAPES) {
    const note = shapeOnIphoneNote(shape);
    assert.ok(note.length > 10 && note.length < 120, note);
    if (shapeChangesOnIphone(shape)) assert.match(note, /inside iOS’s rounded square/);
    assert.ok(!/true circle|perfect circle/i.test(note), note);
  }
});
