// Android payloads for the GlazeAndroid native module (docs/ANDROID.md, T13).
// Pure TS (no React Native / Expo): builds the JSON strings the Kotlin side parses.
//  - Pinned shortcuts: ShortcutInfo ids are ≤ 64 chars here, short label ≤ 10, long label ≤ 25
//    (Android's recommended label lengths for launchers).
//  - Live wallpaper: { uri, trim, speed } read by GlazeVideoWallpaperService from SharedPreferences.

import type { LoopProject, LoopSpeed } from './loop.ts';
import { androidShortcutTarget, type AndroidShortcutTarget } from './androidShortcut.ts';

export const SHORTCUT_ID_MAX = 64;
export const SHORT_LABEL_MAX = 10;
export const LONG_LABEL_MAX = 25;
export const SHORTCUT_ID_PREFIX = 'glaze-';

/** Stable, launcher-safe shortcut id: "glaze-" + [a-z0-9._-], at most 64 chars. */
export function shortcutId(appId: string): string {
  const body = String(appId ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${SHORTCUT_ID_PREFIX}${body || 'icon'}`.slice(0, SHORTCUT_ID_MAX).replace(/[-.]+$/g, '');
}

/** Collapse whitespace and cut to `max` chars, ending with "…" when cut. "App" when empty. */
export function fitLabel(label: string, max: number): string {
  const clean = String(label ?? '').replace(/\s+/g, ' ').trim() || 'App';
  const chars = Array.from(clean);
  if (chars.length <= max) return clean;
  if (max <= 1) return chars.slice(0, Math.max(0, max)).join('');
  return `${chars.slice(0, max - 1).join('').trimEnd()}…`;
}

export const shortLabel = (label: string): string => fitLabel(label, SHORT_LABEL_MAX);
export const longLabel = (label: string): string => fitLabel(label, LONG_LABEL_MAX);

export type PinShortcutPayload = AndroidShortcutTarget & {
  id: string;
  label: string;
  longLabel: string;
  pngBase64: string;
};

/** Payload for GlazeAndroid.pinShortcut, or null when there is no link to open or no icon. */
export function pinShortcutPayload(
  spec: { appId: string; label: string; urlScheme: string | null },
  pngBase64: string,
): PinShortcutPayload | null {
  const target = androidShortcutTarget(spec);
  const png = String(pngBase64 ?? '').replace(/\s+/g, '');
  if (!target || !png) return null;
  return {
    id: shortcutId(spec.appId),
    label: shortLabel(spec.label),
    longLabel: longLabel(spec.label),
    ...target,
    pngBase64: png,
  };
}

export type WallpaperPayload = {
  uri: string;
  /** endMs 0 = play to the end of the file. */
  trim: { startMs: number; endMs: number };
  speed: LoopSpeed;
};

/**
 * Payload for GlazeAndroid.setVideoWallpaper, or null for projects the service can't play
 * (GIFs: MediaPlayer plays video files only; missing source).
 */
export function wallpaperPayload(project: LoopProject): WallpaperPayload | null {
  if (!project || project.kind !== 'video' || !project.sourceUri) return null;
  let start = Math.max(0, Math.round(Number.isFinite(project.trim?.startMs) ? project.trim.startMs : 0));
  const rawEnd = Math.round(Number.isFinite(project.trim?.endMs) ? project.trim.endMs : 0);
  const dur = Math.max(0, Math.round(project.sourceDurationMs || 0));
  // Full-length or unknown ranges loop the whole file.
  const end = rawEnd > start && !(dur > 0 && rawEnd >= dur) ? rawEnd : 0;
  if (dur > 0 && start >= dur) start = 0;
  const speed: LoopSpeed = project.speed === 0.5 || project.speed === 1.5 ? project.speed : 1;
  return { uri: project.sourceUri, trim: { startMs: start, endMs: end }, speed };
}

export function wallpaperJson(project: LoopProject): string | null {
  const p = wallpaperPayload(project);
  return p ? JSON.stringify(p) : null;
}

export function pinShortcutJson(
  spec: { appId: string; label: string; urlScheme: string | null },
  pngBase64: string,
): string | null {
  const p = pinShortcutPayload(spec, pngBase64);
  return p ? JSON.stringify(p) : null;
}
