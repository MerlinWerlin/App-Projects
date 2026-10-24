// Sound processing for Backspin: reverse, trim, normalise, fades, voice effects, waveform peaks and the
// four-part share clip. Pure TypeScript (Float32Array in, Float32Array out), tested with node --test.
import type { Pcm } from './wav.ts';

export function reverse(pcm: Pcm): Pcm {
  const s = pcm.samples;
  const out = new Float32Array(s.length);
  for (let i = 0, j = s.length - 1; i < s.length; i++, j--) out[i] = s[j];
  return { sampleRate: pcm.sampleRate, samples: out };
}

/** Peak of |x|. */
export function peak(s: Float32Array): number {
  let m = 0;
  for (let i = 0; i < s.length; i++) {
    const a = Math.abs(s[i]);
    if (a > m) m = a;
  }
  return m;
}

/** Root-mean-square level of a window. */
function rms(s: Float32Array, from: number, to: number): number {
  let acc = 0;
  for (let i = from; i < to; i++) acc += s[i] * s[i];
  return Math.sqrt(acc / Math.max(1, to - from));
}

/**
 * Cuts silence at both ends. The threshold follows the recording (a fraction of its loudest 20 ms window,
 * never below an absolute floor) so quiet rooms and loud rooms both trim well. Keeps `padMs` either side.
 */
export function trimSilence(pcm: Pcm, padMs = 80, rel = 0.08, floor = 0.006): Pcm {
  const s = pcm.samples;
  const win = Math.max(1, Math.round(pcm.sampleRate * 0.02));
  const levels: number[] = [];
  for (let i = 0; i < s.length; i += win) levels.push(rms(s, i, Math.min(s.length, i + win)));
  const loud = levels.reduce((a, b) => Math.max(a, b), 0);
  const thr = Math.max(floor, loud * rel);
  let first = levels.findIndex((l) => l >= thr);
  if (first < 0) return { sampleRate: pcm.sampleRate, samples: new Float32Array(0) };
  let last = levels.length - 1;
  while (last > first && levels[last] < thr) last--;
  const pad = Math.round((pcm.sampleRate * padMs) / 1000);
  const a = Math.max(0, first * win - pad);
  const b = Math.min(s.length, (last + 1) * win + pad);
  return { sampleRate: pcm.sampleRate, samples: s.slice(a, b) };
}

/** True when the recording is basically silence (nothing for the game to work with). */
export function isSilent(pcm: Pcm, floor = 0.01): boolean {
  return pcm.samples.length < pcm.sampleRate * 0.15 || peak(pcm.samples) < floor;
}

/** Scales to a target peak (default -1 dBFS), never boosting more than `maxGain` (keeps hiss down). */
export function normalize(pcm: Pcm, target = 0.89, maxGain = 8): Pcm {
  const p = peak(pcm.samples);
  if (p <= 0) return pcm;
  const g = Math.min(maxGain, target / p);
  const out = new Float32Array(pcm.samples.length);
  for (let i = 0; i < out.length; i++) out[i] = pcm.samples[i] * g;
  return { sampleRate: pcm.sampleRate, samples: out };
}

/** Short fade in and out so cuts never click. */
export function fade(pcm: Pcm, ms = 12): Pcm {
  const out = pcm.samples.slice();
  const n = Math.min(Math.round((pcm.sampleRate * ms) / 1000), Math.floor(out.length / 2));
  for (let i = 0; i < n; i++) {
    const g = i / n;
    out[i] *= g;
    out[out.length - 1 - i] *= g;
  }
  return { sampleRate: pcm.sampleRate, samples: out };
}

/** Linear-interpolation resample by `factor` (>1 = faster and higher, <1 = slower and deeper). */
export function speed(pcm: Pcm, factor: number): Pcm {
  const s = pcm.samples;
  const n = Math.max(1, Math.floor(s.length / factor));
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = i * factor;
    const k = Math.floor(x);
    const f = x - k;
    const a = s[k] ?? 0;
    const b = s[k + 1] ?? a;
    out[i] = a + (b - a) * f;
  }
  return { sampleRate: pcm.sampleRate, samples: out };
}

/** Averages groups of samples down to a lower rate (used before scoring). */
export function downsample(pcm: Pcm, target: number): Pcm {
  const step = Math.max(1, Math.floor(pcm.sampleRate / target));
  if (step === 1) return pcm;
  const n = Math.floor(pcm.samples.length / step);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let acc = 0;
    for (let k = 0; k < step; k++) acc += pcm.samples[i * step + k];
    out[i] = acc / step;
  }
  return { sampleRate: pcm.sampleRate / step, samples: out };
}

