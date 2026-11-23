/**
 * Grout, adhesive and waterproofing quantities. Sources in docs/SOURCES.md ("Grout", "Adhesive", "Membrane").
 *
 * GROUT (the joint-volume formula published by grout makers, e.g. Mapei, Ardex, Kerakoll and Laticrete):
 *   kg per m² = (A + B) ÷ (A × B) × C × D × ρ
 *   A, B = tile length and width (mm), C = tile thickness = joint depth (mm), D = joint width (mm),
 *   ρ = grout density in kg/L (≈ kg/dm³). With mm in, the result is kg/m² directly, because a 1 mm layer over
 *   1 m² is 1 litre. Joint length per m² = (A + B)/(A × B) × 1000 m, × joint cross-section C × D mm².
 *
 * ADHESIVE: maker's coverage for the trowel notch (kg/m²) × area, plus back-buttering when the tile needs it.
 * MEMBRANE: area × coverage per coat × coats, from the product's data sheet.
 */
import { ceilSafe, fail, fmt, type CalcResult, type Problem, type Step } from './steps.ts';
import { formatArea, formatLength, formatMass, formatVolume, KG_PER_LB, L_PER_USGAL, type UnitSystem } from './units.ts';

export interface GroutInput {
  areaM2: number;
  tileLengthMm: number;
  tileWidthMm: number;
  tileThicknessMm: number;
  jointMm: number;
  /** kg/L. Cement grouts ≈ 1.6–1.9, epoxy ≈ 1.5–1.7; from the product, else the generic default. */
  density: number;
  bagKg: number;
  extraPct: number;
  system: UnitSystem;
}

export interface GroutResult { kgPerM2: number; kg: number; kgWithExtra: number; bags: number; jointLengthM: number }

export function calcGrout(input: GroutInput): CalcResult<GroutResult> {
  const { areaM2, tileLengthMm: A, tileWidthMm: B, tileThicknessMm: C, jointMm: D, density: rho, bagKg, extraPct, system } = input;
  const problems: Problem[] = [];
  if (!(areaM2 > 0)) problems.push({ field: 'area', message: 'Enter the area to grout.' });
  if (!(A > 0) || !(B > 0)) problems.push({ field: 'tile', message: 'Enter the tile size.' });
  if (!(C > 0) || C > 50) problems.push({ field: 'thickness', message: 'Tile thickness must be between 0 and 50 mm.' });
  if (!(D > 0) || D > 50) problems.push({ field: 'joint', message: 'Joint width must be above 0 and up to 50 mm.' });
  if (!(rho > 0.5 && rho < 3)) problems.push({ field: 'density', message: 'Grout density must be between 0.5 and 3 kg/L.' });
  if (!(bagKg > 0)) problems.push({ field: 'bag', message: 'Enter the bag size.' });
  if (!(extraPct >= 0 && extraPct <= 100)) problems.push({ field: 'extra', message: 'Extra must be between 0 and 100%.' });
  if (problems.length) return fail(...problems);
  const perM2 = ((A + B) / (A * B)) * C * D * rho;
  const kg = perM2 * areaM2;
  const withExtra = kg * (1 + extraPct / 100);
  const bags = ceilSafe(withExtra / bagKg);
  const jointLengthM = ((A + B) / (A * B)) * 1000 * areaM2;
  const M = (v: number) => formatMass(v, system);
  const T = (v: number) => formatLength(v, system, 'tile');
  const steps: Step[] = [
    { label: 'Grout per m²', working: `(${T(A)} + ${T(B)}) ÷ (${T(A)} × ${T(B)}) × ${T(C)} deep × ${T(D)} wide × ${fmt(rho, 2)} kg/L`, result: `${fmt(perM2, 3)} kg/m²` },
    { label: 'Grout for the area', working: `${fmt(perM2, 3)} kg/m² × ${formatArea(areaM2, system)}`, result: M(kg) },
    { label: `Add ${fmt(extraPct, 0)}% for mixing and clean-up`, working: `${M(kg)} × ${fmt(1 + extraPct / 100, 2)}`, result: M(withExtra) },
    { label: 'Bags', working: `${M(withExtra)} ÷ ${M(bagKg)} bag, rounded up`, result: `${fmt(bags, 0)} bags` },
  ];
  const notes = [`About ${fmt(jointLengthM, 0)} m of joint to fill.`];
  if (D < 3 && system !== 'imperial') notes.push('Joints under 3 mm usually need an unsanded / fine grout: check the bag.');
  return { ok: true, value: { kgPerM2: perM2, kg, kgWithExtra: withExtra, bags, jointLengthM }, steps, notes };
}

export interface AdhesiveInput {
  areaM2: number;
  /** Maker's coverage for the chosen notch, kg/m². */
  kgPerM2: number;
  notchLabel: string;
  /** Extra kg/m² for back-buttering (0 when not back-buttering). */
  backButterKgPerM2: number;
  bagKg: number;
  extraPct: number;
  system: UnitSystem;
}

export interface AdhesiveResult { kg: number; kgWithExtra: number; bags: number }

