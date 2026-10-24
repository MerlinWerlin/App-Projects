/**
 * Purchase seam (same pattern as Couch/Linework). This build ships the stub: it never charges and
 * reports that purchases are not available yet, with a real message (no silent failure).
 * The StoreKit/Play Billing provider goes in with the first TestFlight build.
 */
export type PurchaseResult = { ok: true } | { ok: false; reason: 'unavailable' | 'cancelled' | 'failed'; message: string };

export interface PurchaseProvider {
  readonly available: boolean;
  price(): Promise<string | null>;
  buy(): Promise<PurchaseResult>;
  restore(): Promise<PurchaseResult>;
}

export class StubPurchaseProvider implements PurchaseProvider {
  readonly available = false;
  constructor(private readonly unavailableMessage: () => string) {}
  async price() {
    return null;
  }
  async buy(): Promise<PurchaseResult> {
    return { ok: false, reason: 'unavailable', message: this.unavailableMessage() };
  }
  async restore(): Promise<PurchaseResult> {
    return { ok: false, reason: 'unavailable', message: this.unavailableMessage() };
  }
}
