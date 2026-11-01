import { t } from '../i18n/core';
import type { DriverEvent, TvDriver } from './driver';
import { isCastOnlyDriver } from './drivers/castOnly';
import { keepAlivePing, withTimeout, type Ping } from './keepAlive';
import type { ConnectionState } from './types';

/**
 * Auto-reconnect with exponential backoff (PLAN positioning #2: persistent socket,
 * auto-reconnect on foreground). Pure TS: timers, clock and jitter are injected so
 * tests run with a fake clock and never really wait.
 *
 * Triggers:
 *  - onForeground() (T70, wake / app switch): if the driver says it is connected and the protocol
 *    has a keep-alive ping (src/core/keepAlive.ts), the TV is probed silently first and only a
 *    failed probe starts a run. Otherwise (or for stateless HTTP drivers after a long background)
 *    a fast run: immediate attempt, then 250 ms, 1 s, 3 s, then the normal schedule below.
 *  - onLinkLost(): the keep-alive missed its pings; fast run.
 *  - the driver reporting 'error' or 'disconnected': backoff starting at the first delay.
 *  - reconnectNow(): user-initiated, resets the attempt counter and tries immediately (fast run).
 * onBackground() cancels everything; nothing runs while the app is in the background.
 */

export interface Timers {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export type ReconnectPhase = 'idle' | 'waiting' | 'connecting' | 'connected' | 'off' | 'gave_up';

export interface ReconnectStatus {
  phase: ReconnectPhase;
  /** Attempts made in the current run (0 when idle/connected). */
  attempt: number;
  /** When the next attempt fires (phase 'waiting'), else null. */
  nextAt: number | null;
  /** Friendly message for the UI (set when giving up). */
  message: string | null;
}

/** What the reconnector needs from the session: the active TV id and its driver. */
export interface ReconnectTarget {
  subscribe(cb: () => void): () => void;
  activeDriver(): TvDriver | null;
  getSnapshot(): { activeId: string | null };
}

export interface ReconnectorOptions {
  timers?: Timers;
  now?: () => number;
  /** Random in [0,1) for jitter; tests inject a constant. */
  random?: () => number;
  /** Backoff schedule in ms; the last value repeats (the cap). */
  delaysMs?: readonly number[];
  /** +/- fraction applied to each delay (0.2 = up to 20% either way). */
  jitter?: number;
  /** Attempts per run before giving up. */
  maxAttempts?: number;
  /** On foreground, skip the reconnect if the driver was connected and we were away for less than this (drivers without a ping). */
  staleAfterMs?: number;
  /**
   * Fast schedule for runs started by foreground / link loss / reconnectNow: entry 0 is the first
   * attempt (always immediate), the rest are the retry delays; after it the normal schedule
   * (delaysMs) starts over from its first value.
   */
  fastDelaysMs?: readonly number[];
  /** Liveness probe for a driver (null = none, e.g. stateless HTTP drivers). Default keepAlivePing. */
  probe?: (driver: TvDriver) => Ping | null;
  /** A probe that has not answered after this long counts as failed. */
  probeTimeoutMs?: number;
}

export const DEFAULT_DELAYS_MS: readonly number[] = [500, 1000, 2000, 4000, 8000, 15000];
export const DEFAULT_MAX_ATTEMPTS = 8;
/** T70: 0 (immediate), 250 ms, 1 s, 3 s, then DEFAULT_DELAYS_MS. */
export const FAST_DELAYS_MS: readonly number[] = [0, 250, 1000, 3000];
export const DEFAULT_PROBE_TIMEOUT_MS = 2500;

export function gaveUpMessage(attempts: number): string {
  return t('core.reconnect.gaveUp', { count: attempts });
}

const realTimers: Timers = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
};

export class Reconnector {
  private readonly timers: Timers;
  private readonly now: () => number;
  private readonly random: () => number;
  private readonly delays: readonly number[];
  private readonly jitter: number;
  private readonly maxAttempts: number;
  private readonly staleAfterMs: number;
  private readonly fastDelays: readonly number[];
  private readonly probeFor: (driver: TvDriver) => Ping | null;
  private readonly probeTimeoutMs: number;

  /** The current run uses the fast schedule. */
  private fast = false;
  private probing = false;
  private lastProbe: 'ok' | 'failed' | 'cancelled' | null = null;
  private driver: TvDriver | null = null;
  private tvId: string | null = null;
  private unsubDriver: (() => void) | null = null;
  private unsubTarget: (() => void) | null = null;
  private driverState: ConnectionState | null = null;
  private foreground = true;
  private backgroundAt: number | null = null;
  private timer: unknown = null;
  private inFlight = false;
  /** Bumped on cancel/switch so a stale in-flight connect() result is ignored. */
  private gen = 0;
  private status: ReconnectStatus = { phase: 'idle', attempt: 0, nextAt: null, message: null };
  private subs = new Set<() => void>();

