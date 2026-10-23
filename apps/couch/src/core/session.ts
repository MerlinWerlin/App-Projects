import { t } from '../i18n/core';
import type { TvDriver } from './driver';
import type { Key } from './keys';
import { DriverError, type Capability, type ConnectionState, type Tv } from './types';

/**
 * App-wide remote session: the list of TVs, which one is active, and its driver.
 * Pure TS so it is unit-tested in Node; the React layer (src/state/session.tsx)
 * only subscribes to it. Every control goes through `send*`, which never throws:
 * errors become `lastError` so the UI can show them without crashing.
 */
export interface SessionSnapshot {
  tvs: Tv[];
  activeId: string | null;
  demo: boolean;
  lastMs: number | null;
  lastError: string | null;
  /** Last connection state reported by the active driver ('off' after power off). */
  state: ConnectionState | null;
  /**
   * A reconnect run is in progress for the active TV (T70): the header pill says "Reconnecting…"
   * and key presses are held (see holdKeys). False during a silent foreground probe.
   */
  reconnecting: boolean;
  /** Bumps on every change so React can cheaply detect updates. */
  rev: number;
}

/** Injected timers for the held-key expiry (tests use a fake clock). */
export interface SessionTimers {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface SessionOptions {
  timers?: SessionTimers;
  /** Held key presses older than this are dropped instead of sent late. */
  holdMs?: number;
  /** At most this many held presses; the oldest is dropped first. */
  maxHeld?: number;
}

/** 'probing': silent foreground check; 'reconnecting': a visible reconnect run. Both hold keys. */
export type KeyHold = 'none' | 'probing' | 'reconnecting';

export const KEY_HOLD_MS = 2000;
export const KEY_HOLD_MAX = 16;

interface HeldKey {
  key: Key;
  at: number;
  resolve: (ok: boolean) => void;
}

const realTimers: SessionTimers = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
};

export class RemoteSession {
  private tvs: Tv[] = [];
  private drivers = new Map<string, TvDriver>();
  private activeId: string | null = null;
  private demo = false;
  private lastMs: number | null = null;
  private lastError: string | null = null;
  private state: ConnectionState | null = null;
  private rev = 0;
  private subs = new Set<() => void>();
  private snap: SessionSnapshot;
  private unsubDriver: (() => void) | null = null;
  private readonly timers: SessionTimers;
  private readonly holdMs: number;
  private readonly maxHeld: number;
  private hold: KeyHold = 'none';
  private held: HeldKey[] = [];
  private holdTimer: unknown = null;
  /** Set while held keys are being sent, so new presses queue behind them (order is kept). */
  private flushing: Promise<void> | null = null;

  constructor(
    private readonly now: () => number = () => Date.now(),
    opts: SessionOptions = {},
  ) {
    this.timers = opts.timers ?? realTimers;
    this.holdMs = opts.holdMs ?? KEY_HOLD_MS;
    this.maxHeld = opts.maxHeld ?? KEY_HOLD_MAX;
    this.snap = this.makeSnap();
  }

  private makeSnap(): SessionSnapshot {
    return {
      tvs: this.tvs,
      activeId: this.activeId,
      demo: this.demo,
      lastMs: this.lastMs,
      lastError: this.lastError,
      state: this.state,
      reconnecting: this.hold === 'reconnecting',
      rev: this.rev,
    };
  }

  private changed(): void {
    this.rev += 1;
    this.snap = this.makeSnap();
    for (const s of this.subs) s();
  }

  subscribe(cb: () => void): () => void {
    this.subs.add(cb);
    return () => {
      this.subs.delete(cb);
    };
  }

  /** Stable between changes (safe for React useSyncExternalStore). */
  getSnapshot(): SessionSnapshot {
    return this.snap;
  }

  /** Replace all TVs (e.g. entering or leaving demo mode). */
  load(tvs: Tv[], drivers: Map<string, TvDriver>, opts: { demo: boolean }): void {
    this.tvs = [...tvs];
    this.drivers = new Map(drivers);
    this.demo = opts.demo;
    this.lastError = null;
    this.lastMs = null;
    this.select(tvs[0]?.id ?? null, true);
  }

  /**
   * Adds (or replaces, by id) one TV with its driver and makes it active. Used by the add-TV flow.
   * Keeps the demo flag as is, so a TV added while in demo mode joins the demo list.
   */
  add(tv: Tv, driver: TvDriver): void {
    const i = this.tvs.findIndex((t) => t.id === tv.id);
    this.tvs = i >= 0 ? this.tvs.map((t, n) => (n === i ? { ...tv } : t)) : [...this.tvs, { ...tv }];
    const drivers = new Map(this.drivers);
    drivers.set(tv.id, driver);
    this.drivers = drivers;
    this.select(tv.id);
  }

  select(id: string | null, silent = false): void {
    if (id !== null && !this.drivers.has(id)) return;
    if (id !== this.activeId) this.dropHeld();
    this.unsubDriver?.();
    this.unsubDriver = null;
    this.activeId = id;
    this.state = null;
    const d = this.activeDriver();
    if (d) {
      this.unsubDriver = d.on((e) => {
        if (e.type === 'sent') {
          this.lastMs = e.ms;
          this.lastError = null;
          this.changed();
        } else if (e.type === 'state') {
          this.state = e.state;
          this.changed();
        } else if (e.type === 'error') {
          // A reconnect (or probe) in progress reports its own outcome: no toast per failed attempt.
          if (this.hold !== 'none') return;
          this.lastError = e.message;
          this.changed();
        }
      });
    }
    if (!silent) this.lastError = null;
    this.changed();
  }

