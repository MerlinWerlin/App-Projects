// T85 finish moment (docs/MARKET.md "Design reference 18 Oct" §3): when the "Finished!" sheet opens after the
// paper check, which actions it offers, whether it plays the success haptic and whether it shows the time-lapse
// note. Pure: the compare view (src/ui/CompareView.tsx) and src/ui/FinishSheet.tsx drive it. Never gated by Plus.
import type { TimelapsePhase } from './timelapse.ts';

/** What happened: the drawing was just saved to My drawings, or the user tapped "Finished". */
export type FinishEvent = 'saved' | 'done';

export type FinishState = {
  /** The sheet is showing. */
  open: boolean;
  /** This snapshot is already in My drawings. */
  saved: boolean;
  /** The sheet already opened once after saving this snapshot (a save opens it only once). */
  shownAfterSave: boolean;
};

export const initialFinishState: FinishState = { open: false, saved: false, shownAfterSave: false };

/** Whether an event should open the sheet. "Finished" always does; a save does once per snapshot. */
export function shouldOpenFinish(event: FinishEvent, s: FinishState): boolean {
  if (s.open) return false;
  if (event === 'done') return true;
  return !s.shownAfterSave;
}

/** Next state after an event (opens the sheet when shouldOpenFinish says so; a save is remembered either way). */
export function finishReduce(s: FinishState, event: FinishEvent | 'close'): FinishState {
  if (event === 'close') return { ...s, open: false };
  const saved = s.saved || event === 'saved';
  if (!shouldOpenFinish(event, s)) return { ...s, saved };
  return { open: true, saved, shownAfterSave: s.shownAfterSave || saved };
}

/**
 * Success haptic when the sheet opens. A save already played one in the compare view (it would buzz twice), so
 * only the "Finished" tap plays it here. The Haptics setting is respected by src/native/haptics.
 */
export function finishHaptic(event: FinishEvent): 'success' | 'none' {
  return event === 'done' ? 'success' : 'none';
}

export type FinishActionId = 'save' | 'viewDrawings' | 'traceAgain' | 'close';
export type FinishAction = { id: FinishActionId; variant: 'primary' | 'secondary' | 'plain' };

/**
 * Actions in order, exactly one primary. Not saved yet (and saving is possible): Save is primary.
 * Saved: View My drawings is primary. Trace again and Close are always offered.
 */
export function finishActions(o: { saved: boolean; canSave: boolean }): FinishAction[] {
  const out: FinishAction[] = [];
  const offerSave = o.canSave && !o.saved;
  if (offerSave) out.push({ id: 'save', variant: 'primary' });
  out.push({ id: 'viewDrawings', variant: offerSave ? 'secondary' : 'primary' });
  out.push({ id: 'traceAgain', variant: 'secondary' });
  out.push({ id: 'close', variant: 'plain' });
  return out;
}

/** A recorded clip exists (in review, being saved, saved, or kept after a failed/denied save). */
export function timelapseExists(phase: TimelapsePhase | undefined): boolean {
  return phase === 'review' || phase === 'saving' || phase === 'saved' || phase === 'denied' || phase === 'error';
}

/** "Time-lapse saving comes later" only when no time-lapse exists for this drawing. */
export function showTimelapseNote(phase: TimelapsePhase | undefined): boolean {
  return !timelapseExists(phase);
}

/** Sparkle accents springing in: delay per sparkle (ms). Reduce Motion: all fade together, no stagger. */
export function sparkleDelays(count: number, reduceMotion: boolean, step: number = 70): number[] {
  const n = Math.max(0, Math.floor(count));
  return Array.from({ length: n }, (_, i) => (reduceMotion ? 0 : i * step));
}
