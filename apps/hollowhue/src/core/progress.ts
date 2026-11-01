// A scene's colouring progress (fills + freehand strokes), the edits that change it, and undo/redo.
// Pure TS: the app store saves `Progress` as JSON per scene.
import { segDist, simplify } from './geom.ts';
import { type Scene, fillableCount } from './scene.ts';

export type Tool = 'pencil' | 'marker';

export type Stroke = {
  id: string;
  level: string;
  tool: Tool;
  color: string;
  /** Width in the level's own units. */
  width: number;
  /** Flat [x0,y0,x1,y1,...] in the level's own units. */
  pts: number[];
  /** Region the stroke started in when "stay inside the lines" was on: the stroke is clipped to it. */
  clip?: string;
};

export type Progress = {
  v: number;
  /** level id -> region id -> colour */
  fills: Record<string, Record<string, string>>;
  strokes: Stroke[];
  /** Levels the person has zoomed far enough to reveal. */
  found: string[];
  updated: number;
};

export type Edit =
  | { kind: 'fill'; level: string; region: string; color: string | null }
  | { kind: 'stroke'; stroke: Stroke }
  | { kind: 'erase'; ids: string[] }
  | { kind: 'clear' };

/** What undo needs: the edit plus whatever it replaced. */
type Done =
  | { kind: 'fill'; level: string; region: string; color: string | null; prev: string | null }
  | { kind: 'stroke'; stroke: Stroke }
  | { kind: 'erase'; removed: { s: Stroke; at: number }[] }
  | { kind: 'clear'; prev: Progress };

export type History = { past: Done[]; future: Done[] };

export const HISTORY_LIMIT = 200;

export function emptyProgress(scene: Scene): Progress {
  return { v: scene.version, fills: {}, strokes: [], found: [], updated: 0 };
}

