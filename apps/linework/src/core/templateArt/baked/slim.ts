// Bake-time thinning of straight-line runs (merge-art, 24 Oct 2026). The generators sample curves and clipped outlines
// into fine polylines (occlude.ts keeps points 0.12 apart from the true line); at 1 200+ templates that pushed the
// bundled art past the 6 MB budget (src/core/templates.test.ts). scripts/bake-templates.ts runs every generated set
// through slimTemplates() before writing its baked file, and baked.test.ts checks baked == slim(generated), so the
// generator stays the source of truth. Same rule batch patterns2 uses inside its generator: Ramer–Douglas–Peucker over
// each run of consecutive L points with a 0.45-unit tolerance on the 400-unit canvas (about 0.1 %, under half a
// screen point). Curves (C, Q, A), M points, run ends and every kept number keep their exact original text.

type Pt = { x: number; y: number; sx: string; sy: string };

export const SLIM_TOLERANCE = 0.45;

function rdp(pts: Pt[], tol: number): Pt[] {
  if (pts.length < 3) return pts;
  const keep = new Array<boolean>(pts.length).fill(false);
  keep[0] = keep[pts.length - 1] = true;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const A = pts[a];
    const B = pts[b];
    const len = Math.hypot(B.x - A.x, B.y - A.y);
    let best = -1;
    let bestD = tol;
    for (let k = a + 1; k < b; k++) {
      const P = pts[k];
      const d = len > 1e-9
        ? Math.abs((B.x - A.x) * (A.y - P.y) - (A.x - P.x) * (B.y - A.y)) / len
        : Math.hypot(P.x - A.x, P.y - A.y);
      if (d > bestD) {
        bestD = d;
        best = k;
      }
    }
    if (best >= 0) {
      keep[best] = true;
      stack.push([a, best], [best, b]);
    }
  }
  return pts.filter((_, k) => keep[k]);
}

const ARGS: Record<string, number> = { M: 2, L: 2, C: 6, Q: 4, A: 7, Z: 0 };

/** Thin every run of consecutive absolute L commands in `d`; anything it does not understand is returned unchanged. */
export function slimPath(d: string, tol = SLIM_TOLERANCE): string {
  const tok = d.match(/[A-Za-z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g);
  if (!tok) return d;
  const out: string[] = [];
  let run: Pt[] | null = null;
  let cur: Pt | null = null;
  let start: Pt | null = null;
  const flush = () => {
    if (run) {
      for (const p of rdp(run, tol).slice(1)) out.push(`L ${p.sx} ${p.sy}`);
      run = null;
    }
  };
  let i = 0;
  while (i < tok.length) {
    const c = tok[i++];
    const n = ARGS[c];
    if (n === undefined) return d; // relative or unknown command: leave the path exactly as generated
    const args = tok.slice(i, i + n);
    if (args.length < n || args.some((a) => /[A-Za-z]/.test(a))) return d;
    i += n;
    if (c === 'L') {
      const p: Pt = { x: Number(args[0]), y: Number(args[1]), sx: args[0], sy: args[1] };
      if (!cur) return d;
      if (!run) run = [cur];
      run.push(p);
      cur = p;
      continue;
    }
    flush();
    out.push(n ? `${c} ${args.join(' ')}` : c);
    if (n >= 2) cur = { x: Number(args[n - 2]), y: Number(args[n - 1]), sx: args[n - 2], sy: args[n - 1] };
    if (c === 'M') start = cur;
    if (c === 'Z') cur = start;
  }
  flush();
  const s = out.join(' ');
  return s.length < d.length ? s : d;
}

/** A template set as baked: every path and detail path thinned. Other fields are untouched. */
export function slimTemplates<T extends { paths: readonly string[]; detail?: readonly string[] }>(set: readonly T[], tol = SLIM_TOLERANCE): T[] {
  return set.map((t) => ({
    ...t,
    paths: t.paths.map((d) => slimPath(d, tol)),
    ...(t.detail ? { detail: t.detail.map((d) => slimPath(d, tol)) } : {}),
  }));
}
