/**
 * Reinforcement take-offs: mesh sheets, bar chairs, bars with laps, trench mesh. Metric inputs (m).
 *
 * Sources
 * - SL mesh (SL62…SL102) is made in 6.0 m × 2.4 m sheets with 200 mm wire pitch (AS/NZS 4671 product range,
 *   e.g. InfraBuild/ARC reinforcing mesh data sheets). Sheet size is editable for other products.
 * - Mesh laps: the NCC (2019 Vol. 2 Table 3.2.3.1, from AS 2870/AS 3600) requires "the two outermost transverse
 *   wires of one sheet" to overlap the two outermost wires of the other. No mm figure is given; RMIT's
 *   construction guide quotes at least 225 mm for square mesh, so the default lap is 225 mm (editable).
 * - Sheets needed along a run: n = 1 when L ≤ S, else n = ⌈(L − S) ÷ (S − lap)⌉ + 1, from n·S − (n − 1)·lap ≥ L.
 *   Both sheet orientations are tried and the one with fewer sheets is used.
 * - Bar chairs: one chair per spacing × spacing cell, which keeps every chair within the spacing of its
 *   neighbours and within half a spacing of the edge. Spacing comes from the engineer or chair maker
 *   (commonly 600–1000 mm for mesh); default 800 mm.
 * - Trench mesh comes in 6 m lengths. NCC 2019 Vol. 2 Table 3.2.3.1 (AS 2870): 500 mm end laps, and at T and L
 *   junctions one length runs across the full width of the other, so each junction adds one mesh width.
 * - Bar mass per metre: nominal mass = 7850 kg/m³ × π d²/4 (AS/NZS 4671 nominal mass, steel density 7850 kg/m³),
 *   e.g. N12 = 0.888 kg/m.
 * - Bar laps: AS 3600 cl. 13.2.2 sets tension laps from the development length. That depends on concrete
 *   strength, cover and bar position, so the lap is an input; 40 × bar diameter is only a common rule of thumb.
 */
import { type Calc, type Errors, type Step, check, fail, hasErrors, ok } from './calc.ts';
import { ceilCount, fmt } from './units.ts';

const mm = (v: number) => `${fmt(v * 1000, 0)} mm`;
const m = (v: number) => `${fmt(v, 2)} m`;

/** Pieces of length S needed to cover L with overlaps of `lap` between pieces. */
export function piecesForRun(L: number, S: number, lap: number): number {
  if (L <= S + 1e-9) return 1;
  return ceilCount((L - S) / (S - lap)) + 1;
}

export interface MeshInput {
  length: number | null; width: number | null;
  /** Clearance from the slab edge to the mesh, each side (m). */
  edge: number | null;
  lap: number | null;
  sheetLength: number | null; sheetWidth: number | null;
  chairSpacing: number | null;
  wastePct?: number | null;
}
export interface MeshResult { sheets: number; along: number; across: number; rotated: boolean; chairs: number; meshLength: number; meshWidth: number }

