import { en, type StringKey, speciesText } from './en';

/** Look up a UI string and fill {placeholders}. Falls back to the key, never crashes. */
export function t(key: StringKey, vars?: Record<string, string | number>): string {
  let s: string = en[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

export function speciesName(id: string): string {
  return speciesText[id]?.name ?? id;
}

export function speciesBlurb(id: string): string {
  return speciesText[id]?.blurb ?? '';
}

export function petName(p: { nickname: string | null; speciesId: string }): string {
  return p.nickname || speciesName(p.speciesId);
}

export type { StringKey };
