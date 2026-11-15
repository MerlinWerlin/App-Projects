// T152: shapes shared by the StoreKit 2 module (modules/glaze-store, Swift), its adapter
// (src/native/store.ts) and the Plus store (src/plus/iapStore.ts). Pure TS, unit-tested: it only
// normalises whatever the native module returns, so a surprise value never crashes the sheet.
// The product id is PLUS_SKU in ./iapFlow.ts (one place; Swift receives it from JS).

export { PLUS_SKU } from './iapFlow.ts';
import { PLUS_SKU as LEGACY_SKU } from './iapFlow.ts';

/**
 * Glaze 1.0.41 (owner 2026-11-15: "$3 a year ... no free trial, the 10 free ones are the free trial"):
 * Glaze Plus is a yearly auto-renewable subscription (subscription group "Glaze", no introductory
 * offer; store/SUBSCRIPTION.md). The old one-time unlock was only ever available in sandbox /
 * TestFlight and is still honoured if someone owns it.
 */
export const YEARLY_SKU = 'com.jared797.glaze.yearly';
export const LEGACY_UNLOCK_SKU = LEGACY_SKU;
/** Every product id that unlocks Glaze Plus; the first one is the one sold. */
export const ENTITLEMENT_SKUS: readonly string[] = Object.freeze([YEARLY_SKU, LEGACY_UNLOCK_SKU]);
/** How long a cached "subscribed" answer is trusted while StoreKit can't be asked at all. */
export const OFFLINE_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

/** Any product owned: true; all unknown: null (StoreKit couldn't be asked); else false. */
export function combineOwned(answers: readonly (boolean | null)[]): boolean | null {
  if (answers.some((a) => a === true)) return true;
  if (answers.length && answers.every((a) => a === null)) return null;
  return false;
}

export type PlusCache = { plus: boolean; checkedAt: number };

/** The cached answer (older copies have no checkedAt: treated as checked long ago). */
export function parsePlusCache(raw: string | null): PlusCache | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as { plus?: unknown; checkedAt?: unknown };
    if (!v || typeof v !== 'object' || typeof v.plus !== 'boolean') return null;
    return { plus: v.plus, checkedAt: typeof v.checkedAt === 'number' && Number.isFinite(v.checkedAt) ? v.checkedAt : 0 };
  } catch {
    return null;
  }
}

/**
 * StoreKit's answer always wins (it already knows an expired or refunded subscription, offline too).
 * Only when StoreKit can't be asked at all does a cached "subscribed" count, and only for
 * OFFLINE_GRACE_MS after it was last confirmed.
 */
export function resolveSubscribed(storeSays: boolean | null, cache: PlusCache | null, now: number, graceMs: number = OFFLINE_GRACE_MS): boolean {
  if (storeSays !== null) return storeSays;
  return !!cache && cache.plus && now - cache.checkedAt <= graceMs;
}

/** Native module name (modules/glaze-store, expo-module.config.json / Name("GlazeStore")). */
export const STORE_MODULE = 'GlazeStore';
/** Event the Transaction.updates listener sends. */
export const STORE_EVENT = 'onEntitlementChange';

export type StoreProduct = { id: string; displayPrice: string; displayName: string };

export type StorePurchase =
  | { status: 'purchased' }
  | { status: 'cancelled' }
  | { status: 'pending' }
  | { status: 'failed'; code: string; message?: string };

export type StoreRestore = { ok: true; owned: boolean } | { ok: false; code: string };

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

/** {id, displayPrice, displayName} or null (missing product, wrong id, junk). */
export function parseProduct(v: unknown, id: string): StoreProduct | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const displayPrice = str(o.displayPrice);
  if (str(o.id) !== id || !displayPrice) return null;
  return { id, displayPrice, displayName: str(o.displayName) ?? '' };
}

/** Store code kept short and printable for the "nothing was charged" line. */
export function shortCode(v: unknown): string {
  const s = str(v);
  if (!s) return 'unknown';
  return s.replace(/[^\w.:-]+/g, '-').slice(0, 40) || 'unknown';
}

export function parsePurchase(v: unknown): StorePurchase {
  if (!v || typeof v !== 'object') return { status: 'failed', code: 'bad-result' };
  const o = v as Record<string, unknown>;
  switch (o.status) {
    case 'purchased':
    case 'cancelled':
    case 'pending':
      return { status: o.status };
    case 'failed':
      return { status: 'failed', code: shortCode(o.code), message: str(o.message) };
    default:
      return { status: 'failed', code: 'bad-result' };
  }
}

/** The App Store's localised price when loaded, else the owner's price (A$2.99). */
export function priceText(product: StoreProduct | null, fallback: string): string {
  return product?.displayPrice ?? fallback;
}

/** Event body from the Transaction.updates listener, only when it is about `id`. */
export function parseEntitlementEvent(v: unknown, id: string): boolean | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (o.productId !== id || typeof o.owned !== 'boolean') return null;
  return o.owned;
}

/** The part of src/native/store.ts the purchase flow needs (mocked in tests). */
export type StoreKitLike = {
  purchase(id: string): Promise<StorePurchase>;
  isOwned(id: string): Promise<boolean | null>;
};

/**
 * Buy once. A 'failed' result is re-checked against the entitlements, so a purchase the person
 * already owns (or one StoreKit finished despite an error) still unlocks.
 */
export async function buyPlus(store: StoreKitLike, id: string): Promise<StorePurchase> {
  let r: StorePurchase;
  try {
    r = await store.purchase(id);
  } catch (e) {
    r = { status: 'failed', code: errorCodeOf(e, 'native-error') };
  }
  if (r.status !== 'failed') return r;
  try {
    if ((await store.isOwned(id)) === true) return { status: 'purchased' };
  } catch {
    // keep the original failure
  }
  return r;
}

/** StoreKit's answer wins; the on-device cache only fills in when StoreKit can't be asked. */
export function resolveOwned(storeSays: boolean | null, cachedPlus: boolean): boolean {
  return storeSays === null ? cachedPlus : storeSays;
}

export function errorCodeOf(e: unknown, fallback: string): string {
  if (e && typeof e === 'object') {
    const c = (e as { code?: unknown }).code;
    if (typeof c === 'string' && c) return shortCode(c);
  }
  return fallback;
}