/** Read a saved progress blob defensively; drops ids that no longer exist in the scene. */
export function restoreProgress(scene: Scene, raw: unknown): Progress {
  const base = emptyProgress(scene);
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<Progress>;
  const fills: Progress['fills'] = {};
  const levelIds = new Map(scene.levels.map((l) => [l.id, new Set(l.regions.filter((x) => !x.line).map((x) => x.id))]));
  if (r.fills && typeof r.fills === 'object') {
    for (const [lv, m] of Object.entries(r.fills)) {
      const ids = levelIds.get(lv);
      if (!ids || !m || typeof m !== 'object') continue;
      for (const [rid, col] of Object.entries(m)) {
        if (ids.has(rid) && typeof col === 'string' && /^#[0-9a-fA-F]{6}$/.test(col)) (fills[lv] ??= {})[rid] = col;
      }
    }
  }
  const strokes = Array.isArray(r.strokes)
    ? r.strokes.filter(
        (s): s is Stroke =>
          !!s && typeof s === 'object' && levelIds.has((s as Stroke).level) && Array.isArray((s as Stroke).pts) && (s as Stroke).pts.length >= 2,
      )
    : [];
  const found = Array.isArray(r.found) ? r.found.filter((x): x is string => typeof x === 'string' && levelIds.has(x)) : [];
  return { v: scene.version, fills, strokes, found, updated: typeof r.updated === 'number' ? r.updated : 0 };
}

function setFill(p: Progress, level: string, region: string, color: string | null): Progress {
  const lv = { ...(p.fills[level] ?? {}) };
  if (color) lv[region] = color;
  else delete lv[region];
  return { ...p, fills: { ...p.fills, [level]: lv } };
}

/** Apply an edit. Returns the same object (and no history entry) when nothing changes. */
export function apply(p: Progress, h: History, e: Edit, now: number): { p: Progress; h: History } {
  let done: Done | null = null;
  let next = p;
  switch (e.kind) {
    case 'fill': {
      const prev = p.fills[e.level]?.[e.region] ?? null;
      if (prev === e.color) return { p, h };
      next = setFill(p, e.level, e.region, e.color);
      done = { ...e, prev };
      break;
    }
    case 'stroke': {
      if (e.stroke.pts.length < 2) return { p, h };
      next = { ...p, strokes: [...p.strokes, e.stroke] };
      done = e;
      break;
    }
    case 'erase': {
      const ids = new Set(e.ids);
      const removed = p.strokes.map((s, at) => ({ s, at })).filter((x) => ids.has(x.s.id));
      if (!removed.length) return { p, h };
      next = { ...p, strokes: p.strokes.filter((s) => !ids.has(s.id)) };
      done = { kind: 'erase', removed };
      break;
    }
    case 'clear': {
      if (!p.strokes.length && !Object.values(p.fills).some((m) => Object.keys(m).length)) return { p, h };
      next = { ...p, fills: {}, strokes: [] };
      done = { kind: 'clear', prev: p };
      break;
    }
  }
  const past = [...h.past, done].slice(-HISTORY_LIMIT);
  return { p: { ...next, updated: now }, h: { past, future: [] } };
}

export function undo(p: Progress, h: History, now: number): { p: Progress; h: History } {
  const d = h.past[h.past.length - 1];
  if (!d) return { p, h };
  let next: Progress;
  switch (d.kind) {
    case 'fill':
      next = setFill(p, d.level, d.region, d.prev);
      break;
    case 'stroke':
      next = { ...p, strokes: p.strokes.filter((s) => s.id !== d.stroke.id) };
      break;
    case 'erase': {
      const strokes = [...p.strokes];
      for (const r of [...d.removed].sort((a, b) => a.at - b.at)) strokes.splice(Math.min(r.at, strokes.length), 0, r.s);
      next = { ...p, strokes };
      break;
    }
    case 'clear':
      next = { ...p, fills: d.prev.fills, strokes: d.prev.strokes };
      break;
  }
  return { p: { ...next, updated: now }, h: { past: h.past.slice(0, -1), future: [...h.future, d] } };
}

export function redo(p: Progress, h: History, now: number): { p: Progress; h: History } {
  const d = h.future[h.future.length - 1];
  if (!d) return { p, h };
  let next: Progress;
  switch (d.kind) {
    case 'fill':
      next = setFill(p, d.level, d.region, d.color);
      break;
    case 'stroke':
      next = { ...p, strokes: [...p.strokes, d.stroke] };
      break;
    case 'erase': {
      const ids = new Set(d.removed.map((r) => r.s.id));
      next = { ...p, strokes: p.strokes.filter((s) => !ids.has(s.id)) };
      break;
    }
    case 'clear':
      next = { ...p, fills: {}, strokes: [] };
      break;
  }
  return { p: { ...next, updated: now }, h: { past: [...h.past, d], future: h.future.slice(0, -1) } };
}

export function markFound(p: Progress, level: string): Progress {
  return p.found.includes(level) ? p : { ...p, found: [...p.found, level] };
}

/** Share of fillable regions coloured, 0..1 (freehand counts as "started" but not towards the bar). */
export function percent(scene: Scene, p: Progress): number {
  const total = fillableCount(scene);
  if (!total) return 0;
  let n = 0;
  for (const m of Object.values(p.fills)) n += Object.keys(m).length;
  return Math.min(1, n / total);
}

export function started(p: Progress): boolean {
  return p.strokes.length > 0 || Object.values(p.fills).some((m) => Object.keys(m).length > 0);
}

/** Strokes of one level near a point (eraser). */
export function strokesNear(p: Progress, level: string, x: number, y: number, radius: number): string[] {
  const hit: string[] = [];
  for (const s of p.strokes) {
    if (s.level !== level) continue;
    const r = radius + s.width / 2;
    const pts = s.pts;
    if (pts.length === 2) {
      if (Math.hypot(pts[0]! - x, pts[1]! - y) <= r) hit.push(s.id);
      continue;
    }
    for (let k = 0; k + 3 < pts.length; k += 2) {
      if (segDist(x, y, pts[k]!, pts[k + 1]!, pts[k + 2]!, pts[k + 3]!) <= r) {
        hit.push(s.id);
        break;
      }
    }
  }
  return hit;
}

/** Tidy a finished stroke: drop jitter smaller than a third of its width, round to 2 decimals. */
export function finishStroke(s: Stroke): Stroke {
  const pts = simplify(s.pts, Math.max(0.0001, s.width / 3)).map((v) => Math.round(v * 100) / 100);
  return { ...s, pts };
}

export const TOOL_STYLE: Record<Tool, { opacity: number; widths: [number, number, number] }> = {
  // Widths are screen points at the moment of drawing; stored in level units.
  pencil: { opacity: 0.92, widths: [2, 4, 8] },
  marker: { opacity: 0.55, widths: [10, 18, 30] },
};
