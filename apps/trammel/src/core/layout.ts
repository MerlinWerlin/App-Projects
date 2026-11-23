// Spacing layouts (studs, joists, rafters, battens), decking board counts and wall frame material.
//
// Layout convention (the usual Australian set-out): the first and last members sit flush with the ends; the
// centres of the members in between are marked at the spacing measured from the start end (450, 900, 1350...).
// So no gap is ever wider than the spacing. An intermediate mark is dropped if its member would overlap the end
// member. Spacings themselves (450 / 600 mm etc.) come from AS 1684, the sheet or decking maker, or the engineer.
//
// Decking: N boards with N - 1 gaps cover N x board + (N - 1) x gap.
// Full boards = floor((width + gap) / (board + gap)); what is left after them and one more gap is the ripped last
// board, unless it would be under MIN_RIP, then the gaps are opened a little instead.
import { type Fmt } from './units.ts';
import { fail, positive, type Calc, type Check, type Step } from './result.ts';

export type LayoutInput = { length: number; spacing: number; thickness: number };
export type LayoutResult = {
  count: number;
  /** Centre of every member from the start end. */
  centres: number[];
  /** Left edge of every member (where the tape usually hooks the mark). */
  edges: number[];
  /** Clear gaps between neighbouring members (noggin / blocking lengths). */
  gaps: number[];
};

export function layoutMembers(input: LayoutInput, f: Fmt): Calc<LayoutResult> {
  const e = positive('length', input.length) || positive('spacing', input.spacing) || positive('member thickness', input.thickness);
  if (e) return fail(e);
  const { length: L, spacing: s, thickness: t } = input;
  if (t * 2 > L) return fail('Two members are wider than the length. Check the numbers.');
  if (s < 1.5 * t) return fail('The spacing is too tight for this member thickness: the first two members would overlap.');
  if (L / s > 2000) return fail('That is over 2,000 members. Check the spacing and units.');
  const centres = [t / 2];
  // A centre at k x s is kept while its member stays clear of the end member: k x s + t/2 <= L - t.
  for (let k = 1; k * s <= L - 1.5 * t + 1e-9; k++) centres.push(k * s);
  // If dropping a clashing mark left the last bay wider than the centres, add a member hard against the end one.
  const endC = L - t / 2;
  const lastC = centres[centres.length - 1];
  if (endC - lastC > s + 1e-6 && L - 1.5 * t - lastC >= t - 1e-6) centres.push(L - 1.5 * t);
  centres.push(endC);
  const edges = centres.map((c) => c - t / 2);
  const gaps: number[] = [];
  for (let i = 1; i < edges.length; i++) gaps.push(edges[i] - edges[i - 1] - t);
  const steps: Step[] = [
    { label: 'End members', working: `flush at 0 and ${f.len(L)}` },
    { label: 'Centres between', working: `every ${f.len(s)} from the start: ${centres.length - 2} members` },
    { label: 'Total', working: `${centres.length - 2} + 2 ends = ${centres.length}` },
  ];
  const last = gaps[gaps.length - 1];
  let widest = 0;
  for (let i = 1; i < centres.length; i++) widest = Math.max(widest, centres[i] - centres[i - 1]);
  const checks: Check[] =
    widest <= s + 1e-6
      ? [{ level: 'ok', text: `No bay wider than ${f.len(s)} centres (${f.len(s - t)} clear)` }]
      : [{ level: 'fail', text: `One bay is ${f.len(widest)} on centre, wider than ${f.len(s)}: add a member there` }];
  if (gaps.length > 1 && last < s - t - 1e-6) checks.push({ level: 'warn', text: `Last bay is short: ${f.len(last)} clear` });
  checks.push({ level: 'warn', text: 'Add extra members at openings, corners, junctions and wherever sheets or boards join' });
  return { ok: true, value: { count: centres.length, centres, edges, gaps }, steps, checks };
}

export type DeckInput = {
  deckWidth: number;
  deckLength: number;
  boardWidth: number;
  gap: number;
  joistSpacing?: number | null;
  stockLength?: number | null;
  wastePct?: number | null;
  fixingsPerJoist?: number | null;
};

export type DeckResult = {
  boards: number;
  lastBoard: number;
  ripped: boolean;
  /** Extra mm to add to each gap when the leftover is too thin to rip (never more than MAX_GAP_ADJUST). */
  gapAdjust: number;
  /** Both edge boards ripped to this width (when the leftover is too thin for one ripped board). */
  edgeRip: number | null;
  linearMetres: number;
  withWaste: number;
  stockPieces: number | null;
  joists: number | null;
  fixings: number | null;
};

/** A ripped board narrower than this is not worth laying. */
export const MIN_RIP = 20;
/** The most each gap is opened to take up a leftover, mm (beyond this, edge boards are ripped instead). */
export const MAX_GAP_ADJUST = 2;

