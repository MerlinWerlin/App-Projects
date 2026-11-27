import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFERRED_KEY, DEFERRED_STEPS, parseDeferredState, serializeDeferredState } from '../core/deferredWork';
import { isRemoteArtTheme } from '../core/remoteCatalog';
import { parseWidgetLastRead } from '../core/widgetLink';
import { parseWidgetTheme } from '../core/widgetTheme';
import { catalogPack, downloadRemoteArtToDevice, refreshCatalog, remoteArtOnDevice } from '../native/packs';
import { widgets } from '../native/widgets';
import { loadActiveThemeId } from './activeTheme';
import { deferredIdle } from './deferredWork';
import { findAnyThemeById } from './themeLookup';
import { syncThemeWidgetArt, THEME_ART_PENDING_KEY } from './themeWidgetArt';

// v2 (owner 2026-11-08): rebuild once more so pieces drop out of the sizes they were not drawn for.
// v3 (owner 2026-11-08, 1.0.16): and once more so hero copies of pieces (heroCopies.ts) drop out.
// v4 (owner 2026-11-08, 1.0.17): recompose so dim coloured subject parts (the copper moon's limb) stay solid.
// v5 (owner 2026-11-08, 1.0.18): art pieces on the wallpaper sky, art first in every size.
// v6 (owner 2026-11-13, 1.0.28): rebuild once so the index carries the ordered Artwork list (pure
// illustrations only, no date / focus pictures) and the old medium / large copies go.
// v7 (1.0.40): include the four new bundled illustrations when upgrading an active theme.
const RECOVERY_KEY = 'glaze.widgetArt.recovered106.v7';
// Owner 2026-11-27 (1.0.45, Artwork 6-9 and Custom 6-9): NOT a reset. One extra theme sync on the
// first launch of 1.0.45, which only ADDS the theme's medium / large Artwork pieces and the index's
// `artworkMedium` / `artworkLarge` lists. Pieces already made (Artwork 1-5) are skipped, own photos
// and Custom 1-9 pictures (custom-art/, a separate store) are never touched. Retried next launch on failure.
export const ARTWORK_SIZES_KEY = 'glaze.widgetArt.sizes1045.v1';
let recovering: Promise<boolean> | null = null;
let lastError: string | null = null;

export function widgetArtRecoveryError(): string | null { return lastError; }

async function clearPendingArt(): Promise<void> {
  await AsyncStorage.removeItem(THEME_ART_PENDING_KEY);
  const raw = await AsyncStorage.getItem(DEFERRED_KEY);
  if (!raw) return;
  const state = parseDeferredState(raw);
  delete state.pending[DEFERRED_STEPS.themeArt];
  await AsyncStorage.setItem(DEFERRED_KEY, serializeDeferredState(state));
}

async function rebuild(): Promise<boolean> {
  lastError = null;
  try {
    const reset = await widgets.resetArtForRecovery();
    if (!reset.available) return false;
    if (!reset.ok) throw new Error('Could not reset widget art');
    await clearPendingArt();
    const id = await loadActiveThemeId();
    if (!id) {
      await AsyncStorage.setItem(RECOVERY_KEY, 'complete');
      return true;
    }
    // The restored path consumes the installed theme pack. Resolve a missing pack through
    // the catalogue, retaining its production release, before asking 1.0.6 to compose it.
    await refreshCatalog(false);
    const theme = await findAnyThemeById(id);
    if (!theme) throw new Error('Current theme is unavailable');
    if (isRemoteArtTheme(theme) && !await remoteArtOnDevice(id)) {
      if (!catalogPack(id)) throw new Error('Current theme release is unavailable');
      const error = await downloadRemoteArtToDevice(id);
      if (error) throw new Error(error);
    }
    const result = await syncThemeWidgetArt(theme);
    if (!result.available || !result.ok || result.failed || result.superseded) {
      throw new Error('Could not rebuild all widget art');
    }
    const library = await widgets.artLibrary();
    if (!library.ok) throw new Error('Could not read rebuilt widget art');
    await AsyncStorage.setItem(RECOVERY_KEY, 'complete');
    // A full rebuild with this build's planner already made Artwork 6-9.
    await AsyncStorage.setItem(ARTWORK_SIZES_KEY, 'complete');
    return true;
  } catch (error) {
    lastError = (error instanceof Error ? error.message : String(error)).slice(0, 180);
    return false;
  }
}

/**
 * 1.0.45: the one additive sync described at ARTWORK_SIZES_KEY. Never syncs a theme whose pack is not
 * on the device (that would plan no art and empty the Artwork lists); it downloads it first, like rebuild.
 */
async function addArtworkSizes(): Promise<boolean> {
  try {
    if (await AsyncStorage.getItem(ARTWORK_SIZES_KEY) === 'complete') return true;
    const lib = await widgets.artLibrary();
    if (!lib.available) return false;
    const id = await loadActiveThemeId();
    if (!id) {
      await AsyncStorage.setItem(ARTWORK_SIZES_KEY, 'complete');
      return true;
    }
    await refreshCatalog(false);
    const theme = await findAnyThemeById(id);
    if (!theme) return false;
    if (isRemoteArtTheme(theme) && !await remoteArtOnDevice(id)) {
      if (!catalogPack(id)) return false;
      if (await downloadRemoteArtToDevice(id)) return false;
    }
    const result = await syncThemeWidgetArt(theme);
    if (!result.available || !result.ok || result.superseded) return false;
    await AsyncStorage.setItem(ARTWORK_SIZES_KEY, 'complete');
    return true;
  } catch (error) {
    lastError = (error instanceof Error ? error.message : String(error)).slice(0, 180);
    return false;
  }
}

/** Runs before the old deferred queue reads its persisted pending state. */
export function prepareWidgetArtRecovery(): Promise<boolean> {
  if (recovering) return recovering;
  recovering = (async () => {
    try {
      if (await AsyncStorage.getItem(RECOVERY_KEY) === 'complete') return await addArtworkSizes();
      return await rebuild();
    } catch (error) {
      lastError = String(error).slice(0, 180);
      return false;
    }
  })().finally(() => { recovering = null; });
  return recovering;
}

export async function rebuildWidgetArt(): Promise<boolean> {
  await deferredIdle();
  if (recovering) return recovering;
  recovering = rebuild().finally(() => { recovering = null; });
  return recovering;
}

export async function widgetArtRecoveryDiagnostics() {
  const [active, link, library] = await Promise.all([loadActiveThemeId(), widgets.linkStatus(), widgets.artLibrary()]);
  const pieces = library.pieces.filter(piece => piece.themeId === active && !piece.live?.design);
  return {
    active, shared: parseWidgetTheme(link.storedTheme)?.themeId,
    read: parseWidgetLastRead(link.lastRead)?.themeId, artTheme: pieces[0]?.themeId,
    composed: pieces.length, lastError,
  };
}
