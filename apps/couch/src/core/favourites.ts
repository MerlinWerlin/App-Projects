import type { TvApp } from './types';

/**
 * Editable app shortcuts (T73): the user's favourite apps for one TV, as an ordered list of app ids.
 * Pure TS (no React Native) so every rule is unit-tested in Node.
 *
 * - A list holds each id once, only strings, and at most FAVOURITES_CAP ids.
 * - reconcile() fits a stored list to what the TV reports now: ids the TV no longer lists are
 *   dropped, the order of the rest is kept. It never invents favourites.
 * - Edits (add / remove / move) return a new list and never mutate their input.
 * - Storage is per TV, keyed by the saved TV id (FavouritesRepo below). Demo and unsaved TVs keep
 *   their favourites in memory until the app restarts.
 */

/** Most favourites per TV: four rows of three tiles on a phone. */
export const FAVOURITES_CAP = 12;

/** Dedupes, drops non-strings / empty ids and applies the cap. Accepts untrusted stored data. */
export function normaliseFavourites(raw: unknown, cap: number = FAVOURITES_CAP): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of raw) {
    if (typeof v !== 'string' || v === '' || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
    if (out.length >= cap) break;
  }
  return out;
}

/** Keeps only ids the TV currently reports, in the stored order (deduped, capped). */
export function reconcileFavourites(
  favs: readonly string[],
  apps: readonly TvApp[],
  cap: number = FAVOURITES_CAP,
): string[] {
  const present = new Set(apps.map((a) => a.id));
  return normaliseFavourites(
    favs.filter((id) => present.has(id)),
    cap,
  );
}

/**
 * Starting list for a TV: the stored list when there is one (even an empty one: the user removed
 * everything), else whatever the TV/driver marks as pinned, in list order. Reconciled either way.
 */
export function initialFavourites(
  saved: readonly string[] | null,
  apps: readonly TvApp[],
  cap: number = FAVOURITES_CAP,
): string[] {
  const base = saved ?? apps.filter((a) => a.pinned).map((a) => a.id);
  return reconcileFavourites(base, apps, cap);
}

export function isFavourite(favs: readonly string[], id: string): boolean {
  return favs.includes(id);
}

/** Another favourite can be added (below the cap). */
export function canAddFavourite(favs: readonly string[], cap: number = FAVOURITES_CAP): boolean {
  return favs.length < cap;
}

/** Appends `id`. Unchanged (same contents) when it is already a favourite or the list is full. */
export function addFavourite(favs: readonly string[], id: string, cap: number = FAVOURITES_CAP): string[] {
  if (id === '' || favs.includes(id) || !canAddFavourite(favs, cap)) return [...favs];
  return [...favs, id];
}

export function removeFavourite(favs: readonly string[], id: string): string[] {
  return favs.filter((f) => f !== id);
}

/** Adds or removes `id` (adding respects the cap). */
export function toggleFavourite(favs: readonly string[], id: string, cap: number = FAVOURITES_CAP): string[] {
  return favs.includes(id) ? removeFavourite(favs, id) : addFavourite(favs, id, cap);
}

/** Moves `id` by `by` places (negative = earlier), clamped to the ends. Unknown ids: unchanged. */
export function moveFavourite(favs: readonly string[], id: string, by: number): string[] {
  const from = favs.indexOf(id);
  if (from < 0 || !Number.isFinite(by) || by === 0) return [...favs];
  const to = Math.max(0, Math.min(favs.length - 1, from + Math.trunc(by)));
  return moveFavouriteTo(favs, from, to);
}

/** Moves the item at index `from` to index `to` (both clamped). */
export function moveFavouriteTo(favs: readonly string[], from: number, to: number): string[] {
  const out = [...favs];
  if (out.length === 0) return out;
  const f = Math.max(0, Math.min(out.length - 1, Math.trunc(from)));
  const t = Math.max(0, Math.min(out.length - 1, Math.trunc(to)));
  if (f === t) return out;
  const [item] = out.splice(f, 1);
  out.splice(t, 0, item!);
  return out;
}

