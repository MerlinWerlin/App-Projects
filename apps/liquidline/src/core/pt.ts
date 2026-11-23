// Pressure–temperature engine. Reads the 1 °C saturation tables in src/data/ptTables.ts (CoolProp 8 output) and
// interpolates ln(P) linearly in T, which follows the Clausius–Clapeyron shape closely: the error at mid-cell is
// about 0.003 % of pressure (checked against direct CoolProp values in pt.test.ts).
// All pressures here are kPa ABSOLUTE. Gauge conversion is in units.ts.
//
// Blends: bubble point = saturated liquid (use it for subcooling, on the liquid line); dew point = saturated vapour
// (use it for superheat, on the suction line). Pure fluids and azeotropes have one curve.

import { PT_TABLES, type PtTable } from '../data/ptTables.ts';

export type Phase = 'bubble' | 'dew';

export function table(id: string): PtTable | undefined {
  return PT_TABLES[id];
}

export function hasGlide(id: string): boolean {
  return !!PT_TABLES[id]?.dew;
}

function curve(t: PtTable, phase: Phase): number[] {
  return phase === 'dew' && t.dew ? t.dew : t.bubble;
}

/** Saturation pressure (kPa abs) at tC, or null outside the table. */
export function satPressure(id: string, tC: number, phase: Phase = 'bubble'): number | null {
  const t = PT_TABLES[id];
  if (!t || !Number.isFinite(tC) || tC < t.tMin || tC > t.tMax) return null;
  const c = curve(t, phase);
  const x = tC - t.tMin;
  const i = Math.min(c.length - 2, Math.floor(x));
  const f = x - i;
  const a = Math.log(c[i]);
  const b = Math.log(c[i + 1]);
  return Math.exp(a + (b - a) * f);
}

/** Saturation temperature (°C) at pAbsKpa, or null outside the table. */
export function satTemp(id: string, pAbsKpa: number, phase: Phase = 'bubble'): number | null {
  const t = PT_TABLES[id];
  if (!t || !Number.isFinite(pAbsKpa) || pAbsKpa <= 0) return null;
  const c = curve(t, phase);
  if (pAbsKpa < c[0] || pAbsKpa > c[c.length - 1]) return null;
  let lo = 0;
  let hi = c.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (c[mid] <= pAbsKpa) lo = mid;
    else hi = mid;
  }
  const a = Math.log(c[lo]);
  const b = Math.log(c[hi]);
  const f = b === a ? 0 : (Math.log(pAbsKpa) - a) / (b - a);
  return t.tMin + lo + f;
}

/** Temperature glide (K) at a pressure: dew minus bubble temperature. 0 for pure fluids; null outside the table. */
export function glideAt(id: string, pAbsKpa: number): number | null {
  if (!hasGlide(id)) return satTemp(id, pAbsKpa) == null ? null : 0;
  const d = satTemp(id, pAbsKpa, 'dew');
  const b = satTemp(id, pAbsKpa, 'bubble');
  return d == null || b == null ? null : d - b;
}

/** The table's limits, for "out of range" messages: temperatures °C and pressures kPa abs. */
export function limits(id: string): { tMin: number; tMax: number; pMin: number; pMax: number } | null {
  const t = PT_TABLES[id];
  if (!t) return null;
  const lowest = Math.min(t.bubble[0], t.dew?.[0] ?? Infinity);
  const highest = Math.max(t.bubble[t.bubble.length - 1], t.dew?.[t.dew.length - 1] ?? -Infinity);
  return { tMin: t.tMin, tMax: t.tMax, pMin: lowest, pMax: highest };
}

/** Rows for a printed-style PT chart: every `stepC` degrees across the table. */
export function chartRows(id: string, stepC = 5): { tC: number; bubble: number; dew: number }[] {
  const t = PT_TABLES[id];
  if (!t) return [];
  const rows: { tC: number; bubble: number; dew: number }[] = [];
  const first = Math.ceil(t.tMin / stepC) * stepC;
  for (let tc = first; tc <= t.tMax; tc += stepC) {
    const b = satPressure(id, tc, 'bubble');
    const d = satPressure(id, tc, 'dew');
    if (b != null && d != null) rows.push({ tC: tc, bubble: b, dew: d });
  }
  return rows;
}
