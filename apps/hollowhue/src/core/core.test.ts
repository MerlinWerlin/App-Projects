import assert from 'node:assert/strict';
import { test } from 'node:test';
import { circle, frame, rect } from './build.ts';
import { bboxOf, flatten, inRings, strokePath } from './geom.ts';
import { apply, emptyProgress, finishStroke, markFound, percent, redo, restoreProgress, strokesNear, undo, type History } from './progress.ts';
import {
  type Scene,
  LEVEL_MIN_PX,
  detailStep,
  shapeOpacity,
  cameraFor,
  clampCamera,
  fitCamera,
  flight,
  hitTest,
  layout,
  toWorld,
  visibleLevels,
  zoomAt,
  zoomLimits,
} from './scene.ts';
import { bookshop } from '../scenes/bookshop.ts';

const tiny: Scene = {
  id: 'tiny',
  theme: 'cute',
  version: 1,
  palette: 'cosy',
  levels: [
    { id: 'a', w: 100, h: 75, regions: [{ id: 'bg', d: rect(0, 0, 100, 75) }, { id: 'dot', d: circle(20, 20, 5) }] },
    { id: 'b', parent: 'a', portal: { x: 40, y: 30, w: 10, h: 7.5 }, w: 100, h: 75, regions: [{ id: 'bg', d: rect(0, 0, 100, 75) }, { id: 'box', d: rect(40, 30, 20, 15) }] },
  ],
};
const SC = { w: 1000, h: 750 };

test('flatten + even-odd hit test handles holes', () => {
  const rings = flatten(frame(0, 0, 100, 100, [[25, 25, 50, 50]]));
  assert.equal(rings.length, 2);
  assert.equal(inRings(rings, 10, 10), true);
  assert.equal(inRings(rings, 50, 50), false);
  const c = flatten(circle(50, 50, 10));
  assert.equal(inRings(c, 50, 50), true);
  assert.equal(inRings(c, 61, 50), false);
  const b = bboxOf(c);
  assert.ok(Math.abs(b.w - 20) < 0.5 && Math.abs(b.h - 20) < 0.5);
});

test('flatten reads relative commands and smooth curves', () => {
  const r = flatten('m10 10 l20 0 l0 20 l-20 0 z');
  assert.equal(inRings(r, 20, 20), true);
  const s = flatten('M0 0 C10 0 20 10 20 20 S30 40 40 40 L0 40 Z');
  assert.ok(s[0]!.length > 10);
  assert.throws(() => flatten('M0 0 A10 10 0 0 1 20 20'));
});

test('stroke path is a smooth line through the points', () => {
  assert.match(strokePath([0, 0, 10, 10, 20, 0]), /^M0 0Q10 10 15 5L20 0$/);
  assert.match(strokePath([5, 5]), /^M5 5l0.01 0$/);
});

test('levels are placed inside their parent portal', () => {
  const L = layout(tiny);
  const b = L.byId.get('b')!;
  assert.equal(b.s, 0.1);
  assert.deepEqual(b.world, { x: 40, y: 30, w: 10, h: 7.5 });
  assert.equal(L.minScale, 0.1);
});

test('zoomAt keeps the point under the fingers fixed', () => {
  const cam = fitCamera(layout(tiny), SC);
  const before = toWorld(cam, SC, 300, 200);
  const after = toWorld(zoomAt(cam, SC, 300, 200, 3.7), SC, 300, 200);
  assert.ok(Math.abs(before.x - after.x) < 1e-9 && Math.abs(before.y - after.y) < 1e-9);
});

test('camera is clamped to the scene and to the zoom range', () => {
  const L = layout(tiny);
  const lim = zoomLimits(L, SC);
  const c = clampCamera(L, SC, { cx: -500, cy: 9999, z: lim.max * 10 });
  assert.equal(c.z, lim.max);
  assert.ok(c.cx >= 0 && c.cy <= 75);
  const out = clampCamera(L, SC, { cx: 3, cy: 3, z: lim.min / 10 });
  assert.equal(out.z, lim.min);
  assert.equal(out.cx, 50);
});

test('a child level is drawn as soon as it is a few px wide, in its exact place', () => {
  const L = layout(tiny);
  const b = L.byId.get('b')!;
  const tooSmall = { cx: 50, cy: 37.5, z: (LEVEL_MIN_PX * 0.9) / b.world.w };
  assert.deepEqual(visibleLevels(L, tooSmall, SC).map((v) => v.level.id), ['a']);
  const fit = fitCamera(L, SC);
  assert.deepEqual(visibleLevels(L, fit, SC).map((v) => v.level.id), ['a', 'b']);
  // Zoomed right into the child: the parent is no longer drawn at all (the child covers the screen).
  const deep = cameraFor(b, SC, 1.5);
  assert.deepEqual(visibleLevels(L, deep, SC).map((v) => v.level.id), ['b']);
  // ...but while any of the parent still shows, both are drawn.
  const edge = cameraFor(b, SC, 0.9);
  assert.deepEqual(visibleLevels(L, edge, SC).map((v) => v.level.id), ['a', 'b']);
});

test('detail fades in smoothly with zoom, never snapping', () => {
  // A 10-unit shape: invisible below 1.5 px, fully drawn by 5 px, in small steps between.
  const seen: number[] = [];
  for (let px = 0.05; px < 1; px *= 1.05) seen.push(shapeOpacity(10, detailStep(px)));
  assert.equal(seen[0], 0);
  assert.equal(seen.at(-1), 1);
  for (let i = 1; i < seen.length; i++) {
    assert.ok(seen[i]! >= seen[i - 1]!, 'monotonic');
    assert.ok(seen[i]! - seen[i - 1]! <= 0.5, `no jump bigger than half: ${seen[i - 1]} -> ${seen[i]}`);
  }
});

