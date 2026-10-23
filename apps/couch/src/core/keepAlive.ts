import type { TvDriver } from './driver';
import type { ConnectionState } from './types';

/**
 * Driver keep-alive (T70). Pure TS: timers are injected so tests run on a fake clock.
 *
 * Persistent-socket protocols get a periodic, cheap round trip while the link is up and the app is
 * in the foreground, so a socket that died silently (Wi-Fi roam, TV asleep, phone slept) is noticed
 * before the user's next key press instead of after it. Stateless HTTP drivers (Roku, Sony,
 * Philips, Vizio, Fire TV, IR, demo) have no socket to keep: their ping is null and nothing runs.
 *
 * - webOS: an SSAP request on the main socket (ssap://audio/getVolume) via the driver's public
 *   request(), which neither emits error events nor toasts.
 * - Samsung: the remote channel has no request/reply call we can use without touching the driver,
 *   so the ping is the driver's HTTP device-info call (port 8001). It proves the TV is reachable and
 *   awake (powerState 'standby' counts as a miss); a closed socket is already reported by the driver
 *   itself through its onClose -> 'disconnected' event, which the Reconnector handles.
 *
 * After `maxMisses` consecutive failed pings, onDead() fires once (wire it to
 * Reconnector.onLinkLost()) and pinging stops until the driver reports 'connected' again.
 * pause() (app in background) stops all timers; resume() restarts them if the link is up.
 */

export type Ping = () => Promise<void>;

export interface KeepAliveTimers {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

const realTimers: KeepAliveTimers = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
};

/** webOS SSAP request used as the ping (same value as WEBOS_URI.getVolume in drivers/webos.ts). */
export const WEBOS_PING_URI = 'ssap://audio/getVolume';

type WithRequest = { request(uri: string, payload?: Record<string, unknown>): Promise<unknown> };
type WithDeviceInfo = { fetchDeviceInfo(): Promise<{ powerState?: string }> };

function hasFn<K extends string>(d: unknown, name: K): d is Record<K, (...args: never[]) => unknown> {
  return typeof (d as Record<string, unknown> | null)?.[name] === 'function';
}

/** The keep-alive ping for a driver, or null when its protocol needs none (HTTP drivers). */
export function keepAlivePing(driver: TvDriver): Ping | null {
  switch (driver.platform) {
    case 'webos': {
      if (!hasFn(driver, 'request')) return null;
      const d = driver as unknown as WithRequest;
      return async () => {
        await d.request(WEBOS_PING_URI);
      };
    }
    case 'samsung': {
      if (!hasFn(driver, 'fetchDeviceInfo')) return null;
      const d = driver as unknown as WithDeviceInfo;
      return async () => {
        const info = await d.fetchDeviceInfo();
        if (info.powerState === 'standby') throw new Error('TV in standby');
      };
    }
    default:
      return null;
  }
}

/** Rejects if `p` has not settled after `ms`. */
export function withTimeout<T>(p: Promise<T>, ms: number, timers: KeepAliveTimers = realTimers): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let done = false;
    const h = timers.setTimeout(() => {
      if (done) return;
      done = true;
      reject(new Error('timeout'));
    }, ms);
    p.then(
      (v) => {
        if (done) return;
        done = true;
        timers.clearTimeout(h);
        resolve(v);
      },
      (e: unknown) => {
        if (done) return;
        done = true;
        timers.clearTimeout(h);
        reject(e instanceof Error ? e : new Error(String(e)));
      },
    );
  });
}

/** What the keep-alive follows: the session's active TV, its driver and last reported state. */
export interface KeepAliveTarget {
  subscribe(cb: () => void): () => void;
  activeDriver(): TvDriver | null;
  getSnapshot(): { activeId: string | null; state?: ConnectionState | null };
}

export interface KeepAliveOptions {
  timers?: KeepAliveTimers;
  /** Time between pings while the link is up. */
  intervalMs?: number;
  /** A ping that has not answered after this long is a miss. */
  timeoutMs?: number;
  /** Consecutive misses before onDead(). */
  maxMisses?: number;
  pingFor?: (driver: TvDriver) => Ping | null;
  /** The link looks dead: the caller reconnects (Reconnector.onLinkLost). */
  onDead?: (tvId: string | null) => void;
}

export const KEEP_ALIVE_INTERVAL_MS = 20_000;
export const KEEP_ALIVE_TIMEOUT_MS = 4_000;
export const KEEP_ALIVE_MAX_MISSES = 2;

