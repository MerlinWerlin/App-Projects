// The only door to the TrammelStore native module (modules/trammel-store, StoreKit 2). Never throws: every call
// resolves with a plain answer. Where the module isn't built in (Expo Go, Android) kind is 'stub' and nothing is
// limited (src/core/access.ts).
import Native from '../../modules/trammel-store/index.ts';
import { ACCESS_SKUS, fromTransactions, type Entitlements } from '../core/access.ts';

export type StoreProduct = { id: string; displayPrice: string; displayName: string };
export type PurchaseResult = { status: 'purchased' | 'cancelled' | 'pending' | 'failed'; code?: string };

// Simulator store screenshots only: .github/workflows/trammel-store-capture.yml sets this at bundle time for its
// second build, because a simulator has no App Store products to start the trial with. No EAS profile sets it
// (src/core/access.test.ts checks), so store and TestFlight builds always use StoreKit.
export const CAPTURE = process.env.EXPO_PUBLIC_TRAMMEL_CAPTURE === '1';
export const storeKind: 'stub' | 'store' = Native && !CAPTURE ? 'store' : 'stub';

/** Products App Store Connect returns, by id ({} offline, or when they aren't set up yet). */
export async function loadProducts(): Promise<Record<string, StoreProduct>> {
  if (!Native) return {};
  try {
    const list = await Native.getProducts([...ACCESS_SKUS]);
    const out: Record<string, StoreProduct> = {};
    for (const p of Array.isArray(list) ? list : []) {
      if (p && typeof p.id === 'string' && typeof p.displayPrice === 'string') out[p.id] = { id: p.id, displayPrice: p.displayPrice, displayName: String(p.displayName ?? '') };
    }
    return out;
  } catch {
    return {};
  }
}

/** StoreKit's entitlements, or null when StoreKit couldn't be asked. */
export async function readEntitlements(): Promise<Entitlements | null> {
  if (!Native) return null;
  try {
    return fromTransactions(await Native.entitlements([...ACCESS_SKUS]));
  } catch {
    return null;
  }
}

export async function purchase(id: string): Promise<PurchaseResult> {
  if (!Native) return { status: 'failed', code: 'unavailable' };
  try {
    const r = await Native.purchase(id);
    const status = r && ['purchased', 'cancelled', 'pending', 'failed'].includes(r.status) ? r.status : 'failed';
    return { status, code: r?.code };
  } catch (e) {
    return { status: 'failed', code: String((e as { code?: unknown } | null)?.code ?? 'bridge') };
  }
}

/** Restore purchases. null when the App Store couldn't be reached and nothing was found. */
export async function restore(): Promise<Entitlements | null> {
  if (!Native) return null;
  try {
    return fromTransactions(await Native.restore([...ACCESS_SKUS]));
  } catch {
    return null;
  }
}

/** Calls back when a transaction lands outside a purchase (Ask to Buy approved, a refund). */
export function onEntitlementChange(cb: () => void): () => void {
  try {
    const sub = Native?.addListener?.('onEntitlementChange', () => cb());
    return () => sub?.remove();
  } catch {
    return () => {};
  }
}
