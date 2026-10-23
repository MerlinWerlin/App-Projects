// Benchmark: `node src/core/outline.bench.ts` (add `--expose-gc` for a cleaner memory figure).
// Times `outline` on a synthetic 1024x1024 photo-like image and reports the peak extra
// ArrayBuffer bytes held during one run (sampled at every chunk boundary of `outlineSteps`).
import { outline, outlineSteps } from './outline.ts';

const W = 1024;
const H = 1024;
const data = new Uint8ClampedArray(W * H * 4);
let s = 12345;
const rnd = (): number => {
  s = (s * 1664525 + 1013904223) >>> 0;
  return s / 4294967296;
};
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    let v = 60 + (x / W) * 120 + 30 * Math.sin(y * 0.02); // gradients
    if ((x - 300) ** 2 + (y - 350) ** 2 < 150 ** 2) v = 220; // disc
    if (x > 550 && x < 900 && y > 500 && y < 850) v = 35; // rectangle
    if (Math.abs(x - y) < 6) v = 250; // diagonal bar
    v += 8 * Math.sin(x * 0.3) * Math.sin(y * 0.25); // texture
    v += rnd() * 10 - 5; // noise
    const p = (y * W + x) * 4;
    data[p] = v + 10; data[p + 1] = v; data[p + 2] = v - 10; data[p + 3] = 255;
  }
}
const img = { data, width: W, height: H };
const opts = { detail: 0.5, thickness: 2, invert: false };

// Cold first call (no JIT warm-up), closest to the first outline on a phone.
const c0 = performance.now();
outline(img, opts);
const cold = performance.now() - c0;

// Memory next, before the timing runs leave garbage behind.
const gc = (globalThis as { gc?: () => void }).gc;
if (gc) gc();
const base = process.memoryUsage().arrayBuffers;
let peak = 0;
{
  const gen = outlineSteps(img, opts);
  for (let r = gen.next(); ; r = gen.next()) {
    const extra = process.memoryUsage().arrayBuffers - base;
    if (extra > peak) peak = extra;
    if (r.done) break;
  }
}

const RUNS = 15;
for (let i = 0; i < 3; i++) outline(img, opts); // warm-up (JIT)
const times: number[] = [];
let lines = 0;
for (let run = 0; run < RUNS; run++) {
  const t0 = performance.now();
  const out = outline(img, opts);
  times.push(performance.now() - t0);
  lines = 0;
  for (let i = 3; i < out.data.length; i += 4) if (out.data[i] === 255) lines++;
}
const sorted = [...times].sort((a, b) => a - b);
const median = sorted[RUNS >> 1];
console.log(
  `outline 1024x1024: cold ${cold.toFixed(1)} ms; warm median ${median.toFixed(1)} ms (min ${sorted[0].toFixed(1)}, max ${sorted[RUNS - 1].toFixed(1)}, ${RUNS} runs after warm-up); ` +
    `peak extra ArrayBuffer ${(peak / 1048576).toFixed(1)} MiB${gc ? '' : ' (run with --expose-gc for a clean figure)'}; ` +
    `line px ${lines} (${((100 * lines) / (W * H)).toFixed(2)}%); node ${process.version}`,
);
