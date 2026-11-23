// Line set / pair coil planner: how much copper a run needs and which stocked coil lengths cover it with the least
// waste. Pure TypeScript (lineset.test.ts). Lengths in the catalogue's own unit (m or ft).

export type CoilPlan = {
  needed: number;
  coils: number[];
  total: number;
  spare: number;
  joins: number;
  steps: { label: string; value: string }[];
};

/**
 * Length to buy for a run: the measured route plus an allowance at each end (service loop, flaring, bends at the
 * units) and an optional percentage for route uncertainty.
 */
export function neededLength(route: number, perEnd: number, extraPct: number): number {
  if (!(route > 0)) return 0;
  return route + 2 * Math.max(0, perEnd || 0) + route * (Math.max(0, extraPct || 0) / 100);
}

/** Picks the stocked coil (or two coils, joined) covering `needed` with the least spare. Prefers one coil. */
export function planCoils(needed: number, stocked: number[], unit: string): CoilPlan | null {
  const lengths = [...new Set(stocked.filter((x) => x > 0))].sort((a, b) => a - b);
  if (!(needed > 0) || !lengths.length) return null;
  const fmt = (n: number) => `${Math.round(n * 10) / 10} ${unit}`;
  const single = lengths.find((l) => l >= needed);
  let best: { coils: number[]; total: number } | null = single ? { coils: [single], total: single } : null;
  if (!best) {
    // Up to four coils of the longest size, mixed with one shorter, for very long runs.
    for (let n = 1; n <= 6 && !best; n++) {
      for (const extra of [0, ...lengths]) {
        const coils = [...Array(n).fill(lengths[lengths.length - 1]), ...(extra ? [extra] : [])];
        const total = coils.reduce((a, b) => a + b, 0);
        if (total >= needed && (!best || total < best.total)) best = { coils, total };
      }
    }
  }
  if (!best) return null;
  // A shorter mix of two coils can beat one long coil only if it saves a lot; a join costs time and a leak point.
  if (best.coils.length === 1) {
    for (const a of lengths) for (const b of lengths) {
      if (a + b >= needed && a + b < best.total * 0.75) best = { coils: [b, a].sort((x, y) => y - x), total: a + b };
    }
  }
  const joins = best.coils.length - 1;
  return {
    needed,
    coils: best.coils,
    total: best.total,
    spare: best.total - needed,
    joins,
    steps: [
      { label: 'Length needed', value: fmt(needed) },
      { label: best.coils.length === 1 ? 'Coil' : 'Coils', value: best.coils.map(fmt).join(' + ') },
      { label: 'Spare', value: fmt(best.total - needed) },
      ...(joins ? [{ label: 'Joins (braze or approved fitting)', value: String(joins) }] : []),
    ],
  };
}
