/**
 * Cable-run planning: total cable needed for a list of runs, and which drum each run is cut from.
 *
 * Each run gets a termination allowance (tails at both ends) and the total gets a waste allowance.
 * Cutting uses best-fit decreasing (longest run first, into the drum it leaves the smallest offcut on),
 * a standard bin-packing heuristic (D. S. Johnson, "Near-optimal bin packing algorithms", MIT 1973).
 * It is fast and usually close to the best plan, but not guaranteed optimal, especially with mixed drum lengths.
 */
import { fail, positive, type CalcResult } from './num.ts';

export interface Run { id: string; label: string; length: number | null; qty: number | null }
export interface Drum { id: string; label: string; length: number | null }

export interface Cut { runId: string; label: string; length: number }
export interface DrumPlan { drumId: string; label: string; length: number; cuts: Cut[]; offcut: number }

export interface CutOut {
  /** Sum of cut lengths (runs × qty, each with allowance). */
  totalCut: number;
  /** Total including waste allowance: what to order. */
  toOrder: number;
  plans: DrumPlan[];
  /** Pieces that did not fit on any drum (no drum long enough, or not enough cable). */
  unplaced: Cut[];
  /** Cable left on drums after cutting. */
  leftover: number;
}

export function planCuts(input: { runs: Run[]; drums: Drum[]; allowance?: number | null; wastePct?: number | null }): CalcResult<CutOut> {
  const allowance = input.allowance ?? 0;
  const waste = input.wastePct ?? 0;
  if (!(Number.isFinite(allowance) && allowance >= 0)) return fail('Termination allowance must be 0 or more.');
  if (!(Number.isFinite(waste) && waste >= 0 && waste < 100)) return fail('Waste allowance must be between 0 and 100 %.');
  const runs = input.runs.filter(r => r.length != null || r.qty != null);
  if (!runs.length) return fail('Add at least one run.');
  const pieces: Cut[] = [];
  for (const r of runs) {
    if (!positive(r.length)) return fail(`${r.label || 'A run'} needs a length more than 0.`);
    const q = r.qty ?? 1;
    if (!(Number.isInteger(q) && q > 0 && q <= 500)) return fail(`${r.label || 'A run'}: quantity must be a whole number from 1 to 500.`);
    for (let i = 0; i < q; i++) pieces.push({ runId: r.id, label: q > 1 ? `${r.label} (${i + 1}/${q})` : r.label, length: r.length + allowance });
  }
  for (const d of input.drums) if (!positive(d.length)) return fail(`${d.label || 'A drum'} needs a length more than 0.`);
  const totalCut = pieces.reduce((a, p) => a + p.length, 0);
  const toOrder = totalCut / (1 - waste / 100);
  const plans: DrumPlan[] = input.drums.map(d => ({ drumId: d.id, label: d.label, length: d.length as number, cuts: [], offcut: d.length as number }));
  const unplaced: Cut[] = [];
  const sorted = [...pieces].sort((a, b) => b.length - a.length);
  for (const p of sorted) {
    let best: DrumPlan | null = null;
    for (const plan of plans) {
      if (plan.offcut + 1e-9 >= p.length && (best === null || plan.offcut < best.offcut)) best = plan;
    }
    if (best) { best.cuts.push(p); best.offcut -= p.length; }
    else unplaced.push(p);
  }
  for (const plan of plans) plan.offcut = Math.max(0, Math.round(plan.offcut * 1000) / 1000);
  const leftover = plans.reduce((a, p) => a + p.offcut, 0);
  const steps = [
    `${pieces.length} cut${pieces.length === 1 ? '' : 's'}, each run + ${allowance} m termination allowance = ${round3(totalCut)} m`,
    waste > 0 ? `Add ${waste} % waste: ${round3(totalCut)} ÷ (1 − ${waste / 100}) = ${round3(toOrder)} m to order` : `No waste allowance: order at least ${round3(toOrder)} m`,
  ];
  if (plans.length) steps.push('Longest run first, each into the drum that leaves the smallest offcut.');
  const warnings: string[] = [];
  if (unplaced.length) warnings.push(`${unplaced.length} run${unplaced.length === 1 ? '' : 's'} won't fit on the drums listed. Add a drum or a longer one.`);
  return { ok: true, value: { totalCut, toOrder, plans, unplaced, leftover }, steps, warnings };
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;
