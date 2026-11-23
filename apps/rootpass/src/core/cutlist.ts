/**
 * Stock-length cut list: fit the parts into as few stock lengths as possible, then keep the offcuts as long as
 * possible (a long offcut is reusable, many short ones are scrap).
 *
 * This is the one-dimensional bin-packing problem. Kerf is handled exactly by the standard transformation:
 * n pieces fit in a usable length U when Σ lengths + kerf·(n − 1) ≤ U, i.e. Σ (length + kerf) ≤ U + kerf.
 * Method: an exact branch-and-bound search (Martello & Toth, "Knapsack Problems", 1990, ch. 8 — items sorted
 * longest first, pieces tried in each open bar, identical bar states skipped, pruned on the L1 lower bound
 * ⌈Σ size / capacity⌉) with a node limit; if the limit is reached the best plan found so far is used, which is
 * never worse than First Fit Decreasing (Johnson 1973: FFD ≤ 11/9·OPT + 6/9).
 */
import { fail, fmt, positive, type Result, type Step } from './units.ts';

export interface Part { length: number; qty: number; label?: string }

export interface CutInput {
  stock: number; // stock length, mm
  kerf: number; // blade width, mm
  trim: number; // squared off each new stock length before cutting, mm
  parts: Part[];
  nodeLimit?: number;
}

export interface Bar { cuts: { length: number; label?: string }[]; used: number; offcut: number }

export interface CutResult {
  bars: Bar[];
  pieces: number;
  partsLength: number;
  waste: number; // stock bought − parts length (kerf, trim and offcuts)
  optimal: boolean;
  lowerBound: number;
}

interface Item { size: number; length: number; label?: string }

export function cutList(i: CutInput): Result<CutResult> {
  const bad = positive('stock length', i.stock);
  if (bad) return fail(bad);
  if (!Number.isFinite(i.kerf) || i.kerf < 0 || i.kerf > 20) return fail('Kerf must be 0 to 20 mm.');
  if (!Number.isFinite(i.trim) || i.trim < 0 || i.trim >= i.stock) return fail('End trim must be 0 or more and less than the stock length.');
  const usable = i.stock - i.trim;
  const items: Item[] = [];
  for (const p of i.parts) {
    if (!Number.isFinite(p.length) || p.length <= 0) return fail('Every part needs a length more than 0.');
    if (!Number.isInteger(p.qty) || p.qty < 1) return fail('Quantities must be whole numbers, 1 or more.');
    if (p.length > usable + 1e-9) return fail(`A ${fmt(p.length, 0)} mm part is longer than the usable stock (${fmt(usable, 0)} mm).`);
    for (let q = 0; q < p.qty; q++) items.push({ size: p.length + i.kerf, length: p.length, label: p.label });
  }
  if (!items.length) return fail('Add at least one part.');
  if (items.length > 500) return fail('Up to 500 pieces per cut list.');
  items.sort((a, b) => b.size - a.size);
  const cap = usable + i.kerf;
  const total = items.reduce((s, x) => s + x.size, 0);
  const lowerBound = Math.ceil(total / cap - 1e-9);

  // First Fit Decreasing as the starting answer.
  let best = ffd(items, cap);
  let optimal = best.length === lowerBound;
  if (!optimal) {
    const limit = i.nodeLimit ?? 200_000;
    let nodes = 0;
    const assign: number[][] = [];
    const room: number[] = [];
    const search = (k: number) => {
      if (++nodes > limit) return;
      if (room.length >= best.length) return;
      if (k === items.length) {
        best = assign.map(b => b.slice());
        return;
      }
      const remaining = suffix[k];
      const free = room.reduce((s, r) => s + r, 0);
      if (room.length + Math.max(0, Math.ceil((remaining - free) / cap - 1e-9)) >= best.length) return;
      const seen = new Set<number>();
      for (let b = 0; b < room.length; b++) {
        const key = Math.round(room[b] * 1000);
        if (room[b] + 1e-9 >= items[k].size && !seen.has(key)) {
          seen.add(key);
          room[b] -= items[k].size; assign[b].push(k);
          search(k + 1);
          room[b] += items[k].size; assign[b].pop();
          if (nodes > limit) return;
        }
      }
      room.push(cap - items[k].size); assign.push([k]);
      search(k + 1);
      room.pop(); assign.pop();
    };
    const suffix: number[] = new Array(items.length + 1).fill(0);
    for (let k = items.length - 1; k >= 0; k--) suffix[k] = suffix[k + 1] + items[k].size;
    search(0);
    optimal = nodes <= limit || best.length === lowerBound;
  }

  // Bars are listed fullest first, so the long offcut (if any) comes last.
  const bars: Bar[] = best.map(idx => {
    const cuts = idx.map(k => ({ length: items[k].length, label: items[k].label })).sort((a, b) => b.length - a.length);
    const used = cuts.reduce((s, c) => s + c.length, 0) + i.kerf * (cuts.length - 1);
    const rem = usable - used; // what is left after the last part, before its kerf
    const offcut = rem >= i.kerf ? rem - i.kerf : 0;
    return { cuts, used, offcut };
  }).sort((a, b) => a.offcut - b.offcut);

  const partsLength = items.reduce((s, x) => s + x.length, 0);
  const bought = bars.length * i.stock;
  const steps: Step[] = [
    { label: 'Usable stock', formula: 'stock − end trim', value: `${fmt(i.stock, 0)} − ${fmt(i.trim, 0)} = ${fmt(usable, 0)} mm` },
    { label: 'Pieces fit in a length when', formula: 'Σ parts + kerf × (pieces − 1) ≤ usable', value: `kerf ${fmt(i.kerf, 1)} mm` },
    { label: 'Fewest lengths possible (lower bound)', formula: '⌈Σ (part + kerf) / (usable + kerf)⌉', value: `⌈${fmt(total, 0)} / ${fmt(cap, 0)}⌉ = ${lowerBound}` },
    { label: 'Lengths in this plan', value: `${bars.length}${optimal ? ' (best possible)' : ''}` },
  ];
  return {
    ok: true,
    value: { bars, pieces: items.length, partsLength, waste: bought - partsLength, optimal, lowerBound },
    steps,
    warnings: [],
  };
}

function ffd(items: Item[], cap: number): number[][] {
  const bins: number[][] = [];
  const room: number[] = [];
  items.forEach((it, k) => {
    const b = room.findIndex(r => r + 1e-9 >= it.size);
    if (b < 0) { bins.push([k]); room.push(cap - it.size); }
    else { bins[b].push(k); room[b] -= it.size; }
  });
  return bins;
}
