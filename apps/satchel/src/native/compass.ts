// Find your way back (T73): the position and compass heading, watched only while the compass screen is on screen.
// Foreground only, never background: the screen starts this on focus and calls stop() on blur, when the app leaves
// the foreground, and on unmount. GPS and the compass need no signal, so this works in flight mode. Never throws.
// A refusal carries the UI state from permissionState() (src/core/permissions.ts) so PermissionNotice offers the
// right actions; Location Services switched off is 'unavailable', like locateOnce (src/native/location.ts).
import * as Location from 'expo-location';
import { permissionState, type PermissionState } from '../core/permissions.ts';
import type { HeadingReading } from '../core/wayback.ts';
import type { Coords } from './location.ts';

export type CompassStatus =
  | { s: 'starting' }
  | { s: 'watching' }
  | { s: 'denied'; state: Exclude<PermissionState, 'granted'> }
  | { s: 'unavailable'; servicesOff: boolean };

export type CompassHandlers = {
  onPosition: (c: Coords) => void;
  /** Null when this phone has no compass (or it failed): the screen falls back to words. */
  onHeading: (h: HeadingReading | null) => void;
  onStatus: (s: CompassStatus) => void;
};

type Sub = { remove: () => void };

/** Starts watching. The returned stop() is safe to call at any time, also before the watches have started. */
export function startCompass(h: CompassHandlers): () => void {
  let stopped = false;
  const subs: Sub[] = [];
  const keep = (s: Sub) => {
    if (stopped) {
      try {
        s.remove();
      } catch {}
    } else subs.push(s);
  };

  (async () => {
    try {
      h.onStatus({ s: 'starting' });
      const state = permissionState(await Location.requestForegroundPermissionsAsync());
      if (stopped) return;
      if (state !== 'granted' && state !== 'limited') return h.onStatus({ s: 'denied', state });
      if (!(await Location.hasServicesEnabledAsync().catch(() => true))) return stopped ? undefined : h.onStatus({ s: 'unavailable', servicesOff: true });
      if (stopped) return;
      const pos = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, distanceInterval: 3, timeInterval: 2000 }, (p) => {
        if (stopped) return;
        const { latitude, longitude, accuracy } = p.coords;
        if (Number.isFinite(latitude) && Number.isFinite(longitude)) h.onPosition({ lat: latitude, lon: longitude, accuracy: accuracy ?? null });
      });
      keep(pos);
      if (stopped) return;
      h.onStatus({ s: 'watching' });
      try {
        const head = await Location.watchHeadingAsync((r) => {
          if (!stopped) h.onHeading(r);
        });
        keep(head);
      } catch {
        if (!stopped) h.onHeading(null);
      }
    } catch {
      if (!stopped) h.onStatus({ s: 'unavailable', servicesOff: false });
    }
  })();

  return () => {
    stopped = true;
    for (const s of subs.splice(0)) {
      try {
        s.remove();
      } catch {}
    }
  };
}
