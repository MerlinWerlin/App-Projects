// T78 golden metrics: every outline style on the real-photo-like fixtures (photoFixtures.ts).
//
// Measured 18 Oct 2026, node 22. R = edge recall, P = precision (ink within 2 px of a true
// boundary; Bold 4 px), sp = specks (visible blobs < 12 px), cov = inked share of the picture.
// "classic" is the v2 engine through the Best match preset for the detected photo kind.
//
// | fixture     | classic (Best match)  | Line art              | Sketch (XDoG)         | Bold lines            |
// |-------------|-----------------------|-----------------------|-----------------------|-----------------------|
// | hair        | R1.00 P1.00 sp0  6.6% | R1.00 P1.00 sp2 12.1% | R .99 P1.00 sp5  9.7% | R1.00 P1.00 sp1 12.1% |
// | fur         | R .89 P .80 sp28 2.2% | R .99 P .60 sp3  3.8% | R .95 P .83 sp47 2.6% | R1.00 P .90 sp1  2.8% |
// | low light   | R .29 P1.00 sp4  0.6% | R .82 P1.00 sp1  2.6% | R .76 P .94 sp9  4.3% | R .82 P1.00 sp0  2.6% |
// | backlit     | R .78 P .88 sp2  1.7% | R .81 P .88 sp0  1.8% | R .85 P .92 sp2  3.4% | R .81 P .95 sp0  1.7% |
// | jpeg blocks | R .99 P1.00 sp0  1.9% | R1.00 P1.00 sp0  2.2% | R .94 P1.00 sp3  2.8% | R1.00 P1.00 sp0  2.2% |
//
// Known weak spots, locked at their current level so they can only improve: the classic engine
// loses most of a dim portrait (its smoothing and floors are absolute, so 30-grey-level edges look
// like grain); Line art draws fur texture (P .60); Sketch and classic leave fur flecks (they follow
// fur on purpose). No style finds the eyes inside a backlit (silhouetted) face.
// Sketch on "low light" before the T78 low-light sigma: R .85 P .73 sp 76 (a field of grain specks).
// Floors sit a little under the measured values: small tuning passes, a real regression fails.
import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze, outline, type OutlineOptions } from './outline.ts';
import { presetSettings, type PresetId } from './outlinePresets.ts';
import { edgeMetrics, speckCount, type Fixture } from './fixtures.ts';
import { photoFixtures } from './photoFixtures.ts';
import { lowLightSigma } from './lineStyles.ts';

const FX: Record<string, Fixture> = {};
for (const f of photoFixtures()) FX[f.name] = f;

type Floor = { r: number; p: number; sp: number };
type Style = { name: string; preset: PresetId; tol: number; floors: Record<string, Floor> };

const STYLES: Style[] = [
  {
    name: 'classic', preset: 'best', tol: 2, floors: {
      hair: { r: 0.95, p: 0.95, sp: 3 },
      fur: { r: 0.8, p: 0.7, sp: 40 },
      'low light': { r: 0.2, p: 0.9, sp: 8 },
      backlit: { r: 0.7, p: 0.8, sp: 5 },
      'jpeg blocks': { r: 0.95, p: 0.95, sp: 2 },
    },
  },
  {
    name: 'lineart', preset: 'lineart', tol: 2, floors: {
      hair: { r: 0.95, p: 0.95, sp: 5 },
      fur: { r: 0.9, p: 0.5, sp: 6 },
      'low light': { r: 0.75, p: 0.95, sp: 3 },
      backlit: { r: 0.75, p: 0.8, sp: 3 },
      'jpeg blocks': { r: 0.95, p: 0.95, sp: 2 },
    },
  },
  {
    name: 'sketch', preset: 'sketch', tol: 2, floors: {
      hair: { r: 0.95, p: 0.95, sp: 8 },
      fur: { r: 0.85, p: 0.75, sp: 60 },
      'low light': { r: 0.7, p: 0.88, sp: 14 },
      backlit: { r: 0.78, p: 0.85, sp: 4 },
      'jpeg blocks': { r: 0.88, p: 0.95, sp: 5 },
    },
  },
  {
    name: 'bold', preset: 'boldlines', tol: 4, floors: {
      hair: { r: 0.95, p: 0.95, sp: 3 },
      fur: { r: 0.9, p: 0.8, sp: 3 },
      'low light': { r: 0.75, p: 0.95, sp: 2 },
      backlit: { r: 0.75, p: 0.88, sp: 2 },
      'jpeg blocks': { r: 0.95, p: 0.95, sp: 2 },
    },
  },
];

function optsFor(s: Style, f: Fixture): OutlineOptions {
  const detected = s.preset === 'best' ? analyze(f.img).autoKind : undefined;
  return { ...presetSettings(s.preset, detected), invert: false };
}

test('photo fixtures: deterministic, small, with non-trivial ground-truth edges', () => {
  const again = photoFixtures();
  for (const [k, f] of photoFixtures().entries()) {
    assert.ok(f.img.width <= 192 && f.img.height <= 192, f.name);
    let e = 0;
    for (const v of f.edges) e += v;
    assert.ok(e > 300 && e < f.edges.length * 0.25, `${f.name}: ${e} edge px`);
    assert.deepEqual(f.img.data, again[k].img.data, f.name);
  }
});

for (const s of STYLES) {
  test(`${s.name}: recall, precision, specks, coverage and runtime floors on photo-like fixtures`, () => {
    for (const [name, fl] of Object.entries(s.floors)) {
      const f = FX[name];
      const o = optsFor(s, f);
      const t0 = performance.now();
      const out = outline(f.img, o);
      const ms = performance.now() - t0;
      const m = edgeMetrics(out, f.edges, s.tol);
      const sp = speckCount(out);
      const cov = m.inked / (f.img.width * f.img.height);
      const got = `${name}: R ${m.recall.toFixed(3)} P ${m.precision.toFixed(3)} sp ${sp} cov ${(cov * 100).toFixed(1)}%`;
      assert.ok(m.recall >= fl.r, got);
      assert.ok(m.precision >= fl.p, got);
      assert.ok(sp <= fl.sp, got);
      // Never mush: lines, not filled areas.
      assert.ok(cov > 0.003 && cov < 0.2, got);
      assert.ok(ms < 1500, `${name}: ${ms.toFixed(0)} ms`);
    }
  });
}

test('Sketch low light: no field of grain specks (T78 low-light sigma)', () => {
  const f = FX['low light'];
  const out = outline(f.img, { ...presetSettings('sketch'), invert: false });
  const m = edgeMetrics(out, f.edges, 2);
  // Before T78: R .85 P .73, 76 specks.
  assert.ok(speckCount(out) <= 14 && m.precision >= 0.88 && m.f1 >= 0.8, JSON.stringify(m));
});

test('lowLightSigma: unchanged unless grain is large next to the picture contrast; at most 2x', () => {
  assert.equal(lowLightSigma(1, 0.008, 0.18), 1); // clean photo
  assert.equal(lowLightSigma(1, 0.037, 0.18), 1); // heavy grain, normal contrast
  assert.equal(lowLightSigma(1, 0.02, 0), 1);
  assert.ok(lowLightSigma(1, 0.02, 0.047) > 1.5); // dim, flat, grainy
  assert.equal(lowLightSigma(1, 0.5, 0.05), 2);
});
