/**
 * Edge formwork and pegs. Metric inputs (m).
 *
 * - Perimeter of a rectangle = 2(L + W); custom outlines are a list of side lengths.
 * - Boards per side = ⌈side ÷ board length⌉ (a board can be cut, not stretched). Joints are butted over a peg.
 * - Pegs per side = ⌈side ÷ spacing⌉ + 1, so each side is pegged at both ends (one peg each side of a corner,
 *   the usual practice so each board end is held). Spacing is the crew's choice; about 0.9–1.2 m is common
 *   for 100 mm slabs, closer for deeper edges and soft ground. Board joints get an extra peg.
 * - Board depth must be at least the slab edge depth (or the edge beam depth).
 */
import { type Calc, type Errors, type Step, check, fail, hasErrors, ok } from './calc.ts';
import { ceilCount, fmt } from './units.ts';

export interface FormworkInput {
  /** Side lengths in metres. A rectangle is [L, W, L, W]. */
  sides: (number | null)[];
  boardLength: number | null;
  pegSpacing: number | null;
  depth?: number | null;
}
export interface FormworkResult { perimeter: number; boards: number; pegs: number; boardMetres: number; joints: number }

export function formwork(i: FormworkInput): Calc<FormworkResult> {
  const e: Errors = {};
  if (!i.sides.length) e.sides = 'Add at least one side.';
  const sides = i.sides.map((s, k) => check(e, `side${k}`, s, { label: `Side ${k + 1}`, max: 1000 }));
  const B = check(e, 'boardLength', i.boardLength, { label: 'Board length', max: 12 });
  const s = check(e, 'pegSpacing', i.pegSpacing, { label: 'Peg spacing', max: 5 });
  if (hasErrors(e)) return fail(e);
  let boards = 0, pegs = 0, joints = 0;
  const perimeter = sides.reduce((a, b) => a + b, 0);
  for (const side of sides) {
    const b = ceilCount(side / B);
    boards += b;
    joints += b - 1;
    pegs += ceilCount(side / s) + 1;
  }
  pegs += joints;
  const steps: Step[] = [
    { label: 'Perimeter', working: sides.map(x => fmt(x, 2)).join(' + ') + ' m', result: `${fmt(perimeter, 2)} m` },
    { label: `Boards (${fmt(B, 1)} m)`, working: sides.map(x => `⌈${fmt(x, 2)} ÷ ${fmt(B, 1)}⌉`).join(' + '), result: `${boards}` },
    { label: 'Pegs', working: `each side ⌈side ÷ ${fmt(s, 2)} m⌉ + 1, plus ${joints} at board joints`, result: `${pegs}` },
  ];
  const notes: string[] = [];
  if (i.depth && i.depth > 0) notes.push(`Use boards at least ${fmt(i.depth * 1000, 0)} mm deep for this edge.`);
  return ok({ perimeter, boards, pegs, boardMetres: boards * B, joints }, steps, notes);
}
