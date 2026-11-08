// T260: a theme by id without React (the deferred 'themeArt' step resumed on the next launch has
// only the stored id of the theme in use). Reuses the app's lookups, in the same order as
// useAnyTheme: bundled themes first (getAnyTheme: starter, Plus, Space, art packs), then the remote
// catalogue already in memory, then what is downloaded on this phone (a remote art pack's manifest,
// or a theme pack's themes). No network, never rejects. Only called from deferred work, never on
// the launch path (it may read pack files).
import { getAnyTheme } from '../core/plusThemes';
import { remoteArtTheme } from '../core/remoteCatalog';
import { downloadedThemeSource, findThemeById, remoteThemeFromManifest, type ThemeFinder } from '../core/themeArtResume';
import type { Theme } from '../core/themes';
import { PACK_BASE_RESOLVED, catalogPack, getPackState, loadPackIndex, packThemesOnDevice, remoteArtOnDevice } from '../native/packs';

const bundled: ThemeFinder<Theme> = (id) => getAnyTheme(id);

/** The gallery's theme for a catalogue pack, when the catalogue is in memory (no fetch). */
const catalogue: ThemeFinder<Theme> = (id) => {
  const p = catalogPack(id);
  return p ? remoteArtTheme(p, PACK_BASE_RESOLVED) : undefined;
};

/** A downloaded copy: a remote art pack (built from its manifest) or a theme pack listing the id. */
const downloaded: ThemeFinder<Theme> = async (id) => {
  await loadPackIndex();
  const where = downloadedThemeSource(getPackState().index, id);
  if (where.remoteArt) {
    const m = await remoteArtOnDevice(id);
    if (m && m.id === id) return remoteThemeFromManifest(m);
  }
  for (const packId of where.packs) {
    const hit = (await packThemesOnDevice(packId)).find((t) => t.id === id);
    if (hit) return hit;
  }
  return undefined;
};

/** The theme with this id from anywhere the app knows it, or null. Never rejects. */
export function findAnyThemeById(id: string | null | undefined): Promise<Theme | null> {
  return findThemeById<Theme>(id, [bundled, catalogue, downloaded]);
}
