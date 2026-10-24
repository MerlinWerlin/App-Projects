// T118 (fb-1024 B, owner 24 Oct: "a little laggy moving around the UI"): module-level caches for
// preview geometry, so a card that mounts again (a page swap, a tab revisit, the same theme in two
// grids) reuses what was computed the first time instead of laying the preview out again.
// Pure TypeScript (Node runs it directly); the UI wraps its hot calls with these.

/** Most entries kept per key object (e.g. a wallpaper drawn at a few preview sizes). */
export const PER_OBJECT_LIMIT = 8;

/**
 * Cache keyed by an object (held weakly, so a theme that goes away frees its entries) plus a
 * small string sub-key (size, look, count). Each object keeps at most `limit` sub-keys, oldest
 * dropped first.
 */
export type WeakKeyedCache<O extends object, V> = {
  get: (obj: O, sub: string, make: () => V) => V;
  /** Entries held for `obj` (for tests). */
  sizeFor: (obj: O) => number;
};

export function weakKeyedCache<O extends object, V>(limit: number = PER_OBJECT_LIMIT): WeakKeyedCache<O, V> {
  const store = new WeakMap<O, Map<string, V>>();
  const cap = Math.max(1, Math.floor(limit));
  return {
    get: (obj: O, sub: string, make: () => V): V => {
      let m = store.get(obj);
      if (!m) {
        m = new Map<string, V>();
        store.set(obj, m);
      }
      if (m.has(sub)) return m.get(sub) as V;
      const v = make();
      m.set(sub, v);
      if (m.size > cap) {
        const oldest = m.keys().next().value;
        if (oldest !== undefined) m.delete(oldest);
      }
      return v;
    },
    sizeFor: (obj: O): number => store.get(obj)?.size ?? 0,
  };
}

/** One-argument function memoised on its (object) argument's identity. */
export function weakMemo<A extends object, R>(fn: (a: A) => R): (a: A) => R {
  const store = new WeakMap<A, R>();
  return (a: A): R => {
    if (store.has(a)) return store.get(a) as R;
    const r = fn(a);
    store.set(a, r);
    return r;
  };
}

/** Bounded string-keyed cache (insertion order; the oldest entry goes first). */
export type BoundedCache<V> = {
  get: (key: string, make: () => V) => V;
  size: () => number;
};

export function boundedCache<V>(limit: number): BoundedCache<V> {
  const m = new Map<string, V>();
  const cap = Math.max(1, Math.floor(limit));
  return {
    get: (key: string, make: () => V): V => {
      if (m.has(key)) return m.get(key) as V;
      const v = make();
      m.set(key, v);
      if (m.size > cap) {
        const oldest = m.keys().next().value;
        if (oldest !== undefined) m.delete(oldest);
      }
      return v;
    },
    size: (): number => m.size,
  };
}

/**
 * Keep the previous value when the next one is equal by `same`, so a reload that finds nothing new
 * (e.g. on tab focus) leaves the state object untouched and React skips the re-render.
 */
export function keepIfSame<T>(prev: T, next: T, same: (a: T, b: T) => boolean): T {
  return same(prev, next) ? prev : next;
}

/** Shallow list equality by a key per item (same length, same keys in the same order). */
export function sameListBy<T>(a: readonly T[], b: readonly T[], keyOf: (x: T) => string): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (keyOf(a[i]) !== keyOf(b[i])) return false;
  return true;
}

/**
 * Items of `next`, with each one replaced by the previous item of the same key when the two are
 * equal by `same`. Memoised rows then see the very same object and skip re-rendering.
 */
export function reuseEqual<T>(prev: readonly T[], next: readonly T[], keyOf: (x: T) => string, same: (a: T, b: T) => boolean): T[] {
  const byKey = new Map<string, T>();
  for (const p of prev) byKey.set(keyOf(p), p);
  return next.map((n) => {
    const p = byKey.get(keyOf(n));
    return p !== undefined && same(p, n) ? p : n;
  });
}

/** Structural equality for plain JSON-like data (stored settings, loaded records). */
export function sameJson(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}
