// Owner 2026-11-14 (a theme showed a grey Artwork tile; "that cant happen on other themes as well"):
// which pieces a theme's Artwork 1-5 widgets show, worked out from its pack options with the same
// steps the app takes when a theme is applied (src/store/themeWidgetArt.ts): live pictures resolved
// (withLiveArt), replaced editions dropped, then planThemePieces in small with the pure-artwork rule.
// scripts/packs/artwork-coverage.mjs runs it over every published pack (CI: glaze-artwork-coverage).
import { isReplacedArtEdition } from './designedWidgets.ts';
import { liveArtPlan, withLiveArt, type CountdownArtTargets } from './liveArt.ts';
import { THEME_PACK_ART_SIZES, planThemePieces } from './themeArtSync.ts';
import type { WidgetOption } from './widgetOptions.ts';

/** Artwork slots on the Home Screen (ThemeArtKind.gallerySmallSlots). */
export const ARTWORK_SLOTS = 5;

/** The option ids of a theme's Artwork pieces, in slot order (before cycling). */
export function plannedArtworkOptionIds(themeId: string, options: readonly WidgetOption[], targets: CountdownArtTargets = {}): string[] {
  const live = withLiveArt(themeId, options, { targets }).filter((o) => !isReplacedArtEdition(o));
  const planned = planThemePieces({
    themeId,
    themeName: '',
    options: live,
    name: () => '',
    sizes: THEME_PACK_ART_SIZES,
    // Only whether a piece is live matters here (a live piece is never Artwork).
    live: (o) => (liveArtPlan(themeId, o, { targets }) ? ({ kind: 'clock' } as never) : null),
  });
  return planned.filter((p) => p.artwork === true).map((p) => p.optionId);
}

export type SlotSource = { slot: number; piece: string | null; source: 'artwork' | 'repeat' | 'fallback' };

/**
 * What Artwork 1..count shows: the n-th piece, a repeat when the theme has fewer, and the theme-coloured
 * fallback scene (ThemedFallbackArt, never a grey tile) when it has none at all.
 */
export function artworkSlotSources(list: readonly string[], count: number = ARTWORK_SLOTS): SlotSource[] {
  return Array.from({ length: count }, (_, i) => {
    if (list.length === 0) return { slot: i + 1, piece: null, source: 'fallback' as const };
    return { slot: i + 1, piece: list[i % list.length], source: i < list.length ? ('artwork' as const) : ('repeat' as const) };
  });
}
