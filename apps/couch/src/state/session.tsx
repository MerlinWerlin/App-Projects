import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { TvDriver } from '../core/driver';
import { createDemoSession } from '../core/demo';
import { connectRestored, restoreSaved } from '../core/restore';
import { RemoteSession, type SessionSnapshot } from '../core/session';
import { appTransport } from '../native/transport';
import { savedTvStore } from './tvs';

/**
 * React binding for the pure-TS RemoteSession. On start, saved TVs are restored (last used first,
 * src/core/restore.ts) and the app starts out of demo mode; with no restorable TVs it starts in demo
 * mode (MockTv) so the app always works in Expo Go. The active TV is remembered as "last used".
 */
const Ctx = createContext<RemoteSession | null>(null);

async function loadDemo(session: RemoteSession): Promise<void> {
  const demo = await createDemoSession();
  session.load(demo.tvs, demo.drivers as Map<string, TvDriver>, { demo: true });
}

/** Loads the saved TVs into the session. Returns false (session untouched) when none can be restored. */
async function loadSaved(session: RemoteSession): Promise<boolean> {
  const r = await restoreSaved(savedTvStore, appTransport());
  if (r.tvs.length === 0) return false;
  session.load(r.tvs, r.drivers, { demo: false });
  void connectRestored(r.drivers);
  return true;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session] = useState(() => new RemoteSession());
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await restoreSaved(savedTvStore, appTransport());
      // Skip if a TV was added (or demo toggled) while we were reading storage.
      if (cancelled || session.getSnapshot().tvs.length > 0) return;
      if (r.tvs.length > 0) {
        session.load(r.tvs, r.drivers, { demo: false });
        void connectRestored(r.drivers);
        return;
      }
      const demo = await createDemoSession();
      if (!cancelled && session.getSnapshot().tvs.length === 0) {
        session.load(demo.tvs, demo.drivers as Map<string, TvDriver>, { demo: true });
      }
    })().catch(() => {});
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

  return <Ctx.Provider value={session}>{children}</Ctx.Provider>;
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

/**
 * Demo mode on/off: on re-creates the demo session; off restores the saved TVs, or clears the list
 * until real ones are added when there are none.
 */
export async function setDemoMode(session: RemoteSession, on: boolean): Promise<void> {
  if (on) {
    await loadDemo(session);
    return;
  }
  if (!(await loadSaved(session))) session.load([], new Map(), { demo: false });
}
