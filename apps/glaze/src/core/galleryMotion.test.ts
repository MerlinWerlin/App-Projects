import { test } from 'node:test';
import assert from 'node:assert/strict';
import { artworkTransform, cardProgress, centredIndex } from './galleryMotion.ts';
import { parallaxAt } from './motion.ts';

test('cardProgress is 0 at the viewport centre and ±1 a viewport away', () => {
  assert.equal(cardProgress(500, 100, 800), 0);
  assert.equal(cardProgress(1300, 100, 800), 1);
  assert.equal(cardProgress(-300, 100, 800), -1);
  assert.equal(cardProgress(500, 0, 0), 0);
  assert.equal(cardProgress(Number.NaN, 0, 800), 0);
});

test('artworkTransform follows parallaxAt, scaled to cover the frame', () => {
  for (const p of [-1.5, -1, -0.5, 0, 0.3, 1, 2]) {
    const ref = parallaxAt(p, 10, 0.04);
    const t = artworkTransform(p, 400, 10, 0.04);
    assert.ok(Math.abs(t.translateY - ref.translateY) < 1e-9, `shift at ${p}`);
    assert.ok(Math.abs(t.scale - ref.scale * 1.05) < 1e-9, `scale at ${p}`);
  }
  assert.deepEqual(artworkTransform(Number.NaN, 400), artworkTransform(0, 400));
});

test('artworkTransform never reveals an edge', () => {
  const h = 360;
  for (let p = -1; p <= 1; p += 0.1) {
    const t = artworkTransform(p, h, 12, 0.04);
    const overhang = (h * t.scale - h) / 2;
    assert.ok(overhang + 1e-9 >= Math.abs(t.translateY), `p=${p}`);
  }
  assert.equal(artworkTransform(0.5, 0, 12, 0).scale, 1);
});

test('centredIndex picks the nearest card', () => {
  assert.equal(centredIndex([], 100), -1);
  assert.equal(centredIndex([100, 400, 700], 380), 1);
  assert.equal(centredIndex([100, 400, 700], 9999), 2);
  assert.equal(centredIndex([Number.NaN, 400], 0), 1);
  assert.equal(centredIndex([200, 400], 300), 0);
});