export function calcAdhesive(input: AdhesiveInput): CalcResult<AdhesiveResult> {
  const { areaM2, kgPerM2, backButterKgPerM2: bb, bagKg, extraPct, system } = input;
  const problems: Problem[] = [];
  if (!(areaM2 > 0)) problems.push({ field: 'area', message: 'Enter the area to tile.' });
  if (!(kgPerM2 > 0 && kgPerM2 < 30)) problems.push({ field: 'coverage', message: 'Coverage must be between 0 and 30 kg/m².' });
  if (!(bb >= 0 && bb < 10)) problems.push({ field: 'backButter', message: 'Back-buttering must be between 0 and 10 kg/m².' });
  if (!(bagKg > 0)) problems.push({ field: 'bag', message: 'Enter the bag size.' });
  if (!(extraPct >= 0 && extraPct <= 100)) problems.push({ field: 'extra', message: 'Extra must be between 0 and 100%.' });
  if (problems.length) return fail(...problems);
  const rate = kgPerM2 + bb;
  const kg = rate * areaM2;
  const withExtra = kg * (1 + extraPct / 100);
  const bags = ceilSafe(withExtra / bagKg);
  const M = (v: number) => formatMass(v, system);
  const rateText = system === 'metric' ? `${fmt(rate, 2)} kg/m²` : `${fmt(rate / KG_PER_LB * 0.09290304, 3)} lb/sq ft`;
  const steps: Step[] = [
    { label: 'Adhesive rate', working: bb > 0 ? `${fmt(kgPerM2, 2)} kg/m² (${input.notchLabel}) + ${fmt(bb, 2)} kg/m² back-buttering` : `${input.notchLabel} notch, maker's coverage`, result: rateText },
    { label: 'Adhesive for the area', working: `${rateText} × ${formatArea(areaM2, system)}`, result: M(kg) },
    { label: `Add ${fmt(extraPct, 0)}% for the bucket and the trowel`, working: `${M(kg)} × ${fmt(1 + extraPct / 100, 2)}`, result: M(withExtra) },
    { label: 'Bags', working: `${M(withExtra)} ÷ ${M(bagKg)} bag, rounded up`, result: `${fmt(bags, 0)} bags` },
  ];
  return { ok: true, value: { kg, kgWithExtra: withExtra, bags }, steps, notes: [] };
}

export interface MembraneSurface { label: string; areaM2: number }

export interface MembraneInput {
  surfaces: MembraneSurface[];
  /** Litres per m² per coat, from the product. */
  litresPerM2PerCoat: number;
  coats: number;
  packLitres: number;
  primerM2PerLitre: number | null;
  primerPackLitres: number | null;
  /** Lengths that need reinforcing tape / bond breaker (wall-floor junctions, internal corners, around penetrations). */
  tapeRunMm: number;
  tapeRollMm: number | null;
  system: UnitSystem;
  /** Products sold by weight: amounts are kg instead of litres. */
  packUnit?: 'L' | 'kg';
}

export interface MembraneResult { areaM2: number; litres: number; packs: number; primerLitres: number | null; primerPacks: number | null; tapeRolls: number | null }

export function calcMembrane(input: MembraneInput): CalcResult<MembraneResult> {
  const { surfaces, litresPerM2PerCoat: c, coats, packLitres, system } = input;
  const problems: Problem[] = [];
  const area = surfaces.reduce((s, x) => s + (x.areaM2 > 0 ? x.areaM2 : 0), 0);
  if (!(area > 0)) problems.push({ field: 'area', message: 'Enter at least one surface to waterproof.' });
  if (surfaces.some(x => x.areaM2 < 0)) problems.push({ field: 'area', message: 'Areas can\'t be negative.' });
  if (!(c > 0 && c < 10)) problems.push({ field: 'coverage', message: 'Coverage must be between 0 and 10 L/m² per coat.' });
  if (!(Number.isInteger(coats) && coats >= 1 && coats <= 5)) problems.push({ field: 'coats', message: 'Coats must be a whole number from 1 to 5.' });
  if (!(packLitres > 0)) problems.push({ field: 'pack', message: 'Enter the pack size.' });
  if (!(input.tapeRunMm >= 0)) problems.push({ field: 'tape', message: 'Tape length can\'t be negative.' });
  if (problems.length) return fail(...problems);
  const litres = area * c * coats;
  const packs = ceilSafe(litres / packLitres);
  const kg = input.packUnit === 'kg';
  const V = (v: number) => (kg ? formatMass(v, system) : formatVolume(v, system));
  const per = kg ? 'kg/m²' : 'L/m²';
  const steps: Step[] = [
    { label: 'Area to waterproof', working: surfaces.filter(s => s.areaM2 > 0).map(s => `${s.label} ${formatArea(s.areaM2, system)}`).join(' + '), result: formatArea(area, system) },
    { label: 'Membrane', working: `${formatArea(area, system)} × ${fmt(c, 3)} ${per} × ${coats} coats`, result: V(litres) },
    { label: 'Packs', working: `${V(litres)} ÷ ${V(packLitres)} pack, rounded up`, result: `${fmt(packs, 0)} packs` },
  ];
  let primerLitres: number | null = null, primerPacks: number | null = null, tapeRolls: number | null = null;
  if (input.primerM2PerLitre && input.primerM2PerLitre > 0) {
    primerLitres = area / input.primerM2PerLitre;
    steps.push({ label: 'Primer', working: `${formatArea(area, system)} ÷ ${fmt(input.primerM2PerLitre, 1)} m²/L`, result: V(primerLitres) });
    if (input.primerPackLitres && input.primerPackLitres > 0) {
      primerPacks = ceilSafe(primerLitres / input.primerPackLitres);
      steps.push({ label: 'Primer packs', working: `${V(primerLitres)} ÷ ${V(input.primerPackLitres)}, rounded up`, result: `${primerPacks}` });
    }
  }
  if (input.tapeRunMm > 0 && input.tapeRollMm && input.tapeRollMm > 0) {
    tapeRolls = ceilSafe(input.tapeRunMm / input.tapeRollMm);
    steps.push({ label: 'Tape / bond breaker', working: `${formatLength(input.tapeRunMm, system)} ÷ ${formatLength(input.tapeRollMm, system)} roll`, result: `${fmt(tapeRolls, 0)} rolls` });
  }
  return { ok: true, value: { areaM2: area, litres, packs, primerLitres, primerPacks, tapeRolls }, steps, notes: [] };
}

