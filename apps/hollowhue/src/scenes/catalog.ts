import { circle, petal, rect } from '../core/build.ts';
import type { Region, Scene } from '../core/scene.ts';
import { ARTWORK } from './art/catalog-art.ts';
import { catalogData } from './catalog-data.ts';

const levelId = (index: number) => `z${String(index).padStart(2, '0')}`;

/** Seven pictures = six actual zoom transitions. Mega has 21 pictures = twenty transitions. */
export const CATALOG_SCENES: Scene[] = catalogData.map((data) => {
  const mega = 'mega' in data && data.mega;
  const entrances = data.art.map((id) => mega ? { x: 600, y: 600, r: 168, natural: true, round: true } : ARTWORK[id]!.focal);
  return {
    id: data.id, theme: data.theme, difficulty: data.difficulty,
    palette: data.palette, version: 1, mega,
    levels: data.art.map((id, index) => {
      const art = ARTWORK[id]!;
      const regions: Region[] = art.regions.map((r) => index > 0 && (r.id === 'paper' || r.id === art.background)
        ? { ...r, from: `${levelId(index - 1)}/zoomGate` } : r);
      const gate = entrances[index]!;
      if (index < data.art.length - 1) {
        if (!gate.natural) {
          for (let k = 0; k < 8; k++) regions.push({ id: `sealPetal${k}`, d: petal(gate.x, gate.y, k * Math.PI / 4, gate.r * .85, gate.r * 1.6, gate.r * .2) });
        }
        regions.push({ id: 'zoomGate', d: gate.round === false ? rect(gate.x - gate.r, gate.y - gate.r, gate.r * 2, gate.r * 2) : circle(gate.x, gate.y, gate.r) });
      }
      const previous = entrances[index - 1];
      return {
        id: levelId(index), w: 1200, h: 1200, regions, stroke: art.stroke,
        ...(previous ? { parent: levelId(index - 1), round: previous.round !== false,
          portal: { x: previous.x - previous.r, y: previous.y - previous.r, w: previous.r * 2, h: previous.r * 2 } } : {}),
      };
    }),
  };
});
