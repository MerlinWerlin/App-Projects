// JS side of the home-screen widget bridge (modules/roamlings-widget-bridge).
// The native module exists only in iOS builds; with no module, or no App Group (builds without the
// widget), every call quietly does nothing and the app works as normal.
import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

interface Bridge {
  isAvailable(): Promise<boolean>;
  setState(json: string): Promise<boolean>;
  setImage(name: string, base64: string): Promise<boolean>;
  takeTaps(): Promise<string>;
  reload(): Promise<boolean>;
}

let bridge: Bridge | null | undefined;

function get(): Bridge | null {
  if (bridge !== undefined) return bridge;
  try {
    bridge = Platform.OS === 'ios' && typeof requireOptionalNativeModule === 'function'
      ? requireOptionalNativeModule<Bridge>('RoamlingsWidgetBridge')
      : null;
  } catch {
    bridge = null;
  }
  return bridge ?? null;
}

let available: Promise<boolean> | null = null;

/** True only in a build that has the widget and its App Group. */
export function widgetsAvailable(): Promise<boolean> {
  if (!available) {
    const b = get();
    available = b ? b.isAvailable().catch(() => false) : Promise.resolve(false);
  }
  return available;
}

export async function pushWidgetState(json: string): Promise<void> {
  if (!(await widgetsAvailable())) return;
  await get()?.setState(json).catch(() => false);
}

export async function pushWidgetImage(name: string, base64: string): Promise<void> {
  if (!(await widgetsAvailable())) return;
  await get()?.setImage(name, base64).catch(() => false);
}

/** The widget's Feed/Pet taps since last time (JSON), cleared as they're read. */
export async function takeWidgetTaps(): Promise<string | null> {
  if (!(await widgetsAvailable())) return null;
  return (await get()?.takeTaps().catch(() => null)) ?? null;
}
