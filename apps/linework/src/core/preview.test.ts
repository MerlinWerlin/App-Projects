import test from 'node:test';
import assert from 'node:assert/strict';
import { PREVIEW_PX, downscaleRGBA, makeLatestJobs, scaleAnalysis } from './preview.ts';
import { analyze, outline, type RGBAImage } from './outline.ts';

function disc(w: number, h: number): RGBAImage {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const inside = (x - w / 2) ** 2 + (y - h / 2) ** 2 < (Math.min(w, h) / 3) ** 2;
      const v = inside ? 40 : 230;
      const p = (y * w + x) * 4;
      data[p] = v; data[p + 1] = v; data[p + 2] = v; data[p + 3] = 255;
    }
  }
  return { data, width: w, height: h };
}

test('downscale keeps aspect ratio, caps the long edge and averages colours', () => {
  const img = disc(1024, 768);
  const s = downscaleRGBA(img, PREVIEW_PX);
  assert.equal(s.width, 320);
  assert.equal(s.height, 240);
  assert.equal(s.data.length, 320 * 240 * 4);
  // centre is dark, corner is light, alpha stays opaque
  const c = ((120 * 320) + 160) * 4;
  assert.ok(s.data[c] < 60);
  assert.ok(s.data[0] > 200);
  assert.equal(s.data[3], 255);
});

test('downscale returns the same image when already small', () => {
  const img = disc(200, 100);
  assert.equal(downscaleRGBA(img, 320), img);
});

test('scaleAnalysis rescales faces and dimensions, keeps subject and kind', () => {
  const a = analyze(disc(400, 300));
  const withFace = { ...a, faces: [{ x: 100, y: 60, w: 80, h: 80, hits: 9 }] };
  const s = scaleAnalysis(withFace, 200, 150);
  assert.equal(s.width, 200);
  assert.equal(s.height, 150);
  assert.deepEqual(s.faces[0], { x: 50, y: 30, w: 40, h: 40, hits: 9 });
  assert.equal(s.subject, a.subject);
  assert.equal(s.autoKind, a.autoKind);
  assert.equal(scaleAnalysis(a, 400, 300), a);
});

test('a scaled analysis is accepted by outline on the small copy', () => {
  const big = disc(640, 480);
  const small = downscaleRGBA(big, 160);
  const art = outline(small, { detail: 0.5, thickness: 2, invert: false, analysis: scaleAnalysis(analyze(big), small.width, small.height) });
  assert.equal(art.width, small.width);
  assert.equal(art.height, small.height);
  let ink = 0;
  for (let i = 3; i < art.data.length; i += 4) if (art.data[i] > 0) ink++;
  assert.ok(ink > 0, 'preview has lines');
});

test('a newer request supersedes an older one', () => {
  const jobs = makeLatestJobs();
  const a = jobs.start();
  assert.equal(jobs.isCurrent(a), true);
  const b = jobs.start();
  assert.equal(a.aborted, true);
  assert.equal(jobs.isCurrent(a), false);
  assert.equal(jobs.isCurrent(b), true);
  jobs.cancel();
  assert.equal(b.aborted, true);
  assert.equal(jobs.isCurrent(b), false);
});
