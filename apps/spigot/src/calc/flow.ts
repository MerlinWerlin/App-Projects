/**
 * Pipe volume, flow and velocity, and friction loss.
 *
 * Volume of water in a pipe: V = π/4 × d² × L (cylinder volume). With d and L in metres V is in m³; × 1000 = litres.
 * Flow and velocity (continuity): Q = v × A, A = π/4 × d²  (Q m³/s, v m/s, A m²).
 * Friction loss, Hazen–Williams (SI form, water at ordinary temperatures):
 *   h_f = 10.67 × L × Q^1.852 ÷ (C^1.852 × d^4.871)      h_f, L, d in metres, Q in m³/s
 * Source: Hazen–Williams equation, SI form as given in e.g. Brater & King, "Handbook of Hydraulics" (McGraw-Hill)
 * and the US EPA "EPANET 2 Users Manual" (EPA/600/R-00/057), Table 3.1 (head-loss formula, SI coefficient 10.67).
 * Pressure from head: p = ρ g h; for water ρ = 1000 kg/m³, g = 9.80665 m/s² -> 9.807 kPa per metre of head.
 * Hazen–Williams is only valid for water (not steam/gas), roughly 5–25 °C, turbulent flow; treat it as an estimate.
 * Velocity limits come from the person's country profile (src/country); with none verified, only generic advice shows.
 */
import { L, fail, isPos, type CalcResult, type Step, type Value } from './steps';

const V = (kind: Value['kind'], n: number): Value => ({ kind, n });

export const G = 9.80665;
export const KPA_PER_M_HEAD = (1000 * G) / 1000; // 9.80665

export function area(idMm: number): number {
  const d = idMm / 1000;
  return (Math.PI / 4) * d * d;
}

export interface VolumeInput { id: number; length: number }

export function volume(input: VolumeInput): CalcResult<{ litres: number; litresPerMetre: number; kg: number }> {
  if (!isPos(input.id)) return fail('Choose a pipe or enter the inside diameter', 'id');
  if (!isPos(input.length)) return fail('Enter the length (more than 0)', 'length');
  const a = area(input.id);
  const litresPerMetre = a * 1000;
  const litres = litresPerMetre * (input.length / 1000);
  const steps: Step[] = [
    { label: 'Bore area', formula: 'π ÷ 4 × ID²', inputs: [L(input.id)], result: { kind: 'text', n: a, s: `${(a * 1e6).toFixed(1)} mm²` } },
    { label: 'Litres per metre', formula: 'Area (m²) × 1000', inputs: [], result: V('litres', litresPerMetre) },
    { label: 'Water in the pipe', formula: 'Litres per metre × length (m)', inputs: [V('litres', litresPerMetre), L(input.length)], result: V('litres', litres) },
  ];
  // 1 litre of water ≈ 1 kg (at about 4–20 °C, within 0.2 %).
  return { ok: true, value: { litres, litresPerMetre, kg: litres }, steps, warnings: [] };
}

export interface FlowInput {
  id: number;
  /** Flow in litres per minute (give this or velocity). */
  lpm?: number;
  /** Velocity in m/s. */
  velocity?: number;
  /** Optional: length and Hazen–Williams C for friction loss. */
  length?: number;
  c?: number;
  /** Max cold-water velocity for the person's country, m/s, and the code that sets it (null = no verified limit). */
  limit?: { max: number; code: string } | null;
}

export interface FlowResult {
  lpm: number;
  lps: number;
  velocity: number;
  headLoss?: number;
  kpa?: number;
  kpaPer100m?: number;
}

export function flow(input: FlowInput): CalcResult<FlowResult> {
  if (!isPos(input.id)) return fail('Choose a pipe or enter the inside diameter', 'id');
  const a = area(input.id);
  const steps: Step[] = [{ label: 'Bore area', formula: 'π ÷ 4 × ID²', inputs: [L(input.id)], result: { kind: 'text', n: a, s: `${(a * 1e6).toFixed(1)} mm²` } }];
  let q: number; // m³/s
  let v: number;
  if (input.lpm !== undefined) {
    if (!isPos(input.lpm)) return fail('Enter the flow (more than 0)', 'lpm');
    q = input.lpm / 60000;
    v = q / a;
    steps.push({ label: 'Velocity', formula: 'Flow ÷ area', inputs: [V('flow', input.lpm)], result: V('velocity', v) });
  } else if (input.velocity !== undefined) {
    if (!isPos(input.velocity)) return fail('Enter the velocity (more than 0)', 'velocity');
    v = input.velocity;
    q = v * a;
    steps.push({ label: 'Flow', formula: 'Velocity × area', inputs: [V('velocity', v)], result: V('flow', q * 60000) });
  } else {
    return fail('Enter a flow or a velocity', 'lpm');
  }
  const value: FlowResult = { lpm: q * 60000, lps: q * 1000, velocity: v };
  const warnings: string[] = [];
  if (input.limit && v > input.limit.max) {
    warnings.push(`Over ${input.limit.max} m/s: faster than ${input.limit.code} allows for cold water. Expect noise and water hammer; go up a size.`);
  } else if (!input.limit && v > 3) {
    warnings.push('Over 3 m/s: fast for a water service. Expect noise and water hammer; check your local code and consider going up a size.');
  }
  if (input.length !== undefined || input.c !== undefined) {
    if (!isPos(input.length)) return fail('Enter the pipe length for the pressure loss', 'length');
    if (!isPos(input.c) || input.c > 200) return fail('Hazen–Williams C must be between 1 and 200', 'c');
    const d = input.id / 1000;
    const len = input.length / 1000;
    const hf = (10.67 * len * Math.pow(q, 1.852)) / (Math.pow(input.c, 1.852) * Math.pow(d, 4.871));
    value.headLoss = hf;
    value.kpa = hf * KPA_PER_M_HEAD;
    value.kpaPer100m = (value.kpa / len) * 100;
    steps.push({ label: 'Friction loss (head)', formula: '10.67 × L × Q^1.852 ÷ (C^1.852 × d^4.871)', inputs: [L(input.length), V('flow', q * 60000), V('factor', input.c), L(input.id)], result: V('head', hf) });
    steps.push({ label: 'Pressure loss', formula: 'Head × 9.807 kPa/m', inputs: [V('head', hf)], result: V('pressure', value.kpa) });
    warnings.push('Hazen–Williams is an estimate for straight pipe only. Add fittings and valves (equivalent lengths) from the manufacturer’s data.');
  }
  return { ok: true, value, steps, warnings };
}
