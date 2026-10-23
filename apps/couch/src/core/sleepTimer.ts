/**
 * Sleep timer (T72, docs/MARKET.md gap): turn the TV off after 15 / 30 / 45 / 60 / 90 minutes.
 * Free like every TV control (no Couch Plus check anywhere in this file).
 *
 * Pure TS: the clock, timers, storage and the key sender are injected, so it is unit-tested with a
 * fake clock. The end time is persisted (SLEEP_TIMER_KEY) so a running timer survives app restarts.
 *
 * Firing: at expiry the timer sends SLEEP_KEY (Power) exactly once and clears itself.
 * Phones pause apps in the background, so when the app is backgrounded at expiry nothing is sent
 * then; on the next foreground (or the next start) the key is sent only if the timer ended at most
 * SLEEP_GRACE_MS ago. Later than that, it is dropped and the snapshot carries a 'missed' notice so
 * the screen can tell the user (switching the TV on/off long after bedtime would be wrong: Power
 * toggles on most TVs).
 */
import type { Key } from './keys';
import type { KvStore } from './store';

export const SLEEP_PRESETS = [15, 30, 45, 60, 90] as const;
export type SleepPreset = (typeof SLEEP_PRESETS)[number];

export const SLEEP_TIMER_KEY = 'couch.sleepTimer.v1';
/** A timer that ended while the app was away fires on return only within this window. */
export const SLEEP_GRACE_MS = 2 * 60_000;
/** The key sent at expiry. Couch has no discrete power-off key, so this is Power. */
export const SLEEP_KEY: Key = 'POWER';
/** Longest single wait; long waits are re-checked in steps (avoids long-timer warnings and drift). */
export const SLEEP_CHECK_MAX_MS = 60_000;

const MINUTE = 60_000;

export function isSleepPreset(v: unknown): v is SleepPreset {
  return typeof v === 'number' && (SLEEP_PRESETS as readonly number[]).includes(v);
}

/** What is stored: when the timer ends and which preset started it. */
export interface SleepTimerDoc {
  endsAt: number;
  minutes: SleepPreset;
}

export function parseSleepDoc(raw: string | null | undefined): SleepTimerDoc | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    if (typeof v !== 'object' || v === null) return null;
    const o = v as Record<string, unknown>;
    if (typeof o['endsAt'] !== 'number' || !Number.isFinite(o['endsAt']) || !isSleepPreset(o['minutes'])) return null;
    return { endsAt: o['endsAt'], minutes: o['minutes'] };
  } catch {
    return null;
  }
}

/** Something the screen should tell the user once (cleared with dismissNotice). */
export type SleepNotice = { kind: 'fired'; at: number } | { kind: 'missed'; endsAt: number };

export interface SleepSnapshot {
  /** False until load() has read the stored timer. */
  loaded: boolean;
  /** End time (epoch ms) of the running timer, or null when off. */
  endsAt: number | null;
  /** Preset of the running timer, or null when off. */
  minutes: SleepPreset | null;
  notice: SleepNotice | null;
}

export interface SleepTimers {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface SleepTimerDeps {
  kv: KvStore;
  /** Sends a key to the TV. Errors and rejections are swallowed. */
  send: (key: Key) => unknown;
  now?: () => number;
  timers?: SleepTimers;
  /** Whether the app starts in the foreground (default true). */
  active?: boolean;
}

/** Remaining time for display: whole minutes (rounded up) above a minute, else seconds. */
export function sleepRemainingParts(ms: number): { unit: 'minutes' | 'seconds'; count: number } {
  const m = Math.max(0, Number.isFinite(ms) ? ms : 0);
  if (m > MINUTE) return { unit: 'minutes', count: Math.ceil(m / MINUTE) };
  return { unit: 'seconds', count: Math.ceil(m / 1000) };
}

export type SleepCheck = 'off' | 'waiting' | 'fired' | 'missed';

export class SleepTimer {
  private readonly kv: KvStore;
  private readonly send: (key: Key) => unknown;
  private readonly now: () => number;
  private readonly timers: SleepTimers;
  private active: boolean;
  private doc: SleepTimerDoc | null = null;
  private handle: unknown = null;
  private snap: SleepSnapshot = { loaded: false, endsAt: null, minutes: null, notice: null };
  private readonly listeners = new Set<() => void>();
  private loading: Promise<void> | null = null;
  /** Serialises storage writes so a quick start-then-cancel lands in order. */
  private writes: Promise<void> = Promise.resolve();

