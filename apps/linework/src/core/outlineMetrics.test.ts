// T49 golden metrics: outline quality on synthetic fixtures with known edges (src/core/fixtures.ts).
//
// Measured 17 Oct 2026, node 22, this file's settings. R = edge recall, P = precision (ink within
// 2 px of a true boundary; Bold 4 px since its lines are 5 px wide), sp = specks (< 12 px blobs).
//
// | pipeline                    | shapes        | noisy shapes  | portrait      | text          | 1024x768 |
// |-----------------------------|---------------|---------------|---------------|---------------|----------|
// | OLD default (Best match v2) | R .71 P 1.00  | R .69 P 1.00  | R .71 P 1.00  | R 1.00 P 1.00 | ~230 ms  |
// |                             | sp 0          | sp 0          | sp 3          | sp 0          |          |
// | NEW Line art (Canny)        | R 1.00 P 1.00 | R .72 P 1.00  | R .93 P 1.00  | R 1.00 P 1.00 | ~95 ms   |
// |                             | sp 0          | sp 0          | sp 0          | sp 0          |          |
// | NEW Sketch (XDoG)           | R .71 P 1.00  | R .57 P .98   | R .72 P 1.00  | R 1.00 P 1.00 | ~70 ms   |
// |                             | sp 0          | sp 0          | sp 0          | sp 0          |          |
// | NEW Bold lines (Canny, 5px) | R .71 P 1.00  | R .71 P 1.00  | R .82 P 1.00  | R 1.00 P 1.00 | ~75 ms   |
// |                             | sp 0          | sp 0          | sp 0          | sp 0          |          |
//
// Reading it: the v2 engine and Sketch miss the faint (18 grey level) rectangle in "shapes" (that
// is the 29 % of boundary they lose) and v2 misses the soft chin/neck and part of the hair line in
// "portrait"; Line art's CLAHE + automatic Canny thresholds find both. Under heavy grain (+-16
// levels) the noise-adaptive floor drops the faint rectangle rather than draw the grain. Bold at
// detail 0.4 keeps only the main edges on purpose. Thresholds below sit a little under the measured values so
// small tuning changes pass but a real regression fails. Runtimes are node on a PC; phones are
// ~3-5x slower, hence the generous 3 s budget.
import test from 'node:test';
import assert from 'node:assert/strict';
import { outline, type OutlineOptions } from './outline.ts';
import { presetSettings } from './outlinePresets.ts';
import { allFixtures, edgeMetrics, shapesFixture, speckCount, type Fixture } from './fixtures.ts';
import { clahe, noiseLevel, removeSpecks } from './lineStyles.ts';

const FX: Record<string, Fixture> = {};
for (const f of allFixtures()) FX[f.name] = f;

const opts = (id: Parameters<typeof presetSettings>[0]): OutlineOptions => ({ ...presetSettings(id), invert: false });
const OLD = opts('best');
const SKETCH = opts('sketch');
const LINEART = opts('lineart');
const BOLD = opts('boldlines');

function measure(o: OutlineOptions, name: string, tol = 2) {
  const out = outline(FX[name].img, o);
  return { ...edgeMetrics(out, FX[name].edges, tol), specks: speckCount(out) };
}

test('fixtures: deterministic, with non-trivial ground-truth edges', () => {
  for (const f of allFixtures()) {
    let e = 0;
    for (const v of f.edges) e += v;
    assert.ok(e > 500 && e < f.edges.length * 0.2, `${f.name}: ${e} edge px`);
    assert.deepEqual(f.img.data.slice(0, 64), FX[f.name].img.data.slice(0, 64));
  }
});

test('Line art (Canny): high recall and precision on every fixture', () => {
  const s = measure(LINEART, 'shapes');
  assert.ok(s.recall >= 0.95 && s.precision >= 0.95, JSON.stringify(s));
  const n = measure(LINEART, 'noisy shapes');
  assert.ok(n.recall >= 0.68 && n.precision >= 0.95, JSON.stringify(n));
  const p = measure(LINEART, 'portrait');
  assert.ok(p.recall >= 0.85 && p.precision >= 0.92, JSON.stringify(p));
  const t = measure(LINEART, 'text');
  assert.ok(t.recall >= 0.95 && t.precision >= 0.9, JSON.stringify(t));
  for (const r of [s, n, p, t]) assert.ok(r.specks <= 3, `specks ${r.specks}`);
});

