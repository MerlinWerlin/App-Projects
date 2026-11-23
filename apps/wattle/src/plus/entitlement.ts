/**
 * Wattle Full Unlock: one payment, no subscription. A user-started free 7-day Trial item (Guideline 3.1.1)
 * unlocks everything for seven days first.
 *
 * Free forever: offset bends, Ohm's law & power, unit converter, the safety notes and sources.
 * Full Unlock (or an active trial): saddles, kicks and stub-ups, voltage drop, conduit fill, cable runs & drums, saving jobs.
 */
export const UNLOCK_PRODUCT_ID = 'com.jared797.wattle.unlock';
/** Australian base price; keep in step with store/listing.json. */
export const UNLOCK_AUSTRALIA_PRICE = 'A$4.99';

export const PAID_FEATURES = ['bend', 'vdrop', 'fill', 'runs', 'jobs'] as const;
export type Feature = (typeof PAID_FEATURES)[number] | 'power' | 'convert';
export type Tier = 'free' | 'full';

export interface EntitlementDoc { version: 1; tier: Tier; source: 'purchase' | 'restore' | 'none'; updatedAt: number }
export const ENTITLEMENT_KEY = 'wattle.unlock.v1';

export function parseEntitlement(raw: string | null): EntitlementDoc {
  const free: EntitlementDoc = { version: 1, tier: 'free', source: 'none', updatedAt: 0 };
  try {
    const d = raw ? (JSON.parse(raw) as EntitlementDoc) : null;
    if (d && d.version === 1 && d.tier === 'full' && (d.source === 'purchase' || d.source === 'restore')) return d;
  } catch {
    /* corrupt -> free */
  }
  return free;
}

export function canUse(unlocked: boolean, f: Feature): boolean {
  return unlocked || !(PAID_FEATURES as readonly string[]).includes(f);
}
