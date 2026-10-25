/**
 * Cue Plus: one-time purchase, no subscription. The free core is a complete teleprompter
 * (unlimited scripts, scrolling, mirror, countdown, recording with no watermark). Plus adds extras.
 * Only src/plus and screens that show a Plus badge may read the entitlement.
 */
export const PLUS_PRODUCT_ID = 'com.jared797.cue.plus';

export const PLUS_FEATURES = ['voice', 'captions', 'colors', 'import', 'stats'] as const;
export type PlusFeature = (typeof PLUS_FEATURES)[number];
export type Tier = 'free' | 'plus';

export interface EntitlementDoc {
  version: 1;
  tier: Tier;
  source: 'purchase' | 'restore' | 'none';
  updatedAt: number;
}

export const ENTITLEMENT_KEY = 'cue.plus.v1';

export function parseEntitlement(raw: string | null): EntitlementDoc {
  const free: EntitlementDoc = { version: 1, tier: 'free', source: 'none', updatedAt: 0 };
  try {
    const d = raw ? (JSON.parse(raw) as EntitlementDoc) : null;
    if (d && d.version === 1 && d.tier === 'plus' && (d.source === 'purchase' || d.source === 'restore')) return d;
  } catch {
    /* corrupt -> free */
  }
  return free;
}

export function canUse(tier: Tier, f: PlusFeature): boolean {
  return tier === 'plus' || !PLUS_FEATURES.includes(f);
}

/**
 * Cue Plus price, decided by the owner 2026-10-25: A$2.99, one-time. The real, localised price always
 * comes from StoreKit (the tier is set in App Store Connect); this is only the fallback label shown
 * when the store hasn't returned a price.
 */
export const PLUS_FALLBACK_PRICE = 'A$2.99';
