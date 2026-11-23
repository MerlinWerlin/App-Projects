/** Turns canonical results into what the person reads, in their unit system. Pure, tested. */
import { fmt, FT, FT2, IN, LB, SHORT_TON_KG, YD3, type UnitSystem } from '../core/units.ts';
import type { Out, OutKind } from './registry.ts';

export interface Shown { value: string; unit: string }

/** 1 kg/m²/h in lb/ft²/h. */
const KGPH_TO_LBPH = FT2 / LB;

export function show(kind: OutKind, v: number, sys: UnitSystem, dp?: number): Shown {
  const metric = sys === 'metric';
  switch (kind) {
    case 'vol': return metric ? { value: fmt(v, dp ?? 2), unit: 'm³' } : { value: fmt(v / YD3, Math.max(2, dp ?? 2)), unit: 'yd³' };
    case 'len': return metric ? { value: fmt(v, dp ?? 2), unit: 'm' } : { value: fmt(v / FT, Math.max(1, dp ?? 1)), unit: 'ft' };
    case 'area': return metric ? { value: fmt(v, dp ?? 2), unit: 'm²' } : { value: fmt(v / FT2, Math.max(1, dp ?? 1)), unit: 'ft²' };
    case 'kg':
      if (!metric) return { value: fmt(v / LB, 0), unit: 'lb' };
      return v >= 1000 ? { value: fmt(v / 1000, 2), unit: 't' } : { value: fmt(v, dp ?? 0), unit: 'kg' };
    case 't': return metric ? { value: fmt(v, dp ?? 2), unit: 't' } : { value: fmt((v * 1000) / SHORT_TON_KG, 2), unit: 'US tons' };
    case 'count': return { value: fmt(v, 0), unit: '' };
    case 'pct': return { value: fmt(v, dp ?? 1), unit: '%' };
    case 'mm': return metric ? { value: fmt(v * 1000, dp ?? 0), unit: 'mm' } : { value: fmt(v / IN, 2), unit: 'in' };
    case 'ratio': return { value: fmt(v, dp ?? 0), unit: '' };
    case 'kgph': return metric ? { value: fmt(v, dp ?? 2), unit: 'kg/m²/h' } : { value: fmt(v * KGPH_TO_LBPH, 2), unit: 'lb/ft²/h' };
  }
}

export const showOut = (o: Out, sys: UnitSystem) => show(o.kind, o.value, sys, o.dp);

export function line(o: Out, sys: UnitSystem): string {
  const s = showOut(o, sys);
  return `${o.label}: ${s.value}${s.unit ? ' ' + s.unit : ''}`;
}
