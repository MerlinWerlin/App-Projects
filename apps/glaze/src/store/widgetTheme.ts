// T125: the theme the widgets follow. Whenever the user applies a theme (saves its wallpaper, uses
// its style, opens its widgets step, saves in Widget Studio) the app writes it to the App Group via
// src/native/widgets.ts and remembers it on this phone (AsyncStorage ACTIVE_WIDGET_THEME_KEY), and
// it is written again once at launch so the extension never sits on its built-in default.
// T250: the launch re-write and the write after "Use this theme" are the deferred 'widgetTheme'
// step (pushStoredWidgetTheme, src/store/launchWork.ts), never on the launch path.
// Never throws; every native call no-ops in Expo Go and on Android.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAnyTheme } from '../core/plusThemes';
import type { Theme } from '../core/themes';
import { ACTIVE_WIDGET_THEME_KEY, launchWidgetTheme, serializeWidgetTheme, widgetThemeFrom } from '../core/widgetTheme';
import { widgets } from '../native/widgets';
import { loadStudio } from './studio';

/** Write `theme` to the widgets and remember it as the active widget theme. True when the widgets got it. */
export async function applyWidgetTheme(theme: Theme): Promise<boolean> {
  try {
    const wt = widgetThemeFrom(theme);
    try {
      await AsyncStorage.setItem(ACTIVE_WIDGET_THEME_KEY, serializeWidgetTheme(wt));
    } catch {
      // Storage unavailable: the widgets still get this write.
    }
    return (await widgets.setTheme(wt)).ok;
  } catch {
    return false;
  }
}

/**
 * T250: remember `theme` as the active widget theme on this phone only (no native call). "Use this
 * theme" awaits this (cheap) and queues pushStoredWidgetTheme, so the App Group write + timeline
 * reload happen after the screen settled, and again on the next launch if the app died first.
 * True when stored.
 */
export async function rememberWidgetTheme(theme: Theme): Promise<boolean> {
  try {
    await AsyncStorage.setItem(ACTIVE_WIDGET_THEME_KEY, serializeWidgetTheme(widgetThemeFrom(theme)));
    return true;
  } catch {
    return false;
  }
}

/**
 * Write the remembered widget theme (else the Icon Studio's theme) to the widgets. Idempotent (the
 * same file is written again), never throws. True when the widgets got it.
 */
export async function pushStoredWidgetTheme(): Promise<boolean> {
  try {
    let stored: string | null = null;
    try {
      stored = await AsyncStorage.getItem(ACTIVE_WIDGET_THEME_KEY);
    } catch {
      stored = null;
    }
    let studioThemeId: string | null = null;
    if (!stored) {
      try {
        studioThemeId = (await loadStudio()).themeId;
      } catch {
        studioThemeId = null;
      }
    }
    const wt = launchWidgetTheme(stored, (id) => getAnyTheme(id), studioThemeId);
    if (!wt) return false;
    return (await widgets.setTheme(wt)).ok;
  } catch {
    return false;
  }
}
