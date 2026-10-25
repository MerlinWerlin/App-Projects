// Typed wrapper for the GlazeStore native module (iOS native builds only, T152).
// App code must NOT import this file: go through src/native/store.ts, which reports
// "unavailable" in Expo Go, on Android and in builds without the module, and never throws.
import { requireOptionalNativeModule } from 'expo';

export type GlazeStoreProduct = { id: string; displayPrice: string; displayName: string };

export type GlazeStorePurchase = {
  status: 'purchased' | 'cancelled' | 'pending' | 'failed';
  code?: string;
  message?: string;
};

export type GlazeStoreNative = {
  isAvailable(): Promise<boolean>;
  /** The App Store product, or null when App Store Connect doesn't return it. */
  getProduct(id: string): Promise<GlazeStoreProduct | null>;
  /** Shows Apple's purchase sheet. Always resolves with a status (rejects only on a bridge error). */
  purchase(id: string): Promise<GlazeStorePurchase>;
  /** True when Transaction.currentEntitlements holds a verified, unrevoked transaction for id. */
  isOwned(id: string): Promise<boolean>;
  /** AppStore.sync() then isOwned. Rejects when the sync fails and nothing is owned. */
  restore(id: string): Promise<boolean>;
  /** Event "onEntitlementChange" { productId, owned } from the Transaction.updates listener. */
  addListener?(event: 'onEntitlementChange', cb: (e: { productId?: string; owned?: boolean }) => void): { remove(): void };
};

/** The native module, or null where it isn't built in. */
export default requireOptionalNativeModule<GlazeStoreNative>('GlazeStore');
