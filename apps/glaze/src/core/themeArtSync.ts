// T252 (owner-1101h #3): applying a theme ADDS ALL of that theme's widget art to "My widget art"
// and removes the previous theme's auto-added art (own photos stay), with no visit to the library.
// Edit Widget > Art then lists the current theme's pieces straight after a swap.
//
// Pure planning + index transformation (Node runs it directly; tested in themeArtSync.test.ts).
// The orchestration (compose each missing piece into the App Group, then ONE index write, after
// which the bridge reloads every timeline) is src/store/themeWidgetArt.ts syncThemeWidgetArt.
//
// Crash-safe + idempotent by construction:
//   1. planThemePieces: every piece the theme should have (deterministic ids, so re-running plans
//      the same set);
//   2. piecesToCompose: the planned pieces not yet in the index (pieces already present are skipped;
//      the bridge also skips a file that is already on disk from an interrupted run);
//   3. commitThemeArt: ONE new index (own photos kept, every other theme's auto pieces removed and
//      remembered in `retired` for the widget's slot remap, currentThemeId set). Planned pieces whose
//      image could not be made are left out, and the bridge's index write deletes every file the
//      index does not list, so partial copies are cleaned up. Interrupted before step 3: the old
//      index is untouched (still consistent) and the next run finishes the job.
import type { WidgetOption, HomeOptionSize } from './widgetOptions.ts';
import { shelfOptions } from './widgetOptions.ts';
import {
  WIDGET_ART_LIBRARY_CAP,
  isUserPiece,
  listPieces,
  pieceFileName,
  retire,
  themePieceId,
  type CleanResult,
  type WidgetArtIndex,
  type WidgetArtPiece,
  type WidgetArtSize,
} from './widgetArtLibrary.ts';

export const THEME_ART_SIZES: readonly HomeOptionSize[] = Object.freeze(['small', 'medium', 'large'] as HomeOptionSize[]);

/** One piece the theme should have in "My widget art". */
export type PlannedThemePiece = Omit<WidgetArtPiece, 'file' | 'created' | 'size' | 'slot'> & {
  size: WidgetArtSize;
  slot: number;
  /** The pack's option this piece draws (src/core/widgetOptions.ts). */
  optionId: string;
};

export type PlanInput = {
  themeId: string;
  themeName: string;
  options: readonly WidgetOption[];
  /** Picker title for the piece (already translated, e.g. "Moon · Small"). */
  name: (option: WidgetOption, size: HomeOptionSize, slot: number) => string;
  /** width / height of the composed image for a size (0 = unknown). */
  aspect?: (size: HomeOptionSize) => number;
  /** T237: the live spec for a piece, or null (a picture only). */
  live?: (option: WidgetOption, size: HomeOptionSize) => WidgetArtPiece['live'] | null;
  cap?: number;
};

/**
 * Every piece of the theme, one per option per Home Screen size the option itself lists (its own
 * sizes; other sizes stay a manual "Use on my widget" from My widget art). Slot = position among the
 * theme's pieces of that size in shelf order (what the Widgets tab menu shows). Deterministic.
 */
export function planThemePieces(input: PlanInput): PlannedThemePiece[] {
  const out: PlannedThemePiece[] = [];
  const seen = new Set<string>();
  const cap = Math.max(0, Math.floor(input.cap ?? WIDGET_ART_LIBRARY_CAP));
  for (const size of THEME_ART_SIZES) {
    let slot = 0;
    for (const option of shelfOptions(input.options, size)) {
      if (!option.sizes.includes(size)) continue;
      const id = themePieceId(input.themeId, option.id, size);
      if (seen.has(id)) continue;
      seen.add(id);
      const live = input.live?.(option, size) ?? null;
      out.push({
        id,
        name: input.name(option, size, slot),
        themeName: input.themeName,
        themeId: input.themeId,
        source: 'theme',
        aspect: input.aspect?.(size) ?? 0,
        size,
        slot,
        optionId: option.id,
        ...(live ? { live } : {}),
      });
      slot++;
    }
  }
  // Over the cap: keep the first slots of every size (round robin), so each size gets pieces.
  if (out.length <= cap) return out;
  const ranked = [...out].sort((a, b) => a.slot - b.slot || THEME_ART_SIZES.indexOf(a.size) - THEME_ART_SIZES.indexOf(b.size));
  const keep = new Set(ranked.slice(0, cap).map((p) => p.id));
  return out.filter((p) => keep.has(p.id));
}

/** The planned pieces that still need an image (not in the index yet), in plan order. */
export function piecesToCompose(lib: WidgetArtIndex, planned: readonly PlannedThemePiece[]): PlannedThemePiece[] {
  const have = new Set(lib.pieces.map((p) => p.id));
  return planned.filter((p) => !have.has(p.id));
}

/**
 * The one index write of a theme apply. Keeps every own photo, keeps the planned pieces that are in
 * the index already or whose image is `ready` (made this run), keeps any other piece of this theme
 * (e.g. a medium made by hand), removes every other auto-added piece (remembered in `retired` with
 * its size + slot), and records `themeId` as current. A planned piece already in the index keeps its
 * `created`, so re-running gives the same index (idempotent). New pieces get `now - plan index`, so
 * the library lists them in plan order.
 */
export function commitThemeArt(
  lib: WidgetArtIndex,
  themeId: string,
  planned: readonly PlannedThemePiece[],
  ready: readonly string[],
  now: number,
): CleanResult {
  const theme = themeId.slice(0, 120);
  const byId = new Map(lib.pieces.map((p) => [p.id, p] as const));
  const readySet = new Set(ready);
  const plannedIds = new Set(planned.map((p) => p.id));
  const kept: WidgetArtPiece[] = [];
  planned.forEach((p, i) => {
    const prev = byId.get(p.id);
    if (!prev && !readySet.has(p.id)) return; // its image could not be made: left out (file pruned)
    const { optionId: _optionId, ...rest } = p;
    kept.push({ ...rest, file: pieceFileName(p.id), created: prev ? prev.created : now - i });
  });
  const others: WidgetArtPiece[] = [];
  const gone: WidgetArtPiece[] = [];
  for (const p of lib.pieces) {
    if (plannedIds.has(p.id)) continue;
    if (isUserPiece(p) || p.themeId === theme) others.push(p);
    else gone.push(p);
  }
  const pieces = listPieces({ v: 1, pieces: [...kept, ...others] });
  const next: WidgetArtIndex = { ...lib, v: 1, pieces, currentThemeId: theme };
  const retired = retire(lib.retired, gone, pieces);
  if (retired) next.retired = retired;
  else delete next.retired;
  return { lib: next, keep: pieces.map((p) => p.id), remove: gone.map((p) => p.id) };
}
