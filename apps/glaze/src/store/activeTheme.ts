// T184 (owner-1101 item 2): the theme in use, on this phone (AsyncStorage ACTIVE_THEME_KEY).
// "Use this theme" (applyThemeEverywhere) writes every state that follows the theme in one go:
// the Icon Studio style (Icons tab, install), the widget theme (Widgets tab + the native widget
// bridge write in applyWidgetTheme) and the theme in use (wallpaper maker's start, "In use ✓").
// The tabs are lazy + freezeOnBlur, so screens re-read it on focus (useActiveThemeId) as well as
// hearing the change through a listener. Never throws.
// T250 (owner-1101h #1, freeze + crash after a theme swap): it now returns as soon as the essential
// state is written (icon style, remembered widget theme, theme in use) and the screens are told;
// the heavy follow-ups (App Group write + reloadAllTimelines, "My widget art" replace, installed-apps
// check) are queued as deferred steps (src/store/deferredWork.ts): after interactions, one at a
// time, crash-safe, retried on the next launch if the app was killed first.
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
  serializeActiveTheme,
  serializeSavedWallpapers,
} from '../core/activeTheme';
import { DEFERRED_STEPS } from '../core/deferredWork';
import { themeArtResumePlan } from '../core/themeArtResume';
import type { Theme } from '../core/themes';
import { averageColour } from '../core/wallpaper';
import { widgets as nativeWidgets } from '../native/widgets';
import { registerDeferred, requestDeferred } from './deferredWork';
import { applyThemeIcons, loadStudio } from './studio';
import { findAnyThemeById } from './themeLookup';
import { syncThemeWidgetArt } from './themeWidgetArt';
import { rememberWidgetTheme } from './widgetTheme';

type Listener = (id: string | null) => void;
const listeners = new Set<Listener>();

/** The theme in use (the stored one, else the Icon Studio's theme). Never rejects. */
export async function loadActiveThemeId(): Promise<string | null> {
  let stored = null;
  try {
    stored = parseActiveTheme(await AsyncStorage.getItem(ACTIVE_THEME_KEY));
  } catch {
    stored = null;
  }
  if (stored) return stored.themeId;
  try {
    return activeThemeId(null, (await loadStudio()).themeId);
  } catch {
    return null;
  }
}

export type ApplyResult = { icons: boolean; widgets: boolean };

/**
 * "Use this theme": the base for every tab. Writes the icon style (with the person's chosen shape),
 * remembers the widget theme and the theme in use, then tells every mounted screen. Each part is
 * independent: one failing never stops the others. `widgets` = the widget theme was remembered; the
 * App Group write itself is the deferred 'widgetTheme' step (T250).
 */
export async function applyThemeEverywhere(theme: Theme): Promise<ApplyResult> {
  let icons = true;
  try {
    // T241: in the user's look for this theme (textured 'themed' by default).
    await applyThemeIcons(theme, averageColour(theme.wallpaper));
  } catch {
    icons = false;
  }
  const widgets = await rememberWidgetTheme(theme);
  try {
    await AsyncStorage.setItem(ACTIVE_THEME_KEY, serializeActiveTheme({ themeId: theme.id, at: Date.now() }));
  } catch {
    // Storage unavailable: the screens still hear the change below.
  }
  for (const l of listeners) l(theme.id);
  // T250: the heavy follow-ups, queued (never awaited here). Each works from the stored state above,
  // so a run resumed on the next launch does the same thing.
  requestDeferred(DEFERRED_STEPS.widgetTheme); // App Group write + reloadAllTimelines (T125)
  requestDeferred(DEFERRED_STEPS.themeArt, theme); // "My widget art" follows the theme (T238 / T252)
  requestDeferred(DEFERRED_STEPS.installedProbe, 'apply'); // T229: tick the popular apps on this iPhone
  return { icons, widgets };
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
async function themeArtStep(arg: unknown): Promise<void> {
  let theme = arg && typeof arg === 'object' && typeof (arg as Theme).id === 'string' ? (arg as Theme) : null;
  let fallbackId: string | null = null;
  if (!theme) {
    const id = await loadActiveThemeId();
    let found: Theme | null = null;
    try {
      found = await findAnyThemeById(id);
    } catch {
      found = null;
    }
    const plan = themeArtResumePlan(id, found);
    if (plan.kind === 'none') return;
    if (plan.kind === 'sync') theme = plan.theme;
    else fallbackId = plan.themeId;
  }
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

registerDeferred(DEFERRED_STEPS.themeArt, { priority: 30, run: themeArtStep });

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
      loadActiveThemeId().then((next) => {
        if (alive.current) setId(next);
      });
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
  return themeId in (await readSaved());
}

export async function rememberWallpaperSaved(themeId: string): Promise<void> {
  try {
    const next = markWallpaperSaved(await readSaved(), themeId, Date.now());
    await AsyncStorage.setItem(SAVED_WALLPAPERS_KEY, serializeSavedWallpapers(next));
  } catch {
    // Best effort: the badge shows for this visit anyway.
  }
}
