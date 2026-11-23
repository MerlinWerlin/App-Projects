/**
 * Tile quantity for floors and walls.
 *
 * Method (as used by tile manufacturers' and retailers' calculators, e.g. the TCNA Handbook's quantity guidance and
 * suppliers' "area ÷ coverage per tile, then add cutting waste" method; sources in docs/SOURCES.md):
 *   net area      = Σ areas added − Σ cut-outs (windows, doors, baths, cabinets)
 *   area per tile = (tile length + joint) × (tile width + joint)   (each tile "owns" half of the joint round it)
 *   tiles         = net area ÷ area per tile, rounded up after adding waste for the layout
 *   boxes         = tiles ÷ tiles per box (or area with waste ÷ m² per box), rounded up
 */
import { LAYOUTS, layoutWarnings, type LayoutId } from './layouts.ts';
import { ceilSafe, fail, fmt, type CalcResult, type Problem, type Step } from './steps.ts';
import { formatArea, formatLength, M2_PER_SQFT, type UnitSystem } from './units.ts';

const pl = (w: string, n: number) => (n === 1 ? w : /(x|s|ch|sh)$/.test(w) ? `${w}es` : `${w}s`);
const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);

export interface Rect { widthMm: number; heightMm: number; subtract?: boolean; label?: string }

export interface TileInput {
  rects: Rect[];
  tileLengthMm: number;
  tileWidthMm: number;
  jointMm: number;
  layout: LayoutId;
  /** Optional override of the layout's waste allowance, in percent. */
  wastePct?: number | null;
  perBox?: number | null;
  boxM2?: number | null;
  system: UnitSystem;
  /** The country's word: box, carton or case. */
  boxWord?: string;
}

export interface TileResult {
  netM2: number;
  grossM2: number;
  cutOutM2: number;
  tileM2: number;
  tilesNoWaste: number;
  wastePct: number;
  tiles: number;
  boxes: number | null;
  orderM2: number;
}

export function areaOf(rects: Rect[]): { gross: number; cut: number; net: number } {
  let gross = 0, cut = 0;
  for (const r of rects) {
    const a = (r.widthMm * r.heightMm) / 1e6;
    if (r.subtract) cut += a; else gross += a;
  }
  return { gross, cut, net: gross - cut };
}

export function validateRects(rects: Rect[]): Problem[] {
  const out: Problem[] = [];
  if (!rects.some(r => !r.subtract)) out.push({ field: 'rects', message: 'Add at least one area to tile.' });
  rects.forEach((r, i) => {
    if (!(r.widthMm > 0) || !(r.heightMm > 0)) out.push({ field: `rect${i}`, message: 'Each size needs a length and a width above zero.' });
  });
  const { gross, cut } = areaOf(rects);
  if (gross > 0 && cut >= gross) out.push({ field: 'rects', message: 'The cut-outs are as big as the area or bigger.' });
  return out;
}

export function calcTiles(input: TileInput): CalcResult<TileResult> {
  const { rects, tileLengthMm: L, tileWidthMm: W, jointMm: j, system } = input;
  const problems = validateRects(rects);
  if (!(L > 0) || !(W > 0)) problems.push({ field: 'tile', message: 'Enter the tile size.' });
  if (!(j >= 0) || j > 50) problems.push({ field: 'joint', message: 'Joint width must be between 0 and 50 mm.' });
  if (L > 0 && W > 0 && (L > 4000 || W > 4000)) problems.push({ field: 'tile', message: 'That tile is bigger than 4 m. Check the size.' });
  const layout = LAYOUTS[input.layout];
  if (!layout) problems.push({ field: 'layout', message: 'Pick a layout.' });
  const waste = input.wastePct ?? layout?.wastePct ?? 10;
  if (!(waste >= 0) || waste > 100) problems.push({ field: 'waste', message: 'Waste must be between 0 and 100%.' });
  if (input.perBox != null && !(input.perBox > 0 && Number.isInteger(input.perBox))) problems.push({ field: 'box', message: 'Tiles per box must be a whole number above zero.' });
  if (input.boxM2 != null && !(input.boxM2 > 0)) problems.push({ field: 'box', message: 'Box coverage must be above zero.' });
  if (problems.length) return fail(...problems);

  const { gross, cut, net } = areaOf(rects);
  const tileM2 = ((L + j) * (W + j)) / 1e6;
  const exact = net / tileM2;
  const withWaste = exact * (1 + waste / 100);
  const tiles = ceilSafe(withWaste);
  let boxes: number | null = null;
  const bw = input.boxWord ?? 'box';
  const steps: Step[] = [];
  const A = (m2: number) => formatArea(m2, system);
  steps.push({ label: 'Area to tile', working: cut > 0 ? `${A(gross)} − ${A(cut)} cut-outs` : rects.filter(r => !r.subtract).map(r => `${formatLength(r.widthMm, system)} × ${formatLength(r.heightMm, system)}`).join(' + '), result: A(net) });
  steps.push({ label: 'Area per tile with joint', working: `(${formatLength(L, system, 'tile')} + ${formatLength(j, system, 'joint')}) × (${formatLength(W, system, 'tile')} + ${formatLength(j, system, 'joint')})`, result: system === 'metric' ? `${fmt(tileM2, 4)} m²` : `${fmt(tileM2 / M2_PER_SQFT, 3)} sq ft` });
  steps.push({ label: 'Tiles before waste', working: `${A(net)} ÷ ${system === 'metric' ? `${fmt(tileM2, 4)} m²` : `${fmt(tileM2 / M2_PER_SQFT, 3)} sq ft`}`, result: fmt(exact, 2) });
  steps.push({ label: `Add ${fmt(waste, 1)}% waste (${layout.name.toLowerCase()})`, working: `${fmt(exact, 2)} × ${fmt(1 + waste / 100, 3)} = ${fmt(withWaste, 2)}, rounded up`, result: `${fmt(tiles, 0)} tiles` });
  const orderM2 = net * (1 + waste / 100);
  if (input.perBox) {
    boxes = ceilSafe(tiles / input.perBox);
    steps.push({ label: cap(pl(bw, 2)), working: `${fmt(tiles, 0)} ÷ ${input.perBox} per ${bw}, rounded up`, result: `${fmt(boxes, 0)} ${pl(bw, boxes)}` });
  } else if (input.boxM2) {
    boxes = ceilSafe(orderM2 / input.boxM2 - 1e-9);
    steps.push({ label: cap(pl(bw, 2)), working: `${A(orderM2)} ÷ ${A(input.boxM2)} per ${bw}, rounded up`, result: `${fmt(boxes, 0)} ${pl(bw, boxes)}` });
  }
  const notes = [...layout.notes, ...layoutWarnings(input.layout, L, W)];
  return { ok: true, value: { netM2: net, grossM2: gross, cutOutM2: cut, tileM2, tilesNoWaste: exact, wastePct: waste, tiles, boxes, orderM2 }, steps, notes };
}
