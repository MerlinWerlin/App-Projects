// "Where am I?": one foreground location check on request. Never watchPositionAsync, never background, never on
// a timer: the caller asks, we ask permission if needed, read the position once and stop. Never throws.
// A refusal carries the UI state from permissionState() (src/core/permissions.ts) so PermissionNotice offers the
// right actions: 'ask' -> Try again, 'blocked' -> Open Settings. Location Services switched off is 'unavailable'.
import * as Location from 'expo-location';
import { permissionState, type PermissionState } from '../core/permissions.ts';

export type Coords = { lat: number; lon: number; accuracy: number | null };
export type LocateResult =
  | { ok: true; coords: Coords }
  | { ok: false; reason: 'denied'; state: Exclude<PermissionState, 'granted'> }
  /** servicesOff: Location Services are off (Settings can fix it); otherwise no fix in time, or an error. */
  | { ok: false; reason: 'unavailable'; servicesOff: boolean };

const TIMEOUT_MS = 15_000;

const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T | null> =>
  new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
    );
  });

const unavailable = (servicesOff = false): LocateResult => ({ ok: false, reason: 'unavailable', servicesOff });

export async function locateOnce(): Promise<LocateResult> {
  try {
    const state = permissionState(await Location.requestForegroundPermissionsAsync());
    // 'limited' (approximate location) still gives a position.
    if (state !== 'granted' && state !== 'limited') return { ok: false, reason: 'denied', state };
    if (!(await Location.hasServicesEnabledAsync().catch(() => true))) return unavailable(true);
    const pos = await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), TIMEOUT_MS);
    if (!pos) return unavailable();
    const { latitude, longitude, accuracy } = pos.coords;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return unavailable();
    return { ok: true, coords: { lat: latitude, lon: longitude, accuracy: accuracy ?? null } };
  } catch {
    return unavailable();
  }
}
