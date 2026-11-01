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
import { KNOWN_RENDERER_PATHS } from './probe';
import { SYSTEM_TIMER, type CastSnapshot, type CastState, type CastTimer } from './session';
import { googleCastCandidates } from './targets';

/**
 * How long a real TV gets to confirm it is showing an item before the Cast tab says it never did
 * (owner brief 25 Oct 2026, TCL Google TV: the queue said "casting" while nothing reached the TV).
 */
export const CONFIRM_TIMEOUT_MS = 25_000;

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
  /** True when the network-wide renderer search can run (a UDP module exists). Default false. */
  canSearch?: boolean;
  /** True when this build has the TLS socket Google Cast needs (lan-wss tlsConnect, T106). Default false. */
  canGoogleCast?: boolean;
  /** Timer for the confirmation deadline (CONFIRM_TIMEOUT_MS). Default: the system timer. */
  timer?: CastTimer;
  /** Optional self-check: the phone fetches its own served URL and returns a short result line. */
  checkFile?: (url: string) => Promise<string>;
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
  /** Why the tab is not casting to a real TV right now (D145-2); null when a real target is selected. */
  notice: CastNotice | null;
  /** Where the current item was sent on a real TV (owner brief 25 Oct 2026); null in demo mode or before a send. */
  delivery: CastDelivery | null;
}

/**
 * What Couch sent where, shown under the Cast tab status so a failed real-TV cast can be diagnosed
 * from one screenshot (owner TestFlight 1.0.1: remote connected, queued media never appeared).
 */
export interface CastDelivery {
  tvName: string;
  /** How the TV was asked to show it. */
  via: 'dlna' | 'roku' | 'googlecast';
  /** The TV address that accepted the request. */
  tvHost: string;
  /** host:port the TV must fetch the file from (this phone). */
  fileHost: string;
  /** Result of the phone fetching its own served URL (owner 1 Nov 2026: TCL showed a black screen). */
  fileCheck?: string;
}

