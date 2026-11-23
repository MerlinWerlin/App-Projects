// Typed wrapper for the LiquidlineStore native module (iOS builds only, 1.0.0). App code must NOT import this file:
// go through src/native/store.ts, which reports "stub" in Expo Go, on Android and in builds without the module,
// and never throws.
import { requireOptionalNativeModule } from 'expo';

export type LiquidlineStoreProduct = { id: string; displayPrice: string; displayName: string };
export type LiquidlineStorePurchase = { status: 'purchased' | 'cancelled' | 'pending' | 'failed'; code?: string; message?: string };
/** One verified transaction the person owns: product id, purchase time (ms since 1970) and whether it was revoked. */
export type LiquidlineStoreEntitlement = { productId: string; purchaseDate: number; revoked: boolean };

export type LiquidlineStoreNative = {
  isAvailable(): Promise<boolean>;
  /** The products App Store Connect returns (missing ids are left out). */
  getProducts(ids: string[]): Promise<LiquidlineStoreProduct[]>;
  /** Shows Apple's purchase sheet. Always resolves with a status. */
  purchase(id: string): Promise<LiquidlineStorePurchase>;
  /** Verified transactions for these ids: Transaction.currentEntitlements, then Transaction.all for any id not found. */
  entitlements(ids: string[]): Promise<LiquidlineStoreEntitlement[]>;
  /** AppStore.sync() then entitlements(ids). Rejects only when the sync fails and nothing is owned. */
  restore(ids: string[]): Promise<LiquidlineStoreEntitlement[]>;
  addListener?(event: 'onEntitlementChange', cb: (e: { productId?: string }) => void): { remove(): void };
};

export default requireOptionalNativeModule<LiquidlineStoreNative>('LiquidlineStore');
