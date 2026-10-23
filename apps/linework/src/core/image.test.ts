// Image math: fit-within resize, quarter-turn dimension and index maps, RGBA rotation round-trips.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fitWithin, normTurns, rotate90Dims, rotate90Index, rotateRGBA90 } from './image.ts';

test('fitWithin downsizes the long edge to max, preserving aspect', () => {
  assert.deepEqual(fitWithin(4032, 3024), { width: 1024, height: 768 });
  assert.deepEqual(fitWithin(3024, 4032), { width: 768, height: 1024 });
  assert.deepEqual(fitWithin(2000, 2000, 500), { width: 500, height: 500 });
  assert.deepEqual(fitWithin(3000, 1000, 1024), { width: 1024, height: 341 });
});

test('fitWithin never upscales and returns integers ≥ 1', () => {
  assert.deepEqual(fitWithin(800, 600), { width: 800, height: 600 });
  assert.deepEqual(fitWithin(1024, 10), { width: 1024, height: 10 });
  assert.deepEqual(fitWithin(100000, 10), { width: 1024, height: 1 });
  const s = fitWithin(1234.5, 987.6);
  assert.ok(Number.isInteger(s.width) && Number.isInteger(s.height));
  assert.ok(s.width <= 1024 && s.height <= 1024);
});

test('fitWithin rejects invalid sizes', () => {
  assert.throws(() => fitWithin(0, 10), RangeError);
  assert.throws(() => fitWithin(NaN, 10), RangeError);
  assert.throws(() => fitWithin(10, -1), RangeError);
  assert.throws(() => fitWithin(10, 10, 0), RangeError);
});

test('normTurns handles negatives and large values', () => {
  assert.equal(normTurns(0), 0);
  assert.equal(normTurns(5), 1);
  assert.equal(normTurns(-1), 3);
  assert.equal(normTurns(-6), 2);
  assert.equal(normTurns(NaN), 0);
});

test('rotate90Dims swaps on odd turns', () => {
  assert.deepEqual(rotate90Dims(4, 3, 0), { width: 4, height: 3 });
  assert.deepEqual(rotate90Dims(4, 3, 1), { width: 3, height: 4 });
  assert.deepEqual(rotate90Dims(4, 3, 2), { width: 4, height: 3 });
  assert.deepEqual(rotate90Dims(4, 3, -1), { width: 3, height: 4 });
});

test('rotate90Index maps corners clockwise', () => {
  const w = 4;
  const h = 3;
  // One clockwise turn: top-left → top-right, top-right → bottom-right.
  assert.deepEqual(rotate90Index(0, 0, w, h, 1), { x: 2, y: 0 });
  assert.deepEqual(rotate90Index(3, 0, w, h, 1), { x: 2, y: 3 });
  assert.deepEqual(rotate90Index(0, 2, w, h, 1), { x: 0, y: 0 });
  assert.deepEqual(rotate90Index(0, 0, w, h, 2), { x: 3, y: 2 });
  assert.deepEqual(rotate90Index(0, 0, w, h, 3), { x: 0, y: 3 });
  assert.deepEqual(rotate90Index(0, 0, w, h, -1), rotate90Index(0, 0, w, h, 3));
  assert.deepEqual(rotate90Index(1, 2, w, h, 4), { x: 1, y: 2 });
});

test('rotate90Index is a bijection onto the destination grid', () => {
  const w = 5;
  const h = 3;
  for (const turns of [1, 2, 3]) {
    const { width, height } = rotate90Dims(w, h, turns);
    const seen = new Set<number>();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const d = rotate90Index(x, y, w, h, turns);
        assert.ok(d.x >= 0 && d.x < width && d.y >= 0 && d.y < height);
        seen.add(d.y * width + d.x);
      }
    }
    assert.equal(seen.size, w * h);
  }
});

function makeImage(w: number, h: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i++) data[i] = (i * 37 + 11) % 256;
  return data;
}

test('rotateRGBA90 moves whole pixels to rotate90Index positions', () => {
  const w = 3;
  const h = 2;
  const src = makeImage(w, h);
  const out = rotateRGBA90(src, w, h, 1);
  assert.equal(out.width, 2);
  assert.equal(out.height, 3);
  assert.ok(out.data instanceof Uint8ClampedArray);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = rotate90Index(x, y, w, h, 1);
      const si = (y * w + x) * 4;
      const di: number = (d.y * out.width + d.x) * 4;
      assert.deepEqual([...out.data.subarray(di, di + 4)], [...src.subarray(si, si + 4)]);
    }
  }
});

test('rotateRGBA90: four turns (and turn + inverse) round-trip to identity', () => {
  const w = 5;
  const h = 3;
  const src = makeImage(w, h);
  let cur = { data: src, width: w, height: h };
  for (let i = 0; i < 4; i++) cur = rotateRGBA90(cur.data, cur.width, cur.height, 1);
  assert.equal(cur.width, w);
  assert.equal(cur.height, h);
  assert.deepEqual(cur.data, src);

  const once = rotateRGBA90(src, w, h, 1);
  const back = rotateRGBA90(once.data, once.width, once.height, -1);
  assert.deepEqual(back.data, src);

  const two = rotateRGBA90(src, w, h, 2);
  assert.deepEqual(rotateRGBA90(two.data, two.width, two.height, 2).data, src);
  assert.deepEqual(rotateRGBA90(src, w, h, 4).data, src);
  assert.notEqual(rotateRGBA90(src, w, h, 0).data, src, 'always a new buffer');
});

test('rotateRGBA90 keeps Uint8Array type and validates input', () => {
  const src = new Uint8Array(2 * 2 * 4).fill(7);
  const out = rotateRGBA90(src, 2, 2, 1);
  assert.ok(out.data instanceof Uint8Array && !(out.data instanceof Uint8ClampedArray));
  assert.throws(() => rotateRGBA90(new Uint8Array(4), 2, 2, 1), RangeError);
  assert.throws(() => rotateRGBA90(src, 1.5, 2, 1), RangeError);
  assert.throws(() => rotateRGBA90(src, 0, 2, 1), RangeError);
});
