/**
 * Ohm's law, power, and the single-/three-phase power triangle.
 *
 *   V = I × R,   P = V × I = I² R = V² ÷ R                         (DC or resistive AC)
 *   Single-phase AC:  S = V × I,          P = S × pf,  Q = S × sin φ
 *   Three-phase AC (balanced, line values):  S = √3 × V_L × I_L,  P = S × pf,  Q = S × sin φ
 *   pf = cos φ,  S² = P² + Q²
 * Sources: any electrical principles text, e.g. Hughes "Electrical and Electronic Technology" (Pearson),
 * chapters on DC circuits and three-phase systems; IEC 60050-131/-141 definitions of active, reactive and
 * apparent power.
 */
import { fail, fmtSig, positive, type CalcResult } from './num.ts';

export type OhmKey = 'V' | 'I' | 'R' | 'P';
export type OhmValues = Record<OhmKey, number>;
export const OHM_UNITS: Record<OhmKey, string> = { V: 'V', I: 'A', R: 'Ω', P: 'W' };

/** Give exactly two of V, I, R, P (all > 0) and get all four. */
export function ohm(input: Partial<Record<OhmKey, number | null>>): CalcResult<OhmValues> {
  const known = (Object.keys(OHM_UNITS) as OhmKey[]).filter(k => input[k] != null);
  if (known.length !== 2) return fail('Fill in exactly two of volts, amps, ohms and watts.');
  for (const k of known) if (!positive(input[k])) return fail('Values must be more than 0.');
  const g = (k: OhmKey) => input[k] as number;
  const has = (a: OhmKey, b: OhmKey) => known.includes(a) && known.includes(b);
  let V: number, I: number, R: number, P: number;
  const steps: string[] = [];
  const f = fmtSig;
  if (has('V', 'I')) { V = g('V'); I = g('I'); R = V / I; P = V * I; steps.push(`R = V ÷ I = ${f(V)} ÷ ${f(I)} = ${f(R)} Ω`, `P = V × I = ${f(P)} W`); }
  else if (has('V', 'R')) { V = g('V'); R = g('R'); I = V / R; P = V * V / R; steps.push(`I = V ÷ R = ${f(V)} ÷ ${f(R)} = ${f(I)} A`, `P = V² ÷ R = ${f(P)} W`); }
  else if (has('V', 'P')) { V = g('V'); P = g('P'); I = P / V; R = V * V / P; steps.push(`I = P ÷ V = ${f(P)} ÷ ${f(V)} = ${f(I)} A`, `R = V² ÷ P = ${f(R)} Ω`); }
  else if (has('I', 'R')) { I = g('I'); R = g('R'); V = I * R; P = I * I * R; steps.push(`V = I × R = ${f(I)} × ${f(R)} = ${f(V)} V`, `P = I² × R = ${f(P)} W`); }
  else if (has('I', 'P')) { I = g('I'); P = g('P'); V = P / I; R = P / (I * I); steps.push(`V = P ÷ I = ${f(P)} ÷ ${f(I)} = ${f(V)} V`, `R = P ÷ I² = ${f(R)} Ω`); }
  else { R = g('R'); P = g('P'); I = Math.sqrt(P / R); V = Math.sqrt(P * R); steps.push(`I = √(P ÷ R) = √(${f(P)} ÷ ${f(R)}) = ${f(I)} A`, `V = √(P × R) = ${f(V)} V`); }
  return { ok: true, value: { V, I, R, P }, steps, warnings: [] };
}

export type Supply = 'single' | 'three';

export interface PowerOut { V: number; I: number; pf: number; S: number; P: number; Q: number; angleDeg: number }

/**
 * Power triangle. Give voltage, power factor and ONE of: current (A), real power (kW) or apparent power (kVA).
 * Voltage is line-to-line for three-phase.
 */
export function powerTriangle(input: { supply: Supply; voltage: number | null; pf: number | null; current?: number | null; kw?: number | null; kva?: number | null }): CalcResult<PowerOut> {
  const { supply, voltage: V } = input;
  const pf = input.pf ?? 1;
  if (!positive(V)) return fail('Enter the supply voltage, more than 0.');
  if (!(pf > 0 && pf <= 1)) return fail('Power factor must be more than 0 and at most 1.');
  const given = (['current', 'kw', 'kva'] as const).filter(k => input[k] != null);
  if (given.length !== 1) return fail('Enter one of: current, kW or kVA.');
  const k = supply === 'three' ? Math.sqrt(3) : 1;
  const kLabel = supply === 'three' ? '√3 × ' : '';
  const sin = Math.sqrt(1 - pf * pf);
  let I: number, S: number;
  const steps: string[] = [];
  if (given[0] === 'current') {
    if (!positive(input.current)) return fail('Current must be more than 0.');
    I = input.current; S = k * V * I;
    steps.push(`S = ${kLabel}V × I = ${kLabel}${fmtSig(V)} × ${fmtSig(I)} = ${fmtSig(S / 1000)} kVA`);
  } else if (given[0] === 'kw') {
    if (!positive(input.kw)) return fail('kW must be more than 0.');
    S = (input.kw * 1000) / pf; I = S / (k * V);
    steps.push(`S = P ÷ pf = ${fmtSig(input.kw)} ÷ ${fmtSig(pf)} = ${fmtSig(S / 1000)} kVA`, `I = S ÷ (${kLabel}V) = ${fmtSig(I)} A`);
  } else {
    if (!positive(input.kva)) return fail('kVA must be more than 0.');
    S = input.kva * 1000; I = S / (k * V);
    steps.push(`I = S ÷ (${kLabel}V) = ${fmtSig(S)} ÷ (${kLabel}${fmtSig(V)}) = ${fmtSig(I)} A`);
  }
  const P = S * pf;
  const Q = S * sin;
  const angleDeg = (Math.acos(pf) * 180) / Math.PI;
  steps.push(`P = S × pf = ${fmtSig(P / 1000)} kW`, `Q = S × sin φ = ${fmtSig(Q / 1000)} kvar  (φ = ${angleDeg.toFixed(1)}°)`);
  const warnings: string[] = [];
  if (pf < 0.5) warnings.push('A power factor under 0.5 is unusual. Check the value.');
  return { ok: true, value: { V, I, pf, S, P, Q, angleDeg }, steps, warnings };
}
