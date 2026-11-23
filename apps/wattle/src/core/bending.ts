/**
 * Conduit bending: offsets, 3- and 4-point saddles, kicks and 90° stub-ups.
 *
 * Everything here is right-triangle trigonometry on the conduit's centreline, treating each bend as a point
 * (zero radius). That is the standard field method taught in conduit bending manuals, for example:
 *   - Benfield, "Conduit Bending and Fabrication", Benfield Electric (offset multiplier = cosecant of the angle,
 *     shrink = rise × (cosec θ − cot θ) = rise × tan(θ/2)).
 *   - Greenlee / Klein / Ideal bender instruction sheets (same multipliers; shrink per unit of rise
 *     1/16" (10°), 3/16" (22.5°), 1/4" (30°), 3/8" (45°), 1/2" (60°) per inch — rounded values of tan(θ/2)).
 *   - Ugly's Electrical References, "Conduit bending" section (3-point saddle: 45° centre / 22.5° sides,
 *     multiplier ≈ 2.5, centre mark moved 3/16" per inch of height ≈ tan(11.25°)).
 * Results are estimates: real bends have a radius, benders differ and conduit springs back. Mark, bend, check.
 *
 * All lengths are in whatever unit the caller uses (mm or inches); the maths is unit-free.
 */
import { fail, positive, type CalcResult } from './num.ts';

const RAD = Math.PI / 180;
export type Len = (n: number) => string;
const mm: Len = n => `${Math.round(n)} mm`;

/** Common bend angles offered as quick picks (degrees). */
export const OFFSET_ANGLES = [10, 22.5, 30, 45, 60] as const;

export function multiplier(angleDeg: number): number {
  return 1 / Math.sin(angleDeg * RAD);
}

/** Shrink per unit of rise for one offset (two bends of `angleDeg`). */
export function shrinkPerUnit(angleDeg: number): number {
  return Math.tan((angleDeg * RAD) / 2);
}

function angleOk(a: number | null | undefined, max = 90): a is number {
  return typeof a === 'number' && Number.isFinite(a) && a > 0 && a < max;
}

export interface OffsetOut {
  /** Distance between the two bend marks, measured along the conduit. */
  distance: number;
  /** Conduit "used up" by the offset: add it to the distance to the obstacle when measuring to the first mark. */
  shrink: number;
  multiplier: number;
  /** Horizontal travel of the sloped section. */
  run: number;
  /** When `toObstacle` is given: where to put the two marks, measured from the conduit end. */
  firstMark?: number;
  secondMark?: number;
}

/**
 * Two equal bends in opposite directions that move the conduit sideways by `rise`.
 * If `toObstacle` (end of conduit to the start of the obstacle / where the rise must be complete) is given,
 * marks are placed so the conduit reaches full rise at that point.
 */
export function offset(input: { rise: number | null; angle: number | null; toObstacle?: number | null }, len: Len = mm): CalcResult<OffsetOut> {
  const { rise, angle } = input;
  if (!positive(rise)) return fail('Enter the offset depth (rise), more than 0.');
  if (!angleOk(angle)) return fail('Bend angle must be between 0° and 90°.');
  const m = multiplier(angle);
  const distance = rise * m;
  const shrink = rise * shrinkPerUnit(angle);
  const run = rise / Math.tan(angle * RAD);
  const steps = [
    `Multiplier = 1 ÷ sin ${angle}° = ${m.toFixed(3)}`,
    `Distance between marks = rise × multiplier = ${len(rise)} × ${m.toFixed(3)} = ${len(distance)}`,
    `Shrink = rise × tan(${angle}° ÷ 2) = ${len(rise)} × ${shrinkPerUnit(angle).toFixed(4)} = ${len(shrink)}`,
  ];
  const warnings: string[] = [];
  const value: OffsetOut = { distance, shrink, multiplier: m, run };
  const to = input.toObstacle;
  if (to != null) {
    if (!(Number.isFinite(to) && to >= 0)) return fail('Distance to the obstacle must be 0 or more.');
    value.secondMark = to + shrink;
    value.firstMark = value.secondMark - distance;
    steps.push(
      `Second mark = distance to obstacle + shrink = ${len(to)} + ${len(shrink)} = ${len(value.secondMark)}`,
      `First mark = second mark − distance between marks = ${len(value.firstMark)}`,
    );
    if (value.firstMark < 0) warnings.push('The first mark falls before the end of the conduit: use a smaller angle, or a longer piece.');
  }
  if (angle < 10) warnings.push('Very shallow angles give long, hard-to-control offsets.');
  if (angle > 60) warnings.push('Angles above 60° are hard to pull wire through. Check the total bends in the run.');
  return { ok: true, value, steps, warnings };
}

