// Scene model for infinite-zoom colouring: nested levels, each drawn inside a "portal" rectangle of its
// parent. Camera maths, which levels to draw at a zoom, and tap hit testing all live here (pure TS).
import { type BBox, type Ring, bboxOf, flatten, inBox, inRings } from './geom.ts';

export type Region = {
  id: string;
  /** SVG path data in the level's own coordinates. */
  d: string;
  /** Set for detail lines: drawn with this stroke weight (x the level's base line), never filled. */
  line?: number;
  /**
   * "level/region": while this region has no colour of its own it shows that region's colour (one hop).
   * Keeps a zoomed-in wall the colour you gave it from further out, and stand-ins matching the detail.
   */
  from?: string;
};

export type Level = {
  id: string;
  w: number;
  h: number;
  regions: Region[];
  /** Parent level id (absent for the root). */
  parent?: string;
  /** Where this level sits inside its parent, in the parent's coordinates. Same aspect ratio as w:h. */
  portal?: { x: number; y: number; w: number; h: number };
  /** Draw this level inside an ellipse instead of its rectangle (round windows, mandala centres). */
  round?: boolean;
  /** Base line weight in this level's units. */
  stroke?: number;
};

export type Theme = 'cosy' | 'animals' | 'fantasy' | 'dinosaurs' | 'patterns' | 'cute';

export type Scene = {
  id: string;
  /** i18n key suffix: scene.<id>.title / scene.<id>.blurb */
  theme: Theme;
  /** Bump when region ids change so old saves are trimmed to ids that still exist. */
  version: number;
  levels: Level[];
  /** Palette suggested when the scene opens. */
  palette: string;
};

export type Placed = Level & {
  depth: number;
  /** World transform: world = o + local * s. */
  ox: number;
  oy: number;
  s: number;
  world: BBox;
  /** Flattened fillable regions (lazily built). */
  hit?: { id: string; rings: Ring[]; box: BBox }[];
  children: string[];
};

export type Layout = { scene: Scene; byId: Map<string, Placed>; order: Placed[]; root: Placed; minScale: number };

const layoutCache = new WeakMap<Scene, Layout>();

/** Place every level in world space (root level = world units). */
export function layout(scene: Scene): Layout {
  const cached = layoutCache.get(scene);
  if (cached) return cached;
  const byId = new Map<string, Placed>();
  const order: Placed[] = [];
  const pending = [...scene.levels];
  let guard = 0;
  while (pending.length && guard++ < 1000) {
    const lv = pending.shift()!;
    if (!lv.parent) {
      const p: Placed = { ...lv, depth: 0, ox: 0, oy: 0, s: 1, world: { x: 0, y: 0, w: lv.w, h: lv.h }, children: [] };
      byId.set(lv.id, p);
      order.push(p);
      continue;
    }
    const par = byId.get(lv.parent);
    if (!par) {
      pending.push(lv);
      continue;
    }
    const pr = lv.portal ?? { x: 0, y: 0, w: par.w, h: par.h };
    const s = (par.s * pr.w) / lv.w;
    const ox = par.ox + pr.x * par.s;
    const oy = par.oy + pr.y * par.s;
    const p: Placed = { ...lv, depth: par.depth + 1, ox, oy, s, world: { x: ox, y: oy, w: lv.w * s, h: lv.h * s }, children: [] };
    par.children.push(lv.id);
    byId.set(lv.id, p);
    order.push(p);
  }
  const root = order.find((p) => p.depth === 0);
  if (!root) throw new Error(`scene ${scene.id} has no root level`);
  const out: Layout = { scene, byId, order, root, minScale: Math.min(...order.map((p) => p.s)) };
  layoutCache.set(scene, out);
  return out;
}

export function hitShapes(p: Placed) {
  if (!p.hit) {
    p.hit = p.regions
      .filter((r) => !r.line)
      .map((r) => {
        const rings = flatten(r.d);
        return { id: r.id, rings, box: bboxOf(rings) };
      });
  }
  return p.hit;
}

// ---------- camera ----------

/** cx, cy: world point at the screen centre. z: screen points per world unit. */
export type Camera = { cx: number; cy: number; z: number };
export type Screen = { w: number; h: number };

export function fitCamera(L: Layout, sc: Screen, margin = 0.94): Camera {
  const r = L.root;
  return { cx: r.w / 2, cy: r.h / 2, z: Math.min(sc.w / r.w, sc.h / r.h) * margin };
}

export function zoomLimits(L: Layout, sc: Screen) {
  const fit = fitCamera(L, sc).z;
  return { min: fit * 0.85, max: (fit / L.minScale) * 4 };
}

export function clampCamera(L: Layout, sc: Screen, cam: Camera): Camera {
  const { min, max } = zoomLimits(L, sc);
  const z = Math.max(min, Math.min(max, cam.z));
  const r = L.root;
  // The screen centre stays over the scene; when the scene is smaller than the screen it stays centred.
  const vw = sc.w / z;
  const vh = sc.h / z;
  const cx = vw >= r.w ? r.w / 2 : Math.max(vw / 2, Math.min(r.w - vw / 2, cam.cx));
  const cy = vh >= r.h ? r.h / 2 : Math.max(vh / 2, Math.min(r.h - vh / 2, cam.cy));
  return { cx, cy, z };
}

