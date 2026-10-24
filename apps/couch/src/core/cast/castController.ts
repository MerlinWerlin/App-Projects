/**
 * Cast tab controller (cast-1024, T91): ties the target list, the active CastDriver, the CastQueue
 * and the MediaServer together, without React. src/state/cast.tsx builds one with the real
 * dependencies; tests inject fakes.
 *
 * - play(item): stops serving the previous file, serves the new one (or, in demo mode, gives it a
 *   placeholder LAN URL that MockCast accepts), then driver.load().
 * - When a video ends on the TV (the driver goes from playing/paused to 'stopped' without us asking),
 *   the queue moves on (queue.onMediaEnded()).
 * - stop(): stops the TV, the served file and the server.
 *
 * Demo mode (Expo Go, App Review, or the remote in demo mode) uses MockCast and never serves files.
 * Pure TypeScript; nothing here has been tried on a real TV.
 */
import { asDriverError, driverError } from '../drivers/errors';
import type { Tv } from '../types';
import type { CastMedia } from './didl';
import type { CastDriver, CastTarget } from './driver';
import type { MediaServer, ServedFile } from './mediaServer';
import type { QueueItem, QueueSnapshot } from './queueTypes';
import { DEFAULT_SLIDESHOW_INTERVAL } from './queueTypes';
import type { CastSnapshot, CastState } from './session';

/** The CastQueue surface the controller uses (CastQueue from ./queue satisfies it). */
export interface CastQueueLike {
  snapshot(): QueueSnapshot;
  subscribe(l: (s: QueueSnapshot) => void): () => void;
  add(items: QueueItem[]): void;
  remove(id: string): void;
  move(from: number, to: number): void;
  start(index?: number): Promise<void>;
  next(): Promise<void>;
  prev(): Promise<void>;
  setSlideshow(on: boolean): void;
  setIntervalSec(sec: number): void;
  setLoop(on: boolean): void;
  onMediaEnded(): Promise<void>;
  clear(): void;
  dispose(): void;
}

export interface CastControllerDeps {
  /** Real targets for the saved TVs (findCastTargets bound to the app's env). */
  findTargets: (tvs: readonly Tv[]) => Promise<CastTarget[]>;
  createDriver: (target: CastTarget) => CastDriver;
  mockTarget: CastTarget;
  createMock: (target: CastTarget) => CastDriver;
  /** The phone's file server (UNAVAILABLE_MEDIA_SERVER in Expo Go). */
  server: MediaServer;
  createQueue: (play: (item: QueueItem, index: number) => Promise<void>) => CastQueueLike;
}

export interface CastControllerSnapshot {
  /** MockCast instead of a real TV. */
  demo: boolean;
  /** The phone can serve files (false in Expo Go): then demo mode is forced. */
  serverAvailable: boolean;
  targets: readonly CastTarget[];
  searching: boolean;
  targetId: string | null;
  cast: CastSnapshot;
  queue: QueueSnapshot;
  /** Translated message of the last failed command (load, play, seek...). */
  error: string | null;
}

export const IDLE_CAST: CastSnapshot = Object.freeze({
  state: 'idle',
  media: null,
  positionSec: null,
  durationSec: null,
  error: null,
  errorCode: null,
}) as CastSnapshot;

const EMPTY_QUEUE: QueueSnapshot = Object.freeze({
  items: [],
  index: -1,
  slideshow: false,
  intervalSec: DEFAULT_SLIDESHOW_INTERVAL,
  loop: false,
}) as QueueSnapshot;

const ACTIVE: readonly CastState[] = ['loading', 'playing', 'paused'];

/** True while something from the queue is on the TV (the remote's Play/Pause then controls the cast). */
export function isCastActive(queue: QueueSnapshot | null | undefined, cast: CastSnapshot | null | undefined): boolean {
  return !!queue && !!cast && queue.index >= 0 && ACTIVE.includes(cast.state);
}

/** A video finished on the TV by itself: playing/paused -> stopped. */
export function videoEnded(prev: CastSnapshot, next: CastSnapshot): boolean {
  return (prev.state === 'playing' || prev.state === 'paused') && next.state === 'stopped' && next.media?.kind === 'video';
}

/** Placeholder LAN URL for demo mode (MockCast never fetches it). Passes validateMedia. */
export function demoUrl(item: QueueItem): string {
  const safe = item.id.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 64) || 'item';
  return `http://192.168.0.2:8080/demo-${safe}`;
}

export function toCastMedia(item: QueueItem, url: string): CastMedia {
  const media: CastMedia = { url, title: item.title, mime: item.mime, kind: item.kind };
  if (item.durationSec !== undefined) media.durationSec = item.durationSec;
  if (item.sizeBytes !== undefined) media.sizeBytes = item.sizeBytes;
  return media;
}

