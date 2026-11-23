// Straight stair set-out: riser count and height, going, 2R+G, stringer step and pitch line, stringer throat.
//
// Limits (all mm), read from the ABCB's published NCC 2022 text on 23 Nov 2026:
//  - Houses (Class 1 and 10): ABCB Housing Provisions Standard 2022, Part 11.2, clause 11.2.2 and Table 11.2.2a
//    "Stairs (other than spiral)": riser 115-190, going 240-355, slope relationship 2R+G 550-700.
//  - Class 2-9 buildings: NCC 2022 Volume One, clause D3D14 and Table D3D14: public stairways riser 115-190,
//    going 250-355, 2R+G 550-700; private stairways (Note 1) as public but going 240-355.
//  - Both clauses: not more than 18 and not less than 2 risers in each flight; risers and goings constant
//    (adjacent ones within 5 mm, largest to smallest within 10 mm in a flight); open risers must not let a
//    125 mm sphere pass between treads.
// Spiral stairs and winders are out of scope. Guidance only: state variations and the plans govern.
//
// Geometry (straight flight, top riser landing on the upper floor):
//   treads = risers - 1, riser R = total rise / risers, total going = G x treads,
//   pitch angle = atan(R / G), one step along the pitch line = sqrt(R^2 + G^2),
//   pitch line nosing to nosing = treads x step,
//   throat (timber left under a cut stringer's notch) = board width - R x G / step
//   (the notch corner sits R x G / step from the pitch line: the altitude of the right triangle R, G).
import { toDeg, type Fmt } from './units.ts';
import { fail, positive, type Calc, type Check, type Step } from './result.ts';

/**
 * One set of stair limits from a building code (or generic guidance). Any limit a code doesn't set is null.
 * Per-country sets live in src/core/stairCodes.ts with their sources.
 */
export type StairLimits = {
  id: string;
  name: string;
  rMin: number | null;
  rMax: number | null;
  gMin: number | null;
  gMax: number | null;
  sMin: number | null;
  sMax: number | null;
  maxPitch: number | null;
  maxRisers: number | null;
  minRisers: number | null;
  /** Most rise one flight may climb before a landing (NZ, US and Canada limit flights this way), mm. */
  maxFlightRise?: number | null;
  /** Treads shallower than this need a nosing (US IRC); warned, with the text. */
  nosingBelow?: { going: number; text: string } | null;
  /** Short citation shown under the result. */
  source: string;
  /** false for generic guidance: outside a range is a note, not a fail. */
  binding: boolean;
  /** Extra plain-words rules shown as notes (open risers, tolerances, headroom). */
  notes: string[];
};

/** A comfortable stair sits near 2R + G = 630 mm (Blondel's stride rule; the middle of the NCC 550-700 band). */
export const COMFORT_2RG = 630;
export const COMFORT_RISER = 175;
/** Used only where a code sets no riser limit, to bound the riser counts offered. */
export const COMFORT_RISER_MAX = 220;
export const COMFORT_RISER_MIN = 100;

export type StairInput = {
  totalRise: number;
  limits: StairLimits;
  /** Force this many risers (otherwise Trammel picks). */
  risers?: number | null;
  /** Force this going (otherwise from the available run, or a comfortable one). */
  going?: number | null;
  /** Floor space available for the flight, front of bottom riser to face of top riser. */
  totalRun?: number | null;
  /** Stringer board width, for the throat check. */
  stringerWidth?: number | null;
  /** Tread thickness, for the dropped bottom riser on a cut stringer. */
  treadThickness?: number | null;
};

export type StairResult = {
  risers: number;
  treads: number;
  riser: number;
  going: number;
  twoRG: number;
  totalGoing: number;
  angle: number;
  step: number;
  pitchLine: number;
  /** n steps along the pitch line: a minimum board length before allowing for the top and bottom fixings. */
  stringerEstimate: number;
  throat: number | null;
  /** Compliant going range for this riser (null when the riser itself is out of range). */
  goingRange: { min: number; max: number } | null;
  limits: StairLimits;
  options: { risers: number; riser: number; goingMin: number; goingMax: number }[];
  /** True when no single flight can meet the code here (too many risers or too much rise): add a landing. */
  needsLanding: boolean;
  /** Bottom riser on a cut stringer: riser less one tread thickness (so the first step isn't high). */
  bottomRiserCut: number | null;
};

/** Goings that keep both the going and 2R+G inside the limits for this riser height. */
export function goingRangeFor(riser: number, L: StairLimits): { min: number; max: number } | null {
  if ((L.rMin != null && riser < L.rMin - 1e-9) || (L.rMax != null && riser > L.rMax + 1e-9)) return null;
  let min = Math.max(L.gMin ?? 0, L.sMin != null ? L.sMin - 2 * riser : 0);
  let max = Math.min(L.gMax ?? Infinity, L.sMax != null ? L.sMax - 2 * riser : Infinity);
  if (L.maxPitch != null) min = Math.max(min, riser / Math.tan((L.maxPitch * Math.PI) / 180));
  if (!Number.isFinite(max)) max = Math.max(min, 400);
  return min <= max + 1e-9 ? { min, max } : null;
}