export interface Saddle3Out {
  sideAngle: number;
  centreAngle: number;
  /** Distance from the centre mark to each outer mark, along the conduit. */
  sideDistance: number;
  /** Total conduit taken up by the saddle. */
  shrink: number;
  /** Move the centre mark this far past the obstacle's centre (half the total shrink). */
  centreAdvance: number;
  centreMark?: number;
  firstMark?: number;
  thirdMark?: number;
}

/**
 * 3-point saddle over a round obstacle (pipe): a centre bend of 2θ and two side bends of θ.
 * Default 45° centre / 22.5° sides. `toCentre` = conduit end to the centre of the obstacle.
 */
export function saddle3(input: { height: number | null; centreAngle?: number | null; toCentre?: number | null }, len: Len = mm): CalcResult<Saddle3Out> {
  const { height } = input;
  const centreAngle = input.centreAngle ?? 45;
  if (!positive(height)) return fail('Enter the obstacle height, more than 0.');
  if (!angleOk(centreAngle, 120)) return fail('Centre bend must be between 0° and 120°.');
  const side = centreAngle / 2;
  const sideDistance = height / Math.sin(side * RAD);
  const shrink = 2 * height * Math.tan((side * RAD) / 2);
  const centreAdvance = shrink / 2;
  const steps = [
    `Side bends = ${centreAngle}° ÷ 2 = ${side}° each`,
    `Each outer mark from the centre mark = height ÷ sin ${side}° = ${len(height)} × ${(1 / Math.sin(side * RAD)).toFixed(3)} = ${len(sideDistance)}`,
    `Total shrink = 2 × height × tan(${side}° ÷ 2) = ${len(shrink)}; move the centre mark ${len(centreAdvance)} forward`,
  ];
  if (centreAngle === 45) steps.push('Field rule of thumb for 45°/22.5°: 2.5 × height and 3/16" per inch. Exact trig above is a touch longer.');
  const value: Saddle3Out = { sideAngle: side, centreAngle, sideDistance, shrink, centreAdvance };
  const to = input.toCentre;
  if (to != null) {
    if (!(Number.isFinite(to) && to >= 0)) return fail('Distance to the obstacle centre must be 0 or more.');
    value.centreMark = to + centreAdvance;
    value.firstMark = value.centreMark - sideDistance;
    value.thirdMark = value.centreMark + sideDistance;
    steps.push(`Centre mark = ${len(to)} + ${len(centreAdvance)} = ${len(value.centreMark)}; outer marks at ${len(value.firstMark)} and ${len(value.thirdMark)}`);
  }
  const warnings: string[] = [];
  if (value.firstMark != null && value.firstMark < 0) warnings.push('The first mark falls before the end of the conduit: start with a longer piece.');
  return { ok: true, value, steps, warnings };
}

export interface Saddle4Out {
  distance: number;
  shrinkEach: number;
  shrinkTotal: number;
  marks: [number, number, number, number];
}

/**
 * 4-point saddle over a box-shaped obstacle: two offsets back to back.
 * `toObstacle` = conduit end to the near edge, `width` = obstacle length along the run.
 * Bend 2 meets full height at the near edge; bend 3 starts the drop at the far edge.
 */
