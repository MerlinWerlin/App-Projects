/**
 * CastQueue (cast-1024, T89): the picked items, which one is on the TV, and the slideshow.
 *
 * - start / next / prev call `play(item, index)` (the screen serves the file and loads it on the
 *   driver). The index moves first, so a failing play leaves the index on that item; the failure
 *   turns the slideshow off and is rethrown.
 * - Rapid next/prev: each move bumps a generation, so a slow play that finishes after a newer move
 *   neither arms the slideshow nor reports its error.
 * - The slideshow timer runs only while the current item is a photo. A video plays to its end;
 *   the screen then calls onMediaEnded(), which advances when the slideshow or loop is on.
 * - next at the end wraps when loop is on, otherwise stops the slideshow and stays; prev at the
 *   start wraps when loop is on, otherwise stays.
 *
 * Pure TypeScript; the timer is injected (CastTimer).
 */
import {
  DEFAULT_SLIDESHOW_INTERVAL,
  SLIDESHOW_INTERVALS,
  type QueueItem,
  type QueueSnapshot,
} from './queueTypes';
import { SYSTEM_TIMER, type CastTimer } from './session';

export interface CastQueueOptions {
  play: (item: QueueItem, index: number) => Promise<void>;
  timer?: CastTimer;
}

/** Closest allowed slideshow interval (ties go to the shorter one). */
export function snapInterval(sec: number): number {
  if (!Number.isFinite(sec)) return DEFAULT_SLIDESHOW_INTERVAL;
  let best = SLIDESHOW_INTERVALS[0] ?? DEFAULT_SLIDESHOW_INTERVAL;
  for (const v of SLIDESHOW_INTERVALS) if (Math.abs(v - sec) < Math.abs(best - sec)) best = v;
  return best;
}

export class CastQueue {
  private snap: QueueSnapshot = {
    items: [],
    index: -1,
    slideshow: false,
    intervalSec: DEFAULT_SLIDESHOW_INTERVAL,
    loop: false,
  };
  private readonly subs = new Set<(s: QueueSnapshot) => void>();
  private readonly playFn: (item: QueueItem, index: number) => Promise<void>;
  private readonly timer: CastTimer;
  private slideTimer: unknown = null;
  private gen = 0;
  /** True while the current item's play() is in flight (the timer waits for it). */
  private pending = false;
  private startIndex = 0;
  private disposed = false;

  constructor(opts: CastQueueOptions) {
    this.playFn = opts.play;
    this.timer = opts.timer ?? SYSTEM_TIMER;
  }

  snapshot(): QueueSnapshot {
    return this.snap;
  }

  subscribe(l: (s: QueueSnapshot) => void): () => void {
    this.subs.add(l);
    return () => {
      this.subs.delete(l);
    };
  }

  /** Replaces the queue. Nothing is cast until start(); `startIndex` is start()'s default. */
  setItems(items: QueueItem[], startIndex = 0): void {
    if (this.disposed) return;
    this.gen += 1;
    this.pending = false;
    this.disarm();
    this.startIndex = Math.max(0, Math.min(items.length - 1, Math.floor(startIndex)));
    this.set({ items: [...items], index: -1 });
  }

  add(items: QueueItem[]): void {
    if (this.disposed || items.length === 0) return;
    this.set({ items: [...this.snap.items, ...items] });
  }

  /**
   * Removes one item. Removing the item on the TV casts the one that takes its place (or the new
   * last item); an emptied queue goes back to index -1.
   */
  remove(id: string): void {
    if (this.disposed) return;
    const at = this.snap.items.findIndex((i) => i.id === id);
    if (at < 0) return;
    const items = this.snap.items.filter((_, i) => i !== at);
    const { index } = this.snap;
    if (at < index) {
      this.set({ items, index: index - 1 });
    } else if (at > index) {
      this.set({ items });
    } else if (items.length === 0) {
      this.gen += 1;
      this.pending = false;
      this.disarm();
      this.set({ items, index: -1 });
    } else {
      this.set({ items });
      this.goTo(Math.min(at, items.length - 1)).catch(() => undefined);
    }
  }

