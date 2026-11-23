/** Pure app state: preferences, the current roof and saved jobs (on the device only). */
import type { RoofInput } from '../core/geometry';
import type { PitchStyle, UnitSystem } from '../core/units';
import { countryFor, isKnownCountry } from '../data';

export type ThemePref = 'system' | 'light' | 'dark' | 'sun';
export interface Prefs {
  v: 1;
  country: string | null; // null until onboarding picks one
  sys: UnitSystem;
  pitchStyle: PitchStyle;
  theme: ThemePref;
  haptics: boolean;
  safetySeen: boolean;
}

export const DEFAULT_PREFS: Prefs = { v: 1, country: null, sys: 'metric', pitchStyle: 'deg', theme: 'system', haptics: true, safetySeen: false };

export function parsePrefs(raw: string | null): Prefs {
  try {
    const d = raw ? (JSON.parse(raw) as Partial<Prefs>) : null;
    if (!d || d.v !== 1) return DEFAULT_PREFS;
    return {
      v: 1,
      country: typeof d.country === 'string' && isKnownCountry(d.country) ? d.country.toUpperCase() : null,
      sys: d.sys === 'imperial' ? 'imperial' : 'metric',
      pitchStyle: d.pitchStyle === 'x12' ? 'x12' : 'deg',
      theme: (['system', 'light', 'dark', 'sun'] as const).includes(d.theme as ThemePref) ? (d.theme as ThemePref) : 'system',
      haptics: d.haptics !== false,
      safetySeen: d.safetySeen === true,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

/** Choosing a country resets units and pitch style to that country's own (the person can change them after). */
export function withCountry(p: Prefs, code: string): Prefs {
  const c = countryFor(code);
  return { ...p, country: c.code, sys: c.sys, pitchStyle: c.pitchStyle };
}

/** Device region → a known country code, or null (picker then starts on nothing). */
export function regionGuess(regionCode: string | null | undefined): string | null {
  if (!regionCode) return null;
  const c = regionCode.toUpperCase() === 'UK' ? 'GB' : regionCode.toUpperCase();
  return isKnownCountry(c) ? c : null;
}

export const DEFAULT_ROOF: RoofInput = { type: 'gable', lengthMm: 0, widthMm: 0, pitchDeg: 0 };

export function parseRoof(raw: string | null): RoofInput {
  try {
    const d = raw ? (JSON.parse(raw) as Partial<RoofInput>) : null;
    if (!d) return DEFAULT_ROOF;
    const n = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : 0);
    return { type: d.type === 'hip' || d.type === 'skillion' ? d.type : 'gable', lengthMm: n(d.lengthMm), widthMm: n(d.widthMm), pitchDeg: n(d.pitchDeg) };
  } catch {
    return DEFAULT_ROOF;
  }
}

export const roofReady = (r: RoofInput) => r.lengthMm > 0 && r.widthMm > 0 && r.pitchDeg > 0;

export type ToolId = 'pitch' | 'level' | 'roof' | 'rafter' | 'hip' | 'sheets' | 'tiles' | 'shingles' | 'flashings' | 'fall' | 'downpipes' | 'fixings';

export interface JobEntry { id: string; tool: ToolId; title: string; lines: string[]; at: number }
export interface Job { id: string; name: string; notes: string; country: string; createdAt: number; updatedAt: number; roof: RoofInput | null; entries: JobEntry[] }

const MAX_JOBS = 500;
const MAX_ENTRIES = 200;

export function parseJobs(raw: string | null): Job[] {
  try {
    const d = raw ? (JSON.parse(raw) as unknown) : null;
    if (!Array.isArray(d)) return [];
    return d.filter((j): j is Job => !!j && typeof j === 'object' && typeof (j as Job).id === 'string' && typeof (j as Job).name === 'string')
      .map(j => ({
        id: j.id, name: j.name.slice(0, 120), notes: typeof j.notes === 'string' ? j.notes.slice(0, 5000) : '',
        country: typeof j.country === 'string' ? j.country : 'XX',
        createdAt: Number(j.createdAt) || 0, updatedAt: Number(j.updatedAt) || 0,
        roof: j.roof ? parseRoof(JSON.stringify(j.roof)) : null,
        entries: Array.isArray(j.entries) ? j.entries.filter(e => e && typeof e.title === 'string' && Array.isArray(e.lines)).slice(0, MAX_ENTRIES) : [],
      }))
      .slice(0, MAX_JOBS);
  } catch {
    return [];
  }
}

let seq = 0;
export const newId = (now: number) => `${now.toString(36)}-${(seq++).toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;

export function createJob(jobs: Job[], name: string, country: string, roof: RoofInput | null, now: number): { jobs: Job[]; job: Job } {
  const clean = name.trim().slice(0, 120) || `Job ${jobs.length + 1}`;
  const job: Job = { id: newId(now), name: clean, notes: '', country, createdAt: now, updatedAt: now, roof: roof && roofReady(roof) ? roof : null, entries: [] };
  return { jobs: [job, ...jobs].slice(0, MAX_JOBS), job };
}

export function addEntry(jobs: Job[], jobId: string, entry: Omit<JobEntry, 'id' | 'at'>, now: number): Job[] {
  return jobs.map(j => (j.id === jobId
    ? { ...j, updatedAt: now, entries: [{ ...entry, lines: entry.lines.slice(0, 40), id: newId(now), at: now }, ...j.entries].slice(0, MAX_ENTRIES) }
    : j));
}

export function updateJob(jobs: Job[], jobId: string, patch: Partial<Pick<Job, 'name' | 'notes' | 'roof'>>, now: number): Job[] {
  return jobs.map(j => (j.id === jobId ? { ...j, ...patch, name: (patch.name ?? j.name).trim().slice(0, 120) || j.name, updatedAt: now } : j));
}

export const removeEntry = (jobs: Job[], jobId: string, entryId: string, now: number) =>
  jobs.map(j => (j.id === jobId ? { ...j, updatedAt: now, entries: j.entries.filter(e => e.id !== entryId) } : j));

export const removeJob = (jobs: Job[], jobId: string) => jobs.filter(j => j.id !== jobId);

/** Plain-text job sheet for sharing (Messages, email, notes). */
export function jobText(job: Job): string {
  const out = [job.name];
  if (job.notes.trim()) out.push('', job.notes.trim());
  for (const e of [...job.entries].reverse()) {
    out.push('', e.title.toUpperCase(), ...e.lines.map(l => `• ${l}`));
  }
  out.push('', 'Estimates from Eaveline. Check against the maker’s data and local codes before ordering.');
  return out.join('\n');
}

export const FREE_TOOLS: ToolId[] = ['pitch', 'level', 'fall'];
export const isFreeTool = (t: ToolId) => FREE_TOOLS.includes(t);
