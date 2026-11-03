/** User-started Android trial; no free purchase SKU or automatic charge. */
import type { KvStore } from '../core/library';
import { t } from '../i18n';
import { ENTITLEMENT_KEY, parseEntitlement } from './entitlement';
import type { PurchaseProvider, PurchaseResult, StoreAccess } from './purchases';
import { parseStamp, TRIAL_KEY } from './trial';

export function createAndroidPurchaseProvider(
  store: PurchaseProvider, kv: KvStore, secure: KvStore | null, now: () => number = Date.now,
): PurchaseProvider {
  const stores = secure ? [kv, secure] : [kv];
  let pending: Promise<PurchaseResult> | null = null;
  const read = async (): Promise<number | null> => {
    const raw = await Promise.all(stores.map(s => s.getItem(TRIAL_KEY)));
    const stamps = raw.map(value => {
      if (value == null || value.trim() === '') return null;
      const stamp = parseStamp(value);
      if (stamp === null) throw new Error('Invalid trial stamp');
      return stamp;
    }).filter((value): value is number => value !== null);
    return stamps.length ? Math.min(...stamps) : null;
  };
  const merge = async (access: StoreAccess): Promise<StoreAccess> => {
    const local = await read();
    const stamps = [local, access.trialStart].filter((value): value is number => value !== null);
    return { plus: access.plus, trialStart: stamps.length ? Math.min(...stamps) : null };
  };
  const transact = async (kind: 'buy' | 'restore'): Promise<PurchaseResult> => {
    const result = await store[kind]();
    return result.ok ? { ok: true, access: await merge(result.access) } : result;
  };
  return {
    price: () => store.price(),
    buy: () => transact('buy'),
    restore: () => transact('restore'),
    async refresh() {
      const access = await store.refresh();
      if (!access) return null;
      try { return await merge(access); } catch { return null; }
    },
    startTrial() {
      if (pending) return pending;
      pending = (async (): Promise<PurchaseResult> => {
        try {
          const existing = await read();
          const start = existing ?? parseStamp(String(now()));
          if (start === null) throw new Error('Invalid clock');
          if (existing === null) {
            await Promise.allSettled(stores.map(s => s.setItem(TRIAL_KEY, String(start))));
            if (await read() !== start) throw new Error('Trial was not saved');
          }
          const cached = parseEntitlement(await kv.getItem(ENTITLEMENT_KEY));
          return { ok: true, access: { plus: cached.tier === 'plus', trialStart: start } };
        } catch {
          return { ok: false, reason: 'failed', message: t('plus.failed', { code: 'E_TRIAL_STORAGE' }) };
        }
      })().finally(() => { pending = null; });
      return pending;
    },
  };
}
