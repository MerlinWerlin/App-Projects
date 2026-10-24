// "How close was it?" Compares the original take with the flipped copy and returns 0-100.
// Method: both are trimmed and brought to 8 kHz; each 32 ms frame becomes 20 log-energy bands (a cheap
// mel-like filterbank over an FFT), with per-take mean removal so mic level and room tone matter less.
// Dynamic time warping lines the two up (people speak at different speeds), and the average distance along
// the best path is mapped to a friendly score. Duration and loudness-shape similarity nudge it a little.
// It is a party-game score, tuned to feel fair, not a speech recogniser.
import { downsample, trimSilence } from './dsp.ts';
import type { Pcm } from './wav.ts';

const SR = 8000;
const N = 256; // frame (32 ms at 8 kHz)
const HOP = 128;
const BANDS = 20;

function fftMag(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}

const mel = (f: number) => 2595 * Math.log10(1 + f / 700);
const imel = (m: number) => 700 * (10 ** (m / 2595) - 1);

/** Band edges in FFT bins, 100 Hz - 3.8 kHz on the mel scale. */
const EDGES: number[] = (() => {
  const lo = mel(100);
  const hi = mel(3800);
  const e: number[] = [];
  for (let i = 0; i <= BANDS + 1; i++) e.push(Math.round((imel(lo + ((hi - lo) * i) / (BANDS + 1)) * N) / SR));
  return e;
})();

const HANN = (() => {
  const w = new Float64Array(N);
  for (let i = 0; i < N; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1));
  return w;
})();

export type Features = { frames: Float64Array[]; energy: number[] };

export function features(pcm: Pcm): Features {
  const s = downsample(trimSilence(pcm, 40), SR).samples;
  const frames: Float64Array[] = [];
  const energy: number[] = [];
  for (let o = 0; o + N <= s.length; o += HOP) {
    const re = new Float64Array(N);
    const im = new Float64Array(N);
    let e = 0;
    for (let i = 0; i < N; i++) {
      re[i] = s[o + i] * HANN[i];
      e += s[o + i] * s[o + i];
    }
    fftMag(re, im);
    const pow = new Float64Array(N / 2 + 1);
    for (let k = 0; k <= N / 2; k++) pow[k] = re[k] * re[k] + im[k] * im[k];
    const f = new Float64Array(BANDS);
    for (let b = 0; b < BANDS; b++) {
      const a = EDGES[b];
      const c = Math.max(a + 1, EDGES[b + 1]);
      const z = Math.max(c + 1, EDGES[b + 2]);
      let acc = 0;
      for (let k = a; k < z && k <= N / 2; k++) {
        const wgt = k < c ? (k - a) / (c - a) : (z - k) / (z - c);
        acc += pow[k] * Math.max(0, wgt);
      }
      f[b] = Math.log(acc + 1e-6);
    }
    frames.push(f);
    energy.push(Math.sqrt(e / N));
  }
  // Mean removal per band, then one global scale, so a louder or quieter take compares fairly.
  if (frames.length) {
    const mean = new Float64Array(BANDS);
    for (const f of frames) for (let b = 0; b < BANDS; b++) mean[b] += f[b] / frames.length;
    let v = 0;
    for (const f of frames) for (let b = 0; b < BANDS; b++) v += (f[b] - mean[b]) ** 2;
    const sd = Math.sqrt(v / (frames.length * BANDS)) || 1;
    for (const f of frames) for (let b = 0; b < BANDS; b++) f[b] = (f[b] - mean[b]) / sd;
  }
  return { frames, energy };
}

function dist(a: Float64Array, b: Float64Array): number {
  let acc = 0;
  for (let i = 0; i < a.length; i++) acc += (a[i] - b[i]) ** 2;
  return Math.sqrt(acc / a.length);
}

/** Average frame distance along the best DTW path (band limited for speed). */
export function dtwDistance(A: Float64Array[], B: Float64Array[]): number {
  const n = A.length;
  const m = B.length;
  if (!n || !m) return Infinity;
  const band = Math.max(Math.abs(n - m) + 4, Math.round(Math.max(n, m) * 0.3));
  const INF = 1e18;
  let prev = new Float64Array(m + 1).fill(INF);
  let prevLen = new Float64Array(m + 1);
  prev[0] = 0;
  for (let i = 1; i <= n; i++) {
    const cur = new Float64Array(m + 1).fill(INF);
    const curLen = new Float64Array(m + 1);
    const centre = Math.round((i * m) / n);
    const lo = Math.max(1, centre - band);
    const hi = Math.min(m, centre + band);
    for (let j = lo; j <= hi; j++) {
      const d = dist(A[i - 1], B[j - 1]);
      let best = prev[j - 1];
      let len = prevLen[j - 1];
      if (prev[j] < best) {
        best = prev[j];
        len = prevLen[j];
      }
      if (cur[j - 1] < best) {
        best = cur[j - 1];
        len = curLen[j - 1];
      }
      cur[j] = best + d;
      curLen[j] = len + 1;
    }
    prev = cur;
    prevLen = curLen;
  }
  return prev[m] >= INF ? Infinity : prev[m] / Math.max(1, prevLen[m]);
}

function corr(a: number[], b: number[]): number {
  // Loudness shapes resampled to 32 points, then Pearson correlation.
  const r = (x: number[]) => Array.from({ length: 32 }, (_, i) => x[Math.min(x.length - 1, Math.floor((i * x.length) / 32))] ?? 0);
  const x = r(a);
  const y = r(b);
  const mx = x.reduce((p, q) => p + q, 0) / 32;
  const my = y.reduce((p, q) => p + q, 0) / 32;
  let sxy = 0;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < 32; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sx += (x[i] - mx) ** 2;
    sy += (y[i] - my) ** 2;
  }
  return sx && sy ? sxy / Math.sqrt(sx * sy) : 0;
}

export type ScoreBreakdown = { score: number; sound: number; rhythm: number; length: number };

/** Score of the flipped copy against the original, 0-100 (100 = spot on). */
export function scoreTakes(original: Pcm, flipped: Pcm): ScoreBreakdown {
  const A = features(original);
  const B = features(flipped);
  if (A.frames.length < 3 || B.frames.length < 3) return { score: 0, sound: 0, rhythm: 0, length: 0 };
  const d = dtwDistance(A.frames, B.frames);
  // d is ~0 for the same sound and ~1.3+ for unrelated sounds after normalisation.
  const sound = clamp01(1 - (d - 0.35) / 0.95);
  const rhythm = clamp01((corr(A.energy, B.energy) + 0.2) / 1.1);
  const ratio = Math.min(A.frames.length, B.frames.length) / Math.max(A.frames.length, B.frames.length);
  const length = clamp01((ratio - 0.35) / 0.55);
  // Sound similarity gates the rest: matching rhythm alone never earns a good score.
  const raw = sound * (0.72 + 0.16 * rhythm + 0.12 * length);
  // Gentle curve: party scores should feel generous in the middle without handing out 100s.
  const score = Math.round(100 * Math.pow(clamp01(raw), 0.85));
  return { score, sound: Math.round(sound * 100), rhythm: Math.round(rhythm * 100), length: Math.round(length * 100) };
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : Number.isFinite(x) ? x : 0);

/** Stars out of 5 for a score. */
export const starsFor = (score: number) => (score >= 90 ? 5 : score >= 75 ? 4 : score >= 55 ? 3 : score >= 35 ? 2 : score >= 15 ? 1 : 0);
