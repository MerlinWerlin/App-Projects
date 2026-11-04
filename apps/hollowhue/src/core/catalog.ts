import type { Difficulty, Scene, Theme } from './scene.ts';

export type BrowseFilter = 'all' | 'mega' | 'saved' | Theme;
export function browseScenes(scenes: Scene[], filter: BrowseFilter, difficulty: Difficulty | 'all', hasColouring: (scene: Scene) => boolean): Scene[] {
  return scenes.filter((scene) => {
    if (filter === 'saved') { if (!hasColouring(scene)) return false; }
    else {
      if (scene.legacy) return false;
      if (filter === 'mega' ? !scene.mega : filter !== 'all' && scene.theme !== filter) return false;
    }
    return difficulty === 'all' || (scene.difficulty ?? 'intermediate') === difficulty;
  });
}
