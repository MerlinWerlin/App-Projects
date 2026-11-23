/**
 * Segmented (lobster-back / mitred) bends in pipe or round tube.
 *
 * A bend of total angle B made from P pieces has P − 1 welds. With the usual layout of two half-segment ends and
 * P − 2 full middle segments, every weld turns the line by α = B / (P − 1), and each cut face is α/2 off square.
 * On the centreline radius Rc:
 *   full middle segment, centreline length   = 2 · Rc · tan(α/2)
 *   end segment (plus any straight tangent)  = Rc · tan(α/2) + tangent
 *   long side (extrados, radius Rc + D/2)    = 2 · (Rc + D/2) · tan(α/2)
 *   short side (intrados, radius Rc − D/2)   = 2 · (Rc − D/2) · tan(α/2)
 * Sources: ASME B31.3 para. 304.2.3 "Miter bends" (α as the change of direction at a miter joint, θ = α/2 as the
 * cut angle); Frankland, "The Pipe Fitter's and Pipe Welder's Handbook", "Segmented turns".
 *
 * Cut line on the pipe for one face (a plane at β = α/2 to square), unrolled round the outside:
 *   cut-back from the long point h(φ) = (D/2) · tan β · (1 − cos φ),  φ = 0 at the extrados (long side),
 *   x = (D/2) · φ. Deepest point (intrados) = D · tan β.
 */
import { DEG, fail, fmt, positive, type Result, type Step } from './units.ts';

export interface LobsterInput {
  od: number; // mm
  bendDeg: number; // total change of direction, e.g. 90
  pieces: number; // total pieces, ≥ 2
  radius: number; // centreline radius Rc, mm
  tangent?: number; // straight added to each end piece, mm
}

export interface LobsterResult {
  welds: number;
  weldDeg: number; // α, change of direction at each weld
  cutDeg: number; // β = α/2, saw/cut angle off square
  middle: { qty: number; centre: number; long: number; short: number };
  end: { qty: number; centre: number; long: number; short: number };
  totalCentreline: number;
  cutDepth: number; // D·tan β, the template's deepest point
  /** Pipe to buy, sum of the long sides (each piece is cut from the long side). */
  stockLength: number;
}

export function mitreCutBack(phi: number, od: number, betaRad: number): number {
  return (od / 2) * Math.tan(betaRad) * (1 - Math.cos(phi));
}

export function lobster(i: LobsterInput): Result<LobsterResult> {
  const bad = positive('pipe outside diameter', i.od) ?? positive('centreline radius', i.radius);
  if (bad) return fail(bad);
  if (!Number.isFinite(i.bendDeg) || i.bendDeg <= 0 || i.bendDeg > 180) return fail('Bend angle must be more than 0° and no more than 180°.');
  if (!Number.isInteger(i.pieces) || i.pieces < 2 || i.pieces > 40) return fail('Pieces must be a whole number from 2 to 40.');
  const tangent = i.tangent ?? 0;
  if (!Number.isFinite(tangent) || tangent < 0) return fail('Straight on each end cannot be negative.');
  if (i.radius < i.od / 2) return fail('Centreline radius must be at least half the pipe OD, or the inside of the bend folds over itself.');
  const welds = i.pieces - 1;
  const alpha = i.bendDeg / welds;
  if (alpha > 90) return fail('Each weld would turn more than 90°. Use more pieces.');
  const beta = alpha / 2;
  const tb = Math.tan(beta * DEG);
  const R = i.radius;
  const r = i.od / 2;
  const middle = { qty: i.pieces - 2, centre: 2 * R * tb, long: 2 * (R + r) * tb, short: 2 * (R - r) * tb };
  const end = { qty: 2, centre: R * tb + tangent, long: (R + r) * tb + tangent, short: (R - r) * tb + tangent };
  const totalCentreline = middle.qty * middle.centre + end.qty * end.centre;
  const stockLength = middle.qty * middle.long + end.qty * end.long;
  const steps: Step[] = [
    { label: 'Welds', formula: 'pieces − 1', value: `${i.pieces} − 1 = ${welds}` },
    { label: 'Turn at each weld', formula: 'α = bend / welds', value: `${fmt(i.bendDeg, 1)} / ${welds} = ${fmt(alpha, 2)}°` },
    { label: 'Cut angle off square, each face', formula: 'β = α / 2', value: `${fmt(beta, 2)}°` },
    { label: 'Middle piece, centreline', formula: '2 × Rc × tan β', value: `2 × ${fmt(R, 1)} × ${fmt(tb, 4)} = ${fmt(middle.centre, 1)} mm` },
    { label: 'Middle piece, long side', formula: '2 × (Rc + OD/2) × tan β', value: `${fmt(middle.long, 1)} mm` },
    { label: 'Middle piece, short side', formula: '2 × (Rc − OD/2) × tan β', value: `${fmt(middle.short, 1)} mm` },
    { label: 'End piece, centreline', formula: 'Rc × tan β + straight', value: `${fmt(R * tb, 1)} + ${fmt(tangent, 1)} = ${fmt(end.centre, 1)} mm` },
  ];
  const warnings: string[] = [];
  if (beta > 22.5) warnings.push('Cuts over 22.5° off square: ASME B31.3 applies stricter rules to these mitres. Check the design code before using it on pressure pipe.');
  if (R < i.od) warnings.push('Tight radius (under 1 × OD): the short sides are very short. Check the inside welds can be reached.');
  return {
    ok: true,
    value: { welds, weldDeg: alpha, cutDeg: beta, middle, end, totalCentreline, cutDepth: i.od * tb, stockLength },
    steps,
    warnings,
  };
}

/** Piece outlines of the bend: welds lie on radial lines at β, β + α, …; outside corners at (Rc + r)/cos β. */
export function bendOutline(od: number, R: number, bendDeg: number, pieces: number): [number, number][][] {
  const W = pieces - 1;
  const a = (bendDeg / W) * (Math.PI / 180);
  const b = a / 2;
  const r = od / 2;
  const at = (rad: number, ang: number): [number, number] => [rad * Math.cos(ang), rad * Math.sin(ang)];
  const cuts: { ang: number; k: number }[] = [{ ang: 0, k: 1 }];
  for (let i = 0; i < W; i++) cuts.push({ ang: b + i * a, k: 1 / Math.cos(b) });
  cuts.push({ ang: bendDeg * (Math.PI / 180), k: 1 });
  const out: [number, number][][] = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const p = cuts[i], q = cuts[i + 1];
    out.push([at((R - r) * p.k, p.ang), at((R + r) * p.k, p.ang), at((R + r) * q.k, q.ang), at((R - r) * q.k, q.ang)]);
  }
  return out;
}

