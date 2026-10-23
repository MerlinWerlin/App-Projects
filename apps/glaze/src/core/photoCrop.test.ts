import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEVICES, deviceForScreen } from './loop.ts';
import {
  DEFAULT_TRANSFORM,
  MAX_ZOOM,
  clampTransform,
  containScale,
  coverScale,
  effectiveScale,
  looksSoft,
  panBy,
  photoLayout,
  pinchBy,
  sourceCrop,
  sourceCropPx,
  touchDelta,
  type PhotoTransform,
  type Rect,
  type Size,
} from './photoCrop.ts';
import {
  ZOOM_STRETCH,
  cropBaseSize,
  cropBounds,
  cropInBounds,
  cropPinchStep,
  cropSettle,
  cropShown,
  cropViewFor,
  cropZoomShown,
  rubberInto,
  transformForView,
} from './photoCrop.ts';
import { rubberClamp } from './motion.ts';

const near = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} ≈ ${b}`);

const landscape: Size = { width: 4032, height: 3024 };
const portrait: Size = { width: 3024, height: 4032 };
const phone = { width: 1179, height: 2556 };

function covers(l: Rect, target: Size) {
  assert.ok(l.x <= 1e-9 && l.y <= 1e-9, 'starts at or before the top-left');
  assert.ok(l.x + l.width >= target.width - 1e-6, 'reaches the right edge');
  assert.ok(l.y + l.height >= target.height - 1e-6, 'reaches the bottom edge');
}

test('cover and contain scales', () => {
  near(coverScale(landscape, phone), 2556 / 3024);
  near(containScale(landscape, phone), 1179 / 4032);
  near(coverScale(portrait, phone), Math.max(1179 / 3024, 2556 / 4032));
  assert.ok(containScale(portrait, phone) <= coverScale(portrait, phone));
  assert.equal(coverScale({ width: 0, height: 10 }, phone), 1);
  assert.equal(containScale(landscape, { width: NaN, height: 1 }), 1);
});

test('clampTransform: zoom 1..5 of cover, offsets -1..1, junk becomes the default', () => {
  assert.deepEqual(clampTransform(null), DEFAULT_TRANSFORM);
  assert.deepEqual(clampTransform({ scale: 0.2, offsetX: -3, offsetY: 9 }), { scale: 1, offsetX: -1, offsetY: 1 });
  assert.deepEqual(clampTransform({ scale: 99 }), { scale: MAX_ZOOM, offsetX: 0, offsetY: 0 });
  assert.deepEqual(clampTransform({ scale: NaN, offsetX: Infinity } as PhotoTransform), DEFAULT_TRANSFORM);
  assert.ok(effectiveScale(landscape, phone, { scale: 0, offsetX: 0, offsetY: 0 }) >= coverScale(landscape, phone));
});

test('layout never leaves empty edges at any zoom or offset', () => {
  for (const image of [landscape, portrait, { width: 500, height: 500 }, { width: 100, height: 5000 }]) {
    for (const scale of [1, 1.7, 5]) {
      for (const o of [-1, -0.3, 0, 0.6, 1]) {
        covers(photoLayout(image, phone, { scale, offsetX: o, offsetY: -o }), phone);
      }
    }
  }
});

test('offsets map to edges and centre', () => {
  const l0 = photoLayout(landscape, phone, { scale: 1, offsetX: -1, offsetY: 0 });
  near(l0.x, 0);
  near(l0.y, 0); // a landscape at 1× has no vertical travel
  const l1 = photoLayout(landscape, phone, { scale: 1, offsetX: 1, offsetY: 0 });
  near(l1.x + l1.width, phone.width);
  const lc = photoLayout(landscape, phone, DEFAULT_TRANSFORM);
  near(lc.x + lc.width / 2, phone.width / 2);
});

test('source crop: target aspect, inside the image, centred by default', () => {
  for (const d of DEVICES) {
    const target = d.pixels;
    for (const image of [landscape, portrait]) {
      for (const t of [DEFAULT_TRANSFORM, { scale: 3, offsetX: 1, offsetY: -1 }, { scale: 5, offsetX: -0.5, offsetY: 0.5 }]) {
        const r = sourceCrop(image, target, t);
        near(r.width / r.height, target.width / target.height, 1e-6);
        assert.ok(r.x >= 0 && r.y >= 0);
        assert.ok(r.x + r.width <= image.width + 1e-6 && r.y + r.height <= image.height + 1e-6);
        near(r.width, target.width / effectiveScale(image, target, t), 1e-6);
      }
    }
  }
  const c = sourceCrop(landscape, phone, DEFAULT_TRANSFORM);
  near(c.height, landscape.height);
  near(c.x + c.width / 2, landscape.width / 2);
});

test('source crop in whole pixels stays inside the image', () => {
  const r = sourceCropPx(landscape, phone, { scale: 2.3, offsetX: 1, offsetY: 1 });
  for (const v of [r.x, r.y, r.width, r.height]) assert.ok(Number.isInteger(v));
  assert.ok(r.x + r.width <= landscape.width && r.y + r.height <= landscape.height);
  assert.deepEqual(sourceCropPx({ width: 0, height: 0 }, phone, DEFAULT_TRANSFORM), { x: 0, y: 0, width: 0, height: 0 });
});

test('device px crop follows deviceForScreen', () => {
  const d = deviceForScreen(393, 852);
  const r = sourceCrop(portrait, d.pixels, DEFAULT_TRANSFORM);
  near(r.width / r.height, d.pixels.width / d.pixels.height, 1e-6);
});

test('preview frame and export agree (same transform, same aspect)', () => {
  const frame = { width: 220, height: (220 * phone.height) / phone.width };
  const t = { scale: 2, offsetX: 0.4, offsetY: -0.7 };
  const a = sourceCrop(landscape, frame, t);
  const b = sourceCrop(landscape, phone, t);
  near(a.x, b.x, 1e-6);
  near(a.y, b.y, 1e-6);
  near(a.width, b.width, 1e-6);
});

test('panBy: photo follows the finger and clamps at its edges', () => {
  const frame = { width: 200, height: 433 };
  const right = panBy(DEFAULT_TRANSFORM, 30, 0, landscape, frame);
  assert.ok(right.offsetX < 0, 'dragging right reveals the left of the photo');
  const far = panBy(DEFAULT_TRANSFORM, 100000, 100000, landscape, frame);
  assert.equal(far.offsetX, -1);
  assert.equal(far.offsetY, 0, 'no vertical travel at 1× for a landscape photo');
  covers(photoLayout(landscape, frame, far), frame);
  const back = panBy(right, -30, 0, landscape, frame);
  near(back.offsetX, 0, 1e-9);
  assert.deepEqual(panBy(DEFAULT_TRANSFORM, 5, 5, { width: 0, height: 0 }, frame), DEFAULT_TRANSFORM);
});

test('pinchBy: clamps to 1×..5× and keeps the focal point under the fingers', () => {
  const frame = { width: 200, height: 433 };
  assert.equal(pinchBy(DEFAULT_TRANSFORM, 0.1, portrait, frame).scale, 1);
  assert.equal(pinchBy(DEFAULT_TRANSFORM, 50, portrait, frame).scale, MAX_ZOOM);
  assert.deepEqual(pinchBy(DEFAULT_TRANSFORM, NaN, portrait, frame), DEFAULT_TRANSFORM);

  const focal = { x: 150, y: 200 };
  const t0 = { scale: 2, offsetX: 0, offsetY: 0 };
  const l0 = photoLayout(portrait, frame, t0);
  const u = (focal.x - l0.x) / (l0.width / portrait.width);
  const v = (focal.y - l0.y) / (l0.height / portrait.height);
  const t1 = pinchBy(t0, 1.5, portrait, frame, focal);
  near(t1.scale, 3);
  const l1 = photoLayout(portrait, frame, t1);
  near(l1.x + u * (l1.width / portrait.width), focal.x, 1e-6);
  near(l1.y + v * (l1.height / portrait.height), focal.y, 1e-6);
  covers(l1, frame);

  // Zooming out at an edge clamps instead of exposing the background.
  const edge = pinchBy({ scale: 5, offsetX: 1, offsetY: 1 }, 0.25, portrait, frame, { x: 0, y: 0 });
  covers(photoLayout(portrait, frame, edge), frame);
});

test('touchDelta: centroid pan, distance-ratio pinch', () => {
  const one = touchDelta([{ x: 10, y: 10 }], [{ x: 15, y: 7 }]);
  assert.deepEqual(one, { dx: 5, dy: -3, factor: 1, focal: { x: 15, y: 7 } });
  const two = touchDelta(
    [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ],
    [
      { x: -50, y: 10 },
      { x: 150, y: 10 },
    ],
  );
  near(two.factor, 2);
  near(two.dx, 0);
  near(two.dy, 10);
  assert.deepEqual(touchDelta([], [{ x: 1, y: 1 }]).factor, 1);
});

test('looksSoft flags small photos blown up to a big screen', () => {
  assert.equal(looksSoft(landscape, phone, DEFAULT_TRANSFORM), false);
  assert.equal(looksSoft(landscape, phone, { scale: 5, offsetX: 0, offsetY: 0 }), true);
  assert.equal(looksSoft({ width: 400, height: 600 }, phone, DEFAULT_TRANSFORM), true);
});

// --- T37 live crop view (pinch/pan with momentum + rubber band) ---

const frame: Size = { width: 220, height: 477 };

test('cropViewFor matches photoLayout and transformForView round-trips', () => {
  const ts: PhotoTransform[] = [
    DEFAULT_TRANSFORM,
    { scale: 2.5, offsetX: -0.4, offsetY: 0.7 },
    { scale: 5, offsetX: 1, offsetY: -1 },
    { scale: 1, offsetX: 0.3, offsetY: 0 },
  ];
  for (const img of [landscape, portrait]) {
    for (const t of ts) {
      const v = cropViewFor(img, frame, t);
      const l = photoLayout(img, frame, t);
      near(v.x, l.x);
      near(v.y, l.y);
      const base = cropBaseSize(img, frame);
      near(base.width * v.zoom, l.width);
      const back = transformForView(img, frame, v);
      const want = clampTransform(t);
      near(back.scale, want.scale);
      // An axis with no spare photo has nothing to pan: offset comes back as 0.
      if (l.width - frame.width > 1e-6) near(back.offsetX, want.offsetX);
      else assert.equal(back.offsetX, 0);
      if (l.height - frame.height > 1e-6) near(back.offsetY, want.offsetY);
      else assert.equal(back.offsetY, 0);
    }
  }
});

test('transformForView clamps out-of-bounds and corrupt views into the saved format', () => {
  const t = transformForView(landscape, frame, { zoom: 9, x: 50, y: -1e6 });
  assert.equal(t.scale, MAX_ZOOM);
  assert.equal(t.offsetX, -1);
  assert.equal(t.offsetY, 1);
  assert.deepEqual(transformForView(landscape, frame, { zoom: NaN, x: NaN, y: NaN }), clampTransform({ scale: 1, offsetX: 0, offsetY: 0 }));
  const zero = transformForView(landscape, frame, { zoom: 0.3, x: 0, y: 0 });
  assert.equal(zero.scale, 1);
  assert.deepEqual(cropViewFor(landscape, frame, null), cropViewFor(landscape, frame, DEFAULT_TRANSFORM));
});

test('cropBounds keep the photo over the frame, centred when smaller', () => {
  const base = cropBaseSize(portrait, frame);
  const b = cropBounds(base, frame, 2);
  near(b.maxX, 0);
  near(b.minX, frame.width - base.width * 2);
  near(b.minY, frame.height - base.height * 2);
  const s = cropBounds(base, frame, 0.5);
  near(s.minX, s.maxX);
  near(s.minX, (frame.width - base.width * 0.5) / 2);
  near(s.minY, s.maxY);
});

test('rubberInto equals motion.ts rubberClamp and never stretches past the dimension', () => {
  for (const v of [-500, -40, -1, 0, 10, 100, 101, 180, 5000]) {
    near(rubberInto(v, 0, 100, 220), rubberClamp(v, 0, 100, 220));
  }
  assert.equal(rubberInto(50, 0, 100, 220), 50);
  assert.ok(rubberInto(1e9, 0, 100, 220) < 100 + 220);
  assert.ok(rubberInto(-1e9, 0, 100, 220) > -220);
  // Monotonic: further past the edge always moves further, but less than 1:1.
  const a = rubberInto(120, 0, 100, 220);
  const b2 = rubberInto(140, 0, 100, 220);
  assert.ok(b2 > a && a > 100 && a - 100 < 20 && b2 - a < 20);
  assert.equal(rubberInto(150, 0, 100, 0), 100);
});

test('cropShown rubber-bands while dragging and hard-clamps under Reduce Motion', () => {
  const base = cropBaseSize(landscape, frame);
  const b = cropBounds(base, frame, 1);
  const raw = { zoom: 1, x: 80, y: 0 };
  const soft = cropShown(raw, base, frame, false);
  assert.ok(soft.x > b.maxX && soft.x < 80, 'stretches past the edge, less than the finger');
  near(soft.y, 0);
  const hard = cropShown(raw, base, frame, true);
  assert.equal(hard.x, b.maxX);
  const inside = cropShown({ zoom: 1, x: b.minX / 2, y: 0 }, base, frame, false);
  near(inside.x, b.minX / 2);
  // Zoom stretches past 5x / below 1x, but not under Reduce Motion.
  const big = cropShown({ zoom: 8, x: 0, y: 0 }, base, frame, false);
  assert.ok(big.zoom > MAX_ZOOM && big.zoom < 8 && big.zoom < MAX_ZOOM * (1 + ZOOM_STRETCH));
  assert.equal(cropShown({ zoom: 8, x: 0, y: 0 }, base, frame, true).zoom, MAX_ZOOM);
  const small = cropShown({ zoom: 0.4, x: 0, y: 0 }, base, frame, false);
  assert.ok(small.zoom < 1 && small.zoom > 1 - ZOOM_STRETCH);
  assert.equal(cropZoomShown(0.4, true), 1);
  assert.equal(cropZoomShown(3, false), 3);
});

test('cropPinchStep keeps the photo point under the fingers (displayed zoom)', () => {
  const base = cropBaseSize(landscape, frame);
  const start = cropViewFor(landscape, frame, { scale: 2, offsetX: 0, offsetY: 0 });
  const focal = { x: 60, y: 300 };
  const u = (focal.x - start.x) / start.zoom;
  const v = (focal.y - start.y) / start.zoom;
  const next = cropPinchStep(start, 1.5, focal, false);
  near(next.zoom, 3);
  near((focal.x - next.x) / next.zoom, u);
  near((focal.y - next.y) / next.zoom, v);
  // Past 5x the displayed zoom grows slowly and the focal point still holds.
  let raw = start;
  for (let i = 0; i < 6; i++) raw = cropPinchStep(raw, 1.5, focal, false);
  const shown = cropShown(raw, base, frame, false);
  assert.ok(shown.zoom > MAX_ZOOM && shown.zoom < MAX_ZOOM * 1.5);
  near((focal.x - raw.x) / cropZoomShown(raw.zoom, false), u, 1e-6);
  assert.deepEqual(cropPinchStep(start, 0, focal, false), start);
  // Matches the saved-format pinchBy where no clamp is hit.
  const t = transformForView(landscape, frame, cropPinchStep(start, 1.25, { x: 110, y: 238.5 }, false));
  const ref = pinchBy({ scale: 2, offsetX: 0, offsetY: 0 }, 1.25, landscape, frame, { x: 110, y: 238.5 });
  near(t.scale, ref.scale);
  near(t.offsetX, ref.offsetX);
  near(t.offsetY, ref.offsetY);
});

test('cropSettle springs zoom back into 1x..5x and the photo back over the frame', () => {
  const base = cropBaseSize(portrait, frame);
  const over = cropShown({ zoom: 1, x: 90, y: -2000 }, base, frame, false);
  assert.equal(cropInBounds(over, base, frame), false);
  const s = cropSettle(over, base, frame);
  assert.equal(s.zoom, 1);
  assert.ok(cropInBounds(s, base, frame));
  const b = cropBounds(base, frame, 1);
  near(s.x, b.maxX);
  near(s.y, b.minY);
  const shrunk = cropSettle({ zoom: 0.7, x: 30, y: 60 }, base, frame);
  assert.equal(shrunk.zoom, 1);
  assert.ok(cropInBounds(shrunk, base, frame));
  const huge = cropSettle({ zoom: 6, x: -100, y: -100 }, base, frame, { x: 0, y: 0 });
  assert.equal(huge.zoom, MAX_ZOOM);
  near(huge.x, -100 * (5 / 6));
  near(huge.y, -100 * (5 / 6));
  const fine = cropViewFor(portrait, frame, { scale: 3, offsetX: 0.2, offsetY: -0.5 });
  assert.ok(cropInBounds(fine, base, frame));
  const same = cropSettle(fine, base, frame);
  near(same.zoom, fine.zoom);
  near(same.x, fine.x);
  near(same.y, fine.y);
  // Settled views always save as a valid, unchanged-format transform.
  const t = transformForView(portrait, frame, s);
  assert.deepEqual(clampTransform(t), t);
});

test('panning in view space agrees with panBy inside the bounds', () => {
  const t: PhotoTransform = { scale: 2, offsetX: 0, offsetY: 0 };
  const v = cropViewFor(landscape, frame, t);
  const moved = transformForView(landscape, frame, { ...v, x: v.x + 25, y: v.y - 40 });
  const ref = panBy(t, 25, -40, landscape, frame);
  near(moved.offsetX, ref.offsetX);
  near(moved.offsetY, ref.offsetY);
});
