/**
 * Jobs: named folders of saved calculations, kept on the device only (AsyncStorage). Pure helpers here;
 * src/state persists them. Nothing is uploaded.
 */
export type CalcKind = 'offset' | 'saddle3' | 'saddle4' | 'kick' | 'stub90' | 'vdrop' | 'fill' | 'ohm' | 'power' | 'runs';

export interface SavedCalc {
  id: string;
  kind: CalcKind;
  title: string;
  /** Headline result lines, already formatted in the units used at the time. */
  lines: string[];
  steps: string[];
  at: number;
}

export interface Job { id: string; name: string; notes: string; createdAt: number; updatedAt: number; items: SavedCalc[] }
export interface JobsDoc { version: 1; jobs: Job[] }

export const JOBS_KEY = 'wattle.jobs.v1';
export const MAX_NAME = 60;

export interface KvStore { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> }

export class MemoryKv implements KvStore {
  private m = new Map<string, string>();
  async getItem(k: string) { return this.m.has(k) ? (this.m.get(k) as string) : null; }
  async setItem(k: string, v: string) { this.m.set(k, v); }
}

export function newId(now = Date.now(), rand = Math.random): string {
  return `${now.toString(36)}${Math.floor(rand() * 1e9).toString(36)}`;
}

export function cleanName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);
}

export function parseJobs(raw: string | null): JobsDoc {
  const empty: JobsDoc = { version: 1, jobs: [] };
  if (!raw) return empty;
  try {
    const d = JSON.parse(raw) as Partial<JobsDoc>;
    if (d?.version !== 1 || !Array.isArray(d.jobs)) return empty;
    const jobs = d.jobs.filter((j): j is Job => !!j && typeof j.id === 'string' && typeof j.name === 'string' && Array.isArray(j.items))
      .map(j => ({ ...j, notes: typeof j.notes === 'string' ? j.notes : '', items: j.items.filter(i => i && typeof i.id === 'string' && Array.isArray(i.lines)) }));
    return { version: 1, jobs };
  } catch {
    return empty;
  }
}

export function createJob(doc: JobsDoc, name: string, now = Date.now()): { doc: JobsDoc; job: Job } {
  const job: Job = { id: newId(now), name: cleanName(name) || 'Untitled job', notes: '', createdAt: now, updatedAt: now, items: [] };
  return { doc: { ...doc, jobs: [job, ...doc.jobs] }, job };
}

export function renameJob(doc: JobsDoc, id: string, name: string, now = Date.now()): JobsDoc {
  const n = cleanName(name);
  if (!n) return doc;
  return { ...doc, jobs: doc.jobs.map(j => (j.id === id ? { ...j, name: n, updatedAt: now } : j)) };
}

export function setNotes(doc: JobsDoc, id: string, notes: string, now = Date.now()): JobsDoc {
  return { ...doc, jobs: doc.jobs.map(j => (j.id === id ? { ...j, notes: notes.slice(0, 4000), updatedAt: now } : j)) };
}

export function deleteJob(doc: JobsDoc, id: string): JobsDoc {
  return { ...doc, jobs: doc.jobs.filter(j => j.id !== id) };
}

export function addCalc(doc: JobsDoc, jobId: string, calc: Omit<SavedCalc, 'id' | 'at'>, now = Date.now()): JobsDoc {
  const item: SavedCalc = { ...calc, id: newId(now), at: now };
  // Most recently used job first.
  const job = doc.jobs.find(j => j.id === jobId);
  if (!job) return doc;
  const updated = { ...job, items: [item, ...job.items], updatedAt: now };
  return { ...doc, jobs: [updated, ...doc.jobs.filter(j => j.id !== jobId)] };
}

export function removeCalc(doc: JobsDoc, jobId: string, calcId: string, now = Date.now()): JobsDoc {
  return { ...doc, jobs: doc.jobs.map(j => (j.id === jobId ? { ...j, items: j.items.filter(i => i.id !== calcId), updatedAt: now } : j)) };
}

/** Plain-text export for the share sheet (email/message to the office). */
export function jobToText(job: Job, disclaimer: string): string {
  const out = [job.name, ''];
  if (job.notes.trim()) out.push(job.notes.trim(), '');
  for (const i of [...job.items].reverse()) {
    out.push(`${i.title} (${new Date(i.at).toLocaleDateString('en-AU')})`);
    for (const l of i.lines) out.push(`  ${l}`);
    out.push('');
  }
  out.push(disclaimer);
  return out.join('\n');
}
