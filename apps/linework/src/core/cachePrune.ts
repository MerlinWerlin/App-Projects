// Pure selection logic for pruning cached files (e.g. outline PNGs). No I/O here.

export type CacheEntry = { name: string; time: number };

/**
 * Names of the entries to delete so that only the `keep` newest remain.
 * Newer = larger `time`; entries with a missing/non-finite time count as oldest.
 * Ties break by name (larger name = newer) so the result is deterministic.
 * Duplicate names are treated as one file (its newest time wins).
 */
export function filesToPrune(entries: readonly CacheEntry[], keep: number): string[] {
  const k = Number.isFinite(keep) ? Math.max(0, Math.floor(keep)) : 0;
  const byName = new Map<string, number>();
  for (const e of entries) {
    if (!e || typeof e.name !== 'string' || !e.name) continue;
    const t = typeof e.time === 'number' && Number.isFinite(e.time) ? e.time : -Infinity;
    const prev = byName.get(e.name);
    if (prev === undefined || t > prev) byName.set(e.name, t);
  }
  const sorted = [...byName].sort((a, b) => {
    if (a[1] !== b[1]) return b[1] - a[1];
    return a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0;
  });
  return sorted.slice(k).map(([name]) => name);
}

/** Millisecond timestamp encoded in an outline file name (`outline-<base36 ms>-<n>.png`), or null. */
export function outlineNameTime(name: string): number | null {
  const m = /^outline-([0-9a-z]+)-\d+\.png$/i.exec(name);
  if (!m) return null;
  const t = parseInt(m[1], 36);
  return Number.isFinite(t) ? t : null;
}