export function saddle4(input: { height: number | null; width: number | null; toObstacle: number | null; angle: number | null }, len: Len = mm): CalcResult<Saddle4Out> {
  const { height, width, toObstacle, angle } = input;
  if (!positive(height)) return fail('Enter the obstacle height, more than 0.');
  if (!(typeof width === 'number' && Number.isFinite(width) && width >= 0)) return fail('Enter the obstacle width (0 or more).');
  if (!(typeof toObstacle === 'number' && Number.isFinite(toObstacle) && toObstacle >= 0)) return fail('Enter the distance to the obstacle (0 or more).');
  if (!angleOk(angle)) return fail('Bend angle must be between 0° and 90°.');
  const d = height * multiplier(angle);
  const s = height * shrinkPerUnit(angle);
  const m2 = toObstacle + s;
  const m1 = m2 - d;
  const m3 = toObstacle + width + s;
  const m4 = m3 + d;
  const steps = [
    `Distance between bends of each offset = ${len(height)} × ${multiplier(angle).toFixed(3)} = ${len(d)}`,
    `Shrink for each offset = ${len(height)} × tan(${angle}° ÷ 2) = ${len(s)}`,
    `Mark 2 = ${len(toObstacle)} + ${len(s)} = ${len(m2)}; mark 1 = mark 2 − ${len(d)} = ${len(m1)}`,
    `Mark 3 = ${len(toObstacle)} + width ${len(width)} + ${len(s)} = ${len(m3)}; mark 4 = mark 3 + ${len(d)} = ${len(m4)}`,
    `Total shrink = 2 × ${len(s)} = ${len(2 * s)}`,
  ];
  const warnings: string[] = [];
  if (m1 < 0) warnings.push('Mark 1 falls before the end of the conduit: use a steeper angle or a longer piece.');
  return { ok: true, value: { distance: d, shrinkEach: s, shrinkTotal: 2 * s, marks: [m1, m2, m3, m4] }, steps, warnings };
}

export interface KickOut {
  /** Along the conduit from the bend to where the rise is reached. */
  travel: number;
  /** Horizontal distance from the bend to that point. */
  run: number;
  angle: number;
}

/** Single bend (kick). Give rise + angle, or rise + run to find the angle. */
export function kick(input: { rise: number | null; angle?: number | null; run?: number | null }, len: Len = mm): CalcResult<KickOut> {
  const { rise } = input;
  if (!positive(rise)) return fail('Enter the kick rise, more than 0.');
  let angle = input.angle ?? null;
  const steps: string[] = [];
  if (angle == null || !Number.isFinite(angle)) {
    if (!positive(input.run)) return fail('Enter a bend angle, or the run over which the rise happens.');
    angle = Math.atan(rise / input.run) / RAD;
    steps.push(`Angle = atan(rise ÷ run) = atan(${len(rise)} ÷ ${len(input.run)}) = ${angle.toFixed(1)}°`);
  }
  if (!angleOk(angle)) return fail('Bend angle must be between 0° and 90°.');
  const travel = rise / Math.sin(angle * RAD);
  const run = rise / Math.tan(angle * RAD);
  steps.push(
    `Along the conduit = rise ÷ sin ${angle.toFixed(1)}° = ${len(travel)}`,
    `Horizontal run = rise ÷ tan ${angle.toFixed(1)}° = ${len(run)}`,
  );
  return { ok: true, value: { travel, run, angle }, steps, warnings: [] };
}

export interface StubOut {
  mark: number;
  /** Developed (centreline) length of the 90° bend, when a radius is given. */
  developed?: number;
  /** Gain: conduit saved by the curve compared with a sharp corner (2r − πr/2). */
  gain?: number;
}

/**
 * 90° stub-up: mark = stub height − take-up. Take-up (deduct) is printed on the bender for each conduit size
 * and differs between makes, so it is always entered by the user. With a centreline radius, also shows the
 * developed length (πr/2) and gain (2r − πr/2), handy for spring/heat-bent PVC.
 */
export function stub90(input: { height: number | null; takeUp: number | null; radius?: number | null }, len: Len = mm): CalcResult<StubOut> {
  const { height, takeUp } = input;
  if (!positive(height)) return fail('Enter the stub height (end of conduit to back of the 90°).');
  if (!(typeof takeUp === 'number' && Number.isFinite(takeUp) && takeUp >= 0)) return fail("Enter your bender's take-up for this conduit size.");
  const mark = height - takeUp;
  if (mark <= 0) return fail('The take-up is longer than the stub: the stub is too short for this bender.');
  const steps = [`Mark = stub height − take-up = ${len(height)} − ${len(takeUp)} = ${len(mark)}`];
  const value: StubOut = { mark };
  const r = input.radius;
  if (r != null && Number.isFinite(r)) {
    if (r <= 0) return fail('Bend radius must be more than 0.');
    value.developed = (Math.PI * r) / 2;
    value.gain = 2 * r - value.developed;
    steps.push(
      `Developed length of the curve = π × r ÷ 2 = ${len(value.developed)}`,
      `Gain = 2r − πr/2 = ${len(value.gain)}`,
    );
  }
  return { ok: true, value, steps, warnings: [] };
}
