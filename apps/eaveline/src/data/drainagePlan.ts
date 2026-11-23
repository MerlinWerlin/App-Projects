/**
 * Picks the right downpipe estimate for the country's method and the chosen products:
 *   areaTable        maximum plan area per downpipe by pitch band (NZ E1/AS1 Table 5)
 *   rule area        a rule-of-thumb area per downpipe (US rectangular downspouts)
 *   areaPerDownpipe  catchment per downpipe read from the standard's chart (AU AS/NZS 3500.3)
 *   flow             Q = A × I ÷ 3600 against what one outlet carries (UK/IE gutter tables, US IPC, generic)
 */
import { cap, fail, type Ctx, type Result, type Step } from '../core/context';
import { downpipes } from '../core/drainage';
import { num } from '../core/units';
import type { Country } from './types';

export interface PlanInput {
  planM2: number;
  pitchDeg: number;
  intensityMmPerHr: number | null;
  gutterId: string | null;
  downpipeId: string | null;
  customCapacityLps: number | null;
  areaPerDownpipeM2: number | null;
  runMm: number | null;
}

export interface PlanResult { downpipes: number; basis: string; flowLps: number | null; catchmentM2: number }

export function downpipePlan(country: Country, input: PlanInput, ctx: Ctx): Result<PlanResult> {
  const { planM2, pitchDeg } = input;
  const d = country.drainage;
  if (!(planM2 > 0)) return fail(`Enter the plan area of roof draining to this ${ctx.terms.gutter}.`);
  if (!(pitchDeg >= 0) || pitchDeg > 75) return fail('Enter a pitch between 0° and 75°.');
  const gutter = country.gutters.find(g => g.id === input.gutterId) ?? null;
  const pipe = country.downpipes.find(p => p.id === input.downpipeId) ?? null;
  const spacing = (n: number, steps: Step[]) => {
    if (input.runMm && d.maxDownpipeSpacingMm) {
      const b = Math.max(1, Math.ceil(input.runMm / d.maxDownpipeSpacingMm - 1e-9));
      steps.push({ label: 'Spacing guide', formula: `⌈ ${ctx.run(input.runMm)} ÷ ${ctx.run(d.maxDownpipeSpacingMm)} ⌉`, value: String(b) });
      return Math.max(n, b);
    }
    return n;
  };
  const notes = [`Estimate only (${d.method}). A plumber or designer confirms the real system, including overflow.`];

  if (pipe?.maxAreaByPitch?.length && input.customCapacityLps == null) {
    const band = pipe.maxAreaByPitch.find(b => pitchDeg <= b.maxPitchDeg);
    if (!band) return fail(`The ${ctx.terms.downpipe} table stops at ${pipe.maxAreaByPitch[pipe.maxAreaByPitch.length - 1]!.maxPitchDeg}°. Use the full method for steeper roofs.`);
    const n0 = Math.max(1, Math.ceil(planM2 / band.m2 - 1e-9));
    const steps: Step[] = [
      { label: `Area one ${pipe.name.toLowerCase()} serves`, formula: `table, pitch up to ${band.maxPitchDeg}°`, value: ctx.area(band.m2) },
      { label: cap(ctx.terms.downpipes), formula: `⌈ ${num(planM2, 1)} m² ÷ ${band.m2} m² ⌉`, value: String(n0) },
    ];
    const n = spacing(n0, steps);
    return { ok: true, value: { downpipes: n, basis: 'table', flowLps: null, catchmentM2: planM2 }, steps, notes };
  }
  if (pipe?.ruleAreaM2 && input.customCapacityLps == null && !gutter?.capacityLps) {
    const n0 = Math.max(1, Math.ceil(planM2 / pipe.ruleAreaM2 - 1e-9));
    const steps: Step[] = [
      { label: `Rule of thumb for a ${pipe.name.toLowerCase()}`, value: ctx.area(pipe.ruleAreaM2) },
      { label: cap(ctx.terms.downpipes), formula: `⌈ plan area ÷ ${ctx.area(pipe.ruleAreaM2)} ⌉`, value: String(n0) },
    ];
    const n = spacing(n0, steps);
    return { ok: true, value: { downpipes: n, basis: 'rule', flowLps: null, catchmentM2: planM2 }, steps,
      notes: [...notes, 'Rule-of-thumb sizing ignores rainfall intensity: check heavy-rain areas with the flow method.'] };
  }
  const factor = d.slopeFactor(pitchDeg);
  if (d.mode === 'areaPerDownpipe' && input.customCapacityLps == null) {
    const per = input.areaPerDownpipeM2 ?? d.areaPerDownpipeExample?.m2 ?? null;
    if (!(per && per > 0)) return fail(`Enter the catchment one ${ctx.terms.downpipe} can serve (from the standard’s chart).`);
    const A = planM2 * factor;
    const n0 = Math.max(1, Math.ceil(A / per - 1e-9));
    const steps: Step[] = [
      { label: 'Catchment area', formula: `plan area × ${num(factor, 3)} slope allowance`, value: ctx.area(A) },
      { label: `Catchment per ${ctx.terms.downpipe}`, formula: input.areaPerDownpipeM2 ? 'from the chart (entered)' : 'worked example value', value: ctx.area(per) },
      { label: cap(ctx.terms.downpipes), formula: `⌈ ${num(A, 1)} ÷ ${num(per, 1)} ⌉`, value: String(n0) },
    ];
    if (input.intensityMmPerHr && input.intensityMmPerHr > 0) steps.splice(1, 0, { label: 'Design flow', formula: `${num(A, 1)} m² × ${num(input.intensityMmPerHr, 0)} mm/h ÷ 3600`, value: `${num((A * input.intensityMmPerHr) / 3600, 2)} L/s` });
    const n = spacing(n0, steps);
    return { ok: true, value: { downpipes: n, basis: 'chart', flowLps: input.intensityMmPerHr ? (A * input.intensityMmPerHr) / 3600 : null, catchmentM2: A }, steps, notes };
  }
  const I = input.intensityMmPerHr ?? d.designIntensityMmPerHr;
  if (!(I && I > 0)) return fail('Enter the design rainfall intensity for the site.');
  const caps = [input.customCapacityLps, input.customCapacityLps == null ? gutter?.capacityLps : null, input.customCapacityLps == null ? pipe?.capacityLps : null]
    .filter((x): x is number => typeof x === 'number' && x > 0);
  if (!caps.length) return fail(`Enter what one outlet and ${ctx.terms.downpipe} can carry (L/s) from the maker’s data.`);
  const q = Math.min(...caps);
  const r = downpipes({ catchmentPlanM2: planM2, slopeFactor: factor, intensityMmPerHr: I, capacityLps: q, runMm: input.runMm ?? undefined, maxSpacingMm: d.maxDownpipeSpacingMm, method: d.method }, ctx);
  if (!r.ok) return r;
  const extra: string[] = [];
  if (gutter?.maxAreaM2 && r.value.catchmentM2 / r.value.downpipes > gutter.maxAreaM2) extra.push(`Each outlet would take more than the ${gutter.maxAreaM2} m² the table allows for this gutter. Add outlets or go up a size.`);
  return { ok: true, value: { downpipes: r.value.downpipes, basis: 'flow', flowLps: r.value.flowLps, catchmentM2: r.value.catchmentM2 }, steps: r.steps, notes: [...extra, ...notes] };
}
