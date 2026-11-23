/**
 * Sheet and plate bending: bend allowance, outside setback and bend deduction.
 *
 *   BA   = (π / 180) · A · (R + K · T)        bend allowance, length of the neutral axis through the bend
 *   OSSB = tan(A / 2) · (R + T)              outside setback (A ≤ 180°)
 *   BD   = 2 · OSSB − BA                     bend deduction
 *   Flat blank = Σ outside flange lengths − Σ BD
 * where A = bend angle (how far the flange is bent from flat: 90° for a right-angle bend), R = inside radius,
 * T = thickness, K = K-factor (neutral axis position / T).
 * Sources: Machinery's Handbook, 31st ed., "Bending allowances for sheet metal"; ASM Handbook vol. 14B,
 * "Press-brake forming".
 *
 * K-factor rule of thumb when the shop's own value is unknown (air bending, mild steel):
 *   R < T: 0.33   T ≤ R ≤ 3T: 0.40   R > 3T: 0.50  — widely published press-brake guidance (e.g. Machinery's
 *   Handbook table of K values). Every brake, tool and material differs: a test bend gives the true value.
 */
import { DEG, fail, fmt, positive, type Result, type Step } from './units.ts';

export function defaultK(radius: number, thickness: number): number {
  if (radius < thickness) return 0.33;
  if (radius <= 3 * thickness) return 0.4;
  return 0.5;
}

export interface BendInput {
  thickness: number;
  radius: number; // inside radius, ≥ 0
  angleDeg: number; // bend angle from flat, 0 < A ≤ 180
  k: number;
  /** Outside flange lengths (mold-line to edge), one more than the number of bends. Optional. */
  flanges?: number[];
}

export interface BendResult {
  ba: number;
  ossb: number;
  bd: number;
  flat?: number;
}

export function bend(i: BendInput): Result<BendResult> {
  const bad = positive('thickness', i.thickness);
  if (bad) return fail(bad);
  if (!Number.isFinite(i.radius) || i.radius < 0) return fail('Inside radius cannot be negative.');
  if (!Number.isFinite(i.angleDeg) || i.angleDeg <= 0 || i.angleDeg > 180) return fail('Bend angle must be more than 0° and no more than 180°.');
  if (!Number.isFinite(i.k) || i.k < 0 || i.k > 0.5) return fail('K-factor must be from 0 to 0.5.');
  if (i.angleDeg === 180 && i.flanges) return fail('A 180° hem has no outside setback; work out a hem from the flat length instead.');
  const A = i.angleDeg * DEG;
  const ba = A * (i.radius + i.k * i.thickness);
  const ossb = i.angleDeg === 180 ? NaN : Math.tan(A / 2) * (i.radius + i.thickness);
  const bd = 2 * ossb - ba;
  const steps: Step[] = [
    { label: 'Bend allowance', formula: 'BA = π/180 × A × (R + K × T)', value: `π/180 × ${fmt(i.angleDeg, 1)} × (${fmt(i.radius, 2)} + ${fmt(i.k, 2)} × ${fmt(i.thickness, 2)}) = ${fmt(ba, 2)} mm` },
    { label: 'Outside setback', formula: 'OSSB = tan(A/2) × (R + T)', value: Number.isFinite(ossb) ? `tan(${fmt(i.angleDeg / 2, 1)}°) × (${fmt(i.radius, 2)} + ${fmt(i.thickness, 2)}) = ${fmt(ossb, 2)} mm` : '– (180°)' },
    { label: 'Bend deduction', formula: 'BD = 2 × OSSB − BA', value: Number.isFinite(bd) ? `${fmt(bd, 2)} mm` : '–' },
  ];
  const value: BendResult = { ba, ossb, bd };
  if (i.flanges && i.flanges.length) {
    if (i.flanges.length < 2) return fail('Enter at least two flange lengths (one bend).');
    for (const f of i.flanges) if (!Number.isFinite(f) || f <= 0) return fail('Every flange length must be more than 0.');
    for (const f of i.flanges) if (f < ossb) return fail(`Each outside flange must be longer than the setback (${fmt(ossb, 1)} mm).`);
    const bends = i.flanges.length - 1;
    const sum = i.flanges.reduce((a, b) => a + b, 0);
    value.flat = sum - bends * bd;
    steps.push({ label: 'Flat blank', formula: 'Σ outside lengths − bends × BD', value: `${fmt(sum, 1)} − ${bends} × ${fmt(bd, 2)} = ${fmt(value.flat, 1)} mm` });
  }
  const warnings: string[] = [];
  if (i.radius < i.thickness * 0.5 && i.thickness > 3) warnings.push('Tight radius for this thickness: check the minimum bend radius for the grade so it does not crack.');
  return { ok: true, value, steps, warnings };
}
