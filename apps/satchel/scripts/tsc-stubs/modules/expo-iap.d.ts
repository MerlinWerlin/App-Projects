// expo-iap 6.2.0 (T16 Satchel Plus): the members src/plus/store.ts calls. src/plus/store.ts lazy-requires the
// module and treats it loosely (older and newer API shapes), so this stub documents the API rather than gating it.
declare module 'expo-iap' {
  export type ProductType = 'in-app' | 'subs';
  export interface Product { id: string; displayPrice: string; title?: string; description?: string; type?: string }
  export interface Purchase { id: string; productId: string; transactionId?: string; purchaseToken?: string | null; [k: string]: unknown }
  export interface PurchaseError { code: string; message: string; productId?: string }
  export interface EventSubscription { remove(): void }
  export interface RequestPurchaseProps {
    request: {
      ios?: { sku: string; andDangerouslyFinishTransactionAutomatically?: boolean };
      apple?: { sku: string; andDangerouslyFinishTransactionAutomatically?: boolean };
      android?: { skus: string[] };
      google?: { skus: string[] };
    };
    type?: ProductType;
  }
  export function initConnection(): Promise<boolean>;
  export function endConnection(): Promise<boolean>;
  export function fetchProducts(params: { skus: string[]; type?: ProductType | 'all' }): Promise<Product[] | null>;
  export function requestPurchase(props: RequestPurchaseProps): Promise<Purchase | Purchase[] | null | void>;
  export function finishTransaction(params: { purchase: Purchase; isConsumable?: boolean }): Promise<unknown>;
  export function getAvailablePurchases(options?: Record<string, unknown>): Promise<Purchase[]>;
  export function restorePurchases(): Promise<void>;
  export function purchaseUpdatedListener(listener: (purchase: Purchase) => void): EventSubscription;
  export function purchaseErrorListener(listener: (error: PurchaseError) => void): EventSubscription;
}
