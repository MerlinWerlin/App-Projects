// Overlay transform: composition order, focal-point invariants, clamping, lock, mirror, fit, NaN guards.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_SCALE,
  MIN_SCALE,
  applyGesture,
  clampScale,
  fitScale,
  fitToView,
  identity,
  imageToView,
  normalizeAngle,
  pan,
  pinch,
  reset,
  rotate,
  setLocked,
  toStyle,
  toggleMirror,
  viewToImage,
  type Transform,
} from './transform.ts';

const EPS = 1e-9;
const near = (a: number, b: number, msg?: string) => assert.ok(Math.abs(a - b) < EPS, msg ?? `${a} ≉ ${b}`);
const nearPt = (p: { x: number; y: number }, q: { x: number; y: number }) => {
  near(p.x, q.x, `x ${p.x} ≉ ${q.x}`);
  near(p.y, q.y, `y ${p.y} ≉ ${q.y}`);
};
const T = (o: Partial<Transform>): Transform => ({ ...identity(), ...o });

test('identity is centred, unit scale, unrotated, unmirrored, unlocked', () => {
  assert.deepEqual(identity(), { x: 0, y: 0, scale: 1, rotation: 0, mirror: false, locked: false });
  assert.notEqual(identity(), identity(), 'fresh object each call');
});

test('clampScale clamps to 0.1–8 and guards non-finite', () => {
  assert.equal(MIN_SCALE, 0.1);
  assert.equal(MAX_SCALE, 8);
  assert.equal(clampScale(0.01), 0.1);
  assert.equal(clampScale(100), 8);
  assert.equal(clampScale(2.5), 2.5);
  assert.equal(clampScale(NaN), 1);
  assert.equal(clampScale(Infinity), 8);
  assert.equal(clampScale(-Infinity), 0.1);
  assert.equal(clampScale(-3), 0.1);
});

test('normalizeAngle wraps into [-π, π)', () => {
  near(normalizeAngle(3 * Math.PI), -Math.PI);
  near(normalizeAngle(Math.PI / 2 + 4 * Math.PI), Math.PI / 2);
  near(normalizeAngle(-Math.PI / 2 - 2 * Math.PI), -Math.PI / 2);
  assert.equal(normalizeAngle(NaN), 0);
});

test('imageToView and viewToImage are inverses (with mirror and rotation)', () => {
  const t = T({ x: 12, y: -7, scale: 2.3, rotation: 0.7, mirror: true });
  const p = { x: 31, y: -4 };
  nearPt(viewToImage(t, imageToView(t, p.x, p.y).x, imageToView(t, p.x, p.y).y), p);
});

test('pan translates and is immutable', () => {
  const t0 = identity();
  const t1 = pan(t0, 10, -5);
  assert.deepEqual(t0, identity());
  assert.equal(t1.x, 10);
  assert.equal(t1.y, -5);
  const t2 = pan(t1, 1, 1);
  assert.equal(t2.x, 11);
  assert.equal(t2.y, -4);
});

test('pinch keeps the image point under the focal point fixed', () => {
  const t = T({ x: 40, y: -20, scale: 1.5, rotation: 0.4, mirror: true });
  const focal = { x: -60, y: 85 };
  const under = viewToImage(t, focal.x, focal.y);
  for (const f of [0.5, 1.7, 3]) {
    const p = pinch(t, f, focal.x, focal.y);
    near(p.scale, t.scale * f);
    nearPt(imageToView(p, under.x, under.y), focal);
    near(p.rotation, t.rotation);
  }
});

test('pinch about the overlay centre does not move it', () => {
  const t = T({ x: 30, y: 30 });
  const p = pinch(t, 2, 30, 30);
  assert.equal(p.x, 30);
  assert.equal(p.y, 30);
  assert.equal(p.scale, 2);
});

test('pinch clamps at 8 and 0.1 and keeps the focal invariant at the clamp', () => {
  const t = T({ x: 10, y: 10, scale: 4 });
  const big = pinch(t, 10, -50, 20);
  assert.equal(big.scale, 8);
  const under = viewToImage(t, -50, 20);
  nearPt(imageToView(big, under.x, under.y), { x: -50, y: 20 });

  const small = pinch(t, 0.0001, 100, 100);
  assert.equal(small.scale, 0.1);
  const under2 = viewToImage(t, 100, 100);
  nearPt(imageToView(small, under2.x, under2.y), { x: 100, y: 100 });

  const atMax = T({ scale: 8, x: 5, y: 5 });
  assert.deepEqual(pinch(atMax, 2, 0, 0), atMax, 'already at max: nothing moves');
});

