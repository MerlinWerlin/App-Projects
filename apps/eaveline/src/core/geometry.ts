/**
 * Roof geometry from plan dimensions and pitch.
 *
 * Method: right-triangle trigonometry of a pitched plane (any carpentry/roof-framing text, e.g.
 * "Roof framing" in the Australian Certificate III Carpentry unit CPCCCA3010 and the US IRC framing
 * tables, all use the same relations):
 *   rise           = run · tan θ
 *   rafter (slope) = run / cos θ = √(run² + rise²)
 *   roof area      = plan area / cos θ   (true for any roof whose planes all share one pitch θ,
 *                                          because every plane's slope area = its plan area / cos θ)
 *   hip / valley   = √(run₁² + run₂² + rise²)  where run₁, run₂ are the runs of the two planes that meet;
 *                    equal pitches give run₁ = run₂ and a 45° plan angle, so hip = √(2·run² + rise²)
 *   hip pitch      = atan(rise / √(run₁² + run₂²))
 * Dimensions are the roof outline in plan at the eaves (outside of fascia), so overhangs are included.
 */
import { cap, fail, type Ctx, type Result, type Step } from './context';
import { isPitch, num, toDeg, toRad } from './units';

export type RoofType = 'gable' | 'hip' | 'skillion';

/** One roof plane (for sheet and tile layout). Rect: eave = top. Trap: hip side. Tri: hip end. */
export interface Plane {
  shape: 'rect' | 'trap' | 'tri';
  eaveMm: number; // length along the eave
  topMm: number; // length along the ridge (0 for a triangle)
  slopeMm: number; // eave-to-ridge slope length (common rafter)
  runMm: number; // horizontal run (eave to ridge in plan)
  count: number;
}

export interface RoofGeometry {
  type: RoofType;
  lengthMm: number;
  widthMm: number;
  pitchDeg: number;
  runMm: number;
  riseMm: number;
  rafterMm: number;
  planAreaM2: number;
  roofAreaM2: number;
  ridgeMm: number; // total ridge (0 for skillion)
  topEdgeMm: number; // skillion high-side edge (0 otherwise)
  hipEachMm: number;
  hipCount: number;
  hipPitchDeg: number;
  bargeEachMm: number;
  bargeCount: number;
  eavesMm: number; // total eave (gutter) length
  planes: Plane[];
  swapped: boolean;
}

export interface RoofInput { type: RoofType; lengthMm: number; widthMm: number; pitchDeg: number }

const positive = (n: number) => Number.isFinite(n) && n > 0;

