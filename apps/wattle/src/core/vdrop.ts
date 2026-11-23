/**
 * Voltage drop over a cable run. Two methods:
 *
 * 1. mV/A·m (the method AS/NZS 3008.1.1 uses): the person enters the cable's voltage drop per amp per metre
 *    from AS/NZS 3008 or the cable maker's data, for the right circuit type (single-phase or three-phase).
 *      Vd = Vc × I × L ÷ 1000            (Vc in mV/A·m, I in A, L = route length in m)
 *    No AS/NZS 3008 table values are stored in this app.
 *
 * 2. Physics estimate from conductor resistance:
 *      R(T) = ρ20 × (1 + α20 × (T − 20)) ÷ A        (Ω/m, A in mm²)
 *      single-phase:  Vd = 2 × I × L × (R cos φ + X sin φ)          (out and back)
 *      three-phase:   Vd = √3 × I × L × (R cos φ + X sin φ)         (line-to-line, balanced load)
 *    Sources: resistivity and temperature coefficient of annealed copper, IEC 60028 (ρ20 = 1/58 Ω·mm²/m,
 *    α20 = 0.00393 /K); hard-drawn aluminium for conductors, IEC 60889 (ρ20 = 0.028264 Ω·mm²/m, α20 = 0.00403 /K).
 *    The voltage-drop expressions are the standard ones in IEC 60364-5-52 Annex G and electrical engineering texts.
 *    Stranded conductors measure higher than the solid-metal value (stranding lay and area tolerance), so by
 *    default the app uses an effective ρ20 that matches the maximum DC resistance permitted for class 2 stranded
 *    conductors in IEC 60228 (about 7 % above pure copper, 8 % above aluminium): it errs towards a higher drop.
 *    Reactance X defaults to 0, which is fine for small cables; for 16 mm² and up enter X from the cable data.
 *
 * Limit: AS/NZS 3000 clause 3.6.2 limits the drop from the point of supply to any point in the installation to
 * 5 % of nominal voltage (230 V single-phase, 400 V three-phase per AS 60038). The limit is editable because the
 * budget for one circuit is usually less than the whole 5 % (the mains and submains use part of it).
 *
 * Every result is an estimate and does not replace AS/NZS 3000/3008, the manufacturer's data or a qualified design.
 */
import { fail, fmt, positive, type CalcResult } from './num.ts';

export type Phase = 'single' | 'three';
export type Metal = 'cu' | 'al';

export const NOMINAL_V: Record<Phase, number> = { single: 230, three: 400 };
export const DEFAULT_LIMIT_PCT = 5;

/** Nominal conductor sizes (mm²) used for "smallest size that passes". */
export const SIZES_MM2 = [1, 1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300, 400, 500, 630] as const;

export const METALS: Record<Metal, { label: string; rho20Pure: number; rho20Stranded: number; alpha20: number }> = {
  // IEC 60028: 1/58 Ω·mm²/m. Stranded effective value ≈ IEC 60228 class 2 max resistance × nominal area.
  cu: { label: 'Copper', rho20Pure: 1 / 58, rho20Stranded: 0.0184, alpha20: 0.00393 },
  // IEC 60889: 0.028264 Ω·mm²/m.
  al: { label: 'Aluminium', rho20Pure: 0.028264, rho20Stranded: 0.0305, alpha20: 0.00403 },
};

/** Resistance per metre (Ω/m) of one conductor at temperature T (°C). */
export function resistancePerM(metal: Metal, areaMm2: number, tempC: number, stranded = true): number {
  const m = METALS[metal];
  const rho = stranded ? m.rho20Stranded : m.rho20Pure;
  return (rho * (1 + m.alpha20 * (tempC - 20))) / areaMm2;
}

/** Circuit factor: 2 for single-phase (active + neutral), √3 for balanced three-phase line-to-line. */
export function phaseFactor(phase: Phase): number {
  return phase === 'single' ? 2 : Math.sqrt(3);
}

export interface VdOut {
  vd: number;
  pct: number;
  /** Voltage left at the load. */
  vEnd: number;
  pass: boolean;
  limitPct: number;
  /** Longest run (m) that stays inside the limit at this current. */
  maxLength: number;
  /** Equivalent mV/A·m (physics method shows this so it can be compared with tables). */
  mvPerAm: number;
  /** Physics method: smallest nominal size that passes, or null if none in the list does. */
  minSize?: number | null;
}

interface Common { current: number | null; length: number | null; phase: Phase; voltage?: number | null; limitPct?: number | null }

function common(c: Common): { ok: true; I: number; L: number; V: number; lim: number } | { ok: false; error: string } {
  if (!positive(c.current)) return fail('Enter the load current in amps, more than 0.');
  if (!positive(c.length)) return fail('Enter the route length in metres, more than 0.');
  const V = c.voltage ?? NOMINAL_V[c.phase];
  if (!positive(V)) return fail('Nominal voltage must be more than 0.');
  const lim = c.limitPct ?? DEFAULT_LIMIT_PCT;
  if (!positive(lim) || lim >= 100) return fail('Voltage-drop limit must be between 0 and 100 %.');
  if (c.length > 100_000) return fail('That run is longer than 100 km: check the length unit.');
  return { ok: true, I: c.current, L: c.length, V, lim };
}

