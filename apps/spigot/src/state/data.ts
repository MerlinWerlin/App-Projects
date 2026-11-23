/**
 * On-device data: preferences, jobs, saved and recent calculations, custom fittings. Pure TS (tested in Node).
 * Everything lives in AsyncStorage on the phone; nothing is uploaded. Corrupt data is ignored, never fatal.
 */
import type { UnitSystem } from '../calc/units';

export interface KvStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export class MemoryKv implements KvStore {
  data = new Map<string, string>();
  async getItem(k: string) { return this.data.has(k) ? this.data.get(k)! : null; }
  async setItem(k: string, v: string) { this.data.set(k, v); }
}

export type ToolId = 'offset' | 'rolling' | 'cut' | 'fall' | 'flow' | 'cutlist';

export interface Prefs {
  version: 1;
  unit: UnitSystem;
  appearance: 'system' | 'light' | 'dark';
  /** Default stock length for cut lists, mm (6 m is the usual Australian length for copper and PVC). */
  stock: number;
  kerf: number;
  haptics: boolean;
  onboarded: boolean;
}

export const DEFAULT_PREFS: Prefs = { version: 1, unit: 'metric', appearance: 'system', stock: 6000, kerf: 2, haptics: true, onboarded: false };

export interface Job {
  id: string;
  name: string;
  notes: string;
  createdAt: number;
  updatedAt: number;
}

export interface CalcRecord {
  id: string;
  tool: ToolId;
  createdAt: number;
  /** Short headline in the units used at the time ("Travel 424 mm"). */
  summary: string;
  /** Numeric inputs in mm / degrees / plain numbers, so they can be reopened in either unit system. */
  inputs: Record<string, unknown>;
  jobId: string | null;
  note?: string;
}

export interface CustomFitting {
  id: string;
  name: string;
  centreToEnd: number;
  engagement: number;
}

export const KEYS = {
  prefs: 'spigot.prefs.v1',
  jobs: 'spigot.jobs.v1',
  records: 'spigot.records.v1',
  fittings: 'spigot.fittings.v1',
};

export const MAX_RECENTS = 30;
export const MAX_RECORDS = 2000;

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const str = (x: unknown, max = 200) => (typeof x === 'string' ? x.slice(0, max) : '');
const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : null);
const TOOLS: ToolId[] = ['offset', 'rolling', 'cut', 'fall', 'flow', 'cutlist'];

function parseJson(raw: string | null): unknown {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function parsePrefs(raw: string | null): Prefs {
  const d = parseJson(raw);
  if (!isObj(d)) return { ...DEFAULT_PREFS };
  const stock = num(d.stock);
  const kerf = num(d.kerf);
  return {
    version: 1,
    unit: d.unit === 'imperial' ? 'imperial' : 'metric',
    appearance: d.appearance === 'light' || d.appearance === 'dark' ? d.appearance : 'system',
    stock: stock !== null && stock > 0 && stock <= 100000 ? stock : DEFAULT_PREFS.stock,
    kerf: kerf !== null && kerf >= 0 && kerf <= 50 ? kerf : DEFAULT_PREFS.kerf,
    haptics: d.haptics !== false,
    onboarded: d.onboarded === true,
  };
}

export function parseJobs(raw: string | null): Job[] {
  const d = parseJson(raw);
  if (!Array.isArray(d)) return [];
  return d.filter(isObj).flatMap(j => {
    const id = str(j.id, 64);
    const createdAt = num(j.createdAt);
    if (!id || createdAt === null) return [];
    return [{ id, name: str(j.name, 80) || 'Untitled job', notes: str(j.notes, 4000), createdAt, updatedAt: num(j.updatedAt) ?? createdAt }];
  });
}

export function parseRecords(raw: string | null): CalcRecord[] {
  const d = parseJson(raw);
  if (!Array.isArray(d)) return [];
  return d.filter(isObj).flatMap(r => {
    const id = str(r.id, 64);
    const createdAt = num(r.createdAt);
    const tool = TOOLS.find(t => t === r.tool);
    if (!id || createdAt === null || !tool || !isObj(r.inputs)) return [];
    const jobId = typeof r.jobId === 'string' ? r.jobId : null;
    const rec: CalcRecord = { id, tool, createdAt, summary: str(r.summary, 200), inputs: r.inputs, jobId };
    if (typeof r.note === 'string' && r.note) rec.note = r.note.slice(0, 500);
    return [rec];
  });
}

export function parseFittings(raw: string | null): CustomFitting[] {
  const d = parseJson(raw);
  if (!Array.isArray(d)) return [];
  return d.filter(isObj).flatMap(f => {
    const id = str(f.id, 64);
    const c = num(f.centreToEnd);
    const e = num(f.engagement);
    if (!id || c === null || e === null || c < 0 || e < 0 || e > c) return [];
    return [{ id, name: str(f.name, 60) || 'Custom fitting', centreToEnd: c, engagement: e }];
  });
}

/** Adds a recent calculation, dropping an identical one just before it and keeping MAX_RECENTS unsaved records. */
export function addRecent(records: CalcRecord[], rec: CalcRecord): CalcRecord[] {
  const recents = records.filter(r => r.jobId === null);
  const last = recents[0];
  if (last && last.tool === rec.tool && JSON.stringify(last.inputs) === JSON.stringify(rec.inputs)) {
    return records.map(r => (r.id === last.id ? { ...r, createdAt: rec.createdAt, summary: rec.summary } : r));
  }
  const keep = new Set(recents.slice(0, MAX_RECENTS - 1).map(r => r.id));
  return [rec, ...records.filter(r => r.jobId !== null || keep.has(r.id))].slice(0, MAX_RECORDS);
}

export function deleteJob(jobs: Job[], records: CalcRecord[], jobId: string): { jobs: Job[]; records: CalcRecord[] } {
  return { jobs: jobs.filter(j => j.id !== jobId), records: records.filter(r => r.jobId !== jobId) };
}

export function newId(now: number, rnd: () => number = Math.random): string {
  return `${now.toString(36)}-${Math.floor(rnd() * 1e9).toString(36)}`;
}

export function sortJobs(jobs: Job[]): Job[] {
  return [...jobs].sort((a, b) => b.updatedAt - a.updatedAt);
}
