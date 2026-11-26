// Owner 2026-11-14 (a theme showed a grey Artwork tile; "that cant happen on other themes as well"):
// which pieces a theme's Artwork 1-5 widgets show, worked out from its pack options with the same
// steps the app takes when a theme is applied (src/store/themeWidgetArt.ts): live pictures resolved
// (withLiveArt), replaced editions dropped, then planThemePieces in small with the pure-artwork rule.
// scripts/packs/artwork-coverage.mjs runs it over every published pack (CI: glaze-artwork-coverage).
import { isReplacedArtEdition } from './designedWidgets.ts';
import { liveArtPlan, withLiveArt, type CountdownArtTargets } from './liveArt.ts';
import { ARTWORK_ONLY_SIZES, planThemePieces } from './themeArtSync.ts';
import type { HomeOptionSize } from './widgetOptions.ts';
import type { WidgetOption } from './widgetOptions.ts';

/** Artwork slots on the Home Screen (ThemeArtKind.gallerySmallSlots). */
export const ARTWORK_SLOTS = 5;

/** The option ids of a theme's Artwork pieces, in slot order (before cycling). */
export function plannedArtworkOptionIds(
  themeId: string,
  options: readonly WidgetOption[],
  targets: CountdownArtTargets = {},
  /** Owner 2026-11-27: medium = Artwork 6-7, large = 8-9 (default small, Artwork 1-5). */
  size: HomeOptionSize = 'small',
): string[] {
  const live = withLiveArt(themeId, options, { targets }).filter((o) => !isReplacedArtEdition(o));
  const planned = planThemePieces({
    themeId,
    themeName: '',
    options: live,
    name: () => '',
    sizes: [size],
    artworkOnly: ARTWORK_ONLY_SIZES,
    // Only whether a piece is live matters here (a live piece is never Artwork).
    live: (o) => (liveArtPlan(themeId, o, { targets }) ? ({ kind: 'clock' } as never) : null),
  });
  return planned.filter((p) => p.artwork === true).map((p) => p.optionId);
}

export type SlotSource = { slot: number; piece: string | null; source: 'artwork' | 'repeat' | 'fallback' };

/**
 * What Artwork 1..count shows: the n-th piece, else the theme-coloured fallback scene (ThemedFallbackArt,
 * never a grey tile). 1.0.39 (owner TestFlight 1.0.37: Starry Night showed one copper moon in all five
 * slots): a theme with fewer pieces shows each piece ONCE and the calm theme design in the rest, never
 * the same image twice ('repeat' is kept in the type for older callers and is never returned).
 */
export function artworkSlotSources(list: readonly string[], count: number = ARTWORK_SLOTS): SlotSource[] {
  return Array.from({ length: count }, (_, i) =>
    i < list.length ? { slot: i + 1, piece: list[i], source: 'artwork' as const } : { slot: i + 1, piece: null, source: 'fallback' as const },
  );
}
