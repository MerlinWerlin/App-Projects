import AsyncStorage from '@react-native-async-storage/async-storage';
import { ACTIVE_THEME_KEY, createThemeWriteQueue, parseActiveTheme, serializeActiveTheme } from '../core/activeTheme';
import { THEMES, type Theme } from '../core/themes';
import { parseWidgetGalleryTheme, widgetGalleryTheme } from '../core/widgetGalleryTheme';
import { ACTIVE_WIDGET_THEME_KEY, DEFAULT_WIDGET_THEME, serializeWidgetTheme } from '../core/widgetTheme';
import { widgets } from '../native/widgets';
import { syncPackClockFace } from '../native/packs';
import { DEFERRED_STEPS, requestDeferred } from './deferredWork';
import { loadStudio } from './studio';
import { findAnyThemeById } from './themeLookup';

export const queueThemeWrite = createThemeWriteQueue();
let selectedWidgetTheme: ReturnType<typeof widgetGalleryTheme> | null = null;

async function activeThemeKey(): Promise<string | undefined> {
  return selectedWidgetTheme?.themeId ?? parseActiveTheme(await AsyncStorage.getItem(ACTIVE_THEME_KEY).catch(() => null))?.themeId;
}

function writeWidgetTheme(wt: ReturnType<typeof widgetGalleryTheme>) {
  void syncPackClockFace(wt.themeId);
  return widgets.setTheme(wt);
}

/** Wallpaper and Studio writes can supply a fallback until an explicit theme is selected. */
export function applyWidgetTheme(theme: Theme): Promise<boolean> {
  return queueThemeWrite(async () => {
    try {
      const active = await activeThemeKey();
      if (active && active !== theme.id) return true;
      const wt = widgetGalleryTheme(theme);
      await AsyncStorage.setItem(ACTIVE_WIDGET_THEME_KEY, serializeWidgetTheme(wt)).catch(() => undefined);
      return (await writeWidgetTheme(wt)).ok;
    } catch {
      return false;
    }
  });
}

/** Called inside the selection queue. Persist both theme keys together, then publish to WidgetKit. */
export async function rememberWidgetTheme(theme: Theme): Promise<boolean> {
  try {
    const wt = widgetGalleryTheme(theme);
    selectedWidgetTheme = wt;
    const stored = await AsyncStorage.multiSet([
      [ACTIVE_THEME_KEY, serializeActiveTheme({ themeId: theme.id, at: Date.now() })],
      [ACTIVE_WIDGET_THEME_KEY, serializeWidgetTheme(wt)],
    ]).then(() => true, () => false);
    const shared = await writeWidgetTheme(wt);
    if (shared.available && !shared.ok) requestDeferred(DEFERRED_STEPS.widgetTheme);
    return shared.ok || stored;
  } catch {
    return false;
  }
}

/**
 * Write the remembered widget theme (else the Icon Studio's theme) to the widgets. Idempotent (the
 * same file is written again), never throws. True when the widgets got it.
 */
export function pushStoredWidgetTheme(): Promise<boolean> {
  return queueThemeWrite(async () => {
    try {
      if (selectedWidgetTheme) return (await writeWidgetTheme(selectedWidgetTheme)).ok;
      const [activeId, stored] = await Promise.all([
        activeThemeKey(),
        AsyncStorage.getItem(ACTIVE_WIDGET_THEME_KEY).catch(() => null),
      ]);
      let studioThemeId: string | null = null;
      if (!activeId && !stored) {
        try {
          studioThemeId = (await loadStudio()).themeId;
        } catch {
          studioThemeId = null;
        }
      }
      const saved = parseWidgetGalleryTheme(stored);
      const theme = await findAnyThemeById(activeId ?? saved?.themeId ?? studioThemeId);
      const cached = !activeId || saved?.themeId === activeId ? saved : null;
      const wt = theme ? widgetGalleryTheme(theme) : cached ?? {
        ...DEFAULT_WIDGET_THEME, designs: widgetGalleryTheme(THEMES[0]).designs,
      };
      return (await writeWidgetTheme(wt)).ok;
    } catch {
      return false;
    }
  });
}