test('taps hit the deepest drawn level and the topmost region', () => {
  const L = layout(tiny);
  const fit = fitCamera(L, SC);
  assert.deepEqual(hitTest(visibleLevels(L, fit, SC), 20, 20), { level: 'a', region: 'dot' });
  // world (45, 33.75) is the middle of b: its box is too small to hit from afar (b's background takes the
  // tap), and is the target when zoomed in
  const far = { ...fit, z: (LEVEL_MIN_PX * 1.2) / 10 };
  assert.deepEqual(hitTest(visibleLevels(L, far, SC), 45, 33.75), { level: 'b', region: 'bg' });
  const deep = cameraFor(L.byId.get('b')!, SC);
  assert.deepEqual(hitTest(visibleLevels(L, deep, SC), 45, 33.75), { level: 'b', region: 'box' });
});

test('bookshop zooms through all six levels', () => {
  const L = layout(bookshop);
  const lim = zoomLimits(L, SC);
  const bug = cameraFor(L.byId.get('ladybird')!, SC);
  assert.equal(visibleLevels(L, bug, SC).at(-1)!.level.id, 'ladybird');
  assert.ok(bug.z * 4 < lim.max, 'room to zoom well past the deepest level');
  const cat = L.byId.get('cushion')!;
  const cam = cameraFor(cat, SC);
  // the cat's head is a fillable region at the deepest level
  const head = toWorld(cam, SC, SC.w * (850 / 1200), SC.h / 2 + ((600 - 450) / 900) * SC.h * 0.92);
  assert.equal(hitTest(visibleLevels(L, cam, SC), head.x, head.y)?.level, 'cushion');
});

test('flight starts and ends on its cameras', () => {
  const a = { cx: 0, cy: 0, z: 1 };
  const b = { cx: 100, cy: 50, z: 64 };
  assert.deepEqual(flight(a, b, 0), a);
  const end = flight(a, b, 1);
  assert.ok(Math.abs(end.cx - 100) < 1e-6 && Math.abs(end.z - 64) < 1e-6);
});

test('fills, strokes, erase and clear all undo and redo', () => {
  let p = emptyProgress(tiny);
  let h: History = { past: [], future: [] };
  ({ p, h } = apply(p, h, { kind: 'fill', level: 'a', region: 'dot', color: '#ff0000' }, 1));
  ({ p, h } = apply(p, h, { kind: 'fill', level: 'a', region: 'dot', color: '#00ff00' }, 2));
  const stroke = finishStroke({ id: 's1', level: 'b', tool: 'pencil', color: '#000000', width: 1, pts: [0, 0, 0.1, 0.1, 10, 10, 20, 20] });
  assert.ok(stroke.pts.length < 8, 'jitter is simplified away');
  ({ p, h } = apply(p, h, { kind: 'stroke', stroke }, 3));
  assert.deepEqual(strokesNear(p, 'b', 10, 10, 1), ['s1']);
  assert.deepEqual(strokesNear(p, 'b', 50, 0, 1), []);
  ({ p, h } = apply(p, h, { kind: 'erase', ids: ['s1'] }, 4));
  assert.equal(p.strokes.length, 0);
  ({ p, h } = apply(p, h, { kind: 'clear' }, 5));
  assert.deepEqual(p.fills, {});
  ({ p, h } = undo(p, h, 6));
  assert.equal(p.fills.a!.dot, '#00ff00');
  ({ p, h } = undo(p, h, 7));
  assert.equal(p.strokes.length, 1);
  ({ p, h } = undo(p, h, 8));
  ({ p, h } = undo(p, h, 9));
  assert.equal(p.fills.a!.dot, '#ff0000');
  ({ p, h } = redo(p, h, 10));
  assert.equal(p.fills.a!.dot, '#00ff00');
  // a new edit clears the redo stack
  ({ p, h } = apply(p, h, { kind: 'fill', level: 'a', region: 'bg', color: '#0000ff' }, 11));
  assert.equal(h.future.length, 0);
  // same colour again is a no-op with no history entry
  const n = h.past.length;
  ({ p, h } = apply(p, h, { kind: 'fill', level: 'a', region: 'bg', color: '#0000ff' }, 12));
  assert.equal(h.past.length, n);
});

test('progress percent and found levels', () => {
  let p = emptyProgress(tiny);
  assert.equal(percent(tiny, p), 0);
  p = { ...p, fills: { a: { bg: '#111111', dot: '#222222' } } };
  assert.equal(percent(tiny, p), 0.5);
  p = markFound(p, 'b');
  assert.equal(markFound(p, 'b'), p);
});

test('restore drops unknown levels, regions, bad colours and junk', () => {
  const p = restoreProgress(tiny, {
    fills: { a: { bg: '#123456', nope: '#123456', dot: 'red' }, zz: { bg: '#123456' } },
    strokes: [{ id: 'x', level: 'b', tool: 'marker', color: '#000000', width: 2, pts: [1, 2, 3, 4] }, { level: 'q', pts: [1, 2] }, 5],
    found: ['b', 'q'],
    updated: 9,
  });
  assert.deepEqual(p.fills, { a: { bg: '#123456' } });
  assert.equal(p.strokes.length, 1);
  assert.deepEqual(p.found, ['b']);
  assert.deepEqual(restoreProgress(tiny, 'garbage'), emptyProgress(tiny));
});
