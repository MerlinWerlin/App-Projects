/**
 * App-wide Couch Plus access state (owner decision 7 Nov 2026). Pure TypeScript with injected storage and store, so
 * Node tests cover it; src/plus/usePlus.ts creates the one instance with AsyncStorage and expo-iap.
 *
 * Holds the install kind (grandfathering, src/plus/grandfather.ts), the Plus purchase, the trial start and the store
 * price, and answers `access()` synchronously for the control gate (src/plus/gate.tsx). Every change notifies
 * subscribers (useSyncExternalStore), so the remote unlocks the moment a purchase or trial goes through.
 */
import { LOADING_ACCESS, TRIAL_KEY, accessFor, parseTrialStart, type Access } from './access';
import { NOT_OWNED, type PlusState, type PlusStorage, type PlusStore } from './entitlement';
import { appTransactionGrandfathered, markLegacy, resolveInstallKind, type InstallKind } from './grandfather';
import type { IapStore, TrialResult } from './iapStore';

export interface AccessSnapshot {
  /** Null until the install kind and trial start have been read. */
  install: InstallKind | null;
  plus: PlusState;
  /** undefined: not read yet; null: the trial has not started. */
  trialStart: number | null | undefined;
  /** Localised store price when the store has answered. */
  price: string | null;
  /** A purchase, restore or trial request is in flight. */
  busy: boolean;
  /** A real store (or, in development only, the mock store) is there to buy from. */
  canBuy: boolean;
}

export type BuyStatus = 'owned' | 'notOwned' | 'unavailable' | 'failed';

export interface AccessStoreDeps {
  storage: PlusStorage;
  /** The expo-iap adapter; null in Expo Go or when the module is missing. */
  iap: IapStore | null;
  /** Fallback store when iap is null (the mock store in development, none in a store build). */
  fallback: PlusStore | null;
  now?: () => number;
}

export class AccessStore {
  private snap: AccessSnapshot;
  private readonly listeners = new Set<() => void>();
  private started: Promise<void> | null = null;
  private readonly now: () => number;

  constructor(private readonly deps: AccessStoreDeps) {
    this.now = deps.now ?? (() => Date.now());
    this.snap = {
      install: null,
      plus: { ...NOT_OWNED },
      trialStart: undefined,
      price: null,
      busy: false,
      canBuy: deps.iap !== null || deps.fallback !== null,
    };
  }

  private get store(): PlusStore | null {
    return this.deps.iap ?? this.deps.fallback;
  }

  subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  getSnapshot(): AccessSnapshot {
    return this.snap;
  }

  private set(patch: Partial<AccessSnapshot>): void {
    this.snap = { ...this.snap, ...patch };
    for (const l of this.listeners) l();
  }

  /**
   * Reads everything once (idempotent). The install kind is decided first, before any other screen writes storage.
   * The App Store checks (price, AppTransaction) run after and never block access.
   */
  start(): Promise<void> {
    if (!this.started) {
      this.started = (async () => {
        const install = await resolveInstallKind({
          getItem: (k) => this.deps.storage.get(k),
          setItem: (k, v) => this.deps.storage.set(k, v),
        });
        let trialStart: number | null = null;
        try {
          const now = this.now();
          const parsed = parseTrialStart(await this.deps.storage.get(TRIAL_KEY), now);
          trialStart = parsed.start;
          if (parsed.fixed && parsed.start !== null) await this.deps.storage.set(TRIAL_KEY, String(parsed.start)).catch(() => {});
        } catch {
          trialStart = null;
        }
        let plus: PlusState = { ...NOT_OWNED };
        try {
          plus = (await this.store?.getState()) ?? { ...NOT_OWNED };
        } catch {
          plus = { ...NOT_OWNED };
        }
        this.set({ install, trialStart, plus });
        void this.checkStore();
      })();
    }
    return this.started;
  }

  private async checkStore(): Promise<void> {
    const iap = this.deps.iap;
    if (!iap) return;
    try {
      const price = await iap.price();
      if (price) this.set({ price });
    } catch {
      // the fallback price is shown
    }
    if (this.snap.install === 'legacy') return;
    try {
      if (appTransactionGrandfathered(await iap.appTransaction())) {
        await markLegacy({ getItem: (k) => this.deps.storage.get(k), setItem: (k, v) => this.deps.storage.set(k, v) });
        this.set({ install: 'legacy' });
      }
    } catch {
      // optional check
    }
  }

  /** Access right now. While loading: allowed (see src/plus/access.ts). */
  access(now: number = this.now()): Access {
    const s = this.snap;
    if (s.install === 'legacy') return accessFor({ owned: false, grandfathered: true, trialStart: null, now });
    if (s.plus.owned) return accessFor({ owned: true, grandfathered: false, trialStart: null, now });
    if (s.install === null || s.trialStart === undefined) return LOADING_ACCESS;
    return accessFor({ owned: false, grandfathered: false, trialStart: s.trialStart, now });
  }

  private async run(op: (store: PlusStore) => Promise<PlusState>): Promise<BuyStatus> {
    const store = this.store;
    if (!store) return 'unavailable';
    if (this.snap.busy) return 'failed';
    this.set({ busy: true });
    try {
      const next = await op(store);
      this.set({ plus: next, busy: false });
      return next.owned ? 'owned' : 'notOwned';
    } catch {
      this.set({ busy: false });
      return 'failed';
    }
  }

  purchase(): Promise<BuyStatus> {
    return this.run((s) => s.purchase());
  }

  /** Restore also brings back the trial's original start (iapStore saves it to TRIAL_KEY). */
  async restore(): Promise<BuyStatus> {
    const r = await this.run((s) => s.restore());
    await this.reloadTrial();
    return r;
  }

  async startTrial(): Promise<TrialResult> {
    const iap = this.deps.iap;
    if (!iap) return { status: 'unavailable', start: null };
    if (this.snap.busy) return { status: 'failed', start: null };
    this.set({ busy: true });
    try {
      const r = await iap.startTrial();
      this.set({ busy: false, ...(r.start !== null ? { trialStart: r.start } : {}) });
      return r;
    } catch {
      this.set({ busy: false });
      return { status: 'failed', start: null };
    }
  }

  private async reloadTrial(): Promise<void> {
    try {
      const { start } = parseTrialStart(await this.deps.storage.get(TRIAL_KEY), this.now());
      if (start !== null && start !== this.snap.trialStart) this.set({ trialStart: start });
    } catch {
      // keep what we have
    }
  }
}
