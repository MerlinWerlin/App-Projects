import type { Scene } from '../core/scene.ts';
import { bookshop } from './bookshop.ts';
import { cafeScene } from './cafe.ts';
import { jungleScene } from './jungle.ts';
import { mandalaScene } from './mandala.ts';

/** Gallery order. The flagship (deepest zoom) comes first. */
export const SCENES: Scene[] = [bookshop, mandalaScene, cafeScene, jungleScene];

export function sceneById(id: string): Scene | undefined {
  return SCENES.find((s) => s.id === id);
}
