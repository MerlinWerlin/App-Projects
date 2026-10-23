import type { KvStore } from './store';
import type { TvApp } from './types';

/**
 * Which apps the Apps tab shows (owner-1022): the person picks the apps they want ("Choose apps")
 * and can switch to "Favourites only". Per TV, keyed by TV id. Pure TS, unit-tested in Node.
 *
 * - Hidden apps are only hidden in Couch: nothing changes on the TV, and they come back with
 *   "Show all apps". Favourites always show, even when their id is in the hidden list.
 * - Ids the TV no longer reports are harmless: they simply match nothing.
 */

export interface AppVisibility {
  /** App ids hidden from "All apps". */
  hidden: string[];
  /** Show only the Favourites section. */
  favouritesOnly: boolean;
}

export const DEFAULT_VISIBILITY: AppVisibility = Object.freeze({ hidden: [], favouritesOnly: false }) as AppVisibility;

/** Most hidden ids kept per TV (a TV lists a few hundred apps at most). */
export const HIDDEN_CAP = 500;

/** Accepts untrusted stored data. */
export function normaliseVisibility(raw: unknown): AppVisibility {
  if (!raw || typeof raw !== 'object') return { hidden: [], favouritesOnly: false };
  const r = raw as { hidden?: unknown; favouritesOnly?: unknown };
  const hidden: string[] = [];
  const seen = new Set<string>();
  if (Array.isArray(r.hidden)) {
    for (const v of r.hidden) {
      if (typeof v !== 'string' || v === '' || seen.has(v)) continue;
      seen.add(v);
      hidden.push(v);
      if (hidden.length >= HIDDEN_CAP) break;
    }
  }
  return { hidden, favouritesOnly: r.favouritesOnly === true };
}

export function isHidden(v: AppVisibility, id: string): boolean {
  return v.hidden.includes(id);
}

export function setHidden(v: AppVisibility, id: string, hide: boolean): AppVisibility {
  if (id === '') return v;
  const has = v.hidden.includes(id);
  if (hide === has) return v;
  return normaliseVisibility({ ...v, hidden: hide ? [...v.hidden, id] : v.hidden.filter((h) => h !== id) });
}

/** Hide every app in `ids` except those in `keep` (e.g. favourites). */
export function hideAllExcept(v: AppVisibility, ids: readonly string[], keep: readonly string[]): AppVisibility {
  const k = new Set(keep);
  return normaliseVisibility({ ...v, hidden: [...v.hidden, ...ids.filter((id) => !k.has(id))] });
}

export function showAll(v: AppVisibility): AppVisibility {
  return { ...v, hidden: [] };
}

export function setFavouritesOnly(v: AppVisibility, on: boolean): AppVisibility {
  return v.favouritesOnly === on ? v : { ...v, favouritesOnly: on };
}

/** Number of the TV's current apps that are hidden. */
export function hiddenCount(v: AppVisibility, apps: readonly TvApp[]): number {
  const h = new Set(v.hidden);
  return apps.filter((a) => h.has(a.id)).length;
}

/**
 * What the Apps tab shows: favourites always (in the user's order); other apps unless hidden, and
 * none at all in Favourites only. In edit mode everything shows so apps can still be added.
 */
export function visibleSections(
  sections: { favourites: readonly TvApp[]; others: readonly TvApp[] },
  v: AppVisibility,
  editing = false,
): { favourites: TvApp[]; others: TvApp[] } {
  const favourites = [...sections.favourites];
  if (editing) return { favourites, others: [...sections.others] };
  if (v.favouritesOnly) return { favourites, others: [] };
  const h = new Set(v.hidden);
  return { favourites, others: sections.others.filter((a) => !h.has(a.id)) };
}

export function sameVisibility(a: AppVisibility, b: AppVisibility): boolean {
  return a.favouritesOnly === b.favouritesOnly && a.hidden.length === b.hidden.length && a.hidden.every((x, i) => x === b.hidden[i]);
}

export const VISIBILITY_KEY = 'couch.appVisibility.v1';

/** Per-TV visibility in one JSON document over a KvStore (AsyncStorage in the app). */
export class VisibilityRepo {
  private doc: Record<string, AppVisibility> | null = null;
  private loading: Promise<Record<string, AppVisibility>> | null = null;

  constructor(private readonly kv: KvStore) {}

  peek(tvId: string): AppVisibility | undefined {
    if (!this.doc) return undefined;
    return this.doc[tvId] ?? { ...DEFAULT_VISIBILITY, hidden: [] };
  }

  async load(tvId: string): Promise<AppVisibility> {
    const doc = await this.readDoc();
    return doc[tvId] ?? { ...DEFAULT_VISIBILITY, hidden: [] };
  }

  async save(tvId: string, v: AppVisibility): Promise<void> {
    const doc = await this.readDoc();
    doc[tvId] = normaliseVisibility(v);
    try {
      await this.kv.setItem(VISIBILITY_KEY, JSON.stringify(doc));
    } catch {
      // best effort: memory still holds it for this run
    }
  }

  private readDoc(): Promise<Record<string, AppVisibility>> {
    if (this.doc) return Promise.resolve(this.doc);
    if (!this.loading) {
      this.loading = this.kv
        .getItem(VISIBILITY_KEY)
        .then((raw) => parseVisibilityDoc(raw))
        .catch(() => ({}))
        .then((d) => {
          // A save may have created the doc meanwhile; it wins.
          this.doc = this.doc ?? d;
          return this.doc;
        });
    }
    return this.loading;
  }
}

export function parseVisibilityDoc(raw: string | null): Record<string, AppVisibility> {
  if (!raw) return {};
  try {
    const j = JSON.parse(raw) as unknown;
    if (!j || typeof j !== 'object' || Array.isArray(j)) return {};
    const out: Record<string, AppVisibility> = {};
    for (const [k, v] of Object.entries(j as Record<string, unknown>)) {
      if (k !== '' && k !== '__proto__') out[k] = normaliseVisibility(v);
    }
    return out;
  } catch {
    return {};
  }
}