  constructor(deps: SleepTimerDeps) {
    this.kv = deps.kv;
    this.send = deps.send;
    this.now = deps.now ?? (() => Date.now());
    this.timers = deps.timers ?? {
      setTimeout: (fn, ms) => setTimeout(fn, ms),
      clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
    };
    this.active = deps.active ?? true;
  }

  /** Reads the stored timer (once) and resumes, fires or drops it. */
  load(): Promise<void> {
    if (!this.loading) {
      this.loading = (async () => {
        let raw: string | null = null;
        try {
          raw = await this.kv.getItem(SLEEP_TIMER_KEY);
        } catch {
          raw = null;
        }
        // A start() during the read wins over what was stored.
        if (!this.snap.loaded && this.doc === null) this.doc = parseSleepDoc(raw);
        this.snap = { ...this.snap, loaded: true };
        this.check();
        this.emit();
      })();
    }
    return this.loading;
  }

  /** Starts (or restarts) the timer for one of the presets. */
  start(minutes: SleepPreset): Promise<void> {
    if (!isSleepPreset(minutes)) return Promise.resolve();
    this.doc = { endsAt: this.now() + minutes * MINUTE, minutes };
    this.snap = { ...this.snap, loaded: true, notice: null };
    const w = this.persist();
    this.check();
    this.emit();
    return w;
  }

  /** Turns the timer off without sending anything. */
  cancel(): Promise<void> {
    this.clearHandle();
    if (this.doc === null) return this.writes;
    this.doc = null;
    const w = this.persist();
    this.emit();
    return w;
  }

  /** Milliseconds left, or null when off. Never negative. */
  remainingMs(at: number = this.now()): number | null {
    return this.doc ? Math.max(0, this.doc.endsAt - at) : null;
  }

  /** App moved to the foreground (true) or background (false). Foreground re-checks expiry. */
  setActive(active: boolean): void {
    this.active = active;
    if (active) this.check();
  }

  dismissNotice(): void {
    if (!this.snap.notice) return;
    this.snap = { ...this.snap, notice: null };
    this.emit();
  }

  subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  getSnapshot(): SleepSnapshot {
    return this.snap;
  }

  /** Stops the internal timer (the stored end time is kept). */
  dispose(): void {
    this.clearHandle();
    this.listeners.clear();
  }

  /** Waits, fires or drops the timer depending on the clock and app state. */
  check(): SleepCheck {
    this.clearHandle();
    const doc = this.doc;
    if (!doc) return 'off';
    const now = this.now();
    if (now < doc.endsAt) {
      this.schedule(Math.min(doc.endsAt - now, SLEEP_CHECK_MAX_MS));
      return 'waiting';
    }
    // Expired while backgrounded: decide on the next foreground.
    if (!this.active) return 'waiting';
    // Clear first (synchronously) so the key is sent exactly once.
    this.doc = null;
    void this.persist();
    if (now - doc.endsAt <= SLEEP_GRACE_MS) {
      try {
        const r = this.send(SLEEP_KEY);
        if (r && typeof (r as Promise<unknown>).catch === 'function') (r as Promise<unknown>).catch(() => {});
      } catch {
        // A failing send never leaves the timer armed.
      }
      this.snap = { ...this.snap, notice: { kind: 'fired', at: now } };
      this.emit();
      return 'fired';
    }
    this.snap = { ...this.snap, notice: { kind: 'missed', endsAt: doc.endsAt } };
    this.emit();
    return 'missed';
  }

  private schedule(ms: number): void {
    this.handle = this.timers.setTimeout(() => {
      this.handle = null;
      this.check();
    }, ms);
  }

  private clearHandle(): void {
    if (this.handle !== null) this.timers.clearTimeout(this.handle);
    this.handle = null;
  }

  private persist(): Promise<void> {
    const value = this.doc ? JSON.stringify(this.doc) : 'null';
    this.writes = this.writes.then(() => this.kv.setItem(SLEEP_TIMER_KEY, value)).catch(() => {});
    return this.writes;
  }

  private emit(): void {
    const next: SleepSnapshot = {
      ...this.snap,
      endsAt: this.doc?.endsAt ?? null,
      minutes: this.doc?.minutes ?? null,
    };
    this.snap = next;
    for (const cb of [...this.listeners]) {
      try {
        cb();
      } catch {
        // A broken listener never stops the timer.
      }
    }
  }
}
