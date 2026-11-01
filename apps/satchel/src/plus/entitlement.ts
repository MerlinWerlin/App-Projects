// What Satchel Plus unlocks, as pure rules (T16). Plus is small on purpose: the only gated thing in this build is
// downloading offline city maps beyond one per trip. Everything else stays free forever: tickets, the emergency
// card, documents and the vault, packing, low-battery mode, toilets, the first offline city per trip, own-photo and
// illustrated covers, backup. Already-downloaded cities always open and can always be deleted.
// Only src/plus/ and the screens listed in entitlement.test.ts read the entitlement; src/core never does.

/** 'stub': this binary has no store module. 'store': purchases work. */
export type PlusAvailability = 'stub' | 'store';
export type PlusState = { availability: PlusAvailability; owned: boolean };

/** Release standard: while purchases are stubbed every Plus feature is unlocked. */
export const plusUnlocked = (s: PlusState): boolean => s.availability === 'stub' || s.owned;

/** Free offline cities: one for each trip in Satchel, and at least one before any trip exists. */
export const freeCityAllowance = (tripCount: number): number => Math.max(1, Math.floor(Number.isFinite(tripCount) ? tripCount : 0));

export type CityGate = 'free' | 'plus' | 'locked';

/**
 * May this city be downloaded? 'free' within the per-trip allowance, 'plus' beyond it when Plus is unlocked,
 * 'locked' beyond it without Plus. A city already on the phone is never gated.
 */
export function cityDownloadGate(o: { unlocked: boolean; installedCount: number; tripCount: number; alreadyInstalled?: boolean }): CityGate {
  if (o.alreadyInstalled) return 'free';
  if (o.installedCount < freeCityAllowance(o.tripCount)) return 'free';
  return o.unlocked ? 'plus' : 'locked';
}

/** The features the paywall lists. Only what this build has (release standard: promise nothing else). */
export const PLUS_FEATURES = ['cities'] as const;
export type PlusFeature = (typeof PLUS_FEATURES)[number];
