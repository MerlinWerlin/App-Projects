/**
 * Pipe offsets.
 *
 * A simple offset moves a pipe sideways by the OFFSET (US: "set") using two fittings of the same angle θ.
 * The diagonal centre line between the fittings is a right triangle with the offset as the side opposite θ:
 *   travel (diagonal, centre to centre) = offset ÷ sin θ  (= offset × cosec θ, the "offset multiplier")
 *   run (advance along the pipe)        = offset ÷ tan θ  (= offset × cot θ)
 * Source: right-triangle trigonometry as used in pipe fitting: T. W. Frankland, "The Pipe Fitter's and Pipe
 * Welder's Handbook" (Glencoe/McGraw-Hill), offset and rolling-offset tables; J. Hamilton, "Pipe Fitter's Math
 * Guide" (Construction Trades Press). Their multiplier tables match cosec θ: 45° → 1.414 (√2), 60° → 1.155,
 * 22.5° → 2.613, 11.25° → 5.126, 30° → 2.000.
 *
 * A rolling offset moves the pipe in two directions at once (rise and roll/spread). The true offset is the
 * diagonal of the rise × roll rectangle, √(rise² + roll²) (Pythagoras), and is then used as a simple offset:
 *   travel = true offset ÷ sin θ, setback (run) = true offset ÷ tan θ.
 * The fitting is rotated (rolled) from the rise plane by atan(roll ÷ rise).
 * Same sources as above (rolling offset chapter).
 *
 * Cut length of the diagonal piece = travel − take-off of fitting A − take-off of fitting B (see cut.ts).
 */
import { A, F, L, clean, fail, isNonNeg, isPos, type CalcResult, type Step } from './steps';

export const FITTING_ANGLES = [11.25, 22.5, 30, 45, 60, 90] as const;

const rad = (deg: number) => (deg * Math.PI) / 180;

export interface OffsetInput {
  /** Offset (set), mm, centre line to centre line. */
  offset: number;
  /** Fitting angle in degrees, 0 < θ ≤ 90. */
  angle: number;
  /** Optional take-off of each fitting, mm (centre to the end of the pipe inside the fitting). */
  takeoffA?: number;
  takeoffB?: number;
}

export interface OffsetResult {
  travel: number;
  run: number;
  multiplier: number;
  /** Present when take-offs were given. */
  cut?: number;
}

export function validAngle(angle: number): boolean {
  return Number.isFinite(angle) && angle > 0 && angle <= 90;
}

/** cosec θ, the number the offset is multiplied by to get travel. */
export function offsetMultiplier(angle: number): number {
  return 1 / Math.sin(rad(angle));
}

function cutLine(travel: number, a: number | undefined, b: number | undefined, steps: Step[], warnings: string[]) {
  if (a === undefined && b === undefined) return undefined;
  const ta = a ?? 0;
  const tb = b ?? 0;
  const cut = travel - ta - tb;
  steps.push({ label: 'Cut length', formula: 'Travel − take-off A − take-off B', inputs: [L(travel), L(ta), L(tb)], result: L(cut) });
  if (cut <= 0) warnings.push('The fittings overlap at this offset: there’s no room for a piece of pipe. Use a smaller fitting angle or a bigger offset.');
  return cut;
}

export function simpleOffset(input: OffsetInput): CalcResult<OffsetResult> {
  const { offset, angle } = input;
  if (!isPos(offset)) return fail('Enter the offset (more than 0)', 'offset');
  if (!validAngle(angle)) return fail('Fitting angle must be more than 0° and up to 90°', 'angle');
  if (input.takeoffA !== undefined && !isNonNeg(input.takeoffA)) return fail('Take-off can’t be negative', 'takeoffA');
  if (input.takeoffB !== undefined && !isNonNeg(input.takeoffB)) return fail('Take-off can’t be negative', 'takeoffB');
  const multiplier = offsetMultiplier(angle);
  const travel = offset * multiplier;
  const run = clean(offset / Math.tan(rad(angle)));
  const steps: Step[] = [
    { label: 'Multiplier', formula: '1 ÷ sin θ', inputs: [A(angle)], result: F(multiplier) },
    { label: 'Travel', formula: 'Offset × multiplier', inputs: [L(offset), F(multiplier)], result: L(travel) },
    { label: 'Run', formula: 'Offset ÷ tan θ', inputs: [L(offset), A(angle)], result: L(run) },
  ];
  const warnings: string[] = [];
  const cut = cutLine(travel, input.takeoffA, input.takeoffB, steps, warnings);
  return { ok: true, value: { travel, run, multiplier, cut }, steps, warnings };
}

