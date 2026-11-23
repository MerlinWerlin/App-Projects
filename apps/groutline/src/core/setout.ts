/**
 * Set-out: where to start the grid so the edge cuts are even and not thin slivers.
 *
 * Standard trade method (TTA / BS 5385-1 and -3 guidance, AS 3958.1 set-out, TCNA layout guidance; see
 * docs/SOURCES.md "Set-out"): find the centre line of the area, then try (a) a joint on the centre line and
 * (b) a tile centred on the centre line. Keep the one whose edge cuts are larger; cuts should be at least half a tile
 * where possible and never a sliver. A third option starts with a full tile against one wall (for a feature wall,
 * a doorway or a straight edge), which leaves all the cut on the far side.
 *
 * Geometry for one direction (all mm): span D between the walls, tile T, joint j, gap g left at each wall,
 * module m = T + j. Joint centres sit at c + o + k·m where c is the centre and o = 0 (joint on centre) or m/2 (tile
 * on centre). The edge cut each side = distance from the last joint centre to the wall − j/2 − g.
 */
import { fail, fmt, type CalcResult, type Problem, type Step } from './steps.ts';
import { formatLength, type UnitSystem } from './units.ts';

export type SetoutMode = 'joint' | 'tile' | 'wall';

export interface AxisPlan {
  mode: SetoutMode;
  span: number;
  /** Full tiles across this direction. */
  full: number;
  /** Cut piece at the start (left/top) wall and at the end wall, mm; 0 = no cut needed. */
  cutStart: number;
  cutEnd: number;
  /** Tile edges from the start wall, in mm, for drawing: [start, end] of each piece in order. */
  pieces: Array<[number, number]>;
}

const EPS = 0.5; // half a millimetre: anything smaller is a flush fit, not a cut

export function planAxis(span: number, tile: number, joint: number, gap: number, mode: SetoutMode): AxisPlan {
  const m = tile + joint;
  const usable = span - 2 * gap;
  const pieces: Array<[number, number]> = [];
  if (usable <= tile + EPS) {
    // Narrower than one tile: one piece, cut to fit (or exactly one full tile).
    const w = Math.max(0, usable);
    const isFull = Math.abs(w - tile) <= EPS;
    pieces.push([gap, gap + w]);
    return { mode, span, full: isFull ? 1 : 0, cutStart: isFull ? 0 : w, cutEnd: 0, pieces };
  }
  if (mode === 'wall') {
    const n = Math.floor((usable + joint + EPS) / m);
    let cut = usable - n * m; // after n tiles and n joints
    let full = n;
    if (cut < EPS) cut = 0; // flush
    let x = gap;
    for (let i = 0; i < full; i++) { pieces.push([x, x + tile]); x += m; }
    if (cut > 0) pieces.push([x, x + cut]);
    return { mode, span, full, cutStart: 0, cutEnd: cut, pieces };
  }
  const half = span / 2;
  const o = mode === 'joint' ? 0 : m / 2;
  // Distance from the centre to the outermost joint centre that leaves room for a joint and the gap.
  let k = Math.floor((half - o) / m + 1e-9);
  let r = half - o - k * m;
  let cut = r - joint / 2 - gap;
  if (cut < -EPS) { k -= 1; cut += m; }
  if (Math.abs(cut) <= EPS) cut = 0;
  if (Math.abs(cut - tile) <= EPS) { k += 1; cut = 0; }
  const full = mode === 'joint' ? 2 * k : 1 + 2 * k;
  // Lay the pieces out from the start wall.
  let x = gap;
  if (cut > 0) { pieces.push([x, x + cut]); x += cut + joint; }
  for (let i = 0; i < full; i++) { pieces.push([x, x + tile]); x += m; }
  if (cut > 0) pieces.push([x, x + cut]);
  return { mode, span, full, cutStart: cut, cutEnd: cut, pieces };
}

export interface SetoutInput {
  lengthMm: number;
  widthMm: number;
  tileLengthMm: number;
  tileWidthMm: number;
  jointMm: number;
  gapMm: number;
  /** null = pick the best of joint-on-centre and tile-on-centre for each direction. */
  modeX: SetoutMode | null;
  modeY: SetoutMode | null;
  system: UnitSystem;
}

export interface SetoutResult {
  x: AxisPlan;
  y: AxisPlan;
  alternativesX: AxisPlan[];
  alternativesY: AxisPlan[];
  fullTiles: number;
  cutTiles: number;
  /** Tiles to cut every piece from a separate tile (no reuse of offcuts). */
  tilesNeeded: number;
  smallestCut: number;
}

const minCut = (p: AxisPlan) => {
  const cuts = [p.cutStart, p.cutEnd].filter(c => c > 0);
  return cuts.length ? Math.min(...cuts) : Infinity;
};

