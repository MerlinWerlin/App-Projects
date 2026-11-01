// T252 (owner-1101h #3): applying a theme AUTOMATICALLY adds all of that theme's widget art to
// "My widget art" and removes the previous theme's auto-added art (own photos stay), so Edit
// Widget > Art lists the current theme's pieces straight after a swap. No visit to My widget art
// needed (it still makes a medium / large of a piece by hand: ThemeWidgetArt "Use on my widget").
//
// syncThemeWidgetArt(theme) is the one entry point (applyThemeEverywhere calls it; T250's deferred
// queue may call it after the first frame instead). One run:
//   1. no widget bridge (Expo Go, Android, older build) → returns { available: false } at once;
//   2. plans every piece of the theme (src/core/themeArtSync.ts planThemePieces, deterministic ids);
//   3. composes each piece NOT already in the index straight into the App Group (bridge
//      composeWidgetArtPiece / composeSeamlessPiece: no index write, no reload; a file already on
//      disk from an interrupted run is skipped), one at a time with a yield between pieces;
//   4. ONE index write (commitThemeArt): new set listed, previous theme's auto pieces removed (and
//      remembered for the widget's slot remap), own photos kept, current theme id recorded. The
//      bridge then prunes unlisted files (partial / failed pieces) and only AFTER the write reloads
//      every timeline.
// Idempotent and crash-safe: killed before step 4, the old index is untouched and the next run
// (same theme) finishes the job quickly; pendingThemeWidgetArt() tells a launch queue it is due.
// A newer apply supersedes an older run (it stops before its index write). Never throws.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ART_WALLPAPER_SIZE, HERO_REFERENCE_SIZES, HERO_SIZES, isArtPackTheme } from '../core/artPack';
import { liveArtPlan, liveArtSpec, withLiveArt } from '../core/liveArt';
import { pickWallpaper } from '../core/packCatalog';
import { isRemoteArtTheme, remoteArtFiles } from '../core/remoteCatalog';
import { normaliseSlot, seamlessCrop, widgetSizePx } from '../core/seamlessWidget';
import { piecesToCompose, planThemePieces, type PlannedThemePiece } from '../core/themeArtSync';
import type { Theme } from '../core/themes';
import type { WidgetArtIndex } from '../core/widgetArtLibrary';
import { optionName, widgetOptionsFromV1, type HomeOptionSize, type WidgetOption } from '../core/widgetOptions';
import { t } from '../i18n';
import { getPackState, loadPackIndex, remoteArtFileUri, remoteArtOnDevice } from '../native/packs';
import { widgets, type WidgetsResult } from '../native/widgets';
import { artPackHero, artPackWallpaper } from '../ui/artPackSources';
import { existingLocalFile, localAssetUri, seamlessDeviceHere } from '../ui/seamlessSetup';

/** AsyncStorage: the theme whose art sync started and has not committed yet (cleared on commit). */
export const THEME_ART_PENDING_KEY = 'glaze.themeArtSync.pending.v1';

export type ThemeArtSyncResult = {
  available: boolean;
  ok: boolean;
  /** Pieces whose image was made this run. */
  composed: number;
  /** Pieces whose image could not be made (left out of the index; a later apply retries). */
  failed: number;
  /** A newer apply started; this run stopped before its index write. */
  superseded?: boolean;
};

export type ThemeArtSyncOptions = {
  /** Awaited between pieces (default: one macrotask), so the UI keeps running. */
  yieldBetween?: () => Promise<void>;
};

/** One piece's source: the art file (bundled module or downloaded URI) behind a widget option. */
type Source = { option: WidgetOption; mod?: number; uri?: string };

type ThemeArt = {
  options: WidgetOption[];
  sources: Map<string, Source>;
  /** Resolves the wallpaper to a local file (only wallpaper-backed pieces need it). */
  wallpaper: () => Promise<string | null>;
  wallpaperPx: { w: number; h: number };
};

let generation = 0;
let running: Promise<unknown> = Promise.resolve();

/**
 * T252: add every widget art piece of `theme` to My widget art and remove the previous theme's
 * auto-added art (own photos stay), in one index write. Runs after any earlier sync; a newer call
 * supersedes this one. No-op { available: false } in Expo Go / Android. Never rejects.
 */
