// Category switch performance (T107, owner follow-up 22 Oct "fb-1022-perf": tapping a category
// bubble lags; keep the big bounce, lose the stutter). Pure TS so Node tests it:
//
// - createSelectionStore: the selected bubble key lives outside React state. A press notifies only
//   the subscribers of the old and the new key, so only those two bubbles re-render.
// - createCategorySwitch: the press updates the store at once (the bounce starts on that frame)
//   and hands the grid swap to an injected scheduler (the UI uses requestAnimationFrame +
//   startTransition), coalescing quick presses into one grid commit.
// - buildThemeIndex: theme lists grouped by category once, so a page change is a lookup that
//   returns the same array every time (memoised cards keep their props).
// - revealSteps / nextReveal: how many showcase cards are mounted on each frame after a swap,
//   so the first rows appear straight away and the rest arrive a few cards per frame.

import type { Theme, ThemeCategoryId } from './themes.ts';

export type Unsubscribe = () => void;

export type SelectionStore<K extends string> = {
  get(): K;
  /** Select `next`; returns the keys whose selected state changed (empty, or [old, new]). */
  set(next: K): K[];
  /** Listen for changes of one key's selected state (a bubble). */
  subscribeKey(key: K, listener: () => void): Unsubscribe;
  /** Listen for every change (the row's scroll-into-view). */
  subscribe(listener: () => void): Unsubscribe;
};

export function createSelectionStore<K extends string>(initial: K): SelectionStore<K> {
  let current = initial;
  const byKey = new Map<K, Set<() => void>>();
  const all = new Set<() => void>();
  const notifyKey = (k: K) => {
    const set = byKey.get(k);
    if (set) for (const l of [...set]) l();
  };
  return {
    get: () => current,
    set(next) {
      if (next === current) return [];
      const prev = current;
      current = next;
      notifyKey(prev);
      notifyKey(next);
      for (const l of [...all]) l();
      return [prev, next];
    },
    subscribeKey(key, listener) {
      let set = byKey.get(key);
      if (!set) {
        set = new Set();
        byKey.set(key, set);
      }
      set.add(listener);
      return () => {
        set!.delete(listener);
      };
    },
    subscribe(listener) {
      all.add(listener);
      return () => {
        all.delete(listener);
      };
    },
  };
}

export type CategorySwitch<K extends string> = {
  /** A bubble press (or a swipe step). Returns the keys whose bubbles change (at most two). */
  press(key: K): K[];
  /** True while a grid commit is scheduled but not yet run. */
  pending(): boolean;
};

export type SwitchOptions<K extends string> = {
  store: SelectionStore<K>;
  /** Swap the grid to `key` (UI: startTransition(() => setCategory(...))). Called once per frame at most. */
  commitGrid: (key: K) => void;
  /** Run `cb` after the bounce has started (UI: requestAnimationFrame). */
  schedule: (cb: () => void) => void;
};

export function createCategorySwitch<K extends string>({ store, commitGrid, schedule }: SwitchOptions<K>): CategorySwitch<K> {
  let waiting = false;
  return {
    press(key) {
      const changed = store.set(key);
      if (changed.length > 0 && !waiting) {
        waiting = true;
        schedule(() => {
          waiting = false;
          commitGrid(store.get());
        });
      }
      return changed;
    },
    pending: () => waiting,
  };
}

export type ThemeIndex<T extends Theme = Theme> = {
  all: readonly T[];
  byCategory: ReadonlyMap<ThemeCategoryId, readonly T[]>;
};

const EMPTY: readonly never[] = Object.freeze([]);

/** Group `themes` by category in one pass, keeping gallery order inside each group. */
export function buildThemeIndex<T extends Theme>(themes: readonly T[]): ThemeIndex<T> {
  const groups = new Map<ThemeCategoryId, T[]>();
  for (const t of themes) {
    for (const id of new Set(t.categories ?? [])) {
      let g = groups.get(id);
      if (!g) {
        g = [];
        groups.set(id, g);
      }
      g.push(t);
    }
  }
  const frozen = new Map<ThemeCategoryId, readonly T[]>();
  for (const [id, g] of groups) frozen.set(id, Object.freeze(g));
  return { all: themes, byCategory: frozen };
}

/** The themes of one page: the same array on every call (null = every theme). */
export function themesForPage<T extends Theme>(index: ThemeIndex<T>, category: ThemeCategoryId | null): readonly T[] {
  if (category === null) return index.all;
  return index.byCategory.get(category) ?? (EMPTY as readonly T[]);
}

/** Cards mounted on the first frame after a swap (two rows of two). */
export const REVEAL_FIRST = 4;
/** Cards added on each following frame. */
export const REVEAL_BATCH = 4;

/** Next mounted-card count after one frame. */
export function nextReveal(current: number, total: number, batch: number = REVEAL_BATCH): number {
  return Math.min(total, Math.max(0, current) + Math.max(1, batch));
}

/** Whether the card at `index` is mounted yet (otherwise a placeholder holds its place). */
export function isRevealed(index: number, revealed: number): boolean {
  return index < revealed;
}

/** Every mounted-card count from the swap until the page is complete. */
export function revealSteps(total: number, first: number = REVEAL_FIRST, batch: number = REVEAL_BATCH): number[] {
  if (total <= 0) return [0];
  const out = [Math.min(total, Math.max(1, first))];
  while (out[out.length - 1] < total) out.push(nextReveal(out[out.length - 1], total, batch));
  return out;
}

