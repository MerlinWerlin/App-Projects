// Theme detail × downloadable packs (T47). Maps what src/plus/usePackAccess reports for a theme to
// what app/theme/[id].tsx shows: a Download button, a progress bar, an error with Try again, or a
// quiet "downloaded" note, and whether the usual Apply actions are offered. Also picks the pack's
// downloaded artwork over the bundled copy. Entitlement is decided in src/plus (never here): this
// only maps the state it is given.
// Pure TS (no React Native / Expo) so Node can run and test it directly.

import type { Theme } from './themes.ts';

/** Mirrors src/plus/usePackAccess.ts PackAccessState (core must not import src/plus). */
export type PackAccessState = 'free' | 'locked' | 'ready' | 'disabled' | 'not-downloaded' | 'downloading' | 'error';

export type PackAccessInput = {
  state: PackAccessState;
  /** 0..1 while downloading. */
  progress: number;
  error: string | null;
};

/**
 * - none: not a pack theme (starter or bundled-only Plus theme); the detail shows nothing extra.
 * - locked: pack theme without Glaze Plus. Apply opens the Plus sheet as before.
 * - bundled: Plus owned, packs not hosted yet; the bundled copy is used. Apply works.
 * - download: Plus owned, pack not on the phone. Download replaces Apply.
 * - downloading: progress bar, no Apply.
 * - error: the error and Try again, no Apply.
 * - ready: pack downloaded; its artwork is used. Apply works.
 */
export type PackDetailView =
  | { kind: 'none' }
  | { kind: 'locked' }
  | { kind: 'bundled' }
  | { kind: 'download' }
  | { kind: 'downloading'; progress: number; percent: number }
  | { kind: 'error'; message: string | null }
  | { kind: 'ready' };

export type PackDetailKind = PackDetailView['kind'];

/** 0..1, finite. */
function clamp01(v: number): number {
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
}

export function packDetailView(theme: Pick<Theme, 'plus' | 'packId'> | null | undefined, access: PackAccessInput): PackDetailView {
  if (!theme || !theme.plus || !theme.packId) return { kind: 'none' };
  switch (access.state) {
    case 'free':
      return { kind: 'none' };
    case 'locked':
      return { kind: 'locked' };
    case 'disabled':
      return { kind: 'bundled' };
    case 'ready':
      return { kind: 'ready' };
    case 'downloading': {
      const progress = clamp01(access.progress);
      // Never claim 100% before the files are verified and the state flips to ready.
      return { kind: 'downloading', progress, percent: Math.min(99, Math.floor(progress * 100)) };
    }
    case 'error':
      return { kind: 'error', message: access.error && access.error.trim() ? access.error : null };
    case 'not-downloaded':
      return { kind: 'download' };
    default:
      return { kind: 'none' };
  }
}

/** Whether the detail offers Apply / Edit wallpaper / overrides (locked still shows Apply, which opens the Plus sheet). */
export function canApplyFromDetail(view: PackDetailView): boolean {
  return view.kind === 'none' || view.kind === 'locked' || view.kind === 'bundled' || view.kind === 'ready';
}

/** Whether the detail shows its pack card at all. */
export function showsPackCard(view: PackDetailView): boolean {
  return view.kind !== 'none';
}

/** True when the downloaded pack files should be read for this theme. */
export function wantsPackArtwork(view: PackDetailView): boolean {
  return view.kind === 'ready';
}

/**
 * The theme to show: the downloaded pack's copy of `base` (same id, same pack) when there is one,
 * otherwise `base`. Starter themes and bundled-only Plus themes always come back unchanged.
 */
export function preferPackTheme(base: Theme, downloaded: readonly Theme[] | null | undefined): Theme {
  if (!base.plus || !base.packId || !downloaded) return base;
  const fromPack = downloaded.find((t) => t.id === base.id && t.packId === base.packId && t.plus);
  return fromPack ?? base;
}