export function stairOptions(totalRise: number, L: StairLimits) {
  const out: StairResult['options'] = [];
  const lo = Math.max(L.minRisers ?? 2, Math.ceil(totalRise / (L.rMax ?? COMFORT_RISER_MAX) - 1e-9));
  let hi = Math.floor(totalRise / (L.rMin ?? COMFORT_RISER_MIN) + 1e-9);
  if (L.maxRisers != null) hi = Math.min(hi, L.maxRisers);
  // Too much rise for one flight: no count passes; the stair needs a landing.
  if (L.maxFlightRise != null && totalRise > L.maxFlightRise + 1e-9) return out;
  for (let n = lo; n <= hi && out.length < 6; n++) {
    const r = goingRangeFor(totalRise / n, L);
    if (r) out.push({ risers: n, riser: totalRise / n, goingMin: r.min, goingMax: r.max });
  }
  return out;
}

export function planStair(input: StairInput, f: Fmt, goingWord = 'Going'): Calc<StairResult> {
  const e = positive('total rise (floor to floor)', input.totalRise);
  if (e) return fail(e);
  const L = input.limits;
  const rise = input.totalRise;
  if (rise > 20000) return fail('That total rise is over 20 m. Check the number and units.');
  if (input.going != null && (!Number.isFinite(input.going) || input.going <= 0)) return fail('The going must be more than zero.');
  if (input.totalRun != null && (!Number.isFinite(input.totalRun) || input.totalRun <= 0)) return fail('The available run must be more than zero.');
  if (input.risers != null && (!Number.isInteger(input.risers) || input.risers < 1)) return fail('Risers must be a whole number, 1 or more.');
  if (input.risers === 1) return fail('One riser is a single step, not a stair flight. Use 2 or more.');

  const rMaxEff = L.rMax ?? COMFORT_RISER_MAX;
  const rMinEff = L.rMin ?? COMFORT_RISER_MIN;
  const nLo = Math.max(L.minRisers ?? 2, Math.ceil(rise / rMaxEff - 1e-9));
  // Counts over the code's risers-per-flight are never picked (they would need a landing).
  const nHi = Math.min(Math.floor(rise / rMinEff + 1e-9), L.maxRisers ?? Infinity);
  const steps: Step[] = [];
  let n: number;
  if (input.risers) {
    n = input.risers;
    steps.push({ label: 'Risers', working: `${n} (set by you)` });
  } else if (input.totalRun && nLo <= nHi) {
    // Pick the riser count whose going (run / treads) best fits the limits and sits nearest 2R+G = 630.
    let best = nLo;
    let bestScore = Infinity;
    for (let k = nLo; k <= nHi; k++) {
      const r = rise / k;
      // With a going you set, the flight must also fit the floor space.
      const g = input.going ?? input.totalRun / (k - 1);
      const over = Math.max(0, g * (k - 1) - input.totalRun);
      const range = goingRangeFor(r, L);
      const outBy = (range ? Math.max(0, range.min - g, g - range.max) : 1e6) + over;
      const score = outBy * 1000 + Math.abs(2 * r + g - COMFORT_2RG);
      if (score < bestScore) {
        bestScore = score;
        best = k;
      }
    }
    n = best;
    steps.push({ label: 'Risers', working: `${n}: the count that fits ${f.len(input.totalRun)} of floor space best` });
  } else {
    n = Math.max(L.minRisers ?? 2, Math.round(rise / COMFORT_RISER));
    if (nLo <= nHi) n = Math.min(nHi, Math.max(nLo, n));
    else n = Math.max(nLo, L.minRisers ?? 2);
    steps.push({ label: 'Risers', working: `${f.len(rise)} / ${f.len(COMFORT_RISER)} target riser = ${f.num(rise / COMFORT_RISER, 2)}, use ${n}` });
  }

  const riser = rise / n;
  const treads = n - 1;
  steps.push({ label: 'Riser height', working: `${f.len(rise)} / ${n} risers = ${f.num(riser, 1)} mm` });
  const range = goingRangeFor(riser, L);
  let going: number;
  if (input.going) {
    going = input.going;
    steps.push({ label: goingWord, working: `${f.len(going)} (set by you)` });
  } else if (input.totalRun) {
    going = input.totalRun / treads;
    steps.push({ label: goingWord, working: `${f.len(input.totalRun)} run / ${treads} treads = ${f.num(going, 1)} mm` });
  } else {
    const ideal = COMFORT_2RG - 2 * riser;
    going = range ? Math.min(range.max, Math.max(range.min, ideal)) : Math.min(L.gMax ?? Infinity, Math.max(L.gMin ?? 0, ideal));
    steps.push({ label: goingWord, working: `630 - 2 x ${f.num(riser, 1)} = ${f.num(ideal, 1)} mm${going !== ideal ? `, kept inside the limits: ${f.num(going, 1)} mm` : ''}` });
  }
  const twoRG = 2 * riser + going;
  steps.push({ label: '2R + G', working: `2 x ${f.num(riser, 1)} + ${f.num(going, 1)} = ${f.num(twoRG, 1)} mm` });
  const totalGoing = going * treads;
  steps.push({ label: 'Total going', working: `${f.num(going, 1)} x ${treads} treads = ${f.len(totalGoing)}` });
  const angle = toDeg(Math.atan(riser / going));
  steps.push({ label: 'Pitch', working: `atan(${f.num(riser, 1)} / ${f.num(going, 1)}) = ${f.deg(angle)}` });
  const step = Math.hypot(riser, going);
  steps.push({ label: 'Step along the pitch line', working: `sqrt(${f.num(riser, 1)}² + ${f.num(going, 1)}²) = ${f.num(step, 1)} mm` });
  const pitchLine = step * treads;
  steps.push({ label: 'Pitch line, nosing to nosing', working: `${f.num(step, 1)} x ${treads} = ${f.len(pitchLine)}` });
  const stringerEstimate = step * n;
  let throat: number | null = null;
  if (input.stringerWidth && input.stringerWidth > 0) {
    const notch = (riser * going) / step;
    throat = input.stringerWidth - notch;
    steps.push({ label: 'Stringer throat', working: `${f.len(input.stringerWidth)} - (${f.num(riser, 1)} x ${f.num(going, 1)} / ${f.num(step, 1)}) = ${f.len(throat)}` });
  }

  const checks: Check[] = [];
  const bad: Check['level'] = L.binding ? 'fail' : 'warn';
  const span = (lo: number | null, hi: number | null) => (lo != null && hi != null ? `${f.num(lo, 0)}-${f.num(hi, 0)} mm` : lo != null ? `at least ${f.num(lo, 0)} mm` : `at most ${f.num(hi ?? 0, 0)} mm`);
  const within = (v: number, lo: number | null, hi: number | null) => (lo == null || v >= lo - 1e-9) && (hi == null || v <= hi + 1e-9);
  if (L.rMin != null || L.rMax != null) checks.push({ level: within(riser, L.rMin, L.rMax) ? 'ok' : bad, text: `Riser ${f.num(riser, 1)} mm (${span(L.rMin, L.rMax)})` });
  if (L.gMin != null || L.gMax != null) checks.push({ level: within(going, L.gMin, L.gMax) ? 'ok' : bad, text: `${goingWord} ${f.num(going, 1)} mm (${span(L.gMin, L.gMax)})` });
  if (L.sMin != null || L.sMax != null) checks.push({ level: within(twoRG, L.sMin, L.sMax) ? 'ok' : bad, text: `2R+G ${f.num(twoRG, 1)} mm (${span(L.sMin, L.sMax)})` });
  if (L.maxPitch != null) checks.push({ level: angle <= L.maxPitch + 1e-9 ? 'ok' : bad, text: `Pitch ${f.deg(angle)} (at most ${L.maxPitch}°)` });
  if (L.maxRisers != null && n > L.maxRisers) checks.push({ level: bad, text: `${n} risers is more than ${L.maxRisers} in one flight: add a landing` });
  else if (L.maxRisers != null) checks.push({ level: 'ok', text: `${n} risers in the flight (${L.minRisers ?? 2}-${L.maxRisers} allowed)` });
  if (L.maxFlightRise != null) {
    const fits = rise <= L.maxFlightRise + 1e-9;
    checks.push({ level: fits ? 'ok' : bad, text: fits ? `Flight rise ${f.len(rise)} (at most ${f.len(L.maxFlightRise)} between landings)` : `Flight rise ${f.len(rise)} is more than ${f.len(L.maxFlightRise)}: add a landing` });
  }
  if (input.totalRun && totalGoing > input.totalRun + 0.5) checks.push({ level: 'fail', text: `Total ${goingWord.toLowerCase()} ${f.len(totalGoing)} is ${f.len(totalGoing - input.totalRun)} more than the floor space` });
  if (L.nosingBelow && going < L.nosingBelow.going - 1e-9) checks.push({ level: 'warn', text: L.nosingBelow.text });
  if (throat != null) {
    if (throat <= 0) checks.push({ level: 'fail', text: 'The notches cut right through this stringer: use a wider board or a housed stringer' });
    else checks.push({ level: 'warn', text: `${f.len(throat)} of stringer left under each notch: check it against the span tables or engineer` });
  }
  for (const note of L.notes) checks.push({ level: 'warn', text: note });
  const needsLanding = (L.maxRisers != null && n > L.maxRisers) || (L.maxFlightRise != null && rise > L.maxFlightRise + 1e-9);
  let bottomRiserCut: number | null = null;
  if (input.treadThickness && input.treadThickness > 0) {
    bottomRiserCut = riser - input.treadThickness;
    steps.push({ label: 'Bottom riser cut (dropped)', working: `${f.num(riser, 1)} - ${f.len(input.treadThickness)} tread = ${f.num(bottomRiserCut, 1)} mm` });
  }

  return {
    ok: true,
    value: { risers: n, treads, riser, going, twoRG, totalGoing, angle, step, pitchLine, stringerEstimate, throat, goingRange: range, limits: L, options: stairOptions(rise, L), needsLanding, bottomRiserCut },
    steps,
    checks,
  };
}
