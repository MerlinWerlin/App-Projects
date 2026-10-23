/**
 * Idle-animation policy (docs/POLISH.md rule 7 + rule 1), pure TS so it is testable without React Native.
 *
 * - 'loop'   : run the idle loop (screen focused, app foreground, Reduce Motion off, and wanted).
 * - 'still'  : Reduce Motion is on: show a static look (fixed opacity), never loop.
 * - 'paused' : screen blurred or app backgrounded (or not wanted right now): stop the loop.
 *
 * Reduce Motion wins over everything, so a reduced-motion user never sees a loop even on focus.
 */
export type IdleMode = 'loop' | 'still' | 'paused';

export interface IdleInput {
  /** Phone's Reduce Motion setting (useReducedMotion). */
  reduce: boolean;
  /** Screen focused and app in the foreground (useActive). */
  active: boolean;
  /** Whether the component wants to animate at all right now (e.g. mic ring only while listening). */
  wanted?: boolean;
}

export function idleMode({ reduce, active, wanted = true }: IdleInput): IdleMode {
  if (reduce) return 'still';
  if (!active || !wanted) return 'paused';
  return 'loop';
}

/** App states that count as foreground for idle loops (React Native AppStateStatus). */
export function isForeground(appState: string | null | undefined): boolean {
  return appState === 'active';
}
