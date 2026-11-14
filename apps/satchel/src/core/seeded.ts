// Seeded randomness for the numbers quiz (moved out of the removed travel games, T172). Pure, Node runs it.

/** A 32-bit seed from any text (FNV-1a). */
export function seedFrom(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** A small seeded generator (mulberry32): numbers in [0, 1), the same run for the same seed. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A new copy of `list` in a seeded order (Fisher-Yates). The input is never changed. */
export function shuffle<T>(list: readonly T[], seed: number): T[] {
  const out = list.slice();
  const next = rng(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

/** A fresh seed for a new round (the UI passes Date.now(); tests pass a fixed number). */
export const newSeed = (now: number): number => seedFrom(`seed:${now}`);