export function mesh(i: MeshInput): Calc<MeshResult> {
  const e: Errors = {};
  const L = check(e, 'length', i.length, { label: 'Length', max: 1000 });
  const W = check(e, 'width', i.width, { label: 'Width', max: 1000 });
  const c = check(e, 'edge', i.edge, { label: 'Edge clearance', min: 0, exclusive: false, max: 1 });
  const lap = check(e, 'lap', i.lap, { label: 'Lap', min: 0, exclusive: false, max: 2 });
  const SL = check(e, 'sheetLength', i.sheetLength, { label: 'Sheet length', max: 20 });
  const SW = check(e, 'sheetWidth', i.sheetWidth, { label: 'Sheet width', max: 20 });
  const s = check(e, 'chairSpacing', i.chairSpacing, { label: 'Chair spacing', max: 5 });
  const w = check(e, 'waste', i.wastePct ?? 0, { label: 'Spare sheets', min: 0, exclusive: false, max: 100 });
  if (hasErrors(e)) return fail(e);
  if (lap >= Math.min(SL, SW)) return fail({ lap: 'The lap must be smaller than the sheet.' });
  const ml = L - 2 * c;
  const mw = W - 2 * c;
  if (ml <= 0 || mw <= 0) return fail({ edge: 'The edge clearance leaves no room for mesh.' });
  const a1 = piecesForRun(ml, SL, lap), b1 = piecesForRun(mw, SW, lap);
  const a2 = piecesForRun(ml, SW, lap), b2 = piecesForRun(mw, SL, lap);
  const rotated = a2 * b2 < a1 * b1;
  const along = rotated ? a2 : a1;
  const across = rotated ? b2 : b1;
  const net = along * across;
  const sheets = ceilCount(net * (1 + w / 100));
  const chairs = ceilCount(ml / s) * ceilCount(mw / s);
  const [sa, sb] = rotated ? [SW, SL] : [SL, SW];
  const steps: Step[] = [
    { label: 'Mesh area', working: `(${m(L)} − 2 × ${mm(c)}) × (${m(W)} − 2 × ${mm(c)})`, result: `${m(ml)} × ${m(mw)}` },
    { label: `Sheets along (${m(sa)} sheets)`, working: ml <= sa ? `${m(ml)} fits in one sheet` : `⌈(${m(ml)} − ${m(sa)}) ÷ (${m(sa)} − ${mm(lap)})⌉ + 1`, result: `${along}` },
    { label: `Sheets across (${m(sb)} sheets)`, working: mw <= sb ? `${m(mw)} fits in one sheet` : `⌈(${m(mw)} − ${m(sb)}) ÷ (${m(sb)} − ${mm(lap)})⌉ + 1`, result: `${across}` },
    { label: 'Sheets', working: `${along} × ${across}${w ? ` + ${fmt(w, 0)} % spare` : ''}`, result: `${sheets}` },
    { label: 'Bar chairs', working: `⌈${m(ml)} ÷ ${mm(s)}⌉ × ⌈${m(mw)} ÷ ${mm(s)}⌉`, result: `${chairs}` },
  ];
  const notes = [
    rotated ? 'Sheets run across the slab (fewer sheets that way).' : 'Sheets run along the slab.',
    'Mesh type, laps and cover come from your engineer’s drawings (AS 3600 / AS 2870).',
  ];
  return ok({ sheets, along, across, rotated, chairs, meshLength: ml, meshWidth: mw }, steps, notes);
}

export const BAR_SIZES = [10, 12, 16, 20, 24, 28, 32, 36] as const;
/** Nominal mass in kg/m for a bar of diameter d mm. */
export const barMassPerM = (dmm: number) => (7850 * Math.PI * (dmm / 1000) ** 2) / 4;

export interface BarsInput {
  /** Length of one run of bar (m), e.g. the length of a strip footing. */
  runLength: number | null;
  /** Number of runs (e.g. 2 footings) and bars in each run (e.g. 3 bars top and bottom = 6). */
  runs: number | null; barsPerRun: number | null;
  stockLength: number | null; lap: number | null;
  /** Bar diameter in mm, for mass. */
  diameter: number | null;
}
export interface BarsResult { piecesPerBar: number; stockBars: number; laps: number; totalBarLength: number; massKg: number }

