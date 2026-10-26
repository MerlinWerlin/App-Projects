/**
 * CastSession (T76): one cast to one renderer.
 *
 *   idle -> loading -> playing <-> paused -> stopped
 *                 \-> error  (load failed, never started, or lost contact)
 *
 * load() sends SetAVTransportURI + Play, then polls GetTransportInfo / GetPositionInfo on an
 * injected timer until the renderer reports PLAYING (or PAUSED_PLAYBACK). Renderers often report
 * STOPPED or TRANSITIONING for a moment after Play, so while loading those only count against
 * loadTimeoutMs; once playback has been seen, STOPPED / NO_MEDIA_PRESENT ends the session.
 *
 * Photos have no timeline and many renderers report STOPPED while showing one, so a photo goes
 * straight to 'playing' after Play succeeds and is not polled.
 *
 * Pure TypeScript, tested with fakes only; never tested on a real TV.
 */
import { asDriverError, driverError } from '../drivers/errors';
import type { DriverError } from '../types';
import type { AvTransport } from './avTransport';
import type { CastMedia } from './didl';

export type CastState = 'idle' | 'loading' | 'playing' | 'paused' | 'stopped' | 'error';

export interface CastSnapshot {
  state: CastState;
  media: CastMedia | null;
  positionSec: number | null;
  durationSec: number | null;
  /** Translated message of the error that put the session in 'error'. */
  error: string | null;
  errorCode: DriverError['code'] | null;
  /**
   * True once the TV itself reported that it is showing the media (renderer state PLAYING or
   * PAUSED_PLAYBACK). A successful SetAVTransportURI + Play only means the TV accepted the URL; it
   * may still fail to fetch the file from the phone (owner TestFlight 1.0.1 test, 25 Oct 2026), so
   * the Cast tab says "sent, waiting for the TV" until this is true. Absent = unknown (demo, Roku).
   */
  confirmed?: boolean;
}

export interface CastTimer {
  setInterval(cb: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
  now(): number;
}

export interface CastSessionOptions {
  pollMs?: number;
  loadTimeoutMs?: number;
  /** Consecutive failed polls before the session gives up with 'error'. */
  maxPollFailures?: number;
}

export const SYSTEM_TIMER: CastTimer = {
  setInterval: (cb, ms) => setInterval(cb, ms),
  clearInterval: (h) => clearInterval(h as ReturnType<typeof setInterval>),
  now: () => Date.now(),
};

const INITIAL: CastSnapshot = {
  state: 'idle',
  media: null,
  positionSec: null,
  durationSec: null,
  error: null,
  errorCode: null,
};

export class CastSession {
  private snap: CastSnapshot = INITIAL;
  private subs = new Set<(s: CastSnapshot) => void>();
  private poller: unknown = null;
  private polling = false;
  private failures = 0;
  private seenPlayback = false;
  private loadStartedAt = 0;
  private gen = 0;
  private disposed = false;
  private readonly pollMs: number;
  private readonly loadTimeoutMs: number;
  private readonly maxPollFailures: number;

  constructor(
    private readonly transport: AvTransport,
    private readonly timer: CastTimer = SYSTEM_TIMER,
    opts: CastSessionOptions = {},
  ) {
    this.pollMs = opts.pollMs ?? 1000;
    this.loadTimeoutMs = opts.loadTimeoutMs ?? 20_000;
    this.maxPollFailures = opts.maxPollFailures ?? 3;
  }

  get snapshot(): CastSnapshot {
    return this.snap;
  }

  /** Subscribe to snapshot changes; returns an unsubscribe function. */
  subscribe(cb: (s: CastSnapshot) => void): () => void {
    this.subs.add(cb);
    return () => {
      this.subs.delete(cb);
    };
  }

  /** Starts casting `media`. Never throws: failures land in snapshot.state === 'error'. */
  async load(media: CastMedia): Promise<CastSnapshot> {
    if (this.disposed) return this.snap;
    const gen = ++this.gen;
    this.stopPolling();
    this.seenPlayback = false;
    this.failures = 0;
    this.loadStartedAt = this.timer.now();
    this.set({
      state: 'loading',
      media,
      positionSec: null,
      durationSec: media.kind === 'video' && media.durationSec !== undefined ? media.durationSec : null,
      error: null,
      errorCode: null,
      confirmed: false,
    });
    try {
      await this.transport.setUri(media);
      if (gen !== this.gen) return this.snap;
      await this.transport.play();
      if (gen !== this.gen) return this.snap;
    } catch (e) {
      if (gen === this.gen) this.fail(asDriverError(e));
      return this.snap;
    }
    if (media.kind === 'photo') {
      // Photos have no timeline: show them as on the TV, but keep polling (up to loadTimeoutMs) for
      // the renderer to confirm it is showing the picture. STOPPED / NO_MEDIA_PRESENT never end a photo.
      this.seenPlayback = true;
      this.set({ state: 'playing' });
    }
    this.startPolling();
    return this.snap;
  }

