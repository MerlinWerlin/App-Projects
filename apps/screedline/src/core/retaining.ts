/**
 * Segmental (dry-stacked) retaining wall block take-off. Metric inputs (m).
 *
 * - Courses = ⌈(exposed height + buried depth) ÷ block height⌉; blocks per course = ⌈length ÷ block length⌉.
 *   Block makers' installation guides bury the first course (at least about 100–150 mm, or roughly a tenth of
 *   the wall height), so the buried depth is an input (default 150 mm).
 * - Capping units = ⌈length ÷ cap length⌉.
 * - Drainage: 300 mm wide free-draining aggregate behind the blocks for the full height, with a 100 mm
 *   ag pipe at the base (typical block-maker detail). Aggregate weight at 1.52 t/m³ (gravel, loose dry,
 *   Engineering ToolBox).
 * - Levelling pad: compacted road base, block depth + 300 mm wide × 150 mm deep (typical detail).
 * - Approval depends on the state: NSW exempt development stops at 600 mm (and 1 m from boundaries); Queensland
 *   councils generally need approval over 1 m. Walls near boundaries or buildings, or carrying loads, may need
 *   an engineer at any height (council fact sheets, e.g. Wollondilly NSW, Moreton Bay and Gold Coast Qld).
 */
import { type Calc, type Errors, type Step, check, fail, hasErrors, ok } from './calc.ts';
import { ceilCount, fmt } from './units.ts';

export interface WallInput {
  length: number | null; height: number | null; buried: number | null;
  blockLength: number | null; blockHeight: number | null; blockDepth: number | null;
  capLength: number | null; wastePct: number | null;
  drainWidth: number | null;
  /** Country-specific approval wording (country.ts). */
  approvalNote?: string;
}
export interface WallResult {
  courses: number; perCourse: number; blocks: number; caps: number;
  drainM3: number; drainT: number; padM3: number; agPipe: number;
}

export function retainingWall(i: WallInput): Calc<WallResult> {
  const e: Errors = {};
  const L = check(e, 'length', i.length, { label: 'Wall length', max: 10000 });
  const H = check(e, 'height', i.height, { label: 'Height', max: 10 });
  const b = check(e, 'buried', i.buried, { label: 'Buried depth', min: 0, exclusive: false, max: 2 });
  const bl = check(e, 'blockLength', i.blockLength, { label: 'Block length', max: 3 });
  const bh = check(e, 'blockHeight', i.blockHeight, { label: 'Block height', max: 2 });
  const bdp = check(e, 'blockDepth', i.blockDepth, { label: 'Block depth', max: 3 });
  const cl = check(e, 'capLength', i.capLength, { label: 'Cap length', min: 0, exclusive: false, max: 3 });
  const w = check(e, 'waste', i.wastePct, { label: 'Waste', min: 0, exclusive: false, max: 100 });
  const dw = check(e, 'drainWidth', i.drainWidth, { label: 'Drainage width', min: 0, exclusive: false, max: 3 });
  if (hasErrors(e)) return fail(e);
  const total = H + b;
  const courses = ceilCount(total / bh);
  const perCourse = ceilCount(L / bl);
  const blocks = ceilCount(courses * perCourse * (1 + w / 100));
  const caps = cl > 0 ? ceilCount(L / cl) : 0;
  const drainM3 = L * total * dw;
  const padM3 = L * (bdp + 0.3) * 0.15;
  const steps: Step[] = [
    { label: 'Courses', working: `⌈(${fmt(H * 1000, 0)} + ${fmt(b * 1000, 0)}) mm ÷ ${fmt(bh * 1000, 0)} mm⌉`, result: `${courses}` },
    { label: 'Blocks per course', working: `⌈${fmt(L, 2)} m ÷ ${fmt(bl * 1000, 0)} mm⌉`, result: `${perCourse}` },
    { label: 'Blocks', working: `${courses} × ${perCourse}${w ? ` + ${fmt(w, 0)} %` : ''}`, result: `${blocks}` },
  ];
  if (cl > 0) steps.push({ label: 'Capping units', working: `⌈${fmt(L, 2)} m ÷ ${fmt(cl * 1000, 0)} mm⌉`, result: `${caps}` });
  if (dw > 0) steps.push({ label: 'Drainage aggregate', working: `${fmt(L, 2)} m × ${fmt(total, 2)} m × ${fmt(dw * 1000, 0)} mm`, result: `${fmt(drainM3, 2)} m³ (${fmt(drainM3 * 1.52, 2)} t)` });
  steps.push({ label: 'Levelling pad (road base)', working: `${fmt(L, 2)} m × (${fmt(bdp * 1000, 0)} + 300) mm × 150 mm`, result: `${fmt(padM3, 2)} m³` });
  const notes = ['Follow the block maker’s installation guide for setback, geogrid and drainage.'];
  if (H > 0.6) notes.unshift(i.approvalNote ?? 'Taller walls, or walls near boundaries, buildings or loads, may need approval and an engineer’s design. Check with your local council.');
  return ok({ courses, perCourse, blocks, caps, drainM3, drainT: drainM3 * 1.52, padM3, agPipe: Math.ceil(L) }, steps, notes);
}