export function bars(i: BarsInput): Calc<BarsResult> {
  const e: Errors = {};
  const L = check(e, 'runLength', i.runLength, { label: 'Run length', max: 10000 });
  const runs = check(e, 'runs', i.runs, { label: 'Runs', int: true, max: 10000 });
  const per = check(e, 'barsPerRun', i.barsPerRun, { label: 'Bars per run', int: true, max: 100 });
  const S = check(e, 'stockLength', i.stockLength, { label: 'Stock length', max: 24 });
  const lap = check(e, 'lap', i.lap, { label: 'Lap', min: 0, exclusive: false, max: 5 });
  const d = check(e, 'diameter', i.diameter, { label: 'Bar size', max: 60 });
  if (hasErrors(e)) return fail(e);
  if (lap >= S) return fail({ lap: 'The lap must be shorter than the stock bar.' });
  const pieces = piecesForRun(L, S, lap);
  const lines = runs * per;
  const stockBars = pieces * lines;
  const laps = (pieces - 1) * lines;
  const totalBarLength = stockBars * S;
  const kgm = barMassPerM(d);
  const massKg = totalBarLength * kgm;
  const steps: Step[] = [
    { label: 'Bars to make one line', working: L <= S ? `${m(L)} fits in one ${m(S)} bar` : `⌈(${m(L)} − ${m(S)}) ÷ (${m(S)} − ${mm(lap)})⌉ + 1`, result: `${pieces}` },
    { label: 'Lines of bar', working: `${runs} run${runs === 1 ? '' : 's'} × ${per} bar${per === 1 ? '' : 's'}`, result: `${lines}` },
    { label: 'Stock bars', working: `${pieces} × ${lines}`, result: `${stockBars}` },
    { label: 'Laps', working: `(${pieces} − 1) × ${lines}`, result: `${laps}` },
    { label: `Mass (N${fmt(d, 0)} = ${fmt(kgm, 3)} kg/m)`, working: `${stockBars} × ${m(S)} × ${fmt(kgm, 3)} kg/m`, result: `${fmt(massKg, 1)} kg` },
  ];
  return ok({ piecesPerBar: pieces, stockBars, laps, totalBarLength, massKg }, steps, [
    'Lap lengths come from your engineer’s drawings (AS 3600). 40 × bar diameter is only a rule of thumb.',
    'Bar mass assumes the full stock bars you buy, offcuts included.',
  ]);
}

export interface TrenchMeshInput { totalLength: number | null; lines: number | null; stockLength: number | null; lap: number | null; corners: number | null; meshWidth: number | null }
export interface TrenchMeshResult { pieces: number; laps: number }

/** Trench mesh along footings: 500 mm end laps; every corner or T-junction adds one mesh width. */
export function trenchMesh(i: TrenchMeshInput): Calc<TrenchMeshResult> {
  const e: Errors = {};
  const L = check(e, 'totalLength', i.totalLength, { label: 'Footing length', max: 10000 });
  const lines = check(e, 'lines', i.lines, { label: 'Layers', int: true, max: 10 });
  const S = check(e, 'stockLength', i.stockLength, { label: 'Stock length', max: 24 });
  const lap = check(e, 'lap', i.lap, { label: 'Lap', min: 0, exclusive: false, max: 5 });
  const k = check(e, 'corners', i.corners ?? 0, { label: 'Corners and T-junctions', min: 0, exclusive: false, int: true, max: 1000 });
  const mw = check(e, 'meshWidth', i.meshWidth, { label: 'Mesh width', max: 2 });
  if (hasErrors(e)) return fail(e);
  if (lap >= S) return fail({ lap: 'The lap must be shorter than the stock length.' });
  const effective = L + k * mw;
  const perLine = piecesForRun(effective, S, lap);
  const pieces = perLine * lines;
  const steps: Step[] = [
    { label: 'Length incl. junction laps', working: `${m(L)} + ${k} × ${mm(mw)}`, result: m(effective) },
    { label: 'Lengths per layer', working: effective <= S ? 'fits in one length' : `⌈(${m(effective)} − ${m(S)}) ÷ (${m(S)} − ${mm(lap)})⌉ + 1`, result: `${perLine}` },
    { label: 'Trench mesh lengths', working: `${perLine} × ${lines}`, result: `${pieces}` },
  ];
  return ok({ pieces, laps: (perLine - 1) * lines }, steps, ['Trench mesh: 500 mm end laps, full-width laps at corners and T-junctions (AS 2870). Check your engineer’s footing details.']);
}