  constructor(opts: ReconnectorOptions = {}) {
    this.timers = opts.timers ?? realTimers;
    this.now = opts.now ?? (() => Date.now());
    this.random = opts.random ?? Math.random;
    this.delays = opts.delaysMs && opts.delaysMs.length > 0 ? opts.delaysMs : DEFAULT_DELAYS_MS;
    this.jitter = opts.jitter ?? 0.2;
    this.maxAttempts = opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    this.staleAfterMs = opts.staleAfterMs ?? 30_000;
    this.fastDelays = opts.fastDelaysMs ?? FAST_DELAYS_MS;
    this.probeFor = opts.probe ?? keepAlivePing;
    this.probeTimeoutMs = opts.probeTimeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS;
  }

  /** A silent foreground probe is in flight (no status change; the session holds keys meanwhile). */
  isProbing(): boolean {
    return this.probing;
  }

  subscribe(cb: () => void): () => void {
    this.subs.add(cb);
    return () => {
      this.subs.delete(cb);
    };
  }

  getStatus(): ReconnectStatus {
    return this.status;
  }

  /** Attempt number of the current run for this TV (0 when not reconnecting it). */
  attemptFor(tvId: string): number {
    return tvId === this.tvId ? this.status.attempt : 0;
  }

  /** Follow the session's active TV: re-targets whenever the active driver changes. */
  bind(target: ReconnectTarget): () => void {
    this.unsubTarget?.();
    const sync = () => this.setTarget(target.getSnapshot().activeId, target.activeDriver());
    this.unsubTarget = target.subscribe(sync);
    sync();
    return () => {
      this.unsubTarget?.();
      this.unsubTarget = null;
      this.setTarget(null, null);
    };
  }

  /**
   * Point at a TV/driver (null to stop). Switching TVs cancels any pending run. A cast-only TV
   * (src/core/drivers/castOnly.ts) has no link to keep: it is treated like no driver, so nothing
   * ever retries it.
   */
  setTarget(tvId: string | null, target: TvDriver | null): void {
    const driver = isCastOnlyDriver(target) ? null : target;
    if (driver === this.driver && tvId === this.tvId) return;
    this.cancel();
    this.unsubDriver?.();
    this.unsubDriver = null;
    this.driver = driver;
    this.tvId = tvId;
    this.driverState = null;
    if (driver) this.unsubDriver = driver.on((e) => this.onDriverEvent(e));
    this.setStatus({ phase: 'idle', attempt: 0, nextAt: null, message: null });
  }

  onForeground(): void {
    const awayMs = this.backgroundAt === null ? Infinity : this.now() - this.backgroundAt;
    this.foreground = true;
    this.backgroundAt = null;
    if (!this.driver) return;
    if (this.inFlight || this.probing || this.driverState === 'connecting') return;
    if (this.driverState === 'connected') {
      const ping = this.probeFor(this.driver);
      if (ping) {
        void this.runProbe(ping);
        return;
      }
      if (awayMs < this.staleAfterMs) return;
    }
    this.startRun(true);
  }

  /** The keep-alive gave up on the link (missed pings): reconnect now with the fast schedule. */
  onLinkLost(): void {
    if (!this.driver || !this.foreground) return;
    if (this.inFlight || this.status.phase === 'waiting') return;
    this.startRun(true);
  }

  onBackground(): void {
    this.foreground = false;
    this.backgroundAt = this.now();
    this.cancel();
    if (this.status.phase === 'waiting' || this.status.phase === 'connecting') {
      this.setStatus({ phase: 'idle', attempt: 0, nextAt: null, message: null });
    }
  }

  /** User tapped "Reconnect now": fresh run, immediate attempt. */
  reconnectNow(): void {
    if (!this.driver) return;
    this.startRun(true);
  }

  dispose(): void {
    this.cancel();
    this.unsubDriver?.();
    this.unsubDriver = null;
    this.unsubTarget?.();
    this.unsubTarget = null;
    this.subs.clear();
  }

  // --- internals ---