test('rotate about the overlay centre by default, about a focal point when given', () => {
  const t = T({ x: 10, y: 0, rotation: 0 });
  const r = rotate(t, Math.PI / 2);
  near(r.rotation, Math.PI / 2);
  near(r.x, 10);
  near(r.y, 0);

  const rf = rotate(t, Math.PI / 2, 0, 0);
  near(rf.x, 0);
  near(rf.y, 10);

  const t2 = T({ x: -15, y: 22, scale: 2, rotation: 1, mirror: true });
  const focal = { x: 33, y: -8 };
  const under = viewToImage(t2, focal.x, focal.y);
  nearPt(imageToView(rotate(t2, -0.9, focal.x, focal.y), under.x, under.y), focal);
});

test('rotation is normalised', () => {
  const r = rotate(T({ rotation: Math.PI - 0.1 }), 0.3);
  near(r.rotation, -Math.PI + 0.2);
});

test('applyGesture: scale+rotate about focal, then pan (composition order)', () => {
  const start = T({ x: 20, y: -10, scale: 1.2, rotation: 0.3, mirror: true });
  const g = { dx: 15, dy: -25, scale: 1.8, rotation: 0.5, focalX: -40, focalY: 60 };
  const out = applyGesture(start, g);
  const expected = pan(rotate(pinch(start, g.scale, g.focalX, g.focalY), g.rotation, g.focalX, g.focalY), g.dx, g.dy);
  assert.deepEqual(out, expected);

  // The image point under the starting focal point ends up at focal + pan.
  const under = viewToImage(start, g.focalX, g.focalY);
  nearPt(imageToView(out, under.x, under.y), { x: g.focalX + g.dx, y: g.focalY + g.dy });
  near(out.scale, 1.2 * 1.8);
  near(out.rotation, 0.8);

  // Pan-before-scale gives a different answer, so the order matters.
  const wrongOrder = rotate(pinch(pan(start, g.dx, g.dy), g.scale, g.focalX, g.focalY), g.rotation, g.focalX, g.focalY);
  assert.ok(Math.abs(wrongOrder.x - out.x) > 1 || Math.abs(wrongOrder.y - out.y) > 1);
});

test('applyGesture is computed from the start snapshot (idempotent for the same cumulative values)', () => {
  const start = T({ scale: 2 });
  const g = { dx: 5, dy: 5, scale: 1.5, rotation: 0.2, focalX: 0, focalY: 0 };
  assert.deepEqual(applyGesture(start, g), applyGesture(start, g));
  assert.deepEqual(applyGesture(start, { dx: 0, dy: 0, scale: 1, rotation: 0, focalX: 9, focalY: 9 }), start);
});

test('applyGesture clamps scale', () => {
  const start = T({ scale: 2 });
  assert.equal(applyGesture(start, { dx: 0, dy: 0, scale: 50, rotation: 0, focalX: 0, focalY: 0 }).scale, 8);
  assert.equal(applyGesture(start, { dx: 0, dy: 0, scale: 0.001, rotation: 0, focalX: 0, focalY: 0 }).scale, 0.1);
});

test('applyGesture guards NaN/Infinity fields', () => {
  const start = T({ x: 3, y: 4, scale: 2 });
  const out = applyGesture(start, { dx: NaN, dy: Infinity, scale: NaN, rotation: -Infinity, focalX: NaN, focalY: 0 });
  assert.deepEqual(out, start);
  const partial = applyGesture(start, { dx: 7, dy: NaN, scale: 0, rotation: NaN, focalX: 0, focalY: 0 });
  assert.equal(partial.x, 10);
  assert.equal(partial.y, 4);
  assert.equal(partial.scale, 2);
  for (const v of Object.values(out)) if (typeof v === 'number') assert.ok(Number.isFinite(v));
});

test('pan/pinch/rotate ignore non-finite inputs', () => {
  const t = T({ x: 1, y: 2, scale: 3, rotation: 0.5 });
  assert.equal(pan(t, NaN, 1), t);
  assert.equal(pan(t, 1, Infinity), t);
  assert.equal(pinch(t, NaN, 0, 0), t);
  assert.equal(pinch(t, 2, NaN, 0), t);
  assert.equal(pinch(t, -1, 0, 0), t);
  assert.equal(pinch(t, 0, 0, 0), t);
  assert.equal(rotate(t, NaN), t);
  assert.deepEqual(rotate(t, 0.1, NaN, NaN), rotate(t, 0.1), 'bad focal → overlay centre');
});

