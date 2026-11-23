/**
 * Tiles, slates and battens.
 *
 * Batten gauge (spacing): the tile maker publishes a maximum gauge (and for slates and plain tiles a headlap).
 * Set out the eaves batten and the top batten first, then divide the distance between them into the fewest
 * equal gauges that do not exceed the maximum (the "rafter length ÷ number of courses" set-out in BS 5534 / the
 * tile makers' guides cited in src/data/sources.ts):
 *   span   = slope length − eaves set-out − top set-out
 *   gauges = ⌈ span ÷ maximum gauge ⌉,  gauge = span ÷ gauges,  batten rows = gauges + 1
 * Double-lap slates and plain tiles: gauge = (slate length − headlap) ÷ 2  (BS 5534 / BS 8000-6 rule).
 * Tile quantities: courses × ⌈ plane width ÷ tile cover width ⌉ for rectangular planes, or for any roof
 * roof area × tiles per m² (the maker's coverage at that gauge), plus waste for cuts.
 */
import { cap, fail, type Ctx, type Result, type Step } from './context';
import type { Plane } from './geometry';
import { num } from './units';

export interface BattenSetOut { slopeMm: number; eavesSetOutMm: number; topSetOutMm: number; maxGaugeMm: number }
export interface BattenResult { gauges: number; gaugeMm: number; rows: number; spanMm: number }

export function battenGauge(input: BattenSetOut, ctx: Ctx): Result<BattenResult> {
  const { slopeMm, eavesSetOutMm: e, topSetOutMm: top, maxGaugeMm: max } = input;
  if (!(slopeMm > 0)) return fail('Enter the rafter (slope) length.');
  if (!(max > 0)) return fail('Enter the maximum batten gauge for the tile.');
  if (max > 1000) return fail('Batten gauges are under 1 m. Check the units.');
  if (!(e >= 0) || !(top >= 0)) return fail('Set-outs can’t be negative.');
  const span = slopeMm - e - top;
  if (span <= 0) return fail('The set-outs are longer than the rafter. Check the lengths.');
  const gauges = Math.max(1, Math.ceil(span / max - 1e-9));
  const gauge = span / gauges;
  const steps: Step[] = [
    { label: 'Distance to divide', formula: 'slope length − eaves set-out − top set-out', value: ctx.len(span) },
    { label: 'Number of gauges', formula: `⌈ ${ctx.len(span)} ÷ ${ctx.len(max)} max ⌉`, value: String(gauges) },
    { label: 'Even gauge', formula: 'distance ÷ gauges', value: ctx.len(gauge) },
    { label: `${cap(ctx.terms.batten)} rows per plane`, formula: 'gauges + 1', value: String(gauges + 1) },
  ];
  return { ok: true, value: { gauges, gaugeMm: gauge, rows: gauges + 1, spanMm: span }, steps,
    notes: ['Mark the eaves and top battens first, then mark the even gauge between them.'] };
}

export function slateGauge(lengthMm: number, headlapMm: number, ctx: Ctx): Result<{ gaugeMm: number }> {
  if (!(lengthMm > 0)) return fail('Enter the slate or tile length.');
  if (!(headlapMm > 0)) return fail('Enter the headlap.');
  if (headlapMm >= lengthMm) return fail('The headlap must be shorter than the slate.');
  const g = (lengthMm - headlapMm) / 2;
  return { ok: true, value: { gaugeMm: g }, steps: [{ label: 'Maximum gauge', formula: `(${ctx.len(lengthMm)} − ${ctx.len(headlapMm)} headlap) ÷ 2`, value: ctx.len(g) }],
    notes: ['Double-lap slates and plain tiles. Use the headlap the maker gives for your pitch and exposure.'] };
}

export interface TileInput {
  planes: Plane[];
  roofAreaM2: number;
  eavesSetOutMm: number;
  topSetOutMm: number;
  maxGaugeMm: number | null; // null: count by area only, no battens
  tileCoverWidthMm: number | null; // null: no course count
  tilesPerM2: number | null; // maker's coverage; null → worked out from gauge × cover width
  wastePct: number;
  battenStockMm: number;
}

export interface TileResult {
  gaugeMm: number | null;
  rows: number | null;
  tilesByCourses: number | null;
  tilesByArea: number;
  tilesToOrder: number;
  coveragePerM2: number;
  battenLinealMm: number | null;
  battenPieces: number | null;
}

/**
 * Tile count from the maker's coverage (or gauge × cover), courses when the cover width is known on rectangular
 * planes, and battens once the gauge is known. Gauge or cover can be missing: the result says what it used.
 */