/** m:ss, or h:mm:ss from an hour. Unknown -> '0:00'. */
export function formatClock(sec: number | null | undefined): string {
  const s = Math.max(0, Math.floor(typeof sec === 'number' && Number.isFinite(sec) ? sec : 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}

/** Position after a relative seek, clamped to 0..duration (when known). */
export function seekTarget(positionSec: number | null, durationSec: number | null, deltaSec: number): number {
  let to = Math.max(0, Math.floor((positionSec ?? 0) + deltaSec));
  if (durationSec !== null && durationSec > 0) to = Math.min(to, Math.floor(durationSec));
  return to;
}

/** What the play/pause button does now. */
export type PlayAction = 'pause' | 'resume' | 'start' | 'pauseSlideshow' | 'resumeSlideshow' | 'none';

export function playAction(q: QueueSnapshot, c: CastSnapshot): PlayAction {
  if (q.items.length === 0) return 'none';
  if (q.index < 0 || !ACTIVE.includes(c.state)) return 'start';
  if (c.media?.kind === 'photo') return q.slideshow ? 'pauseSlideshow' : 'resumeSlideshow';
  if (c.state === 'playing') return 'pause';
  if (c.state === 'paused') return 'resume';
  return 'none';
}

export class CastController {
  private readonly deps: CastControllerDeps;
  private readonly queue: CastQueueLike;
  private snap: CastControllerSnapshot;
  private subs = new Set<(s: CastControllerSnapshot) => void>();
  private driver: CastDriver | null = null;
  private driverUnsub: (() => void) | null = null;
  private served: ServedFile | null = null;
  private stopping = false;
  private sessionDemo = true;
  private tvs: readonly Tv[] = [];
  private searchGen = 0;
  private playGen = 0;
  private disposed = false;
  private queueUnsub: () => void;

  constructor(deps: CastControllerDeps) {
    this.deps = deps;
    this.queue = deps.createQueue((item, index) => this.play(item, index));
    const serverAvailable = deps.server.available;
    this.snap = {
      demo: true,
      serverAvailable,
      targets: [deps.mockTarget],
      searching: false,
      targetId: deps.mockTarget.id,
      cast: IDLE_CAST,
      queue: this.queue.snapshot() ?? EMPTY_QUEUE,
      error: null,
    };
    this.queueUnsub = this.queue.subscribe((q) => this.set({ queue: q }));
  }

  getSnapshot(): CastControllerSnapshot {
    return this.snap;
  }

  subscribe(l: (s: CastControllerSnapshot) => void): () => void {
    this.subs.add(l);
    return () => {
      this.subs.delete(l);
    };
  }

  /** The remote session's TVs and demo flag. Re-searches targets when they change. */
  setContext(ctx: { demo: boolean; tvs: readonly Tv[] }): Promise<void> {
    const same =
      ctx.demo === this.sessionDemo &&
      ctx.tvs.length === this.tvs.length &&
      ctx.tvs.every((tv, i) => tv.id === this.tvs[i]?.id && tv.host === this.tvs[i]?.host);
    this.sessionDemo = ctx.demo;
    this.tvs = ctx.tvs;
    if (same && this.searchGen > 0) return Promise.resolve();
    return this.refresh();
  }

  /** Looks for cast targets again (demo mode: the demo TV only). */
  async refresh(): Promise<void> {
    if (this.disposed) return;
    const gen = ++this.searchGen;
    const demo = this.sessionDemo || !this.deps.server.available;
    if (demo) {
      this.set({ demo: true, targets: [this.deps.mockTarget], searching: false });
      this.selectTarget(this.deps.mockTarget.id);
      return;
    }
    this.set({ demo: false, searching: true });
    let found: CastTarget[] = [];
    try {
      found = await this.deps.findTargets(this.tvs);
    } catch {
      found = [];
    }
    if (gen !== this.searchGen || this.disposed) return;
    this.set({ targets: found, searching: false });
    const keep = found.find((t) => t.id === this.snap.targetId);
    this.selectTarget(keep ? keep.id : (found[0]?.id ?? null));
  }

  /** Switches the TV casts go to. A cast on the previous TV is stopped. */
  selectTarget(id: string | null): void {
    if (this.disposed) return;
    const target = id === null ? null : (this.snap.targets.find((t) => t.id === id) ?? null);
    if (this.driver && target && this.driver.target.id === target.id) {
      if (this.snap.targetId !== target.id) this.set({ targetId: target.id });
      return;
    }
    this.releaseDriver(true);
    if (target) {
      this.driver = target.kind === 'mock' ? this.deps.createMock(target) : this.deps.createDriver(target);
      let prev = this.driver.snapshot();
      this.driverUnsub = this.driver.subscribe((s) => {
        const before = prev;
        prev = s;
        this.set({ cast: s });
        if (!this.stopping && videoEnded(before, s)) void this.queue.onMediaEnded().catch(() => undefined);
      });
      this.set({ targetId: target.id, cast: this.driver.snapshot(), error: null });
    } else {
      this.set({ targetId: null, cast: IDLE_CAST });
    }
  }

  /** Adds picked items; when nothing is on the TV yet, the first new one starts. */
  async addItems(items: QueueItem[]): Promise<void> {
    if (items.length === 0) return;
    const first = this.queue.snapshot().items.length;
    this.queue.add(items);
    if (!this.isActive() && this.driver) await this.queue.start(first);
  }

  start(index = 0): Promise<void> {
    return this.queue.start(index);
  }

  next(): Promise<void> {
    return this.queue.next();
  }

  prev(): Promise<void> {
    return this.queue.prev();
  }

  remove(id: string): void {
    this.queue.remove(id);
  }

  move(from: number, to: number): void {
    this.queue.move(from, to);
  }

  setSlideshow(on: boolean): void {
    this.queue.setSlideshow(on);
  }

  setIntervalSec(sec: number): void {
    this.queue.setIntervalSec(sec);
  }

  setLoop(on: boolean): void {
    this.queue.setLoop(on);
  }

  isActive(): boolean {
    return isCastActive(this.snap.queue, this.snap.cast);
  }

  /** Play/pause: pauses or resumes a video, pauses or resumes a photo slideshow, or starts the queue. */
  async togglePlay(): Promise<void> {
    const action = playAction(this.snap.queue, this.snap.cast);
    const d = this.driver;
    switch (action) {
      case 'start':
        return this.queue.start(Math.max(0, this.snap.queue.index));
      case 'pauseSlideshow':
        return this.queue.setSlideshow(false);
      case 'resumeSlideshow':
        return this.queue.setSlideshow(true);
      case 'pause':
        return this.guard(() => d?.pause());
      case 'resume':
        return this.guard(() => d?.play());
      default:
        return;
    }
  }

  async seekBy(deltaSec: number): Promise<void> {
    const c = this.snap.cast;
    const d = this.driver;
    if (!d || c.media?.kind !== 'video' || (c.state !== 'playing' && c.state !== 'paused')) return;
    const to = seekTarget(c.positionSec, c.durationSec, deltaSec);
    return this.guard(() => d.seek(to));
  }

  /** Stops casting: the TV, the served file and the server. The queue is kept. */
  async stop(): Promise<void> {
    this.playGen += 1;
    this.queue.setSlideshow(false);
    this.stopping = true;
    try {
      if (this.driver) await this.driver.stop().catch(() => undefined);
    } finally {
      this.stopping = false;
    }
    await this.stopServing();
    await this.deps.server.stopAll().catch(() => undefined);
  }

  /** Empties the queue and stops casting. */
  async clear(): Promise<void> {
    await this.stop();
    this.queue.clear();
  }

  dismissError(): void {
    this.set({ error: null });
  }

  dispose(): void {
    if (this.disposed) return;
    void this.stop().catch(() => undefined);
    this.disposed = true;
    this.releaseDriver(false);
    this.queueUnsub();
    this.queue.dispose();
    this.subs.clear();
  }

  /** The queue's play(): serve (or fake a URL in demo mode), then load on the TV. Never throws. */
  async play(item: QueueItem, _index: number): Promise<void> {
    if (this.disposed) return;
    const gen = ++this.playGen;
    const driver = this.driver;
    this.set({ error: null });
    if (!driver) return;
    if (!driver.target.accepts[item.kind]) {
      this.set({ error: driverError('unsupported', 'core.driver.cast.formatUnsupported').message });
      return;
    }
    try {
      await this.stopServing();
      let url: string;
      if (this.snap.demo || driver.target.kind === 'mock') {
        url = demoUrl(item);
      } else {
        const served = await this.deps.server.serve({ uri: item.uri, mime: item.mime });
        if (gen !== this.playGen || this.disposed) {
          await served.stop().catch(() => undefined);
          return;
        }
        this.served = served;
        url = served.url;
      }
      await driver.load(toCastMedia(item, url));
    } catch (e) {
      if (gen === this.playGen) this.set({ error: asDriverError(e).message });
    }
  }

  private async guard(run: () => Promise<void> | undefined): Promise<void> {
    try {
      await run();
      if (this.snap.error) this.set({ error: null });
    } catch (e) {
      this.set({ error: asDriverError(e).message });
    }
  }

  private async stopServing(): Promise<void> {
    const s = this.served;
    this.served = null;
    if (s) await s.stop().catch(() => undefined);
  }

  private releaseDriver(stopFirst: boolean): void {
    const d = this.driver;
    if (!d) return;
    this.driverUnsub?.();
    this.driverUnsub = null;
    this.driver = null;
    this.playGen += 1;
    const active = ACTIVE.includes(d.snapshot().state);
    const done = () => {
      try {
        d.dispose();
      } catch {
        // already disposed
      }
    };
    if (stopFirst && active) {
      void d.stop().catch(() => undefined).then(done);
    } else {
      done();
    }
    void this.stopServing();
  }

  private set(patch: Partial<CastControllerSnapshot>): void {
    if (this.disposed) return;
    const next = { ...this.snap, ...patch };
    const keys = Object.keys(patch) as (keyof CastControllerSnapshot)[];
    if (keys.every((k) => next[k] === this.snap[k])) return;
    this.snap = next;
    for (const l of [...this.subs]) l(next);
  }
}
