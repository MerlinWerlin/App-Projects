// Square checks: the diagonal of a rectangle, 3-4-5 set-outs, and how far out of square a frame is.
//  - Pythagoras: a rectangle a x b has diagonals sqrt(a^2 + b^2); both diagonals equal means the four corners are
//    square (a parallelogram with equal diagonals is a rectangle).
//  - 3-4-5: any multiple k of the 3-4-5 right triangle (Pythagorean triple) gives a right angle: mark 3k and 4k,
//    the diagonal between the marks must be 5k.
//  - Out of square from one measured diagonal d: the corner angle opposite d is acos((a^2 + b^2 - d^2) / (2ab))
//    (law of cosines). For two measured diagonals of a parallelogram, the corner angle comes from
//    d1^2 - d2^2 = 4ab cos(angle).
import { toDeg, type Fmt } from './units.ts';
import { fail, positive, type Calc, type Check, type Step } from './result.ts';

export type SquareResult = {
  diagonal: number;
  triple: { k: number; a: number; b: number; c: number } | null;
  measured: { corner: number; outBy: number; diff: number } | null;
};

/** Largest 3-4-5 multiple that fits along sides a and b, in whole units of `unit` mm (100 mm by default). */
export function bestTriple(a: number, b: number, unit = 100) {
  const short = Math.min(a, b);
  const long = Math.max(a, b);
  const k = Math.floor(Math.min(short / 3, long / 4) / unit) * unit;
  if (k <= 0) return null;
  return { k, a: 3 * k, b: 4 * k, c: 5 * k };
}

export function squareCheck(input: { a: number; b: number; d1?: number | null; d2?: number | null }, f: Fmt): Calc<SquareResult> {
  const e = positive('first side', input.a) || positive('second side', input.b);
  if (e) return fail(e);
  const { a, b } = input;
  const diagonal = Math.hypot(a, b);
  const steps: Step[] = [{ label: 'Diagonal when square', working: `sqrt(${f.len(a)}² + ${f.len(b)}²) = ${f.len(diagonal)}` }];
  const triple = bestTriple(a, b, a < 1000 || b < 1000 ? 10 : 100);
  if (triple) steps.push({ label: '3-4-5 set-out', working: `mark ${f.len(triple.a)} and ${f.len(triple.b)} from the corner; between the marks = ${f.len(triple.c)}` });
  const checks: Check[] = [];
  let measured: SquareResult['measured'] = null;
  const d1 = input.d1 ?? null;
  const d2 = input.d2 ?? null;
  if (d1 != null && d1 <= 0) return fail('A measured diagonal must be more than zero.');
  if (d2 != null && d2 <= 0) return fail('A measured diagonal must be more than zero.');
  if (d1 && d2) {
    const cos = (d1 * d1 - d2 * d2) / (4 * a * b);
    if (Math.abs(cos) >= 1) return fail('Those diagonals can’t belong to a frame with these sides. Check the measurements.');
    const corner = toDeg(Math.acos(cos));
    const diff = d1 - d2;
    measured = { corner, outBy: Math.abs(90 - corner), diff };
    steps.push({ label: 'Diagonals differ by', working: `${f.len(d1)} - ${f.len(d2)} = ${f.len(Math.abs(diff))}` });
    steps.push({ label: 'Corner angle (where the short diagonal ends)', working: `acos((${f.len(d1)}² - ${f.len(d2)}²) / (4 x ${f.len(a)} x ${f.len(b)})) = ${f.deg(corner)}` });
    if (Math.abs(diff) <= 0.5) checks.push({ level: 'ok', text: 'Diagonals match: the frame is square' });
    else checks.push({ level: Math.abs(diff) <= 3 ? 'warn' : 'fail', text: `Out by ${f.len(Math.abs(diff))} on the diagonals: rack the frame to shorten the long diagonal by about half that (${f.len(Math.abs(diff) / 2)})` });
  } else if (d1) {
    const cos = (a * a + b * b - d1 * d1) / (2 * a * b);
    if (Math.abs(cos) >= 1) return fail('That diagonal can’t close a triangle with these sides. Check the measurements.');
    const corner = toDeg(Math.acos(cos));
    const diff = d1 - diagonal;
    measured = { corner, outBy: Math.abs(90 - corner), diff };
    steps.push({ label: 'Corner angle', working: `acos((${f.len(a)}² + ${f.len(b)}² - ${f.len(d1)}²) / (2 x ${f.len(a)} x ${f.len(b)})) = ${f.deg(corner)}` });
    if (Math.abs(diff) <= 0.5) checks.push({ level: 'ok', text: 'Diagonal matches: the corner is square' });
    else checks.push({ level: Math.abs(diff) <= 3 ? 'warn' : 'fail', text: `Diagonal is ${f.len(Math.abs(diff))} ${diff > 0 ? 'long: the corner is open' : 'short: the corner is closed'} (${f.deg(corner)})` });
  }
  return { ok: true, value: { diagonal, triple, measured }, steps, checks };
}
