/**
 * Pour-day weather: evaporation rate from fresh concrete, and plain-words risk.
 *
 * Evaporation: Uno, P.J. (1998) "Plastic Shrinkage Cracking and Evaporation Formulas", ACI Materials Journal
 * 95(4), the equation form of the Menzel/ACI nomograph, quoted in ACI 305R (Hot Weather Concreting):
 *   E = 5 ([Tc + 18]^2.5 − r · [Ta + 18]^2.5) (V + 4) × 10⁻⁶   kg/m²/h
 *   Tc concrete temperature °C, Ta air temperature °C, r relative humidity (0–1), V wind speed km/h.
 * Risk bands: CCAA Data Sheet "Plastic Shrinkage Cracking" (2005): take precautions above 0.5 kg/m²/h;
 * cracking is most likely above 1.0 kg/m²/h (ACI 305R: precautions mandatory above 1.0).
 * Delivered concrete temperature: AS 1379 requires 5–35 °C at delivery (Holcim data sheet DS2004).
 * Discharge: AS 1379 cl. 4.2.5 period for completion of discharge, 90 minutes.
 */
import { type Calc, type Errors, type Step, check, fail, hasErrors, ok } from './calc.ts';
import { fmt } from './units.ts';

export type Risk = 'low' | 'moderate' | 'high';
export interface WeatherInput { airC: number | null; concreteC: number | null; humidityPct: number | null; windKmh: number | null; /** Delivered-temperature limits from the local ready-mix standard, e.g. AS 1379 5–35 °C. */ delivery?: { min: number; max: number; source: string } }
export interface WeatherResult { evaporation: number; risk: Risk; warnings: string[] }

export function evaporationRate(Tc: number, Ta: number, r: number, V: number): number {
  const E = 5 * ((Tc + 18) ** 2.5 - r * (Ta + 18) ** 2.5) * (V + 4) * 1e-6;
  return Math.max(0, E);
}

export function pourWeather(i: WeatherInput): Calc<WeatherResult> {
  const e: Errors = {};
  const Ta = check(e, 'airC', i.airC, { label: 'Air temperature', min: -30, exclusive: false, max: 60 });
  const Tc = check(e, 'concreteC', i.concreteC, { label: 'Concrete temperature', min: -10, exclusive: false, max: 60 });
  const rh = check(e, 'humidityPct', i.humidityPct, { label: 'Humidity', min: 0, exclusive: false, max: 100 });
  const V = check(e, 'windKmh', i.windKmh, { label: 'Wind', min: 0, exclusive: false, max: 200 });
  if (hasErrors(e)) return fail(e);
  const E = evaporationRate(Tc, Ta, rh / 100, V);
  const risk: Risk = E >= 1 ? 'high' : E >= 0.5 ? 'moderate' : 'low';
  const steps: Step[] = [
    { label: 'Concrete term', working: `(${fmt(Tc, 1)} + 18)^2.5`, result: fmt((Tc + 18) ** 2.5, 0) },
    { label: 'Air term', working: `${fmt(rh / 100, 2)} × (${fmt(Ta, 1)} + 18)^2.5`, result: fmt((rh / 100) * (Ta + 18) ** 2.5, 0) },
    { label: 'Evaporation', working: `5 × (difference) × (${fmt(V, 0)} + 4) × 10⁻⁶`, result: `${fmt(E, 2)} kg/m²/h` },
  ];
  const warnings: string[] = [];
  if (risk === 'high') warnings.push('High risk of plastic shrinkage cracking. Use wind breaks, fog spray or aliphatic alcohol evaporation retarder, and cure straight after finishing.');
  else if (risk === 'moderate') warnings.push('Cracking risk. Have evaporation retarder and curing ready, and protect from wind.');
  if (i.delivery && (Tc > i.delivery.max || Tc < i.delivery.min)) warnings.push(`${i.delivery.source} asks for delivered concrete between ${i.delivery.min} °C and ${i.delivery.max} °C. Talk to the plant.`);
  if (Ta >= 30) warnings.push('Hot weather: pour early, dampen the sub-base and forms (no puddles), and ask about a set retarder.');
  if (Ta <= 5) warnings.push('Cold weather: keep the concrete above 5 °C while it sets, cover it, never pour on frozen ground, and ask about an accelerator.');
  return ok({ evaporation: E, risk, warnings }, steps, ['Rule-of-thumb guidance only. Your supplier can advise on mix adjustments.']);
}

export interface CheckItem { id: string; text: string }
export interface CheckGroup { id: string; title: string; items: CheckItem[] }

/** Pour-day and curing checklist. Standards names come from the user's country. */
export function checklist(std: { readyMix: string; residential: string; curing: string }, dischargeMinutes?: number): CheckGroup[] {
  return [
  {
    id: 'before', title: 'Before the truck', items: [
      { id: 'forms', text: 'Forms set to level and falls, braced and pegged' },
      { id: 'base', text: 'Sub-base compacted, level and damp (no puddles)' },
      { id: 'membrane', text: `Vapour barrier lapped and taped where required (${std.residential})` },
      { id: 'reo', text: 'Reo on chairs at the right cover, laps tied' },
      { id: 'inspect', text: 'Inspection booked and passed if required' },
      { id: 'access', text: 'Truck and pump access clear, wash-out area set' },
      { id: 'order', text: 'Concrete ordered: strength, slump, volume, time' },
      { id: 'tools', text: 'Screeds, floats, edgers, groovers and saw ready' },
      { id: 'weather', text: 'Weather and evaporation checked' },
    ],
  },
  {
    id: 'pour', title: 'During the pour', items: [
      { id: 'docket', text: dischargeMinutes ? `Docket checked: mix, slump and batch time (discharge within ${dischargeMinutes} min, ${std.readyMix})` : 'Docket checked: mix, slump and batch time' },
      { id: 'water', text: 'No extra water added on site beyond what the docket allows' },
      { id: 'vibrate', text: 'Concrete compacted around edges and reo' },
      { id: 'bleed', text: 'Bleed water gone before final finishing' },
    ],
  },
  {
    id: 'cure', title: 'Curing', items: [
      { id: 'start', text: 'Curing started as soon as finishing is done' },
      { id: 'moist', text: `Kept moist or covered for at least 7 days (check ${std.curing} for your exposure class)` },
      { id: 'joints', text: 'Control joints cut or tooled on time' },
      { id: 'traffic', text: 'Foot traffic kept off for a day or two, cars for at least 7 days' },
    ],
  },
];
}
