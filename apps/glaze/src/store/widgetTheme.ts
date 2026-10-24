// T125: the theme the widgets follow. Whenever the user applies a theme (saves its wallpaper, uses
// its style, opens its widgets step, saves in Widget Studio) the app writes it to the App Group via
// src/native/widgets.ts and remembers it on this phone (AsyncStorage ACTIVE_WIDGET_THEME_KEY), and
// it is written again once at launch so the extension never sits on its built-in default.
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

let launched: Promise<boolean> | null = null;

/** Once per app run: re-write the active widget theme (or the Icon Studio's theme) to the widgets. */
export function syncWidgetThemeAtLaunch(): Promise<boolean> {
  if (launched) return launched;
  launched = (async () => {
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
  })();
  return launched;
}
