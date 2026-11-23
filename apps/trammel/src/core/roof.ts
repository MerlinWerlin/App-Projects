// Roof pitch, common rafters, birdsmouths, and hips/valleys/creepers on a regular (equal-pitch, 45° in plan) roof.
//
// Sources and conventions:
//  - Right-triangle trigonometry of the roof triangle: rise = run x tan(pitch), length = run / cos(pitch).
//    This is the same maths as the framing-square rafter tables (e.g. Stanley / Swanson rafter tables: common
//    rafter length per unit run = sqrt(1 + (rise/run)^2)).
//  - Pitch in Australia is quoted in degrees; "x in 12" (rise in inches per foot of run) is the US form.
//  - Common rafter: run = half the span (outside of wall plates) minus half the ridge thickness. Lengths are along
//    the set-out line through the birdsmouth heel; the eave (overhang) is measured level from the wall line.
//  - Birdsmouth: seat length S level on the plate. Plumb face height = S x tan(pitch). Depth of the notch
//    square to the rafter edge = S x sin(pitch). Height above plate at the wall line (HAP) = D / cos(pitch) - S x tan(pitch).
//    Keeping the notch to a third of the rafter depth is a widely used rule (AS 1684 sets the actual limits; check it).
//  - Regular hip or valley (both roof planes at the same pitch, hip at 45° in plan): hip run = common run x sqrt(2);
//    hip pitch = atan(rise / hip run); hip length = sqrt(hip run^2 + rise^2). Creepers (jacks) spaced s along the
//    plate shorten by s / cos(pitch) each. Hip and creeper cheek cuts: cut on the plumb line with the saw bevelled 45°
//    (the cut plane is plumb and at 45° in plan). These are the framing-square table values "hip or valley per unit
//    run = sqrt(2 + (rise/run)^2)" and "difference in length of jacks = spacing x sqrt(1 + (rise/run)^2)".
//    Lengths are theoretical, to the centre line; deduct for the ridge and hip thickness per your framing detail.
import { toDeg, toRad, type Fmt } from './units.ts';
import { fail, positive, type Calc, type Check, type Step } from './result.ts';

export type Pitch = { deg: number; per1000: number; in12: number; percent: number; ratio: number };

/** One pitch in every common form. Valid for 0 < deg < 90. */
export function pitchFromDegrees(deg: number): Pitch | null {
  if (!Number.isFinite(deg) || deg <= 0 || deg >= 90) return null;
  const t = Math.tan(toRad(deg));
  return { deg, per1000: t * 1000, in12: t * 12, percent: t * 100, ratio: 1 / t };
}

export function pitchFromRiseRun(rise: number, run: number): Pitch | null {
  if (!Number.isFinite(rise) || !Number.isFinite(run) || rise <= 0 || run <= 0) return null;
  return pitchFromDegrees(toDeg(Math.atan(rise / run)));
}

export type RafterInput = {
  span: number;
  pitchDeg: number;
  ridgeThickness?: number | null;
  overhang?: number | null;
  rafterDepth?: number | null;
  seat?: number | null;
};

export type RafterResult = {
  run: number;
  rise: number;
  rafterToRidge: number;
  eaveLength: number;
  total: number;
  plumbAngle: number;
  seatAngle: number;
  birdsmouth: { plumbHeight: number; depthSquare: number; hap: number; overThird: boolean } | null;
};

