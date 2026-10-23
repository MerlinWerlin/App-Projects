// Building blocks of the outline pipeline: filters, face detector, subject estimate, thinning,
// stroke tracing/rendering and presets.
import test from 'node:test';
import assert from 'node:assert/strict';
import { boxBlur, gaussBlur, guidedFilter, otsu, resizePlane } from './imgops.ts';
import { detectFaces, groupBoxes } from './faceDetect.ts';
import { CASCADE } from './faceCascade.ts';
import { estimateSubject } from './saliency.ts';
import { dropShort, linkGaps, thin } from './thin.ts';
import { pruneSpurs, renderStrokes, smoothChain, traceChains } from './strokes.ts';
import { PRESETS, matchesPreset, presetSettings, thicknessLabel, thicknessName } from './outlinePresets.ts';

function plane(w: number, h: number, f: (x: number, y: number) => number): Float32Array {
  const p = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) p[y * w + x] = f(x, y);
  return p;
}

test('boxBlur matches a naive clamped box filter', () => {
  const w = 23, h = 17;
  const src = plane(w, h, (x, y) => ((x * 7 + y * 13) % 11) / 11);
  for (const r of [1, 2, 5, 30]) {
    const out = boxBlur(src, w, h, r);
    for (let y = 0; y < h; y += 3) {
      for (let x = 0; x < w; x += 2) {
        // Separable: horizontal then vertical, each clamped.
        let acc = 0;
        for (let dy = -r; dy <= r; dy++) {
          const yy = Math.min(h - 1, Math.max(0, y + dy));
          let row = 0;
          for (let dx = -r; dx <= r; dx++) row += src[yy * w + Math.min(w - 1, Math.max(0, x + dx))];
          acc += row / (2 * r + 1);
        }
        assert.ok(Math.abs(out[y * w + x] - acc / (2 * r + 1)) < 1e-4, `r=${r} at ${x},${y}`);
      }
    }
  }
});

test('gaussBlur preserves flat images and the mean, and smooths an impulse symmetrically', () => {
  const flat = plane(40, 30, () => 0.5);
  for (const s of [0.6, 1.4, 3]) for (const v of gaussBlur(flat, 40, 30, s)) assert.ok(Math.abs(v - 0.5) < 1e-5);
  const imp = plane(41, 41, (x, y) => (x === 20 && y === 20 ? 1 : 0));
  for (const s of [0.8, 2.5]) {
    const g = gaussBlur(imp, 41, 41, s);
    let sum = 0;
    for (const v of g) sum += v;
    assert.ok(Math.abs(sum - 1) < 1e-3);
    assert.ok(Math.abs(g[20 * 41 + 17] - g[20 * 41 + 23]) < 1e-6);
    assert.ok(Math.abs(g[17 * 41 + 20] - g[23 * 41 + 20]) < 1e-6);
  }
});

test('guided filter flattens low-contrast texture but keeps a strong edge', () => {
  const w = 64, h = 64;
  const I = plane(w, h, (x, y) => (x < 32 ? 0.2 : 0.8) + 0.02 * Math.sin(x * 2.1 + y * 1.7));
  const out = guidedFilter(I, w, h, 4, 0.01);
  let texIn = 0, texOut = 0;
  for (let x = 4; x < 24; x++) { texIn += Math.abs(I[30 * w + x] - I[30 * w + x + 1]); texOut += Math.abs(out[30 * w + x] - out[30 * w + x + 1]); }
  assert.ok(texOut < texIn * 0.6, 'texture reduced');
  assert.ok(out[30 * w + 40] - out[30 * w + 24] > 0.5, 'edge kept');
});

test('resizePlane keeps the mean when shrinking and interpolates when growing', () => {
  const src = plane(64, 48, (x, y) => (x + y) / 112);
  const small = resizePlane(src, 64, 48, 16, 12);
  const mean = (p: Float32Array) => p.reduce((a, b) => a + b, 0) / p.length;
  assert.ok(Math.abs(mean(small) - mean(src)) < 0.01);
  const big = resizePlane(small, 16, 12, 64, 48);
  assert.equal(big.length, 64 * 48);
  assert.ok(Math.abs(mean(big) - mean(src)) < 0.02);
});

test('otsu splits a bimodal distribution between the modes', () => {
  const v = new Float32Array(1000).map((_, i) => (i < 500 ? 0.2 : 0.8));
  const t = otsu(v);
  assert.ok(t > 0.2 && t <= 0.8);
});

test('face cascade data is consistent', () => {
  assert.equal(CASCADE.width, 24);
  assert.equal(CASCADE.height, 24);
  let weak = 0;
  for (let s = 0; s < CASCADE.stages.length; s += 2) weak += CASCADE.stages[s];
  assert.equal(CASCADE.featureIndex.length, weak);
  assert.equal(CASCADE.subsets.length, weak * 8);
  assert.equal(CASCADE.leaves.length, weak * 2);
  for (const f of CASCADE.featureIndex) assert.ok(f >= 0 && f * 4 < CASCADE.features.length);
});

test('face detector finds nothing in flat or random images', () => {
  let s = 9;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const flat = { data: new Float32Array(120 * 100).fill(128), width: 120, height: 100 };
  const noise = { data: new Float32Array(120 * 100).map(() => rnd() * 255), width: 120, height: 100 };
  assert.deepEqual(detectFaces(flat), []);
  assert.deepEqual(detectFaces(noise, { minNeighbors: 4 }), []);
});

