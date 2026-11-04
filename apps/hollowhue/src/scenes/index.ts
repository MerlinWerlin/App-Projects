import type { Scene } from '../core/scene.ts';
import { bookshop } from './bookshop.ts';
import { cafeScene } from './cafe.ts';
import { jungleScene } from './jungle.ts';
import { mandalaScene } from './mandala.ts';
import { libraryScene } from './library.ts';
import { forestScene } from './forest.ts';
import { SHIPPED_ART_SCENES } from './catalog.ts';
import { SINGLE_SCENES, ZOOM_SCENES } from './editions.ts';

/** Gallery order. The flagship (deepest zoom) comes first. */
export const LEGACY_SCENES: Scene[] = [bookshop, libraryScene, forestScene, mandalaScene, cafeScene, jungleScene].map((scene) => ({ ...scene, legacy: true }));
export { SHIPPED_ART_SCENES, SINGLE_SCENES, ZOOM_SCENES };
export const CATALOG_SCENES: Scene[] = [...SINGLE_SCENES, ...ZOOM_SCENES];
export const SCENES: Scene[] = [...CATALOG_SCENES, ...SHIPPED_ART_SCENES, ...LEGACY_SCENES];

export function sceneById(id: string): Scene | undefined {
  return SCENES.find((s) => s.id === id);
}
