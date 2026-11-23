// Jobs saved on this iPhone only (AsyncStorage, never uploaded). A job is a site visit: a title, the refrigerant, notes
// and the readings the tech chose to save, each with its working. Pure TypeScript; tested in jobs.test.ts.

export type SavedStep = { label: string; value: string };
export type ReadingKind = 'superheat' | 'subcooling' | 'extra-charge' | 'pt' | 'load' | 'evacuation' | 'note';
export type SavedReading = { id: string; at: number; kind: ReadingKind; title: string; result: string; steps: SavedStep[] };
export type Job = {
  id: string;
  createdAt: number;
  updatedAt: number;
  title: string;
  site: string;
  equipment: string;
  refrigerant: string;
  notes: string;
  readings: SavedReading[];
};

export const JOBS_KEY = 'liquidline.jobs.v1';
export const MAX_TEXT = 2000;

export function newId(now = Date.now(), rand = Math.random()): string {
  return `${now.toString(36)}${Math.floor(rand * 1e8).toString(36)}`;
}

export function newJob(refrigerant: string, now = Date.now(), title = ''): Job {
  return { id: newId(now), createdAt: now, updatedAt: now, title, site: '', equipment: '', refrigerant, notes: '', readings: [] };
}

const str = (v: unknown, max = MAX_TEXT) => (typeof v === 'string' ? v.slice(0, max) : '');
const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const KINDS: ReadingKind[] = ['superheat', 'subcooling', 'extra-charge', 'pt', 'load', 'evacuation', 'note'];

function parseReading(x: unknown): SavedReading | null {
  if (!x || typeof x !== 'object') return null;
  const r = x as Record<string, unknown>;
  const kind = KINDS.includes(r.kind as ReadingKind) ? (r.kind as ReadingKind) : null;
  if (!kind || typeof r.id !== 'string') return null;
  const steps = Array.isArray(r.steps)
    ? r.steps.filter((s) => s && typeof s === 'object').map((s) => ({ label: str((s as SavedStep).label, 200), value: str((s as SavedStep).value, 200) })).slice(0, 40)
    : [];
  return { id: r.id, at: num(r.at, 0), kind, title: str(r.title, 200), result: str(r.result, 200), steps };
}

/** Reads the stored list defensively: anything malformed is dropped, never crashes the app. */
export function parseJobs(raw: string | null | undefined): Job[] {
  if (!raw) return [];
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(v)) return [];
  const out: Job[] = [];
  for (const x of v) {
    if (!x || typeof x !== 'object') continue;
    const j = x as Record<string, unknown>;
    if (typeof j.id !== 'string') continue;
    out.push({
      id: j.id,
      createdAt: num(j.createdAt, 0),
      updatedAt: num(j.updatedAt, num(j.createdAt, 0)),
      title: str(j.title, 200),
      site: str(j.site, 300),
      equipment: str(j.equipment, 300),
      refrigerant: str(j.refrigerant, 20) || 'R32',
      notes: str(j.notes),
      readings: Array.isArray(j.readings) ? (j.readings.map(parseReading).filter(Boolean) as SavedReading[]) : [],
    });
  }
  return sortJobs(out);
}

export function sortJobs(jobs: Job[]): Job[] {
  return [...jobs].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function addReading(job: Job, r: Omit<SavedReading, 'id' | 'at'>, now = Date.now()): Job {
  const reading: SavedReading = { ...r, id: newId(now), at: now };
  return { ...job, updatedAt: now, readings: [reading, ...job.readings] };
}

export function removeReading(job: Job, readingId: string, now = Date.now()): Job {
  return { ...job, updatedAt: now, readings: job.readings.filter((r) => r.id !== readingId) };
}

export function upsertJob(jobs: Job[], job: Job): Job[] {
  const i = jobs.findIndex((j) => j.id === job.id);
  const next = i < 0 ? [job, ...jobs] : jobs.map((j) => (j.id === job.id ? job : j));
  return sortJobs(next);
}

export function jobTitle(job: Job): string {
  return job.title.trim() || job.site.trim() || 'Untitled job';
}

/** Plain-text summary for sharing a job sheet (Messages, email, notes). */
export function jobText(job: Job, date: (ms: number) => string): string {
  const lines = [jobTitle(job)];
  if (job.site) lines.push(`Site: ${job.site}`);
  if (job.equipment) lines.push(`Equipment: ${job.equipment}`);
  lines.push(`Refrigerant: ${job.refrigerant}`);
  if (job.notes) lines.push('', job.notes);
  for (const r of [...job.readings].reverse()) {
    lines.push('', `${r.title}: ${r.result} (${date(r.at)})`);
    for (const s of r.steps) lines.push(`  ${s.label}: ${s.value}`);
  }
  lines.push('', 'Calculated with Liquidline, an aid for licensed technicians. Manufacturer data and local regulations take precedence.');
  return lines.join('\n');
}