export function roofGeometry(input: RoofInput, ctx: Ctx): Result<RoofGeometry> {
  let { lengthMm: L, widthMm: W } = input;
  const { type, pitchDeg: p } = input;
  if (!positive(L) || !positive(W)) return fail('Enter the roof length and width (both more than zero).');
  if (!isPitch(p) || p <= 0) return fail('Enter a pitch between 0° and 75°.');
  if (L > 500_000 || W > 500_000) return fail('That roof is over 500 m long. Check the units.');
  let swapped = false;
  if (type !== 'skillion' && W > L) {
    [L, W] = [W, L];
    swapped = true;
  }
  const t = toRad(p);
  const run = type === 'skillion' ? W : W / 2;
  const rise = run * Math.tan(t);
  const rafter = run / Math.cos(t);
  const planArea = (L * W) / 1e6;
  const roofArea = planArea / Math.cos(t);
  const steps: Step[] = [];
  const notes: string[] = [];
  if (swapped) notes.push('Length and width were swapped so the ridge runs along the longer side.');
  steps.push({ label: 'Run', formula: type === 'skillion' ? 'run = width' : 'run = width ÷ 2', value: ctx.len(run) });
  steps.push({ label: 'Rise', formula: `rise = run × tan ${num(p, 2)}°`, value: ctx.len(rise) });
  steps.push({ label: 'Common rafter (slope length)', formula: `run ÷ cos ${num(p, 2)}°`, value: ctx.len(rafter) });
  steps.push({ label: 'Plan area', formula: 'length × width', value: ctx.area(planArea) });
  steps.push({ label: 'Roof (surface) area', formula: `plan area ÷ cos ${num(p, 2)}° (pitch factor ${num(1 / Math.cos(t), 4)})`, value: ctx.area(roofArea) });

  let ridge = 0, topEdge = 0, hipEach = 0, hipCount = 0, hipPitch = 0, bargeEach = 0, bargeCount = 0, eaves = 0;
  let planes: Plane[] = [];
  if (type === 'gable') {
    ridge = L;
    bargeEach = rafter;
    bargeCount = 4;
    eaves = 2 * L;
    planes = [{ shape: 'rect', eaveMm: L, topMm: L, slopeMm: rafter, runMm: run, count: 2 }];
    steps.push({ label: cap(ctx.terms.ridge), formula: 'ridge = length', value: ctx.len(ridge) });
    steps.push({ label: `${cap(ctx.terms.barge)}s`, formula: '4 × common rafter (2 each gable end)', value: `4 × ${ctx.len(rafter)} = ${ctx.run(4 * rafter)}` });
  } else if (type === 'hip') {
    ridge = L - W;
    hipEach = Math.sqrt(2 * run * run + rise * rise);
    hipCount = 4;
    hipPitch = toDeg(Math.atan(rise / (run * Math.SQRT2)));
    eaves = 2 * (L + W);
    planes = [
      ...(ridge > 0 ? [{ shape: 'trap' as const, eaveMm: L, topMm: ridge, slopeMm: rafter, runMm: run, count: 2 }]
        : [{ shape: 'tri' as const, eaveMm: L, topMm: 0, slopeMm: rafter, runMm: run, count: 2 }]),
      { shape: 'tri', eaveMm: W, topMm: 0, slopeMm: rafter, runMm: run, count: 2 },
    ];
    steps.push({ label: cap(ctx.terms.ridge), formula: 'ridge = length − width (equal pitches)', value: ridge > 0 ? ctx.len(ridge) : 'none (pyramid roof)' });
    steps.push({ label: 'Hip length (each)', formula: '√(2 × run² + rise²)', value: ctx.len(hipEach) });
    steps.push({ label: 'Hips', formula: '4 hips', value: ctx.run(4 * hipEach) });
    steps.push({ label: 'Hip pitch', formula: 'atan(rise ÷ (run × √2))', value: ctx.pitch(hipPitch) });
  } else {
    topEdge = L;
    bargeEach = rafter;
    bargeCount = 2;
    eaves = L;
    planes = [{ shape: 'rect', eaveMm: L, topMm: L, slopeMm: rafter, runMm: run, count: 1 }];
    steps.push({ label: 'High-side edge', formula: 'top edge = length', value: ctx.len(topEdge) });
    steps.push({ label: `${cap(ctx.terms.barge)}s`, formula: '2 × rafter (one each side)', value: ctx.run(2 * rafter) });
  }
  steps.push({ label: `Eaves (${ctx.terms.gutter} line)`, formula: type === 'hip' ? '2 × (length + width)' : type === 'gable' ? '2 × length' : 'length (low side)', value: ctx.run(eaves) });
  return {
    ok: true,
    value: { type, lengthMm: L, widthMm: W, pitchDeg: p, runMm: run, riseMm: rise, rafterMm: rafter, planAreaM2: planArea, roofAreaM2: roofArea,
      ridgeMm: ridge, topEdgeMm: topEdge, hipEachMm: hipEach, hipCount, hipPitchDeg: hipPitch, bargeEachMm: bargeEach, bargeCount, eavesMm: eaves, planes, swapped },
    steps, notes,
  };
}

export interface RafterInput { runMm: number; pitchDeg: number; overhangMm: number }
export interface Rafter { riseMm: number; rafterMm: number; overhangSlopeMm: number; totalMm: number; pitchFactor: number }

/** Common rafter from run and pitch, plus the eave overhang measured level (in plan). */
export function rafter(input: RafterInput, ctx: Ctx): Result<Rafter> {
  const { runMm: run, pitchDeg: p, overhangMm: oh } = input;
  if (!positive(run)) return fail('Enter the run (more than zero).');
  if (!isPitch(p) || p <= 0) return fail('Enter a pitch between 0° and 75°.');
  if (!Number.isFinite(oh) || oh < 0) return fail('The overhang can’t be negative.');
  const c = Math.cos(toRad(p));
  const rise = run * Math.tan(toRad(p));
  const r = run / c;
  const ohs = oh / c;
  return {
    ok: true,
    value: { riseMm: rise, rafterMm: r, overhangSlopeMm: ohs, totalMm: r + ohs, pitchFactor: 1 / c },
    steps: [
      { label: 'Pitch factor', formula: `1 ÷ cos ${num(p, 2)}°`, value: num(1 / c, 4) },
      { label: 'Rise', formula: `run × tan ${num(p, 2)}°`, value: ctx.len(rise) },
      { label: 'Rafter to ridge line', formula: 'run × pitch factor', value: ctx.len(r) },
      { label: 'Overhang along the slope', formula: 'overhang × pitch factor', value: ctx.len(ohs) },
      { label: 'Total rafter length', formula: 'rafter + overhang', value: ctx.len(r + ohs) },
    ],
    notes: ['Lengths are to the ridge line. Deduct half the ridge board thickness (measured level) for a cut length.'],
  };
}

