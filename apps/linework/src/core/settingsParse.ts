// User settings shape, defaults and parser (PLAN §3 /settings). Pure: src/native/settings.ts stores them.

import type { OutlineStyle } from './outline.ts';
import { DEFAULT_OUTLINE_STYLE, isOutlineStyle } from './outlineStyleParam.ts';

export type GridDefault = 'off' | '3x3' | '4x4';

export type Settings = {
  defaultOpacity: number;
  haptics: boolean;
  keepAwake: boolean;
  gridDefault: GridDefault;
  /** T64: camera autofocus is held while the overlay is locked (no refocusing when a hand enters the frame). */
  focusLock: boolean;
  /** T54 / D72-1: outline style Prepare starts with ('classic' = the "Best match" preset). */
  outlineStyle: OutlineStyle;
};

export const DEFAULT_SETTINGS: Settings = {
  defaultOpacity: 0.5,
  haptics: true,
  keepAwake: true,
  gridDefault: 'off',
  focusLock: true,
  outlineStyle: DEFAULT_OUTLINE_STYLE,
};

/** Stored JSON (any shape) -> valid Settings; unknown or bad fields fall back to the defaults. */
export function sanitizeSettings(raw: unknown): Settings {
  const out: Settings = { ...DEFAULT_SETTINGS };
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as Record<string, unknown>;
  if (typeof r.defaultOpacity === 'number' && Number.isFinite(r.defaultOpacity)) {
    out.defaultOpacity = Math.min(1, Math.max(0.05, r.defaultOpacity));
  }
  if (typeof r.haptics === 'boolean') out.haptics = r.haptics;
  if (typeof r.keepAwake === 'boolean') out.keepAwake = r.keepAwake;
  if (r.gridDefault === 'off' || r.gridDefault === '3x3' || r.gridDefault === '4x4') out.gridDefault = r.gridDefault;
  if (typeof r.focusLock === 'boolean') out.focusLock = r.focusLock;
  if (isOutlineStyle(r.outlineStyle)) out.outlineStyle = r.outlineStyle;
  return out;
}
