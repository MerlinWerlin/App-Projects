// Explicit theme selections commit in tap order. Art preparation follows the latest selection
// in the deferred queue so it cannot delay navigation or overwrite a newer theme.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ACTIVE_THEME_KEY,
  SAVED_WALLPAPERS_KEY,
  activeThemeId,
  markWallpaperSaved,
  parseActiveTheme,
  parseSavedWallpapers,
  serializeSavedWallpapers,
} from '../core/activeTheme';
import { DEFERRED_STEPS } from '../core/deferredWork';
import { DESIGNED_WIDGET_CAPABILITY } from '../core/designedWidgets';
import { themeArtResumePlan } from '../core/themeArtResume';
import type { Theme } from '../core/themes';
import { averageColour } from '../core/wallpaper';
import { refreshCatalog } from '../native/packs';
import { widgets as nativeWidgets } from '../native/widgets';
import { registerDeferred, requestDeferred } from './deferredWork';
import { applyThemeIcons, loadStudio } from './studio';
import { findAnyThemeById } from './themeLookup';
import { supersedeThemeWidgetArt, syncThemeWidgetArt } from './themeWidgetArt';
import { queueThemeWrite, rememberWidgetTheme } from './widgetTheme';

type Listener = (id: string | null) => void;
const listeners = new Set<Listener>();
let selectedTheme: Theme | null = null;
let selection = 0;
let publishedSelection = 0;
const sessionThemeId = () => selectedTheme?.id;

/** The theme in use (the stored one, else the Icon Studio's theme). Never rejects. */
export async function loadActiveThemeId(): Promise<string | null> {
  let stored = null;
  try {
    stored = parseActiveTheme(await AsyncStorage.getItem(ACTIVE_THEME_KEY));
  } catch {
    stored = null;
  }
  const current = sessionThemeId() ?? stored?.themeId;
  if (current) return current;
  try {
    const studio = await loadStudio();
    return sessionThemeId() ?? activeThemeId(null, studio.themeId);
  } catch {
    return null;
  }
}

export type ApplyResult = { icons: boolean; widgets: boolean };

/** Apply the displayed theme in tap order. Art composition stays off the navigation path. */
export function applyThemeEverywhere(theme: Theme): Promise<ApplyResult> {
  const request = ++selection;
  supersedeThemeWidgetArt();
  const native = queueThemeWrite(async () => {
    selectedTheme = theme;
    const widgets = await rememberWidgetTheme(theme);
    publishedSelection = request;
    for (const listener of listeners) {
      try {
        listener(theme.id);
      } catch (e) {
        if (typeof __DEV__ !== 'undefined' && __DEV__) console.warn('Glaze: theme listener failed', e);
      }
    }
    // Start preparing the art before a person can leave for the Home Screen. This path
    // does not sit behind unrelated launch work and never delays the native theme write.
    if (request === selection) void syncThemeWidgetArt(theme);
    requestDeferred(DEFERRED_STEPS.installedProbe, 'apply');
    return widgets;
  });
  const icons = Promise.resolve()
    .then(() => applyThemeIcons(theme, averageColour(theme.wallpaper)))
    .then(() => true, () => false);
  return Promise.all([icons, native]).then(([icons, widgets]) => ({ icons, widgets }));
}

/**
 * T250: the deferred 'themeArt' step (requested by applyThemeEverywhere). T238 (owner-1101g #6): the
 * theme's widget art replaces the previous theme's auto-added art in "My widget art" (own photos
 * stay). With no in-memory theme (resumed on the next launch) it uses the stored theme in use.
 * No-op in Expo Go / Android. A failed bridge write throws, so the queue retries it next launch.
 * T252 owns what this does to the library (src/native/widgets.ts / src/core/widgetArtLibrary.ts);
 * extra per-theme art work belongs in this step, not in applyThemeEverywhere.
 * T260: resumed, it looks the stored theme up by id (src/store/themeLookup.ts: bundled, remote
 * catalogue in memory, downloaded packs; no network) and runs the same full T252 sync; only a theme
 * found nowhere falls back to replaceThemeArt by id. Runs in the queue (after the first screen,
 * try/catch per step), so nothing here touches launch.
 */