export function syncThemeWidgetArt(theme: Theme, opts: ThemeArtSyncOptions = {}): Promise<ThemeArtSyncResult> {
  const gen = ++generation;
  const job = running.then(
    () => runSync(theme, gen, opts),
    () => runSync(theme, gen, opts),
  );
  running = job.catch(() => undefined);
  return job;
}

/** T252: the theme id whose art sync was interrupted (app killed) and should run again, or null. */
export async function pendingThemeWidgetArt(): Promise<string | null> {
  try {
    const v = await AsyncStorage.getItem(THEME_ART_PENDING_KEY);
    return v && v.length > 0 ? v : null;
  } catch {
    return null;
  }
}

const NONE: ThemeArtSyncResult = { available: false, ok: false, composed: 0, failed: 0 };
const defaultYield = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

async function runSync(theme: Theme, gen: number, opts: ThemeArtSyncOptions): Promise<ThemeArtSyncResult> {
  const stale = () => gen !== generation;
  const pause = opts.yieldBetween ?? defaultYield;
  try {
    if (stale()) return { ...NONE, available: true, superseded: true };
    // 1. Nothing to do without the library bridge (Expo Go, Android, older build): no file work.
    const current = await widgets.artLibrary();
    if (!current.available) return NONE;
    await setPending(theme.id);
    // 2. Plan.
    const art = await themeArt(theme);
    const planned = plan(theme, art.options);
    const lib: WidgetArtIndex = { v: 1, pieces: current.pieces };
    const todo = piecesToCompose(lib, planned);
    // 3. Compose the missing pieces, one at a time.
    const ready: string[] = [];
    let failed = 0;
    let composeSupported = true;
    for (const piece of todo) {
      if (stale()) return { available: true, ok: false, composed: ready.length, failed, superseded: true };
      if (!composeSupported) break;
      const r = await composeOne(theme, art, piece);
      if (r === 'not-built') {
        // An older bridge: no per-piece compose. The commit below still replaces the old theme's art.
        composeSupported = false;
        break;
      }
      if (r === 'ok') ready.push(piece.id);
      else failed++;
      await pause();
    }
    if (!composeSupported) failed += todo.length - ready.length - failed;
    if (stale()) return { available: true, ok: false, composed: ready.length, failed, superseded: true };
    // 4. The one index write; the bridge prunes unlisted files, then reloads every timeline.
    const res = await widgets.commitThemeArt(theme.id, planned, ready);
    if (res.ok) await clearPending(theme.id);
    return { available: res.available, ok: res.ok, composed: ready.length, failed };
  } catch {
    return { available: true, ok: false, composed: 0, failed: 0 };
  }
}

function plan(theme: Theme, options: WidgetOption[]): PlannedThemePiece[] {
  const device = seamlessDeviceHere();
  const tr = t as unknown as (k: string, p?: Record<string, unknown>) => string;
  const sizeLabel = (s: HomeOptionSize) =>
    s === 'small' ? t('ui.seamless.sizes.small') : s === 'medium' ? t('ui.seamless.sizes.medium') : t('ui.seamless.sizes.large');
  return planThemePieces({
    themeId: theme.id,
    themeName: theme.name,
    options,
    name: (option, size) => {
      const n = optionName(option, options);
      return `${'text' in n ? n.text : tr(n.key, n.params)} · ${sizeLabel(size)}`;
    },
    aspect: (size) => {
      const px = widgetSizePx(device, size);
      return px.h > 0 ? px.w / px.h : 0;
    },
    live: (option, size) => {
      // T237: the same live spec "Use on my widget" saves (ThemeWidgetArt).
      const p = liveArtPlan(theme.id, option);
      if (!p) return null;
      const px = widgetSizePx(device, size);
      return liveArtSpec(p, { w: option.width, h: option.height }, px, option.background === 'wallpaper' ? 'fit' : 'bleed', {
        bg: theme.palette.bg,
        ink: theme.palette.ink,
      });
    },
  });
}

