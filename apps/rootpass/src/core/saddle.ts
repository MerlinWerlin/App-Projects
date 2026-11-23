/**
 * Pipe-to-pipe saddle (fishmouth / cope) template.
 *
 * Geometry: the intersection of two right circular cylinders, unrolled onto the branch. This is the standard
 * development used in pipe-fitting texts, e.g. W. V. Frankland, "The Pipe Fitter's and Pipe Welder's Handbook"
 * (Glencoe), "Lateral and tee templates"; and H. M. Mohr, "Pipe Fitters' Math Guide" (Construction Trades Press),
 * ch. "Intersections". The ordinate method there (equal divisions round the branch, a length at each line) is
 * exactly what `ordinates` returns; here the same equation is evaluated directly instead of by drawing.
 *
 * Coordinates: header (run) axis = X, header outside surface y² + z² = R².
 * Branch axis direction d = (cos θ, 0, sin θ), passing through (0, e, 0), where θ is the angle between the two
 * axes (90° = square tee) and e is the offset of the branch axis from the header axis (0 = on centre).
 * A point on the branch surface at angle φ round the branch and distance t along its axis:
 *   P = (0, e, 0) + t·d + r·(cos φ·u + sin φ·v),   u = (0, 1, 0),   v = (−sin θ, 0, cos θ)
 *   ⇒ y = e + r cos φ,   z = t sin θ + r sin φ cos θ.
 * On the header surface (top half, z > 0): z = √(R² − y²), so
 *   t(φ) = ( √(R² − (e + r cos φ)²) − r sin φ cos θ ) / sin θ.
 * The template height at φ is the cut-back from a square pipe end: h(φ) = t(φ) − min t.
 * The template width is the branch's outside circumference: x = (OD/2)·φ.
 *
 * φ = 0° and 180° are the two sides of the branch (on the offset line), φ = 90° is the heel (obtuse side, away from
 * the direction the branch leans) and φ = 270° the toe (acute side). For a square tee the heel and toe are the two
 * saddle "crotch" points.
 *
 * Wall thickness: for a set-on branch the INSIDE of the branch wall sits on the header, so the line is worked out
 * at the branch inside radius (r = OD/2 − wall) but still wrapped round the outside (x uses OD). With contact
 * "outside" the outside radius is used (thin wall, or a branch that will be bevelled to sit on its outside edge).
 */
import { DEG, fail, fmt, positive, type Result, type Step } from './units.ts';

export interface SaddleInput {
  headerOD: number; // mm
  branchOD: number; // mm
  branchWall: number; // mm, 0 allowed when contact = 'outside'
  angleDeg: number; // between axes, 10..90
  offset: number; // mm, branch axis from header axis, may be negative
  contact: 'inside' | 'outside';
  /** Optional: branch end height from the header centreline, measured along the branch axis. 0 = not given. */
  heightFromCentre?: number;
  divisions?: number; // ordinate lines, default 16
}

export interface SaddlePoint { phiDeg: number; x: number; h: number }

export interface SaddleResult {
  circumference: number; // outside circumference of the branch (template width)
  maxDepth: number; // deepest cut-back from the square end
  points: SaddlePoint[]; // 0..360° every 1°, for drawing (361 points, last = first + circumference)
  ordinates: SaddlePoint[]; // the ordinate table
  tMin: number; // closest the branch reaches toward the header axis, along the branch axis
  tMax: number;
  contactRadius: number;
  longLength?: number; // pipe length at the longest point, if heightFromCentre given
  shortLength?: number;
}

export function saddleT(phi: number, R: number, r: number, e: number, theta: number): number {
  const y = e + r * Math.cos(phi);
  const under = R * R - y * y;
  const z = Math.sqrt(Math.max(0, under));
  return (z - r * Math.sin(phi) * Math.cos(theta)) / Math.sin(theta);
}

export function validateSaddle(i: SaddleInput): string | null {
  const bad = positive('header outside diameter', i.headerOD) ?? positive('branch outside diameter', i.branchOD);
  if (bad) return bad;
  if (!Number.isFinite(i.angleDeg) || i.angleDeg < 10 || i.angleDeg > 90) return 'Branch angle must be between 10° and 90°.';
  if (!Number.isFinite(i.offset)) return 'Enter the offset (0 for on centre).';
  if (i.contact === 'inside') {
    if (!Number.isFinite(i.branchWall) || i.branchWall <= 0) return 'Enter the branch wall thickness, or choose "Outside of wall".';
    if (i.branchWall * 2 >= i.branchOD) return 'Branch wall is too thick for that diameter.';
  }
  const r = contactRadius(i);
  const R = i.headerOD / 2;
  if (Math.abs(i.offset) + r > R + 1e-9) {
    return Math.abs(i.offset) > 0
      ? 'With that offset the branch hangs past the side of the header. Reduce the offset or the branch size.'
      : 'The branch is bigger than the header. Swap them round: the bigger pipe is the header.';
  }
  const d = i.divisions ?? 16;
  if (!Number.isInteger(d) || d < 4 || d > 72) return 'Ordinate lines must be a whole number from 4 to 72.';
  return null;
}