  async pause(): Promise<void> {
    this.require(['playing'], 'video');
    await this.transport.pause();
    this.set({ state: 'paused' });
  }

  async resume(): Promise<void> {
    this.require(['paused'], 'video');
    await this.transport.play();
    this.set({ state: 'playing' });
  }

  /** Seeks to an absolute position (clamped to 0..duration when the duration is known). */
  async seek(seconds: number): Promise<void> {
    this.require(['playing', 'paused'], 'video');
    const dur = this.snap.durationSec;
    let target = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
    if (dur !== null && dur > 0) target = Math.min(target, Math.floor(dur));
    await this.transport.seek(target);
    this.set({ positionSec: target });
  }

  /** Stops playback on the TV. A no-op when nothing is cast. */
  async stop(): Promise<void> {
    const s = this.snap.state;
    if (s === 'idle' || s === 'stopped') return;
    this.gen += 1; // a load still in flight must not resurrect the session
    this.stopPolling();
    try {
      await this.transport.stop();
    } finally {
      this.set({ state: 'stopped' });
    }
  }

  /** Stops polling and drops subscribers. Does not send Stop to the TV. */
  dispose(): void {
    this.disposed = true;
    this.gen += 1;
    this.stopPolling();
    this.subs.clear();
  }

  /** One poll (exposed for tests and for a manual refresh). */
  async poll(): Promise<void> {
    if (this.polling || this.disposed) return;
    const gen = this.gen;
    this.polling = true;
    try {
      const info = await this.transport.getTransportInfo();
      if (gen !== this.gen) return;
      const state = info.state.toUpperCase();
      if (this.snap.media?.kind === 'photo') {
        if (state === 'PLAYING' || state === 'PAUSED_PLAYBACK') {
          this.stopPolling();
          this.set({ confirmed: true });
        } else if (this.timer.now() - this.loadStartedAt >= this.loadTimeoutMs) {
          this.stopPolling(); // stays unconfirmed; the Cast tab explains what to check
        }
        this.failures = 0;
        return;
      }
      if (state === 'PLAYING' || state === 'PAUSED_PLAYBACK') {
        this.seenPlayback = true;
        const pos = await this.transport.getPositionInfo();
        if (gen !== this.gen) return;
        const patch: Partial<CastSnapshot> = { state: state === 'PLAYING' ? 'playing' : 'paused', confirmed: true };
        if (pos.positionSec !== null) patch.positionSec = pos.positionSec;
        if (pos.durationSec !== null && pos.durationSec > 0) patch.durationSec = pos.durationSec;
        this.set(patch);
      } else if ((state === 'STOPPED' || state === 'NO_MEDIA_PRESENT') && this.seenPlayback) {
        this.stopPolling();
        this.set({ state: 'stopped' });
      } else if (!this.seenPlayback && this.timer.now() - this.loadStartedAt >= this.loadTimeoutMs) {
        this.fail(driverError('timeout', 'core.driver.cast.loadTimeout'));
      }
      this.failures = 0;
    } catch (e) {
      if (gen !== this.gen) return;
      this.failures += 1;
      if (this.failures >= this.maxPollFailures) {
        if (this.snap.media?.kind === 'photo') this.stopPolling();
        else this.fail(asDriverError(e));
      }
    } finally {
      this.polling = false;
    }
  }

  private require(states: CastState[], kind?: CastMedia['kind']): void {
    if (!states.includes(this.snap.state) || (kind && this.snap.media?.kind !== kind)) {
      throw driverError('unsupported', 'core.driver.cast.notNow');
    }
  }

  private fail(e: DriverError): void {
    this.stopPolling();
    this.set({ state: 'error', error: e.message, errorCode: e.code });
  }

  private startPolling(): void {
    this.stopPolling();
    this.poller = this.timer.setInterval(() => {
      void this.poll();
    }, this.pollMs);
  }

  private stopPolling(): void {
    if (this.poller !== null) {
      this.timer.clearInterval(this.poller);
      this.poller = null;
    }
  }

  private set(patch: Partial<CastSnapshot>): void {
    const next = { ...this.snap, ...patch };
    const keys = Object.keys(next) as (keyof CastSnapshot)[];
    if (keys.every((k) => next[k] === this.snap[k])) return;
    this.snap = next;
    for (const cb of [...this.subs]) cb(next);
  }
}