export class KeepAlive {
  private readonly timers: KeepAliveTimers;
  private readonly intervalMs: number;
  private readonly timeoutMs: number;
  private readonly maxMisses: number;
  private readonly pingFor: (driver: TvDriver) => Ping | null;
  private readonly onDead: (tvId: string | null) => void;

  private tvId: string | null = null;
  private driver: TvDriver | null = null;
  private ping: Ping | null = null;
  private unsubDriver: (() => void) | null = null;
  private unsubTarget: (() => void) | null = null;
  private up = false;
  private paused = false;
  private timer: unknown = null;
  private inFlight = false;
  private misses = 0;
  /** Bumped whenever pinging stops, so a late ping result is ignored. */
  private gen = 0;
  /** Pings sent (diagnostics and tests). */
  pings = 0;

  constructor(opts: KeepAliveOptions = {}) {
    this.timers = opts.timers ?? realTimers;
    this.intervalMs = opts.intervalMs ?? KEEP_ALIVE_INTERVAL_MS;
    this.timeoutMs = opts.timeoutMs ?? KEEP_ALIVE_TIMEOUT_MS;
    this.maxMisses = Math.max(1, opts.maxMisses ?? KEEP_ALIVE_MAX_MISSES);
    this.pingFor = opts.pingFor ?? keepAlivePing;
    this.onDead = opts.onDead ?? (() => {});
  }

  /** True while a ping is scheduled or in flight. */
  isRunning(): boolean {
    return this.timer !== null || this.inFlight;
  }

  bind(target: KeepAliveTarget): () => void {
    this.unsubTarget?.();
    const sync = () => {
      const snap = target.getSnapshot();
      this.setTarget(snap.activeId, target.activeDriver(), snap.state ?? null);
    };
    this.unsubTarget = target.subscribe(sync);
    sync();
    return () => {
      this.unsubTarget?.();
      this.unsubTarget = null;
      this.setTarget(null, null, null);
    };
  }

  /** Follow a TV/driver; `state` is its last known connection state (pings start when 'connected'). */
  setTarget(tvId: string | null, driver: TvDriver | null, state: ConnectionState | null = null): void {
    if (driver === this.driver && tvId === this.tvId) return;
    this.stop();
    this.unsubDriver?.();
    this.unsubDriver = null;
    this.tvId = tvId;
    this.driver = driver;
    this.ping = driver ? this.pingFor(driver) : null;
    this.up = state === 'connected';
    this.misses = 0;
    if (driver && this.ping) {
      this.unsubDriver = driver.on((e) => {
        if (e.type !== 'state') return;
        const was = this.up;
        this.up = e.state === 'connected';
        if (this.up && !was) {
          this.misses = 0;
          this.start();
        } else if (!this.up) this.stop();
      });
    }
    this.start();
  }

  /** App went to the background: no pings until resume(). */
  pause(): void {
    this.paused = true;
    this.stop();
  }

  /** Back in the foreground: restart the interval (the Reconnector does the immediate probe). */
  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this.start();
  }

  dispose(): void {
    this.stop();
    this.unsubDriver?.();
    this.unsubDriver = null;
    this.unsubTarget?.();
    this.unsubTarget = null;
    this.driver = null;
    this.ping = null;
  }

  private start(): void {
    if (this.timer !== null || this.inFlight) return;
    if (!this.ping || !this.up || this.paused) return;
    this.schedule();
  }

  private schedule(): void {
    const gen = this.gen;
    this.timer = this.timers.setTimeout(() => {
      this.timer = null;
      if (gen !== this.gen) return;
      void this.tick();
    }, this.intervalMs);
  }

  private stop(): void {
    this.gen += 1;
    this.inFlight = false;
    if (this.timer !== null) {
      this.timers.clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private async tick(): Promise<void> {
    const ping = this.ping;
    if (!ping || !this.up || this.paused) return;
    const gen = this.gen;
    this.inFlight = true;
    this.pings += 1;
    let ok = true;
    try {
      await withTimeout(ping(), this.timeoutMs, this.timers);
    } catch {
      ok = false;
    }
    if (gen !== this.gen) return; // stopped meanwhile
    this.inFlight = false;
    if (ok) {
      this.misses = 0;
      this.schedule();
      return;
    }
    this.misses += 1;
    if (this.misses >= this.maxMisses) {
      this.misses = 0;
      this.up = false; // wait for the driver to report 'connected' again
      this.stop();
      this.onDead(this.tvId);
      return;
    }
    this.schedule();
  }
}
