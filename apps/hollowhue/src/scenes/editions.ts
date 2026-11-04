import type { Difficulty, Level, Scene, Theme } from '../core/scene.ts';
import { ARTWORK, ARTWORK_INFO } from './art/catalog-art.ts';
import { singleData } from './single-data.ts';
import { nestedData } from './nested-data.ts';

function artLevel(id: string, art: string): Level {
  const info = ARTWORK_INFO[art]!;
  return { id, w: 1200, h: 1200, artworkId: art, flatArtwork: true, discoveryAt: .5,
    fillIds: info.fillIds, regionSizeHints: info.regionSizeHints, stroke: info.stroke,
    get regions() { return ARTWORK[art]!.regions; } };
}

export const SINGLE_SCENES: Scene[] = singleData.map((data) => ({
  id: data.id, theme: data.theme, difficulty: data.difficulty,
  version: 1, palette: data.theme === 'sealife' ? 'pastel' : data.theme === 'patterns' ? 'jewel' : 'garden',
  collection: 'single', levels: [artLevel('z00', data.art)],
}));

/** Every portal has a reviewed location/relation in the parent illustration. No synthetic zoom gates. */
type NestedSpec = { id: string; theme: Theme; difficulty: Difficulty; palette: string; mega: boolean;
  levels: readonly { art: string; label: string; relation?: string; next?: { x: number; y: number; w: number; h: number; round?: boolean } }[] };
const nestedSpecs: readonly NestedSpec[] = nestedData;
export const ZOOM_SCENES: Scene[] = nestedSpecs.map((data) => ({
  id: data.id, theme: data.theme, difficulty: data.difficulty, version: 1,
  palette: data.palette, collection: data.mega ? 'mega' : 'zoom', mega: data.mega, frameEdgeDetails: true,
  levels: data.levels.map((level, index) => {
    const base = artLevel(`z${String(index).padStart(2, '0')}`, level.art);
    if (index === 0) return base;
    const previous = data.levels[index - 1]!;
    base.parent = `z${String(index - 1).padStart(2, '0')}`;
    base.portal = previous.next!;
    base.round = previous.next!.round;
    return base;
  }),
}));
