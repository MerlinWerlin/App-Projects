// The zoomable colouring surface: pinch/pan camera, tap-to-fill, freehand pencil/marker/rubber.
// One finger: fill (tap) or pan in Fill mode, draws in Draw mode. Two fingers: always zoom and move.
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { type GestureResponderEvent, type LayoutChangeEvent, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { strokePath } from '../core/geom';
import { type Edit, type Progress, type Stroke, type Tool, TOOL_STYLE, finishStroke, strokesNear } from '../core/progress';
import {
  type Camera,
  type Layout,
  type Placed,
  type Screen,
  cameraFor,
  clampCamera,
  fitCamera,
  FOUND_AT,
  flight,
  focusAt,
  hitTest,
  levelAt,
  toLocal,
  toWorld,
  viewBox,
  visibleLevels,
  zoomAt,
} from '../core/scene';
import { t } from '../i18n';
import { motion } from '../theme/tokens';
import { type Base, SceneLevels, useStrokesByLevel } from './SceneArt';

export type Mode = 'fill' | 'draw';
export type DrawTool = Tool | 'eraser';

export type CanvasHandle = {
  zoomBy: (f: number) => void;
  fit: () => void;
  flyTo: (levelId: string) => void;
};

type Props = {
  L: Layout;
  progress: Progress;
  mode: Mode;
  tool: DrawTool;
  /** null = rubber swatch in fill mode */
  color: string | null;
  sizeIndex: 0 | 1 | 2;
  insideLines: boolean;
  onEdit: (e: Edit) => void;
  /** Deepest sizeable level under the screen centre, and every level big enough on screen to count as found. */
  onFocus: (levelId: string, foundIds: string[]) => void;
  onTouchStart?: () => void;
};

type Pt = { x: number; y: number };
type Gesture =
  | { kind: 'idle' }
  | { kind: 'tap'; start: Pt; t0: number }
  | { kind: 'pan'; start: Pt; cam: Camera }
  | { kind: 'pinch'; mid: Pt; dist: number; cam: Camera }
  | { kind: 'draw'; level: Placed; stroke: Stroke; t0: number; last: Pt }
  | { kind: 'erase'; ids: Set<string>; start: Pt; moved: boolean };

let strokeSeq = 0;
const newId = () => `${Date.now().toString(36)}${(strokeSeq++).toString(36)}`;

function touchesOf(e: GestureResponderEvent): Pt[] {
  const ts = e.nativeEvent.touches;
  if (!ts || ts.length === 0) return [{ x: e.nativeEvent.locationX, y: e.nativeEvent.locationY }];
  return ts.map((p) => ({ x: p.locationX, y: p.locationY }));
}

export const Canvas = forwardRef<CanvasHandle, Props>(function Canvas(props, ref) {
  const { L, progress, mode, tool, color, sizeIndex, insideLines, onEdit, onFocus, onTouchStart } = props;
  const [sc, setSc] = useState<Screen>({ w: 0, h: 0 });
  const [cam, setCam] = useState<Camera>({ cx: L.root.w / 2, cy: L.root.h / 2, z: 0.0001 });
  const [live, setLive] = useState<{ level: Placed; stroke: Stroke } | null>(null);
  const [erasing, setErasing] = useState<Set<string> | undefined>(undefined);
  const camRef = useRef(cam);
  const scRef = useRef(sc);
  const g = useRef<Gesture>({ kind: 'idle' });
  const anim = useRef<number | null>(null);
  const frame = useRef<number | null>(null);
  const pendingCam = useRef<Camera | null>(null);
  const latest = useRef(props);
  latest.current = props;

  const commitCam = useCallback(
    (c: Camera, now = false) => {
      const next = clampCamera(L, scRef.current, c);
      camRef.current = next;
      if (now) {
        setCam(next);
        return;
      }
      pendingCam.current = next;
      if (frame.current == null) {
        frame.current = requestAnimationFrame(() => {
          frame.current = null;
          if (pendingCam.current) setCam(pendingCam.current);
          pendingCam.current = null;
        });
      }
    },
    [L],
  );

  const stopFlight = () => {
    if (anim.current != null) cancelAnimationFrame(anim.current);
    anim.current = null;
  };

  const flyToCam = useCallback(
    (target: Camera) => {
      stopFlight();
      const from = camRef.current;
      const to = clampCamera(L, scRef.current, target);
      const t0 = Date.now();
      const step = () => {
        const k = Math.min(1, (Date.now() - t0) / motion.flight);
        const c = flight(from, to, k);
        camRef.current = c;
        setCam(c);
        anim.current = k < 1 ? requestAnimationFrame(step) : null;
      };
      anim.current = requestAnimationFrame(step);
    },
    [L],
  );

  useImperativeHandle(
    ref,
    () => ({
      zoomBy: (f) => {
        const s = scRef.current;
        const c = camRef.current;
        flyToCam(zoomAt(c, s, s.w / 2, s.h / 2, f));
      },
      fit: () => flyToCam(fitCamera(L, scRef.current)),
      flyTo: (id) => {
        const p = L.byId.get(id);
        if (p) flyToCam(cameraFor(p, scRef.current));
      },
    }),
    [L, flyToCam],
  );

  useEffect(
    () => () => {
      stopFlight();
      if (frame.current != null) cancelAnimationFrame(frame.current);
    },
    [],
  );

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    const first = scRef.current.w === 0;
    const s = { w: width, h: height };
    scRef.current = s;
    setSc(s);
    // First layout: show the whole scene. Rotation: keep the same view, re-clamped.
    commitCam(first ? fitCamera(L, s) : camRef.current, true);
  };

  const ready = sc.w > 0 && sc.h > 0;
  const vis = useMemo(() => (ready ? visibleLevels(L, cam, sc) : []), [L, cam, sc, ready]);
  const visRef = useRef(vis);
  visRef.current = vis;
  const strokesByLevel = useStrokesByLevel(progress);

  // Report where we are (level under the screen centre) for the title chip and "found" levels.
  const focusKey = vis.map((v) => v.level.id).join('|');
  useEffect(() => {
    if (!ready) return;
    const w = toWorld(cam, sc, sc.w / 2, sc.h / 2);
    const lv = focusAt(vis, w.x, w.y) ?? L.root;
    onFocus(
      lv.id,
      vis.filter((v) => v.frac >= FOUND_AT).map((v) => v.level.id),
    );
  }, [focusKey, Math.round(Math.log2(cam.z) * 4), Math.round(cam.cx), Math.round(cam.cy)]);

  // ---------------- gestures ----------------

  const beginSingle = (p: Pt) => {
    const P = latest.current;
    if (P.mode === 'fill') {
      g.current = { kind: 'tap', start: p, t0: Date.now() };
      return;
    }
    const s = scRef.current;
    const c = camRef.current;
    const w = toWorld(c, s, p.x, p.y);
    const lv = levelAt(visRef.current, w.x, w.y);
    if (!lv) {
      g.current = { kind: 'pan', start: p, cam: c };
      return;
    }
    if (P.tool === 'eraser') {
      g.current = { kind: 'erase', ids: new Set(), start: p, moved: false };
      eraseAt(p);
      return;
    }
    const local = toLocal(lv, w.x, w.y);
    const hit = P.insideLines ? hitTest(visRef.current, w.x, w.y) : null;
    const st = TOOL_STYLE[P.tool];
    const stroke: Stroke = {
      id: newId(),
      level: lv.id,
      tool: P.tool,
      color: P.color ?? '#2B2622',
      width: st.widths[P.sizeIndex] / (c.z * lv.s),
      pts: [local.x, local.y],
      ...(hit && hit.level === lv.id ? { clip: hit.region } : {}),
    };
    g.current = { kind: 'draw', level: lv, stroke, t0: Date.now(), last: p };
    setLive({ level: lv, stroke });
  };

  const eraseAt = (p: Pt) => {
    const cur = g.current;
    if (cur.kind !== 'erase') return;
    const s = scRef.current;
    const c = camRef.current;
    const w = toWorld(c, s, p.x, p.y);
    const lv = levelAt(visRef.current, w.x, w.y);
    if (!lv) return;
    const local = toLocal(lv, w.x, w.y);
    const found = strokesNear(latest.current.progress, lv.id, local.x, local.y, 14 / (c.z * lv.s));
    let changed = false;
    for (const id of found)
      if (!cur.ids.has(id)) {
        cur.ids.add(id);
        changed = true;
      }
    if (changed) setErasing(new Set(cur.ids));
  };

  const beginPinch = (ts: Pt[]) => {
    const a = ts[0]!;
    const b = ts[1]!;
    g.current = {
      kind: 'pinch',
      mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
      cam: camRef.current,
    };
  };

  const endDraw = (keep: boolean) => {
    const cur = g.current;
    if (cur.kind === 'draw' && keep) latest.current.onEdit({ kind: 'stroke', stroke: finishStroke(cur.stroke) });
    setLive(null);
  };

  const onGrant = (e: GestureResponderEvent) => {
    stopFlight();
    onTouchStart?.();
    const ts = touchesOf(e);
    if (ts.length >= 2) beginPinch(ts);
    else beginSingle(ts[0]!);
  };

  const onMove = (e: GestureResponderEvent) => {
    const ts = touchesOf(e);
    const cur = g.current;
    if (ts.length >= 2) {
      if (cur.kind !== 'pinch') {
        // A second finger arrived: a stroke that only just started was the first finger of a pinch.
        if (cur.kind === 'draw') endDraw(Date.now() - cur.t0 > 250 && cur.stroke.pts.length > 6);
        if (cur.kind === 'erase') commitErase();
        beginPinch(ts);
        return;
      }
      const a = ts[0]!;
      const b = ts[1]!;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const dist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
      const s = scRef.current;
      const anchor = toWorld(cur.cam, s, cur.mid.x, cur.mid.y);
      const z = cur.cam.z * (dist / cur.dist);
      commitCam({ cx: anchor.x - (mid.x - s.w / 2) / z, cy: anchor.y - (mid.y - s.h / 2) / z, z });
      return;
    }
    const p = ts[0]!;
    switch (cur.kind) {
      case 'pinch':
        // One finger lifted: carry on moving with the other.
        g.current = { kind: 'pan', start: p, cam: camRef.current };
        return;
      case 'tap':
        if (Math.hypot(p.x - cur.start.x, p.y - cur.start.y) > 8) g.current = { kind: 'pan', start: cur.start, cam: camRef.current };
        return;
      case 'pan': {
        const c = cur.cam;
        commitCam({ cx: c.cx - (p.x - cur.start.x) / c.z, cy: c.cy - (p.y - cur.start.y) / c.z, z: c.z });
        return;
      }
      case 'draw': {
        if (Math.hypot(p.x - cur.last.x, p.y - cur.last.y) < 1.5) return;
        const s = scRef.current;
        const w = toWorld(camRef.current, s, p.x, p.y);
        const l = toLocal(cur.level, w.x, w.y);
        cur.stroke = { ...cur.stroke, pts: [...cur.stroke.pts, l.x, l.y] };
        cur.last = p;
        setLive({ level: cur.level, stroke: cur.stroke });
        return;
      }
      case 'erase':
        if (Math.hypot(p.x - cur.start.x, p.y - cur.start.y) > 8) cur.moved = true;
        eraseAt(p);
        return;
      default:
        return;
    }
  };

  const commitErase = (tapped = false) => {
    const cur = g.current;
    if (cur.kind === 'erase' && cur.ids.size) latest.current.onEdit({ kind: 'erase', ids: [...cur.ids] });
    else if (cur.kind === 'erase' && tapped && !cur.moved) {
      // A tap with the rubber on a shape with no drawing clears that shape's colour.
      const w = toWorld(camRef.current, scRef.current, cur.start.x, cur.start.y);
      const hit = hitTest(visRef.current, w.x, w.y);
      if (hit) latest.current.onEdit({ kind: 'fill', level: hit.level, region: hit.region, color: null });
    }
    setErasing(undefined);
  };

  const onRelease = () => {
    const cur = g.current;
    if (cur.kind === 'tap' && Date.now() - cur.t0 < 600) {
      const s = scRef.current;
      const w = toWorld(camRef.current, s, cur.start.x, cur.start.y);
      const hit = hitTest(visRef.current, w.x, w.y);
      if (hit) latest.current.onEdit({ kind: 'fill', level: hit.level, region: hit.region, color: latest.current.color });
    } else if (cur.kind === 'draw') {
      // A single touch with no movement leaves a dot, which is what a pencil does.
      endDraw(true);
    } else if (cur.kind === 'erase') {
      commitErase(true);
    }
    g.current = { kind: 'idle' };
  };

  const onTerminate = () => {
    if (g.current.kind === 'draw') endDraw(false);
    if (g.current.kind === 'erase') setErasing(undefined);
    g.current = { kind: 'idle' };
  };

  // Draw relative to the outermost drawn level so SVG numbers stay small at any depth.
  const baseLevel = vis[0]?.level ?? L.root;
  const base = useMemo<Base>(() => ({ ox: baseLevel.ox, oy: baseLevel.oy, s: baseLevel.s }), [baseLevel]);
  const wvb = viewBox(cam, sc);
  const vb = { x: (wvb.x - base.ox) / base.s, y: (wvb.y - base.oy) / base.s, w: wvb.w / base.s, h: wvb.h / base.s };
  return (
    <View
      style={{ flex: 1, overflow: 'hidden' }}
      onLayout={onLayout}
      accessible
      accessibilityLabel={t('canvas.label')}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={onGrant}
      onResponderMove={onMove}
      onResponderRelease={onRelease}
      onResponderTerminate={onTerminate}
    >
      {ready ? (
        <Svg width={sc.w} height={sc.h} viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} pointerEvents="none">
          <SceneLevels vis={vis} base={base} progress={progress} strokesByLevel={strokesByLevel} hidden={erasing} />
          {live ? (
            <Path
              transform={`translate(${(live.level.ox - base.ox) / base.s} ${(live.level.oy - base.oy) / base.s}) scale(${live.level.s / base.s})`}
              d={strokePath(live.stroke.pts)}
              stroke={live.stroke.color}
              strokeOpacity={TOOL_STYLE[live.stroke.tool].opacity}
              strokeWidth={live.stroke.width}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ) : null}
        </Svg>
      ) : null}
    </View>
  );
});