export function viewBox(cam: Camera, sc: Screen): BBox {
  const w = sc.w / cam.z;
  const h = sc.h / cam.z;
  return { x: cam.cx - w / 2, y: cam.cy - h / 2, w, h };
}

export function toWorld(cam: Camera, sc: Screen, px: number, py: number) {
  return { x: cam.cx + (px - sc.w / 2) / cam.z, y: cam.cy + (py - sc.h / 2) / cam.z };
}

export function toLocal(p: Placed, wx: number, wy: number) {
  return { x: (wx - p.ox) / p.s, y: (wy - p.oy) / p.s };
}

/** Zoom by `factor` keeping the world point under screen point (px,py) fixed. */
export function zoomAt(cam: Camera, sc: Screen, px: number, py: number, factor: number): Camera {
  const w = toWorld(cam, sc, px, py);
  const z = cam.z * factor;
  return { cx: w.x - (px - sc.w / 2) / z, cy: w.y - (py - sc.h / 2) / z, z };
}

/** Camera that frames a level (used by "Look closer" and the level chips). */
export function cameraFor(p: Placed, sc: Screen, margin = 0.92): Camera {
  return { cx: p.world.x + p.world.w / 2, cy: p.world.y + p.world.h / 2, z: Math.min(sc.w / p.world.w, sc.h / p.world.h) * margin };
}

/** Point along a smooth zoom flight from a to b at t in [0,1] (log zoom, fixed-point pan). */
export function flight(a: Camera, b: Camera, t: number): Camera {
  const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const z = Math.exp(Math.log(a.z) * (1 - e) + Math.log(b.z) * e);
  const ia = 1 / a.z;
  const ib = 1 / b.z;
  const u = Math.abs(ia - ib) < 1e-12 ? e : (ia - 1 / z) / (ia - ib);
  return { cx: a.cx + (b.cx - a.cx) * u, cy: a.cy + (b.cy - a.cy) * u, z };
}

// ---------- what to draw ----------

/** Share of the screen width a child level must fill before its detail is drawn. */
export const REVEAL_AT = 0.15;

/**
 * Whether a child level's detail is drawn at this zoom (1) or its parent's simple stand-in shows (0).
 * A hard switch while the child is still small on screen reads as detail appearing, without ghosting.
 */
export function revealOf(p: Placed, cam: Camera, sc: Screen): number {
  if (p.depth === 0) return 1;
  return (p.world.w * cam.z) / sc.w >= REVEAL_AT ? 1 : 0;
}

function overlaps(a: BBox, b: BBox) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

function contains(outer: BBox, inner: BBox) {
  return inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;
}

export type Visible = { level: Placed; alpha: number }[];

/**
 * Levels to draw, parents first. A fully revealed level that covers the whole screen hides its ancestors,
 * so deep zoom only ever draws a handful of levels.
 */
export function visibleLevels(L: Layout, cam: Camera, sc: Screen): Visible {
  const vb = viewBox(cam, sc);
  let base = L.root;
  // Walk down while a fully revealed (rectangular) child covers the screen.
  for (;;) {
    const next = base.children
      .map((id) => L.byId.get(id)!)
      .find((c) => !c.round && revealOf(c, cam, sc) >= 1 && contains(c.world, vb));
    if (!next) break;
    base = next;
  }
  const out: Visible = [];
  const walk = (p: Placed, alpha: number) => {
    out.push({ level: p, alpha });
    for (const id of p.children) {
      const c = L.byId.get(id)!;
      const a = revealOf(c, cam, sc);
      if (a > 0 && overlaps(c.world, vb)) walk(c, a);
    }
  };
  walk(base, 1);
  return out;
}

export type Hit = { level: string; region: string };

/** Which fillable region a world point lands on: the deepest level shown at least half-revealed, topmost region. */
export function hitTest(vis: Visible, wx: number, wy: number): Hit | null {
  const cands = vis
    .filter((v) => v.alpha >= 0.5 && inBox(v.level.world, wx, wy))
    .filter((v) => {
      if (!v.level.round) return true;
      const l = toLocal(v.level, wx, wy);
      const dx = (l.x - v.level.w / 2) / (v.level.w / 2);
      const dy = (l.y - v.level.h / 2) / (v.level.h / 2);
      return dx * dx + dy * dy <= 1;
    })
    .sort((a, b) => b.level.depth - a.level.depth);
  for (const v of cands) {
    const l = toLocal(v.level, wx, wy);
    const shapes = hitShapes(v.level);
    for (let i = shapes.length - 1; i >= 0; i--) {
      const s = shapes[i]!;
      if (inBox(s.box, l.x, l.y) && inRings(s.rings, l.x, l.y)) return { level: v.level.id, region: s.id };
    }
  }
  return null;
}

/** Deepest level drawn (at least half revealed) under a world point: where a freehand stroke belongs. */
export function levelAt(vis: Visible, wx: number, wy: number): Placed | null {
  let best: Placed | null = null;
  for (const v of vis) if (v.alpha >= 0.5 && inBox(v.level.world, wx, wy) && (!best || v.level.depth > best.depth)) best = v.level;
  return best;
}

export function fillableCount(scene: Scene): number {
  return scene.levels.reduce((n, l) => n + l.regions.filter((r) => !r.line).length, 0);
}