export function tiles(input: TileInput, ctx: Ctx): Result<TileResult> {
  const { planes, roofAreaM2, wastePct, battenStockMm } = input;
  const cw = input.tileCoverWidthMm && input.tileCoverWidthMm > 0 ? input.tileCoverWidthMm : null;
  if (!planes.length || !(roofAreaM2 > 0)) return fail('Add a roof first.');
  if (input.tileCoverWidthMm != null && !(input.tileCoverWidthMm > 0)) return fail('Enter the tile cover width.');
  if (!(wastePct >= 0) || wastePct > 50) return fail('Waste should be between 0 and 50%.');
  if (!(battenStockMm > 0)) return fail('Enter the batten stock length.');
  const steps: Step[] = [];
  const notes: string[] = [];
  let gaugeMm: number | null = null;
  let rows: number | null = null;
  if (input.maxGaugeMm != null) {
    const g = battenGauge({ slopeMm: planes[0]!.slopeMm, eavesSetOutMm: input.eavesSetOutMm, topSetOutMm: input.topSetOutMm, maxGaugeMm: input.maxGaugeMm }, ctx);
    if (!g.ok) return g;
    gaugeMm = g.value.gaugeMm;
    rows = g.value.rows;
    steps.push(...g.steps);
    notes.push(...g.notes);
  }
  let coverage = input.tilesPerM2 && input.tilesPerM2 > 0 ? input.tilesPerM2 : null;
  if (coverage == null) {
    if (gaugeMm == null || cw == null) return fail('Enter tiles per m², or the batten gauge and tile cover width.');
    coverage = 1e6 / (gaugeMm * cw);
    steps.push({ label: 'Tiles per m² at this gauge', formula: `1 m² ÷ (${ctx.len(gaugeMm)} × ${ctx.len(cw)})`, value: num(coverage, 2) });
  }
  const allRect = planes.every(p => p.shape === 'rect');
  let byCourses: number | null = null;
  if (allRect && cw && rows) {
    const r = rows;
    byCourses = planes.reduce((s, p) => s + r * Math.ceil(p.eaveMm / cw - 1e-9) * p.count, 0);
    const p0 = planes[0]!;
    steps.push({ label: 'Tiles per course', formula: `⌈ ${ctx.len(p0.eaveMm)} ÷ ${ctx.len(cw)} ⌉`, value: String(Math.ceil(p0.eaveMm / cw - 1e-9)) });
    steps.push({ label: 'Tiles by courses', formula: 'courses × tiles per course × planes', value: String(byCourses) });
  }
  const byArea = Math.ceil(roofAreaM2 * coverage - 1e-9);
  steps.push({ label: 'Tiles by area', formula: `${num(roofAreaM2, 2)} m² × ${num(coverage, 2)} per m²`, value: String(byArea) });
  const base = byCourses ?? byArea;
  const order = Math.ceil(base * (1 + wastePct / 100) - 1e-9);
  steps.push({ label: 'Tiles to order', formula: `${base} + ${num(wastePct, 1)}% for cuts and breakage`, value: String(order) });
  let lineal: number | null = null;
  let pieces: number | null = null;
  if (gaugeMm && rows) {
    const r = rows;
    lineal = allRect ? planes.reduce((s, p) => s + r * p.eaveMm * p.count, 0) : (roofAreaM2 * 1e6) / gaugeMm;
    pieces = Math.ceil((lineal * 1.05) / battenStockMm - 1e-9);
    steps.push({ label: `${cap(ctx.terms.batten)} length`, formula: allRect ? 'rows × plane width × planes' : 'roof area ÷ gauge', value: ctx.run(lineal) });
    steps.push({ label: `${cap(ctx.terms.batten)} lengths to order`, formula: `(total + 5% for joins on supports) ÷ ${ctx.len(battenStockMm)}`, value: String(pieces) });
  } else {
    notes.push(`Enter the maximum ${ctx.terms.batten} gauge to set out the ${ctx.terms.battens} and count them.`);
  }
  notes.push('Ridge, hip and verge tiles and the eaves course follow the tile maker’s set-out; check them before you batten out.');
  if (!allRect) notes.push('Hip roofs: counted by area. Hips and valleys add cutting; 10% waste or more is common.');
  return { ok: true, value: { gaugeMm, rows, tilesByCourses: byCourses, tilesByArea: byArea, tilesToOrder: order, coveragePerM2: coverage, battenLinealMm: lineal, battenPieces: pieces }, steps, notes };
}
