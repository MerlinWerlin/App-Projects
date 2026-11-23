/** Saved jobs, stored on the phone only (AsyncStorage). Pure functions, tested in jobs.test.ts. */
export interface JobItem {
  id: string;
  toolId: string;
  title: string;
  /** Canonical metric inputs, so the tool can reopen them in either unit system. */
  values: Record<string, unknown>;
  /** The answer as shown when saved, e.g. ["Concrete to order: 2.52 m³", "Net volume: 2.400 m³"]. */
  lines: string[];
  savedAt: number;
}
export interface Job {
  id: string;
  name: string;
  notes: string;
  createdAt: number;
  updatedAt: number;
  items: JobItem[];
  /** Pour-day checklist ticks for this job. */
  checks: Record<string, boolean>;
}

export const JOBS_KEY = 'screedline.jobs.v1';

export function newId(now: number, rand: () => number = Math.random): string {
  return `${now.toString(36)}${Math.floor(rand() * 1e9).toString(36)}`;
}

export function makeJob(name: string, now: number, id = newId(now)): Job {
  return { id, name: cleanName(name) || 'Untitled job', notes: '', createdAt: now, updatedAt: now, items: [], checks: {} };
}

export const cleanName = (s: string) => s.replace(/\s+/g, ' ').trim().slice(0, 80);

function isItem(x: unknown): x is JobItem {
  const i = x as JobItem;
  return !!i && typeof i.id === 'string' && typeof i.toolId === 'string' && typeof i.title === 'string' && Array.isArray(i.lines) && typeof i.savedAt === 'number';
}

/** Reads stored jobs; anything malformed is dropped rather than crashing the app. */
export function parseJobs(raw: string | null | undefined): Job[] {
  if (!raw) return [];
  try {
    const list = JSON.parse(raw) as unknown;
    if (!Array.isArray(list)) return [];
    return list
      .filter((j): j is Job => !!j && typeof (j as Job).id === 'string' && typeof (j as Job).name === 'string')
      .map(j => ({
        id: j.id,
        name: j.name,
        notes: typeof j.notes === 'string' ? j.notes : '',
        createdAt: Number(j.createdAt) || 0,
        updatedAt: Number(j.updatedAt) || 0,
        items: Array.isArray(j.items) ? j.items.filter(isItem).map(i => ({ ...i, values: i.values && typeof i.values === 'object' ? i.values : {}, lines: i.lines.map(String) })) : [],
        checks: j.checks && typeof j.checks === 'object' ? j.checks : {},
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export function addItem(jobs: Job[], jobId: string, item: JobItem, now: number): Job[] {
  return jobs.map(j => (j.id === jobId ? { ...j, items: [item, ...j.items], updatedAt: now } : j)).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function removeItem(jobs: Job[], jobId: string, itemId: string, now: number): Job[] {
  return jobs.map(j => (j.id === jobId ? { ...j, items: j.items.filter(i => i.id !== itemId), updatedAt: now } : j));
}

export function updateJob(jobs: Job[], jobId: string, patch: Partial<Pick<Job, 'name' | 'notes' | 'checks'>>, now: number): Job[] {
  return jobs.map(j => (j.id === jobId ? { ...j, ...patch, name: patch.name !== undefined ? cleanName(patch.name) || j.name : j.name, updatedAt: now } : j));
}

export const SUPPLIER_NOTE = 'Quantities are estimates. Confirm with your supplier, and with your engineer for anything structural.';

/** Plain-text job sheet for Messages, email or a supplier. */
export function jobSheet(job: Job, date: (ms: number) => string): string {
  const out: string[] = [job.name.toUpperCase()];
  if (job.notes.trim()) out.push(job.notes.trim());
  out.push('');
  if (!job.items.length) out.push('No calculations saved yet.');
  for (const item of [...job.items].reverse()) {
    out.push(`${item.title} (${date(item.savedAt)})`);
    for (const line of item.lines) out.push(`  ${line}`);
    out.push('');
  }
  out.push(SUPPLIER_NOTE);
  out.push('Made with Screedline');
  return out.join('\n');
}
