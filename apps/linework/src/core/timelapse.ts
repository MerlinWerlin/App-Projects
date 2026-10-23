// Timelapse (T09): pure state machine, duration formatting and speed-up math for recording the drawing.
// No React Native imports: the trace screen drives this through src/ui/useTimelapse.ts.
// Recording and saving are free (PLAN §6: only "timelapse export extras" may ever be Plus).

/** Hard cap on one recording, in seconds (10 min). Passed to recordAsync({ maxDuration }). */
export const MAX_RECORD_S = 600;

/** Speed-ups we suggest, smallest first. */
export const SPEED_STEPS: readonly number[] = [2, 4, 8, 16, 32];

/** A sped-up clip should fit in about this many seconds (easy to share, still shows the process). */
export const TARGET_CLIP_S = 90;

export type TimelapsePhase =
  | 'idle' // ready to record
  | 'recording' // recordAsync running
  | 'stopping' // stopRecording called, waiting for the file
  | 'review' // clip ready: show length, speed-up note, Save to Photos
  | 'saving' // permission + saveToLibraryAsync in flight
  | 'saved' // in Photos
  | 'denied' // Photos permission denied: explain + Open Settings
  | 'error'; // save failed; clip is kept so the user can retry

export type TimelapseState = {
  phase: TimelapsePhase;
  /** ms timestamp when recording began (null when not recording). */
  startedAt: number | null;
  /** Local file of the finished clip. */
  uri: string | null;
  /** Clip length in whole seconds. */
  durationS: number;
  /** True when the recording stopped at MAX_RECORD_S. */
  hitLimit: boolean;
  /** Whether the OS will show the Photos permission prompt again (false: only Settings can fix it). */
  canAskAgain: boolean;
  /** Last error, for display. */
  error: string | null;
};

export type TimelapseAction =
  | { type: 'start'; at: number }
  | { type: 'stop' }
  | { type: 'finished'; uri: string | null | undefined; at: number }
  | { type: 'failed'; message: string }
  | { type: 'save' }
  | { type: 'saved' }
  | { type: 'denied'; canAskAgain: boolean }
  | { type: 'saveFailed'; message: string }
  | { type: 'discard' };

export function initialTimelapseState(): TimelapseState {
  return { phase: 'idle', startedAt: null, uri: null, durationS: 0, hitLimit: false, canAskAgain: true, error: null };
}

/** Whole seconds elapsed since `startedAt`, clamped to [0, max]. */
export function elapsedSeconds(startedAt: number | null, now: number, max: number = MAX_RECORD_S): number {
  if (startedAt === null || !Number.isFinite(startedAt) || !Number.isFinite(now)) return 0;
  const s = Math.floor((now - startedAt) / 1000);
  return Math.min(max, Math.max(0, s));
}

export function timelapseReducer(state: TimelapseState, action: TimelapseAction): TimelapseState {
  switch (action.type) {
    case 'start':
      if (state.phase !== 'idle') return state;
      return { ...initialTimelapseState(), phase: 'recording', startedAt: action.at };
    case 'stop':
      if (state.phase !== 'recording') return state;
      return { ...state, phase: 'stopping' };
    case 'finished': {
      if (state.phase !== 'recording' && state.phase !== 'stopping') return state;
      if (!action.uri) {
        return { ...initialTimelapseState(), error: 'The recording didn’t produce a video.' };
      }
      const raw = state.startedAt === null ? 0 : (action.at - state.startedAt) / 1000;
      const durationS = Math.min(MAX_RECORD_S, Math.max(0, Math.round(raw)));
      return {
        ...state,
        phase: 'review',
        startedAt: null,
        uri: action.uri,
        durationS,
        hitLimit: durationS >= MAX_RECORD_S - 1,
        error: null,
      };
    }
    case 'failed':
      if (state.phase !== 'recording' && state.phase !== 'stopping') return state;
      return { ...initialTimelapseState(), error: action.message };
    case 'save':
      if (!state.uri) return state;
      if (state.phase !== 'review' && state.phase !== 'denied' && state.phase !== 'error') return state;
      return { ...state, phase: 'saving', error: null };
    case 'saved':
      if (state.phase !== 'saving') return state;
      return { ...state, phase: 'saved' };
    case 'denied':
      if (state.phase !== 'saving') return state;
      return { ...state, phase: 'denied', canAskAgain: action.canAskAgain };
    case 'saveFailed':
      if (state.phase !== 'saving') return state;
      return { ...state, phase: 'error', error: action.message };
    case 'discard':
      if (state.phase === 'recording' || state.phase === 'stopping' || state.phase === 'saving') return state;
      return initialTimelapseState();
    default:
      return state;
  }
}

/** Whether the sheet (review / save / result) should be visible. */
export function showsSheet(phase: TimelapsePhase): boolean {
  return phase === 'review' || phase === 'saving' || phase === 'saved' || phase === 'denied' || phase === 'error';
}

/** "m:ss" for the elapsed timer pill. */
export function formatClock(totalS: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(totalS) ? totalS : 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r < 10 ? '0' : ''}${r}`;
}

/** English short length, e.g. "45 s", "2 min 5 s", "10 min" (the UI uses trace.time.* from the catalogue). */
export function describeDuration(totalS: number): string {
  const s = Math.max(0, Math.round(Number.isFinite(totalS) ? totalS : 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m === 0) return `${r} s`;
  return r === 0 ? `${m} min` : `${m} min ${r} s`;
}

/** Spoken length for screen readers, e.g. "2 minutes 5 seconds". */
export function spokenDuration(totalS: number): string {
  const s = Math.max(0, Math.round(Number.isFinite(totalS) ? totalS : 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  const mins = `${m} ${m === 1 ? 'minute' : 'minutes'}`;
  const secs = `${r} ${r === 1 ? 'second' : 'seconds'}`;
  if (m === 0) return secs;
  return r === 0 ? mins : `${mins} ${secs}`;
}

/** Smallest speed-up in SPEED_STEPS that brings the clip to TARGET_CLIP_S or less; 1 when already short. */
export function suggestedSpeed(durationS: number, target: number = TARGET_CLIP_S): number {
  if (!Number.isFinite(durationS) || durationS <= target) return 1;
  for (const step of SPEED_STEPS) {
    if (durationS / step <= target) return step;
  }
  return SPEED_STEPS[SPEED_STEPS.length - 1];
}

/** Length after speeding up, rounded to whole seconds (at least 1). */
export function spedUpSeconds(durationS: number, factor: number): number {
  if (!Number.isFinite(durationS) || durationS <= 0) return 0;
  const f = factor > 0 ? factor : 1;
  return Math.max(1, Math.round(durationS / f));
}

/** English "speed-up note" (the UI uses trace.timelapse.note* with suggestedSpeed / spedUpSeconds). */
export function speedUpNote(durationS: number): string {
  const f = suggestedSpeed(durationS);
  if (f === 1) {
    return 'Short and sweet — it plays well at normal speed. Try 2× in a video editor for extra snap.';
  }
  return `Tip: speed it up ${f}× in a video editor — this ${describeDuration(durationS)} drawing becomes about ${describeDuration(spedUpSeconds(durationS, f))}.`;
}

export type PermissionLike = { granted: boolean; canAskAgain: boolean };

/** Next step of the save flow given the current Photos permission. */
export function permissionStep(p: PermissionLike | null | undefined): 'save' | 'ask' | 'settings' {
  if (p && p.granted) return 'save';
  if (!p || p.canAskAgain) return 'ask';
  return 'settings';
}
