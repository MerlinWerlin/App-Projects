// Seeded randomness. Every pet stores its seed, so it can be redrawn identically
// on any phone and (from phase 2) re-checked by the server.

/** FNV-1a 32-bit hash of a string. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mulberry32: small, fast, good enough for game rolls. Returns floats in [0, 1). */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick one item from a list. */
export function pick<T>(rng: () => number, items: readonly T[]): T {
  if (items.length === 0) throw new Error('pick from empty list');
  const i = Math.min(items.length - 1, Math.floor(rng() * items.length));
  return items[i] as T;
}

/** Pick by weight. Weights must be >= 0 and not all zero. */
export function pickWeighted<T>(rng: () => number, items: readonly { item: T; weight: number }[]): T {
  const total = items.reduce((s, x) => s + Math.max(0, x.weight), 0);
  if (total <= 0) throw new Error('no positive weights');
  let r = rng() * total;
  for (const x of items) {
    r -= Math.max(0, x.weight);
    if (r < 0) return x.item;
  }
  return items[items.length - 1]!.item;
}

/** A fresh seed from a time value and a counter (no Math.random so tests stay stable when injected). */
export function newSeed(now: number, counter: number, salt = ''): number {
  return hashString(`${now}:${counter}:${salt}`);
}