  /** Moves the item at `from` to `to`; the index follows the item on the TV. */
  move(from: number, to: number): void {
    if (this.disposed) return;
    const n = this.snap.items.length;
    if (from < 0 || from >= n || to < 0 || to >= n || from === to) return;
    const items = [...this.snap.items];
    const [it] = items.splice(from, 1);
    items.splice(to, 0, it!);
    let { index } = this.snap;
    if (index === from) index = to;
    else if (from < index && to >= index) index -= 1;
    else if (from > index && to <= index) index += 1;
    this.set({ items, index });
  }

  start(index?: number): Promise<void> {
    const i = index ?? this.startIndex;
    if (this.disposed || i < 0 || i >= this.snap.items.length) return Promise.resolve();
    return this.goTo(i);
  }

  next(): Promise<void> {
    if (this.disposed) return Promise.resolve();
    const { index, items, loop } = this.snap;
    if (items.length === 0) return Promise.resolve();
    if (index < 0) return this.goTo(0);
    if (index < items.length - 1) return this.goTo(index + 1);
    if (loop) return this.goTo(0);
    this.setSlideshow(false);
    return Promise.resolve();
  }

  prev(): Promise<void> {
    if (this.disposed) return Promise.resolve();
    const { index, items, loop } = this.snap;
    if (items.length === 0) return Promise.resolve();
    if (index < 0) return this.goTo(0);
    if (index > 0) return this.goTo(index - 1);
    if (loop) return this.goTo(items.length - 1);
    return Promise.resolve();
  }

  setSlideshow(on: boolean): void {
    if (this.disposed) return;
    this.set({ slideshow: on });
    this.rearm();
  }

  setIntervalSec(sec: number): void {
    if (this.disposed) return;
    const intervalSec = snapInterval(sec);
    if (intervalSec === this.snap.intervalSec) return;
    this.set({ intervalSec });
    this.rearm();
  }

  setLoop(on: boolean): void {
    if (this.disposed) return;
    this.set({ loop: on });
  }

  /** The current video finished on the TV: advance when the slideshow or loop is on. */
  onMediaEnded(): Promise<void> {
    if (this.disposed || this.snap.index < 0) return Promise.resolve();
    if (!this.snap.slideshow && !this.snap.loop) return Promise.resolve();
    return this.next();
  }

  clear(): void {
    if (this.disposed) return;
    this.gen += 1;
    this.pending = false;
    this.disarm();
    this.startIndex = 0;
    this.set({ items: [], index: -1, slideshow: false });
  }

  dispose(): void {
    this.gen += 1;
    this.disarm();
    this.disposed = true;
    this.subs.clear();
  }

  private async goTo(index: number): Promise<void> {
    const item = this.snap.items[index];
    if (!item) return;
    const gen = ++this.gen;
    this.disarm();
    this.pending = true;
    this.set({ index });
    try {
      await this.playFn(item, index);
    } catch (e) {
      if (gen !== this.gen) return;
      this.pending = false;
      this.set({ slideshow: false });
      throw e;
    }
    if (gen !== this.gen) return;
    this.pending = false;
    this.rearm();
  }

  private current(): QueueItem | undefined {
    return this.snap.items[this.snap.index];
  }

  private rearm(): void {
    this.disarm();
    if (this.disposed || !this.snap.slideshow || this.pending) return;
    if (this.current()?.kind !== 'photo') return;
    const handle = this.timer.setInterval(() => {
      if (this.slideTimer !== handle) return;
      this.disarm();
      this.next().catch(() => undefined);
    }, this.snap.intervalSec * 1000);
    this.slideTimer = handle;
  }

  private disarm(): void {
    if (this.slideTimer !== null) {
      this.timer.clearInterval(this.slideTimer);
      this.slideTimer = null;
    }
  }

  private set(patch: Partial<QueueSnapshot>): void {
    const next = { ...this.snap, ...patch };
    const keys = Object.keys(next) as (keyof QueueSnapshot)[];
    if (keys.every((k) => next[k] === this.snap[k])) return;
    this.snap = next;
    for (const l of [...this.subs]) l(next);
  }
}
