/** Saved jobs and preferences, kept on the phone only (AsyncStorage). Corrupt data is ignored, never fatal. */
import type { ToolId } from '../plus/entitlement.ts';
import type { PaperId } from './pdf.ts';
import { fmt, fromMm, parseNum, toMm, type UnitSystem } from './units.ts';

export interface Job {
  id: string;
  tool: ToolId;
  name: string;
  units: UnitSystem;
  values: Record<string, string>;
  savedAt: number;
}

export interface Prefs { units: UnitSystem; paper: PaperId; welcomed: boolean }

export const JOBS_KEY = 'rootpass.jobs.v1';
export const PREFS_KEY = 'rootpass.prefs.v1';
export const DEFAULT_PREFS: Prefs = { units: 'metric', paper: 'a4', welcomed: false };
const TOOLS: ToolId[] = ['saddle', 'lobster', 'frame', 'weight', 'weld', 'bend', 'cutlist', 'pcd'];

export function parsePrefs(raw: string | null): Prefs {
  try {
    const d = raw ? JSON.parse(raw) : null;
    if (d && typeof d === 'object') {
      return {
        units: d.units === 'imperial' ? 'imperial' : 'metric',
        paper: d.paper === 'letter' ? 'letter' : 'a4',
        welcomed: d.welcomed === true,
      };
    }
  } catch { /* fall through */ }
  return { ...DEFAULT_PREFS };
}

export function parseJobs(raw: string | null): Job[] {
  try {
    const list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return [];
    return list.filter((j): j is Job =>
      j && typeof j.id === 'string' && TOOLS.includes(j.tool) && typeof j.name === 'string' &&
      (j.units === 'metric' || j.units === 'imperial') && j.values && typeof j.values === 'object' && typeof j.savedAt === 'number',
    ).map(j => ({ ...j, values: Object.fromEntries(Object.entries(j.values).filter(([, v]) => typeof v === 'string')) as Record<string, string> }));
  } catch {
    return [];
  }
}

export function upsertJob(list: Job[], job: Job): Job[] {
  return [job, ...list.filter(j => j.id !== job.id)].sort((a, b) => b.savedAt - a.savedAt);
}

export function newJobId(now: number, rand: () => number = Math.random): string {
  return `${now.toString(36)}-${Math.floor(rand() * 1e9).toString(36)}`;
}

/**
 * Field strings are kept in the units they were typed in. When the units change, length fields are converted
 * so the same job reads correctly; other fields (angles, counts, %) are left alone.
 */
export function convertValues(values: Record<string, string>, lengthKeys: readonly string[], from: UnitSystem, to: UnitSystem): Record<string, string> {
  if (from === to) return values;
  const out = { ...values };
  for (const k of lengthKeys) {
    const raw = values[k];
    if (raw === undefined) continue;
    // Lists of lengths ("1200 x 4, 800") keep their quantities: only numbers before an "x" are lengths.
    if (/[x×]/i.test(raw) || raw.includes('\n')) continue;
    const v = parseNum(raw);
    if (!Number.isFinite(v)) continue;
    const mm = toMm(v, from);
    out[k] = trimZeros(fmt(fromMm(mm, to), to === 'imperial' ? 3 : 1));
  }
  return out;
}

function trimZeros(s: string): string {
  return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s;
}
