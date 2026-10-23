/**
 * WidgetBridge over a local widget-bridge Expo module (modules/widget-bridge, T77). That module does
 * not exist yet: it needs a dev build (an App Group write plus WidgetCenter on iOS, SharedPreferences
 * plus an AppWidget update on Android). It is loaded lazily by a guarded require inside a function
 * (D4-1), so in Expo Go, web and tests loadWidgetBridge() returns UNAVAILABLE_WIDGET_BRIDGE, a no-op.
 * Never throws, at load time or on a call. Not tested on a device.
 */
import { UNAVAILABLE_WIDGET_BRIDGE, type WidgetBridge } from '../core/widget/bridge';

/** Minimal slice of the planned modules/widget-bridge API (kept local so a missing module cannot break types). */
export interface WidgetBridgeModule {
  setSnapshot(json: string): Promise<void>;
  reloadTimelines(): Promise<void>;
}

declare const require: (id: string) => unknown;

function defaultLoadModule(): WidgetBridgeModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('../../modules/widget-bridge') as { default?: Partial<WidgetBridgeModule> | null } | null;
    const m = mod?.default ?? null;
    if (!m || typeof m.setSnapshot !== 'function' || typeof m.reloadTimelines !== 'function') return null;
    return m as WidgetBridgeModule;
  } catch {
    return null;
  }
}

export interface WidgetBridgeDeps {
  loadModule: () => WidgetBridgeModule | null;
}

const DEFAULT_DEPS: WidgetBridgeDeps = { loadModule: defaultLoadModule };
let deps: WidgetBridgeDeps = DEFAULT_DEPS;

/** Test hook: override the loader; call with no argument to restore the default. */
export function _setWidgetBridgeDeps(override?: Partial<WidgetBridgeDeps>): void {
  deps = override ? { ...DEFAULT_DEPS, ...override } : DEFAULT_DEPS;
}

/** The native widget bridge, or UNAVAILABLE_WIDGET_BRIDGE when the module is missing. */
export function loadWidgetBridge(): WidgetBridge {
  let mod: WidgetBridgeModule | null = null;
  try {
    mod = deps.loadModule();
  } catch {
    return UNAVAILABLE_WIDGET_BRIDGE;
  }
  if (!mod) return UNAVAILABLE_WIDGET_BRIDGE;
  const native = mod;
  return {
    available: true,
    // A failed write only means a stale widget; it must never surface as an app error.
    setSnapshot: async (json: string): Promise<void> => {
      try {
        await native.setSnapshot(json);
      } catch {
        // ignored
      }
    },
    reloadTimelines: async (): Promise<void> => {
      try {
        await native.reloadTimelines();
      } catch {
        // ignored
      }
    },
  };
}

export function hasWidgetBridge(): boolean {
  return loadWidgetBridge().available;
}
