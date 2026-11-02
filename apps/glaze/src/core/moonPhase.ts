// owner-1102b T277: tonight's moon phase, computed on-device (no network). Mirrors
// targets/widget/MoonPhase.swift exactly (same constants, same buckets); moonPhase.test.ts pins
// known dates and a source guard checks the Swift constants match.
//
// Model: mean synodic month from a reference new moon (2000-01-06 18:14 UTC). Accurate to well
// under a day, which is what a phase icon and an illumination percentage need.

export const SYNODIC_DAYS = 29.530588853;
/** 2000-01-06 18:14 UTC, a new moon, in Unix milliseconds. */
export const REFERENCE_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14, 0);
const DAY_MS = 86_400_000;

export const MOON_PHASES = Object.freeze([
  'new',
  'waxingCrescent',
  'firstQuarter',
  'waxingGibbous',
  'full',
  'waningGibbous',
  'lastQuarter',
  'waningCrescent',
] as const);
export type MoonPhaseName = (typeof MOON_PHASES)[number];

export interface MoonInfo {
  /** Days since the last new moon, 0 ≤ age < SYNODIC_DAYS. */
  age: number;
  /** 0..1 through the cycle (0 new, 0.5 full). */
  fraction: number;
  /** Lit share of the disc, 0..1. */
  illumination: number;
  phase: MoonPhaseName;
  waxing: boolean;
  /** i18n key, e.g. widgets.moon.full */
  labelKey: string;
}

export function moonInfo(now: Date): MoonInfo {
  const days = (now.getTime() - REFERENCE_NEW_MOON_MS) / DAY_MS;
  let age = days % SYNODIC_DAYS;
  if (age < 0) age += SYNODIC_DAYS;
  const fraction = age / SYNODIC_DAYS;
  const illumination = (1 - Math.cos(2 * Math.PI * fraction)) / 2;
  // Eight buckets centred on the principal phases (each 1/8 of the cycle wide).
  const idx = Math.floor(fraction * 8 + 0.5) % 8;
  const phase = MOON_PHASES[idx];
  return { age, fraction, illumination, phase, waxing: fraction < 0.5, labelKey: `widgets.moon.${phase}` };
}

/** Days until the next full moon (0 when it is full tonight-ish). */
export function daysToFull(now: Date): number {
  const { age } = moonInfo(now);
  const half = SYNODIC_DAYS / 2;
  const d = age <= half ? half - age : SYNODIC_DAYS - age + half;
  return Math.round(d);
}
