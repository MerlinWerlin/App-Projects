// Draws a scene's levels with react-native-svg. Each level is memoised, so panning and zooming only changes
// the viewBox; a level re-renders only when its own colours or drawings change.
import { memo, useMemo } from 'react';
import Svg, { ClipPath, Defs, Ellipse, G, Path, Rect } from 'react-native-svg';
import { strokePath } from '../core/geom';
import { type Progress, type Stroke, TOOL_STYLE } from '../core/progress';
import { type Layout, type Placed, type Visible, detailStep, regionSizes, shapeOpacity } from '../core/scene';
import { ART } from '../theme/tokens';

type Fills = Record<string, string>;

/** Colours this level borrows from other levels (region.from), as a stable string key + map. */
function links(level: Placed, all: Progress['fills']): { key: string; map: Fills } {
  const map: Fills = {};
  let key = '';
  for (const r of level.regions) {
    if (!r.from) continue;
    const slash = r.from.indexOf('/');
    const c = all[r.from.slice(0, slash)]?.[r.from.slice(slash + 1)];
    if (c) {
      map[r.id] = c;
      key += `${r.id}=${c};`;
    }
  }
  return { key, map };
}

function sameStrokes(a: Stroke[], b: Stroke[]) {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** The level everything is drawn relative to (keeps numbers small at deep zoom: no float precision loss). */
export type Base = { ox: number; oy: number; s: number };

type LevelProps = {
  level: Placed;
  base: Base;
  /** Quantised zoom (detailStep): which shapes are drawn and how faded. */
  step: number;
  fills: Fills | undefined;
  linkKey: string;
  linkMap: Fills;
  strokes: Stroke[];
  hidden?: Set<string>;
  clip: boolean;
};

function StrokePath({ s }: { s: Stroke }) {
  const st = TOOL_STYLE[s.tool];
  return (
    <Path
      d={strokePath(s.pts)}
      stroke={s.color}
      strokeOpacity={st.opacity}
      strokeWidth={s.width}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  );
}

const LevelArt = memo(
  function LevelArt({ level, base, step, fills, linkMap, strokes, hidden, clip }: LevelProps) {
    const sw = level.stroke ?? 2.6;
    const sizes = regionSizes(level);
    // Strokes that stay inside a shape are drawn right after that shape (so shapes on top still cover them),
    // then that shape's outline again so the line art stays crisp. Free strokes go on top of everything.
    const byRegion = new Map<string, Stroke[]>();
    const free: Stroke[] = [];
    for (const s of strokes) {
      if (hidden?.has(s.id)) continue;
      if (s.clip) {
        const arr = byRegion.get(s.clip);
        if (arr) arr.push(s);
        else byRegion.set(s.clip, [s]);
      } else free.push(s);
    }
    const cid = (r: string) => `c-${level.id}-${r}`;
    const levelClip = `lv-${level.id}`;
    return (
      <G transform={`translate(${(level.ox - base.ox) / base.s} ${(level.oy - base.oy) / base.s}) scale(${level.s / base.s})`}>
        <Defs>
          {clip ? (
            <ClipPath id={levelClip}>
              {level.round ? (
                <Ellipse cx={level.w / 2} cy={level.h / 2} rx={level.w / 2} ry={level.h / 2} />
              ) : (
                <Rect x={0} y={0} width={level.w} height={level.h} />
              )}
            </ClipPath>
          ) : null}
          {[...byRegion.keys()].map((rid) => {
            const r = level.regions.find((x) => x.id === rid);
            return r ? (
              <ClipPath key={rid} id={cid(rid)}>
                <Path d={r.d} fillRule="evenodd" clipRule="evenodd" />
              </ClipPath>
            ) : null;
          })}
        </Defs>
        <G clipPath={clip ? `url(#${levelClip})` : undefined}>
          {level.regions.map((r, i) => {
            const inside = r.line ? undefined : byRegion.get(r.id);
            // Detail fades in as it grows on screen; shapes holding the person's drawing always show.
            const op = inside ? 1 : shapeOpacity(sizes[i]!, step);
            if (op === 0) return null;
            if (r.line) {
              return (
                <Path
                  key={r.id}
                  opacity={op}
                  d={r.d}
                  fill="none"
                  stroke={ART.ink}
                  strokeWidth={sw * r.line}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              );
            }
            const paint = fills?.[r.id] ?? linkMap[r.id] ?? ART.paper;
            // A nested level's background has no outline: its edge is the portal edge, and a drawn border there
            // would show the seam between the two pictures.
            const seam = i === 0 && level.depth > 0;
            if (!inside) {
              return (
                <Path key={r.id} opacity={op} d={r.d} fill={paint} fillRule="evenodd" stroke={seam ? 'none' : ART.ink} strokeWidth={sw} strokeLinejoin="round" />
              );
            }
            return (
              <G key={r.id}>
                <Path d={r.d} fill={paint} fillRule="evenodd" />
                <G clipPath={`url(#${cid(r.id)})`}>
                  {inside.map((s) => (
                    <StrokePath key={s.id} s={s} />
                  ))}
                </G>
                {seam ? null : <Path d={r.d} fill="none" stroke={ART.ink} strokeWidth={sw} strokeLinejoin="round" />}
              </G>
            );
          })}
          {free.map((s) => (
            <StrokePath key={s.id} s={s} />
          ))}
        </G>
      </G>
    );
  },
  (a, b) =>
    a.level === b.level &&
    a.base === b.base &&
    a.step === b.step &&
    a.fills === b.fills &&
    a.linkKey === b.linkKey &&
    a.clip === b.clip &&
    a.hidden === b.hidden &&
    sameStrokes(a.strokes, b.strokes),
);

const NO_STROKES: Stroke[] = [];
const ROOT_BASE: Base = { ox: 0, oy: 0, s: 1 };

export function useStrokesByLevel(p: Progress) {
  return useMemo(() => {
    const m = new Map<string, Stroke[]>();
    for (const s of p.strokes) {
      const arr = m.get(s.level);
      if (arr) arr.push(s);
      else m.set(s.level, [s]);
    }
    return m;
  }, [p.strokes]);
}

/** All visible levels of a scene inside one Svg. */
export function SceneLevels({
  vis,
  base,
  progress,
  strokesByLevel,
  hidden,
}: {
  vis: Visible;
  base: Base;
  progress: Progress;
  strokesByLevel: Map<string, Stroke[]>;
  hidden?: Set<string>;
}) {
  return (
    <>
      {vis.map(({ level, step }) => {
        const l = links(level, progress.fills);
        return (
          <LevelArt
            key={level.id}
            level={level}
            base={base}
            step={step}
            fills={progress.fills[level.id]}
            linkKey={l.key}
            linkMap={l.map}
            strokes={strokesByLevel.get(level.id) ?? NO_STROKES}
            hidden={hidden}
            clip={level.depth > 0}
          />
        );
      })}
    </>
  );
}

/** A still picture of a scene's outermost level (gallery cards). */
export const SceneThumb = memo(function SceneThumb({ L, progress, width }: { L: Layout; progress: Progress; width: number }) {
  const strokes = useStrokesByLevel(progress);
  const r = L.root;
  return (
    <Svg width={width} height={(width * r.h) / r.w} viewBox={`0 0 ${r.w} ${r.h}`} pointerEvents="none">
      <SceneLevels vis={[{ level: r, frac: 1, step: detailStep(width / r.w) }]} base={ROOT_BASE} progress={progress} strokesByLevel={strokes} />
    </Svg>
  );
});
