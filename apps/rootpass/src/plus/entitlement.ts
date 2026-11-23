/**
 * Rootpass Full Unlock: one-time non-consumable, no subscription. A user-started free "7-day Trial"
 * non-consumable unlocks everything for seven days (App Store guideline 3.1.1); it never starts by itself.
 * Free for ever: steel weight, frame mitres, sheet bending and bolt-circle coordinates.
 */
export const UNLOCK_PRODUCT_ID = 'com.jared797.rootpass.unlock';
/** Australia base price; keep in step with store/listing.json. */
export const UNLOCK_AUSTRALIA_PRICE = 'A$4.99';
export const ENTITLEMENT_KEY = 'rootpass.unlock.v1';

export type ToolId = 'saddle' | 'lobster' | 'frame' | 'weight' | 'weld' | 'bend' | 'cutlist' | 'pcd';
export type Feature = ToolId | 'pdf' | 'saveJobs';

export const FREE: readonly Feature[] = ['weight', 'frame', 'bend', 'pcd'];

export function canUse(feature: Feature, unlocked: boolean): boolean {
  return unlocked || FREE.includes(feature);
}

export interface EntitlementDoc { version: 1; unlocked: boolean; updatedAt: number }

export function parseEntitlement(raw: string | null): EntitlementDoc {
  try {
    const d = raw ? (JSON.parse(raw) as EntitlementDoc) : null;
    if (d && d.version === 1 && d.unlocked === true) return d;
  } catch { /* corrupt -> locked */ }
  return { version: 1, unlocked: false, updatedAt: 0 };
}
