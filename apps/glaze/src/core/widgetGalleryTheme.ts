import { DESIGNED_KINDS, designedWidget, parseDesignedWidget } from './designedWidgets.ts';
import type { Theme } from './themes.ts';
import { parseWidgetTheme, widgetThemeFrom, type WidgetTheme } from './widgetTheme.ts';

export function widgetGalleryTheme(theme: Theme): WidgetTheme {
  return { ...widgetThemeFrom(theme), designs: DESIGNED_KINDS.map(kind => designedWidget(theme, kind)) };
}

export function parseWidgetGalleryTheme(json: string | null): WidgetTheme | null {
  if (!json) return null;
  try {
    const raw = JSON.parse(json);
    const theme = parseWidgetTheme(raw);
    if (!theme || !Array.isArray(raw.designs)) return theme;
    const candidates = (raw.designs as unknown[]).map(parseDesignedWidget);
    const designs = DESIGNED_KINDS.map(kind => candidates.find(d => d?.kind === kind)).filter(d => d != null);
    return designs.length === DESIGNED_KINDS.length ? { ...theme, designs } : theme;
  } catch {
    return null;
  }
}
