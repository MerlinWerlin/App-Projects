/**
 * The phone's Wi-Fi IPv4 via expo-network (bundled in Expo Go). Loaded by a guarded require inside a
 * function (D4-1): where the package or its native module is missing (tests, web) loadPhoneIp()
 * returns null and the scan simply skips the automatic subnet probe. The returned provider never
 * rejects and yields only an RFC 1918 address (validPhoneIp); "0.0.0.0" (no Wi-Fi) becomes null.
 * Not tested on a device yet.
 */
import { validPhoneIp } from '../core/autoProbe';

/** Minimal slice of the expo-network API that we use. */
interface ExpoNetworkLike {
  getIpAddressAsync(): Promise<string>;
}

declare const require: (id: string) => unknown;

function loadModule(): ExpoNetworkLike | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-network') as ({ default?: Partial<ExpoNetworkLike> } & Partial<ExpoNetworkLike>) | null;
    if (mod && typeof mod.getIpAddressAsync === 'function') return mod as ExpoNetworkLike;
    const d = mod?.default;
    return d && typeof d.getIpAddressAsync === 'function' ? (d as ExpoNetworkLike) : null;
  } catch {
    return null;
  }
}

/** A provider for the phone's private Wi-Fi IPv4, or null when expo-network is unavailable. */
export function loadPhoneIp(): (() => Promise<string | null>) | null {
  const m = loadModule();
  if (!m) return null;
  return async () => {
    try {
      return validPhoneIp(await m.getIpAddressAsync());
    } catch {
      return null;
    }
  };
}

export function hasPhoneIp(): boolean {
  return loadModule() !== null;
}
