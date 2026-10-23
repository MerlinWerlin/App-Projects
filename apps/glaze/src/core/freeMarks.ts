// T106 (fb-1022 follow-up): clear "Free" marking and a games / movie night / storybook way in.
// The owner asked that free themes in the new collections are marked clearly: every Space (Webb)
// photo theme and the six free Story & Play themes carry a small "Free" pill. Plus themes never do.
// Pure TS (Node-tested).

import { SPACE_THEMES } from './spacePack.ts';
import type { Theme } from './themes.ts';
import { STORYPLAY_FREE_THEMES, storyPlayGroup, type StoryPlayGroup } from './themesStoryPlay.ts';

/** Ids of the free themes in the new collections that show the "Free" pill. */
export const FREE_MARKED_IDS: ReadonlySet<string> = new Set([...SPACE_THEMES, ...STORYPLAY_FREE_THEMES].map((t) => t.id));

export function isFreeMarked(id: string): boolean {
  return FREE_MARKED_IDS.has(id);
}

/** Story & Play chips under the search field, in this order. */
export const STORY_GROUPS: readonly StoryPlayGroup[] = Object.freeze(['games', 'movie-night', 'storybook']);

/** Translation key of a chip's label. */
export function storyChipKey(group: StoryPlayGroup): 'themes.storyChips.games' | 'themes.storyChips.movieNight' | 'themes.storyChips.storybook' {
  if (group === 'games') return 'themes.storyChips.games';
  if (group === 'movie-night') return 'themes.storyChips.movieNight';
  return 'themes.storyChips.storybook';
}

/** Themes of one Story & Play group (free and Plus), in list order; null = no group filter. */
export function inStoryGroup<T extends Theme>(list: readonly T[], group: StoryPlayGroup | null): readonly T[] {
  if (group === null) return list;
  return list.filter((t) => storyPlayGroup(t.id) === group);
}
