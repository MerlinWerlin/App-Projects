import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MORPH_MS,
  MORPH_POINTS,
  cubicBezierEase,
  lerpPoints,
  morphEase,
  morphPath,
  morphProgress,
  pointsToPath,
  sampleShape,
  shapeOutline,
} from './shapeMorph.ts';
import { MAX_MS } from './motion.ts';
import { SHAPES } from './shapes.ts';

const dist = (p: { x: number; y: number }, c: number) => Math.hypot(p.x - c, p.y - c);

test('every shape samples to the same point count inside its box', () => {
  for (const shape of SHAPES) {
    const pts = sampleShape(shape, 60, 'music');
    assert.equal(pts.length, MORPH_POINTS, shape);
    for (const p of pts) {
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), shape);
      assert.ok(p.x >= -0.01 && p.x <= 60.01 && p.y >= -0.01 && p.y <= 60.01, `${shape} ${p.x},${p.y}`);
      assert.ok(dist(p, 30) > 15, `${shape} point too close to the centre`);
    }
  }
});

test('first sample is the top centre, then clockwise', () => {
  for (const shape of ['circle', 'squircle', 'rounded', 'square'] as const) {
    const pts = sampleShape(shape, 100);
    assert.ok(Math.abs(pts[0].x - 50) < 1e-6, shape);
    assert.ok(Math.abs(pts[0].y - 0) < 0.05, shape);
    const q = pts[MORPH_POINTS / 4];
    assert.ok(Math.abs(q.x - 100) < 0.05 && Math.abs(q.y - 50) < 1e-6, `${shape} right midpoint`);
  }
});

test('circle samples sit on the radius', () => {
  for (const p of sampleShape('circle', 80)) assert.ok(Math.abs(dist(p, 40) - 40) < 0.02);
});

test('square reaches near its corners, rounded is cut in, circle most', () => {
  const corner = MORPH_POINTS / 8; // 45° ray from the top -> top-right corner
  const sq = dist(sampleShape('square', 100)[corner], 50);
  const rd = dist(sampleShape('rounded', 100)[corner], 50);
  const ci = dist(sampleShape('circle', 100)[corner], 50);
  assert.ok(sq > 69 && sq <= Math.SQRT2 * 50 + 1e-6, `square ${sq}`);
  assert.ok(rd < sq && rd > ci, `rounded ${rd}`);
  assert.ok(Math.abs(ci - 50) < 0.02);
});

test('blob samples are deterministic per seed and differ between seeds', () => {
  assert.deepEqual(sampleShape('blob', 60, 'chat'), sampleShape('blob', 60, 'chat'));
  assert.notDeepEqual(sampleShape('blob', 60, 'chat'), sampleShape('blob', 60, 'camera'));
  for (const p of sampleShape('blob', 60, 'chat')) {
    const r = dist(p, 30);
    assert.ok(r > 0.3 * 60 && r < 0.5 * 60, `blob radius ${r}`);
  }
});

test('shapeOutline returns a dense polygon for every shape', () => {
  for (const shape of SHAPES) assert.ok(shapeOutline(shape, 50, 1).length >= 24, shape);
});

test('lerpPoints endpoints and midpoint', () => {
  const a = sampleShape('circle', 60);
  const b = sampleShape('square', 60);
  assert.deepEqual(lerpPoints(a, b, 0), a);
  assert.deepEqual(lerpPoints(a, b, 1), b);
  const m = lerpPoints(a, b, 0.5)[3];
  assert.ok(Math.abs(m.x - (a[3].x + b[3].x) / 2) < 1e-9);
  assert.deepEqual(lerpPoints(a, b, Number.NaN), a);
  assert.throws(() => lerpPoints(a, b.slice(1), 0.5));
});

test('pointsToPath builds a closed polyline', () => {
  const d = pointsToPath([
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10.12345 },
  ]);
  assert.equal(d, 'M0 0L10 0L10 10.123Z');
  assert.equal(pointsToPath([]), '');
  const md = morphPath(sampleShape('circle', 60), sampleShape('rounded', 60), 0.3);
  assert.ok(md.startsWith('M') && md.endsWith('Z'));
  assert.equal((md.match(/L/g) ?? []).length, MORPH_POINTS - 1);
  assert.ok(!md.includes('NaN'));
});

test('easing: endpoints, monotonic, ease-out ahead of linear', () => {
  assert.equal(morphEase(0), 0);
  assert.equal(morphEase(1), 1);
  let prev = 0;
  for (let i = 1; i <= 100; i++) {
    const v = morphEase(i / 100);
    assert.ok(v >= prev - 1e-9, `monotonic at ${i}`);
    prev = v;
  }
  assert.ok(morphEase(0.3) > 0.5);
  const linear = cubicBezierEase(0, 0, 1, 1);
  assert.ok(Math.abs(linear(0.37) - 0.37) < 1e-4);
});

test('morphProgress clamps and finishes at MORPH_MS', () => {
  assert.ok(MORPH_MS >= 200 && MORPH_MS <= 320 && MORPH_MS <= MAX_MS);
  assert.equal(morphProgress(0), 0);
  assert.equal(morphProgress(-5), 0);
  assert.equal(morphProgress(Number.NaN), 0);
  assert.equal(morphProgress(MORPH_MS), 1);
  assert.equal(morphProgress(MORPH_MS * 3), 1);
  assert.equal(morphProgress(10, 0), 1);
  const mid = morphProgress(MORPH_MS / 2);
  assert.ok(mid > 0.5 && mid < 1);
});
