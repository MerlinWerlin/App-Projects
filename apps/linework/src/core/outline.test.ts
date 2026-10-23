// Outline v2: behaviour tests on synthetic images (no photos needed offline).
import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze, outline, outlineSteps, resolveParams, runChunked } from './outline.ts';
import type { RGBAImage, OutlineOptions } from './outline.ts';

function makeImg(w: number, h: number, f: (x: number, y: number) => number | [number, number, number, number]): RGBAImage {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = f(x, y);
      const p = (y * w + x) * 4;
      if (typeof v === 'number') { data[p] = v; data[p + 1] = v; data[p + 2] = v; data[p + 3] = 255; }
      else { data[p] = v[0]; data[p + 1] = v[1]; data[p + 2] = v[2]; data[p + 3] = v[3]; }
    }
  }
  return { data, width: w, height: h };
}

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Count of pixels with any line coverage. */
function inked(img: RGBAImage, x0 = 0, y0 = 0, x1 = img.width, y1 = img.height): number {
  let n = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (img.data[(y * img.width + x) * 4 + 3] > 0) n++;
  return n;
}

const O = (o: Partial<OutlineOptions> = {}): OutlineOptions => ({ detail: 0.5, thickness: 1.5, invert: false, ...o });

/** A small "scene": textured disc subject in the middle, stripes in the corners (background). */
function scene(w = 256, h = 256): RGBAImage {
  const r = rng(7);
  return makeImg(w, h, (x, y) => {
    let v = 225;
    const dx = x - w / 2, dy = y - h / 2;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < w * 0.28) {
      v = 120 + 40 * Math.sin(x * 0.35) * Math.sin(y * 0.3) + 14 * Math.sin(x * 1.1 + y * 0.9);
      if (Math.abs(dx) < 3) v = 40; // a dark inner line
    } else if ((x < w * 0.2 || x > w * 0.8) && (y < h * 0.2 || y > h * 0.8)) {
      v = Math.floor(y / 6) % 2 ? 200 : 150; // background stripes
    }
    return v + r() * 4 - 2;
  });
}

test('flat image (and flat + small noise) yields no lines at any detail', () => {
  const flat = makeImg(96, 96, () => 128);
  assert.equal(inked(outline(flat, O())), 0);
  const r = rng(1);
  const noisy = makeImg(96, 96, () => 128 + Math.round(r() * 4 - 2));
  for (const detail of [0, 0.5, 1]) assert.equal(inked(outline(noisy, O({ detail }))), 0, `detail ${detail}`);
});

test('a thin dark line gives ONE centred line, not a double edge', () => {
  const img = makeImg(128, 128, (x) => (x >= 63 && x <= 64 ? 30 : 230));
  const out = outline(img, O({ thickness: 1 }));
  // Every inked pixel sits within 2 px of the dark line's centre.
  for (let y = 0; y < 128; y++) {
    for (let x = 0; x < 128; x++) {
      if (out.data[(y * 128 + x) * 4 + 3] > 0) assert.ok(Math.abs(x - 63.5) <= 2.5, `stray ink at x=${x}`);
    }
  }
  assert.ok(inked(out, 0, 20, 128, 108) >= 80, 'line runs the height of the image');
});

test('white square on black: closed outline around it, empty inside, transparent elsewhere', () => {
  const img = makeImg(128, 128, (x, y) => (x >= 40 && x < 88 && y >= 40 && y < 88 ? 240 : 20));
  const out = outline(img, O());
  assert.equal(inked(out, 50, 50, 78, 78), 0, 'interior empty');
  assert.equal(inked(out, 0, 0, 20, 20), 0, 'far corner empty');
  for (const [x0, y0, x1, y1] of [[30, 55, 45, 73], [83, 55, 98, 73], [55, 30, 73, 45], [55, 83, 73, 98]]) {
    assert.ok(inked(out, x0, y0, x1, y1) > 0, `side ${x0},${y0}`);
  }
});

test('colour lives in RGB, coverage in alpha; invert draws white; background fully transparent', () => {
  const img = makeImg(96, 96, (x) => (x < 48 ? 30 : 220));
  const a = outline(img, O({ lineColor: [10, 20, 30] }));
  const b = outline(img, O({ invert: true }));
  let lines = 0;
  for (let p = 0; p < a.data.length; p += 4) {
    if (a.data[p + 3] > 0) {
      lines++;
      assert.deepEqual([a.data[p], a.data[p + 1], a.data[p + 2]], [10, 20, 30]);
    } else assert.deepEqual([a.data[p], a.data[p + 1], a.data[p + 2]], [0, 0, 0]);
    if (b.data[p + 3] > 0) assert.deepEqual([b.data[p], b.data[p + 1], b.data[p + 2]], [255, 255, 255]);
  }
  assert.ok(lines > 0);
});

test('transparent pixels read as white paper', () => {
  const img = makeImg(96, 96, (x) => (x < 48 ? [0, 0, 0, 0] : [255, 255, 255, 255]));
  assert.equal(inked(outline(img, O())), 0);
});

test('detail adds lines step by step (monotonic) without turning the flat paper into noise', () => {
  const img = scene();
  const counts = [0, 0.25, 0.5, 0.75, 1].map((detail) => inked(outline(img, O({ detail, background: 'all' }))));
  // Never fewer lines with more detail (5 % slack for strokes that join up).
  for (let i = 1; i < counts.length; i++) assert.ok(counts[i] >= counts[i - 1] * 0.95, `detail step ${i}: ${counts}`);
  assert.ok(counts[4] > counts[0] * 1.3, `detail 1 meaningfully richer: ${counts}`);
  // The plain paper ring between subject and corner stripes stays clean at full detail.
  const hi = outline(img, O({ detail: 1, background: 'all' }));
  assert.equal(inked(hi, 100, 6, 156, 30), 0);
});

