// Dev tool: what the canvas draws at each step of a zoom flight, using the app's own rules (visibleLevels,
// shapeOpacity). Pipe to zoom-preview.py to render the frames and check that nothing pops in.
// Run: node scripts/zoom-frames.ts <scene> <level> [frames] > /tmp/frames.json
import { flatten } from '../src/core/geom.ts';
import { cameraFor, fitCamera, layout, regionSizes, shapeOpacity, visibleLevels } from '../src/core/scene.ts';
import { sceneById } from '../src/scenes/index.ts';

const [sceneId = 'bookshop', levelId = 'ladybird', n = '24'] = process.argv.slice(2);
const scene = sceneById(sceneId)!;
const L = layout(scene);
const SC = { w: 1024, h: 768 };
const from = fitCamera(L, SC);
const to = cameraFor(L.byId.get(levelId)!, SC);
const frames = [];
for (let f = 0; f < Number(n); f++) {
  // Pure zoom about the target's centre (no pan), so neighbouring frames can be compared pixel for pixel.
  const t = f / (Number(n) - 1);
  const cam = { cx: to.cx, cy: to.cy, z: from.z * Math.pow(to.z / from.z, t) };
  const vis = visibleLevels(L, cam, SC);
  const X = (wx: number) => (wx - cam.cx) * cam.z + SC.w / 2;
  const Y = (wy: number) => (wy - cam.cy) * cam.z + SC.h / 2;
  frames.push({
    z: cam.z,
    levels: vis.map((v) => {
      const p = v.level;
      const sizes = regionSizes(p);
      const k = p.s * cam.z;
      return {
        id: p.id,
        round: !!p.round,
        clip: [X(p.ox), Y(p.oy), X(p.ox + p.w * p.s), Y(p.oy + p.h * p.s)],
        stroke: (p.stroke ?? 2.6) * k,
        shapes: p.regions
          .map((r, i) => ({ r, op: shapeOpacity(sizes[i]!, v.step) }))
          .filter((x) => x.op > 0)
          .map(({ r, op }, i) => ({
            line: r.line ?? 0,
            seam: i === 0 && p.depth > 0 && r === p.regions[0],
            op,
            id: r.id,
            rings: flatten(r.d, 6).map((ring) => ring.map((val, j) => Math.round((j % 2 ? Y(p.oy + val * p.s) : X(p.ox + val * p.s)) * 10) / 10)),
          })),
      };
    }),
  });
}
process.stdout.write(JSON.stringify(frames));
