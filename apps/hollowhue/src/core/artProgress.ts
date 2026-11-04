import { type Progress, emptyProgress, started } from './progress.ts';
import { type Scene, fillIds } from './scene.ts';

/** Copy the most recently coloured occurrence into a new single edition; never modify its source. */
export function singleEditionProgress(single: Scene, sources: { scene: Scene; progress: Progress }[]): Progress | null {
  const art = single.levels[0]?.artworkId;
  if (!art) return null;
  const ids = new Set(fillIds(single.levels[0]!));
  let best: Progress | null = null;
  for (const { scene, progress } of sources) {
    for (const level of scene.levels.filter((l) => l.artworkId === art)) {
      const fills = Object.fromEntries(Object.entries(progress.fills[level.id] ?? {}).filter(([id]) => ids.has(id)));
      const strokes = progress.strokes.filter((s) => s.level === level.id && (!s.clip || ids.has(s.clip)))
        .map((s) => ({ ...s, level: 'z00' }));
      // The shipped chains borrow paper/background paint from the previous gate.
      for (const [id, from] of Object.entries(level.colourLinks ?? {})) {
        if (!ids.has(id) || fills[id]) continue;
        const [parent, target] = from.split('/');
        const colour = progress.fills[parent!]?.[target!];
        if (colour) fills[id] = colour;
      }
      const copy = { ...emptyProgress(single), fills: { z00: fills }, strokes, updated: progress.updated };
      if (started(copy) && (!best || copy.updated > best.updated)) best = copy;
    }
  }
  return best;
}
