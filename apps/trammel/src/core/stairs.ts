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

export type StairCode = 'housing' | 'public' | 'private';

export type StairLimits = { rMin: number; rMax: number; gMin: number; gMax: number; sMin: number; sMax: number; maxRisers: number; minRisers: number; source: string };

export const STAIR_LIMITS: Record<StairCode, StairLimits> = {
  housing: { rMin: 115, rMax: 190, gMin: 240, gMax: 355, sMin: 550, sMax: 700, maxRisers: 18, minRisers: 2, source: 'NCC 2022 Housing Provisions 11.2.2, Table 11.2.2a' },
  public: { rMin: 115, rMax: 190, gMin: 250, gMax: 355, sMin: 550, sMax: 700, maxRisers: 18, minRisers: 2, source: 'NCC 2022 Volume One D3D14, Table D3D14 (public)' },
  private: { rMin: 115, rMax: 190, gMin: 240, gMax: 355, sMin: 550, sMax: 700, maxRisers: 18, minRisers: 2, source: 'NCC 2022 Volume One D3D14, Table D3D14 (private)' },
};

export const STAIR_CODE_NAMES: Record<StairCode, string> = {
  housing: 'House (Class 1 & 10)',
  public: 'Public (Class 2-9)',
  private: 'Private (Class 2-9)',
};

/** A comfortable stair sits near 2R + G = 630 mm (Blondel's stride rule; the middle of the NCC 550-700 band). */
export const COMFORT_2RG = 630;
export const COMFORT_RISER = 175;

export type StairInput = {
  totalRise: number;
  code?: StairCode;
  /** Force this many risers (otherwise Trammel picks). */
  risers?: number | null;
  /** Force this going (otherwise from the available run, or a comfortable one). */
  going?: number | null;
  /** Floor space available for the flight, front of bottom riser to face of top riser. */
  totalRun?: number | null;
  /** Stringer board width, for the throat check. */
  stringerWidth?: number | null;
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
};

/** Goings that keep both the going and 2R+G inside the limits for this riser height. */
export function goingRangeFor(riser: number, L: StairLimits): { min: number; max: number } | null {
  if (riser < L.rMin || riser > L.rMax) return null;
  const min = Math.max(L.gMin, L.sMin - 2 * riser);
  const max = Math.min(L.gMax, L.sMax - 2 * riser);
  return min <= max ? { min, max } : null;
}

export function stairOptions(totalRise: number, L: StairLimits) {
  const out: StairResult['options'] = [];
  const lo = Math.max(L.minRisers, Math.ceil(totalRise / L.rMax - 1e-9));
  const hi = Math.floor(totalRise / L.rMin + 1e-9);
  for (let n = lo; n <= hi && out.length < 6; n++) {
    const r = goingRangeFor(totalRise / n, L);
    if (r) out.push({ risers: n, riser: totalRise / n, goingMin: r.min, goingMax: r.max });
  }
  return out;
}

