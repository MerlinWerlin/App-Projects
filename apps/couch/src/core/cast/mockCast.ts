/**
 * MockCast (cast-1024, T89): the demo-mode cast target (Expo Go, App Review, the demo TV).
 *
 * Simulates a TV: a video loads for about 300 ms, then plays with a moving position (durationSec
 * from the media, or 60 s) until it reaches the end, where the state becomes 'stopped' so the queue
 * can advance. Photos go straight to 'playing' and have no timeline. Pause, play, seek and stop
 * behave like a real renderer. Nothing leaves the phone; media.url is never fetched.
 */
import { driverError } from '../drivers/errors';
import type { CastMedia } from './didl';
import type { CastDriver, CastTarget } from './driver';
import { SYSTEM_TIMER, type CastSnapshot, type CastTimer } from './session';

export const MOCK_CAST_TARGET: CastTarget = {
  id: 'mock:demo',
  name: 'Demo TV',
  kind: 'mock',
  host: 'demo',
  accepts: { photo: true, video: true },
};

/** Simulated time from load() until a video starts playing. */
export const MOCK_LOAD_MS = 300;
/** Video length used when the media has no durationSec. */
export const MOCK_DEFAULT_DURATION_SEC = 60;
const TICK_MS = 100;

const IDLE: CastSnapshot = {
  state: 'idle',
  media: null,
  positionSec: null,
  durationSec: null,
  error: null,
  errorCode: null,
};

export function createMockCast(target: CastTarget = MOCK_CAST_TARGET, timer: CastTimer = SYSTEM_TIMER): CastDriver {
  let snap: CastSnapshot = IDLE;
  const subs = new Set<(s: CastSnapshot) => void>();
  let ticker: unknown = null;
  let loadAt = 0;
  /** Position (s) at playStartedAt; position = base + elapsed while playing. */
  let base = 0;
  let playStartedAt = 0;
  let disposed = false;

  const set = (patch: Partial<CastSnapshot>): void => {
    const next = { ...snap, ...patch };
    const keys = Object.keys(next) as (keyof CastSnapshot)[];
    if (keys.every((k) => next[k] === snap[k])) return;
    snap = next;
    for (const cb of [...subs]) cb(next);
  };
  const stopTicker = (): void => {
    if (ticker !== null) {
      timer.clearInterval(ticker);
      ticker = null;
    }
  };
  const duration = (): number => snap.durationSec ?? MOCK_DEFAULT_DURATION_SEC;
  const position = (): number => Math.min(duration(), base + Math.max(0, timer.now() - playStartedAt) / 1000);

  const tick = (): void => {
    if (snap.state === 'loading') {
      if (timer.now() - loadAt < MOCK_LOAD_MS) return;
      base = 0;
      playStartedAt = timer.now();
      set({ state: 'playing', positionSec: 0 });
      return;
    }
    if (snap.state !== 'playing' || snap.media?.kind !== 'video') return;
    const pos = position();
    if (pos >= duration()) {
      stopTicker();
      set({ state: 'stopped', positionSec: duration() });
    } else {
      set({ positionSec: Math.floor(pos) });
    }
  };
  const startTicker = (): void => {
    stopTicker();
    ticker = timer.setInterval(tick, TICK_MS);
  };
  const ensureUsable = (): void => {
    if (disposed) throw driverError('unsupported', 'core.driver.cast.notNow');
  };

  const load = async (media: CastMedia): Promise<void> => {
    ensureUsable();
    if (!target.accepts[media.kind]) throw driverError('unsupported', 'core.driver.cast.formatUnsupported');
    stopTicker();
    base = 0;
    if (media.kind === 'photo') {
      set({ ...IDLE, state: 'playing', media });
      return;
    }
    loadAt = timer.now();
    const dur = media.durationSec !== undefined && media.durationSec > 0 ? media.durationSec : MOCK_DEFAULT_DURATION_SEC;
    set({ ...IDLE, state: 'loading', media, durationSec: dur });
    startTicker();
  };

  return {
    target,
    load,
    async play() {
      ensureUsable();
      const media = snap.media;
      if (!media || media.kind === 'photo') return;
      if (snap.state === 'paused') {
        playStartedAt = timer.now();
        set({ state: 'playing' });
        startTicker();
      } else if (snap.state === 'stopped' || snap.state === 'error') {
        await load(media);
      }
    },
    async pause() {
      ensureUsable();
      if (snap.media?.kind !== 'video') return;
      if (snap.state === 'paused') return;
      if (snap.state !== 'playing') throw driverError('unsupported', 'core.driver.cast.notNow');
      base = position();
      stopTicker();
      set({ state: 'paused', positionSec: Math.floor(base) });
    },
    async seek(positionSec: number) {
      ensureUsable();
      if (snap.media?.kind !== 'video') return;
      if (snap.state !== 'playing' && snap.state !== 'paused') throw driverError('unsupported', 'core.driver.cast.notNow');
      const target = Math.min(Math.floor(duration()), Math.max(0, Math.floor(Number.isFinite(positionSec) ? positionSec : 0)));
      base = target;
      playStartedAt = timer.now();
      set({ positionSec: target });
    },
    async stop() {
      ensureUsable();
      stopTicker();
      if (snap.state === 'idle' || snap.state === 'stopped') return;
      set({ state: 'stopped' });
    },
    snapshot: () => snap,
    subscribe(listener) {
      subs.add(listener);
      return () => {
        subs.delete(listener);
      };
    },
    dispose() {
      disposed = true;
      stopTicker();
      subs.clear();
    },
  };
}
