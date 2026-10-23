/**
 * T75 (run 42): polite one-time rating prompt (rules in src/core/ratingPolicy.ts). Records the
 * session's successes (a 'sent' event from the active driver, MockTv included) and errors (a driver
 * 'error' event, e.g. a failed connect, or a control failing into the session's lastError), and on a
 * return to the foreground on the remote screen asks the OS review sheet if every rule holds.
 * Observes RemoteSession from the outside like src/core/diagnostics.ts, so session.tsx is unchanged.
 * Must be mounted inside <SessionProvider> and the router (usePathname). Never throws; persistence
 * goes through the existing kv store (src/native/kv.ts, in-memory fallback).
 */
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { usePathname } from 'expo-router';
import appJson from '../../app.json';
import type { TvDriver } from '../core/driver';
import { RatingController, ratingScreenFromPath } from '../core/ratingPolicy';
import { MemoryKv } from '../core/store';
import { loadPersistentKv } from '../native/kv';
import { requestStoreReview } from '../native/storeReview';
import { useSession } from './session';

/** Wait after returning to the foreground, so the sheet never lands on top of the user's first tap. */
const CALM_DELAY_MS = 1500;

export function useRatingPrompt(): void {
  const { session } = useSession();
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;
  const [controller] = useState(
    () =>
      new RatingController({
        kv: loadPersistentKv() ?? new MemoryKv(),
        now: () => Date.now(),
        appVersion: String(appJson.expo.version),
        requestReview: requestStoreReview,
      }),
  );

  // Record successes / errors of the active TV for this session.
  useEffect(() => {
    void controller.start().catch(() => undefined);
    let driver: TvDriver | null = null;
    let unsubDriver: (() => void) | null = null;
    let lastError: string | null = session.getSnapshot().lastError;
    const sync = () => {
      const snap = session.getSnapshot();
      if (snap.lastError !== null && snap.lastError !== lastError) controller.onError();
      lastError = snap.lastError;
      const d = session.activeDriver();
      if (d === driver) return;
      unsubDriver?.();
      unsubDriver = null;
      driver = d;
      if (d) {
        unsubDriver = d.on((e) => {
          if (e.type === 'sent') controller.onSuccess();
          else if (e.type === 'error') controller.onError();
        });
      }
    };
    sync();
    const unsub = session.subscribe(sync);
    return () => {
      unsub();
      unsubDriver?.();
    };
  }, [session, controller]);

  // Calm moment: back in the foreground, on the remote screen, after a successful key this session.
  useEffect(() => {
    let last = AppState.currentState;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const sub = AppState.addEventListener('change', (next) => {
      if (next === last) return;
      const prev = last;
      last = next;
      if (next === 'background') {
        if (timer) clearTimeout(timer);
        timer = null;
        controller.onBackground();
      } else if (next === 'active' && prev === 'background') {
        if (timer) clearTimeout(timer);
        timer = null;
        void controller
          .resume()
          .then((fresh) => {
            if (fresh || AppState.currentState !== 'active') return;
            timer = setTimeout(() => {
              timer = null;
              if (AppState.currentState !== 'active') return;
              void controller.maybeAsk(ratingScreenFromPath(pathRef.current)).catch(() => undefined);
            }, CALM_DELAY_MS);
          })
          .catch(() => undefined);
      }
    });
    return () => {
      sub.remove();
      if (timer) clearTimeout(timer);
    };
  }, [controller]);
}

/** Renders nothing; mount once inside <SessionProvider> (see app/_layout.tsx). */
export function RatingPromptHost(): null {
  useRatingPrompt();
  return null;
}
