/**
 * Fall (grade) of a drain.
 *
 * A grade of 1:N means the pipe drops 1 unit for every N units of horizontal length.
 *   drop = length ÷ N,  percent = 100 ÷ N,  mm per metre = 1000 ÷ N.
 * AS/NZS 3500.2 expresses drain grades as percentages (e.g. 1.65 % ≈ 1:60, 2.5 % = 1:40); these are the same
 * quantity (Standards Australia, AS/NZS 3500.2 Plumbing and drainage – Sanitary plumbing and drainage).
 * Invert levels: downstream invert = upstream invert − drop (levels in metres, e.g. RL / AHD).
 */
import { L, P, F, fail, isPos, type CalcResult, type Step, type Value } from './steps';

export type GradeInput =
  | { kind: 'ratio'; n: number } // 1:N
  | { kind: 'percent'; pct: number }
  | { kind: 'mmPerM'; mm: number }
  | { kind: 'inPerFt'; inches: number }; // US style: 1/4 in per foot = 1:48

/** Returns N of 1:N, or null when not a valid grade. */
export function gradeN(g: GradeInput): number | null {
  const n = g.kind === 'ratio' ? g.n : g.kind === 'percent' ? 100 / g.pct : g.kind === 'mmPerM' ? 1000 / g.mm : 12 / g.inches;
  return Number.isFinite(n) && n > 0 ? n : null;
}

export const COMMON_GRADES = [20, 40, 60, 80, 100, 200] as const;

export interface FallInput {
  /** Horizontal length of the run, mm. */
  length: number;
  grade: GradeInput;
  /** Optional upstream invert level, metres (RL). */
  startLevel?: number;
}

export interface FallResult {
  drop: number;
  n: number;
  percent: number;
  mmPerMetre: number;
  endLevel?: number;
  /** Length along the pipe (slightly longer than the horizontal length). */
  pipeLength: number;
}

const M = (n: number): Value => ({ kind: 'text', n, s: `${n.toFixed(3)} m` });

export function fall(input: FallInput): CalcResult<FallResult> {
  if (!isPos(input.length)) return fail('Enter the length of the run (more than 0)', 'length');
  const n = gradeN(input.grade);
  if (n === null) return fail('Enter a grade above 0', 'grade');
  if (n < 1) return fail('That’s steeper than 45° (1:1). Enter a drain grade such as 1:40', 'grade');
  const drop = input.length / n;
  const percent = 100 / n;
  const mmPerMetre = 1000 / n;
  const pipeLength = Math.hypot(input.length, drop);
  const steps: Step[] = [
    { label: 'Grade', formula: '1 : N', inputs: [], result: { kind: 'text', n, s: `1 : ${trim(n)}` } },
    { label: 'Percent', formula: '100 ÷ N', inputs: [F(n)], result: P(percent) },
    { label: 'Fall per metre', formula: '1000 mm ÷ N', inputs: [F(n)], result: L(mmPerMetre) },
    { label: 'Total fall', formula: 'Length ÷ N', inputs: [L(input.length), F(n)], result: L(drop) },
  ];
  let endLevel: number | undefined;
  if (input.startLevel !== undefined) {
    if (!Number.isFinite(input.startLevel)) return fail('Enter the start level in metres', 'startLevel');
    endLevel = input.startLevel - drop / 1000;
    steps.push({ label: 'Finish level', formula: 'Start level − total fall', inputs: [M(input.startLevel), L(drop)], result: M(endLevel) });
  }
  return { ok: true, value: { drop, n, percent, mmPerMetre, endLevel, pipeLength }, steps, warnings: [] };
}

/** Grade from a measured drop over a length (checking an existing pipe). */
export function gradeFromDrop(length: number, drop: number): CalcResult<{ n: number; percent: number }> {
  if (!isPos(length)) return fail('Enter the length (more than 0)', 'length');
  if (!isPos(drop)) return fail('Enter the drop (more than 0)', 'drop');
  const n = length / drop;
  const percent = (drop / length) * 100;
  return {
    ok: true,
    value: { n, percent },
    steps: [
      { label: 'Grade', formula: 'Length ÷ drop = N', inputs: [L(length), L(drop)], result: { kind: 'text', n, s: `1 : ${trim(n)}` } },
      { label: 'Percent', formula: 'Drop ÷ length × 100', inputs: [L(drop), L(length)], result: P(percent) },
    ],
    warnings: [],
  };
}

export function trim(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}
