// fb-1022b B4: near-duplicate guard for a large template library. Each template is reduced to a coarse
// occupancy grid of the points its outlines pass through (path coordinates sampled along straight runs), and two
// templates are near-duplicates when almost every occupied cell of each lies next to one of the other (fuzzy overlap). Cheap enough to
// compare every pair of 500+ templates in a unit test. Pure TS.
import type { Template } from './templates.ts';

export const GRID = 96;
export const DUPLICATE_THRESHOLD = 0.9;
/** Pieces covering more than this share of the grid are dense, intricate art (mandalas, full scenes): their grids
 * overlap by coverage alone, so the occupancy fingerprint can't tell them apart and they are skipped. */
export const DENSE_SHARE = 0.25;

/** Numbers in a path string, paired as x,y (arc flags make this approximate, which is fine for a fingerprint). */
function points(d: string): [number, number][] {
  const nums = (d.match(/-?\d*\.?\d+(?:e-?\d+)?/gi) ?? []).map(Number);
  const out: [number, number][] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) out.push([nums[i], nums[i + 1]]);
  return out;
}

/** Set of occupied cells (GRID × GRID over the 400×400 viewBox). */
export function fingerprint(t: Template): Set<number> {
  const cells = new Set<number>();
  const cell = (x: number, y: number): void => {
    if (!(x >= 0 && x <= 400 && y >= 0 && y <= 400)) return;
    const cx = Math.min(GRID - 1, Math.floor((x / 400) * GRID));
    const cy = Math.min(GRID - 1, Math.floor((y / 400) * GRID));
    cells.add(cy * GRID + cx);
  };
  for (const d of [...t.paths, ...(t.detail ?? [])]) {
    const pts = points(d);
    for (let i = 0; i < pts.length; i++) {
      const [x, y] = pts[i];
      cell(x, y);
      if (i > 0) {
        const [px, py] = pts[i - 1];
        const steps = Math.min(40, Math.ceil(Math.hypot(x - px, y - py) / (400 / GRID / 2)));
        for (let s = 1; s < steps; s++) cell(px + ((x - px) * s) / steps, py + ((y - py) * s) / steps);
      }
    }
  }
  return cells;
}

/** Cells of `a` within one cell of a cell of `b` (tolerates a small nudge or redraw). */
function near(a: Set<number>, b: Set<number>): number {
  let n = 0;
  for (const c of a) {
    const x = c % GRID;
    const y = (c - x) / GRID;
    let hit = false;
    for (let dy = -1; dy <= 1 && !hit; dy++)
      for (let dx = -1; dx <= 1 && !hit; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < GRID && ny < GRID && b.has(ny * GRID + nx)) hit = true;
      }
    if (hit) n++;
  }
  return n;
}

/** Fuzzy overlap in [0, 1]: the smaller of the two one-way shares of cells that the other outline passes close to. */
export function similarity(a: Set<number>, b: Set<number>): number {
  if (a.size === 0 || b.size === 0) return a.size === b.size ? 1 : 0;
  return Math.min(near(a, b) / a.size, near(b, a) / b.size);
}

/** Pairs of templates whose outlines are near-identical, most similar first. */
export function nearDuplicates(templates: readonly Template[], threshold = DUPLICATE_THRESHOLD): { a: string; b: string; score: number }[] {
  const fps = templates.map(fingerprint);
  const sparse = fps.map((fp) => fp.size / (GRID * GRID) <= DENSE_SHARE);
  const out: { a: string; b: string; score: number }[] = [];
  for (let i = 0; i < templates.length; i++)
    for (let j = i + 1; j < templates.length; j++) {
      if (!sparse[i] || !sparse[j]) continue;
      // a copy covers about as many cells as its original; skip pairs of very different coverage (fast path)
      if (Math.min(fps[i].size, fps[j].size) < 0.6 * Math.max(fps[i].size, fps[j].size)) continue;
      const s = similarity(fps[i], fps[j]);
      if (s >= threshold) out.push({ a: templates[i].id, b: templates[j].id, score: Math.round(s * 1000) / 1000 });
    }
  return out.sort((x, y) => y.score - x.score);
}
