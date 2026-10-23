/**
 * Volume HUD state machine (premium polish P2, T39). Pure TS (no React Native), unit-tested.
 * VolumeHud.tsx feeds it 'volume' fx events and renders `view`; this file owns what is shown,
 * the label read by screen readers and the auto-hide timer.
 */
import { formatNumber, t } from '../../i18n/core';
import type { IconName } from '../icons/names';

/** Hide after this long without a volume event. */
export const HUD_HIDE_MS = 1100;
/** Bar fill when the TV does not report a level (a short, neutral bar). */
export const HUD_NEUTRAL_FRACTION = 0.3;

export type VolumeStep = 'up' | 'down' | 'mute';

export interface VolumeInput {
  step: VolumeStep;
  /** 0..100 when the driver knows it. */
  level?: number;
}

export interface HudView {
  visible: boolean;
  /** Accessibility label, e.g. "Volume up" or "Volume up, 42". */
  label: string;
  /** Big text: the level ("42") or "Muted"; '' when the direction icon stands in for it. */
  value: string;
  /** Direction icon shown instead of a level the TV does not report ('up' / 'down'), else null. */
  valueIcon: IconName | null;
  /** Speaker icon id (src/ui/icons): 'speaker', or 'mute' when muted / at zero. */
  icon: IconName;
  /** Bar fill 0..1. */
  fraction: number;
  muted: boolean;
  /** True when `value` is a real level from the TV. */
  known: boolean;
  /** Increments on every event (lets the view re-pulse on repeats). */
  seq: number;
}

const SPEAKER: IconName = 'speaker';
const SPEAKER_MUTED: IconName = 'mute';

export const HIDDEN: HudView = {
  visible: false,
  label: '',
  value: '',
  valueIcon: null,
  icon: SPEAKER,
  fraction: 0,
  muted: false,
  known: false,
  seq: 0,
};

function knownLevel(level: unknown): number | undefined {
  if (typeof level !== 'number' || !Number.isFinite(level)) return undefined;
  return Math.round(Math.max(0, Math.min(100, level)));
}

/** What the HUD shows for one event (visible, without seq). */
export function hudFromEvent(e: VolumeInput): Omit<HudView, 'seq'> {
  const level = knownLevel(e.level);
  if (e.step === 'mute') {
    const muted = t('ui.hud.muted');
    return { visible: true, label: muted, value: muted, valueIcon: null, icon: SPEAKER_MUTED, fraction: 0, muted: true, known: false };
  }
  const dir = t(e.step === 'up' ? 'ui.hud.volumeUp' : 'ui.hud.volumeDown');
  if (level !== undefined) {
    return {
      visible: true,
      label: t('ui.hud.volumeLevel', { direction: dir, level }),
      value: formatNumber(level),
      valueIcon: null,
      icon: level === 0 ? SPEAKER_MUTED : SPEAKER,
      fraction: level / 100,
      muted: false,
      known: true,
    };
  }
  return {
    visible: true,
    label: dir,
    value: '',
    valueIcon: e.step === 'up' ? 'up' : 'down',
    icon: SPEAKER,
    fraction: HUD_NEUTRAL_FRACTION,
    muted: false,
    known: false,
  };
}

export interface Timers {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

const defaultTimers: Timers = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
};

/**
 * Shows on every event, hides HUD_HIDE_MS after the last one. Hidden keeps the last label/value
 * so the fade-out still shows the right text. dispose() on unmount.
 */
export class HudController {
  private v: HudView = HIDDEN;
  private handle: unknown = null;

  constructor(
    private readonly onChange: (view: HudView) => void,
    private readonly timers: Timers = defaultTimers,
    private readonly hideMs: number = HUD_HIDE_MS,
  ) {}

  get view(): HudView {
    return this.v;
  }

  push(e: VolumeInput): void {
    this.clear();
    this.set({ ...hudFromEvent(e), seq: this.v.seq + 1 });
    this.handle = this.timers.setTimeout(() => {
      this.handle = null;
      this.set({ ...this.v, visible: false });
    }, this.hideMs);
  }

  dispose(): void {
    this.clear();
  }

  private clear(): void {
    if (this.handle !== null) this.timers.clearTimeout(this.handle);
    this.handle = null;
  }

  private set(v: HudView): void {
    this.v = v;
    try {
      this.onChange(v);
    } catch {
      // A broken view never breaks the timer.
    }
  }
}