export interface WetAreaInput {
  roomLengthMm: number;
  roomWidthMm: number;
  showerLengthMm: number;
  showerWidthMm: number;
  /** 2 = shower in a corner, 3 = alcove (end of the room), 1 = against one wall. */
  showerWalls: 1 | 2 | 3;
  doorWidthMm: number;
  showerWallHeightMm: number;
  upturnMm: number;
  wholeFloor: boolean;
}

/**
 * Wet-area take-off (whole bathroom with a shower), the method in AS 3740 / NCC 2022 Housing Provisions 10.2:
 *   floor (whole room, or the shower floor only)
 * + shower wall lengths × shower wall height (1800 mm in AU)
 * + (room perimeter − shower walls − door) × upturn outside the shower (150 mm trade practice)
 * Tape / bond breaker: wall-floor junction (perimeter − door) + internal corners inside the shower × shower height
 * + the other internal corners × the upturn. Assumes a rectangular room with the shower in a corner or alcove.
 */
export function wetAreaSurfaces(w: WetAreaInput): { surfaces: MembraneSurface[]; tapeMm: number; problems: Problem[] } {
  const problems: Problem[] = [];
  if (!(w.roomLengthMm > 0) || !(w.roomWidthMm > 0)) problems.push({ field: 'room', message: 'Enter the room size.' });
  if (!(w.showerLengthMm > 0) || !(w.showerWidthMm > 0)) problems.push({ field: 'shower', message: 'Enter the shower size.' });
  if (w.showerLengthMm > w.roomLengthMm + 0.5 || w.showerWidthMm > w.roomWidthMm + 0.5) problems.push({ field: 'shower', message: 'The shower is bigger than the room.' });
  if (!(w.doorWidthMm >= 0)) problems.push({ field: 'door', message: "Door width can't be negative." });
  if (!(w.showerWallHeightMm > 0) || !(w.upturnMm >= 0)) problems.push({ field: 'height', message: 'Enter the waterproofing heights.' });
  if (problems.length) return { surfaces: [], tapeMm: 0, problems };
  const perimeter = 2 * (w.roomLengthMm + w.roomWidthMm);
  const wallLens = w.showerWalls === 3 ? [w.showerLengthMm, w.showerWidthMm, w.showerWidthMm] : w.showerWalls === 2 ? [w.showerLengthMm, w.showerWidthMm] : [w.showerLengthMm];
  const showerWallRun = wallLens.reduce((a, b) => a + b, 0);
  const outsideRun = Math.max(0, perimeter - showerWallRun - w.doorWidthMm);
  const floor = w.wholeFloor ? (w.roomLengthMm * w.roomWidthMm) / 1e6 : (w.showerLengthMm * w.showerWidthMm) / 1e6;
  const surfaces: MembraneSurface[] = [
    { label: w.wholeFloor ? 'Floor' : 'Shower floor', areaM2: floor },
    { label: 'Shower walls', areaM2: (showerWallRun * w.showerWallHeightMm) / 1e6 },
    { label: 'Upturn', areaM2: (outsideRun * w.upturnMm) / 1e6 },
  ];
  const showerCorners = w.showerWalls - 1;
  const otherCorners = 4 - showerCorners;
  const tapeMm = (perimeter - w.doorWidthMm) + showerCorners * w.showerWallHeightMm + otherCorners * w.upturnMm;
  return { surfaces, tapeMm, problems };
}

export const perGalToPerLitre = (sqFtPerGal: number) => 1 / ((sqFtPerGal * 0.09290304) / L_PER_USGAL);
