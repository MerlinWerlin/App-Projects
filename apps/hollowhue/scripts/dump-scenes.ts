// Dev tool: flatten every scene to JSON polygons for scripts/preview.py (art check without a phone).
// Run: node scripts/dump-scenes.ts > /tmp/scenes.json
import { flatten } from '../src/core/geom.ts';
import { SCENES } from '../src/scenes/index.ts';

const out = SCENES.map((s) => ({
  id: s.id,
  levels: s.levels.map((l) => ({
    id: l.id,
    w: l.w,
    h: l.h,
    parent: l.parent ?? null,
    portal: l.portal ?? null,
    round: !!l.round,
    stroke: l.stroke ?? 3,
    regions: l.regions.map((r) => ({ id: r.id, line: r.line ?? 0, rings: flatten(r.d, 8).map((ring) => ring.map((v) => Math.round(v * 10) / 10)) })),
  })),
}));
process.stdout.write(JSON.stringify(out));
