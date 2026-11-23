/**
 * Tiling a flight of stairs: tile count per tread and riser, nosing lengths, and the riser check.
 *
 * Tile count per face is cut-aware: across = ⌈width ÷ (tile + joint)⌉, deep = ⌈depth ÷ (tile + joint)⌉, each piece
 * cut from its own tile (stair faces are too narrow for useful offcut reuse).
 *
 * Riser check: building codes limit riser height R and going G and the "step formula" 2R + G (Blondel's rule, used in
 * NCC Housing Provisions, Approved Document K, NZBC D1/AS1, NBC 9.8.4; limits per country in the country file).
 * Codes also require risers in a flight to be consistent. Tiling every tread adds the build-up (tile + bed) to every
 * tread, so middle risers don't change, but the bottom riser grows by the build-up when the floor at the foot isn't
 * raised by the same amount, and the top riser shrinks by it when the landing isn't tiled.
 */
import { calcTrim } from './trim.ts';
import { ceilSafe, fail, fmt, type CalcResult, type Problem, type Step } from './steps.ts';
import { formatArea, formatLength, type UnitSystem } from './units.ts';

export interface StairLimits { riserMin: number; riserMax: number; goingMin: number; goingMax: number; twoRGMin?: number; twoRGMax?: number; source: string }

export interface StairInput {
  steps: number; // treads to tile
  widthMm: number;
  goingMm: number; // tread depth to tile
  riserMm: number; // riser height
  tileRisers: boolean;
  tileLengthMm: number;
  tileWidthMm: number;
  jointMm: number;
  buildUpMm: number; // tile thickness + adhesive bed
  floorRaisedAtFoot: boolean;
  landingTiled: boolean;
  nosingStockMm: number;
  limits: StairLimits | null;
  system: UnitSystem;
}

export interface StairResult {
  tilesPerTread: number;
  tilesPerRiser: number;
  tiles: number;
  treadM2: number;
  riserM2: number;
  nosingLengths: number;
  bottomRiser: number;
  topRiser: number;
  issues: string[];
}

export function calcStairs(input: StairInput): CalcResult<StairResult> {
  const { steps: n, widthMm: w, goingMm: g, riserMm: r, tileLengthMm: tl, tileWidthMm: tw, jointMm: j, system } = input;
  const problems: Problem[] = [];
  if (!(Number.isInteger(n) && n >= 1 && n <= 100)) problems.push({ field: 'steps', message: 'Number of treads must be a whole number from 1 to 100.' });
  if (!(w > 0) || !(g > 0) || !(r > 0)) problems.push({ field: 'size', message: 'Enter the stair width, going and riser.' });
  if (!(tl > 0) || !(tw > 0)) problems.push({ field: 'tile', message: 'Enter the tile size.' });
  if (!(j >= 0) || j > 50) problems.push({ field: 'joint', message: 'Joint width must be between 0 and 50 mm.' });
  if (!(input.buildUpMm >= 0) || input.buildUpMm > 100) problems.push({ field: 'buildUp', message: 'Build-up must be between 0 and 100 mm.' });
  if (problems.length) return fail(...problems);

  const across = (span: number, t: number) => ceilSafe(span / (t + j));
  // Lay the tile's long side across the stair width.
  const perTread = across(w, tl) * across(g, tw);
  const perRiser = input.tileRisers ? across(w, tl) * across(r, tw) : 0;
  const tiles = n * (perTread + perRiser);
  const treadM2 = (n * w * g) / 1e6;
  const riserM2 = input.tileRisers ? (n * w * r) / 1e6 : 0;
  const trim = calcTrim({ runsMm: Array(n).fill(w), stockMm: input.nosingStockMm, allowanceMm: 0, system });
  const nosing = trim.ok ? trim.value.lengths : n;
  const bottom = r + (input.floorRaisedAtFoot ? 0 : input.buildUpMm);
  const top = r - (input.landingTiled ? 0 : input.buildUpMm);
  const F = (v: number) => formatLength(v, system, 'tile');
  const steps: Step[] = [
    { label: 'Tiles per tread', working: `⌈${F(w)} ÷ ${F(tl + j)}⌉ × ⌈${F(g)} ÷ ${F(tw + j)}⌉`, result: `${perTread}` },
  ];
  if (input.tileRisers) steps.push({ label: 'Tiles per riser', working: `⌈${F(w)} ÷ ${F(tl + j)}⌉ × ⌈${F(r)} ÷ ${F(tw + j)}⌉`, result: `${perRiser}` });
  steps.push({ label: 'Tiles for the flight', working: `${n} × (${perTread}${input.tileRisers ? ` + ${perRiser}` : ''})`, result: `${fmt(tiles, 0)} tiles` });
  steps.push({ label: 'Nosing lengths', working: `${n} treads of ${F(w)} cut from ${formatLength(input.nosingStockMm, system)} lengths`, result: `${fmt(nosing, 0)} lengths` });
  steps.push({ label: 'Bottom riser after tiling', working: input.floorRaisedAtFoot ? `${F(r)} (floor at the foot raised the same)` : `${F(r)} + ${F(input.buildUpMm)} build-up`, result: F(bottom) });
  steps.push({ label: 'Top riser after tiling', working: input.landingTiled ? `${F(r)} (landing tiled the same)` : `${F(r)} − ${F(input.buildUpMm)} build-up`, result: F(top) });

  const issues: string[] = [];
  const L = input.limits;
  if (L) {
    const range = (min: number, max: number) => (min > 0 && max < 10_000 ? `${F(min)}–${F(max)}` : min > 0 ? `at least ${F(min)}` : `at most ${F(max)}`);
    for (const [name, v] of [['Middle risers', r], ['Bottom riser', bottom], ['Top riser', top]] as const) {
      if (v < L.riserMin || v > L.riserMax) issues.push(`${name} ${F(v)}: the code needs ${range(L.riserMin, L.riserMax)} (${L.source}).`);
    }
    if (g < L.goingMin || g > L.goingMax) issues.push(`Going ${F(g)}: the code needs ${range(L.goingMin, L.goingMax)} (${L.source}).`);
    if (L.twoRGMin != null && L.twoRGMax != null) {
      const s = 2 * r + g;
      steps.push({ label: 'Step formula 2R + G', working: `2 × ${F(r)} + ${F(g)}`, result: F(s) });
      if (s < L.twoRGMin || s > L.twoRGMax) issues.push(`2R + G = ${F(s)}: the code needs ${F(L.twoRGMin)}–${F(L.twoRGMax)} (${L.source}).`);
    }
  }
  if (Math.abs(bottom - r) > 0.5 || Math.abs(top - r) > 0.5) issues.push(`Risers would differ by up to ${F(Math.max(Math.abs(bottom - r), Math.abs(top - r)))}. Codes need risers in a flight to be consistent: raise the floor at the foot, tile the landing, or adjust the bed.`);
  return { ok: true, value: { tilesPerTread: perTread, tilesPerRiser: perRiser, tiles, treadM2, riserM2, nosingLengths: nosing, bottomRiser: bottom, topRiser: top, issues }, steps, notes: [`Tiled area: ${formatArea(treadM2 + riserM2, system)} (treads ${formatArea(treadM2, system)}, risers ${formatArea(riserM2, system)}).`] };
}
