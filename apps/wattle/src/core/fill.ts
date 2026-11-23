/**
 * Conduit fill: how much of the conduit's inside cross-section the cables take up.
 *
 *   fill % = Σ (n × π d² ÷ 4) ÷ (π D² ÷ 4) × 100 = Σ (n × d²) ÷ D² × 100
 *   d = cable overall diameter, D = conduit inside diameter (same unit).
 *
 * Guide limits: 53 % for one cable, 31 % for two, 40 % for three or more. These are the percentages in
 * NFPA 70 (NEC) Chapter 9 Table 1, widely used as a general guide. AS/NZS 3000 Appendix C sets out the
 * Australian/NZ approach for the maximum number of cables in conduit; check it for compliance.
 * The jam-ratio check (D ÷ d between 2.8 and 3.2 with three cables of one size) follows the NEC Chapter 9
 * informative note on jamming during pulling.
 *
 * Conduit and cable dimensions differ between makers: the presets below are typical starting values only
 * and every one is editable. Use the inside diameter and cable diameter from the manufacturer's data.
 */
import { fail, fmt, positive, type CalcResult } from './num.ts';

export interface ConduitPreset { id: string; label: string; idMm: number }
export interface CablePreset { id: string; label: string; odMm: number }

/** Rigid PVC conduit (AS/NZS 2053), nominal size = outside diameter. Inside diameters are approximate. */
export const CONDUITS: ConduitPreset[] = [
  { id: 'pvc16', label: '16 mm PVC', idMm: 13.0 },
  { id: 'pvc20', label: '20 mm PVC', idMm: 16.9 },
  { id: 'pvc25', label: '25 mm PVC', idMm: 21.4 },
  { id: 'pvc32', label: '32 mm PVC', idMm: 27.8 },
  { id: 'pvc40', label: '40 mm PVC', idMm: 35.4 },
  { id: 'pvc50', label: '50 mm PVC', idMm: 44.6 },
  { id: 'pvc63', label: '63 mm PVC', idMm: 57.0 },
  { id: 'pvc80', label: '80 mm PVC', idMm: 72.0 },
  { id: 'pvc100', label: '100 mm PVC', idMm: 93.0 },
];

/** Typical overall diameters. Always check the cable's datasheet. */
export const CABLES: CablePreset[] = [
  { id: 'v1.5', label: '1.5 mm² single (V-90)', odMm: 3.0 },
  { id: 'v2.5', label: '2.5 mm² single (V-90)', odMm: 3.6 },
  { id: 'v4', label: '4 mm² single (V-90)', odMm: 4.3 },
  { id: 'v6', label: '6 mm² single (V-90)', odMm: 4.9 },
  { id: 'v10', label: '10 mm² single (V-90)', odMm: 6.2 },
  { id: 'v16', label: '16 mm² single (V-90)', odMm: 7.3 },
  { id: 'cat6', label: 'Cat6 data', odMm: 6.2 },
  { id: 'cat6a', label: 'Cat6A data', odMm: 7.5 },
  { id: 'rg6', label: 'RG6 coax', odMm: 6.9 },
];

export interface FillLine { label?: string; od: number | null; qty: number | null }

export interface FillOut {
  fillPct: number;
  limitPct: number;
  pass: boolean;
  count: number;
  cableArea: number;
  conduitArea: number;
  /** For a single cable type: how many fit inside the limit. */
  maxSame?: number;
  jamRisk: boolean;
}

/** Guide limit for a number of cables (NEC Ch. 9 Table 1 percentages). */
export function fillLimit(count: number): number {
  return count <= 1 ? 53 : count === 2 ? 31 : 40;
}

export function conduitFill(input: { conduitId: number | null; lines: FillLine[]; limitPct?: number | null }): CalcResult<FillOut> {
  const D = input.conduitId;
  if (!positive(D)) return fail('Enter the conduit inside diameter, more than 0.');
  const lines = input.lines.filter(l => l.qty != null && l.qty !== 0);
  if (!lines.length) return fail('Add at least one cable.');
  for (const l of lines) {
    if (!positive(l.od)) return fail('Each cable needs a diameter more than 0.');
    if (!(typeof l.qty === 'number' && Number.isInteger(l.qty) && l.qty > 0)) return fail('Cable counts must be whole numbers, 1 or more.');
    if (l.od >= D) return fail(`A ${fmt(l.od, 1)} mm cable will not fit a ${fmt(D, 1)} mm inside diameter.`);
  }
  const count = lines.reduce((a, l) => a + (l.qty as number), 0);
  const cableArea = lines.reduce((a, l) => a + (l.qty as number) * Math.PI * (l.od as number) ** 2 / 4, 0);
  const conduitArea = Math.PI * D * D / 4;
  const fillPct = (cableArea / conduitArea) * 100;
  const limitPct = input.limitPct ?? fillLimit(count);
  if (!positive(limitPct) || limitPct > 100) return fail('Fill limit must be between 0 and 100 %.');
  const steps = [
    `Conduit area = π × ${fmt(D, 1)}² ÷ 4 = ${fmt(conduitArea, 1)} mm²`,
    ...lines.map(l => `${l.qty} × π × ${fmt(l.od as number, 1)}² ÷ 4 = ${fmt((l.qty as number) * Math.PI * (l.od as number) ** 2 / 4, 1)} mm²${l.label ? ` (${l.label})` : ''}`),
    `Fill = ${fmt(cableArea, 1)} ÷ ${fmt(conduitArea, 1)} × 100 = ${fmt(fillPct, 1)} %  (guide limit for ${count} cable${count === 1 ? '' : 's'}: ${fmt(limitPct, 0)} %)`,
  ];
  const value: FillOut = { fillPct, limitPct, pass: fillPct <= limitPct, count, cableArea, conduitArea, jamRisk: false };
  const warnings: string[] = [];
  const first = lines[0]!;
  if (lines.length === 1) {
    const d = first.od as number;
    // Largest n with n·d² ≤ limit·D², using the limit that applies to that many cables.
    let n = 0;
    for (let k = 1; k <= 10_000; k++) {
      if ((k * d * d) / (D * D) * 100 <= (input.limitPct ?? fillLimit(k))) n = k;
      else if (k >= 3) break;
    }
    value.maxSame = n;
    steps.push(`Most of this cable inside the guide limit: ${n}`);
    const ratio = D / d;
    if (first.qty === 3 && ratio >= 2.8 && ratio <= 3.2) {
      value.jamRisk = true;
      warnings.push(`Jam ratio ${fmt(ratio, 2)} (between 2.8 and 3.2): three cables can jam on a bend while pulling.`);
    }
  }
  if (fillPct > 100) warnings.push('More cable than conduit: this cannot fit.');
  return { ok: true, value, steps, warnings };
}
