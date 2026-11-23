/**
 * Store-screenshot build only (EXPO_PUBLIC_SCREEDLINE_CAPTURE=1 at bundle time, set by
 * .github/workflows/screedline-capture.yml). Shows every tool as it is during the trial or once unlocked, with an
 * invented job. Normal and TestFlight builds never set the flag, so this never grants access in a shipped app.
 * The demo lines are worked out by the real calculators, so the job sheet always matches the tools.
 */
import type { Job, JobItem } from '../core/jobs.ts';
import { line, showOut } from '../tools/present.ts';
import { defaults, toolById, type Values } from '../tools/registry.ts';

export const CAPTURE = process.env.EXPO_PUBLIC_SCREEDLINE_CAPTURE === '1';

function item(id: string, toolId: string, overrides: Values, savedAt: number): JobItem {
  const tool = toolById(toolId)!;
  const values = defaults(tool, overrides);
  const run = tool.run!(values);
  if (!run.ok) throw new Error(`demo ${toolId} invalid`);
  const h = showOut(run.headline, 'metric');
  const lines = [`${run.headline.label}: ${h.value}${h.unit ? ' ' + h.unit : ''} (${run.headline.caption})`, ...run.outputs.map(o => line(o, 'metric'))];
  return { id, toolId, title: tool.title, values, lines, savedAt };
}

export function demoJobs(now: number): Job[] {
  const day = 86_400_000;
  const slab = item('d1', 'slab', { length: 9.5, width: 5.2, depth: 0.125, edge: 'yes', edgeWidth: 0.3, edgeDepth: 0.3, waste: 5 }, now - 3_600_000);
  const slabRun = toolById('slab')!.run!(slab.values as Values);
  const total = slabRun.ok ? slabRun.headline.value : 8;
  return [
    {
      id: 'demo-driveway', name: '14 Banksia Crescent driveway', notes: 'N25, 100 slump. Pour Thursday 6:30 am. Pump booked.',
      createdAt: now - 2 * day, updatedAt: now - 3_000_000, checks: { 'before.forms': true, 'before.base': true, 'before.reo': true },
      items: [
        item('d3', 'mesh', { length: 9.5, width: 5.2 }, now - 3_000_000),
        item('d2', 'order', { volume: total }, now - 3_400_000),
        slab,
      ],
    },
    {
      id: 'demo-garden', name: 'Nguyen backyard paving', notes: '400 × 400 charcoal pavers. Block wall along the back fence.',
      createdAt: now - 6 * day, updatedAt: now - 2 * day, checks: {},
      items: [
        item('g2', 'retaining', { length: 12, height: 0.6 }, now - 2 * day),
        item('g1', 'pavers', { area: 32, size: '400x400', paverLength: 0.4, paverWidth: 0.4 }, now - 2 * day - 60_000),
      ],
    },
  ];
}
