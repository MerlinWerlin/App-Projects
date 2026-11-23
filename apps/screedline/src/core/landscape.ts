/**
 * Landscape and bulk materials: volume, tonnes, pavers and paver base. Metric inputs (m, m², t/m³).
 *
 * Densities (loose, as delivered), t/m³:
 *   road base 1.6 and garden soil 1.25: Australian landscape-supply guide (Yellow Pages AU, "tonnes and cubic
 *     metres" article);
 *   sand dry 1.60 (top of 1.28–1.60) and sand wet 1.92: Engineering ToolBox bulk material density table
 *     (engineeringtoolbox.com/density-materials-d_1652.html);
 *   crushed stone 1.60 and gravel loose dry 1.52: classic bulk-density table (stone crushed 1602 kg/m³,
 *     gravel loose dry 1522 kg/m³) reproduced in Engineering ToolBox's older edition;
 *   wood chips/mulch 0.38: Engineering ToolBox woodchips 0.32–0.48;
 *   fresh normal-weight concrete 2.4 (Engineering ToolBox 2.24–2.40; usual design figure).
 * Moisture and grading change all of these; the supplier's own figure always wins, so density is editable.
 *
 * Compaction allowance: crushed rock and road base lose roughly 15–25 % of loose volume when compacted, sand
 * about 10 % (rule of thumb; ask the quarry). The allowance is a separate, editable percentage.
 *
 * Pavers: AUS-SPEC 1145 Segmental paving (after CMAA PE01): joints 2–5 mm (default 3 mm), bedding sand
 * "20 mm to 30 mm following final compaction" (default 30 mm screeded, plus 10 % for compaction). Base depth
 * depends on subgrade and traffic; at least 100 mm for pedestrian areas (ICPI) and deeper for driveways.
 * Defaults are a guide only.
 */
import { type Calc, type Errors, type Step, check, fail, hasErrors, ok } from './calc.ts';
import { ceilCount, fmt } from './units.ts';

export interface Material { id: string; name: string; density: number; compactPct: number }

export const MATERIALS: Material[] = [
  { id: 'roadbase', name: 'Road base', density: 1.6, compactPct: 20 },
  { id: 'crushed', name: 'Crushed rock / blue metal', density: 1.6, compactPct: 0 },
  { id: 'gravel', name: 'Gravel / screenings', density: 1.52, compactPct: 0 },
  { id: 'sandDry', name: 'Sand (dry)', density: 1.6, compactPct: 10 },
  { id: 'sandWet', name: 'Sand (damp)', density: 1.92, compactPct: 10 },
  { id: 'soil', name: 'Topsoil / garden soil', density: 1.25, compactPct: 0 },
  { id: 'mulch', name: 'Mulch / wood chips', density: 0.38, compactPct: 0 },
  { id: 'concrete', name: 'Concrete (fresh)', density: 2.4, compactPct: 0 },
];
export const materialById = (id: string) => MATERIALS.find(x => x.id === id);

export interface BulkInput { area: number | null; depth: number | null; density: number | null; compactPct: number | null }
export interface BulkResult { volume: number; looseVolume: number; tonnes: number }

export function bulk(i: BulkInput): Calc<BulkResult> {
  const e: Errors = {};
  const A = check(e, 'area', i.area, { label: 'Area', max: 1_000_000 });
  const D = check(e, 'depth', i.depth, { label: 'Depth', max: 10 });
  const rho = check(e, 'density', i.density, { label: 'Density', max: 10 });
  const c = check(e, 'compactPct', i.compactPct, { label: 'Compaction allowance', min: 0, exclusive: false, max: 100 });
  if (hasErrors(e)) return fail(e);
  const volume = A * D;
  const looseVolume = volume * (1 + c / 100);
  const tonnes = looseVolume * rho;
  const steps: Step[] = [{ label: 'Finished volume', working: `${fmt(A, 2)} m² × ${fmt(D, 3)} m`, result: `${fmt(volume, 3)} m³` }];
  if (c > 0) steps.push({ label: `Add ${fmt(c, 0)} % for compaction`, working: `${fmt(volume, 3)} m³ × ${fmt(1 + c / 100, 2)}`, result: `${fmt(looseVolume, 3)} m³` });
  steps.push({ label: 'Weight', working: `${fmt(looseVolume, 3)} m³ × ${fmt(rho, 2)} t/m³`, result: `${fmt(tonnes, 2)} t` });
  return ok({ volume, looseVolume, tonnes }, steps, ['Density varies with moisture and grading. Use your supplier’s figure if they give one.']);
}

