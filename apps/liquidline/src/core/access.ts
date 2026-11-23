// Liquidline pricing (house pattern, as Satchel): a 7-day free trial the person starts, then a one-time Full Unlock.
// No subscription. Guideline 3.1.1: a time-based trial in a non-subscription app is a free non-consumable the person
// starts themselves (TRIAL_SKU); the unlock is a second non-consumable (UNLOCK_SKU). Both restore.
// The trial's start is the trial transaction's purchaseDate from StoreKit, so reinstalling never resets it.
//
// Always free, in every state: the PT chart and lookup, refrigerant facts and safety notes, the unit converter and
// viewing saved jobs. The trial or the unlock opens the calculators (superheat, subcooling, extra charge, load,
// line set, evacuation log) and saving new jobs. Pure TypeScript, tested in access.test.ts.

export const TRIAL_SKU = 'com.jared797.liquidline.trial7';
export const UNLOCK_SKU = 'com.jared797.liquidline.unlock';
export const ACCESS_SKUS: readonly string[] = Object.freeze([TRIAL_SKU, UNLOCK_SKU]);
export const TRIAL_DAYS = 7;
export const DAY_MS = 24 * 60 * 60 * 1000;
export const ACCESS_CACHE_KEY = 'liquidline.access.v1';

export function trialDaysLeft(startMs: number | null | undefined, nowMs: number): number {
  if (typeof startMs !== 'number' || !Number.isFinite(startMs) || !Number.isFinite(nowMs)) return 0;
  const since = Math.max(0, Math.floor((nowMs - startMs) / DAY_MS));
  return Math.min(TRIAL_DAYS, Math.max(0, TRIAL_DAYS - since));
}

/** 'stub': this binary has no StoreKit module (Expo Go, web preview); purchases can't run, so nothing is limited. */
export type Availability = 'stub' | 'store';
export type Entitlements = { unlocked: boolean; trialStart: number | null };
export type AccessState = 'stub' | 'unlocked' | 'trial' | 'expired' | 'new';
export type Access = { state: AccessState; daysLeft: number; canCalc: boolean };

export function fromTransactions(list: unknown): Entitlements {
  const out: Entitlements = { unlocked: false, trialStart: null };
  if (!Array.isArray(list)) return out;
  for (const x of list) {
    if (!x || typeof x !== 'object') continue;
    const r = x as { productId?: unknown; purchaseDate?: unknown; revoked?: unknown };
    if (r.revoked === true) continue;
    if (r.productId === UNLOCK_SKU) out.unlocked = true;
    if (r.productId === TRIAL_SKU && typeof r.purchaseDate === 'number' && Number.isFinite(r.purchaseDate)) {
      out.trialStart = out.trialStart == null ? r.purchaseDate : Math.min(out.trialStart, r.purchaseDate);
    }
  }
  return out;
}

export function accessOf(availability: Availability, e: Entitlements, nowMs: number): Access {
  if (availability === 'stub') return { state: 'stub', daysLeft: 0, canCalc: true };
  if (e.unlocked) return { state: 'unlocked', daysLeft: 0, canCalc: true };
  if (e.trialStart == null) return { state: 'new', daysLeft: TRIAL_DAYS, canCalc: false };
  const daysLeft = trialDaysLeft(e.trialStart, nowMs);
  return daysLeft > 0 ? { state: 'trial', daysLeft, canCalc: true } : { state: 'expired', daysLeft: 0, canCalc: false };
}

/** Free in every state. */
export const ALWAYS_FREE = Object.freeze(['pt', 'refrigerants', 'convert', 'viewJobs', 'settings'] as const);

export type AccessCache = Entitlements & { checkedAt: number };

export function parseAccessCache(raw: string | null | undefined): AccessCache | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<AccessCache> | null;
    if (!v || typeof v !== 'object' || typeof v.unlocked !== 'boolean') return null;
    const trialStart = typeof v.trialStart === 'number' && Number.isFinite(v.trialStart) ? v.trialStart : null;
    return { unlocked: v.unlocked, trialStart, checkedAt: typeof v.checkedAt === 'number' ? v.checkedAt : 0 };
  } catch {
    return null;
  }
}

export function mergeEntitlements(store: Entitlements | null, cache: AccessCache | null): Entitlements {
  if (store) return store;
  return cache ? { unlocked: cache.unlocked, trialStart: cache.trialStart } : { unlocked: false, trialStart: null };
}

export function unlockButton(displayPrice: string | null | undefined): { enabled: boolean; price: string | null } {
  const price = typeof displayPrice === 'string' && displayPrice.trim() ? displayPrice.trim() : null;
  return { enabled: !!price, price };
}
