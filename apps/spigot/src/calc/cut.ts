/**
 * Cut length between fittings.
 *
 * A fitting's TAKE-OFF (also "fitting allowance" or "make-up") is the distance from its centre line to where the
 * pipe end stops inside it: take-off = centre-to-end (C–E) − socket depth / thread engagement.
 * Source: Frankland, "The Pipe Fitter's and Pipe Welder's Handbook", centre-to-centre and take-off method.
 * Manufacturer fitting catalogues list the centre-to-end dimension and the socket depth separately; the take-off
 * is their difference (see fittings.ts for the table and its sources).
 *
 * The person measures between two points. At each end the point is one of:
 *  - centre: the centre line of a fitting  -> the pipe is shorter by that fitting's take-off
 *  - face:   the face (mouth) of a fitting -> the pipe is longer by the socket depth / engagement (it goes inside)
 *  - none:   a bare pipe end (open end, wall, cleanout) -> no change
 * cut = measured − Σ(take-offs at "centre" ends) + Σ(engagements at "face" ends)
 */
import { L, fail, isNonNeg, isPos, type CalcResult, type Step } from './steps';

export type EndRef = 'centre' | 'face' | 'none';

export interface FittingDims {
  /** Centre to end of the fitting (C–E), mm. */
  centreToEnd: number;
  /** Socket depth (solvent/solder/press) or thread engagement, mm. */
  engagement: number;
}

export function takeoff(f: FittingDims): number {
  return f.centreToEnd - f.engagement;
}

export function validFitting(f: FittingDims): string | null {
  if (!isNonNeg(f.centreToEnd)) return 'Centre-to-end must be 0 or more';
  if (!isNonNeg(f.engagement)) return 'Socket depth must be 0 or more';
  if (f.engagement > f.centreToEnd) return 'Socket depth can’t be more than centre-to-end';
  return null;
}

export interface CutEnd {
  ref: EndRef;
  fitting?: FittingDims;
  /** Shown in the working ("45° bend"). */
  name?: string;
}

export interface CutInput {
  measured: number;
  a: CutEnd;
  b: CutEnd;
  /** Number of pieces wanted (for the total), default 1. */
  qty?: number;
}

export interface CutResult {
  cut: number;
  adjustA: number;
  adjustB: number;
  total: number;
}

function adjust(end: CutEnd, tag: 'A' | 'B', steps: Step[]): number | string {
  if (end.ref === 'none') return 0;
  if (!end.fitting) return `Choose fitting ${tag}`;
  const bad = validFitting(end.fitting);
  if (bad) return `Fitting ${tag}: ${bad}`;
  const name = end.name ? ` (${end.name})` : '';
  if (end.ref === 'centre') {
    const t = takeoff(end.fitting);
    steps.push({ label: `Take-off ${tag}${name}`, formula: 'Centre-to-end − socket depth', inputs: [L(end.fitting.centreToEnd), L(end.fitting.engagement)], result: L(t) });
    return -t;
  }
  steps.push({ label: `Socket depth ${tag}${name}`, formula: 'Pipe goes into the fitting', inputs: [], result: L(end.fitting.engagement) });
  return end.fitting.engagement;
}

export function cutLength(input: CutInput): CalcResult<CutResult> {
  if (!isPos(input.measured)) return fail('Enter the measurement (more than 0)', 'measured');
  const qty = input.qty ?? 1;
  if (!Number.isInteger(qty) || qty < 1 || qty > 999) return fail('Quantity must be a whole number from 1 to 999', 'qty');
  const steps: Step[] = [];
  const a = adjust(input.a, 'A', steps);
  if (typeof a === 'string') return fail(a, 'a');
  const b = adjust(input.b, 'B', steps);
  if (typeof b === 'string') return fail(b, 'b');
  const cut = input.measured + a + b;
  steps.push({ label: 'Cut length', formula: 'Measured ' + sign(a, 'A') + ' ' + sign(b, 'B'), inputs: [L(input.measured), L(Math.abs(a)), L(Math.abs(b))], result: L(cut) });
  const warnings: string[] = [];
  if (cut <= 0) return fail('The fittings take up the whole measurement: there’s no pipe to cut. Check the measurement and fittings.', 'measured');
  if (qty > 1) steps.push({ label: 'Total pipe', formula: `Cut length × ${qty}`, inputs: [L(cut)], result: L(cut * qty) });
  return { ok: true, value: { cut, adjustA: a, adjustB: b, total: cut * qty }, steps, warnings };
}

function sign(n: number, tag: string) {
  return n < 0 ? `− take-off ${tag}` : n > 0 ? `+ socket ${tag}` : `± 0 (${tag})`;
}
