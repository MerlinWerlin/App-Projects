/**
 * Roof drainage estimates. These are planning estimates, not a design: the local standard cited for each country
 * (src/data/countries) has the full method, and a plumber or designer signs off the real system.
 *
 * Gutter fall over a run at a gradient of 1 in N:  fall = run ÷ N.
 *
 * Design flow from a roof (the "rational method" used by AS/NZS 3500.3, BS EN 12056-3 and the IPC alike,
 * with a run-off coefficient of 1 for roofs):
 *   Q (L/s) = catchment area (m²) × rainfall intensity (mm/h) ÷ 3600
 * Catchment area is the plan area, adjusted for slope as the local method says (src/data/countries: `catchment`).
 * Downpipes needed = ⌈ Q ÷ capacity of one downpipe ⌉, and never fewer than the spacing limit requires.
 */
import { cap, fail, type Ctx, type Result, type Step } from './context';
import { num } from './units';

export interface FallInput { runMm: number; ratio: number }
export function gutterFall({ runMm, ratio }: FallInput, ctx: Ctx): Result<{ fallMm: number; perMetreMm: number }> {
  if (!(runMm > 0)) return fail(`Enter the ${ctx.terms.gutter} run.`);
  if (runMm > 200_000) return fail('That run is over 200 m. Check the units.');
  if (!(ratio >= 50) || ratio > 2000) return fail('Enter a gradient between 1 in 50 and 1 in 2000.');
  const fall = runMm / ratio;
  const per = 1000 / ratio;
  return { ok: true, value: { fallMm: fall, perMetreMm: per }, steps: [
    { label: 'Fall over the run', formula: `${ctx.run(runMm)} ÷ ${num(ratio, 0)}`, value: ctx.len(fall) },
    { label: ctx.sys === 'imperial' ? 'Fall per 10 ft' : 'Fall per metre', formula: ctx.sys === 'imperial' ? '3048 mm ÷ N' : '1000 mm ÷ N', value: ctx.len(ctx.sys === 'imperial' ? 3048 / ratio : per) },
  ], notes: [] };
}

/** Gradient you end up with when the fall is fixed (e.g. by the fascia). */
export function gradientFromFall(runMm: number, fallMm: number): number | null {
  if (!(runMm > 0) || !(fallMm > 0)) return null;
  return runMm / fallMm;
}

export interface DownpipeInput {
  catchmentPlanM2: number;
  slopeFactor: number; // catchment multiplier from the local method (1 = plan area)
  intensityMmPerHr: number;
  capacityLps: number; // one downpipe/outlet, from the local table or maker
  runMm?: number; // gutter length served (for the spacing limit)
  maxSpacingMm?: number | null;
  method: string; // e.g. "AS/NZS 3500.3 rational method"
}
export interface DownpipeResult { catchmentM2: number; flowLps: number; byFlow: number; bySpacing: number; downpipes: number }

export function downpipes(input: DownpipeInput, ctx: Ctx): Result<DownpipeResult> {
  const { catchmentPlanM2: plan, slopeFactor, intensityMmPerHr: I, capacityLps: q } = input;
  if (!(plan > 0)) return fail('Enter the roof area draining to this gutter.');
  if (plan > 100_000) return fail('That catchment is over 10 hectares. Check the units.');
  if (!(slopeFactor >= 1) || slopeFactor > 4) return fail('The slope factor should be between 1 and 4.');
  if (!(I > 0) || I > 1000) return fail('Enter a rainfall intensity between 1 and 1000 mm/h.');
  if (!(q > 0)) return fail(`Enter what one ${ctx.terms.downpipe} can carry (L/s).`);
  const A = plan * slopeFactor;
  const Q = (A * I) / 3600;
  const byFlow = Math.max(1, Math.ceil(Q / q - 1e-9));
  const bySpacing = input.runMm && input.maxSpacingMm ? Math.max(1, Math.ceil(input.runMm / input.maxSpacingMm - 1e-9)) : 1;
  const n = Math.max(byFlow, bySpacing);
  const steps: Step[] = [
    { label: 'Catchment area', formula: slopeFactor === 1 ? 'plan area' : `plan area × ${num(slopeFactor, 3)} slope allowance`, value: ctx.area(A) },
    { label: 'Design flow', formula: `${num(A, 1)} m² × ${num(I, 0)} mm/h ÷ 3600`, value: `${num(Q, 2)} L/s` },
    { label: `${cap(ctx.terms.downpipes)} for that flow`, formula: `⌈ ${num(Q, 2)} ÷ ${num(q, 2)} L/s each ⌉`, value: String(byFlow) },
  ];
  if (input.runMm && input.maxSpacingMm) steps.push({ label: 'Spacing limit', formula: `⌈ ${ctx.run(input.runMm)} ÷ ${ctx.run(input.maxSpacingMm)} max ⌉`, value: String(bySpacing) });
  steps.push({ label: cap(ctx.terms.downpipes), value: String(n) });
  return { ok: true, value: { catchmentM2: A, flowLps: Q, byFlow, bySpacing, downpipes: n }, steps,
    notes: [`Estimate only (${input.method}). Gutter size, outlet position and overflow provisions need checking against the full method.`] };
}

/** mm/h ↔ in/h for display. */
export const inPerHr = (mmPerHr: number) => mmPerHr / 25.4;
export const mmPerHrFromIn = (inHr: number) => inHr * 25.4;