export function contactRadius(i: SaddleInput): number {
  return i.contact === 'inside' ? i.branchOD / 2 - i.branchWall : i.branchOD / 2;
}

export function saddle(i: SaddleInput): Result<SaddleResult> {
  const bad = validateSaddle(i);
  if (bad) return fail(bad);
  const R = i.headerOD / 2;
  const r = contactRadius(i);
  const ro = i.branchOD / 2;
  const e = i.offset;
  const th = i.angleDeg * DEG;
  const C = Math.PI * i.branchOD;

  const raw: { phiDeg: number; t: number }[] = [];
  for (let k = 0; k <= 3600; k++) {
    const phiDeg = k / 10;
    raw.push({ phiDeg, t: saddleT(phiDeg * DEG, R, r, e, th) });
  }
  const tMin = Math.min(...raw.map(p => p.t));
  const tMax = Math.max(...raw.map(p => p.t));
  const points: SaddlePoint[] = raw.filter((_, k) => k % 10 === 0).map(p => ({ phiDeg: p.phiDeg, x: ro * p.phiDeg * DEG, h: p.t - tMin }));
  const n = i.divisions ?? 16;
  const ordinates: SaddlePoint[] = [];
  for (let k = 0; k <= n; k++) {
    const phiDeg = (360 * k) / n;
    ordinates.push({ phiDeg, x: ro * phiDeg * DEG, h: saddleT(phiDeg * DEG, R, r, e, th) - tMin });
  }

  const steps: Step[] = [
    { label: 'Header radius', formula: 'R = header OD / 2', value: `${fmt(i.headerOD, 2)} / 2 = ${fmt(R, 2)} mm` },
    i.contact === 'inside'
      ? { label: 'Branch contact radius (inside of wall)', formula: 'r = OD / 2 − wall', value: `${fmt(ro, 2)} − ${fmt(i.branchWall, 2)} = ${fmt(r, 2)} mm` }
      : { label: 'Branch contact radius (outside of wall)', formula: 'r = OD / 2', value: `${fmt(r, 2)} mm` },
    { label: 'Template width (branch outside circumference)', formula: 'C = π × branch OD', value: `π × ${fmt(i.branchOD, 2)} = ${fmt(C, 1)} mm` },
    { label: 'Cut line, at each angle φ round the branch', formula: 't = (√(R² − (e + r·cos φ)²) − r·sin φ·cos θ) / sin θ', value: `θ = ${fmt(i.angleDeg, 1)}°, e = ${fmt(e, 1)} mm` },
    { label: 'Deepest cut from the square end', formula: 'h max = t max − t min', value: `${fmt(tMax, 1)} − ${fmt(tMin, 1)} = ${fmt(tMax - tMin, 1)} mm` },
  ];
  const warnings: string[] = [];
  if (i.angleDeg < 30) warnings.push('Shallow laterals under 30° are hard to fit and weld at the toe. Check the toe gap on a mock-up.');
  if (i.contact === 'outside' && i.branchWall > 0) warnings.push('Line worked out on the outside of the branch wall: the inside edge will stand off the header at the sides. Bevel to suit.');

  const value: SaddleResult = { circumference: C, maxDepth: tMax - tMin, points, ordinates, tMin, tMax, contactRadius: r };
  const H = i.heightFromCentre ?? 0;
  if (H > 0) {
    if (H <= tMax) return fail(`The branch end must be further than ${fmt(tMax, 1)} mm from the header centreline, or the cut runs past the end of the pipe.`);
    value.longLength = H - tMin;
    value.shortLength = H - tMax;
    steps.push({ label: 'Pipe to cut (longest point)', formula: 'L = height − t min', value: `${fmt(H, 1)} − ${fmt(tMin, 1)} = ${fmt(H - tMin, 1)} mm` });
  }
  return { ok: true, value, steps, warnings };
}

/** Where the four quarter lines fall, for labels on the template. */
export const QUARTER_LABELS: Record<number, string> = { 0: 'SIDE', 90: 'HEEL', 180: 'SIDE', 270: 'TOE', 360: 'SIDE' };
