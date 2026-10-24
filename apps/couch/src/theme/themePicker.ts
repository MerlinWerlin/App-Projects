/**
 * What tapping a theme on the Themes screen does (owner-1017 T56). Pure TS.
 * - a free theme, or any theme with Couch Plus: apply it (saved per device) and stop any trial;
 * - a Plus theme without Plus: "Try it" for this session (the real remote shows it too), with a
 *   way to get Couch Plus (one-time purchase) to keep it, or to stop trying.
 * Never locks the remote: without Plus a chosen Plus theme just shows the default (Charcoal & Gold).
 */
import { DEFAULT_REMOTE_THEME, REMOTE_THEMES, isFreeRemoteTheme, type RemoteThemeId } from './remoteThemes';

export type ThemePick = { kind: 'apply'; id: RemoteThemeId } | { kind: 'try'; id: RemoteThemeId };

export function pickTheme(id: RemoteThemeId, opts: { plus: boolean }): ThemePick {
  return isFreeRemoteTheme(id) || opts.plus ? { kind: 'apply', id } : { kind: 'try', id };
}

/** The theme the Themes screen previews: the one being tried, else the chosen one (as shown). */
export function previewThemeId(chosen: RemoteThemeId, opts: { plus: boolean; trying: RemoteThemeId | null }): RemoteThemeId {
  if (opts.trying) return opts.trying;
  return isFreeRemoteTheme(chosen) || opts.plus ? chosen : DEFAULT_REMOTE_THEME;
}

/** Badge for a theme tile. */
export function themeBadge(id: RemoteThemeId): 'free' | 'plus' {
  return REMOTE_THEMES[id].tier;
}