export function decking(input: DeckInput, f: Fmt): Calc<DeckResult> {
  const e = positive('deck width (across the boards)', input.deckWidth) || positive('deck length (along the boards)', input.deckLength) || positive('board width', input.boardWidth);
  if (e) return fail(e);
  const g = input.gap ?? 0;
  if (!Number.isFinite(g) || g < 0) return fail('The gap can’t be negative.');
  if (g >= input.boardWidth) return fail('The gap is wider than the board. Check the numbers.');
  const W = input.deckWidth;
  const b = input.boardWidth;
  // Full boards that fit with their gaps, then what is left at the edge.
  const full = Math.max(0, Math.floor((W + g) / (b + g) + 1e-9));
  const fullCover = full ? full * b + (full - 1) * g : 0;
  const left = W - fullCover;
  let boards: number;
  let lastBoard = b;
  let ripped = false;
  let gapAdjust = 0;
  let edgeRip: number | null = null;
  const steps: Step[] = [
    { label: 'Full boards', working: `(${f.len(W)} + ${f.len(g)}) / (${f.len(b)} + ${f.len(g)}) = ${f.num((W + g) / (b + g), 2)}, so ${full} full boards cover ${f.len(fullCover)}` },
  ];
  if (full === 0) {
    boards = 1;
    lastBoard = W;
    ripped = true;
    steps.push({ label: 'One board', working: `rip it to ${f.len(W)}` });
  } else if (left <= 0.5) {
    boards = full;
  } else if (left - g >= MIN_RIP) {
    boards = full + 1;
    lastBoard = left - g;
    ripped = true;
    steps.push({ label: 'Last board', working: `${f.len(W)} - ${f.len(fullCover)} - ${f.len(g)} gap = rip it to ${f.len(lastBoard)}` });
  } else if (full > 1 && left / (full - 1) <= MAX_GAP_ADJUST) {
    boards = full;
    gapAdjust = left / (full - 1);
    steps.push({ label: 'Left at the edge', working: `${f.len(left)}: open each gap by ${f.num(gapAdjust, 1)} mm` });
  } else {
    // Too thin to rip one board and too much to hide in the gaps: lay one more board and rip both edge boards.
    boards = full + 1;
    edgeRip = (W - full * g - (full - 1) * b) / 2;
    lastBoard = edgeRip;
    ripped = true;
    steps.push({ label: 'Edge boards', working: `(${f.len(W)} - ${full} gaps - ${full - 1} full boards) / 2 = rip both edge boards to ${f.len(edgeRip)}` });
  }
  const linearMetres = (boards * input.deckLength) / 1000;
  const waste = input.wastePct ?? 10;
  if (!Number.isFinite(waste) || waste < 0 || waste > 100) return fail('Waste must be between 0 and 100%.');
  const withWaste = linearMetres * (1 + waste / 100);
  steps.push({ label: 'Linear metres', working: `${boards} x ${f.len(input.deckLength)} = ${f.num(linearMetres, 2)} m, + ${waste}% = ${f.num(withWaste, 2)} m` });
  let stockPieces: number | null = null;
  let perRow = 1;
  if (input.stockLength && input.stockLength > 0) {
    perRow = Math.ceil(input.deckLength / input.stockLength - 1e-9);
    stockPieces = Math.ceil(boards * perRow * (1 + waste / 100) - 1e-9);
    steps.push({ label: 'Lengths to buy', working: `${boards} rows x ${perRow} length${perRow > 1 ? 's' : ''} of ${f.len(input.stockLength)}, + ${waste}% = ${stockPieces}` });
  }
  let joists: number | null = null;
  let fixings: number | null = null;
  if (input.joistSpacing && input.joistSpacing > 0) {
    joists = Math.ceil(input.deckLength / input.joistSpacing - 1e-9) + 1;
    const per = input.fixingsPerJoist ?? 2;
    // A butt join puts two board ends on one joist, so each join adds another set of fixings.
    const joinFixings = 2 * per * (perRow - 1) * boards;
    fixings = joists * boards * per + joinFixings;
    steps.push({ label: 'Joists under the boards', working: `${f.len(input.deckLength)} / ${f.len(input.joistSpacing)}, round up, + 1 = ${joists}` });
    steps.push({ label: 'Fixings', working: `${joists} joists x ${boards} boards x ${per}${joinFixings ? ` + ${joinFixings} at butt joins` : ''} = ${fixings}` });
  }
  const checks: Check[] = [];
  if (ripped && !edgeRip && lastBoard < b / 2 && boards > 1) checks.push({ level: 'warn', text: `Last board would be only ${f.len(lastBoard)}: you can rip both edge boards to share it instead` });
  if (perRow > 1) checks.push({ level: 'warn', text: 'Butt joins must land on a joist (double it or use the maker’s join clips) and be staggered row to row' });
  checks.push({ level: 'warn', text: 'Board gaps and joist spacing come from the decking maker for your board and species' });
  return { ok: true, value: { boards, lastBoard, ripped, gapAdjust, edgeRip, linearMetres, withWaste, stockPieces, joists, fixings }, steps, checks };
}
