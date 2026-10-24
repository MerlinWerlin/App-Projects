// What the Live Lock Screen card shows (T135): the continuous loop on iOS 26+ full builds, or the
// Live Photo way everywhere else. Pure TS (no React Native imports) so the decisions and the
// English copy are unit-tested; src/ui/LiveLockCard.tsx renders them via liveUi.loop.* keys.
//
// The facts (Apple, "Providing animated artwork for media items", MediaPlayer, iOS 26):
// - Glaze keeps a silent Now Playing item running and gives it the loop as 3:4 animated artwork;
//   the iOS 26 Lock Screen shows that artwork full screen behind the clock.
// - Small playback controls show over it. Another app's audio or a call takes over Now Playing.
// - The system shows only the still preview in Low Power Mode, with Reduce Motion on or with
//   Auto-Play Animated Images off (and in Low Data Mode / high thermal state).
// - If the Lock Screen shows a small player, tapping the artwork expands it (user reports; a hint,
//   not a guarantee).
// - Below iOS 26, in Expo Go, on Android or in a build without the module: the Live Photo guide
//   (src/ui/LivePhotoGuide.tsx) is the flow.

export const LIVE_LOOP_MIN_IOS = 26;

export type LoopAvailabilityReason = 'expo-go' | 'android' | 'ios-version' | 'not-built' | null;
export type LoopAvailability = { available: boolean; reason: LoopAvailabilityReason };

/** What the native side registered: animated 3:4, animated square, or only the still. */
export type LoopArtwork = 'animated-3x4' | 'animated-1x1' | 'static';
export type LoopStateName = 'idle' | 'preparing' | 'playing' | 'paused' | 'stopped' | 'error';

export type LoopStatus = {
  state: LoopStateName;
  prepared: number;
  total: number;
  projectId?: string;
  reason?: string;
  artwork?: LoopArtwork;
};

export type LiveLockMode = 'checking' | 'loop' | 'live-photo';
export type LoopPhase = 'ready' | 'preparing' | 'playing' | 'paused' | 'error';
export type LoopNotice = 'static-artwork' | 'interrupted' | 'paused' | 'low-power' | 'stopped' | 'failed' | null;
/** Shown above the Live Photo guide when the continuous loop isn't available here. */
export type LoopFallback = 'needs-ios26' | 'not-built' | null;
export type LoopStepId = 'lock' | 'wake' | 'tap';
export type LoopNoteId = 'ios' | 'controls' | 'stops' | 'still' | 'battery';

export const LOOP_STEPS: readonly LoopStepId[] = ['lock', 'wake', 'tap'];
/** Honest notes, always visible on the loop card. */
export const LOOP_NOTES: readonly LoopNoteId[] = ['ios', 'controls', 'stops', 'still', 'battery'];

export type LiveLockViewInput = {
  /** null while the adapter is still checking. */
  availability: LoopAvailability | null;
  status: LoopStatus;
  /** The loop this card would start (the editor's project, or the tab's most recent loop). */
  projectId?: string | null;
  /** The app is waiting for start() before the first native "preparing" event. */
  starting?: boolean;
};

export type LiveLockView = {
  mode: LiveLockMode;
  phase: LoopPhase;
  notice: LoopNotice;
  fallback: LoopFallback;
  /** Numbered steps (only while the loop is on the Lock Screen). */
  steps: LoopStepId[];
  notes: LoopNoteId[];
  canStart: boolean;
  showStop: boolean;
  /** Export progress while preparing (null when unknown). */
  progress: { done: number; total: number } | null;
  /** A different loop than projectId is the one running. */
  runningOther: boolean;
};

function base(mode: LiveLockMode, fallback: LoopFallback = null): LiveLockView {
  return {
    mode,
    phase: 'ready',
    notice: null,
    fallback,
    steps: [],
    notes: [],
    canStart: false,
    showStop: false,
    progress: null,
    runningOther: false,
  };
}

