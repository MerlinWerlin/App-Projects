// T184 (owner-1101 item 2): the theme in use, on this phone (AsyncStorage ACTIVE_THEME_KEY).
// "Use this theme" (applyThemeEverywhere) writes every state that follows the theme in one go:
// the Icon Studio style (Icons tab, install), the widget theme (Widgets tab + the native widget
// bridge write in applyWidgetTheme) and the theme in use (wallpaper maker's start, "In use ✓").
// The tabs are lazy + freezeOnBlur, so screens re-read it on focus (useActiveThemeId) as well as
// hearing the change through a listener. Never throws.
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
import type { Theme } from '../core/themes';
import { averageColour } from '../core/wallpaper';
import { loadStudio, setStudioStyle } from './studio';
import { applyWidgetTheme } from './widgetTheme';

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
 * the widget theme (App Group bridge; no-op in Expo Go) and the theme in use, then tells every
 * mounted screen. Each part is independent: one failing never stops the others.
 */
export async function applyThemeEverywhere(theme: Theme): Promise<ApplyResult> {
  let icons = true;
  try {
    await setStudioStyle(theme.iconStyle, theme.id, averageColour(theme.wallpaper));
  } catch {
    icons = false;
  }
  const widgets = await applyWidgetTheme(theme);
  try {
    await AsyncStorage.setItem(ACTIVE_THEME_KEY, serializeActiveTheme({ themeId: theme.id, at: Date.now() }));
  } catch {
    // Storage unavailable: the screens still hear the change below.
  }
  for (const l of listeners) l(theme.id);
  return { icons, widgets };
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