/** Whether `id` can move earlier (-1) or later (+1). */
export function canMoveFavourite(favs: readonly string[], id: string, dir: -1 | 1): boolean {
  const i = favs.indexOf(id);
  if (i < 0) return false;
  return dir < 0 ? i > 0 : i < favs.length - 1;
}

export type FavouriteEdit =
  | { kind: 'add'; id: string }
  | { kind: 'remove'; id: string }
  | { kind: 'toggle'; id: string }
  | { kind: 'move'; id: string; by: number };

/** One edit applied to a list (the hook's single entry point). */
export function applyFavouriteEdit(
  favs: readonly string[],
  edit: FavouriteEdit,
  cap: number = FAVOURITES_CAP,
): string[] {
  switch (edit.kind) {
    case 'add':
      return addFavourite(favs, edit.id, cap);
    case 'remove':
      return removeFavourite(favs, edit.id);
    case 'toggle':
      return toggleFavourite(favs, edit.id, cap);
    case 'move':
      return moveFavourite(favs, edit.id, edit.by);
  }
}

export function sameFavourites(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

export interface AppSections {
  /** Favourites in the user's order, `pinned: true`. */
  favourites: TvApp[];
  /** Every other app, alphabetical (then by id), `pinned: false`. */
  others: TvApp[];
}

/** Splits the TV's apps into the Favourites section and the rest. */
export function splitApps(apps: readonly TvApp[], favs: readonly string[]): AppSections {
  const byId = new Map(apps.map((a) => [a.id, a]));
  const favourites: TvApp[] = [];
  const seen = new Set<string>();
  for (const id of favs) {
    const a = byId.get(id);
    if (!a || seen.has(id)) continue;
    seen.add(id);
    favourites.push({ ...a, pinned: true });
  }
  const others = apps
    .filter((a) => !seen.has(a.id))
    .map((a) => ({ ...a, pinned: false }))
    .sort((x, y) => x.name.localeCompare(y.name, undefined, { sensitivity: 'base' }) || x.id.localeCompare(y.id));
  return { favourites, others };
}

/** Where favourites are stored for saved TVs (SavedTvStore's per-TV pins satisfy this). */
export interface FavouritesBacking {
  /** The stored list, or null when none was ever saved. */
  savedPins(tvId: string): Promise<string[] | null>;
  /** Persists the list; a no-op for TVs that are not saved (demo / unsaved). */
  setPins(tvId: string, ids: readonly string[]): Promise<void>;
}

/**
 * Per-TV favourites with an in-memory layer over the persistent backing: the memory layer answers
 * at once after an edit (and is the only storage for demo TVs, which the backing does not keep).
 * Never throws: storage failures read as "never saved" and writes are best effort.
 */
export class FavouritesRepo {
  private readonly memory = new Map<string, string[]>();

  constructor(
    private readonly backing: FavouritesBacking,
    private readonly cap: number = FAVOURITES_CAP,
  ) {}

  /** Synchronous answer from memory, or undefined when the backing has to be asked. */
  peek(tvId: string): string[] | undefined {
    const m = this.memory.get(tvId);
    return m ? [...m] : undefined;
  }

  async load(tvId: string): Promise<string[] | null> {
    const m = this.memory.get(tvId);
    if (m) return [...m];
    try {
      const saved = await this.backing.savedPins(tvId);
      if (saved === null) return null;
      // An edit may have landed while the backing was being read; it wins.
      const now = this.memory.get(tvId);
      return now ? [...now] : normaliseFavourites(saved, this.cap);
    } catch {
      return null;
    }
  }

  async save(tvId: string, ids: readonly string[]): Promise<void> {
    const list = normaliseFavourites(ids, this.cap);
    this.memory.set(tvId, list);
    try {
      await this.backing.setPins(tvId, list);
    } catch {
      // best effort: the memory layer still holds it for this run
    }
  }

  /** Forget the memory layer (tests, or after the TV is removed). */
  clear(tvId?: string): void {
    if (tvId === undefined) this.memory.clear();
    else this.memory.delete(tvId);
  }
}
