import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyEffect, buildShareClip, cleanTake, isSilent, reverse, trimSilence, waveformPeaks, EFFECTS } from './dsp.ts';
import { scoreTakes, starsFor } from './score.ts';
import { encodeWav, parseWav, type Pcm } from './wav.ts';

const SR = 44100;

/** A fake "voice": a few syllables with different pitches and vowel-ish harmonics. */
function voice(pitches: number[], sylMs = 180, sr = SR, seed = 1): Pcm {
  const n = Math.round((sr * sylMs) / 1000);
  const out = new Float32Array(n * pitches.length + sr * 0.3);
  let r = seed;
  const rnd = () => ((r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) - 0.5;
  pitches.forEach((hz, k) => {
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const env = Math.sin((Math.PI * i) / n);
      const v =
        Math.sin(2 * Math.PI * hz * t) + 0.5 * Math.sin(2 * Math.PI * hz * 2 * t) + 0.3 * Math.sin(2 * Math.PI * hz * 3.1 * t);
      out[Math.round(sr * 0.15) + k * n + i] = 0.3 * env * v + 0.01 * rnd();
    }
  });
  return { sampleRate: sr, samples: out };
}

test('WAV round trip keeps rate and samples', () => {
  const p = voice([220, 330]);
  const back = parseWav(encodeWav(p));
  assert.equal(back.sampleRate, SR);
  assert.equal(back.samples.length, p.samples.length);
  assert.ok(Math.abs(back.samples[5000] - p.samples[5000]) < 1e-4);
});

test('parseWav skips extra chunks (iOS FLLR) and mixes stereo', () => {
  const mono = encodeWav({ sampleRate: 22050, samples: new Float32Array([0.5, -0.5, 0.25]) });
  // Build stereo 16-bit with a FLLR chunk before data.
  const frames = 3;
  const data = new Uint8Array(frames * 4);
  const dv = new DataView(data.buffer);
  [0.5, -0.5, 0.25].forEach((v, i) => {
    dv.setInt16(i * 4, Math.round(v * 32767), true);
    dv.setInt16(i * 4 + 2, Math.round(v * 32767), true);
  });
  const fllr = new Uint8Array(8 + 6);
  fllr.set([70, 76, 76, 82], 0);
  new DataView(fllr.buffer).setUint32(4, 6, true);
  const head = mono.slice(0, 36);
  const hv = new DataView(head.buffer);
  hv.setUint16(22, 2, true);
  hv.setUint32(28, 22050 * 4, true);
  hv.setUint16(32, 4, true);
  const dh = new Uint8Array(8);
  dh.set([100, 97, 116, 97]);
  new DataView(dh.buffer).setUint32(4, data.length, true);
  const all = new Uint8Array(head.length + fllr.length + dh.length + data.length);
  all.set(head);
  all.set(fllr, head.length);
  all.set(dh, head.length + fllr.length);
  all.set(data, head.length + fllr.length + dh.length);
  const p = parseWav(all);
  assert.equal(p.samples.length, 3);
  assert.ok(Math.abs(p.samples[1] + 0.5) < 1e-3);
});

test('parseWav rejects non-WAV with a clear code', () => {
  assert.throws(() => parseWav(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])), /not a WAV/);
});

test('reverse twice is identity', () => {
  const p = voice([200, 300, 400]);
  const rr = reverse(reverse(p));
  assert.deepEqual(rr.samples.slice(0, 100), p.samples.slice(0, 100));
  assert.equal(reverse(p).samples[0], p.samples[p.samples.length - 1]);
});

test('trimSilence removes the quiet ends', () => {
  const p = voice([250, 260]);
  const t = trimSilence(p);
  assert.ok(t.samples.length < p.samples.length);
  assert.ok(t.samples.length > SR * 0.3);
  assert.ok(isSilent({ sampleRate: SR, samples: new Float32Array(SR) }));
  assert.ok(!isSilent(p));
});

test('scoring: same take is near 100, a copy at a different speed still scores well, unrelated sounds score low', () => {
  const orig = voice([200, 320, 260, 410, 180]);
  const same = scoreTakes(orig, orig).score;
  assert.ok(same >= 95, `same ${same}`);
  const slower = scoreTakes(orig, voice([200, 320, 260, 410, 180], 230, SR, 7)).score;
  assert.ok(slower >= 60, `slower ${slower}`);
  const noise = (() => {
    const s = new Float32Array(SR);
    let r = 9;
    for (let i = 0; i < s.length; i++) s[i] = ((r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff - 0.5) * 0.6;
    return { sampleRate: SR, samples: s };
  })();
  const bad = scoreTakes(orig, noise).score;
  assert.ok(bad < slower - 20, `noise ${bad} vs ${slower}`);
  const other = scoreTakes(orig, voice([500, 150, 600, 120, 700])).score;
  assert.ok(other < 45, `other ${other}`);
  assert.equal(starsFor(100), 5);
  assert.equal(starsFor(0), 0);
});

test('score of empty takes is 0, never NaN', () => {
  const empty = { sampleRate: SR, samples: new Float32Array(10) };
  assert.equal(scoreTakes(empty, empty).score, 0);
});

test('effects, peaks and share clip produce sane output', () => {
  const p = cleanTake(voice([220, 300]));
  for (const fx of EFFECTS) {
    const o = applyEffect(p, fx);
    assert.ok(o.samples.length > 0, fx);
    assert.ok(o.samples.every((v) => Number.isFinite(v)), fx);
  }
  const peaks = waveformPeaks(p.samples, 48);
  assert.equal(peaks.length, 48);
  assert.ok(Math.max(...peaks) === 1);
  const clip = buildShareClip([p, reverse(p), p, reverse(p)]);
  assert.ok(clip.samples.length > p.samples.length * 4);
});
