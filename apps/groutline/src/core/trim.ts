/**
 * Trim and edging lengths (tile trims, edge strips, stair nosings, cove, movement-joint profiles).
 *
 * Each run (an edge to be trimmed) is cut from stock lengths. A run longer than a stock length is made of whole
 * lengths plus a remainder, joined end to end. Remainders and short runs are then packed into stock lengths with
 * "first fit decreasing", the standard one-dimensional cutting-stock heuristic (Johnson 1973; used by trade
 * cut-list tools). An optional allowance per cut covers saw kerf / mitre. Stock lengths per country come from
 * the country file (2.4–2.5 m metric, 8 ft imperial).
 */
import { ceilSafe, fail, type CalcResult, type Problem, type Step } from './steps.ts';
import { formatLength, type UnitSystem } from './units.ts';

export interface TrimInput {
  runsMm: number[];
  stockMm: number;
  /** Allowance per cut piece (kerf, mitre, squaring the end). */
  allowanceMm: number;
  system: UnitSystem;
}

export interface TrimResult {
  totalRun: number;
  lengths: number;
  /** Each stock length and the pieces cut from it. */
  bars: number[][];
  offcut: number;
  naive: number;
}

export function calcTrim(input: TrimInput): CalcResult<TrimResult> {
  const { stockMm: S, allowanceMm: a, system } = input;
  const runs = input.runsMm.filter(r => r > 0);
  const problems: Problem[] = [];
  if (!runs.length) problems.push({ field: 'runs', message: 'Add at least one edge to trim.' });
  if (input.runsMm.some(r => !(r >= 0))) problems.push({ field: 'runs', message: 'Lengths must be above zero.' });
  if (!(S > 0)) problems.push({ field: 'stock', message: 'Enter the length the trim comes in.' });
  if (!(a >= 0) || a >= S / 2) problems.push({ field: 'allowance', message: 'The cut allowance is too big for the stock length.' });
  if (problems.length) return fail(...problems);

  const pieces: number[] = [];
  const bars: number[][] = [];
  for (const r of runs) {
    // Whole stock lengths for long runs (joined, no cut allowance needed on a factory end).
    const whole = Math.floor((r + 1e-9) / S);
    for (let i = 0; i < whole; i++) bars.push([S]);
    const rest = r - whole * S;
    if (rest > 0.5) pieces.push(rest + a);
  }
  pieces.sort((p, q) => q - p);
  const open: { left: number; cuts: number[] }[] = [];
  for (const p of pieces) {
    const bin = open.find(b => b.left + 1e-9 >= p);
    if (bin) { bin.left -= p; bin.cuts.push(p); } else open.push({ left: S - p, cuts: [p] });
  }
  for (const b of open) bars.push(b.cuts);
  const total = runs.reduce((s, r) => s + r, 0);
  const lengths = bars.length;
  const offcut = open.reduce((s, b) => s + b.left, 0);
  const naive = ceilSafe(total / S);
  const F = (v: number) => formatLength(v, system);
  const steps: Step[] = [
    { label: 'Total edge to trim', working: runs.map(F).join(' + '), result: F(total) },
    { label: 'Straight division', working: `${F(total)} ÷ ${F(S)}, rounded up (if every offcut could be used)`, result: `${naive} lengths` },
    { label: 'Cut list', working: `Each edge cut from a ${F(S)} length${a ? `, ${F(a)} allowed per cut` : ''}; offcuts reused where they fit`, result: `${lengths} lengths` },
  ];
  const notes = [`Offcut left over: ${F(offcut)} in total.`];
  if (lengths > naive) notes.push('Short offcuts can\'t make up the longer edges, so you need more than the straight division.');
  return { ok: true, value: { totalRun: total, lengths, bars, offcut, naive }, steps, notes };
}
