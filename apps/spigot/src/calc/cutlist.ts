/**
 * Stock-length cut list: fit the pieces into as few stock lengths as possible (one-dimensional bin packing).
 *
 * Bin packing is NP-hard, so for up to MAX_EXACT pieces Spigot runs an exact branch-and-bound search (with a node
 * limit) and otherwise the First-Fit Decreasing and Best-Fit Decreasing heuristics, keeping the better plan.
 * FFD never uses more than 11/9·OPT + 6/9 bins (Dósa 2007, "The tight bound of First Fit Decreasing bin-packing
 * algorithm is FFD(I) ≤ 11/9 OPT(I) + 6/9"); see also Martello & Toth, "Knapsack Problems" (Wiley 1990), ch. 8.
 * Lower bound used to stop early: ⌈Σ pieces ÷ usable length⌉ (Martello & Toth L1 bound).
 *
 * Kerf (blade width) and trim: the first cut squares the factory end (trim), every piece then costs its length plus
 * one kerf, except that the last piece in a bar needs no cut after it if it ends exactly at the bar end.
 *   feasible bar:  Σ pieces + kerf × (k − 1) ≤ usable      (usable = stock − trim)
 *   offcut:        max(0, usable − Σ pieces − kerf × k)
 * Tie-break between plans with the same number of bars: keep the waste in as few, long offcuts as possible
 * (largest Σ offcut²), so the leftover is a usable length rather than many short scraps.
 */
import { fail, isNonNeg, isPos, type CalcResult } from './steps';

export interface PieceSpec { length: number; qty: number; label?: string }
export interface CutListInput { stock: number; kerf: number; trim: number; pieces: PieceSpec[] }

export interface Piece { length: number; label?: string; spec: number }
export interface Bar { pieces: Piece[]; used: number; offcut: number }
export interface CutPlan { bars: Bar[]; totalPieces: number; totalPieceLength: number; waste: number; efficiency: number; lowerBound: number; optimal: boolean }

export const MAX_EXACT = 24;
const NODE_LIMIT = 250_000;
const EPS = 1e-6;

/** Length a bar needs for these pieces (with the kerf rule above). */
export function barNeed(lengths: number[], kerf: number): number {
  if (lengths.length === 0) return 0;
  return lengths.reduce((s, l) => s + l, 0) + kerf * (lengths.length - 1);
}

function offcutOf(sum: number, k: number, usable: number, kerf: number) {
  return Math.max(0, usable - sum - kerf * k);
}

function score(bars: { sum: number; k: number }[], usable: number, kerf: number) {
  return bars.reduce((s, b) => s + offcutOf(b.sum, b.k, usable, kerf) ** 2, 0);
}

type Work = { sum: number; k: number; items: number[] };

function fits(b: Work, len: number, usable: number, kerf: number) {
  return b.sum + len + kerf * b.k <= usable + EPS; // adding one piece: Σ + len + kerf × ((k+1) − 1)
}

function heuristic(lengths: number[], usable: number, kerf: number, best: boolean): Work[] {
  const bars: Work[] = [];
  lengths.forEach((len, i) => {
    let pick: Work | undefined;
    for (const b of bars) {
      if (!fits(b, len, usable, kerf)) continue;
      if (!best) { pick = b; break; }
      const room = usable - (b.sum + len + kerf * b.k);
      const pickRoom = pick ? usable - (pick.sum + len + kerf * pick.k) : Infinity;
      if (room < pickRoom) pick = b;
    }
    if (!pick) { pick = { sum: 0, k: 0, items: [] }; bars.push(pick); }
    pick.sum += len; pick.k += 1; pick.items.push(i);
  });
  return bars;
}

