// Brightness adapter for the ticket view: remember the current brightness, go to full, and put it back on every
// exit (close, unmount, app to background). Keeps the screen awake while a ticket is open. Every call is guarded:
// if brightness can't be changed the ticket still shows and nothing throws.
import * as Brightness from 'expo-brightness';
import * as KeepAwake from 'expo-keep-awake';
import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';

const TAG = 'satchel-ticket';
let saved: number | null = null;
let boosted = false;
let wanted = false;
// Calls run one after another so a quick open/close never leaves the screen stuck at full brightness.
let queue: Promise<unknown> = Promise.resolve();
const serial = <T,>(fn: () => Promise<T>): Promise<T> => {
  const next = queue.then(fn, fn);
  queue = next.catch(() => {});
  return next;
};

async function doRestore(): Promise<void> {
  if (!boosted) return;
  const prev = saved;
  boosted = false;
  saved = null;
  try {
    if (Platform.OS === 'android') await Brightness.restoreSystemBrightnessAsync();
    else if (prev != null) await Brightness.setBrightnessAsync(prev);
  } catch {
    // nothing more we can do; the system brightness control still works
  }
}

/** Full brightness, remembering the previous level once. Resolves false where brightness can't be changed. */
export function boostBrightness(): Promise<boolean> {
  wanted = true;
  return serial(async () => {
    if (!wanted) return false;
    try {
      if (!(await Brightness.isAvailableAsync())) return false;
      if (!boosted) {
        saved = await Brightness.getBrightnessAsync();
        boosted = true;
      }
      await Brightness.setBrightnessAsync(1);
      return true;
    } catch {
      return false;
    }
  });
}

/** Puts back the brightness from before `boostBrightness`. Safe to call any number of times. */
export function restoreBrightness(): Promise<void> {
  wanted = false;
  return serial(doRestore);
}

function keepAwake(on: boolean) {
  try {
    const p = on ? KeepAwake.activateKeepAwakeAsync(TAG) : KeepAwake.deactivateKeepAwake(TAG);
    p.catch(() => {});
  } catch {
    // keep-awake unavailable: the ticket still works
  }
}

/**
 * While mounted: full brightness and screen kept awake; restored on unmount and whenever the app leaves the
 * foreground, boosted again when it comes back. Returns false once we know brightness couldn't be raised.
 */
export function useFullBrightness(): boolean {
  const [ok, setOk] = useState(true);
  useEffect(() => {
    let alive = true;
    const up = () => {
      keepAwake(true);
      boostBrightness().then((v) => alive && setOk(v));
    };
    const down = () => {
      keepAwake(false);
      restoreBrightness();
    };
    up();
    let sub: { remove: () => void } | null = null;
    try {
      sub = AppState.addEventListener('change', (s) => (s === 'active' ? up() : down()));
    } catch {
      sub = null;
    }
    return () => {
      alive = false;
      sub?.remove();
      down();
    };
  }, []);
  return ok;
}
