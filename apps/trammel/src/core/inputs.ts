// Typed inputs are kept as text, so they belong to the units they were typed in: "2700" is mm in metric and inches in
// imperial. Remembered and saved inputs carry their units (UNITS_KEY), and are converted when the units change so a
// length never silently changes size.
import { lengthToInput, parseLength, type FractionDenom, type UnitSystem } from './units.ts';

export const UNITS_KEY = '__units';

/** Converts the given length fields (and the "l" of each row in JSON row-list fields) from one unit system to another. */
export function convertLengths(vals: Record<string, string>, keys: readonly string[], from: UnitSystem, to: UnitSystem, denom: FractionDenom): Record<string, string> {
  if (from === to) return { ...vals };
  const conv = (s: string) => {
    if (!s || !s.trim()) return s;
    const mm = parseLength(s, from);
    return mm == null ? s : lengthToInput(mm, to, denom);
  };
  const out = { ...vals };
  for (const k of keys) {
    const v = vals[k];
    if (typeof v !== 'string') continue;
    if (v.trim().startsWith('[')) {
      try {
        const rows = JSON.parse(v);
        if (Array.isArray(rows)) out[k] = JSON.stringify(rows.map((r) => (r && typeof r === 'object' && typeof r.l === 'string' ? { ...r, l: conv(r.l) } : r)));
      } catch {
        // leave it as typed
      }
    } else out[k] = conv(v);
  }
  return out;
}

/** Brings stored inputs into the current units, using the units they were stored with (metric if unknown). */
export function inputsInUnits(stored: Record<string, string>, keys: readonly string[], to: UnitSystem, denom: FractionDenom): Record<string, string> {
  const from: UnitSystem = stored[UNITS_KEY] === 'imperial' ? 'imperial' : 'metric';
  const out = convertLengths(stored, keys, from, to, denom);
  out[UNITS_KEY] = to;
  return out;
}