function exact(lengths: number[], usable: number, kerf: number, start: Work[], lower: number): { bars: Work[]; optimal: boolean } {
  let best = start.map(b => ({ ...b, items: [...b.items] }));
  let bestScore = score(best, usable, kerf);
  let nodes = 0;
  let aborted = false;
  const bars: Work[] = [];
  const go = (i: number) => {
    if (aborted) return;
    if (++nodes > NODE_LIMIT) { aborted = true; return; }
    if (bars.length > best.length) return;
    if (i === lengths.length) {
      const s = score(bars, usable, kerf);
      if (bars.length < best.length || (bars.length === best.length && s > bestScore + EPS)) {
        best = bars.map(b => ({ ...b, items: [...b.items] }));
        bestScore = s;
      }
      return;
    }
    const len = lengths[i]!;
    const seen = new Set<string>();
    for (const b of bars) {
      if (!fits(b, len, usable, kerf)) continue;
      const key = `${b.sum.toFixed(4)}|${b.k}`; // identical bar states give identical subtrees
      if (seen.has(key)) continue;
      seen.add(key);
      b.sum += len; b.k += 1; b.items.push(i);
      go(i + 1);
      b.sum -= len; b.k -= 1; b.items.pop();
    }
    if (bars.length + 1 <= best.length) {
      bars.push({ sum: len, k: 1, items: [i] });
      go(i + 1);
      bars.pop();
    }
  };
  // Only search if the heuristic might not be optimal on bar count, or to improve offcuts.
  go(0);
  return { bars: best, optimal: !aborted || best.length === lower };
}

export function cutList(input: CutListInput): CalcResult<CutPlan> {
  if (!isPos(input.stock)) return fail('Enter the stock length (more than 0)', 'stock');
  if (!isNonNeg(input.kerf)) return fail('Blade width can’t be negative', 'kerf');
  if (!isNonNeg(input.trim)) return fail('End trim can’t be negative', 'trim');
  const usable = input.stock - input.trim;
  if (usable <= 0) return fail('End trim is longer than the stock length', 'trim');
  if (input.pieces.length === 0) return fail('Add the lengths you need to cut', 'pieces');
  const all: Piece[] = [];
  for (const [spec, p] of input.pieces.entries()) {
    if (!isPos(p.length)) return fail(`Piece ${spec + 1}: enter a length`, 'pieces');
    if (!Number.isInteger(p.qty) || p.qty < 1 || p.qty > 500) return fail(`Piece ${spec + 1}: quantity must be 1 to 500`, 'pieces');
    if (p.length > usable + EPS) return fail(`Piece ${spec + 1} is longer than one stock length (after the end trim)`, 'pieces');
    for (let q = 0; q < p.qty; q++) all.push({ length: p.length, label: p.label, spec });
  }
  if (all.length > 2000) return fail('That’s more than 2000 pieces. Split the list into smaller jobs.', 'pieces');
  all.sort((a, b) => b.length - a.length);
  const lengths = all.map(p => p.length);
  const total = lengths.reduce((s, l) => s + l, 0);
  const lower = Math.max(1, Math.ceil(total / usable - EPS));
  const ffd = heuristic(lengths, usable, input.kerf, false);
  const bfd = heuristic(lengths, usable, input.kerf, true);
  let chosen = bfd.length < ffd.length || (bfd.length === ffd.length && score(bfd, usable, input.kerf) > score(ffd, usable, input.kerf)) ? bfd : ffd;
  let optimal = chosen.length === lower;
  if (all.length <= MAX_EXACT) {
    const r = exact(lengths, usable, input.kerf, chosen, lower);
    chosen = r.bars;
    optimal = r.optimal;
  }
  const bars: Bar[] = chosen
    .map(b => {
      const pieces = b.items.map(i => all[i]!).sort((x, y) => y.length - x.length);
      return { pieces, used: barNeed(pieces.map(p => p.length), input.kerf), offcut: offcutOf(b.sum, b.k, usable, input.kerf) };
    })
    .sort((x, y) => x.offcut - y.offcut);
  const waste = bars.length * input.stock - total;
  return {
    ok: true,
    value: { bars, totalPieces: all.length, totalPieceLength: total, waste, efficiency: total / (bars.length * input.stock), lowerBound: lower, optimal },
    steps: [],
    warnings: optimal ? [] : ['Big list: this plan is very good but may not be the absolute best possible.'],
  };
}