/** Best centred plan: the larger of the two smallest cuts; ties go to fewer cut pieces. */
export function bestCentred(span: number, tile: number, joint: number, gap: number): AxisPlan {
  const a = planAxis(span, tile, joint, gap, 'joint');
  const b = planAxis(span, tile, joint, gap, 'tile');
  const ma = minCut(a), mb = minCut(b);
  if (ma === mb) return a.pieces.length <= b.pieces.length ? a : b;
  return ma > mb ? a : b;
}

export const MODE_NAME: Record<SetoutMode, string> = {
  joint: 'Joint on the centre line',
  tile: 'Tile centred on the centre line',
  wall: 'Full tile from the start wall',
};

export function calcSetout(input: SetoutInput): CalcResult<SetoutResult> {
  const { lengthMm: Lx, widthMm: Ly, tileLengthMm: tx, tileWidthMm: ty, jointMm: j, gapMm: g, system } = input;
  const problems: Problem[] = [];
  if (!(Lx > 0) || !(Ly > 0)) problems.push({ field: 'area', message: 'Enter the length and width of the area.' });
  if (!(tx > 0) || !(ty > 0)) problems.push({ field: 'tile', message: 'Enter the tile size.' });
  if (!(j >= 0) || j > 50) problems.push({ field: 'joint', message: 'Joint width must be between 0 and 50 mm.' });
  if (!(g >= 0) || g > 50) problems.push({ field: 'gap', message: 'Gap at the walls must be between 0 and 50 mm.' });
  if (Lx > 0 && Ly > 0 && (Lx > 100_000 || Ly > 100_000)) problems.push({ field: 'area', message: 'Areas over 100 m long: split the job into bays.' });
  if (problems.length) return fail(...problems);

  const alternativesX = (['joint', 'tile', 'wall'] as SetoutMode[]).map(m => planAxis(Lx, tx, j, g, m));
  const alternativesY = (['joint', 'tile', 'wall'] as SetoutMode[]).map(m => planAxis(Ly, ty, j, g, m));
  const x = input.modeX ? planAxis(Lx, tx, j, g, input.modeX) : bestCentred(Lx, tx, j, g);
  const y = input.modeY ? planAxis(Ly, ty, j, g, input.modeY) : bestCentred(Ly, ty, j, g);
  const cols = x.pieces.length, rows = y.pieces.length;
  const fullTiles = x.full * y.full;
  const tilesNeeded = cols * rows;
  const cutTiles = tilesNeeded - fullTiles;
  const smallestCut = Math.min(minCut(x), minCut(y));
  const L = (v: number) => formatLength(v, system, 'tile');
  const steps: Step[] = [];
  const axisSteps = (name: string, p: AxisPlan, t: number) => {
    steps.push({ label: `${name}: module`, working: `${L(t)} tile + ${L(j)} joint`, result: L(t + j) });
    if (p.mode !== 'wall') steps.push({ label: `${name}: centre line`, working: `${formatLength(p.span, system)} ÷ 2`, result: formatLength(p.span / 2, system) });
    steps.push({ label: `${name}: ${MODE_NAME[p.mode].toLowerCase()}`, working: p.cutStart || p.cutEnd ? `${p.full} full tiles, cuts ${p.cutStart ? L(p.cutStart) : 'none'} and ${p.cutEnd ? L(p.cutEnd) : 'none'}` : `${p.full} full tiles, no cuts`, result: `${p.pieces.length} pieces` });
  };
  axisSteps('Length', x, tx);
  axisSteps('Width', y, ty);
  steps.push({ label: 'Tiles on the grid', working: `${fmt(cols, 0)} × ${fmt(rows, 0)} pieces (${fmt(fullTiles, 0)} full + ${fmt(cutTiles, 0)} cut)`, result: `${fmt(tilesNeeded, 0)} tiles` });
  const notes: string[] = [];
  const half = (t: number) => t / 2;
  if (x.cutStart > 0 && x.cutStart < half(tx) || x.cutEnd > 0 && x.cutEnd < half(tx)) notes.push(`Length cuts are under half a tile (${L(Math.min(minCut(x)))}). Try the other centring option, or move the start line.`);
  if (y.cutStart > 0 && y.cutStart < half(ty) || y.cutEnd > 0 && y.cutEnd < half(ty)) notes.push(`Width cuts are under half a tile (${L(minCut(y))}). Try the other centring option, or move the start line.`);
  if (Number.isFinite(smallestCut) && smallestCut < 25) notes.push(`A ${L(smallestCut)} sliver is hard to cut and bond. Change the set-out or the joint width.`);
  notes.push('Counts every cut piece from its own tile. Reusing offcuts can save some, so check against the tile count with waste.');
  return { ok: true, value: { x, y, alternativesX, alternativesY, fullTiles, cutTiles, tilesNeeded, smallestCut }, steps, notes };
}

export const describeCut = (mm: number, system: UnitSystem) => (mm > 0 ? formatLength(mm, system, 'tile') : 'none');
export { fmt };
