/**
 * Metric first, imperial on request. Bending works in mm or inches (tape-measure fractions);
 * runs and routes in metres or feet. Conductor sizes stay in mm² (AWG is in the converter).
 */
import { fmt, fmtInches } from './num.ts';

export type Units = 'metric' | 'imperial';
export const FT_PER_M = 1 / 0.3048;

export function shortUnit(u: Units): string { return u === 'metric' ? 'mm' : 'in'; }
export function longUnit(u: Units): string { return u === 'metric' ? 'm' : 'ft'; }

/** Bending length for display: "1027 mm" or "40 7/16"". */
export function fmtShort(n: number, u: Units): string {
  return u === 'metric' ? `${fmt(n, n < 100 ? 1 : 0)} mm` : fmtInches(n);
}
/** Route length for display. */
export function fmtLong(n: number, u: Units): string {
  return `${fmt(n, n < 10 ? 2 : 1)} ${longUnit(u)}`;
}
/** Typed long length (m or ft) to metres for the voltage-drop maths. */
export function toMetres(n: number | null, u: Units): number | null {
  return n == null ? null : u === 'metric' ? n : n * 0.3048;
}