test('groupBoxes merges overlapping hits and drops lonely ones', () => {
  const hits = [
    { x: 10, y: 10, w: 40, h: 40 }, { x: 12, y: 11, w: 41, h: 41 }, { x: 9, y: 12, w: 39, h: 39 }, { x: 11, y: 9, w: 40, h: 40 },
    { x: 200, y: 200, w: 30, h: 30 },
  ];
  const faces = groupBoxes(hits, 2);
  assert.equal(faces.length, 1);
  assert.equal(faces[0].hits, 4);
  assert.ok(Math.abs(faces[0].x - 10.5) < 0.01);
});

test('subject estimate covers a distinct central object, not the plain border', () => {
  const w = 64, h = 64;
  const disc = (x: number, y: number) => (x - 32) ** 2 + (y - 32) ** 2 < 14 ** 2;
  const r = plane(w, h, (x, y) => (disc(x, y) ? 0.8 : 0.3));
  const g = plane(w, h, (x, y) => (disc(x, y) ? 0.2 : 0.6));
  const b = plane(w, h, (x, y) => (disc(x, y) ? 0.2 : 0.4));
  const est = estimateSubject(r, g, b, w, h);
  assert.ok(est.weight[32 * w + 32] > 0.9, 'centre is subject');
  assert.ok(est.weight[2 * w + 2] < 0.1, 'corner is background');
  assert.ok(est.clarity > 0.5);
  const flat = plane(w, h, () => 0.5);
  assert.ok(estimateSubject(flat, flat, flat, w, h).clarity < 0.2, 'no subject in a flat image');
});

test('thin turns a 5 px bar into a 1 px line; dropShort removes small bits', () => {
  const w = 40, h = 20;
  const m = new Uint8Array(w * h);
  for (let y = 8; y < 13; y++) for (let x = 5; x < 35; x++) m[y * w + x] = 1;
  m[3 * w + 3] = 1; // speck
  thin(m, w, h);
  for (let x = 10; x < 30; x++) {
    let col = 0;
    for (let y = 0; y < h; y++) col += m[y * w + x];
    assert.equal(col, 1, `column ${x}`);
  }
  dropShort(m, w, h, 5);
  assert.equal(m[3 * w + 3], 0);
  assert.ok(m.reduce((a, b) => a + b, 0) >= 20);
});

test('linkGaps bridges a small gap along the stroke direction only', () => {
  const w = 40, h = 20;
  const m = new Uint8Array(w * h);
  for (let x = 2; x < 15; x++) m[10 * w + x] = 1;
  for (let x = 18; x < 35; x++) m[10 * w + x] = 1;
  for (let x = 2; x < 10; x++) m[2 * w + x] = 1; // parallel stroke far away
  assert.equal(linkGaps(m, w, h, 4), 1);
  for (let x = 2; x < 35; x++) assert.equal(m[10 * w + x], 1);
  assert.equal(m[6 * w + 5], 0);
});

test('traceChains + smoothing + rendering draw a clean anti-aliased stroke', () => {
  const w = 40, h = 40;
  const m = new Uint8Array(w * h);
  for (let x = 5; x < 35; x++) m[20 * w + x] = 1; // horizontal
  for (let y = 5; y < 20; y++) m[y * w + 20] = 1; // vertical joining it (T junction)
  for (let y = 21; y < 24; y++) m[y * w + 30] = 1; // short spur
  const chains = traceChains(m, w, h);
  const pixels = new Set(chains.flat());
  for (let i = 0; i < m.length; i++) if (m[i]) assert.ok(pixels.has(i), `pixel ${i} in a chain`);
  const pruned = pruneSpurs(chains, m, w, h, 5);
  assert.ok(pruned.length < chains.length, 'spur removed');
  const { xs, ys } = smoothChain(chains.sort((a, b) => b.length - a.length)[0], w, 3);
  assert.ok(xs.length > 5 && ys.every((v) => Number.isFinite(v)));
  const cov = new Uint8Array(w * h);
  renderStrokes([{ xs: Float32Array.of(5, 35), ys: Float32Array.of(10.4, 10.4), strength: 1 }], cov, w, h, 1.5, 0);
  assert.equal(cov[10 * w + 20], 255);
  assert.ok(cov[12 * w + 20] > 0 && cov[12 * w + 20] < 255, 'soft edge');
  assert.equal(cov[14 * w + 20], 0);
});

test('presets are real settings; best match follows the detected kind', () => {
  const ids = new Set<string>();
  for (const p of PRESETS) {
    const s = presetSettings(p.id);
    ids.add(JSON.stringify(s));
    assert.ok(s.detail >= 0 && s.detail <= 1 && s.thickness >= 0.5 && s.thickness <= 8);
    assert.ok(matchesPreset(s, p.id));
  }
  assert.ok(ids.size >= PRESETS.length - 1, 'presets differ from each other');
  assert.equal(presetSettings('best', 'portrait').kind, 'portrait');
  assert.equal(presetSettings('best', 'drawing').kind, 'drawing');
  assert.ok(presetSettings('bold').thickness > presetSettings('fine').thickness);
  assert.ok(presetSettings('illustration').detail > presetSettings('simple').detail);
  assert.ok(!matchesPreset({ ...presetSettings('clean'), detail: 0.9 }, 'clean'));
  assert.equal(thicknessLabel(1), '1 px · Fine');
  assert.equal(thicknessLabel(6), '6 px · Extra bold');
  assert.equal(thicknessName(0.5), 'hairline');
  assert.equal(thicknessName(1.5), 'fine');
  assert.equal(thicknessName(2), 'medium');
  assert.equal(thicknessName(4.5), 'bold');
  assert.equal(thicknessName(6), 'extraBold');
});
