/**
 * Quick unit converter for the trade.
 * Sources:
 *   - AWG diameter: ASTM B258, d(mm) = 0.127 × 92^((36 − n) ÷ 39); AWG 0 = "1/0" (n = 0), 2/0 = −1, 3/0 = −2, 4/0 = −3.
 *   - 1 in = 25.4 mm and 1 ft = 0.3048 m exactly (International yard and pound agreement, 1959).
 *   - 1 mechanical horsepower = 745.699 872 W (550 ft·lbf/s); 1 metric horsepower (PS) = 735.498 75 W.
 *   - °F = °C × 9/5 + 32.
 *   - Current from kVA: I = S ÷ V (single-phase) or S ÷ (√3 × V_L) (three-phase).
 */
import { fail, positive, type CalcResult } from './num.ts';

export function awgDiameterMm(n: number): number {
  return 0.127 * 92 ** ((36 - n) / 39);
}
export function awgAreaMm2(n: number): number {
  const d = awgDiameterMm(n);
  return (Math.PI * d * d) / 4;
}
/** AWG gauge number (fractional) for an area in mm². */
export function mm2ToAwgExact(areaMm2: number): number {
  const d = Math.sqrt((4 * areaMm2) / Math.PI);
  return 36 - 39 * (Math.log(d / 0.127) / Math.log(92));
}
export function awgLabel(n: number): string {
  return n <= 0 ? `${1 - n}/0` : `${n}`;
}

export interface AwgOut { nearest: number; nearestLabel: string; nearestArea: number; exact: number }

/** Nearest whole AWG (4/0 … 40) to a metric size. */
export function mm2ToAwg(areaMm2: number | null): CalcResult<AwgOut> {
  if (!positive(areaMm2)) return fail('Enter a size in mm², more than 0.');
  const exact = mm2ToAwgExact(areaMm2);
  const nearest = Math.min(40, Math.max(-3, Math.round(exact)));
  const nearestArea = awgAreaMm2(nearest);
  const warnings = exact < -3.5 ? ['Bigger than 4/0 AWG: American sizes go to kcmil (1 kcmil = 0.5067 mm²).'] : [];
  return {
    ok: true,
    value: { nearest, nearestLabel: awgLabel(nearest), nearestArea, exact },
    steps: [
      `Diameter = √(4 × ${areaMm2} ÷ π) = ${Math.sqrt((4 * areaMm2) / Math.PI).toFixed(3)} mm`,
      `AWG = 36 − 39 × log₉₂(d ÷ 0.127) = ${exact.toFixed(2)} → ${awgLabel(nearest)} AWG (${nearestArea.toFixed(2)} mm²)`,
    ],
    warnings,
  };
}

export type QuantityId = 'length' | 'shortLength' | 'power' | 'temp' | 'area';
export interface UnitDef { id: string; label: string; toBase: (x: number) => number; fromBase: (x: number) => number }
export interface Quantity { id: QuantityId; label: string; units: UnitDef[] }

const lin = (id: string, label: string, factor: number): UnitDef => ({ id, label, toBase: x => x * factor, fromBase: x => x / factor });

export const QUANTITIES: Quantity[] = [
  { id: 'length', label: 'Length', units: [lin('m', 'm', 1), lin('ft', 'ft', 0.3048), lin('km', 'km', 1000), lin('yd', 'yd', 0.9144)] },
  { id: 'shortLength', label: 'Short length', units: [lin('mm', 'mm', 1), lin('in', 'in', 25.4), lin('cm', 'cm', 10)] },
  { id: 'power', label: 'Power', units: [lin('kW', 'kW', 1000), lin('hp', 'hp', 745.699872), lin('PS', 'metric hp', 735.49875), lin('W', 'W', 1)] },
  { id: 'temp', label: 'Temperature', units: [
    { id: 'C', label: '°C', toBase: x => x, fromBase: x => x },
    { id: 'F', label: '°F', toBase: x => ((x - 32) * 5) / 9, fromBase: x => (x * 9) / 5 + 32 },
  ] },
  { id: 'area', label: 'Area', units: [lin('mm2', 'mm²', 1), lin('kcmil', 'kcmil', 0.506707479), lin('in2', 'in²', 645.16)] },
];

export function convert(q: QuantityId, from: string, to: string, value: number | null): number | null {
  const quantity = QUANTITIES.find(x => x.id === q);
  const a = quantity?.units.find(u => u.id === from);
  const b = quantity?.units.find(u => u.id === to);
  if (!a || !b || value == null || !Number.isFinite(value)) return null;
  if (q === 'temp' && a.toBase(value) < -273.15) return null; // below absolute zero
  if (q !== 'temp' && value < 0) return null;
  return b.fromBase(a.toBase(value));
}

/** kVA ↔ amps. */
export function kvaToAmps(kva: number, volts: number, phase: 'single' | 'three'): number {
  return (kva * 1000) / ((phase === 'three' ? Math.sqrt(3) : 1) * volts);
}
export function ampsToKva(amps: number, volts: number, phase: 'single' | 'three'): number {
  return (amps * (phase === 'three' ? Math.sqrt(3) : 1) * volts) / 1000;
}
