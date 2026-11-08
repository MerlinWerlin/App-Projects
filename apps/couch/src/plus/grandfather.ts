/**
 * Grandfathering (owner decision 7 Nov 2026): Couch 1.0.3 shipped free on the App Store, so anyone who already had it
 * keeps the remote and casting for good. Pure TypeScript, tested in Node.
 *
 * How an old install is recognised, on the first launch of a version with Couch Plus:
 * 1. Storage. If INSTALL_KEY is missing and anything the 1.0.3 app writes is already there (LEGACY_KEYS: saved TVs,
 *    prefs, the first-launch language line, the rating-prompt state written on every launch, app visibility, the
 *    sleep timer, store icons, the old entitlement doc), this is an update: INSTALL_KEY = 'legacy'. Otherwise
 *    INSTALL_KEY = 'fresh'. The marker is written once and never re-decided, so this version's own writes to the same
 *    keys can never turn a fresh install into a legacy one. The read happens at app start, before any screen mounts
 *    (src/plus/accessStore.ts is started from app/_layout.tsx at module load).
 * 2. App Store AppTransaction (optional, iOS 16+, expo-iap getAppTransactionIOS): its originalAppVersion is the
 *    CFBundleVersion (build number) first downloaded by this Apple ID. A production build number <= 15 (1.0.3 was
 *    build 14), or a version string 1.0.3 or lower, also means "had Couch before Plus" and upgrades 'fresh' to
 *    'legacy' (covers someone who downloaded 1.0.3 but never opened it, or deleted and re-installed). Sandbox /
 *    TestFlight always report "1.0", which is ignored, so testers and App Review see the paywall.
 * A 'legacy' marker is never downgraded.
 */
export const INSTALL_KEY = 'couch.install.v1';
export type InstallKind = 'legacy' | 'fresh';

/** Keys the Couch 1.0.3 app writes (src/core/*.ts and src/plus/entitlement.ts at 1.0.3). */
export const LEGACY_KEYS = [
  'couch.savedTvs',
  'couch.prefs.v1',
  'couch.languageHint.v1',
  'couch.rating',
  'couch.appVisibility.v1',
  'couch.sleepTimer.v1',
  'couch.storeIcons.v1',
  'couch.entitlement',
] as const;

/** Last App Store build number of the free app (1.0.3 was build 14; 15 leaves room for one more 1.0.3 build). */
export const LAST_FREE_BUILD = 15;
/** Last free marketing version. */
export const LAST_FREE_VERSION = [1, 0, 3] as const;

export interface KvLike {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export function parseInstallKind(raw: string | null): InstallKind | null {
  return raw === 'legacy' || raw === 'fresh' ? raw : null;
}

/** Decides from the legacy keys' raw values (null or empty: not written). */
export function looksLikeOldInstall(values: readonly (string | null)[]): boolean {
  return values.some((v) => typeof v === 'string' && v.trim() !== '');
}

/**
 * Reads (or decides and saves) the install kind. Never throws. If storage can't be read the answer is 'fresh' for this
 * run and nothing is saved, so the next launch decides again.
 */
export async function resolveInstallKind(kv: KvLike): Promise<InstallKind> {
  // One batch, all requested in the same tick (called at app load, before any screen can write): the marker and
  // the old keys are read before this version writes anything of its own.
  const reads = [INSTALL_KEY, ...LEGACY_KEYS].map((k) => {
    try {
      return Promise.resolve(kv.getItem(k));
    } catch (e) {
      return Promise.reject(e);
    }
  });
  let all: (string | null)[];
  try {
    all = await Promise.all(reads);
  } catch {
    return 'fresh';
  }
  const known = parseInstallKind(all[0] ?? null);
  const values = all.slice(1);
  if (known) return known;
  const kind: InstallKind = looksLikeOldInstall(values) ? 'legacy' : 'fresh';
  try {
    await kv.setItem(INSTALL_KEY, kind);
  } catch {
    // Not saved: decided again next launch.
  }
  return kind;
}

/** Saves 'legacy' (from the App Store check). Never throws. */
export async function markLegacy(kv: KvLike): Promise<void> {
  try {
    await kv.setItem(INSTALL_KEY, 'legacy');
  } catch {
    // This run still counts as grandfathered.
  }
}

/** The fields of expo-iap's AppTransaction that matter here. */
export interface AppTransactionLike {
  originalAppVersion?: unknown;
  environment?: unknown;
}

/**
 * True when Apple says this Apple ID first got Couch while it was free. Defensive: anything unexpected is false.
 * Only the Production environment counts (Sandbox, Xcode and TestFlight always say "1.0").
 */
export function appTransactionGrandfathered(tx: AppTransactionLike | null | undefined): boolean {
  if (!tx || typeof tx !== 'object') return false;
  const env = typeof tx.environment === 'string' ? tx.environment.trim().toLowerCase() : '';
  if (env !== '' && env !== 'production') return false;
  const v = typeof tx.originalAppVersion === 'string' ? tx.originalAppVersion.trim() : '';
  if (v === '' || v === '1.0') return false;
  if (/^\d+$/.test(v)) {
    const build = Number(v);
    return build >= 1 && build <= LAST_FREE_BUILD;
  }
  if (!/^\d+(\.\d+){1,3}$/.test(v)) return false;
  const parts = v.split('.').map(Number);
  for (let i = 0; i < LAST_FREE_VERSION.length; i++) {
    const a = parts[i] ?? 0;
    const b = LAST_FREE_VERSION[i]!;
    if (a !== b) return a < b;
  }
  // Equal to 1.0.3 in the first three parts (1.0.3 or 1.0.3.x).
  return true;
}
