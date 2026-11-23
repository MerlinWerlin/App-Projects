/** Saved jobs: a named snapshot of one calculator's inputs and its answer, kept on the phone. */
import type { ToolId } from '../plus/entitlement.ts';

export type JobInputs = Record<string, string | number | boolean>;

export interface Job {
  id: string;
  name: string;
  tool: ToolId;
  inputs: JobInputs;
  /** Short answer lines shown in the list, e.g. "26 tiles · 7 cartons". */
  summary: string[];
  country: string;
  createdAt: number;
  updatedAt: number;
}

const TOOLS: ToolId[] = ['tiles', 'setout', 'materials', 'falls', 'trim', 'stairs'];

export function parseJobs(raw: string | null): Job[] {
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list.filter((j): j is Job =>
      j && typeof j.id === 'string' && typeof j.name === 'string' && TOOLS.includes(j.tool) && j.inputs && typeof j.inputs === 'object' &&
      Array.isArray(j.summary) && typeof j.createdAt === 'number' && typeof j.updatedAt === 'number');
  } catch { return []; }
}

export const newJobId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** A plain-text copy of a job to share by Messages or email. */
export function jobText(job: Job, toolName: string, steps: Array<{ label: string; result: string; working: string }>): string {
  const lines = [`${job.name} (${toolName})`, ...job.summary, '', 'Working:', ...steps.map(s => `• ${s.label}: ${s.working} = ${s.result}`), '', 'Worked out with Groutline. Check quantities against the product data sheet before ordering.'];
  return lines.join('\n');
}