export interface ConvertInput { value: number | null; from: 'm3' | 't'; density: number | null }
export function convert(i: ConvertInput): Calc<{ m3: number; t: number }> {
  const e: Errors = {};
  const v = check(e, 'value', i.value, { label: 'Amount', max: 1_000_000 });
  const rho = check(e, 'density', i.density, { label: 'Density', max: 10 });
  if (hasErrors(e)) return fail(e);
  if (i.from === 'm3') {
    const t = v * rho;
    return ok({ m3: v, t }, [{ label: 'Tonnes', working: `${fmt(v, 3)} m³ × ${fmt(rho, 2)} t/m³`, result: `${fmt(t, 2)} t` }]);
  }
  const m3 = v / rho;
  return ok({ m3, t: v }, [{ label: 'Cubic metres', working: `${fmt(v, 2)} t ÷ ${fmt(rho, 2)} t/m³`, result: `${fmt(m3, 3)} m³` }]);
}

export interface PaverInput {
  area: number | null; paverLength: number | null; paverWidth: number | null; joint: number | null; wastePct: number | null;
  beddingDepth: number | null; baseDepth: number | null; baseCompactPct: number | null;
  /** Loose density of the local base material, t/m³ (default road base 1.6). */
  baseDensity?: number;
}
export interface PaverResult {
  perM2: number; pavers: number; beddingM3: number; beddingT: number; baseM3: number; baseT: number;
}

export function pavers(i: PaverInput): Calc<PaverResult> {
  const e: Errors = {};
  const A = check(e, 'area', i.area, { label: 'Area', max: 1_000_000 });
  const pl = check(e, 'paverLength', i.paverLength, { label: 'Paver length', max: 3 });
  const pw = check(e, 'paverWidth', i.paverWidth, { label: 'Paver width', max: 3 });
  const j = check(e, 'joint', i.joint, { label: 'Joint', min: 0, exclusive: false, max: 0.05 });
  const w = check(e, 'waste', i.wastePct, { label: 'Waste', min: 0, exclusive: false, max: 100 });
  const bd = check(e, 'beddingDepth', i.beddingDepth, { label: 'Bedding sand', min: 0, exclusive: false, max: 0.2 });
  const base = check(e, 'baseDepth', i.baseDepth, { label: 'Base', min: 0, exclusive: false, max: 1 });
  const bc = check(e, 'baseCompactPct', i.baseCompactPct, { label: 'Base compaction', min: 0, exclusive: false, max: 100 });
  if (hasErrors(e)) return fail(e);
  const cell = (pl + j) * (pw + j);
  const perM2 = 1 / cell;
  const net = A * perM2;
  const count = ceilCount(net * (1 + w / 100));
  const beddingM3 = A * bd * 1.1; // screeded loose sand compacts about 10 % under the pavers
  const sand = 1.6;
  const rb = i.baseDensity && i.baseDensity > 0 ? i.baseDensity : 1.6;
  const baseM3 = A * base * (1 + bc / 100);
  const steps: Step[] = [
    { label: 'Pavers per m²', working: `1 ÷ ((${fmt(pl * 1000, 0)} + ${fmt(j * 1000, 0)}) mm × (${fmt(pw * 1000, 0)} + ${fmt(j * 1000, 0)}) mm)`, result: fmt(perM2, 2) },
    { label: 'Pavers', working: `${fmt(A, 2)} m² × ${fmt(perM2, 2)} × ${fmt(1 + w / 100, 2)}, rounded up`, result: `${count}` },
  ];
  if (bd > 0) steps.push({ label: 'Bedding sand', working: `${fmt(A, 2)} m² × ${fmt(bd * 1000, 0)} mm × 1.10`, result: `${fmt(beddingM3, 2)} m³ (${fmt(beddingM3 * sand, 2)} t)` });
  if (base > 0) steps.push({ label: 'Road base', working: `${fmt(A, 2)} m² × ${fmt(base * 1000, 0)} mm × ${fmt(1 + bc / 100, 2)}`, result: `${fmt(baseM3, 2)} m³ (${fmt(baseM3 * rb, 2)} t)` });
  return ok({ perM2, pavers: count, beddingM3, beddingT: beddingM3 * sand, baseM3, baseT: baseM3 * rb }, steps, [
    'Base depth depends on traffic and subgrade. About 100 mm compacted for paths, 150 mm or more for driveways.',
    'Allow 5 % waste for straight lay, 10 % or more for herringbone and lots of cuts.',
  ]);
}
