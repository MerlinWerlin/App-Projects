/**
 * Sheet roofing: how many sheets and what lengths to order.
 *
 * Method (as in the manufacturers' installation guides cited in src/data/sources.ts — sheets run eave to ridge,
 * side-lapped by the profile's lap so each sheet covers its "effective cover width"):
 *   sheets across a plane = ⌈ eave length ÷ effective cover width ⌉
 *   sheet length          = slope length (eave → ridge) + overhang into the gutter (+ ridge allowance)
 *   on hip planes each sheet only reaches the hip line above it: for a sheet whose edge is x from the nearer
 *   corner, the slope length needed is min(x, run) ÷ cos θ (45° hips at equal pitch).
 *   runs longer than the longest sheet you can get are split into k sheets end-lapped by the profile's end lap:
 *   k = ⌈ (L − lap) ÷ (max − lap) ⌉, each (L + (k−1)·lap) ÷ k.
 */
import { fail, type Ctx, type Result, type Step } from './context';
import type { Plane } from './geometry';
import { ceilTo, num, toRad } from './units';

export interface SheetInput {
  planes: Plane[];
  pitchDeg: number;
  coverWidthMm: number;
  overhangMm: number; // into the gutter, measured along the sheet
  ridgeAllowanceMm: number; // extra at the top (e.g. turn-up), usually 0
  maxSheetMm: number; // longest sheet you can get or handle
  endLapMm: number;
}

export interface CutLine { lengthMm: number; qty: number }
export interface SheetResult {
  sheets: number;
  cutList: CutLine[];
  totalLinealMm: number;
  orderedAreaM2: number; // cover width × total length
  splitRuns: number; // runs that needed an end lap
  hipCut: boolean;
}

function cutStep(ctx: Ctx) { return ctx.sys === 'imperial' ? 25.4 : 10; }

export function sheets(input: SheetInput, ctx: Ctx): Result<SheetResult> {
  const { planes, pitchDeg, coverWidthMm: cover, overhangMm, ridgeAllowanceMm, maxSheetMm, endLapMm } = input;
  if (!planes.length) return fail('Add a roof first.');
  if (!(cover > 0)) return fail('Pick a profile or enter a cover width more than zero.');
  if (cover > 2000) return fail('Cover widths are under 2 m. Check the units.');
  if (cover < 100) return fail('That cover width is under 100 mm. Check the units.');
  if (!(overhangMm >= 0) || !(ridgeAllowanceMm >= 0)) return fail('Overhang and allowances can’t be negative.');
  if (!(maxSheetMm > 0)) return fail('Enter the longest sheet length you can get.');
  if (!(endLapMm >= 0) || endLapMm >= maxSheetMm / 2) return fail('The end lap must be less than half the longest sheet.');
  const cos = Math.cos(toRad(pitchDeg));
  if (!(cos > 0)) return fail('Enter a pitch under 75°.');
  const step = cutStep(ctx);
  const tally = new Map<number, number>();
  const add = (len: number, qty: number) => {
    const r = Math.round(ceilTo(len, step) * 1000) / 1000;
    tally.set(r, (tally.get(r) ?? 0) + qty);
  };
  let count = 0, split = 0, hipCut = false;
  const steps: Step[] = [];
  for (const pl of planes) {
    const n = Math.ceil(pl.eaveMm / cover - 1e-9);
    steps.push({ label: `Sheets across each ${pl.shape === 'rect' ? 'plane' : pl.shape === 'trap' ? 'hip side' : 'hip end'} (×${pl.count})`,
      formula: `⌈ ${ctx.len(pl.eaveMm)} ÷ ${ctx.len(cover)} ⌉`, value: String(n) });
    for (let i = 0; i < n; i++) {
      let slope = pl.slopeMm;
      if (pl.shape !== 'rect') {
        hipCut = true;
        const a = i * cover, b = Math.min((i + 1) * cover, pl.eaveMm);
        // Plan run up to the hip line at x along the eave is min(x, eave − x, run); the sheet needs the most of it.
        const half = pl.eaveMm / 2;
        const reach = a <= half && b >= half ? half : Math.max(Math.min(a, pl.eaveMm - a), Math.min(b, pl.eaveMm - b));
        slope = Math.min(reach, pl.runMm) / cos;
      }
      const len = slope + overhangMm + ridgeAllowanceMm;
      if (ceilTo(len, step) <= maxSheetMm + 1e-6) { add(len, pl.count); count += pl.count; continue; }
      let k = Math.ceil((len - endLapMm) / (maxSheetMm - endLapMm) - 1e-9);
      // Rounding each piece up to the cut step must not push it past the maximum either.
      while (ceilTo((len + (k - 1) * endLapMm) / k, step) > maxSheetMm + 1e-6) k++;
      add((len + (k - 1) * endLapMm) / k, k * pl.count);
      count += k * pl.count;
      split += pl.count;
    }
  }
  const cutList = [...tally.entries()].map(([lengthMm, qty]) => ({ lengthMm, qty })).sort((x, y) => y.lengthMm - x.lengthMm);
  const total = cutList.reduce((s, c) => s + c.lengthMm * c.qty, 0);
  const longest = cutList[0]?.lengthMm ?? 0;
  steps.push({ label: 'Full sheet length', formula: `slope length + ${ctx.len(overhangMm)} overhang${ridgeAllowanceMm ? ` + ${ctx.len(ridgeAllowanceMm)} at the top` : ''}`, value: ctx.len(longest) });
  if (split) steps.push({ label: 'Runs split with an end lap', formula: `k = ⌈(L − ${ctx.len(endLapMm)}) ÷ (${ctx.len(maxSheetMm)} − ${ctx.len(endLapMm)})⌉`, value: String(split) });
  steps.push({ label: 'Total sheets', value: String(count) });
  steps.push({ label: 'Total lineal length', formula: 'Σ length × quantity', value: ctx.run(total) });
  const notes: string[] = [];
  if (hipCut) notes.push('Hip sheets are listed at the length of their longer edge. Off-cuts from one side of a hip often suit the other side; this list does not count on that.');
  if (split) notes.push('Split runs: lap the upper sheet over the lower by the end lap, and check the profile’s minimum pitch for end-lapped sheets.');
  notes.push(`Lengths are rounded up to the next ${ctx.sys === 'imperial' ? 'inch' : '10 mm'}.`);
  return { ok: true, value: { sheets: count, cutList, totalLinealMm: total, orderedAreaM2: (total * cover) / 1e6, splitRuns: split, hipCut }, steps, notes };
}

/** Lineal metres → number of sheets of a fixed stock length (e.g. UK/US stock lengths). */
export function stockPieces(lengthMm: number, stockMm: number, lapMm = 0): number {
  if (!(lengthMm > 0) || !(stockMm > lapMm)) return 0;
  if (lengthMm <= stockMm) return 1;
  return Math.ceil((lengthMm - lapMm) / (stockMm - lapMm) - 1e-9);
}

export const describeCut = (c: CutLine, ctx: Ctx) => `${c.qty} × ${ctx.len(c.lengthMm)}`;
export const coverText = (mm: number, ctx: Ctx) => (ctx.sys === 'imperial' ? `${num(mm / 25.4, 1)}″` : `${num(mm, 0)} mm`);
