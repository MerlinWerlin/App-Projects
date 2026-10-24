/**
 * Scroll pacing. Pure TS.
 *
 * Three modes (all share the same "pixels per second" output so the prompter only has one animation loop):
 *  - 'steady'  : classic teleprompter, constant speed from WPM and the laid-out text height.
 *  - 'voice'   : Voice Pace. Scrolls at your WPM only while the mic hears you talking, eases to a stop
 *                when you pause. Works in Expo Go (just mic level metering, no speech recognition).
 *  - 'follow'  : Voice Follow. Word-by-word tracking via on-device speech recognition (dev/store build).
 */

export type PaceMode = 'steady' | 'voice' | 'follow';

/** Pixels per second that reads `wpm` words a minute through text `contentHeight` px tall holding `wordCount` words. */
export function pixelsPerSecond(contentHeight: number, wordCount: number, wpm: number): number {
  if (contentHeight <= 0 || wordCount <= 0 || wpm <= 0) return 0;
  return (contentHeight / wordCount) * (wpm / 60);
}

/** Speed nudges from the +/- buttons and pinch: 5% steps, clamped. */
export function nudgeSpeed(mult: number, steps: number): number {
  const next = Math.round((mult + steps * 0.05) * 100) / 100;
  return Math.min(3, Math.max(0.25, next));
}

export interface GateOptions {
  /** dBFS above the noise floor that counts as speech. */
  openAbove: number;
  /** dBFS above the floor below which speech has ended (hysteresis). */
  closeAbove: number;
  /** Silence needed before stopping, ms (natural breaths don't stop the scroll). */
  hangMs: number;
  /** How fast the speed eases in/out (0..1 per tick). */
  ease: number;
}

export const GATE_DEFAULTS: GateOptions = { openAbove: 14, closeAbove: 8, hangMs: 650, ease: 0.25 };

/**
 * Voice gate for Voice Pace: tracks the room's noise floor, opens on speech, holds through short breaths.
 * Feed it metering samples (dBFS, typically -160..0) with timestamps; read `factor` (0..1) to scale the speed.
 */
export class VoiceGate {
  private floor = -50;
  private open = false;
  private lastLoud = -Infinity;
  private f = 0;
  constructor(private readonly opts: GateOptions = GATE_DEFAULTS) {}

  get speaking(): boolean {
    return this.open;
  }
  /** Smoothed 0..1 multiplier for the scroll speed. */
  get factor(): number {
    return this.f;
  }
  get noiseFloor(): number {
    return this.floor;
  }

  sample(db: number, nowMs: number): number {
    const level = Number.isFinite(db) ? Math.max(-160, Math.min(0, db)) : -160;
    // Floor follows quiet quickly and loud slowly, so steady speech isn't mistaken for noise.
    const rate = level < this.floor ? 0.3 : 0.004;
    this.floor = this.floor + (level - this.floor) * rate;
    const above = level - this.floor;
    if (above >= this.opts.openAbove) {
      this.open = true;
      this.lastLoud = nowMs;
    } else if (above >= this.opts.closeAbove && this.open) {
      this.lastLoud = nowMs;
    } else if (this.open && nowMs - this.lastLoud > this.opts.hangMs) {
      this.open = false;
    }
    const target = this.open ? 1 : 0;
    this.f = this.f + (target - this.f) * this.opts.ease;
    if (Math.abs(this.f - target) < 0.01) this.f = target;
    return this.f;
  }
}

/** Countdown steps before scrolling starts (0 = off). */
export const COUNTDOWN_CHOICES = [0, 3, 5, 10] as const;

/** Scroll offset that puts word-line `y` at the reading line (a fraction of the screen height from the top). */
export function offsetForLine(y: number, viewportHeight: number, readingLine: number): number {
  return Math.max(0, y - viewportHeight * readingLine);
}