export function planStair(input: StairInput, f: Fmt): Calc<StairResult> {
  const e = positive('total rise (floor to floor)', input.totalRise);
  if (e) return fail(e);
  const code = input.code ?? 'housing';
  const L = STAIR_LIMITS[code];
  const rise = input.totalRise;
  if (rise > 20000) return fail('That total rise is over 20 m. Check the number and units.');
  if (input.going != null && (!Number.isFinite(input.going) || input.going <= 0)) return fail('The going must be more than zero.');
  if (input.totalRun != null && (!Number.isFinite(input.totalRun) || input.totalRun <= 0)) return fail('The available run must be more than zero.');
  if (input.risers != null && (!Number.isInteger(input.risers) || input.risers < 1)) return fail('Risers must be a whole number, 1 or more.');
  if (input.risers === 1) return fail('One riser is a single step, not a stair flight. Use 2 or more.');

  const nLo = Math.max(L.minRisers, Math.ceil(rise / L.rMax - 1e-9));
  const nHi = Math.floor(rise / L.rMin + 1e-9);
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
      const g = input.totalRun / (k - 1);
      const range = goingRangeFor(r, L);
      const outBy = range ? Math.max(0, range.min - g, g - range.max) : 1e6;
      const score = outBy * 1000 + Math.abs(2 * r + g - COMFORT_2RG);
      if (score < bestScore) {
        bestScore = score;
        best = k;
      }
    }
    n = best;
    steps.push({ label: 'Risers', working: `${n}: the count whose going fits ${f.len(input.totalRun)} of run best` });
  } else {
    n = Math.max(L.minRisers, Math.round(rise / COMFORT_RISER));
    if (nLo <= nHi) n = Math.min(nHi, Math.max(nLo, n));
    else n = Math.max(nLo, L.minRisers);
    steps.push({ label: 'Risers', working: `${f.len(rise)} / ${f.len(COMFORT_RISER)} target riser = ${f.num(rise / COMFORT_RISER, 2)}, use ${n}` });
  }

  const riser = rise / n;
  const treads = n - 1;
  steps.push({ label: 'Riser height', working: `${f.len(rise)} / ${n} risers = ${f.num(riser, 1)} mm` });
  const range = goingRangeFor(riser, L);
  let going: number;
  if (input.going) {
    going = input.going;
    steps.push({ label: 'Going', working: `${f.len(going)} (set by you)` });
  } else if (input.totalRun) {
    going = input.totalRun / treads;
    steps.push({ label: 'Going', working: `${f.len(input.totalRun)} run / ${treads} treads = ${f.num(going, 1)} mm` });
  } else {
    const ideal = COMFORT_2RG - 2 * riser;
    going = range ? Math.min(range.max, Math.max(range.min, ideal)) : Math.min(L.gMax, Math.max(L.gMin, ideal));
    steps.push({ label: 'Going', working: `630 - 2 x ${f.num(riser, 1)} = ${f.num(ideal, 1)} mm${going !== ideal ? `, kept inside the limits: ${f.num(going, 1)} mm` : ''}` });
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
  const inR = riser >= L.rMin - 1e-9 && riser <= L.rMax + 1e-9;
  checks.push({ level: inR ? 'ok' : 'fail', text: `Riser ${f.num(riser, 1)} mm (limits ${L.rMin}-${L.rMax})` });
  const inG = going >= L.gMin - 1e-9 && going <= L.gMax + 1e-9;
  checks.push({ level: inG ? 'ok' : 'fail', text: `Going ${f.num(going, 1)} mm (limits ${L.gMin}-${L.gMax})` });
  const inS = twoRG >= L.sMin - 1e-9 && twoRG <= L.sMax + 1e-9;
  checks.push({ level: inS ? 'ok' : 'fail', text: `2R+G ${f.num(twoRG, 1)} mm (limits ${L.sMin}-${L.sMax})` });
  if (n > L.maxRisers) checks.push({ level: 'fail', text: `${n} risers is more than ${L.maxRisers} in one flight: add a landing` });
  else checks.push({ level: 'ok', text: `${n} risers in the flight (${L.minRisers}-${L.maxRisers} allowed)` });
  if (throat != null) {
    if (throat <= 0) checks.push({ level: 'fail', text: 'The notches cut right through this stringer: use a wider board or a housed stringer' });
    else checks.push({ level: 'warn', text: `${f.len(throat)} of stringer left under each notch: check it against the span tables or engineer` });
  }
  checks.push({ level: 'warn', text: 'Keep every riser and going the same (5 mm between neighbours, 10 mm across the flight) and no gap that lets a 125 mm sphere through open risers' });

  return {
    ok: true,
    value: { risers: n, treads, riser, going, twoRG, totalGoing, angle, step, pitchLine, stringerEstimate, throat, goingRange: range, limits: L, options: stairOptions(rise, L) },
    steps,
    checks,
  };
}
