/**
 * Quiet over-the-air updates via expo-updates (EAS Update). Guarded requires inside functions (D4-1):
 * where expo-updates is missing, disabled, in development or inside Expo Go this does nothing.
 * A downloaded update is NOT applied immediately; it takes effect on the next cold start, which is the
 * least disruptive moment for a remote. Never throws.
 */
declare const require: (id: string) => unknown;
declare const __DEV__: boolean | undefined;

/** Minimal slice of the expo-updates API that we use. */
export interface UpdatesLike {
  isEnabled?: boolean;
  checkForUpdateAsync?: () => Promise<{ isAvailable?: boolean } | null | undefined>;
  fetchUpdateAsync?: () => Promise<unknown>;
  reloadAsync?: () => Promise<void>;
}

interface ConstantsLike {
  executionEnvironment?: string;
}

interface DevSettingsLike {
  reload?: (reason?: string) => void;
}

export type QuietUpdateResult = 'none' | 'downloaded' | 'skipped' | 'error';

/** Injectable dependencies; tests override them with `_setUpdateDeps`. */
export interface UpdateDeps {
  loadUpdates: () => UpdatesLike | null;
  loadConstants: () => ConstantsLike | null;
  loadDevSettings: () => DevSettingsLike | null;
  isDev: () => boolean;
}

function defaultLoadUpdates(): UpdatesLike | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-updates') as (UpdatesLike & { default?: UpdatesLike }) | null;
    if (!mod) return null;
    if (typeof mod.checkForUpdateAsync === 'function' || typeof mod.reloadAsync === 'function') return mod;
    return mod.default ?? null;
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

function defaultLoadDevSettings(): DevSettingsLike | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const rn = require('react-native') as { DevSettings?: DevSettingsLike } | null;
    return rn?.DevSettings ?? null;
  } catch {
    return null;
  }
}

function defaultIsDev(): boolean {
  try {
    return typeof __DEV__ !== 'undefined' && __DEV__ === true;
  } catch {
    return false;
  }
}

const DEFAULT_DEPS: UpdateDeps = {
  loadUpdates: defaultLoadUpdates,
  loadConstants: defaultLoadConstants,
  loadDevSettings: defaultLoadDevSettings,
  isDev: defaultIsDev,
};

let deps: UpdateDeps = DEFAULT_DEPS;

/** Test hook: override some or all dependencies; call with no argument to restore the defaults. */
export function _setUpdateDeps(override?: Partial<UpdateDeps>): void {
  deps = override ? { ...DEFAULT_DEPS, ...override } : DEFAULT_DEPS;
}

function isExpoGo(): boolean {
  try {
    return deps.loadConstants()?.executionEnvironment === 'storeClient';
  } catch {
    return false;
  }
}

/**
 * Checks for a published update and downloads it in the background if there is one.
 * 'skipped' = not applicable here (no module, dev, disabled, Expo Go); 'none' = up to date;
 * 'downloaded' = applies on next cold start; 'error' = check or download failed.
 */
export async function checkForQuietUpdate(): Promise<QuietUpdateResult> {
  try {
    const Updates = deps.loadUpdates();
    if (!Updates) return 'skipped';
    if (deps.isDev()) return 'skipped';
    if (Updates.isEnabled === false) return 'skipped';
    if (isExpoGo()) return 'skipped';
    if (typeof Updates.checkForUpdateAsync !== 'function') return 'skipped';
    const check = await Updates.checkForUpdateAsync();
    if (!check?.isAvailable) return 'none';
    if (typeof Updates.fetchUpdateAsync !== 'function') return 'none';
    await Updates.fetchUpdateAsync();
    return 'downloaded';
  } catch {
    return 'error';
  }
}

/**
 * Reloads the JS bundle (used when switching text direction, e.g. Arabic). Tries expo-updates
 * reloadAsync, then react-native DevSettings.reload. Returns false if neither worked. Never throws.
 */
export async function reloadApp(): Promise<boolean> {
  try {
    const Updates = deps.loadUpdates();
    if (Updates && typeof Updates.reloadAsync === 'function') {
      await Updates.reloadAsync();
      return true;
    }
  } catch {
    // fall through to DevSettings
  }
  try {
    const dev = deps.loadDevSettings();
    if (dev && typeof dev.reload === 'function') {
      dev.reload('Couch text direction changed');
      return true;
    }
  } catch {
    // nothing else to try
  }
  return false;
}
