/**
 * Couch Plus is for sale (owner decision 7 Nov 2026): one one-time purchase, A$3.99, unlocks the remote and casting,
 * with a free 7-day trial (src/plus/access.ts, src/plus/iapStore.ts). Settings shows the Couch Plus card again.
 * Themes stay free for everyone and app/themes.tsx no longer reads this. Lives in src/core (not src/plus) so screens
 * can read it without importing the entitlement.
 */
export const PLUS_FOR_SALE = true;

export function plusForSale(): boolean {
  return PLUS_FOR_SALE;
}
