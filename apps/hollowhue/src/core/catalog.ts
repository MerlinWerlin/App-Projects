import type { Difficulty, Scene, Theme } from './scene.ts';

export type BrowseCollection = 'single' | 'zoom' | 'mega' | 'saved';
export function browseScenes(scenes: Scene[], collection: BrowseCollection, topic: Theme | 'all', difficulty: Difficulty | 'all', hasColouring: (scene: Scene) => boolean): Scene[] {
  return scenes.filter((scene) => {
    if (collection === 'saved') { if (!hasColouring(scene)) return false; }
    else {
      if (scene.legacy) return false;
      if (scene.collection !== collection) return false;
    }
    if (topic !== 'all' && scene.theme !== topic) return false;
    return difficulty === 'all' || (scene.difficulty ?? 'intermediate') === difficulty;
  });
}
