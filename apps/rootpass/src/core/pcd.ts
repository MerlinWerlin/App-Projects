/**
 * Bolt circle (PCD, pitch circle diameter) hole positions.
 *
 * Hole k of n on a circle of diameter D, starting at angle a0 and going clockwise from 12 o'clock:
 *   angle_k = a0 + 360°·k / n
 *   X_k = (D/2) · sin(angle_k),   Y_k = (D/2) · cos(angle_k)        (X right, Y up, from the centre)
 * Distance between neighbouring hole centres (to check with a tape or dividers):  chord = D · sin(180° / n).
 * Source: Machinery's Handbook, 31st ed., "Hole circles" (chord and coordinate tables use these formulas).
 *
 * "Straddle" puts the first hole half a pitch off the centreline (a0 = 180°/n), the usual flange layout, so no
 * hole sits on the vertical or horizontal centreline (AS 2129 and ASME B16.5 flanges are drilled this way).
 */
import { DEG, fail, fmt, positive, type Result, type Step } from './units.ts';

export interface PcdInput {
  pcd: number; // mm
  holes: number;
  layout: 'onCentre' | 'straddle';
  extraRotationDeg?: number;
  holeDia?: number; // for the printable template and the clash check
}

export interface Hole { n: number; angleDeg: number; x: number; y: number }

export interface PcdResult { holes: Hole[]; chord: number; startDeg: number; pitchDeg: number }

export function pcd(i: PcdInput): Result<PcdResult> {
  const bad = positive('PCD', i.pcd);
  if (bad) return fail(bad);
  if (!Number.isInteger(i.holes) || i.holes < 2 || i.holes > 72) return fail('Holes must be a whole number from 2 to 72.');
  const rot = i.extraRotationDeg ?? 0;
  if (!Number.isFinite(rot)) return fail('Enter the rotation (0 for none).');
  const n = i.holes;
  const pitch = 360 / n;
  const start = (i.layout === 'straddle' ? pitch / 2 : 0) + rot;
  const r = i.pcd / 2;
  const holes: Hole[] = [];
  for (let k = 0; k < n; k++) {
    const a = start + pitch * k;
    const angleDeg = ((a % 360) + 360) % 360;
    holes.push({ n: k + 1, angleDeg, x: clean(r * Math.sin(a * DEG)), y: clean(r * Math.cos(a * DEG)) });
  }
  const chord = i.pcd * Math.sin((180 / n) * DEG);
  const warnings: string[] = [];
  if (i.holeDia !== undefined && i.holeDia > 0 && i.holeDia >= chord) warnings.push('The holes overlap at this PCD: the hole is as wide as the gap between centres.');
  const steps: Step[] = [
    { label: 'Angle between holes', formula: '360° / holes', value: `360 / ${n} = ${fmt(pitch, 3)}°` },
    { label: 'First hole, clockwise from 12 o\'clock', value: `${fmt(start, 3)}°` },
    { label: 'Hole positions from the centre', formula: 'X = PCD/2 × sin(angle), Y = PCD/2 × cos(angle)', value: `PCD/2 = ${fmt(r, 2)} mm` },
    { label: 'Centre-to-centre of neighbouring holes', formula: 'chord = PCD × sin(180° / holes)', value: `${fmt(i.pcd, 2)} × sin(${fmt(180 / n, 3)}°) = ${fmt(chord, 2)} mm` },
  ];
  return { ok: true, value: { holes, chord, startDeg: start, pitchDeg: pitch }, steps, warnings };
}

function clean(v: number): number {
  return Math.abs(v) < 1e-9 ? 0 : v;
}
