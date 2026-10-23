/**
 * T75 (run 42): the OS's own review sheet via expo-store-review, loaded by a guarded require inside
 * a function (D4-1): where the package or its native module is missing (tests, older builds) this
 * returns null / false and nothing happens. Inside Expo Go it also does nothing, so testers are never
 * asked to rate Expo Go itself. We never show our own pre-prompt (src/core/ratingPolicy.ts).
 * Never throws.
 */
declare const require: (id: string) => unknown;

/** Minimal slice of the expo-store-review API that we use. */
export interface StoreReviewLike {
  isAvailableAsync?: () => Promise<boolean>;
  requestReview?: () => Promise<void>;
}

interface ConstantsLike {
  executionEnvironment?: string;
}

export interface StoreReviewDeps {
  loadStoreReview: () => StoreReviewLike | null;
  loadConstants: () => ConstantsLike | null;
}

function defaultLoadStoreReview(): StoreReviewLike | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-store-review') as (StoreReviewLike & { default?: StoreReviewLike }) | null;
    if (!mod) return null;
    if (typeof mod.requestReview === 'function') return mod;
    const d = mod.default;
    return d && typeof d.requestReview === 'function' ? d : null;
  } catch {
    return null;
  }
}

function defaultLoadConstants(): ConstantsLike | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-constants') as (ConstantsLike & { default?: ConstantsLike }) | null;
    if (!mod) return null;
    return mod.default ?? mod;
  } catch {
    return null;
  }
}

const DEFAULT_DEPS: StoreReviewDeps = { loadStoreReview: defaultLoadStoreReview, loadConstants: defaultLoadConstants };
let deps: StoreReviewDeps = DEFAULT_DEPS;

/** Test hook: override some or all dependencies; call with no argument to restore the defaults. */
export function _setStoreReviewDeps(override?: Partial<StoreReviewDeps>): void {
  deps = override ? { ...DEFAULT_DEPS, ...override } : DEFAULT_DEPS;
}

function isExpoGo(): boolean {
  try {
    return deps.loadConstants()?.executionEnvironment === 'storeClient';
  } catch {
    return false;
  }
}

/** The loaded module, or null when missing or inside Expo Go. */
export function loadStoreReview(): StoreReviewLike | null {
  try {
    if (isExpoGo()) return null;
    return deps.loadStoreReview();
  } catch {
    return null;
  }
}

export function hasStoreReview(): boolean {
  return loadStoreReview() !== null;
}

/**
 * Requests the OS review sheet. Resolves true when it was requested (the OS may still choose not to
 * show it), false when unavailable. Never throws.
 */
export async function requestStoreReview(): Promise<boolean> {
  try {
    const m = loadStoreReview();
    if (!m || typeof m.requestReview !== 'function') return false;
    if (typeof m.isAvailableAsync !== 'function') return false;
    if (!(await m.isAvailableAsync())) return false;
    await m.requestReview();
    return true;
  } catch {
    return false;
  }
}