test('thicker lines cover more, and stay anti-aliased round strokes', () => {
  // Thickness is in px for a 1024 px outline, so test at that size (a disc and a bar).
  const img = makeImg(1024, 1024, (x, y) => ((x - 400) ** 2 + (y - 400) ** 2 < 250 ** 2 || (x > 700 && x < 760) ? 60 : 225));
  const counts = [0.5, 1, 2, 4, 8].map((thickness) => inked(outline(img, O({ thickness }))));
  for (let i = 1; i < counts.length; i++) assert.ok(counts[i] > counts[i - 1], `${counts}`);
  const out = outline(img, O({ thickness: 4 }));
  let partial = 0;
  for (let p = 3; p < out.data.length; p += 4) if (out.data[p] > 0 && out.data[p] < 255) partial++;
  assert.ok(partial > 0, 'edges are anti-aliased');
});

test("background 'subject' keeps the subject and drops background lines; 'all' keeps both", () => {
  const img = scene();
  const all = outline(img, O({ background: 'all' }));
  const subj = outline(img, O({ background: 'subject' }));
  const bgAll = inked(all, 0, 0, 50, 50) + inked(all, 206, 206, 256, 256);
  const bgSubj = inked(subj, 0, 0, 50, 50) + inked(subj, 206, 206, 256, 256);
  assert.ok(bgAll > 0, 'stripes traced in Everything mode');
  assert.ok(bgSubj < bgAll * 0.5, `subject mode quiets the background (${bgSubj} vs ${bgAll})`);
  assert.ok(inked(subj, 90, 90, 166, 166) > 0, 'subject lines stay');
});

test('isolated specks are removed', () => {
  const r = rng(3);
  const dots: [number, number][] = Array.from({ length: 30 }, () => [8 + Math.floor(r() * 110), 8 + Math.floor(r() * 110)]);
  const img = makeImg(128, 128, (x, y) => (dots.some(([a, b]) => a === x && b === y) ? 40 : 220));
  assert.equal(inked(outline(img, O({ detail: 0.3 }))), 0);
});

test('chunked generator equals the sync result; progress is monotonic and ends at 1', async () => {
  const img = scene(128, 128);
  const sync = outline(img, O());
  const seen: number[] = [];
  const res = await runChunked(outlineSteps(img, O()), async () => {}, (p) => seen.push(p));
  assert.deepEqual(Array.from(res.data), Array.from(sync.data));
  for (let i = 1; i < seen.length; i++) assert.ok(seen[i] >= seen[i - 1]);
  assert.equal(seen[seen.length - 1], 1);
});

test('precomputed analysis gives the same result as computing it inside', () => {
  const img = scene(128, 128);
  const an = analyze(img);
  assert.deepEqual(Array.from(outline(img, O({ analysis: an })).data), Array.from(outline(img, O()).data));
});

test('validates inputs and clamps options', () => {
  assert.throws(() => outline({ data: new Uint8Array(4), width: 2, height: 2 }, O()), RangeError);
  assert.throws(() => outline({ data: new Uint8Array(0), width: 0, height: 0 }, O()), RangeError);
  const p = resolveParams({ detail: 5, thickness: 99, invert: false }, 1024, 1024);
  const q = resolveParams({ detail: -1, thickness: -3, invert: false }, 1024, 1024);
  assert.equal(p.radius, 4); // thickness clamped to 8 px
  assert.equal(q.radius, 0.25); // 0.5 px
  assert.ok(p.high < q.high, 'more detail = lower threshold');
  const nan = resolveParams({ detail: NaN, thickness: NaN, invert: false }, 1024, 1024);
  assert.ok(Number.isFinite(nan.sigma) && Number.isFinite(nan.radius));
});

test('thick lines are found at a coarser scale so nearby features do not merge', () => {
  const thin = resolveParams(O({ thickness: 1 }), 1024, 1024);
  const thick = resolveParams(O({ thickness: 8 }), 1024, 1024);
  assert.ok(thick.sigma > thin.sigma);
  assert.ok(thick.minLen > thin.minLen);
});

test('kinds change the processing: portraits boost faces, drawings skip smoothing, landscapes keep background', () => {
  const base = resolveParams(O({ kind: 'object' }), 1024, 1024);
  assert.ok(resolveParams(O({ kind: 'portrait' }), 1024, 1024).faceBoost > base.faceBoost);
  assert.equal(resolveParams(O({ kind: 'drawing' }), 1024, 1024).smoothEps, 0);
  assert.ok(resolveParams(O({ kind: 'pet' }), 1024, 1024).smoothEps > base.smoothEps);
  assert.equal(resolveParams(O({ kind: 'landscape' }), 1024, 1024).bgWeight, 1);
});

test("auto kind: a clean black-on-white drawing is detected as 'drawing'", () => {
  const img = makeImg(200, 200, (x, y) => {
    const d = Math.abs(Math.sqrt((x - 100) ** 2 + (y - 100) ** 2) - 60);
    return d < 1.5 || Math.abs(x - y) < 1.5 ? 20 : 250;
  });
  assert.equal(analyze(img).autoKind, 'drawing');
  assert.equal(analyze(scene()).autoKind, 'object');
});
