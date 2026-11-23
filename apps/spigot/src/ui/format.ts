import { formatLength, type UnitSystem } from '../calc/units';
import type { Step, Value } from '../calc/steps';

export function fmtNumber(n: number, decimals = 2): string {
  if (!Number.isFinite(n)) return '—';
  const r = Number(n.toFixed(decimals));
  return String(r);
}

export function fmtValue(v: Value, unit: UnitSystem): string {
  switch (v.kind) {
    case 'length': return formatLength(v.n, unit);
    case 'angle': return `${fmtNumber(v.n, 2)}°`;
    case 'factor': return fmtNumber(v.n, 4);
    case 'percent': return `${fmtNumber(v.n, 2)} %`;
    case 'litres': return `${fmtNumber(v.n, v.n < 10 ? 3 : 1)} L`;
    case 'flow': return `${fmtNumber(v.n, 1)} L/min`;
    case 'velocity': return `${fmtNumber(v.n, 2)} m/s`;
    case 'head': return `${fmtNumber(v.n, 2)} m head`;
    case 'pressure': return `${fmtNumber(v.n, 1)} kPa`;
    case 'count': return String(Math.round(v.n));
    case 'text': return v.s ?? String(v.n);
  }
}

export function stepLine(s: Step, unit: UnitSystem): string {
  const ins = s.inputs.map(v => fmtValue(v, unit)).join(', ');
  return ins ? `${s.formula}  (${ins})` : s.formula;
}

export function stepsAsText(title: string, steps: Step[], unit: UnitSystem): string {
  return [title, ...steps.map(s => `${s.label}: ${fmtValue(s.result, unit)}   = ${stepLine(s, unit)}`)].join('\n');
}