async function themeArtStep(): Promise<void> {
  const request = selection;
  if (request !== publishedSelection || selectedTheme) return;
  let theme: Theme | null = null;
  let fallbackId: string | null = null;
  if (!theme) {
    const id = await loadActiveThemeId();
    let found: Theme | null = null;
    try {
      found = await findAnyThemeById(id);
      if (!found && id) {
        await refreshCatalog(false);
        found = await findAnyThemeById(id);
      }
    } catch {
      found = null;
    }
    const plan = themeArtResumePlan(id, found);
    if (plan.kind === 'none') return;
    if (plan.kind === 'sync') theme = plan.theme;
    else fallbackId = plan.themeId;
  }
  if (request !== selection) return;
  let res;
  if (theme) {
    // T252 (owner-1101h #3): ALL of this theme's widget art is added to My widget art and the previous
    // theme's auto-added art goes (own photos stay), in one index write, then the widgets reload.
    const r = await syncThemeWidgetArt(theme);
    if (r.superseded || !r.available) return;
    res = { available: r.available, ok: r.ok };
  } else if (fallbackId) {
    // T238: the theme is unknown here (e.g. a removed pack): at least drop the other themes' art.
    res = await nativeWidgets.replaceThemeArt(fallbackId);
  } else {
    return;
  }
  if (res.available && !res.ok) throw new Error('widget art index write failed');
}

registerDeferred(DEFERRED_STEPS.themeArt, { priority: 30, persist: false, timeoutMs: 110_000, run: themeArtStep });

/** Metadata-only upgrade of already configured functional pieces; called in the deferred queue. */
export async function upgradeActiveDesignedWidgets(): Promise<void> {
  if (await nativeWidgets.designVersion() < DESIGNED_WIDGET_CAPABILITY) return;
  const stored = await nativeWidgets.upgradeDesignedWidgets(null);
  if (stored.available && !stored.ok) throw new Error('Saved widget identity migration failed');
  const library = await nativeWidgets.artLibrary();
  if (!library.available || !library.ok) return;
  // A person can save Nebula widgets without putting Nebula's icons in use. Migrate the themes
  // actually represented by saved widgets as well as the globally applied theme.
  const ids = new Set(library.pieces.filter(p => p.source !== 'photo' && p.themeId).map(p => p.themeId!));
  const active = await loadActiveThemeId();
  if (active) ids.add(active);
  for (const id of ids) {
    const theme = await findAnyThemeById(id);
    if (!theme) continue;
    const result = await nativeWidgets.upgradeDesignedWidgets(theme);
    if (result.available && !result.ok) throw new Error('Designed widget migration failed');
  }
}

/** The theme in use for a screen: read on mount and on every focus, and on each change. */
export function useActiveThemeId(): string | null {
  const [id, setId] = useState<string | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    const l: Listener = (next) => {
      if (alive.current) setId(next);
    };
    listeners.add(l);
    return () => {
      alive.current = false;
      listeners.delete(l);
    };
  }, []);
  useFocusEffect(
    useCallback(() => {
      let focused = true;
      loadActiveThemeId()
        .then((next) => {
          if (focused && alive.current) setId(selectedTheme?.id ?? next);
        })
        .catch(() => undefined);
      return () => { focused = false; };
    }, []),
  );
  return id;
}

// ---------------------------------------------------------------- saved wallpapers (T185)

async function readSaved() {
  try {
    return parseSavedWallpapers(await AsyncStorage.getItem(SAVED_WALLPAPERS_KEY));
  } catch {
    return {};
  }
}

/** True when this theme's wallpaper was saved to Photos before (badge only; Save stays). */
export async function wasWallpaperSaved(themeId: string): Promise<boolean> {
  const saved = await readSaved();
  return !!saved && typeof saved === 'object' && themeId in saved;
}

export async function rememberWallpaperSaved(themeId: string): Promise<void> {
  try {
    const next = markWallpaperSaved(await readSaved(), themeId, Date.now());
    await AsyncStorage.setItem(SAVED_WALLPAPERS_KEY, serializeSavedWallpapers(next));
  } catch {
    // Best effort: the badge shows for this visit anyway.
  }
}
