/**
 * Purchase seam for Couch Plus and the tip jar. This build ships only StubPurchaseProvider: it never
 * charges, never talks to a store and always reports that purchases are unavailable. A real provider
 * (StoreKit 2 / Play Billing, or RevenueCat) is an owner decision; no store package is installed.
 */
import { t } from '../i18n/core';
import type { EntitlementStore } from './entitlement';

export const UNAVAILABLE_REASON = 'not available in this build';
/** Shown when no store is wired up, in the active language. */
export function unavailableMessage(): string {
  return t('core.plus.unavailable');
}

export type PurchaseResult =
  | { ok: true; kind: 'plus' | 'tip' }
  | { ok: false; reason: string; message: string };

export interface PurchaseProvider {
  /** False when no store is wired up (the stub). */
  readonly available: boolean;
  /** Localised price for Couch Plus, or null when unknown. */
  plusPrice(): Promise<string | null>;
  buyPlus(): Promise<PurchaseResult>;
  restore(): Promise<PurchaseResult>;
  tip(tierId: string): Promise<PurchaseResult>;
}

/** Never charges. Every call resolves to "not available in this build". */
export class StubPurchaseProvider implements PurchaseProvider {
  readonly available = false;
  /** How many times something was attempted (for tests); no money ever moves. */
  attempts = 0;

  async plusPrice(): Promise<string | null> {
    return null;
  }
  async buyPlus(): Promise<PurchaseResult> {
    return this.unavailable();
  }
  async restore(): Promise<PurchaseResult> {
    return this.unavailable();
  }
  async tip(_tierId: string): Promise<PurchaseResult> {
    return this.unavailable();
  }
  private unavailable(): PurchaseResult {
    this.attempts += 1;
    return { ok: false, reason: UNAVAILABLE_REASON, message: unavailableMessage() };
  }
}

/** Buys (or restores) Plus and records it only when the provider reports success. */
export async function applyPurchase(
  store: EntitlementStore,
  provider: PurchaseProvider,
  action: 'buy' | 'restore' = 'buy',
): Promise<PurchaseResult> {
  let r: PurchaseResult;
  try {
    r = action === 'buy' ? await provider.buyPlus() : await provider.restore();
  } catch {
    r = { ok: false, reason: 'failed', message: t('core.plus.failed') };
  }
  if (r.ok && r.kind === 'plus') await store.grant(action === 'buy' ? 'purchase' : 'restore');
  return r;
}
