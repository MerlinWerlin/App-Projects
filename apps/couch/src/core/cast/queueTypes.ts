/**
 * Cast queue + slideshow contract (cast-1024). Implemented by `CastQueue` in ./queue.ts (T89);
 * the Cast tab (T91) only uses these types.
 */
import type { CastKind } from './didl';

/** One picked item, before it is served. */
export interface QueueItem {
  /** Stable id (picker asset id or a generated one). */
  id: string;
  /** Local file URI from the picker (file://, content://, ph://). */
  uri: string;
  mime: string;
  kind: CastKind;
  title: string;
  durationSec?: number;
  sizeBytes?: number;
}

export interface QueueSnapshot {
  items: readonly QueueItem[];
  /** Index of the item on the TV, or -1 when nothing is cast yet. */
  index: number;
  /** True while the slideshow timer advances photos. */
  slideshow: boolean;
  /** Slideshow interval in seconds (allowed: SLIDESHOW_INTERVALS). */
  intervalSec: number;
  /** Whether the queue wraps from the last item back to the first. */
  loop: boolean;
}

export const SLIDESHOW_INTERVALS: readonly number[] = [3, 5, 10, 15, 30];
export const DEFAULT_SLIDESHOW_INTERVAL = 5;
