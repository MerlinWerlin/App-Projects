// Superheat, subcooling, additional charge and the fixed-orifice target superheat, each with the working shown.
// Pure TypeScript (charge.test.ts). Inputs are what the tech reads: gauge (or absolute) pressure in their unit, line
// temperature in their unit. Everything is computed in kPa abs / °C and shown back in their units.

import { satTemp } from './pt.ts';
import {
  DELTA_LABEL, LENGTH_LABEL, PRESSURE_LABEL, TEMP_LABEL, deltaFromK, fmt, lengthFromM, massFromG, pressureDecimals,
  pressureFromKpa, pressureToKpa, rateFromGPerM, tempFromC, tempToC, type LengthUnit, type MassUnit, type PressureUnit, type TempUnit,
} from './units.ts';

export type Prefs = { pressure: PressureUnit; temp: TempUnit; gauge: boolean; atmKpa: number };
export type Step = { label: string; value: string };
export type Verdict = 'ok' | 'low' | 'high' | 'warn';
export type Reading = {
  ok: true;
  satC: number;
  /** Superheat or subcooling in kelvin. */
  valueK: number;
  steps: Step[];
  note: string | null;
  verdict: Verdict | null;
} | { ok: false; error: string };

const pStr = (kpa: number, p: Prefs, abs: boolean) =>
  `${fmt(pressureFromKpa(kpa, p.pressure), pressureDecimals(p.pressure))} ${PRESSURE_LABEL[p.pressure]}${abs ? ' abs' : p.gauge ? ' gauge' : ' abs'}`;
const tStr = (c: number, p: Prefs) => `${fmt(tempFromC(c, p.temp), 1)} ${TEMP_LABEL[p.temp]}`;
const dStr = (k: number, p: Prefs) => `${fmt(deltaFromK(k, p.temp), 1)} ${DELTA_LABEL[p.temp]}`;

function absOf(reading: number, p: Prefs): number {
  const kpa = pressureToKpa(reading, p.pressure);
  return p.gauge ? kpa + p.atmKpa : kpa;
}

function pressureSteps(reading: number, abs: number, p: Prefs): Step[] {
  const steps: Step[] = [{ label: 'Pressure read', value: `${fmt(reading, pressureDecimals(p.pressure))} ${PRESSURE_LABEL[p.pressure]}${p.gauge ? ' gauge' : ' abs'}` }];
  if (p.gauge) steps.push({ label: `Add atmosphere (${fmt(pressureFromKpa(p.atmKpa, p.pressure), pressureDecimals(p.pressure) + 1)})`, value: pStr(abs, p, true) });
  return steps;
}

/** Superheat = suction line temperature − dew-point saturation temperature at suction pressure. */
export function superheat(id: string, suctionReading: number, lineTemp: number, p: Prefs, targetK?: number | null): Reading {
  if (!Number.isFinite(suctionReading) || !Number.isFinite(lineTemp)) return { ok: false, error: 'Enter the suction pressure and the suction line temperature.' };
  const abs = absOf(suctionReading, p);
  if (abs <= 0) return { ok: false, error: 'That pressure is below a perfect vacuum. Check gauge or absolute.' };
  const sat = satTemp(id, abs, 'dew');
  if (sat == null) return { ok: false, error: 'That pressure is outside this refrigerant’s table. Check the refrigerant and the reading.' };
  const lineC = tempToC(lineTemp, p.temp);
  const sh = lineC - sat;
  const steps = [
    ...pressureSteps(suctionReading, abs, p),
    { label: 'Saturation (dew point)', value: tStr(sat, p) },
    { label: 'Suction line temperature', value: tStr(lineC, p) },
    { label: `Superheat = ${fmt(tempFromC(lineC, p.temp), 1)} − ${fmt(tempFromC(sat, p.temp), 1)}`, value: dStr(sh, p) },
  ];
  let note: string | null = null;
  let verdict: Verdict | null = null;
  if (sh < 0) {
    note = 'Negative superheat: the line reads colder than saturation. Recheck the probe and the reading. If it is real, liquid may be returning to the compressor.';
    verdict = 'warn';
  } else if (sh < 1.5) {
    note = 'Very low superheat: risk of liquid floodback. Check airflow, metering device and charge.';
    verdict = 'low';
  }
  if (targetK != null && Number.isFinite(targetK) && verdict !== 'warn') {
    const diff = sh - targetK;
    verdict = Math.abs(diff) <= 1.7 ? 'ok' : diff < 0 ? 'low' : 'high';
    steps.push({ label: 'Target', value: dStr(targetK, p) });
    steps.push({ label: 'Difference', value: `${diff >= 0 ? '+' : ''}${dStr(diff, p)}` });
  }
  return { ok: true, satC: sat, valueK: sh, steps, note, verdict };
}