export function commonRafter(input: RafterInput, f: Fmt): Calc<RafterResult> {
  const e = positive('span', input.span);
  if (e) return fail(e);
  const p = pitchFromDegrees(input.pitchDeg);
  if (!p) return fail('Enter a pitch between 0° and 90°.');
  const ridge = input.ridgeThickness ?? 0;
  const over = input.overhang ?? 0;
  if (ridge < 0 || over < 0) return fail('Ridge thickness and overhang can’t be negative.');
  const run = input.span / 2 - ridge / 2;
  if (run <= 0) return fail('The ridge is wider than the span. Check the numbers.');
  const t = Math.tan(toRad(p.deg));
  const c = Math.cos(toRad(p.deg));
  const steps: Step[] = [];
  steps.push({ label: 'Run', working: `${f.len(input.span)} / 2${ridge ? ` - ${f.len(ridge)} / 2` : ''} = ${f.len(run)}` });
  const rise = run * t;
  steps.push({ label: 'Rise', working: `${f.len(run)} x tan ${f.deg(p.deg)} = ${f.len(rise)}` });
  const rafterToRidge = run / c;
  steps.push({ label: 'Rafter, heel to ridge', working: `${f.len(run)} / cos ${f.deg(p.deg)} = ${f.len(rafterToRidge)}` });
  const eaveLength = over / c;
  if (over) steps.push({ label: 'Eave', working: `${f.len(over)} / cos ${f.deg(p.deg)} = ${f.len(eaveLength)}` });
  const total = rafterToRidge + eaveLength;
  if (over) steps.push({ label: 'Total length', working: `${f.len(rafterToRidge)} + ${f.len(eaveLength)} = ${f.len(total)}` });
  const checks: Check[] = [];
  let birdsmouth: RafterResult['birdsmouth'] = null;
  const D = input.rafterDepth ?? 0;
  const S = input.seat ?? 0;
  if (D > 0 && S > 0) {
    const plumbHeight = S * t;
    const depthSquare = S * Math.sin(toRad(p.deg));
    const hap = D / c - plumbHeight;
    const overThird = depthSquare > D / 3 + 1e-9;
    birdsmouth = { plumbHeight, depthSquare, hap, overThird };
    steps.push({ label: 'Birdsmouth plumb cut', working: `${f.len(S)} seat x tan ${f.deg(p.deg)} = ${f.len(plumbHeight)}` });
    steps.push({ label: 'Notch depth (square to edge)', working: `${f.len(S)} x sin ${f.deg(p.deg)} = ${f.len(depthSquare)}` });
    steps.push({ label: 'Height above plate', working: `${f.len(D)} / cos ${f.deg(p.deg)} - ${f.len(plumbHeight)} = ${f.len(hap)}` });
    if (hap <= 0) checks.push({ level: 'fail', text: 'The seat is too long for this rafter: the birdsmouth cuts through it' });
    else if (overThird) checks.push({ level: 'fail', text: `Notch is ${f.len(depthSquare)} deep, more than a third of the ${f.len(D)} rafter. Shorten the seat or check AS 1684` });
    else checks.push({ level: 'ok', text: `Notch ${f.len(depthSquare)} deep, within a third of the rafter depth` });
  } else if (D > 0 || S > 0) {
    checks.push({ level: 'warn', text: 'Enter both rafter depth and seat length to work out the birdsmouth' });
  }
  checks.push({ level: 'warn', text: 'Rafter sizes, spans and fixings come from AS 1684 or the engineer, not from this length' });
  return {
    ok: true,
    value: { run, rise, rafterToRidge, eaveLength, total, plumbAngle: p.deg, seatAngle: 90 - p.deg, birdsmouth },
    steps,
    checks,
  };
}

export type HipInput = { run: number; pitchDeg: number; spacing?: number | null };
export type HipResult = {
  rise: number;
  hipRun: number;
  hipPitch: number;
  hipLength: number;
  commonLength: number;
  creeperStep: number | null;
  creepers: number[];
};

export function regularHip(input: HipInput, f: Fmt): Calc<HipResult> {
  const e = positive('common rafter run', input.run);
  if (e) return fail(e);
  const p = pitchFromDegrees(input.pitchDeg);
  if (!p) return fail('Enter a pitch between 0° and 90°.');
  if (input.spacing != null && (!Number.isFinite(input.spacing) || input.spacing <= 0)) return fail('Creeper spacing must be more than zero.');
  const t = Math.tan(toRad(p.deg));
  const c = Math.cos(toRad(p.deg));
  const steps: Step[] = [];
  const rise = input.run * t;
  steps.push({ label: 'Rise', working: `${f.len(input.run)} x tan ${f.deg(p.deg)} = ${f.len(rise)}` });
  const hipRun = input.run * Math.SQRT2;
  steps.push({ label: 'Hip run (plan)', working: `${f.len(input.run)} x √2 = ${f.len(hipRun)}` });
  const hipPitch = toDeg(Math.atan(rise / hipRun));
  steps.push({ label: 'Hip pitch', working: `atan(${f.len(rise)} / ${f.len(hipRun)}) = ${f.deg(hipPitch)}` });
  const hipLength = Math.hypot(hipRun, rise);
  steps.push({ label: 'Hip length', working: `sqrt(${f.len(hipRun)}² + ${f.len(rise)}²) = ${f.len(hipLength)}` });
  const commonLength = input.run / c;
  let creeperStep: number | null = null;
  const creepers: number[] = [];
  if (input.spacing) {
    creeperStep = input.spacing / c;
    steps.push({ label: 'Each creeper is shorter by', working: `${f.len(input.spacing)} / cos ${f.deg(p.deg)} = ${f.len(creeperStep)}` });
    // Creeper k stands k x spacing along the plate from the corner, so its run is k x spacing.
    for (let k = 1; k * input.spacing < input.run - 1e-9 && creepers.length < 60; k++) creepers.push(k * creeperStep);
  }
  return {
    ok: true,
    value: { rise, hipRun, hipPitch, hipLength, commonLength, creeperStep, creepers },
    steps,
    checks: [
      { level: 'warn', text: 'For a regular hip only: both roof planes at the same pitch and the hip at 45° in plan' },
      { level: 'warn', text: 'Lengths are to the centre lines: deduct for the ridge and hip thickness per your framing detail' },
    ],
  };
}
