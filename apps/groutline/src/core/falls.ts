/**
 * Falls to a waste (shower and wet-area floors).
 *
 * A fall written 1:N means 1 unit of drop for every N units of run, so drop = run ÷ N. Percent = 100 ÷ N.
 * In inches per foot: 1/4 in per ft = 0.25 ÷ 12 = 1:48 (2.08%). These are plain unit conversions.
 *
 * Point (centre) waste with the floor graded in four planes ("envelope" cuts) and a level perimeter. Codes word the
 * requirement as the fall of each floor PLANE to the waste (NCC 2022 HP 10.2.12 "continuous fall of a floor plane"),
 * measured square to the wall, so by default the perimeter height comes from the longest square run (waste to the
 * furthest wall). The hips/valleys running to the corners are longer and so fall less steeply (rise ÷ corner distance);
 * the "valley" basis sizes the rise from the corner run instead, so even the valleys reach the minimum (stricter,
 * steeper planes). The shortest square run is the steepest plane and is checked against the maximum. Linear (strip) waste along one wall: a single plane, run = distance to the opposite wall.
 * Required gradients per country come from the country file (AS 3740 / NCC, BS 5385-4, IPC/IRC, NZBC E3/AS1 …).
 */
import { fail, fmt, type CalcResult, type Problem, type Step } from './steps.ts';
import { formatLength, MM_PER_IN, type UnitSystem } from './units.ts';

/** Parse "1:60", "1/60", "60" (meaning 1:60), "1.5%", "1/4 in/ft", "1/4\" per ft" into N of 1:N. */
export function parseGradient(raw: string): number | null {
  const s = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!s) return null;
  let m = /^1\s*[:/]\s*(\d+(?:\.\d+)?)$/.exec(s);
  if (m) { const n = Number(m[1]); return n >= 1 ? n : null; }
  m = /^(\d+(?:\.\d+)?)\s*%$/.exec(s);
  if (m) { const p = Number(m[1]); return p > 0 && p <= 100 ? 100 / p : null; }
  m = /^(?:(\d+)\s+)?(\d+(?:\.\d+)?)(?:\s*\/\s*(\d+))?\s*(?:"|in|inch|inches)?\s*(?:\/|per)\s*(?:ft|foot|')$/.exec(s);
  if (m) {
    const whole = m[1] ? Number(m[1]) : 0;
    const inches = m[3] ? whole + Number(m[2]) / Number(m[3]) : whole + Number(m[2]);
    return inches > 0 && inches <= 12 ? 12 / inches : null;
  }
  m = /^(\d+(?:\.\d+)?)$/.exec(s);
  if (m) { const n = Number(m[1]); return n >= 1 ? n : null; }
  return null;
}

export function gradientText(n: number, system: UnitSystem): string {
  const pct = `${fmt(100 / n, 2)}%`;
  if (system === 'imperial') return `1:${fmt(n, 1)} (${fmt(12 / n, 3)} in/ft, ${pct})`;
  return `1:${fmt(n, 1)} (${pct})`;
}

export interface FallsInput {
  drain: 'point' | 'linear';
  lengthMm: number;
  widthMm: number;
  /** Point waste: distance of the waste from the left wall and from the back wall. Linear: ignored. */
  drainXMm?: number;
  drainYMm?: number;
  /** Required fall as 1:N, and optional steepest allowed 1:N (smaller N = steeper). */
  minRatio: number;
  maxRatio?: number | null;
  /** 'plane' (default): fall measured square to each wall. 'valley': the corner valleys also reach the minimum. */
  basis?: 'plane' | 'valley';
  /** Bed or screed thickness at the waste (optional) to give finished heights. */
  thicknessAtWasteMm?: number | null;
  system: UnitSystem;
}

export interface FallsResult {
  longestRun: number;
  shortestRun: number;
  rise: number;
  steepestRatio: number;
  /** Fall along the valley to the furthest corner (point waste only). */
  valleyRatio: number | null;
  perimeterThickness: number | null;
  tooSteep: boolean;
}