/** Subcooling = bubble-point saturation temperature at liquid pressure − liquid line temperature. */
export function subcooling(id: string, liquidReading: number, lineTemp: number, p: Prefs, targetK?: number | null): Reading {
  if (!Number.isFinite(liquidReading) || !Number.isFinite(lineTemp)) return { ok: false, error: 'Enter the liquid (high-side) pressure and the liquid line temperature.' };
  const abs = absOf(liquidReading, p);
  if (abs <= 0) return { ok: false, error: 'That pressure is below a perfect vacuum. Check gauge or absolute.' };
  const sat = satTemp(id, abs, 'bubble');
  if (sat == null) return { ok: false, error: 'That pressure is outside this refrigerant’s table. Check the refrigerant and the reading.' };
  const lineC = tempToC(lineTemp, p.temp);
  const sc = sat - lineC;
  const steps = [
    ...pressureSteps(liquidReading, abs, p),
    { label: 'Saturation (bubble point)', value: tStr(sat, p) },
    { label: 'Liquid line temperature', value: tStr(lineC, p) },
    { label: `Subcooling = ${fmt(tempFromC(sat, p.temp), 1)} − ${fmt(tempFromC(lineC, p.temp), 1)}`, value: dStr(sc, p) },
  ];
  let note: string | null = null;
  let verdict: Verdict | null = null;
  if (sc < 0) {
    note = 'Negative subcooling: the line reads warmer than saturation. Recheck the probe and reading; flash gas or a very low charge is possible.';
    verdict = 'warn';
  }
  if (targetK != null && Number.isFinite(targetK) && verdict !== 'warn') {
    const diff = sc - targetK;
    verdict = Math.abs(diff) <= 1.7 ? 'ok' : diff < 0 ? 'low' : 'high';
    steps.push({ label: 'Target', value: dStr(targetK, p) });
    steps.push({ label: 'Difference', value: `${diff >= 0 ? '+' : ''}${dStr(diff, p)}` });
    if (verdict === 'low') note = 'Below target: on a TXV/EEV system this usually points to undercharge (check for leaks before adding refrigerant).';
    if (verdict === 'high') note = 'Above target: possible overcharge, or a restriction or non-condensables. Check before removing refrigerant.';
  }
  return { ok: true, satC: sat, valueK: sc, steps, note, verdict };
}

/**
 * Fixed-orifice (piston / capillary) target superheat rule of thumb, as published in common charging charts:
 * target SH (°F) = (3 × indoor wet bulb °F − 80 − outdoor dry bulb °F) / 2. Inputs and output in °C / K here.
 * Returns null when the result is below about 3 K (charts say: do not charge by superheat there).
 */
export function fixedOrificeTargetK(indoorWbC: number, outdoorDbC: number): number | null {
  if (!Number.isFinite(indoorWbC) || !Number.isFinite(outdoorDbC)) return null;
  const wbF = (indoorWbC * 9) / 5 + 32;
  const dbF = (outdoorDbC * 9) / 5 + 32;
  const shF = (3 * wbF - 80 - dbF) / 2;
  const k = (shF * 5) / 9;
  return k < 2.8 ? null : k;
}

export type ExtraCharge = {
  ok: true;
  extraG: number;
  extraLengthM: number;
  steps: Step[];
  note: string | null;
} | { ok: false; error: string };

/** Additional charge for a line set longer than the factory pre-charged length. */
export function additionalCharge(totalM: number, prechargedM: number, gPerM: number, maxM?: number | null, disp: { length: LengthUnit; mass: MassUnit } = { length: 'm', mass: 'g' }): ExtraCharge {
  if (![totalM, prechargedM, gPerM].every(Number.isFinite)) return { ok: false, error: 'Enter the line length, the pre-charged length and the charge rate.' };
  if (totalM < 0 || prechargedM < 0 || gPerM < 0) return { ok: false, error: 'Lengths and the rate cannot be negative.' };
  const extraLengthM = Math.max(0, totalM - prechargedM);
  const extraG = extraLengthM * gPerM;
  const L = (m: number) => `${fmt(lengthFromM(m, disp.length), 1)} ${LENGTH_LABEL[disp.length]}`;
  const M = (g: number) => (disp.mass === 'g' ? `${fmt(g, 0)} g` : `${fmt(massFromG(g, 'oz'), 1)} oz`);
  const R = disp.mass === 'g' && disp.length === 'm' ? `${fmt(gPerM, 0)} g/m` : `${fmt(rateFromGPerM(gPerM, 'oz'), 2)} oz/ft`;
  const steps: Step[] = [
    { label: 'Line set length (one way)', value: L(totalM) },
    { label: 'Pre-charged for', value: L(prechargedM) },
    { label: 'Extra length', value: L(extraLengthM) },
    { label: `Extra charge = ${L(extraLengthM)} × ${R}`, value: M(extraG) },
  ];
  let note: string | null = null;
  if (totalM < prechargedM) note = 'Shorter than the pre-charged length: no extra refrigerant. Some manuals ask you to remove some for very short runs; check yours.';
  if (maxM != null && Number.isFinite(maxM) && totalM > maxM) note = `Longer than the ${L(maxM)} maximum you entered. Check the unit's manual for long-line rules (oil traps, pipe upsizing).`;
  return { ok: true, extraG, extraLengthM, steps, note };
}

/** Target liquid-line temperature for a target subcooling at a measured liquid pressure (°C), or null. */
export function targetLiquidLineC(id: string, liquidAbsKpa: number, targetScK: number): number | null {
  const sat = satTemp(id, liquidAbsKpa, 'bubble');
  return sat == null || !Number.isFinite(targetScK) ? null : sat - targetScK;
}