export interface RollingInput {
  /** Vertical (or first-plane) offset, mm. */
  rise: number;
  /** Horizontal (second-plane) offset, also called roll or spread, mm. */
  roll: number;
  angle: number;
  takeoffA?: number;
  takeoffB?: number;
}

export interface RollingResult extends OffsetResult {
  trueOffset: number;
  /** Degrees to turn the fitting from the rise plane. */
  rollAngle: number;
}

export function rollingOffset(input: RollingInput): CalcResult<RollingResult> {
  const { rise, roll, angle } = input;
  if (!isNonNeg(rise)) return fail('Enter the rise (0 or more)', 'rise');
  if (!isNonNeg(roll)) return fail('Enter the roll (0 or more)', 'roll');
  if (rise === 0 && roll === 0) return fail('Rise and roll can’t both be 0', 'rise');
  if (!validAngle(angle)) return fail('Fitting angle must be more than 0° and up to 90°', 'angle');
  if (input.takeoffA !== undefined && !isNonNeg(input.takeoffA)) return fail('Take-off can’t be negative', 'takeoffA');
  if (input.takeoffB !== undefined && !isNonNeg(input.takeoffB)) return fail('Take-off can’t be negative', 'takeoffB');
  const trueOffset = Math.hypot(rise, roll);
  const multiplier = offsetMultiplier(angle);
  const travel = trueOffset * multiplier;
  const run = clean(trueOffset / Math.tan(rad(angle)));
  const rollAngle = (Math.atan2(roll, rise) * 180) / Math.PI;
  const steps: Step[] = [
    { label: 'True offset', formula: '√(rise² + roll²)', inputs: [L(rise), L(roll)], result: L(trueOffset) },
    { label: 'Multiplier', formula: '1 ÷ sin θ', inputs: [A(angle)], result: F(multiplier) },
    { label: 'Travel', formula: 'True offset × multiplier', inputs: [L(trueOffset), F(multiplier)], result: L(travel) },
    { label: 'Setback (run)', formula: 'True offset ÷ tan θ', inputs: [L(trueOffset), A(angle)], result: L(run) },
    { label: 'Roll the fitting', formula: 'atan(roll ÷ rise)', inputs: [L(roll), L(rise)], result: A(rollAngle) },
  ];
  const warnings: string[] = [];
  const cut = cutLine(travel, input.takeoffA, input.takeoffB, steps, warnings);
  return { ok: true, value: { travel, run, multiplier, cut, trueOffset, rollAngle }, steps, warnings };
}

/** The fitting angle that makes an offset fit a given run (for "I only have this much room"). */
export function angleForRun(offset: number, run: number): CalcResult<{ angle: number; travel: number }> {
  if (!isPos(offset)) return fail('Enter the offset (more than 0)', 'offset');
  if (!isNonNeg(run)) return fail('Enter the run (0 or more)', 'run');
  const angle = (Math.atan2(offset, run) * 180) / Math.PI;
  const travel = Math.hypot(offset, run);
  return {
    ok: true,
    value: { angle, travel },
    steps: [
      { label: 'Angle', formula: 'atan(offset ÷ run)', inputs: [L(offset), L(run)], result: A(angle) },
      { label: 'Travel', formula: '√(offset² + run²)', inputs: [L(offset), L(run)], result: L(travel) },
    ],
    warnings: [],
  };
}
