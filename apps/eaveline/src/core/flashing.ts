/**
 * Flashings, cappings and trims: lineal lengths from the roof geometry, then pieces of a stock length.
 * Pieces for a run L with stock length S and lap ℓ between pieces: 1 if L ≤ S, else ⌈ (L − ℓ) ÷ (S − ℓ) ⌉.
 * Each run is counted separately (a hip or barge is its own run), as the pieces can't continue round a corner.
 * Ridge/hip tiles: ⌈ length × tiles per metre ⌉ (maker's figure) or ⌈ length ÷ effective tile length ⌉.
 */
import { cap, fail, type Ctx, type Result, type Step } from './context';
import type { RoofGeometry } from './geometry';
import { stockPieces } from './sheets';

export type TrimKind = 'ridge' | 'hip' | 'valley' | 'barge' | 'eaves' | 'apron' | 'topEdge';

export interface TrimRun { kind: TrimKind; label: string; eachMm: number; runs: number }
export interface TrimLine extends TrimRun { totalMm: number; pieces: number }

export function trimRuns(g: RoofGeometry, ctx: Ctx, extra: { valleyMm?: number; valleys?: number; apronMm?: number } = {}): TrimRun[] {
  const t = ctx.terms;
  const out: TrimRun[] = [];
  if (g.ridgeMm > 0) out.push({ kind: 'ridge', label: cap(t.ridge), eachMm: g.ridgeMm, runs: 1 });
  if (g.hipCount) out.push({ kind: 'hip', label: 'Hips', eachMm: g.hipEachMm, runs: g.hipCount });
  if (extra.valleyMm && extra.valleys) out.push({ kind: 'valley', label: `${cap(t.valley)}s`, eachMm: extra.valleyMm, runs: extra.valleys });
  if (g.bargeCount) out.push({ kind: 'barge', label: `${cap(t.barge)}s`, eachMm: g.bargeEachMm, runs: g.bargeCount });
  if (g.topEdgeMm > 0) out.push({ kind: 'topEdge', label: 'High-side flashing', eachMm: g.topEdgeMm, runs: 1 });
  if (extra.apronMm) out.push({ kind: 'apron', label: 'Apron / wall flashing', eachMm: extra.apronMm, runs: 1 });
  if (g.type === 'hip') {
    out.push({ kind: 'eaves', label: `${cap(t.gutter)} (long sides)`, eachMm: g.lengthMm, runs: 2 });
    out.push({ kind: 'eaves', label: `${cap(t.gutter)} (ends)`, eachMm: g.widthMm, runs: 2 });
  } else {
    out.push({ kind: 'eaves', label: cap(t.gutter), eachMm: g.lengthMm, runs: g.type === 'gable' ? 2 : 1 });
  }
  return out;
}

export interface TrimInput { runs: TrimRun[]; stockMm: number; lapMm: number; wastePct: number }

export function trims(input: TrimInput, ctx: Ctx): Result<{ lines: TrimLine[]; totalMm: number; pieces: number }> {
  const { runs, stockMm, lapMm, wastePct } = input;
  if (!runs.length) return fail('Nothing to measure yet.');
  if (!(stockMm > 0)) return fail('Enter the stock length.');
  if (!(lapMm >= 0) || lapMm >= stockMm / 2) return fail('The lap must be less than half the stock length.');
  if (!(wastePct >= 0) || wastePct > 50) return fail('Waste should be between 0 and 50%.');
  const steps: Step[] = [];
  const lines = runs.filter(r => r.eachMm > 0 && r.runs > 0).map(r => {
    const each = stockPieces(r.eachMm, stockMm, lapMm);
    const line: TrimLine = { ...r, totalMm: r.eachMm * r.runs, pieces: each * r.runs };
    steps.push({ label: r.label, formula: `${r.runs} × ${ctx.len(r.eachMm)} → ${each} piece${each === 1 ? '' : 's'} each`, value: `${line.pieces} × ${ctx.len(stockMm)}` });
    return line;
  });
  const total = lines.reduce((s, l) => s + l.totalMm, 0);
  const pieces = Math.ceil(lines.reduce((s, l) => s + l.pieces, 0) * (1 + wastePct / 100) - 1e-9);
  steps.push({ label: 'Total length', value: ctx.run(total) });
  if (wastePct) steps.push({ label: 'With waste', formula: `+ ${wastePct}%`, value: `${pieces} pieces` });
  return { ok: true, value: { lines, totalMm: total, pieces }, steps,
    notes: [`Each run is counted on its own, with ${ctx.len(lapMm)} laps where pieces join.`] };
}

/** Ridge or hip capping tiles. perMetre wins when the maker gives one. */
export function cappingTiles(lengthMm: number, opts: { perMetre?: number | null; effectiveLengthMm?: number | null }, ctx: Ctx): Result<{ tiles: number }> {
  if (!(lengthMm > 0)) return fail('No ridge or hip length yet.');
  if (opts.perMetre && opts.perMetre > 0) {
    const n = Math.ceil((lengthMm / 1000) * opts.perMetre - 1e-9);
    return { ok: true, value: { tiles: n }, steps: [{ label: 'Capping tiles', formula: `${ctx.run(lengthMm)} × ${opts.perMetre} per metre`, value: String(n) }], notes: [] };
  }
  if (opts.effectiveLengthMm && opts.effectiveLengthMm > 0) {
    const n = Math.ceil(lengthMm / opts.effectiveLengthMm - 1e-9);
    return { ok: true, value: { tiles: n }, steps: [{ label: 'Capping tiles', formula: `⌈ ${ctx.run(lengthMm)} ÷ ${ctx.len(opts.effectiveLengthMm)} ⌉`, value: String(n) }], notes: [] };
  }
  return fail('Enter capping tiles per metre or the effective tile length.');
}