export function liveLockView(input: LiveLockViewInput): LiveLockView {
  const a = input.availability;
  if (!a) return base('checking');
  if (!a.available) {
    const fallback: LoopFallback = a.reason === 'ios-version' ? 'needs-ios26' : a.reason === 'not-built' ? 'not-built' : null;
    return base('live-photo', fallback);
  }

  const v = base('loop');
  v.notes = [...LOOP_NOTES];
  const s = input.status;
  const hasProject = typeof input.projectId === 'string' && input.projectId.length > 0;

  if (s.state === 'preparing' || (input.starting && s.state !== 'playing' && s.state !== 'paused')) {
    v.phase = 'preparing';
    v.showStop = true;
    v.progress = s.state === 'preparing' && s.total > 0 ? { done: Math.min(s.prepared, s.total), total: s.total } : null;
    return v;
  }
  if (s.state === 'playing' || s.state === 'paused') {
    v.phase = s.state;
    v.showStop = true;
    v.steps = [...LOOP_STEPS];
    if (s.artwork === 'static') v.notice = 'static-artwork';
    else if (s.state === 'paused') v.notice = s.reason === 'interrupted' ? 'interrupted' : 'paused';
    v.runningOther = hasProject && typeof s.projectId === 'string' && s.projectId !== input.projectId;
    v.canStart = v.runningOther;
    return v;
  }
  if (s.state === 'error') {
    v.phase = 'error';
    v.notice = s.reason === 'low-power' ? 'low-power' : 'failed';
    v.canStart = hasProject;
    return v;
  }
  // idle / stopped
  v.phase = 'ready';
  if (s.state === 'stopped') {
    if (s.reason === 'low-power') v.notice = 'low-power';
    else if (s.reason && s.reason !== 'user') v.notice = 'stopped';
  }
  v.canStart = hasProject;
  return v;
}

/** English source of the card; liveUi.loop.* in every catalogue carries the same text. */
export const LOOP_TEXT = {
  title: 'Live Lock Screen',
  intro: 'Your loop plays full screen behind the clock, over and over, while it’s running.',
  forLoop: 'Loop: {name}',
  needsLoop: 'Make a loop first, then start it here.',
  start: 'Start on Lock Screen',
  startHint: 'Prepares this loop and starts it on your Lock Screen',
  startOther: 'Use this loop instead',
  preparing: 'Preparing your loop. This takes a few seconds…',
  running: 'Running on your Lock Screen',
  paused: 'Paused',
  stepLock: 'Lock your iPhone (side button).',
  stepWake: 'Wake it: your loop plays full screen behind the clock.',
  stepTap: 'If you see a small player, tap the artwork to make it full screen.',
  stepA11y: 'Step {n} of 3: {text}',
  stop: 'Stop',
  stopHint: 'Stops the loop and removes it from the Lock Screen',
  staticArtwork: 'This iPhone shows a still picture instead of the moving loop.',
  interrupted: 'Paused because another app played sound or a call came in. Tap play on the Lock Screen, or stop and start it again here.',
  pausedNote: 'Paused from the Lock Screen. Tap play there to carry on.',
  lowPower: 'Low Power Mode is on, so the loop stopped. Turn it off to start it again.',
  stopped: 'The loop stopped. Start it again whenever you like.',
  failed: 'Couldn’t start the loop. Check the clip still plays here, then try again.',
  runningOther: 'Another loop is on your Lock Screen right now.',
  noteIos: 'Needs iOS 26 or later.',
  noteControls: 'Small playback controls show over your loop.',
  noteStops: 'It stops if another app plays sound or a call comes in.',
  noteStill: 'Low Power Mode, Reduce Motion or Auto-Play Animated Images turned off show a still picture.',
  noteBattery: 'It uses a little battery while it runs.',
  needsIos26: 'Glaze makes a Live Photo: it moves when you wake your iPhone, not in a constant loop.',
  notBuilt: 'This build makes a Live Photo: it moves when you wake your iPhone, not in a constant loop.',
  livePhotoAlt: 'Or save it as a Live Photo',
} as const;
