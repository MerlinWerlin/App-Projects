/**
 * Flow display units. Exact definitions: 1 US gallon = 231 in³ = 3.785411784 L; 1 ft = 0.3048 m;
 * 1 psi = 6.894757293 kPa (NIST SP 811 Appendix B). Calculations stay in SI; only display and input convert.
 */
import type { UnitSystem } from './units';

export const L_PER_US_GAL = 3.785411784;
export const M_PER_FT = 0.3048;
export const KPA_PER_PSI = 6.894757293168;

export interface FlowUnits { vol: string; flow: string; vel: string; pressure: string; perLength: string }

export const flowUnits = (u: UnitSystem): FlowUnits =>
  u === 'imperial'
    ? { vol: 'gal', flow: 'gpm', vel: 'ft/s', pressure: 'psi', perLength: 'per ft' }
    : { vol: 'L', flow: 'L/min', vel: 'm/s', pressure: 'kPa', perLength: 'per metre' };

/** SI -> display */
export const showVol = (litres: number, u: UnitSystem) => (u === 'imperial' ? litres / L_PER_US_GAL : litres);
export const showFlow = (lpm: number, u: UnitSystem) => (u === 'imperial' ? lpm / L_PER_US_GAL : lpm);
export const showVel = (ms: number, u: UnitSystem) => (u === 'imperial' ? ms / M_PER_FT : ms);
export const showPressure = (kpa: number, u: UnitSystem) => (u === 'imperial' ? kpa / KPA_PER_PSI : kpa);
/** litres per metre -> gallons per foot */
export const showPerLength = (lpm_: number, u: UnitSystem) => (u === 'imperial' ? (lpm_ / L_PER_US_GAL) * M_PER_FT : lpm_);

/** display input -> SI */
export const inFlow = (v: number, u: UnitSystem) => (u === 'imperial' ? v * L_PER_US_GAL : v);
export const inVel = (v: number, u: UnitSystem) => (u === 'imperial' ? v * M_PER_FT : v);
