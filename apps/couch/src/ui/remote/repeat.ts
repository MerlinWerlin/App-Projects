/**
 * Hold-to-repeat schedule for the remote's rocker, transport and arrow keys (premium polish P2, T39;
 * extended to every rocker, transport key and d-pad arrow in T72).
 * Pure TS (no React Native) so it is unit-tested in Node.
 *
 * Holding a rocker half: nothing extra for REPEAT_DELAY ms (a tap stays one key), then the key
 * repeats every REPEAT_START ms, speeding up linearly to REPEAT_FAST ms by step REPEAT_ACCEL_STEPS,
 * and stops on release, on unmount, or after REPEAT_MAX_STEPS steps (safety cap).
 */

import type { Key } from '../../core/keys';

/**
 * Keys that repeat while held (T72): the volume and channel rockers, rewind / fast-forward and the
 * four d-pad arrows. Everything else (Power, OK, Home, Back, Mute, Menu, play/pause, digits, colour
 * keys, ...) sends exactly one key per press however long it is held.
 */
export const REPEAT_KEYS: ReadonlySet<Key> = new Set<Key>([
  'VOL_UP',
  'VOL_DOWN',
  'CH_UP',
  'CH_DOWN',
  'REW',
  'FF',
  'UP',
  'DOWN',
  'LEFT',
  'RIGHT',
]);

/** Keys that must never repeat, even if REPEAT_KEYS grows by mistake (asserted in tests). */
export const NEVER_REPEAT_KEYS: ReadonlySet<Key> = new Set<Key>(['POWER', 'OK', 'HOME', 'BACK', 'MUTE']);

/** Whether holding this key repeats it. */
export function repeatsOnHold(key: Key): boolean {
  return REPEAT_KEYS.has(key) && !NEVER_REPEAT_KEYS.has(key);
}

/** Wait before the first repeat. */
export const REPEAT_DELAY = 400;
/** Interval after the first repeat. */
export const REPEAT_START = 110;
/** Fastest interval, reached at step REPEAT_ACCEL_STEPS. */
export const REPEAT_FAST = 70;
export const REPEAT_ACCEL_STEPS = 8;
/** Safety cap: a stuck press never sends more than this many repeats. */
export const REPEAT_MAX_STEPS = 60;

/**
 * Delay before the next repeat, given how many repeats have already fired.
 * 0 -> REPEAT_DELAY; 1 -> REPEAT_START; ... REPEAT_ACCEL_STEPS and later -> REPEAT_FAST.
 */
export function delayForStep(step: number): number {
  const s = Math.max(0, Math.floor(Number.isFinite(step) ? step : 0));
  if (s === 0) return REPEAT_DELAY;
  const k = Math.min(s, REPEAT_ACCEL_STEPS) - 1;
  const span = REPEAT_ACCEL_STEPS - 1;
  return Math.round(REPEAT_START - ((REPEAT_START - REPEAT_FAST) * k) / span);
}

export interface Timers {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

const defaultTimers: Timers = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
};

/**
 * Runs the repeat schedule. start() on press-in, stop() on press-out / unmount.
 * `onStep(n)` is called for each repeat (n = 1, 2, ...). `repeated` tells the release handler
 * whether this press already sent repeats (so it must not also send a tap).
 */
export class RepeatTimer {
  private handle: unknown = null;
  private count = 0;
  private live = false;

  constructor(
    private readonly onStep: (step: number) => void,
    private readonly timers: Timers = defaultTimers,
  ) {}

  /** Number of repeats fired by the current (or last) press. */
  get steps(): number {
    return this.count;
  }

  get repeated(): boolean {
    return this.count > 0;
  }

  get running(): boolean {
    return this.live;
  }

  start(): void {
    this.stop();
    this.count = 0;
    this.live = true;
    this.schedule();
  }

  /** Stops repeating. Keeps `steps`/`repeated` until the next start(). */
  stop(): void {
    if (this.handle !== null) this.timers.clearTimeout(this.handle);
    this.handle = null;
    this.live = false;
  }

  private schedule(): void {
    this.handle = this.timers.setTimeout(() => {
      this.handle = null;
      if (!this.live) return;
      this.count += 1;
      try {
        this.onStep(this.count);
      } catch {
        // A failing send never leaves the timer running.
      }
      if (this.count >= REPEAT_MAX_STEPS) {
        this.stop();
        return;
      }
      if (this.live) this.schedule();
    }, delayForStep(this.count));
  }
}

export interface HoldPressHandlers {
  /** Sends the key once (a tap, or one repeat step). */
  send(): void;
  /** Haptic for a plain tap (played on release when the press did not repeat). */
  tapFeedback(): void;
  /** Haptic tick for each repeat step. */
  repeatFeedback(): void;
}

/**
 * Press logic shared by every remote key (T72). Wire pressIn / pressOut / press to the Pressable.
 * Repeating keys: a tap sends once on release; a hold sends after REPEAT_DELAY and then on the
 * RepeatTimer schedule, each step with a haptic tick, and the release sends nothing more.
 * Other keys: pressIn / pressOut do nothing and press() sends exactly once.
 */
export class HoldPress {
  readonly repeats: boolean;
  private readonly timer: RepeatTimer | null;

  constructor(
    key: Key,
    private readonly handlers: HoldPressHandlers,
    timers: Timers = defaultTimers,
  ) {
    this.repeats = repeatsOnHold(key);
    this.timer = this.repeats
      ? new RepeatTimer(() => {
          this.handlers.repeatFeedback();
          this.handlers.send();
        }, timers)
      : null;
  }

  pressIn(): void {
    this.timer?.start();
  }

  pressOut(): void {
    this.timer?.stop();
  }

  /** The Pressable's onPress (release inside the key). */
  press(): void {
    const r = this.timer;
    r?.stop();
    if (r?.repeated) return;
    this.handlers.tapFeedback();
    this.handlers.send();
  }

  /** Unmount: never leave a repeat running. */
  dispose(): void {
    this.timer?.stop();
  }
}