  private onDriverEvent(e: DriverEvent): void {
    if (e.type !== 'state') return;
    this.driverState = e.state;
    if (this.inFlight) return; // our own connect() reports through its promise
    if (e.state === 'connected') {
      this.cancel();
      this.setStatus({ phase: 'connected', attempt: 0, nextAt: null, message: null });
    } else if (e.state === 'off') {
      this.cancel();
      this.setStatus({ phase: 'off', attempt: 0, nextAt: null, message: null });
    } else if ((e.state === 'error' || e.state === 'disconnected') && this.foreground) {
      // Already backing off (or gave up): keep the current schedule.
      if (this.status.phase === 'waiting' || this.status.phase === 'gave_up') return;
      this.fast = false;
      this.setStatus({ phase: 'waiting', attempt: 0, nextAt: null, message: null });
      this.scheduleNext();
    }
  }

  private async runProbe(ping: Ping): Promise<void> {
    this.cancel();
    const gen = this.gen;
    this.setProbing(true);
    let ok = true;
    try {
      await withTimeout(ping(), this.probeTimeoutMs, this.timers);
    } catch {
      ok = false;
    }
    if (gen !== this.gen) return; // cancelled meanwhile (cancel() cleared probing)
    if (ok) {
      this.setProbing(false, 'ok');
      return;
    }
    // Enter the run before the probe flag clears, so listeners never see a gap (held keys survive).
    this.fast = true;
    this.setStatus({ phase: 'connecting', attempt: 0, nextAt: null, message: null });
    this.setProbing(false, 'failed');
    this.startRun(true);
  }

  /** How the last foreground probe ended. */
  probeOutcome(): 'ok' | 'failed' | 'cancelled' | null {
    return this.lastProbe;
  }

  private setProbing(on: boolean, outcome: 'ok' | 'failed' | 'cancelled' = 'cancelled'): void {
    if (this.probing === on) return;
    this.probing = on;
    this.lastProbe = on ? null : outcome;
    for (const cb of this.subs) cb();
  }

  private startRun(fast = false): void {
    this.cancel();
    this.fast = fast;
    this.setStatus({ phase: 'connecting', attempt: 0, nextAt: null, message: null });
    void this.attempt();
  }

  /** Delay before attempt number `n + 1`, given `n` attempts made so far. */
  delayFor(n: number): number {
    const base = this.delays[Math.min(n, this.delays.length - 1)] ?? 0;
    const j = this.jitter > 0 ? (this.random() * 2 - 1) * this.jitter : 0;
    return Math.max(0, Math.round(base * (1 + j)));
  }

  /** Delay before attempt `n + 1` of a fast run: the fast list, then the normal schedule from its start. */
  fastDelayFor(n: number): number {
    const k = this.fastDelays.length;
    if (n < k) {
      const base = this.fastDelays[n] ?? 0;
      const j = this.jitter > 0 && base > 0 ? (this.random() * 2 - 1) * this.jitter : 0;
      return Math.max(0, Math.round(base * (1 + j)));
    }
    return this.delayFor(n - k);
  }

  private scheduleNext(): void {
    const made = this.status.attempt;
    const max = this.fast ? this.fastDelays.length + this.maxAttempts : this.maxAttempts;
    if (made >= max) {
      this.setStatus({ phase: 'gave_up', attempt: made, nextAt: null, message: gaveUpMessage(made) });
      return;
    }
    const ms = this.fast ? this.fastDelayFor(made) : this.delayFor(made);
    const gen = this.gen;
    this.timer = this.timers.setTimeout(() => {
      this.timer = null;
      if (gen !== this.gen) return;
      void this.attempt();
    }, ms);
    this.setStatus({ phase: 'waiting', attempt: made, nextAt: this.now() + ms, message: null });
  }

  private async attempt(): Promise<void> {
    const d = this.driver;
    if (!d || !this.foreground) return;
    const gen = this.gen;
    const n = this.status.attempt + 1;
    this.inFlight = true;
    this.driverState = null; // judge this attempt only by what connect() reports now
    this.setStatus({ phase: 'connecting', attempt: n, nextAt: null, message: null });
    let ok = true;
    try {
      await d.connect();
    } catch {
      ok = false;
    }
    if (gen !== this.gen) return; // cancelled or re-targeted meanwhile (cancel() cleared inFlight)
    this.inFlight = false;
    if (ok && this.driverState !== 'error' && this.driverState !== 'disconnected') {
      const off = this.driverState === 'off';
      this.setStatus({ phase: off ? 'off' : 'connected', attempt: 0, nextAt: null, message: null });
      return;
    }
    this.scheduleNext();
  }

  private cancel(): void {
    this.gen += 1;
    this.inFlight = false;
    this.setProbing(false);
    if (this.timer !== null) {
      this.timers.clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private setStatus(s: ReconnectStatus): void {
    const p = this.status;
    if (p.phase === s.phase && p.attempt === s.attempt && p.nextAt === s.nextAt && p.message === s.message) return;
    this.status = s;
    for (const cb of this.subs) cb();
  }
}
