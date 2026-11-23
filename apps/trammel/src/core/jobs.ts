// Saved jobs: a named job holds saved calculations (a tool id and the inputs as typed). Kept on the phone only
// (AsyncStorage key JOBS_KEY); nothing leaves the device. Parsing never throws and drops anything malformed.
import { toolById, type ToolId } from './tools.ts';

export const JOBS_KEY = 'trammel.jobs.v1';

export type SavedCalc = { id: string; tool: ToolId; title: string; summary: string; inputs: Record<string, string>; savedAt: number };
export type Job = { id: string; name: string; createdAt: number; calcs: SavedCalc[] };

export function newId(now: number, rand: () => number = Math.random): string {
  return `${now.toString(36)}${Math.floor(rand() * 1e8).toString(36)}`;
}

function str(v: unknown, max = 200): string | null {
  return typeof v === 'string' ? v.slice(0, max) : null;
}

export function parseJobs(raw: string | null | undefined): Job[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const out: Job[] = [];
  for (const j of data) {
    if (!j || typeof j !== 'object') continue;
    const o = j as Record<string, unknown>;
    const id = str(o.id, 40);
    const name = str(o.name, 80);
    if (!id || name == null) continue;
    const calcs: SavedCalc[] = [];
    for (const c of Array.isArray(o.calcs) ? o.calcs : []) {
      if (!c || typeof c !== 'object') continue;
      const r = c as Record<string, unknown>;
      const tool = str(r.tool, 20);
      const cid = str(r.id, 40);
      if (!tool || !cid || !toolById(tool)) continue;
      const inputs: Record<string, string> = {};
      if (r.inputs && typeof r.inputs === 'object') {
        for (const [k, v] of Object.entries(r.inputs as Record<string, unknown>)) {
          if (typeof v === 'string' && k.length <= 40) inputs[k] = v.slice(0, 4000);
        }
      }
      calcs.push({ id: cid, tool: tool as ToolId, title: str(r.title, 80) ?? '', summary: str(r.summary, 300) ?? '', inputs, savedAt: typeof r.savedAt === 'number' ? r.savedAt : 0 });
    }
    out.push({ id, name: name.trim() || 'Untitled job', createdAt: typeof o.createdAt === 'number' ? o.createdAt : 0, calcs });
  }
  return out;
}

export function addCalc(jobs: Job[], jobId: string, calc: SavedCalc): Job[] {
  return jobs.map((j) => (j.id === jobId ? { ...j, calcs: [calc, ...j.calcs] } : j));
}

export function removeCalc(jobs: Job[], jobId: string, calcId: string): Job[] {
  return jobs.map((j) => (j.id === jobId ? { ...j, calcs: j.calcs.filter((c) => c.id !== calcId) } : j));
}

export function createJob(jobs: Job[], name: string, now: number, rand?: () => number): { jobs: Job[]; job: Job } {
  const job: Job = { id: newId(now, rand), name: name.trim().slice(0, 80) || 'Untitled job', createdAt: now, calcs: [] };
  return { jobs: [job, ...jobs], job };
}

export function renameJob(jobs: Job[], jobId: string, name: string): Job[] {
  const n = name.trim().slice(0, 80);
  return n ? jobs.map((j) => (j.id === jobId ? { ...j, name: n } : j)) : jobs;
}

export function deleteJob(jobs: Job[], jobId: string): Job[] {
  return jobs.filter((j) => j.id !== jobId);
}

/** A plain-text job sheet for sharing (Messages, email). */
export function jobText(job: Job): string {
  const lines = [`${job.name}`, ''];
  for (const c of job.calcs) {
    lines.push(`${c.title}`);
    if (c.summary) lines.push(c.summary);
    lines.push('');
  }
  lines.push('Worked out with Trammel. Verify against the plans and local codes.');
  return lines.join('\n');
}
