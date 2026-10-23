/**
 * Couch Plus entitlement (PLAN section 5). Pure TypeScript, persisted through the injected KvStore.
 *
 * HARD RULE: every TV control is free forever. Plus may only gate the extras listed in PLUS_FEATURES
 * (widgets, Watch/Wear, Live Activity, Lock Screen / Control Center controls, themes, macros).
 * Only src/plus/ may read the entitlement; tests/plus-guard.test.ts enforces that no control path
 * (src/core, src/ui/remote, app/(tabs), src/state/session.tsx) imports this folder.
 */
import { MemoryKv, type KvStore } from '../core/store';
import { t } from '../i18n/core';
import { withCopy } from '../i18n/lazyCopy';

export type Tier = 'free' | 'plus';

/** The only things Couch Plus can ever unlock. TV controls are deliberately absent. */
export const PLUS_FEATURES = ['widgets', 'watch', 'liveActivity', 'controls', 'themes', 'macros'] as const;
export type PlusFeature = (typeof PLUS_FEATURES)[number];

export function isPlusFeature(v: unknown): v is PlusFeature {
  return typeof v === 'string' && (PLUS_FEATURES as readonly string[]).includes(v);
}

/** What each Plus feature adds, for the Couch Plus screen. Translated on read (t() getters). */
export const PLUS_FEATURE_COPY: Record<PlusFeature, { title: string; hint: string }> = {
  widgets: withCopy({ title: '', hint: '' }, { title: 'core.plus.feature.widgets.title', hint: 'core.plus.feature.widgets.hint' }),
  watch: withCopy({ title: '', hint: '' }, { title: 'core.plus.feature.watch.title', hint: 'core.plus.feature.watch.hint' }),
  liveActivity: withCopy({ title: '', hint: '' }, { title: 'core.plus.feature.liveActivity.title', hint: 'core.plus.feature.liveActivity.hint' }),
  controls: withCopy({ title: '', hint: '' }, { title: 'core.plus.feature.controls.title', hint: 'core.plus.feature.controls.hint' }),
  themes: withCopy({ title: '', hint: '' }, { title: 'core.plus.feature.themes.title', hint: 'core.plus.feature.themes.hint' }),
  macros: withCopy({ title: '', hint: '' }, { title: 'core.plus.feature.macros.title', hint: 'core.plus.feature.macros.hint' }),
};

/** The free-forever promise at the top of the Couch Plus screen, in the active language. */
export function plusPromise(): string {
  return t('core.plus.promise');
}

export const ENTITLEMENT_KEY = 'couch.entitlement';
export const ENTITLEMENT_VERSION = 1;

export type EntitlementSource = 'none' | 'purchase' | 'restore';

export interface EntitlementDoc {
  version: typeof ENTITLEMENT_VERSION;
  tier: Tier;
  source: EntitlementSource;
  updatedAt: number;
}

export function freeDoc(): EntitlementDoc {
  return { version: ENTITLEMENT_VERSION, tier: 'free', source: 'none', updatedAt: 0 };
}

/** Parses a stored entitlement. Anything missing, corrupt or unknown is 'free' (never throws). */
export function parseEntitlement(raw: string | null): EntitlementDoc {
  if (raw === null) return freeDoc();
  let j: unknown;
  try {
    j = JSON.parse(raw);
  } catch {
    return freeDoc();
  }
  if (typeof j !== 'object' || j === null || Array.isArray(j)) return freeDoc();
  const o = j as Record<string, unknown>;
  if (o['version'] !== ENTITLEMENT_VERSION || o['tier'] !== 'plus') return freeDoc();
  const source = o['source'] === 'purchase' || o['source'] === 'restore' ? o['source'] : 'purchase';
  const updatedAt = typeof o['updatedAt'] === 'number' ? o['updatedAt'] : 0;
  return { version: ENTITLEMENT_VERSION, tier: 'plus', source, updatedAt };
}

/** Pure check: may this tier use this Plus feature? */
export function tierCanUse(tier: Tier, feature: PlusFeature): boolean {
  return isPlusFeature(feature) && tier === 'plus';
}

export interface EntitlementSnapshot {
  tier: Tier;
  loaded: boolean;
}

/** Entitlement state over a KvStore, with a subscribe/getSnapshot pair for useSyncExternalStore. */
export class EntitlementStore {
  private doc: EntitlementDoc = freeDoc();
  private snap: EntitlementSnapshot = { tier: 'free', loaded: false };
  private loading: Promise<void> | null = null;
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly kv: KvStore = new MemoryKv(),
    private readonly now: () => number = () => Date.now(),
    private readonly key: string = ENTITLEMENT_KEY,
  ) {}

  load(): Promise<void> {
    if (!this.loading) {
      this.loading = this.kv
        .getItem(this.key)
        .then((raw) => parseEntitlement(raw))
        .catch(() => freeDoc())
        .then((doc) => {
          this.doc = doc;
          this.emit(true);
        });
    }
    return this.loading;
  }

  tier(): Tier {
    return this.doc.tier;
  }

  canUse(feature: PlusFeature): boolean {
    return tierCanUse(this.doc.tier, feature);
  }

  /** Records a verified purchase or restore. Only called by applyPurchase with a provider's success. */
  async grant(source: Exclude<EntitlementSource, 'none'>): Promise<void> {
    await this.load();
    this.doc = { version: ENTITLEMENT_VERSION, tier: 'plus', source, updatedAt: this.now() };
    await this.kv.setItem(this.key, JSON.stringify(this.doc));
    this.emit(true);
  }

  /** Back to free (refund, tests). Controls are unaffected either way. */
  async revoke(): Promise<void> {
    await this.load();
    this.doc = { ...freeDoc(), updatedAt: this.now() };
    await this.kv.setItem(this.key, JSON.stringify(this.doc));
    this.emit(true);
  }

  subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  getSnapshot(): EntitlementSnapshot {
    return this.snap;
  }

  private emit(loaded: boolean): void {
    this.snap = { tier: this.doc.tier, loaded };
    for (const l of this.listeners) l();
  }
}
