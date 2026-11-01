// T21: checks a translation drop from the OpenAI lane before it is bundled (pure; Node runs it directly).
// A drop is a flat { key: translated string } object for one language, possibly one chunk of the full catalogue.
import { placeholders } from './core.ts';

/** Words that stay exactly as written in every language (brand and data-licence names). */
export const KEEP_AS_IS = ['Satchel', 'OpenStreetMap'] as const;

/** Share of English keys a language must cover before it is offered in the app (no half-English screens). */
export const MIN_COVERAGE = 0.95;

export type DropReport = {
  accepted: Record<string, string>;
  unknown: string[];
  badPlaceholders: string[];
  empty: string[];
  lostKeepWords: string[];
};

/** Splits a drop into the entries we can bundle and the ones we must reject (with reasons by key). */
export function checkDrop(drop: unknown, en: Record<string, string>): DropReport {
  const r: DropReport = { accepted: {}, unknown: [], badPlaceholders: [], empty: [], lostKeepWords: [] };
  if (!drop || typeof drop !== 'object' || Array.isArray(drop)) return r;
  for (const [k, v] of Object.entries(drop as Record<string, unknown>)) {
    if (!(k in en)) { r.unknown.push(k); continue; }
    if (typeof v !== 'string' || v.trim() === '') { r.empty.push(k); continue; }
    if (placeholders(v).join() !== placeholders(en[k]).join()) { r.badPlaceholders.push(k); continue; }
    if (KEEP_AS_IS.some((w) => en[k].includes(w) && !v.includes(w))) { r.lostKeepWords.push(k); continue; }
    r.accepted[k] = v;
  }
  return r;
}

/** Merges chunk drops in order (later chunks win), keeping only accepted entries. */
export function mergeDrops(drops: unknown[], en: Record<string, string>): { catalog: Record<string, string>; rejected: number } {
  const catalog: Record<string, string> = {};
  let rejected = 0;
  for (const d of drops) {
    const r = checkDrop(d, en);
    Object.assign(catalog, r.accepted);
    rejected += r.unknown.length + r.badPlaceholders.length + r.empty.length + r.lostKeepWords.length;
  }
  return { catalog, rejected };
}

/** Share of English keys the catalogue translates (0..1). */
export function coverage(catalog: Record<string, string>, en: Record<string, string>): number {
  const keys = Object.keys(en);
  if (keys.length === 0) return 1;
  return keys.filter((k) => typeof catalog[k] === 'string' && catalog[k] !== '').length / keys.length;
}

/** Whether a language may be bundled and offered in Settings > Language. */
export function readyToShip(catalog: Record<string, string>, en: Record<string, string>, min = MIN_COVERAGE): boolean {
  return coverage(catalog, en) >= min;
}

/** Splits the English catalogue into chunks of about `size` keys for the lane (stable key order). */
export function chunkCatalogue(en: Record<string, string>, size = 400): Record<string, string>[] {
  const out: Record<string, string>[] = [];
  const keys = Object.keys(en);
  for (let i = 0; i < keys.length; i += size) {
    const c: Record<string, string> = {};
    for (const k of keys.slice(i, i + size)) c[k] = en[k];
    out.push(c);
  }
  return out;
}