export type Effect = 'none' | 'chipmunk' | 'giant' | 'robot' | 'echo' | 'alien';
export const EFFECTS: Effect[] = ['none', 'chipmunk', 'giant', 'robot', 'echo', 'alien'];
/** Effects included free; the rest come with Backspin Plus. */
export const FREE_EFFECTS: Effect[] = ['none', 'chipmunk'];

export function applyEffect(pcm: Pcm, fx: Effect): Pcm {
  const sr = pcm.sampleRate;
  switch (fx) {
    case 'chipmunk':
      return speed(pcm, 1.45);
    case 'giant':
      return speed(pcm, 0.72);
    case 'robot': {
      const out = new Float32Array(pcm.samples.length);
      const w = (2 * Math.PI * 55) / sr;
      for (let i = 0; i < out.length; i++) out[i] = pcm.samples[i] * (0.35 + 0.65 * Math.abs(Math.sin(w * i)));
      return normalize({ sampleRate: sr, samples: out });
    }
    case 'echo': {
      const d = Math.round(sr * 0.18);
      const out = new Float32Array(pcm.samples.length + d * 4);
      out.set(pcm.samples);
      for (let i = d; i < out.length; i++) out[i] += out[i - d] * 0.45;
      return normalize({ sampleRate: sr, samples: out });
    }
    case 'alien': {
      const sped = speed(pcm, 1.18);
      const out = new Float32Array(sped.samples.length);
      const w = (2 * Math.PI * 7) / sr;
      for (let i = 0; i < out.length; i++) out[i] = sped.samples[i] * (0.6 + 0.4 * Math.sin(w * i));
      return normalize({ sampleRate: sr, samples: out });
    }
    default:
      return pcm;
  }
}

/** `bars` peak heights between 0 and 1 for drawing a waveform. */
export function waveformPeaks(s: Float32Array, bars: number): number[] {
  const out: number[] = [];
  if (s.length === 0 || bars < 1) return new Array(Math.max(0, bars)).fill(0);
  const per = s.length / bars;
  let top = 0;
  for (let b = 0; b < bars; b++) {
    const a = Math.floor(b * per);
    const e = Math.max(a + 1, Math.floor((b + 1) * per));
    let m = 0;
    for (let i = a; i < e && i < s.length; i++) m = Math.max(m, Math.abs(s[i]));
    out.push(m);
    top = Math.max(top, m);
  }
  return top > 0 ? out.map((v) => Math.max(0.04, v / top)) : out.map(() => 0.04);
}

function tone(sr: number, hz: number, ms: number, gain = 0.25): Float32Array {
  const n = Math.round((sr * ms) / 1000);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const env = Math.min(1, i / (sr * 0.005), (n - i) / (sr * 0.02));
    out[i] = Math.sin((2 * Math.PI * hz * i) / sr) * gain * env;
  }
  return out;
}

/** Converts to `sr` if needed (all parts of a clip share one rate). */
function atRate(p: Pcm, sr: number): Float32Array {
  return p.sampleRate === sr ? p.samples : speed(p, p.sampleRate / sr).samples;
}

/**
 * The share clip in the order the trend uses: original, backwards, my copy, my copy flipped. A rising chirp
 * separates the parts so listeners can follow along. Everything at the original's sample rate.
 */
export function buildShareClip(parts: Pcm[], gapMs = 350): Pcm {
  const sr = parts[0]?.sampleRate ?? 44100;
  const chunks: Float32Array[] = [];
  parts.forEach((p, i) => {
    if (i > 0) {
      chunks.push(new Float32Array(Math.round((sr * gapMs) / 2000)));
      chunks.push(tone(sr, 660 + i * 220, 90));
      chunks.push(new Float32Array(Math.round((sr * gapMs) / 2000)));
    }
    chunks.push(atRate(fade(p), sr));
  });
  const total = chunks.reduce((a, c) => a + c.length, 0);
  const out = new Float32Array(total);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return { sampleRate: sr, samples: out };
}

/** The pipeline after a take is recorded: trim, normalise, fade. */
export function cleanTake(pcm: Pcm): Pcm {
  return fade(normalize(trimSilence(pcm)));
}