test('locked transform ignores every gesture', () => {
  const t = setLocked(T({ x: 5, y: 6, scale: 2, rotation: 0.3 }), true);
  assert.equal(t.locked, true);
  assert.equal(pan(t, 10, 10), t);
  assert.equal(pinch(t, 2, 0, 0), t);
  assert.equal(rotate(t, 1, 0, 0), t);
  assert.equal(applyGesture(t, { dx: 10, dy: 10, scale: 3, rotation: 1, focalX: 0, focalY: 0 }), t);
  assert.equal(toggleMirror(t), t);
  const unlocked = setLocked(t, false);
  assert.equal(unlocked.locked, false);
  assert.equal(pan(unlocked, 1, 0).x, 6);
});

test('setLocked returns the same object when unchanged', () => {
  const t = identity();
  assert.equal(setLocked(t, false), t);
});

test('toggleMirror flips the flag only, and toStyle reflects it in scaleX', () => {
  const t = T({ x: 9, y: 8, scale: 2, rotation: 0.4 });
  const m = toggleMirror(t);
  assert.equal(m.mirror, true);
  assert.deepEqual({ ...m, mirror: false }, t);
  assert.deepEqual(toStyle(m)[4], { scaleX: -1 });
  assert.deepEqual(toStyle(toggleMirror(m))[4], { scaleX: 1 });
  assert.equal(toggleMirror(m).mirror, false);
});

test('mirror keeps the overlay centre fixed but flips image points', () => {
  const t = T({ x: 10, y: 0 });
  const m = toggleMirror(t);
  nearPt(imageToView(m, 0, 0), { x: 10, y: 0 });
  nearPt(imageToView(m, 5, 0), { x: 5, y: 0 });
});

test('toStyle produces RN transform array in translate, rotate, scale, scaleX order', () => {
  const s = toStyle(T({ x: 12, y: -4, scale: 1.5, rotation: Math.PI / 2 }));
  assert.deepEqual(s, [{ translateX: 12 }, { translateY: -4 }, { rotate: '90deg' }, { scale: 1.5 }, { scaleX: 1 }]);
  const bad = toStyle({ x: NaN, y: Infinity, scale: NaN, rotation: NaN, mirror: false, locked: false });
  assert.deepEqual(bad, [{ translateX: 0 }, { translateY: 0 }, { rotate: '0deg' }, { scale: 1 }, { scaleX: 1 }]);
});

test('fitScale fits the image inside the view with a margin', () => {
  near(fitScale(1000, 500, 400, 800), 0.4 * 0.9);
  near(fitScale(500, 1000, 400, 800), 0.8 * 0.9);
  near(fitScale(100, 100, 400, 400, 1), 4);
  assert.equal(fitScale(10, 10, 1000, 1000, 1), 8, 'clamped to MAX_SCALE');
  assert.equal(fitScale(100000, 100000, 100, 100), 0.1, 'clamped to MIN_SCALE');
  assert.equal(fitScale(0, 100, 400, 400), 1);
  assert.equal(fitScale(NaN, 100, 400, 400), 1);
  assert.equal(fitScale(100, 100, -1, 400), 1);
  near(fitScale(100, 100, 400, 400, NaN), 3.6, 'bad margin → default 0.9');
});

test('fitToView centres an unrotated, unmirrored, unlocked overlay', () => {
  const t = fitToView(800, 600, 390, 844);
  assert.deepEqual(t, { x: 0, y: 0, scale: fitScale(800, 600, 390, 844), rotation: 0, mirror: false, locked: false });
  // Rendered width fits within margin × view.
  assert.ok(800 * t.scale <= 390 * 0.9 + EPS);
  assert.ok(600 * t.scale <= 844 * 0.9 + EPS);
});

test('reset returns fitted state and keeps the mirror flag', () => {
  assert.deepEqual(reset(800, 600, 390, 844), fitToView(800, 600, 390, 844));
  const r = reset(800, 600, 390, 844, true);
  assert.equal(r.mirror, true);
  assert.equal(r.locked, false);
  assert.equal(r.x, 0);
  assert.equal(r.rotation, 0);
});
