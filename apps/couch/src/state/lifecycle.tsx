import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import appJson from '../../app.json';
import { Diagnostics } from '../core/diagnostics';
import { KeepAlive } from '../core/keepAlive';
import { Reconnector, type ReconnectStatus } from '../core/reconnect';
import { linkReconnectToSession } from '../core/reconnectLink';
import { useSession } from './session';

/**
 * App lifecycle glue (PLAN positioning #2, T70): on 'active' (wake / back from another app) the
 * current TV is probed silently and, if the link is gone, reconnected fast (0, 250 ms, 1 s, 3 s,
 * then the normal backoff, src/core/reconnect.ts). Key presses during that window are held for up
 * to 2 s and then sent (src/core/reconnectLink.ts); the header pill says "Reconnecting…" while a
 * run is visible. Socket protocols get a keep-alive ping while in the foreground
 * (src/core/keepAlive.ts), paused in the background. Also records per-TV diagnostics for
 * app/diagnostics.tsx. Must be mounted inside <SessionProvider>.
 */
interface Lifecycle {
  diagnostics: Diagnostics;
  reconnector: Reconnector;
  keepAlive: KeepAlive;
}

const Ctx = createContext<Lifecycle | null>(null);

export const APP_VERSION: string = appJson.expo.version;
export const OS_LABEL = `${Platform.OS} ${String(Platform.Version)}`;

export function LifecycleProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const [value] = useState<Lifecycle>(() => {
    const reconnector = new Reconnector();
    const keepAlive = new KeepAlive({ onDead: () => reconnector.onLinkLost() });
    const diagnostics = new Diagnostics({ attemptFor: (id) => reconnector.attemptFor(id) });
    return { diagnostics, reconnector, keepAlive };
  });

  useEffect(() => {
    const { diagnostics, reconnector, keepAlive } = value;
    const unbindDiag = diagnostics.bind(session);
    const unbindRec = reconnector.bind(session);
    const unbindKeep = keepAlive.bind(session);
    const unlink = linkReconnectToSession(reconnector, session);
    let last = AppState.currentState;
    if (last === 'background') keepAlive.pause();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === last) return;
      last = next;
      if (next === 'active') {
        keepAlive.resume();
        reconnector.onForeground();
      } else if (next === 'background') {
        keepAlive.pause();
        reconnector.onBackground();
      }
      // 'inactive' (iOS app switcher, notification shade): keep the socket, do nothing.
    });
    return () => {
      sub.remove();
      unlink();
      unbindKeep();
      unbindRec();
      unbindDiag();
    };
  }, [session, value]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function useLifecycle(): Lifecycle {
  const v = useContext(Ctx);
  if (!v) throw new Error('useDiagnostics must be used inside <LifecycleProvider>');
  return v;
}

/** Diagnostics + reconnector, re-rendering on every change of either. */
export function useDiagnostics(): { diagnostics: Diagnostics; reconnector: Reconnector; rev: number; status: ReconnectStatus } {
  const { diagnostics, reconnector } = useLifecycle();
  const subDiag = useCallback((cb: () => void) => diagnostics.subscribe(cb), [diagnostics]);
  const getRev = useCallback(() => diagnostics.getRev(), [diagnostics]);
  const rev = useSyncExternalStore(subDiag, getRev, getRev);
  const subRec = useCallback((cb: () => void) => reconnector.subscribe(cb), [reconnector]);
  const getStatus = useCallback(() => reconnector.getStatus(), [reconnector]);
  const status = useSyncExternalStore(subRec, getStatus, getStatus);
  return { diagnostics, reconnector, rev, status };
}
