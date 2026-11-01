// T245: the target day a person chose for each countdown art piece (dune-countdown,
// rehearsal-countdown, number-free countdown pieces), keyed `<themeId>/<optionId>`
// (src/core/liveArt.ts countdownArtKey). Saved in AsyncStorage on this device only. The day reaches
// the widget inside the piece's `live` spec (`target`) when the piece is saved ("Use on my widget")
// or the theme's art is synced (themeWidgetArt.ts). No day = the piece stays Art. Never throws.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseCountdownArtTargets, withCountdownArtTarget, type CountdownArtTargets } from '../core/liveArt';

export const COUNTDOWN_ART_TARGETS_KEY = 'glaze.countdownArtTargets.v1';

let cache: CountdownArtTargets = {};
let loaded: Promise<CountdownArtTargets> | null = null;
const listeners = new Set<(t: CountdownArtTargets) => void>();

/** The stored targets (read once, then cached). */
export function loadCountdownArtTargets(): Promise<CountdownArtTargets> {
  if (!loaded) {
    loaded = (async () => {
      try {
        const raw = await AsyncStorage.getItem(COUNTDOWN_ART_TARGETS_KEY);
        cache = raw ? parseCountdownArtTargets(JSON.parse(raw)) : {};
      } catch {
        cache = {};
      }
      return cache;
    })();
  }
  return loaded;
}

/** The targets known right now (empty until loadCountdownArtTargets resolves). */
export function countdownArtTargetsNow(): CountdownArtTargets {
  return cache;
}

/** Set (valid YYYY-MM-DD) or clear (null) one piece's day; listeners hear the new map. */
export async function setCountdownArtTarget(themeId: string, optionId: string, day: string | null): Promise<CountdownArtTargets> {
  await loadCountdownArtTargets();
  cache = withCountdownArtTarget(cache, themeId, optionId, day);
  listeners.forEach((l) => {
    try {
      l(cache);
    } catch {
      // A listener's failure never blocks the save.
    }
  });
  try {
    await AsyncStorage.setItem(COUNTDOWN_ART_TARGETS_KEY, JSON.stringify(cache));
  } catch {
    // Best effort: the day still applies this session.
  }
  return cache;
}

/** Hear every change; returns the unsubscribe. */
export function subscribeCountdownArtTargets(fn: (t: CountdownArtTargets) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
