/** Prompter + app preferences. Pure TS with a tolerant parser (unknown or bad values fall back to defaults). */
import type { PaceMode } from './pace';

export type ThemePref = 'system' | 'light' | 'dark';
export type PrompterColors = 'classic' | 'paper' | 'night' | 'contrast';

export interface Prefs {
  version: 1;
  theme: ThemePref;
  haptics: boolean;
  reduceMotion: 'system' | 'on' | 'off';
  /** Prompter */
  fontSize: number;
  lineHeight: number;
  margin: number;
  mirrorH: boolean;
  mirrorV: boolean;
  readingLine: number;
  countdown: number;
  pace: PaceMode;
  colors: PrompterColors;
  showNotes: boolean;
  highlightLine: boolean;
  showTimer: boolean;
  align: 'left' | 'center';
  bold: boolean;
  /** Record */
  recordCamera: 'front' | 'back';
  scriptOpacity: number;
  locale: string | 'system';
  seenWelcome: boolean;
}

export const DEFAULT_PREFS: Prefs = {
  version: 1,
  theme: 'system',
  haptics: true,
  reduceMotion: 'system',
  fontSize: 38,
  lineHeight: 1.35,
  margin: 24,
  mirrorH: false,
  mirrorV: false,
  readingLine: 0.33,
  countdown: 3,
  pace: 'steady',
  colors: 'classic',
  showNotes: true,
  highlightLine: true,
  showTimer: true,
  align: 'left',
  bold: false,
  recordCamera: 'front',
  scriptOpacity: 0.55,
  locale: 'system',
  seenWelcome: false,
};

export const PREFS_KEY = 'cue.prefs.v1';
export const FONT_MIN = 20;
export const FONT_MAX = 96;

const clamp = (n: unknown, lo: number, hi: number, d: number) =>
  typeof n === 'number' && Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
const pick = <T extends string>(v: unknown, allowed: readonly T[], d: T): T =>
  (allowed as readonly unknown[]).includes(v) ? (v as T) : d;
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);

export function parsePrefs(raw: string | null): Prefs {
  let o: Record<string, unknown> = {};
  try {
    o = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    if (!o || typeof o !== 'object') o = {};
  } catch {
    o = {};
  }
  const d = DEFAULT_PREFS;
  return {
    version: 1,
    theme: pick(o.theme, ['system', 'light', 'dark'] as const, d.theme),
    haptics: bool(o.haptics, d.haptics),
    reduceMotion: pick(o.reduceMotion, ['system', 'on', 'off'] as const, d.reduceMotion),
    fontSize: clamp(o.fontSize, FONT_MIN, FONT_MAX, d.fontSize),
    lineHeight: clamp(o.lineHeight, 1.1, 2, d.lineHeight),
    margin: clamp(o.margin, 8, 120, d.margin),
    mirrorH: bool(o.mirrorH, d.mirrorH),
    mirrorV: bool(o.mirrorV, d.mirrorV),
    readingLine: clamp(o.readingLine, 0.15, 0.6, d.readingLine),
    countdown: clamp(o.countdown, 0, 10, d.countdown),
    pace: pick(o.pace, ['steady', 'voice', 'follow'] as const, d.pace),
    colors: pick(o.colors, ['classic', 'paper', 'night', 'contrast'] as const, d.colors),
    showNotes: bool(o.showNotes, d.showNotes),
    highlightLine: bool(o.highlightLine, d.highlightLine),
    showTimer: bool(o.showTimer, d.showTimer),
    align: pick(o.align, ['left', 'center'] as const, d.align),
    bold: bool(o.bold, d.bold),
    recordCamera: pick(o.recordCamera, ['front', 'back'] as const, d.recordCamera),
    scriptOpacity: clamp(o.scriptOpacity, 0.2, 0.9, d.scriptOpacity),
    locale: typeof o.locale === 'string' ? o.locale : d.locale,
    seenWelcome: bool(o.seenWelcome, d.seenWelcome),
  };
}
