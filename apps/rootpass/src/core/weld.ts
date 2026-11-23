/**
 * Weld metal and filler estimate.
 *
 * Deposited metal = joint cross-section area × weld length × density (steel 7850 kg/m³).
 * Joint areas (from the joint geometry; the same expressions are used in the Lincoln Electric "Procedure Handbook
 * of Arc Welding", 14th ed., section 12.1 "Estimating weld metal", and the AWS Welding Handbook vol. 1):
 *   Fillet, legs a × b            A = a · b / 2
 *   Square butt, gap g            A = g · t
 *   Single-V, gap g, root face f, included angle α
 *                                 A = g · t + (t − f)² · tan(α/2)
 *   Double-V (symmetric)          A = g · t + (t − f)² · tan(α/2) / 2
 * Reinforcement / convexity is added as a percentage of that area (default 10 %).
 *
 * Filler to buy = deposited metal / deposition efficiency. Typical efficiencies (Lincoln Procedure Handbook,
 * sec. 12.1; ESAB "Consumables calculator" notes; Miller "Calculating filler metal"):
 *   GMAW / MIG solid wire 95 %, FCAW gas-shielded 85 %, FCAW self-shielded 80 %,
 *   MMAW / stick 60 % (coating, spatter and stub ends), GTAW / TIG rod 98 %.
 * These are averages; the app lets the welder change them.
 */
import { DEG, fail, fmt, positive, type Result, type Step } from './units.ts';

export const PROCESSES = {
  gmaw: { name: 'MIG (solid wire)', efficiency: 0.95, pack: { kg: 15, name: '15 kg spool' } },
  fcawG: { name: 'Flux-cored, gas-shielded', efficiency: 0.85, pack: { kg: 15, name: '15 kg spool' } },
  fcawS: { name: 'Flux-cored, gasless', efficiency: 0.8, pack: { kg: 4.5, name: '4.5 kg spool' } },
  mmaw: { name: 'Stick (MMAW)', efficiency: 0.6, pack: { kg: 5, name: '5 kg packet' } },
  gtaw: { name: 'TIG rod', efficiency: 0.98, pack: { kg: 5, name: '5 kg tube' } },
} as const;
export type ProcessId = keyof typeof PROCESSES;

export type Joint =
  | { kind: 'fillet'; legA: number; legB: number }
  | { kind: 'squareButt'; thickness: number; gap: number }
  | { kind: 'singleV' | 'doubleV'; thickness: number; gap: number; rootFace: number; includedDeg: number };

export interface WeldInput {
  joint: Joint;
  length: number; // mm of weld
  reinforcementPct: number; // e.g. 10
  process: ProcessId;
  efficiency?: number; // 0..1, overrides the process default
  density?: number; // kg/m³, default steel 7850
}

export interface WeldResult {
  area: number; // mm² incl. reinforcement
  depositedKg: number;
  fillerKg: number;
  packs: number;
  packName: string;
  perMetreKg: number; // filler per metre of weld
}

/**
 * Equal-leg 90° fillet: throat a = leg z / √2, so z = a·√2 (ISO 2553 sizes fillets by a; AS 1554 and AWS often by leg).
 */
export function legFromThroat(a: number): number {
  return a * Math.SQRT2;
}

