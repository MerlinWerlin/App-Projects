// WallpaperView: draws layoutWallpaper() with react-native-svg at width×height points.
// Layers: base fill, linear gradient, soft radial blobs, pattern shapes, the theme's artwork
// composition (params.art, see core/artwork compositionLayout), then grain dots.
// forwardRef to the wrapping View (collapsable={false}) so it can be captured with view-shot.

import { forwardRef, memo, useId, useMemo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { compositionLayout } from '../core/artwork';
import { layoutWallpaper, type WallpaperParams } from '../core/wallpaper';
import { ArtPaths } from './ArtPaths';

export type WallpaperViewProps = {
  params: WallpaperParams;
  /** Size in points. */
  width: number;
  height: number;
  /** Draw at most this many grain dots (small previews can skip most of them). */
  maxGrain?: number;
  /** Draw the theme artwork composition when params.art is set (default true). */
  showArt?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

const pct = (v: number) => `${Math.round(v * 10000) / 100}%`;

function safeId(raw: string): string {
  return raw.replace(/[^A-Za-z0-9_-]/g, '');
}

const WallpaperSvg = memo(function WallpaperSvg({
  params,
  width,
  height,
  maxGrain,
  showArt,
  id,
}: {
  params: WallpaperParams;
  width: number;
  height: number;
  maxGrain: number;
  showArt: boolean;
  id: string;
}) {
  const layout = useMemo(() => layoutWallpaper(params, width, height), [params, width, height]);
  const art = useMemo(
    () => (showArt ? compositionLayout(params.art, width, height, params.seed) : []),
    [showArt, params.art, params.seed, width, height],
  );
  const grain = maxGrain < layout.grain.length ? layout.grain.slice(0, Math.max(0, maxGrain)) : layout.grain;
  const g = layout.gradient;
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Defs>
        {g ? (
          <LinearGradient id={`${id}-lin`} x1={pct(g.vector.x1)} y1={pct(g.vector.y1)} x2={pct(g.vector.x2)} y2={pct(g.vector.y2)}>
            {g.stops.map((s, i) => (
              <Stop key={i} offset={s.offset} stopColor={s.colour} stopOpacity={1} />
            ))}
          </LinearGradient>
        ) : null}
        {layout.blobs.map((b, i) => (
          <RadialGradient
            key={i}
            id={`${id}-blob${i}`}
            cx={b.cx}
            cy={b.cy}
            r={b.r}
            fx={b.cx}
            fy={b.cy}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset={0} stopColor={b.colour} stopOpacity={b.opacity} />
            <Stop offset={0.45} stopColor={b.colour} stopOpacity={b.opacity * 0.55} />
            <Stop offset={0.75} stopColor={b.colour} stopOpacity={b.opacity * 0.18} />
            <Stop offset={1} stopColor={b.colour} stopOpacity={0} />
          </RadialGradient>
        ))}
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill={layout.base} />
      {g ? <Rect x={0} y={0} width={width} height={height} fill={`url(#${id}-lin)`} /> : null}
      {layout.blobs.map((b, i) => (
        <Circle key={i} cx={b.cx} cy={b.cy} r={b.r} fill={`url(#${id}-blob${i})`} />
      ))}
      {layout.shapes.length > 0 ? (
        <G>
          {layout.shapes.map((s, i) =>
            s.type === 'rect' ? (
              <Rect key={i} x={s.x} y={s.y} width={s.width} height={s.height} fill={s.colour} fillOpacity={s.opacity} />
            ) : s.type === 'circle' ? (
              <Circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill={s.colour} fillOpacity={s.opacity} />
            ) : (
              <Path
                key={i}
                d={s.d}
                fill="none"
                stroke={s.colour}
                strokeOpacity={s.opacity}
                strokeWidth={s.strokeWidth}
                strokeLinecap="round"
              />
            ),
          )}
        </G>
      ) : null}
      <ArtPaths paths={art} />
      {grain.length > 0 ? (
        <G>
          {grain.map((d, i) => (
            <Circle key={i} cx={d.cx} cy={d.cy} r={d.r} fill={d.colour} fillOpacity={d.opacity} />
          ))}
        </G>
      ) : null}
    </Svg>
  );
});

export const WallpaperView = forwardRef<View, WallpaperViewProps>(function WallpaperView(
  { params, width, height, maxGrain, showArt, accessibilityLabel, style },
  ref,
) {
  const rawId = useId();
  const id = `wp${safeId(rawId)}`;
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  return (
    <View
      ref={ref}
      collapsable={false}
      accessible={accessibilityLabel !== undefined}
      accessibilityRole={accessibilityLabel !== undefined ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
      style={[{ width: w, height: h, overflow: 'hidden' }, style]}
    >
      <WallpaperSvg
        params={params}
        width={w}
        height={h}
        maxGrain={maxGrain ?? Number.MAX_SAFE_INTEGER}
        showArt={showArt ?? true}
        id={id}
      />
    </View>
  );
});

/**
 * Full-resolution WallpaperView parked off screen for capture (see useWallpaperSaver in
 * ./saveWallpaper). Render it while `saver.job` is set: `<OffscreenWallpaper ref={saver.ref} job={saver.job} />`.
 */
export const OffscreenWallpaper = forwardRef<
  View,
  { job: { params: WallpaperParams; layout: { width: number; height: number } } | null }
>(function OffscreenWallpaper({ job }, ref) {
  if (!job) return null;
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ position: 'absolute', left: -10000, top: 0, width: job.layout.width, height: job.layout.height }}
    >
      <WallpaperView ref={ref} params={job.params} width={job.layout.width} height={job.layout.height} />
    </View>
  );
});
