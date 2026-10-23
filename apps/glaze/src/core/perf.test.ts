// Performance / size benchmark for the bulk-install profile with 60 icons.
// Synthesises PNG-sized base64 payloads (12–25 KB per 180×180 PNG) and reports profile
// sizes, split counts and buildProfiles timing. Numbers are printed so they can go in
// docs/PERF_A11Y.md; assertions keep generous ceilings so the test is stable on slow CI.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildProfiles, estimateSize, DEFAULT_MAX_PROFILE_BYTES, utf8Length, type WebClipIcon } from './mobileconfig.ts';

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Deterministic PRNG (mulberry32) so runs are comparable. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random base64 string encoding `bytes` raw bytes. */
function fakePngBase64(bytes: number, rand: () => number): string {
  const len = Math.ceil(bytes / 3) * 4;
  const chars = new Array<string>(len);
  for (let i = 0; i < len; i++) chars[i] = B64[Math.floor(rand() * 64)];
  return chars.join('');
}

function makeIcons(n: number, minKB: number, maxKB: number, seed = 42): { icons: WebClipIcon[]; rawBytes: number } {
  const rand = rng(seed);
  const icons: WebClipIcon[] = [];
  let rawBytes = 0;
  for (let i = 0; i < n; i++) {
    const bytes = Math.round((minKB + rand() * (maxKB - minKB)) * 1024);
    rawBytes += bytes;
    icons.push({ label: `App ${i + 1}`, url: `app${i + 1}:`, pngBase64: fakePngBase64(bytes, rand) });
  }
  return { icons, rawBytes };
}

const kb = (n: number) => `${(n / 1024).toFixed(0)} KB`;
const mb = (n: number) => `${(n / (1024 * 1024)).toFixed(2)} MB`;

function report(name: string, minKB: number, maxKB: number) {
  const { icons, rawBytes } = makeIcons(60, minKB, maxKB);
  const est = estimateSize(icons, 'Plum Glaze');
  // Warm up once, then time the median of 5 runs.
  buildProfiles({ themeName: 'Plum Glaze', icons });
  const times: number[] = [];
  let files = buildProfiles({ themeName: 'Plum Glaze', icons });
  for (let r = 0; r < 5; r++) {
    const t0 = performance.now();
    files = buildProfiles({ themeName: 'Plum Glaze', icons });
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  const median = times[2];
  const sizes = files.map((f) => utf8Length(f.xml));
  console.log(
    `[perf] ${name}: 60 icons, PNG ${minKB}–${maxKB} KB (raw total ${mb(rawBytes)}) -> ` +
      `estimate ${mb(est)}, ${files.length} profile(s) [${sizes.map(kb).join(', ')}], ` +
      `buildProfiles median ${median.toFixed(1)} ms (max ${times[4].toFixed(1)} ms)`,
  );
  return { icons, files, sizes, median, est, rawBytes };
}

test('perf: 60 icons at typical PNG sizes (12–25 KB) build quickly and split under the cap', () => {
  const r = report('typical', 12, 25);
  assert.ok(r.median < 1000, `buildProfiles took ${r.median} ms`);
  for (const s of r.sizes) assert.ok(s <= DEFAULT_MAX_PROFILE_BYTES, `profile ${s} B over cap`);
  // base64 inflates ~4/3 plus line wrapping; one profile per ~2.5 MB.
  const total = r.sizes.reduce((a, b) => a + b, 0);
  assert.ok(total > r.rawBytes * 1.3 && total < r.rawBytes * 1.6, `total ${total} vs raw ${r.rawBytes}`);
  assert.ok(r.files.length >= 1 && r.files.length <= 3, `split into ${r.files.length}`);
  // The estimate used for splitting stays within 5% of the real output.
  if (r.files.length === 1) assert.ok(Math.abs(r.est - total) / total < 0.05);
});

test('perf: 60 icons at the small end (12 KB each) fit in one profile', () => {
  const r = report('small', 12, 12);
  assert.equal(r.files.length, 1);
  assert.ok(r.median < 1000);
});

test('perf: 60 icons at the large end (25 KB each) still fit in one 2.5 MB profile', () => {
  const r = report('large', 25, 25);
  assert.equal(r.files.length, 1);
  assert.ok(r.sizes[0] <= DEFAULT_MAX_PROFILE_BYTES);
  assert.ok(r.median < 1000);
});

test('perf: 60 photo-heavy icons (40 KB each) split into 2 profiles, each under the cap', () => {
  const r = report('photo-heavy', 40, 40);
  assert.equal(r.files.length, 2);
  for (const s of r.sizes) assert.ok(s <= DEFAULT_MAX_PROFILE_BYTES);
  assert.ok(r.median < 1000);
});
