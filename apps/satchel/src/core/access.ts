// Satchel 1.0.0 pricing (Jared, 15 Nov 2026): a 7-day free trial, then a one-time unlock. No subscription.
// Guideline 3.1.1: a time-based trial on a non-subscription app is a A$0 non-consumable the person starts
// themselves (TRIAL_SKU); the unlock is a second non-consumable (UNLOCK_SKU). Both restore.
// The trial's start is the trial transaction's purchaseDate from StoreKit, so reinstalling never resets it.
//
// After the trial, without the unlock, Satchel is read-only, never locked: every trip, itinerary, ticket and
// document stays viewable, and a received .satchel trip file always opens (the friend whose phone died can still
// see the trip). Creating or editing trips and plans, and sharing out, need the unlock.
// Pure TypeScript (no React Native), unit-tested in access.test.ts. App code: src/state/access.ts.

export const TRIAL_SKU = 'com.jared797.satchel.trial7';
export const UNLOCK_SKU = 'com.jared797.satchel.unlock';
export const ACCESS_SKUS: readonly string[] = Object.freeze([TRIAL_SKU, UNLOCK_SKU]);
export const TRIAL_DAYS = 7;
export const DAY_MS = 24 * 60 * 60 * 1000;
/** This phone's last known answer, so the app opens in the right state before StoreKit replies. */
export const ACCESS_CACHE_KEY = 'satchel.access.v1';

/** Days of trial left: 7 minus the whole days since it started, never below 0 or above 7. */
export function trialDaysLeft(startMs: number | null | undefined, nowMs: number): number {
  if (typeof startMs !== 'number' || !Number.isFinite(startMs) || !Number.isFinite(nowMs)) return 0;
  const since = Math.max(0, Math.floor((nowMs - startMs) / DAY_MS));
  return Math.min(TRIAL_DAYS, Math.max(0, TRIAL_DAYS - since));
}

/** 'stub': this binary has no StoreKit module (Expo Go, Android); purchases can't run, so nothing is limited. */
export type Availability = 'stub' | 'store';
export type Entitlements = { unlocked: boolean; trialStart: number | null };
export type AccessState = 'stub' | 'unlocked' | 'trial' | 'expired' | 'new';
export type Access = { state: AccessState; daysLeft: number; canEdit: boolean; canShare: boolean };

/** Reads StoreKit's verified transactions (any shape) into what Satchel needs. Revoked (refunded) ones never count. */
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

/** Where this person stands now. */
export function accessOf(availability: Availability, e: Entitlements, nowMs: number): Access {
  if (availability === 'stub') return { state: 'stub', daysLeft: 0, canEdit: true, canShare: true };
  if (e.unlocked) return { state: 'unlocked', daysLeft: 0, canEdit: true, canShare: true };
  if (e.trialStart == null) return { state: 'new', daysLeft: TRIAL_DAYS, canEdit: false, canShare: false };
  const daysLeft = trialDaysLeft(e.trialStart, nowMs);
  return daysLeft > 0 ? { state: 'trial', daysLeft, canEdit: true, canShare: true } : { state: 'expired', daysLeft: 0, canEdit: false, canShare: false };
}

/** What is always allowed, whatever the state: viewing, and opening a trip file someone sent. */
export const ALWAYS_ALLOWED = Object.freeze({ view: true, openReceivedTrip: true, backup: true });

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

/**
 * StoreKit's answer wins when it gave one. When StoreKit couldn't be asked (null), the cached answer stands:
 * a one-time unlock never expires, and a trial's start date never changes.
 */
export function mergeEntitlements(store: Entitlements | null, cache: AccessCache | null): Entitlements {
  if (store) return store;
  return cache ? { unlocked: cache.unlocked, trialStart: cache.trialStart } : { unlocked: false, trialStart: null };
}

/** The paywall's unlock button: StoreKit's localized price only; no product, no price and no purchase. */
export function unlockButton(displayPrice: string | null | undefined): { enabled: boolean; price: string | null } {
  const price = typeof displayPrice === 'string' && displayPrice.trim() ? displayPrice.trim() : null;
  return { enabled: !!price, price };
}