export function jointArea(j: Joint): Result<{ area: number; step: Step }> {
  if (j.kind === 'fillet') {
    const bad = positive('leg A', j.legA) ?? positive('leg B', j.legB);
    if (bad) return fail(bad);
    const a = (j.legA * j.legB) / 2;
    return done(a, { label: 'Fillet area', formula: 'A = a × b / 2', value: `${fmt(j.legA, 1)} × ${fmt(j.legB, 1)} / 2 = ${fmt(a, 1)} mm²` });
  }
  const bad = positive('plate thickness', j.thickness);
  if (bad) return fail(bad);
  if (!Number.isFinite(j.gap) || j.gap < 0) return fail('Root gap cannot be negative.');
  if (j.kind === 'squareButt') {
    if (j.gap === 0) return fail('A square butt with no gap holds no filler. Enter the root gap.');
    const a = j.gap * j.thickness;
    return done(a, { label: 'Square butt area', formula: 'A = g × t', value: `${fmt(j.gap, 1)} × ${fmt(j.thickness, 1)} = ${fmt(a, 1)} mm²` });
  }
  if (!Number.isFinite(j.rootFace) || j.rootFace < 0 || j.rootFace >= j.thickness) return fail('Root face must be from 0 up to less than the plate thickness.');
  if (!Number.isFinite(j.includedDeg) || j.includedDeg <= 0 || j.includedDeg >= 120) return fail('Included angle must be between 0° and 120°.');
  const tanHalf = Math.tan((j.includedDeg / 2) * DEG);
  const prep = (j.thickness - j.rootFace) ** 2 * tanHalf * (j.kind === 'doubleV' ? 0.5 : 1);
  const a = j.gap * j.thickness + prep;
  const formula = j.kind === 'doubleV' ? 'A = g·t + (t − f)²·tan(α/2) / 2' : 'A = g·t + (t − f)²·tan(α/2)';
  return done(a, { label: j.kind === 'doubleV' ? 'Double-V area' : 'Single-V area', formula, value: `${fmt(j.gap * j.thickness, 1)} + ${fmt(prep, 1)} = ${fmt(a, 1)} mm²` });
}

function done(area: number, step: Step): Result<{ area: number; step: Step }> {
  return { ok: true, value: { area, step }, steps: [step], warnings: [] };
}

export function weldFiller(i: WeldInput): Result<WeldResult> {
  const area = jointArea(i.joint);
  if (!area.ok) return area;
  const bad = positive('weld length', i.length);
  if (bad) return fail(bad);
  if (!Number.isFinite(i.reinforcementPct) || i.reinforcementPct < 0 || i.reinforcementPct > 100) return fail('Reinforcement must be 0 to 100 %.');
  const proc = PROCESSES[i.process];
  if (!proc) return fail('Pick a welding process.');
  const eff = i.efficiency ?? proc.efficiency;
  if (!Number.isFinite(eff) || eff <= 0 || eff > 1) return fail('Efficiency must be more than 0 and no more than 100 %.');
  const rho = i.density ?? 7850;
  const total = area.value.area * (1 + i.reinforcementPct / 100);
  const deposited = total * i.length * 1e-9 * rho; // mm² × mm = mm³ → m³ × kg/m³
  const filler = deposited / eff;
  const perMetre = (total * 1000 * 1e-9 * rho) / eff;
  const packs = Math.ceil(filler / proc.pack.kg - 1e-9);
  const steps: Step[] = [
    area.value.step,
    { label: 'With reinforcement', formula: 'A × (1 + reinforcement %)', value: `${fmt(area.value.area, 1)} × ${fmt(1 + i.reinforcementPct / 100, 2)} = ${fmt(total, 1)} mm²` },
    { label: 'Weld metal deposited', formula: 'A × length × density', value: `${fmt(total, 1)} mm² × ${fmt(i.length, 0)} mm × ${rho} kg/m³ = ${fmt(deposited, 3)} kg` },
    { label: `Filler to buy (${proc.name}, ${fmt(eff * 100, 0)} % efficient)`, formula: 'deposited / efficiency', value: `${fmt(deposited, 3)} / ${fmt(eff, 2)} = ${fmt(filler, 3)} kg` },
  ];
  return {
    ok: true,
    value: { area: total, depositedKg: deposited, fillerKg: filler, packs: Math.max(1, packs), packName: proc.pack.name, perMetreKg: perMetre },
    steps,
    warnings: ['An estimate for ordering: allow extra for tacks, restarts, grinding out and practice runs.'],
  };
}
