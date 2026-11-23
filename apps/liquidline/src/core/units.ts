// Unit conversions for Liquidline. Pure TypeScript, no React Native (unit-tested in units.test.ts).
// Internal units: pressure kPa (absolute unless a name says gauge), temperature °C, length m, mass g, power W.

export type PressureUnit = 'kPa' | 'bar' | 'psi' | 'MPa';
export type TempUnit = 'C' | 'F';
export type LengthUnit = 'm' | 'ft';
export type MassUnit = 'g' | 'oz';
export type VacuumUnit = 'micron' | 'Pa' | 'mbar' | 'Torr';

export const STD_ATM_KPA = 101.325;
const PSI_KPA = 6.894757293168361;
const FT_M = 0.3048;
const OZ_G = 28.349523125;
const BTUH_W = 0.29307107017;

export function pressureFromKpa(kpa: number, u: PressureUnit): number {
  switch (u) {
    case 'kPa': return kpa;
    case 'bar': return kpa / 100;
    case 'MPa': return kpa / 1000;
    case 'psi': return kpa / PSI_KPA;
  }
}
export function pressureToKpa(v: number, u: PressureUnit): number {
  switch (u) {
    case 'kPa': return v;
    case 'bar': return v * 100;
    case 'MPa': return v * 1000;
    case 'psi': return v * PSI_KPA;
  }
}
/** Gauge reading (in u) to kPa absolute, with the local atmosphere in kPa. */
export function gaugeToAbsKpa(gauge: number, u: PressureUnit, atmKpa = STD_ATM_KPA): number {
  return pressureToKpa(gauge, u) + atmKpa;
}
export function absKpaToGauge(absKpa: number, u: PressureUnit, atmKpa = STD_ATM_KPA): number {
  return pressureFromKpa(absKpa - atmKpa, u);
}

export const cToF = (c: number) => (c * 9) / 5 + 32;
export const fToC = (f: number) => ((f - 32) * 5) / 9;
export const tempFromC = (c: number, u: TempUnit) => (u === 'C' ? c : cToF(c));
export const tempToC = (v: number, u: TempUnit) => (u === 'C' ? v : fToC(v));
/** A temperature DIFFERENCE (superheat, subcooling, glide): K and °F differ by 9/5 with no offset. */
export const deltaFromK = (k: number, u: TempUnit) => (u === 'C' ? k : (k * 9) / 5);
export const deltaToK = (v: number, u: TempUnit) => (u === 'C' ? v : (v * 5) / 9);

export const lengthFromM = (m: number, u: LengthUnit) => (u === 'm' ? m : m / FT_M);
export const lengthToM = (v: number, u: LengthUnit) => (u === 'm' ? v : v * FT_M);
export const massFromG = (g: number, u: MassUnit) => (u === 'g' ? g : g / OZ_G);
export const massToG = (v: number, u: MassUnit) => (u === 'g' ? v : v * OZ_G);
/** Charge rate g/m <-> oz/ft. */
export const rateFromGPerM = (gpm: number, u: MassUnit) => (u === 'g' ? gpm : (gpm * FT_M) / OZ_G);
export const rateToGPerM = (v: number, u: MassUnit) => (u === 'g' ? v : (v * OZ_G) / FT_M);

export const wToBtuh = (w: number) => w / BTUH_W;
export const btuhToW = (b: number) => b * BTUH_W;
/** 1 ton of refrigeration = 12 000 BTU/h = 3.51685 kW. */
export const wToTons = (w: number) => wToBtuh(w) / 12000;

/** Vacuum: 1 micron (of mercury) = 1 mTorr = 0.133322 Pa. */
const MICRON_PA = 0.133322368;
export function vacuumToPa(v: number, u: VacuumUnit): number {
  switch (u) {
    case 'Pa': return v;
    case 'micron': return v * MICRON_PA;
    case 'Torr': return v * MICRON_PA * 1000;
    case 'mbar': return v * 100;
  }
}
export function vacuumFromPa(pa: number, u: VacuumUnit): number {
  switch (u) {
    case 'Pa': return pa;
    case 'micron': return pa / MICRON_PA;
    case 'Torr': return pa / (MICRON_PA * 1000);
    case 'mbar': return pa / 100;
  }
}

/** Standard-atmosphere pressure at an altitude (m), ISA barometric formula, kPa. */
export function atmAtAltitude(m: number): number {
  if (!Number.isFinite(m)) return STD_ATM_KPA;
  const h = Math.max(-500, Math.min(6000, m));
  return STD_ATM_KPA * Math.pow(1 - 2.25577e-5 * h, 5.25588);
}

export const PRESSURE_LABEL: Record<PressureUnit, string> = { kPa: 'kPa', bar: 'bar', psi: 'psi', MPa: 'MPa' };
export const TEMP_LABEL: Record<TempUnit, string> = { C: '°C', F: '°F' };
export const DELTA_LABEL: Record<TempUnit, string> = { C: 'K', F: '°F' };
export const LENGTH_LABEL: Record<LengthUnit, string> = { m: 'm', ft: 'ft' };
export const MASS_LABEL: Record<MassUnit, string> = { g: 'g', oz: 'oz' };
export const RATE_LABEL: Record<MassUnit, string> = { g: 'g/m', oz: 'oz/ft' };
export const VACUUM_LABEL: Record<VacuumUnit, string> = { micron: 'micron', Pa: 'Pa', mbar: 'mbar', Torr: 'Torr' };

/** Sensible decimals for showing a pressure in a unit. */
export function pressureDecimals(u: PressureUnit): number {
  return u === 'kPa' ? 0 : u === 'psi' ? 1 : u === 'bar' ? 2 : 3;
}

/** Parses a typed number: accepts a comma decimal ("4,5"), a leading minus, spaces. NaN when empty or invalid. */
export function parseNum(s: string | null | undefined): number {
  if (s == null) return NaN;
  const t = String(s).trim().replace(/\s+/g, '').replace(',', '.');
  if (!t || !/^[-+]?(\d+\.?\d*|\.\d+)$/.test(t)) return NaN;
  return Number(t);
}

export function fmt(n: number, decimals: number): string {
  if (!Number.isFinite(n)) return '–';
  const v = Number(n.toFixed(decimals));
  return (Object.is(v, -0) ? 0 : v).toFixed(decimals);
}
