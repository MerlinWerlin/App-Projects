import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { connectRestored, restoreSaved } from '../core/restore';
import { RemoteSession, type SessionSnapshot } from '../core/session';
import { appTransport } from '../native/transport';
import { savedTvStore } from './tvs';

/**
 * React binding for the pure-TS RemoteSession. On start, saved TVs are restored (last used first,
 * src/core/restore.ts). With none saved the list starts empty and the app asks the user to add their TV
 * (owner 7 Nov 2026: demo mode removed from the app). The active TV is remembered as "last used".
 */
const Ctx = createContext<RemoteSession | null>(null);
/** True once saved TVs have been read from storage, so screens don't flash "add a TV" on start. */
const ReadyCtx = createContext(false);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session] = useState(() => new RemoteSession());
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await restoreSaved(savedTvStore, appTransport());
      // Skip if a TV was added while we were reading storage.
      if (cancelled || session.getSnapshot().tvs.length > 0) return;
      if (r.tvs.length > 0) {
        session.load(r.tvs, r.drivers, { demo: false });
        void connectRestored(r.drivers);
      }
    })()
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  // Remember the active real TV as "last used" so the next start opens on it.
  useEffect(() => {
    let last: string | null = null;
    return session.subscribe(() => {
      const snap = session.getSnapshot();
      if (snap.demo || snap.activeId === null || snap.activeId === last) return;
      last = snap.activeId;
      savedTvStore.setLastUsed(snap.activeId).catch(() => {});
    });
  }, [session]);

  return (
    <Ctx.Provider value={session}>
      <ReadyCtx.Provider value={ready}>{children}</ReadyCtx.Provider>
    </Ctx.Provider>
  );
}

export function useSession(): { session: RemoteSession; snap: SessionSnapshot } {
  const session = useContext(Ctx);
  if (!session) throw new Error('useSession must be used inside <SessionProvider>');
  // Stable callbacks: a new subscribe fn each render would resubscribe every render.
  const subscribe = useCallback((cb: () => void) => session.subscribe(cb), [session]);
  const getSnapshot = useCallback(() => session.getSnapshot(), [session]);
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return useMemo(() => ({ session, snap }), [session, snap]);
}

/** True once the saved TVs have been read on start. */
export function useSessionReady(): boolean {
  return useContext(ReadyCtx);
}