export interface HipInput { runMm: number; pitchDeg: number; pitch2Deg?: number | null }
export interface Hip { riseMm: number; run2Mm: number; commonMm: number; common2Mm: number; hipMm: number; hipPlanMm: number; hipPitchDeg: number; planAngleDeg: number }

/**
 * Hip or valley rafter where two planes meet over a level eave corner (90° in plan).
 * Equal pitches: plan angle 45°. Unequal: the second plane's run is set by the shared rise.
 */
export function hipValley(input: HipInput, ctx: Ctx): Result<Hip> {
  const { runMm: run, pitchDeg: p } = input;
  const p2 = input.pitch2Deg ?? p;
  if (!positive(run)) return fail('Enter the run (more than zero).');
  if (!isPitch(p) || p <= 0 || !isPitch(p2) || p2 <= 0) return fail('Enter pitches between 0° and 75°.');
  const rise = run * Math.tan(toRad(p));
  const run2 = rise / Math.tan(toRad(p2));
  const plan = Math.hypot(run, run2);
  const hip = Math.hypot(plan, rise);
  const hipPitch = toDeg(Math.atan(rise / plan));
  // The hip runs from the corner to where the ridges meet: run₂ along the first eave and run₁ in from it.
  const angle = toDeg(Math.atan(run / run2));
  const common = run / Math.cos(toRad(p));
  const common2 = run2 / Math.cos(toRad(p2));
  const steps: Step[] = [
    { label: 'Rise', formula: `run × tan ${num(p, 2)}°`, value: ctx.len(rise) },
  ];
  if (Math.abs(p2 - p) > 1e-9) steps.push({ label: 'Run of the second plane', formula: `rise ÷ tan ${num(p2, 2)}°`, value: ctx.len(run2) });
  steps.push(
    { label: 'Hip/valley in plan', formula: Math.abs(p2 - p) > 1e-9 ? '√(run₁² + run₂²)' : 'run × √2', value: ctx.len(plan) },
    { label: 'Hip/valley true length', formula: '√(plan² + rise²)', value: ctx.len(hip) },
    { label: 'Hip/valley pitch', formula: 'atan(rise ÷ plan)', value: ctx.pitch(hipPitch) },
    { label: 'Plan angle from the first eave', formula: 'atan(run₁ ÷ run₂)', value: `${num(angle, 1)}°` },
    { label: 'Plan angle from the second eave', formula: '90° − first', value: `${num(90 - angle, 1)}°` },
  );
  return { ok: true, value: { riseMm: rise, run2Mm: run2, commonMm: common, common2Mm: common2, hipMm: hip, hipPlanMm: plan, hipPitchDeg: hipPitch, planAngleDeg: angle }, steps,
    notes: ['Length is centreline to centreline at the ridge; allow for the ridge board and overhang when cutting.'] };
}

export interface PitchInput { riseMm: number; runMm: number }
/** Pitch from a measured rise and run (any matching unit). */
export function pitchFromRiseRun(input: PitchInput, ctx: Ctx): Result<{ deg: number }> {
  const { riseMm: rise, runMm: run } = input;
  if (!positive(run)) return fail('Enter a run more than zero.');
  if (!Number.isFinite(rise) || rise < 0) return fail('Enter a rise of zero or more.');
  const deg = toDeg(Math.atan(rise / run));
  if (deg > 75) return fail('That is steeper than 75°. Check the rise and run.');
  return { ok: true, value: { deg }, steps: [{ label: 'Pitch', formula: 'atan(rise ÷ run)', value: ctx.pitch(deg) }], notes: [] };
}
