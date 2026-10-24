import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { CastController, isCastActive, type CastControllerSnapshot } from '../core/cast/castController';
import { createMockCast, MOCK_CAST_TARGET } from '../core/cast/mockCast';
import { CastQueue } from '../core/cast/queue';
import { SYSTEM_TIMER } from '../core/cast/session';
import { createCastDriver, findCastTargets, type CastEnv } from '../core/cast/targets';
import { loadMediaServer } from '../native/mediaServer';
import { loadUdpFactory } from '../native/udp';
import { useSession } from './session';
import { fetchAdapter } from './tvs';

/**
 * Cast tab state (cast-1024, T91): one CastController for the app (src/core/cast/castController.ts)
 * with the real dependencies: targets found for the remote session's TVs (DLNA / Roku, T89), the
 * phone's file server (T90; unavailable in Expo Go), and MockCast in demo mode. Mounted inside
 * SessionProvider; stops the TV and the file server when it unmounts. Casting is free: nothing here
 * checks Couch Plus.
 */
const Ctx = createContext<CastController | null>(null);

function createController(): CastController {
  const env: CastEnv = { fetch: fetchAdapter, udp: loadUdpFactory(), timer: SYSTEM_TIMER };
  return new CastController({
    findTargets: (tvs) => findCastTargets(env, tvs),
    createDriver: (target) => createCastDriver(target, env),
    mockTarget: MOCK_CAST_TARGET,
    createMock: (target) => createMockCast(target, SYSTEM_TIMER),
    server: loadMediaServer(),
    createQueue: (play) => new CastQueue({ play, timer: SYSTEM_TIMER }),
  });
}

export function CastProvider({ children }: { children: ReactNode }) {
  const [controller] = useState(createController);
  const { snap } = useSession();
  const { demo, tvs } = snap;
  useEffect(() => {
    void controller.setContext({ demo, tvs }).catch(() => undefined);
  }, [controller, demo, tvs]);
  // Unmount stops the TV and the file server (stop, not dispose, so a remount can reuse it).
  useEffect(
    () => () => {
      void controller.stop().catch(() => undefined);
    },
    [controller],
  );
  return <Ctx.Provider value={controller}>{children}</Ctx.Provider>;
}

export function useCast(): { cast: CastController; snap: CastControllerSnapshot } {
  const cast = useContext(Ctx);
  if (!cast) throw new Error('useCast must be used inside <CastProvider>');
  const subscribe = useCallback((cb: () => void) => cast.subscribe(cb), [cast]);
  const getSnapshot = useCallback(() => cast.getSnapshot(), [cast]);
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return useMemo(() => ({ cast, snap }), [cast, snap]);
}

/**
 * Remote screen routing (cast-1024): while a cast is on the TV, the remote's Play/Pause key controls
 * the cast instead of the TV. `handlesKey(key)` is true only then (and only for PLAY_PAUSE).
 */
export function useCastRouting(): {
  active: boolean;
  title: string | null;
  handlesKey: (key: string) => boolean;
  togglePlay: () => void;
  stop: () => void;
} {
  const { cast, snap } = useCast();
  const active = isCastActive(snap.queue, snap.cast);
  const title = active ? (snap.cast.media?.title ?? snap.queue.items[snap.queue.index]?.title ?? null) : null;
  const handlesKey = useCallback((key: string) => active && key === 'PLAY_PAUSE', [active]);
  const togglePlay = useCallback(() => {
    void cast.togglePlay();
  }, [cast]);
  const stop = useCallback(() => {
    void cast.stop();
  }, [cast]);
  return { active, title, handlesKey, togglePlay, stop };
}
