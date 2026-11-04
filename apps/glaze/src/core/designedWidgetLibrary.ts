import { DESIGNED_KINDS, DESIGNED_SIZE, designedLiveSpec, designedOptionId, type DesignedKind } from './designedWidgets.ts';
import type { Theme } from './themes.ts';
import type { PlannedThemePiece } from './themeArtSync.ts';
import { themePieceId, type WidgetArtIndex, type WidgetArtSize } from './widgetArtLibrary.ts';

export function plannedDesignedWidgets(theme: Theme, name: (kind: DesignedKind, size: WidgetArtSize) => string): PlannedThemePiece[] {
  return (['small', 'medium', 'large'] as const).flatMap(size => DESIGNED_KINDS.map((kind, slot) => ({
    id: themePieceId(theme.id, designedOptionId(kind), size), name: name(kind, size), themeId: theme.id,
    themeName: theme.name, source: 'theme' as const, size, slot, optionId: designedOptionId(kind),
    aspect: DESIGNED_SIZE[size].w / DESIGNED_SIZE[size].h, live: designedLiveSpec(theme, kind),
  })));
}

/** Existing stable ids upgrade without replacing personal photos, selections or original art. */
export function upgradedDesignedLibrary(lib: WidgetArtIndex, theme: Theme, name: (kind: DesignedKind, size: WidgetArtSize) => string): WidgetArtIndex | null {
  const planned = new Map(plannedDesignedWidgets(theme, name).map(p => [p.id, p]));
  let changed = false;
  const pieces = lib.pieces.map(p => {
    const next = planned.get(p.id);
    if (p.source === 'photo' || p.themeId !== theme.id || !next) return p;
    if (JSON.stringify(p.live) === JSON.stringify(next.live) && p.name === next.name) return p;
    changed = true;
    return { ...p, name: next.name, live: next.live };
  });
  return changed ? { ...lib, pieces } : null;
}
