import { DESIGNED_KINDS, DESIGNED_SIZE, designedLiveSpec, designedOptionId, type DesignedKind } from './designedWidgets.ts';
import type { Theme } from './themes.ts';
import type { PlannedThemePiece } from './themeArtSync.ts';
import { themePieceId, type WidgetArtIndex, type WidgetArtSize } from './widgetArtLibrary.ts';
import { LEGACY_FALLBACK_CLOCK_ID } from './widgetOptions.ts';

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
  const removed = new Map<string, { size: WidgetArtSize; replacement: string }>();
  const pieces = lib.pieces.filter(p => {
    if (p.source !== 'theme' || !p.themeId || !p.size || p.id !== themePieceId(p.themeId, LEGACY_FALLBACK_CLOCK_ID, p.size)) return true;
    removed.set(p.id, { size: p.size, replacement: themePieceId(p.themeId, designedOptionId('clock'), p.size) });
    changed = true;
    return false;
  }).map(p => {
    const next = planned.get(p.id);
    if (p.source === 'photo' || p.themeId !== theme.id || !next) return p;
    if (JSON.stringify(p.live) === JSON.stringify(next.live) && p.name === next.name) return p;
    changed = true;
    return { ...p, name: next.name, live: next.live };
  });
  if (!changed) return null;
  const next: WidgetArtIndex = { ...lib, pieces };
  if (removed.size) {
    // Existing pinned fallback choices resolve to the working clock's slot; photos/art stay intact.
    next.retired = { ...lib.retired };
    for (const [id, item] of removed) next.retired[id] = { size: item.size, slot: 0 };
    if (lib.unpinned) {
      next.unpinned = { ...lib.unpinned };
      for (const size of ['small', 'medium', 'large'] as const) {
        const id = lib.unpinned[size];
        const item = id ? removed.get(id) : undefined;
        if (item) next.unpinned[size] = pieces.some(p => p.id === item.replacement && p.live?.design?.kind === 'clock') ? item.replacement : null;
      }
    }
  }
  return next;
}