/** Method 1: user-entered mV/A·m. */
export function vdropMv(input: Common & { mvPerAm: number | null }): CalcResult<VdOut> {
  const c = common(input);
  if (!c.ok) return c;
  if (!positive(input.mvPerAm)) return fail('Enter the cable’s mV/A·m from AS/NZS 3008 or the maker’s data.');
  const { I, L, V, lim } = c;
  const vd = (input.mvPerAm * I * L) / 1000;
  const pct = (vd / V) * 100;
  const maxLength = (lim / 100) * V * 1000 / (input.mvPerAm * I);
  const steps = [
    `Vd = mV/A·m × I × L ÷ 1000 = ${fmt(input.mvPerAm, 3)} × ${fmt(I)} A × ${fmt(L)} m ÷ 1000 = ${fmt(vd)} V`,
    `Drop = ${fmt(vd)} ÷ ${fmt(V)} V × 100 = ${fmt(pct)} %`,
    `Longest run inside ${fmt(lim)} % = ${fmt(lim / 100 * V, 2)} V × 1000 ÷ (${fmt(input.mvPerAm, 3)} × ${fmt(I)} A) = ${fmt(maxLength, 1)} m`,
  ];
  const warnings: string[] = [];
  if (input.mvPerAm > 200) warnings.push('That mV/A·m is unusually high. Check you used the value for this cable size and circuit.');
  return { ok: true, value: { vd, pct, vEnd: V - vd, pass: pct <= lim, limitPct: lim, maxLength, mvPerAm: input.mvPerAm }, steps, warnings };
}

export interface PhysicsIn extends Common {
  metal: Metal;
  area: number | null;
  tempC?: number | null;
  /** Power factor, 0 < pf ≤ 1. Default 1 (resistive). */
  pf?: number | null;
  /** Reactance per conductor, mΩ/m. Default 0. */
  reactance?: number | null;
  /** Use the pure-metal resistivity instead of the stranded (conservative) value. */
  pure?: boolean;
}

function dropFor(metal: Metal, area: number, T: number, pf: number, Xohm: number, phase: Phase, I: number, L: number, pure: boolean) {
  const R = resistancePerM(metal, area, T, !pure);
  const sin = Math.sqrt(Math.max(0, 1 - pf * pf));
  const z = R * pf + Xohm * sin; // Ω/m
  return { R, z, vd: phaseFactor(phase) * I * L * z };
}

/** Method 2: physics estimate from conductor size, material and temperature. */
export function vdropPhysics(input: PhysicsIn): CalcResult<VdOut> {
  const c = common(input);
  if (!c.ok) return c;
  if (!positive(input.area)) return fail('Enter the conductor size in mm², more than 0.');
  const T = input.tempC ?? 75;
  if (!Number.isFinite(T) || T < -40 || T > 250) return fail('Conductor temperature must be between −40 °C and 250 °C.');
  const pf = input.pf ?? 1;
  if (!(pf > 0 && pf <= 1)) return fail('Power factor must be more than 0 and at most 1.');
  const X = input.reactance ?? 0;
  if (!(Number.isFinite(X) && X >= 0)) return fail('Reactance must be 0 or more.');
  const Xohm = X / 1000;
  const { I, L, V, lim } = c;
  const pure = input.pure === true;
  const m = METALS[input.metal];
  const { R, z, vd } = dropFor(input.metal, input.area, T, pf, Xohm, input.phase, I, L, pure);
  const pct = (vd / V) * 100;
  const k = phaseFactor(input.phase);
  const mvPerAm = k * z * 1000;
  const maxLength = (lim / 100) * V / (k * I * z);
  const minSize = SIZES_MM2.find(a => (dropFor(input.metal, a, T, pf, Xohm, input.phase, I, L, pure).vd / V) * 100 <= lim) ?? null;
  const rho = pure ? m.rho20Pure : m.rho20Stranded;
  const steps = [
    `R at ${fmt(T, 0)} °C = ${fmt(rho, 5)} × (1 + ${m.alpha20} × (${fmt(T, 0)} − 20)) ÷ ${fmt(input.area)} mm² = ${fmt(R * 1000, 3)} mΩ/m`,
    pf < 1 || X > 0
      ? `Per metre = R × ${fmt(pf, 2)} + X × ${fmt(Math.sqrt(1 - pf * pf), 2)} = ${fmt(z * 1000, 3)} mΩ/m`
      : 'Power factor 1, no reactance: impedance per metre = R',
    `Vd = ${input.phase === 'single' ? '2' : '√3'} × ${fmt(I)} A × ${fmt(L)} m × ${fmt(z * 1000, 3)} mΩ/m ÷ 1000 = ${fmt(vd)} V`,
    `Drop = ${fmt(vd)} ÷ ${fmt(V)} V × 100 = ${fmt(pct)} %  (≈ ${fmt(mvPerAm, 2)} mV/A·m)`,
    minSize == null
      ? `No size up to ${SIZES_MM2[SIZES_MM2.length - 1]} mm² stays inside ${fmt(lim)} %: use parallel runs or shorten the route.`
      : `Smallest ${m.label.toLowerCase()} size inside ${fmt(lim)} % by this estimate: ${minSize} mm² (voltage drop only; check current-carrying capacity, fault loop and derating separately).`,
  ];
  const warnings: string[] = [];
  if (input.area >= 16 && X === 0) warnings.push('From 16 mm² up, reactance adds noticeably to the drop. Enter X from the cable data, or use the mV/A·m method.');
  if (input.metal === 'al' && input.area < 16) warnings.push('Aluminium below 16 mm² is unusual. Check the size.');
  return { ok: true, value: { vd, pct, vEnd: V - vd, pass: pct <= lim, limitPct: lim, maxLength, mvPerAm, minSize }, steps, warnings };
}
