/**
 * AirPlay route picker over the local route-picker Expo module (modules/route-picker, T92). The
 * module is iOS only and needs a dev build. It is loaded lazily by a guarded require inside a
 * function (D4-1), so in Expo Go, Android, web and tests hasRoutePicker() is false and
 * showRoutePicker() resolves false: the caller then shows the Screen Mirroring guide instead.
 * Never throws, at load time or on a call. Not tested on a device.
 */

/** Minimal slice of the modules/route-picker API (kept local so a missing module cannot break types). */
export interface RoutePickerModule {
  show(): Promise<boolean>;
  isAvailable(): boolean;
}

declare const require: (id: string) => unknown;

function defaultLoadModule(): RoutePickerModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('../../modules/route-picker') as { default?: Partial<RoutePickerModule> | null } | null;
    const m = mod?.default ?? null;
    if (!m || typeof m.show !== 'function' || typeof m.isAvailable !== 'function') return null;
    return m as RoutePickerModule;
  } catch {
    return null;
  }
}

export interface RoutePickerDeps {
  loadModule: () => RoutePickerModule | null;
}

const DEFAULT_DEPS: RoutePickerDeps = { loadModule: defaultLoadModule };
let deps: RoutePickerDeps = DEFAULT_DEPS;

/** Test hook: override the loader; call with no argument to restore the default. */
export function _setRoutePickerDeps(override?: Partial<RoutePickerDeps>): void {
  deps = override ? { ...DEFAULT_DEPS, ...override } : DEFAULT_DEPS;
}

function loadModule(): RoutePickerModule | null {
  try {
    return deps.loadModule();
  } catch {
    return null;
  }
}

/** True when the native route picker is compiled in and says it can show the picker. */
export function hasRoutePicker(): boolean {
  const mod = loadModule();
  if (!mod) return false;
  try {
    return mod.isAvailable() === true;
  } catch {
    return false;
  }
}

/**
 * Opens the system AirPlay route picker. True when the sheet was opened; false when the module is
 * missing (Expo Go, Android), unavailable, or failed. Never rejects.
 */
export async function showRoutePicker(): Promise<boolean> {
  const mod = loadModule();
  if (!mod) return false;
  try {
    if (mod.isAvailable() !== true) return false;
    return (await mod.show()) === true;
  } catch {
    return false;
  }
}
