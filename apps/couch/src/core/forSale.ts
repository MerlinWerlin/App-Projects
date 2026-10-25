/**
 * Release standard 2 (25 Oct 2026): Couch 1.0 has no in-app purchases. Purchases are stubbed
 * (src/plus/purchases.ts, StubPurchaseProvider), so a store build must not show Buy / Restore / tips, a
 * "Get Couch Plus" button or "Purchases aren't available in this test build". While this is false:
 * Settings hides the Couch Plus card, Themes hides "Get Couch Plus to keep it" (Try it still works for the
 * session), and the Plus screen, if opened by a link, says "coming in a later update" with no purchase buttons.
 * Flip to true only in the version that ships a real store provider. Lives in src/core (not src/plus) so
 * screens can read it without importing the entitlement (tests/plus-guard, tests/design-v2-screens).
 */
export const PLUS_FOR_SALE = false;

export function plusForSale(): boolean {
  return PLUS_FOR_SALE;
}