  activeTv(): Tv | null {
    return this.tvs.find((t) => t.id === this.activeId) ?? null;
  }

  activeDriver(): TvDriver | null {
    return this.activeId ? (this.drivers.get(this.activeId) ?? null) : null;
  }

  /** True when the active TV's driver has this capability (drives what the remote shows). */
  can(cap: Capability): boolean {
    return this.activeDriver()?.capabilities.has(cap) ?? false;
  }

  /** Run any driver call with the same never-throw error handling as sendKey (for sheets: inputs, icons, voice). */
  exec(fn: (d: TvDriver) => Promise<void>): Promise<boolean> {
    return this.run(fn);
  }

  private async run(fn: (d: TvDriver) => Promise<void>): Promise<boolean> {
    const d = this.activeDriver();
    if (!d) {
      this.lastError = t('core.session.noTv');
      this.changed();
      return false;
    }
    try {
      await fn(d);
      return true;
    } catch (e) {
      this.lastError = describeError(e);
      this.changed();
      return false;
    }
  }

  sendKey(key: Key): Promise<boolean> {
    if (this.hold !== 'none' && this.activeDriver()) return this.holdKey(key);
    if (this.flushing) return this.flushing.then(() => this.sendKey(key));
    return this.run((d) => d.sendKey(key));
  }

  /** Current key hold (see holdKeys). */
  keyHold(): KeyHold {
    return this.hold;
  }

  /** Number of held key presses (tests, diagnostics). */
  heldCount(): number {
    return this.held.length;
  }

  /**
   * T70: while the link is being checked or re-established, key presses are held for up to
   * holdMs (2 s) instead of failing, then sent in order by releaseKeys(true). Older presses are
   * dropped: a "down" pressed 10 s ago must not move the cursor now. Driver error events are not
   * shown while holding (one reconnect = no toast storm).
   */
  holdKeys(mode: Exclude<KeyHold, 'none'>): void {
    if (this.hold === mode) return;
    const was = this.hold === 'reconnecting';
    this.hold = mode;
    if (was !== (mode === 'reconnecting')) this.changed();
  }

  /** End the hold: ok sends the held presses still fresh (oldest first); otherwise drops them all. */
  releaseKeys(ok: boolean): Promise<void> {
    const was = this.hold === 'reconnecting';
    this.hold = 'none';
    if (was) this.changed();
    if (!ok) {
      this.dropHeld();
      return Promise.resolve();
    }
    this.pruneHeld();
    this.clearHoldTimer();
    const batch = this.held;
    this.held = [];
    if (batch.length === 0) return this.flushing ?? Promise.resolve();
    const prev = this.flushing ?? Promise.resolve();
    const p = prev.then(async () => {
      for (const h of batch) {
        // Still fresh when its turn comes? (a slow TV must not replay stale presses)
        if (this.now() - h.at > this.holdMs) {
          h.resolve(false);
          continue;
        }
        h.resolve(await this.run((d) => d.sendKey(h.key)));
      }
    });
    const done = p.then(() => {
      if (this.flushing === done) this.flushing = null;
    });
    this.flushing = done;
    return done;
  }

  /** Show one message (e.g. the reconnector giving up) the same way as a failed control. */
  reportError(message: string): void {
    this.lastError = message;
    this.changed();
  }

  private holdKey(key: Key): Promise<boolean> {
    this.pruneHeld();
    return new Promise<boolean>((resolve) => {
      this.held.push({ key, at: this.now(), resolve });
      while (this.held.length > this.maxHeld) this.held.shift()!.resolve(false);
      this.armHoldTimer();
    });
  }

  private pruneHeld(): void {
    const cutoff = this.now() - this.holdMs;
    while (this.held.length > 0 && this.held[0]!.at < cutoff) this.held.shift()!.resolve(false);
  }

  private armHoldTimer(): void {
    this.clearHoldTimer();
    const first = this.held[0];
    if (!first) return;
    const ms = Math.max(0, first.at + this.holdMs - this.now()) + 1;
    this.holdTimer = this.timers.setTimeout(() => {
      this.holdTimer = null;
      this.pruneHeld();
      this.armHoldTimer();
    }, ms);
  }

  private clearHoldTimer(): void {
    if (this.holdTimer === null) return;
    this.timers.clearTimeout(this.holdTimer);
    this.holdTimer = null;
  }

  private dropHeld(): void {
    this.clearHoldTimer();
    const batch = this.held;
    this.held = [];
    for (const h of batch) h.resolve(false);
  }

  sendText(text: string): Promise<boolean> {
    return this.run((d) => d.sendText(text));
  }

  launchApp(appId: string): Promise<boolean> {
    return this.run((d) => d.launchApp(appId));
  }

  clearError(): void {
    if (this.lastError === null) return;
    this.lastError = null;
    this.changed();
  }
}

/**
 * The toast text for a failed control. Codes with one generic meaning map to a session key; for
 * forbidden / unsupported / network the driver's own message is shown, which is already translated
 * (drivers build it with driverError(code, 'core.driver.*') from src/core/drivers/errors.ts).
 * A non-DriverError's message is diagnostic English and only reaches here from a programming error.
 */
export function describeError(e: unknown): string {
  if (e instanceof DriverError) {
    switch (e.code) {
      case 'tv_off':
        return t('core.session.tvOff');
      case 'not_connected':
        return t('core.session.notConnected');
      case 'pair_required':
        return t('core.session.pairAgain');
      case 'forbidden':
        return e.message;
      case 'timeout':
        return t('core.session.timeout');
      case 'unsupported':
        return e.message || t('core.session.unsupported');
      default:
        return e.message || t('core.session.network');
    }
  }
  return e instanceof Error ? e.message : String(e);
}
