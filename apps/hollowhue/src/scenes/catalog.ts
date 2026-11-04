import { circle, petal, rect } from '../core/build.ts';
import type { Region, Scene } from '../core/scene.ts';
import { ARTWORK, ARTWORK_INFO, type Artwork } from './art/catalog-art.ts';
import { catalogData } from './catalog-data.ts';

const levelId = (index: number) => `z${String(index).padStart(2, '0')}`;

/** Exact shipped chains remain accessible through My colouring. New nested editions use new IDs. */
export const SHIPPED_ART_SCENES: Scene[] = catalogData.map((data) => {
  const mega = 'mega' in data && data.mega;
  const entrances = data.art.map((id) => mega ? { x: 600, y: 600, r: 168, natural: true, round: true } : ARTWORK_INFO[id]!.focal);
  return {
    id: data.id, theme: data.theme, difficulty: data.difficulty,
    palette: data.palette, version: 1, mega, legacy: true,
    levels: data.art.map((id, index) => {
      const info = ARTWORK_INFO[id]!;
      const adapted = new WeakMap<Artwork, Region[]>();
      const gate = entrances[index]!;
      const extra: Region[] = [];
      if (index < data.art.length - 1) {
        if (!gate.natural) {
          for (let k = 0; k < 8; k++) extra.push({ id: `sealPetal${k}`, d: petal(gate.x, gate.y, k * Math.PI / 4, gate.r * .85, gate.r * 1.6, gate.r * .2) });
        }
        extra.push({ id: 'zoomGate', d: gate.round === false ? rect(gate.x - gate.r, gate.y - gate.r, gate.r * 2, gate.r * 2) : circle(gate.x, gate.y, gate.r) });
      }
      function regions() {
        const art = ARTWORK[id]!;
        const cached = adapted.get(art);
        if (cached) return cached;
        const value = art.regions.map((r) => index > 0 && (r.id === 'paper' || r.id === art.background)
        ? { ...r, from: `${levelId(index - 1)}/zoomGate` } : r);
        value.push(...extra);
        adapted.set(art, value);
        return value;
      }
      const previous = entrances[index - 1];
      return {
        id: levelId(index), w: 1200, h: 1200, get regions() { return regions(); }, stroke: info.stroke,
        ...(previous ? { parent: levelId(index - 1), round: previous.round !== false,
          portal: { x: previous.x - previous.r, y: previous.y - previous.r, w: previous.r * 2, h: previous.r * 2 } } : {}),
        artworkId: id, fillIds: [...info.fillIds, ...extra.map((r) => r.id)],
        ...(index > 0 ? { colourLinks: { paper: `${levelId(index - 1)}/zoomGate`, [info.background]: `${levelId(index - 1)}/zoomGate` } } : {}),
        regionSizeHints: [...info.regionSizeHints, ...extra.map(() => gate.r * 4)],
      };
    }),
  };
});