/** Every widget option of the theme with its art source (same lists as ThemeWidgetArt). */
async function themeArt(theme: Theme): Promise<ThemeArt> {
  const empty: ThemeArt = { options: [], sources: new Map(), wallpaper: async () => null, wallpaperPx: { w: ART_WALLPAPER_SIZE.width, h: ART_WALLPAPER_SIZE.height } };
  try {
    if (isRemoteArtTheme(theme)) {
      // A downloaded remote pack: its v2 `widgets` list (or the options derived from v1).
      await loadPackIndex();
      if (!getPackState().index.packs.some((p) => p.id === theme.id)) return empty;
      const local = await remoteArtOnDevice(theme.id);
      if (!local) return empty;
      const raw = local.widgets ?? [];
      const live = withLiveArt(theme.id, raw);
      const sources = new Map<string, Source>();
      const options: WidgetOption[] = [];
      live.forEach((option) => {
        const uri = remoteArtFileUri(theme.id, option.image);
        if (!uri) return;
        options.push(option);
        sources.set(option.id, { option, uri });
      });
      const files = remoteArtFiles(local);
      const wallUri = remoteArtFileUri(theme.id, files.wallpaper);
      const wall = pickWallpaper(local, Number.MAX_SAFE_INTEGER);
      return {
        options,
        sources,
        wallpaper: () => existingLocalFile(wallUri),
        wallpaperPx: wall ? { w: wall.width, h: wall.height } : empty.wallpaperPx,
      };
    }
    if (isArtPackTheme(theme)) {
      // A bundled art pack: its hero pieces, as a v1 pack would list them.
      const artId = theme.artPack.id;
      const mods = new Map<string, number>();
      const assets = HERO_SIZES.flatMap((s) => {
        const mod = artPackHero(artId, s);
        if (mod === null) return [];
        const path = `bundled-${s}`;
        mods.set(path, mod);
        return [{ path, role: `widget-${s}`, width: HERO_REFERENCE_SIZES[s].width, height: HERO_REFERENCE_SIZES[s].height }];
      });
      const sources = new Map<string, Source>();
      const options: WidgetOption[] = [];
      for (const option of widgetOptionsFromV1(assets)) {
        const mod = mods.get(option.image);
        if (mod === undefined) continue;
        options.push(option);
        sources.set(option.id, { option, mod });
      }
      let wall: Promise<string | null> | null = null;
      return {
        options,
        sources,
        wallpaper: () => {
          if (!wall) wall = localAssetUri(artPackWallpaper(artId), `${artId}-wallpaper.png`);
          return wall;
        },
        wallpaperPx: empty.wallpaperPx,
      };
    }
  } catch {
    // Unreadable pack: no pieces (the commit still removes the previous theme's art).
  }
  return empty;
}

async function composeOne(theme: Theme, art: ThemeArt, piece: PlannedThemePiece): Promise<'ok' | 'failed' | 'not-built'> {
  const src = art.sources.get(piece.optionId);
  if (!src) return 'failed';
  const artUri = src.mod !== undefined ? await localAssetUri(src.mod, `${theme.id}-${src.option.id}.png`) : await existingLocalFile(src.uri ?? null);
  if (!artUri) return 'failed';
  const device = seamlessDeviceHere();
  let res: WidgetsResult;
  if (src.option.background === 'wallpaper') {
    const wallpaperUri = await art.wallpaper();
    if (!wallpaperUri) return 'failed';
    const crop = seamlessCrop({ device, wallpaper: art.wallpaperPx, size: piece.size, slot: normaliseSlot(piece.size, null), nudge: { dx: 0, dy: 0 } });
    res = await widgets.composeArtPiece({ id: piece.id, kind: 'seamless', wallpaperUri, cropPx: crop.cropPx, heroUri: artUri });
  } else {
    const px = widgetSizePx(device, piece.size);
    res = await widgets.composeArtPiece({ id: piece.id, kind: 'art', artUri, widthPx: px.w, heightPx: px.h, colour: theme.palette.bg });
  }
  if (!res.available && res.reason === 'not-built') return 'not-built';
  return res.ok ? 'ok' : 'failed';
}

async function setPending(themeId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(THEME_ART_PENDING_KEY, themeId);
  } catch {
    // Best effort: without it a launch queue just won't know to resume.
  }
}

async function clearPending(themeId: string): Promise<void> {
  try {
    // A newer apply may have set another theme meanwhile; only clear our own marker.
    if ((await AsyncStorage.getItem(THEME_ART_PENDING_KEY)) === themeId) await AsyncStorage.removeItem(THEME_ART_PENDING_KEY);
  } catch {
    // Best effort.
  }
}