test('Line art beats the old default where the old one lost edges (faint shapes, soft portrait)', () => {
  for (const name of ['shapes', 'portrait']) {
    const before = measure(OLD, name);
    const after = measure(LINEART, name);
    assert.ok(after.recall >= before.recall + 0.1, `${name}: ${before.recall} -> ${after.recall}`);
    assert.ok(after.precision >= before.precision - 0.05, `${name}: precision ${before.precision} -> ${after.precision}`);
  }
});

test('Sketch (XDoG): clean soft lines, no specks, precise even on heavy grain', () => {
  const s = measure(SKETCH, 'shapes');
  assert.ok(s.recall >= 0.65 && s.precision >= 0.95, JSON.stringify(s));
  const n = measure(SKETCH, 'noisy shapes');
  assert.ok(n.recall >= 0.45 && n.precision >= 0.9, JSON.stringify(n));
  const p = measure(SKETCH, 'portrait');
  assert.ok(p.recall >= 0.65 && p.precision >= 0.92, JSON.stringify(p));
  const t = measure(SKETCH, 'text');
  assert.ok(t.recall >= 0.95 && t.precision >= 0.9, JSON.stringify(t));
  for (const r of [s, n, p, t]) assert.ok(r.specks <= 2, `specks ${r.specks}`);
});

test('Bold lines: thick lines on the main edges', () => {
  for (const name of ['noisy shapes', 'portrait', 'text']) {
    const r = measure(BOLD, name, 4);
    assert.ok(r.recall >= 0.68 && r.precision >= 0.9 && r.specks === 0, `${name} ${JSON.stringify(r)}`);
  }
  // Thicker than Line art on the same picture.
  assert.ok(measure(BOLD, 'text').inked > measure(LINEART, 'text').inked * 1.8);
});

test('runtime budget: every style on 1024x768 well under 3 s (node)', () => {
  const big = shapesFixture(1024, 768);
  for (const o of [OLD, SKETCH, LINEART, BOLD]) {
    const t0 = performance.now();
    outline(big.img, o);
    const ms = performance.now() - t0;
    assert.ok(ms < 3000, `${o.style}: ${ms.toFixed(0)} ms`);
  }
});

test('new styles: flat and flat+noise images give no lines; invert gives white lines', () => {
  const w = 96, h = 96;
  const flat = new Uint8ClampedArray(w * h * 4).fill(128);
  let s = 5;
  const noisy = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < noisy.length; i += 4) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const v = 128 + Math.round((s / 4294967296) * 4 - 2);
    noisy[i] = v; noisy[i + 1] = v; noisy[i + 2] = v; noisy[i + 3] = 255;
  }
  for (const o of [SKETCH, LINEART, BOLD]) {
    for (const detail of [0, 0.5, 1]) {
      for (const data of [flat, noisy]) {
        const out = outline({ data, width: w, height: h }, { ...o, detail });
        let ink = 0;
        for (let i = 3; i < out.data.length; i += 4) if (out.data[i]) ink++;
        assert.equal(ink, 0, `${o.style} detail ${detail}`);
      }
    }
  }
  const out = outline(FX.text.img, { ...LINEART, invert: true });
  for (let i = 0; i < out.data.length; i += 4) {
    if (out.data[i + 3]) { assert.deepEqual([out.data[i], out.data[i + 1], out.data[i + 2]], [255, 255, 255]); break; }
  }
});

test('helpers: CLAHE keeps a flat plane flat, noiseLevel reads grain, removeSpecks drops blobs', () => {
  const w = 64, h = 64;
  const flat = new Float32Array(w * h).fill(0.5);
  const c = clahe(flat, w, h);
  let lo = 1, hi = 0;
  for (const v of c) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  assert.ok(hi - lo < 1e-6);
  assert.ok(noiseLevel(flat, w, h) < 0.002);
  const grain = new Float32Array(w * h);
  for (let i = 0; i < grain.length; i++) grain[i] = 0.5 + (((i * 7919) % 13) - 6) * 0.01;
  assert.ok(noiseLevel(grain, w, h) > 0.01);
  const cov = new Uint8Array(w * h);
  cov[10 * w + 10] = 255; // speck
  for (let x = 5; x < 60; x++) cov[40 * w + x] = 255; // line
  cov[41 * w + 30] = 20; // faint rim touching the line
  cov[20 * w + 50] = 20; // faint isolated
  removeSpecks(cov, w, h, 8);
  assert.equal(cov[10 * w + 10], 0);
  assert.equal(cov[40 * w + 30], 255);
  assert.equal(cov[41 * w + 30], 20);
  assert.equal(cov[20 * w + 50], 0);
});