/** host:port of an http URL, or '' when it cannot be parsed. */
export function urlHostPort(url: string): string {
  const m = /^https?:\/\/([^/?#]+)/i.exec(url);
  return m ? m[1]! : '';
}

/**
 * True while a real TV accepted the item but has not confirmed it is showing it: the TV may still be
 * unable to fetch the file from this phone. The Cast tab then says "sent, waiting for the TV" and
 * what to check, instead of claiming it is on the TV.
 */
export function castUnconfirmed(s: Pick<CastControllerSnapshot, 'demo' | 'delivery' | 'cast'>): boolean {
  return !s.demo && s.delivery !== null && (s.cast.state === 'playing' || s.cast.state === 'loading') && s.cast.confirmed !== true;
}

/**
 * Why casting is not going to a real TV (oversight D145-2, owner TestFlight 1.0.1: the remote
 * connected but queued media never reached the TV). The Cast tab shows one line for each kind and
 * never falls back to the demo TV silently while a real TV is connected.
 * - demo: the remote itself is in demo mode.
 * - expoGo: no file server on this phone and no real TV connected (Expo Go).
 * - serverUnavailable: a real TV is connected but this phone's file server is unavailable, so the
 *   demo TV is used and nothing is sent to `tvName`.
 * - noReceiver: a real TV is connected but no cast receiver (Roku media player or DLNA renderer)
 *   was found on it. `ports` are the fixed renderer ports Couch probed; `searched` says whether the
 *   network-wide search (SSDP multicast) could run.
 */
export type CastNotice =
  | { kind: 'demo' }
  | { kind: 'expoGo' }
  | { kind: 'serverUnavailable'; tvName: string }
  | { kind: 'noReceiver'; tvNames: string[]; ports: number[]; searched: boolean }
  /** A Google TV is saved but this build has no TLS socket for Google Cast (T106): needs the next app build. */
  | { kind: 'needsCastBuild'; tvNames: string[] };

/** How the delivery line names a transport. */
export function deliveryVia(kind: CastTarget['kind']): CastDelivery['via'] {
  return kind === 'roku' ? 'roku' : kind === 'googlecast' ? 'googlecast' : 'dlna';
}

/** The saved TVs casting could reach: not demo, not infrared. */
export function realCastTvs(tvs: readonly Tv[]): Tv[] {
  return tvs.filter((tv) => tv.platform !== 'mock' && tv.platform !== 'ir');
}

/** The renderer ports probed on every TV host (src/core/cast/probe.ts KNOWN_RENDERER_PATHS). */
export function probedRendererPorts(): number[] {
  return KNOWN_RENDERER_PATHS.map((k) => k.port);
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
  private confirmTimer: unknown = null;
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
      notice: serverAvailable ? { kind: 'demo' } : { kind: 'expoGo' },
      delivery: null,
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
    const real = realCastTvs(this.tvs);
    const demo = this.sessionDemo || !this.deps.server.available;
    if (demo) {
      let notice: CastNotice;
      if (this.sessionDemo) notice = { kind: 'demo' };
      else if (real.length > 0) notice = { kind: 'serverUnavailable', tvName: real[0]!.name };
      else notice = { kind: 'expoGo' };
      this.set({ demo: true, targets: [this.deps.mockTarget], searching: false, notice });
      this.selectTarget(this.deps.mockTarget.id);
      return;
    }
    this.set({ demo: false, searching: true, notice: null });
    let found: CastTarget[] = [];
    try {
      found = await this.deps.findTargets(this.tvs);
    } catch {
      found = [];
    }
    if (gen !== this.searchGen || this.disposed) return;
    const realFound = found.filter((t) => t.kind !== 'mock');
    const castTvs = this.deps.canGoogleCast ? [] : googleCastCandidates(real);
    let notice: CastNotice | null = null;
    if (realFound.length === 0 && castTvs.length > 0) notice = { kind: 'needsCastBuild', tvNames: castTvs.map((tv) => tv.name) };
    else if (realFound.length === 0 && real.length > 0)
      notice = { kind: 'noReceiver', tvNames: real.map((tv) => tv.name), ports: probedRendererPorts(), searched: this.deps.canSearch === true };
    this.set({ targets: found, searching: false, notice });
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
      this.set({ targetId: target.id, cast: this.driver.snapshot(), error: null, delivery: null });
    } else {
      this.set({ targetId: null, cast: IDLE_CAST, delivery: null });
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
    this.clearConfirm();
    this.queue.setSlideshow(false);
    this.set({ delivery: null });
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
    this.clearConfirm();
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
    this.set({ error: null, delivery: null });
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
      const real = !this.snap.demo && driver.target.kind !== 'mock';
      const delivery: CastDelivery | null = real
        ? { tvName: driver.target.name, via: deliveryVia(driver.target.kind), tvHost: driver.target.host, fileHost: urlHostPort(url) }
        : null;
      // Shown while the TV is asked, so a request that fails or hangs still says where it went.
      if (delivery) this.set({ delivery });
      if (delivery && this.deps.checkFile) {
        const check = this.deps.checkFile;
        void check(url)
          .catch((e: unknown) => `phone check failed: ${e instanceof Error ? e.message : String(e)}`)
          .then((fileCheck) => {
            const d = this.snap.delivery;
            if (gen === this.playGen && !this.disposed && d) this.set({ delivery: { ...d, fileCheck } });
          });
      }
      await driver.load(toCastMedia(item, url));
      if (real && gen === this.playGen) this.armConfirm(gen, driver);
    } catch (e) {
      if (gen === this.playGen) this.set({ error: asDriverError(e).message });
    }
  }

  /**
   * Owner brief 25 Oct 2026: never keep saying "sent"/"casting" when the TV never shows the item. If
   * the TV has not confirmed it within CONFIRM_TIMEOUT_MS, the item gets an honest error, the
   * slideshow stops (so the queue does not keep "filling" the TV) and the delivery line stays.
   */
  private armConfirm(gen: number, driver: CastDriver): void {
    this.clearConfirm();
    const timer = this.deps.timer ?? SYSTEM_TIMER;
    const startedAt = timer.now();
    this.confirmTimer = timer.setInterval(() => {
      if (gen !== this.playGen || this.driver !== driver || this.disposed) {
        this.clearConfirm();
        return;
      }
      const s = driver.snapshot();
      if (s.confirmed === true || !(s.state === 'loading' || s.state === 'playing')) {
        this.clearConfirm();
        return;
      }
      if (timer.now() - startedAt < CONFIRM_TIMEOUT_MS) return;
      this.clearConfirm();
      this.queue.setSlideshow(false);
      this.set({ error: driverError('timeout', 'core.driver.cast.notShown', { name: driver.target.name }).message });
    }, 1000);
  }

  private clearConfirm(): void {
    if (this.confirmTimer !== null) {
      (this.deps.timer ?? SYSTEM_TIMER).clearInterval(this.confirmTimer);
      this.confirmTimer = null;
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
