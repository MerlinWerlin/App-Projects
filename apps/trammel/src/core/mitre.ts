// Mitres: flat mitres for any corner, polygons, and compound (bevel + mitre) cuts for cornice/crown and splayed sides.
//
//  - Flat mitre: two pieces meeting at a corner of C degrees each get (180 - C) / 2 off square.
//    A polygon of N equal sides: each joint is 180 / N off square (4 sides 45°, 6 sides 30°, 8 sides 22.5°).
//  - Compound mitre, piece lying flat on the saw table. With the piece's face tilted T from the wall (crown/cornice
//    spring angle, or a splayed side's tilt from vertical) and a corner of C degrees:
//        bevel (blade tilt)  B = asin( cos T x cos(C/2) )
//        mitre (table turn)  M = atan( sin T / tan(C/2) )
//    These are the standard crown-moulding and hopper-joint formulas. Check values (90° corner): 45° spring ->
//    bevel 30.0°, mitre 35.3°; 38° spring (52/38 crown) -> bevel 33.9°, mitre 31.6°, matching the setting charts
//    printed on compound mitre saws. A straight run (C = 180) gives 0° and 0°.
//  - Nested (moulding upside down, leaning against the fence at its spring angle): no bevel, mitre = flat mitre.
//  - Inside and outside corners use the same angles; only the side of the blade you keep changes.
import { toDeg, toRad, type Fmt } from './units.ts';
import { fail, type Calc, type Step } from './result.ts';

/** Takes a measured corner (an outside corner measured as 270° works too) and returns 0 < C < 180, or null. */
export function normaliseCorner(deg: number): number | null {
  if (!Number.isFinite(deg)) return null;
  const c = deg > 180 && deg < 360 ? 360 - deg : deg;
  return c > 0 && c < 180 ? c : null;
}

export type FlatMitre = { corner: number; mitre: number; joinAngle: number };

export function flatMitre(cornerDeg: number, f: Fmt): Calc<FlatMitre> {
  const c = normaliseCorner(cornerDeg);
  if (c == null) return fail('Enter the corner angle, more than 0° and less than 180° (or 180-360° for an outside corner).');
  const mitre = (180 - c) / 2;
  const steps: Step[] = [];
  if (c !== cornerDeg) steps.push({ label: 'Corner', working: `360 - ${f.deg(cornerDeg)} = ${f.deg(c)}` });
  steps.push({ label: 'Mitre each piece', working: `(180 - ${f.deg(c)}) / 2 = ${f.deg(mitre)} off square` });
  steps.push({ label: 'Angle on the piece', working: `90 - ${f.deg(mitre)} = ${f.deg(90 - mitre)} from the edge` });
  return { ok: true, value: { corner: c, mitre, joinAngle: 90 - mitre }, steps, checks: [{ level: 'warn', text: 'Walls are rarely exactly 90°: measure the corner with a bevel or angle finder and test on offcuts' }] };
}

export type Polygon = { sides: number; mitre: number; interior: number };

export function polygonMitre(sides: number, f: Fmt): Calc<Polygon> {
  if (!Number.isInteger(sides) || sides < 3) return fail('A polygon needs 3 or more sides (a whole number).');
  if (sides > 360) return fail('Up to 360 sides.');
  const mitre = 180 / sides;
  const interior = 180 - 360 / sides;
  return {
    ok: true,
    value: { sides, mitre, interior },
    steps: [
      { label: 'Interior angle', working: `180 - 360 / ${sides} = ${f.deg(interior)}` },
      { label: 'Mitre each end', working: `180 / ${sides} = ${f.deg(mitre)} off square` },
    ],
    checks: [{ level: 'warn', text: `${sides} pieces x 2 cuts: any error multiplies, so cut a test set first` }],
  };
}

export type Compound = { corner: number; tilt: number; bevel: number; mitre: number; nestedMitre: number };

/** Compound cut with the piece flat on the saw. tilt = crown spring angle, or splay from vertical. */
export function compoundMitre(tiltDeg: number, cornerDeg: number, f: Fmt): Calc<Compound> {
  const c = normaliseCorner(cornerDeg);
  if (c == null) return fail('Enter the corner angle, more than 0° and less than 180° (or 180-360° for an outside corner).');
  if (!Number.isFinite(tiltDeg) || tiltDeg < 0 || tiltDeg > 90) return fail('The spring or tilt angle must be between 0° and 90°.');
  const T = toRad(tiltDeg);
  const half = toRad(c / 2);
  const bevel = toDeg(Math.asin(Math.cos(T) * Math.cos(half)));
  const mitre = toDeg(Math.atan(Math.sin(T) / Math.tan(half)));
  const nestedMitre = (180 - c) / 2;
  const steps: Step[] = [
    { label: 'Bevel (blade tilt)', working: `asin(cos ${f.deg(tiltDeg)} x cos ${f.deg(c / 2)}) = ${f.deg(bevel)}` },
    { label: 'Mitre (table)', working: `atan(sin ${f.deg(tiltDeg)} / tan ${f.deg(c / 2)}) = ${f.deg(mitre)}` },
    { label: 'Or nested against the fence', working: `bevel 0°, mitre (180 - ${f.deg(c)}) / 2 = ${f.deg(nestedMitre)}` },
  ];
  return {
    ok: true,
    value: { corner: c, tilt: tiltDeg, bevel, mitre, nestedMitre },
    steps,
    checks: [{ level: 'warn', text: 'Check the spring angle on your moulding (the angle between its back and the wall) and test on offcuts' }],
  };
}
