// Arcs and arches from a chord (span) and rise: the radius to set a trammel to, the arc length, and offsets from the
// chord line for marking the curve out with a tape and a straightedge.
//  - Intersecting chords theorem: (c/2)^2 = h x (2r - h), so r = c^2 / (8h) + h / 2.
//  - Central angle = 2 asin(c / 2r), or 360° minus that when the rise is more than the radius (more than a semicircle).
//  - Arc length = r x central angle (radians).
//  - Offset from the chord at distance x from the centre of the span: y(x) = sqrt(r^2 - x^2) - (r - h).
import { toDeg, type Fmt } from './units.ts';
import { fail, positive, type Calc, type Check, type Step } from './result.ts';

/** Beyond this a trammel or string line isn't practical on site (mm). */
export const FLAT_RADIUS = 10000;

export type ArcResult = { radius: number; angle: number; arcLength: number; offsets: { x: number; fromEnd: number; y: number }[] };

export function arcFromChord(input: { chord: number; rise: number; divisions?: number | null }, f: Fmt): Calc<ArcResult> {
  const e = positive('span (chord)', input.chord) || positive('rise', input.rise);
  if (e) return fail(e);
  const { chord: c, rise: h } = input;
  const div = input.divisions ?? 8;
  if (!Number.isInteger(div) || div < 2 || div > 40) return fail('Use 2 to 40 divisions.');
  const radius = (c * c) / (8 * h) + h / 2;
  const half = Math.asin(Math.min(1, c / (2 * radius)));
  const theta = h > radius ? 2 * Math.PI - 2 * half : 2 * half;
  const arcLength = radius * theta;
  const offsets: ArcResult['offsets'] = [];
  // Offsets from the chord only describe arches up to a semicircle; a taller arch bulges past the chord ends, so
  // only the radius and centre are given for it.
  for (let i = 0; i <= div && h <= radius + 1e-9; i++) {
    const fromEnd = (c * i) / div;
    const x = fromEnd - c / 2;
    const y = Math.sqrt(Math.max(0, radius * radius - x * x)) - (radius - h);
    offsets.push({ x, fromEnd, y: Math.max(0, y) });
  }
  const steps: Step[] = [
    { label: 'Radius', working: `${f.len(c)}² / (8 x ${f.len(h)}) + ${f.len(h)} / 2 = ${f.len(radius)}` },
    { label: 'Angle of the arc', working: `${h > radius ? '360 - ' : ''}2 x asin(${f.len(c)} / (2 x ${f.len(radius)})) = ${f.deg(toDeg(theta))}` },
    { label: 'Arc length', working: `${f.len(radius)} x ${f.num(theta, 4)} rad = ${f.len(arcLength)}` },
    { label: 'Offsets', working: `sqrt(r² - x²) - (r - rise), every ${f.len(c / div)} along the span` },
  ];
  const checks: Check[] = [];
  if (h > radius + 1e-9) checks.push({ level: 'warn', text: 'Taller than a semicircle: the arch bulges past the ends of the span, so set it out from the centre with the trammel' });
  if (radius > FLAT_RADIUS) checks.push({ level: 'warn', text: `A ${f.len(radius)} radius is too big to swing: mark the offsets below and spring a batten through them` });
  else checks.push({ level: 'ok', text: `Set the trammel points ${f.len(radius)} apart; the centre is ${f.len(Math.abs(radius - h))} ${radius >= h ? 'below' : 'above'} the middle of the span line` });
  return { ok: true, value: { radius, angle: toDeg(theta), arcLength, offsets }, steps, checks };
}