export function calcFalls(input: FallsInput): CalcResult<FallsResult> {
  const { lengthMm: L, widthMm: W, minRatio: N, system } = input;
  const problems: Problem[] = [];
  if (!(L > 0) || !(W > 0)) problems.push({ field: 'area', message: 'Enter the length and width of the floor.' });
  if (!(N >= 1) || N > 1000) problems.push({ field: 'ratio', message: 'Enter a fall such as 1:60 or 1.5%.' });
  if (input.maxRatio != null && !(input.maxRatio >= 1)) problems.push({ field: 'max', message: 'The steepest fall must be like 1:40.' });
  if (input.maxRatio != null && input.maxRatio > N) problems.push({ field: 'max', message: 'The steepest fall must be steeper than the minimum fall.' });
  const dx = input.drainXMm ?? L / 2, dy = input.drainYMm ?? W / 2;
  if (input.drain === 'point' && (dx < 0 || dx > L || dy < 0 || dy > W)) problems.push({ field: 'drain', message: 'The waste must sit inside the floor.' });
  if (problems.length) return fail(...problems);

  let longest: number, shortest: number, corner = 0;
  const steps: Step[] = [];
  const F = (v: number) => formatLength(v, system, v < 300 ? 'tile' : 'room');
  if (input.drain === 'linear') {
    longest = shortest = L;
    steps.push({ label: 'Run to the far wall', working: 'Strip waste along one wall: a single plane', result: F(L) });
  } else {
    const corners = [[0, 0], [L, 0], [0, W], [L, W]].map(([cx, cy]) => Math.hypot(cx - dx, cy - dy));
    corner = Math.max(...corners);
    const perp = Math.max(dx, L - dx, dy, W - dy);
    shortest = Math.min(dx, L - dx, dy, W - dy);
    if (input.basis === 'valley') {
      longest = corner;
      steps.push({ label: 'Longest run (valley to furthest corner)', working: `√(${F(Math.max(dx, L - dx))}² + ${F(Math.max(dy, W - dy))}²)`, result: F(longest) });
    } else {
      longest = perp;
      steps.push({ label: 'Longest plane run (waste square to furthest wall)', working: `The larger of ${[dx, L - dx, dy, W - dy].map(F).join(', ')}`, result: F(longest) });
    }
    steps.push({ label: 'Shortest plane run (waste to nearest wall)', working: 'Straight out to the nearest wall', result: F(shortest) });
  }
  const rise = longest / N;
  steps.push({ label: 'Height to set the perimeter above the waste', working: `${F(longest)} ÷ ${fmt(N, 1)}`, result: F(rise) });
  const steepest = shortest > 0 ? shortest / rise : Infinity;
  const valley = input.drain === 'point' ? corner / rise : null;
  if (input.drain === 'point') {
    steps.push({ label: 'Steepest plane (on the shortest run)', working: `${F(shortest)} ÷ ${F(rise)}`, result: `1:${fmt(steepest, 1)}` });
    steps.push({ label: 'Valley to the furthest corner', working: `${F(corner)} ÷ ${F(rise)}`, result: `1:${fmt(valley!, 1)}` });
  }
  let perimeter: number | null = null;
  if (input.thicknessAtWasteMm != null && input.thicknessAtWasteMm >= 0) {
    perimeter = input.thicknessAtWasteMm + rise;
    steps.push({ label: 'Bed thickness at the perimeter', working: `${F(input.thicknessAtWasteMm)} at the waste + ${F(rise)}`, result: F(perimeter) });
  }
  const tooSteep = input.maxRatio != null && steepest < input.maxRatio;
  const notes: string[] = [];
  if (tooSteep) notes.push(`The shortest run falls at 1:${fmt(steepest, 1)}, steeper than 1:${fmt(input.maxRatio!, 0)}. Move the waste towards the centre, use a strip waste, or grade each plane separately.`);
  if (system === 'imperial') notes.push(`${fmt(rise / MM_PER_IN, 3)} in total rise.`);
  return { ok: true, value: { longestRun: longest, shortestRun: shortest, rise, steepestRatio: steepest, valleyRatio: valley, perimeterThickness: perimeter, tooSteep }, steps, notes };
}
