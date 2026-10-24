// T130: the art-pack themes the app ships (themes/<id>/, listed in the generated
// src/core/artPackLibrary.ts). Free starter themes; their wallpaper is a bundled image
// (src/ui/artPackAssets.ts), with a drawn fallback in `wallpaper` for places that can't show it.
// Pure TS (Node-tested).

import { artPackTheme, isArtPackTheme, type ArtPackTheme } from './artPack.ts';
import { ART_PACK_LIBRARY } from './artPackLibrary.ts';

export const ART_PACK_THEMES: readonly ArtPackTheme[] = Object.freeze(ART_PACK_LIBRARY.map(artPackTheme));

export function artPackThemeById(id: string | null | undefined): ArtPackTheme | undefined {
  if (typeof id !== 'string') return undefined;
  return ART_PACK_THEMES.find((t) => t.id === id);
}

export function isArtPackThemeId(id: string | null | undefined): boolean {
  return !!artPackThemeById(id);
}

/** The art-pack part of a theme or id (null when it is not an art-pack theme). */
export function artPackOf(theme: { id: string } | string | null | undefined): ArtPackTheme | null {
  if (!theme) return null;
  if (typeof theme !== 'string' && isArtPackTheme(theme)) return theme;
  return artPackThemeById(typeof theme === 'string' ? theme : theme.id) ?? null;
}
