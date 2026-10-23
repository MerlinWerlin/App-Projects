/**
 * Bottom-sheet lifecycle (src/ui/Sheet.tsx). Pure TS, no React Native import, unit-tested in Node.
 *
 * closed -> entering -> open -> exiting -> closed
 * The Modal stays mounted for every phase except 'closed', so the exit animation (panel slides
 * down, backdrop fades) plays before the Modal disappears.
 */
import { duration } from '../theme/motion';

export type SheetPhase = 'closed' | 'entering' | 'open' | 'exiting';

/** show: visible became true. hide: visible became false. done: the current animation finished. */
export type SheetEvent = 'show' | 'hide' | 'done';

export function nextSheetPhase(phase: SheetPhase, event: SheetEvent): SheetPhase {
  switch (event) {
    case 'show':
      return phase === 'closed' || phase === 'exiting' ? 'entering' : phase;
    case 'hide':
      return phase === 'entering' || phase === 'open' ? 'exiting' : phase;
    case 'done':
      if (phase === 'entering') return 'open';
      if (phase === 'exiting') return 'closed';
      return phase;
  }
}

/** The RN Modal is visible in every phase but 'closed'. */
export function sheetModalVisible(phase: SheetPhase): boolean {
  return phase !== 'closed';
}

/** Phase to start in for the first render. */
export function initialSheetPhase(visible: boolean): SheetPhase {
  return visible ? 'entering' : 'closed';
}

/** Fallback panel travel when it has not been measured yet. */
export const SHEET_FALLBACK_OFFSET = 400;

/** How far the panel travels off-screen: its measured height, never less than the fallback. */
export function sheetOffset(measuredHeight: number | null | undefined): number {
  const h = typeof measuredHeight === 'number' && Number.isFinite(measuredHeight) ? measuredHeight : 0;
  return Math.max(Math.ceil(h), SHEET_FALLBACK_OFFSET);
}

export interface SheetMotion {
  /** Panel slides (spring in, timing out). False with Reduce Motion: it fades instead. */
  slide: boolean;
  /** Backdrop fade duration (ms). */
  backdropMs: number;
  /** Panel fade duration (ms) when not sliding. */
  panelFadeMs: number;
  /** Panel slide-out duration (ms). */
  exitMs: number;
}

export function sheetMotion(reduceMotion: boolean): SheetMotion {
  if (reduceMotion) {
    return { slide: false, backdropMs: duration.base, panelFadeMs: duration.fast, exitMs: duration.fast };
  }
  return { slide: true, backdropMs: duration.base, panelFadeMs: 0, exitMs: duration.base };
}
