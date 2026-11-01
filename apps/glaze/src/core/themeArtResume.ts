// T260: the deferred 'themeArt' step (T250) resumed on the next launch has no Theme in memory (the
// queue persists only the step name), so it used to run only replaceThemeArt by id: the previous
// theme's art went, but the T252 auto-add of every piece of the theme in use never happened.
// The step now looks the theme in use up by id and runs the full sync (syncThemeWidgetArt); only a
// theme that can't be found anywhere falls back to replaceThemeArt.
//
// Pure helpers (Node runs them; tested in themeArtResume.test.ts). The lookups themselves (bundled
// themes, the in-memory remote catalogue, downloaded packs on disk) are src/store/themeLookup.ts.
// No network: a launch never fetches the catalogue just to resume this step.
import type { PackCacheIndex } from './themePack.ts';
import type { RemoteArtManifest } from './packCatalog.ts';
import { remoteArtTheme, type RemoteArtTheme } from './remoteCatalog.ts';

/** One way to find a theme by id: sync or async, may return nothing, may throw (treated as nothing). */
export type ThemeFinder<T> = (id: string) => T | null | undefined | Promise<T | null | undefined>;

/**
 * The first theme any finder returns for `id`, tried in order (bundled first, so lookups of themes
 * people already applied are unchanged). A finder that throws or rejects is skipped. Never rejects;
 * null for a missing / blank id or when nothing finds it.
 */
export async function findThemeById<T extends { id: string }>(id: string | null | undefined, finders: readonly ThemeFinder<T>[]): Promise<T | null> {
  if (typeof id !== 'string' || id.length === 0) return null;
  for (const find of finders) {
    try {
      const hit = await find(id);
      // Only a theme with the asked id counts (a finder returning a fallback theme is ignored).
      if (hit && typeof hit === 'object' && hit.id === id) return hit;
    } catch {
      // Unreadable source: try the next one.
    }
  }
  return null;
}

/** Where a downloaded copy of theme `id` lives in the pack index (see src/core/themePack.ts). */
export type DownloadedThemeSource = {
  /** A downloaded remote art pack with this id (one theme per pack: pack id = theme id). */
  remoteArt: boolean;
  /** Downloaded theme packs whose `themeIds` list it (ids of the packs). */
  packs: string[];
};

export function downloadedThemeSource(index: PackCacheIndex | null | undefined, id: string): DownloadedThemeSource {
  const packs = index && Array.isArray(index.packs) ? index.packs : [];
  return {
    remoteArt: packs.some((p) => p && p.id === id),
    packs: packs.filter((p) => p && p.id !== id && Array.isArray(p.themeIds) && p.themeIds.includes(id)).map((p) => p.id),
  };
}

/**
 * The remote art theme for a downloaded pack, built from its manifest alone (the catalogue may not
 * be in memory yet at launch, and offline it may never be). Same shape as the gallery's theme for the
 * pack (remoteArtTheme), which is all syncThemeWidgetArt needs: id, name, palette, art pack, remote ref.
 */
export function remoteThemeFromManifest(m: RemoteArtManifest): RemoteArtTheme {
  return remoteArtTheme(
    {
      id: m.id,
      name: m.name,
      packVersion: m.packVersion,
      plus: m.plus,
      bytes: m.totalBytes,
      manifest: '',
      thumb: '',
      thumbhash: m.thumbhash,
      palette: m.palette,
      tags: Array.isArray(m.meta?.tags) ? m.meta.tags : [],
      mood: typeof m.meta?.mood === 'string' ? m.meta.mood : '',
      addedAt: typeof m.meta?.addedAt === 'string' ? m.meta.addedAt : '',
      category: typeof m.meta?.category === 'string' ? m.meta.category : '',
    },
    // No base URL: no thumbnail URL is made (nothing here is fetched).
    null,
  );
}

/** What the resumed step does: the full T252 sync with the found theme, else replace-by-id (T238). */
export type ThemeArtResumePlan<T> = { kind: 'sync'; theme: T } | { kind: 'replace'; themeId: string } | { kind: 'none' };

export function themeArtResumePlan<T extends { id: string }>(themeId: string | null | undefined, found: T | null | undefined): ThemeArtResumePlan<T> {
  if (typeof themeId !== 'string' || themeId.length === 0) return { kind: 'none' };
  if (found && found.id === themeId) return { kind: 'sync', theme: found };
  return { kind: 'replace', themeId };
}
