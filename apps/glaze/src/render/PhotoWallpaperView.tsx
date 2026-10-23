// PhotoWallpaperView (T25): the user's own photo, cropped to the frame with the tested
// maths in src/core/photoCrop.ts, under an optional overlay in the theme's colours
// (src/core/background.ts overlayLayout). forwardRef to the wrapping View
// (collapsable={false}) so it can be captured with view-shot at device resolution.

import { forwardRef, memo, useMemo } from 'react';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, G, Rect } from 'react-native-svg';
import { overlayLayout, type OverlayPalette, type PhotoOverlay } from '../core/background';
import { photoLayout, type PhotoTransform } from '../core/photoCrop';

export type PhotoWallpaperData = {
  uri: string;
  imageW: number;
  imageH: number;
  transform: PhotoTransform;
  overlay: PhotoOverlay;
  palette: OverlayPalette;
};

export type PhotoWallpaperViewProps = {
  photo: PhotoWallpaperData;
  /** Size in points. */
  width: number;
  height: number;
  /** Draw at most this many grain dots (small previews can skip most of them). */
  maxGrain?: number;
  onLoad?: () => void;
  onError?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/** The theme overlay alone (tint, grain, border), for the live crop editor (T37). */
export const Overlay = memo(function Overlay({
  overlay,
  palette,
  width,
  height,
  maxGrain,
}: {
  overlay: PhotoOverlay;
  palette: OverlayPalette;
  width: number;
  height: number;
  maxGrain: number;
}) {
  const o = useMemo(() => overlayLayout(overlay, palette, width, height), [overlay, palette, width, height]);
  if (!o.tint && !o.border && o.grain.length === 0) return null;
  const grain = maxGrain < o.grain.length ? o.grain.slice(0, Math.max(0, maxGrain)) : o.grain;
  const b = o.border;
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={StyleSheet.absoluteFill} pointerEvents="none">
      {o.tint ? <Rect x={0} y={0} width={width} height={height} fill={o.tint.colour} fillOpacity={o.tint.opacity} /> : null}
      {grain.length > 0 ? (
        <G>
          {grain.map((d, i) => (
            <Circle key={i} cx={d.cx} cy={d.cy} r={d.r} fill={d.colour} fillOpacity={d.opacity} />
          ))}
        </G>
      ) : null}
      {b ? (
        <G>
          <Rect
            x={b.outer.inset}
            y={b.outer.inset}
            width={width - b.outer.inset * 2}
            height={height - b.outer.inset * 2}
            rx={b.outer.radius}
            ry={b.outer.radius}
            fill="none"
            stroke={b.outer.colour}
            strokeWidth={b.outer.strokeWidth}
          />
          <Rect
            x={b.inner.inset}
            y={b.inner.inset}
            width={width - b.inner.inset * 2}
            height={height - b.inner.inset * 2}
            rx={b.inner.radius}
            ry={b.inner.radius}
            fill="none"
            stroke={b.inner.colour}
            strokeWidth={b.inner.strokeWidth}
          />
          {b.dots.map((d, i) => (
            <Circle key={i} cx={d.cx} cy={d.cy} r={d.r} fill={d.colour} stroke={b.outer.colour} strokeWidth={b.outer.strokeWidth} />
          ))}
        </G>
      ) : null}
    </Svg>
  );
});

export const PhotoWallpaperView = forwardRef<View, PhotoWallpaperViewProps>(function PhotoWallpaperView(
  { photo, width, height, maxGrain, onLoad, onError, accessibilityLabel, style },
  ref,
) {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const l = photoLayout({ width: photo.imageW, height: photo.imageH }, { width: w, height: h }, photo.transform);
  return (
    <View
      ref={ref}
      collapsable={false}
      accessible={accessibilityLabel !== undefined}
      accessibilityRole={accessibilityLabel !== undefined ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
      style={[{ width: w, height: h, overflow: 'hidden', backgroundColor: photo.palette.bg }, style]}
    >
      <Image
        source={{ uri: photo.uri }}
        onLoad={onLoad}
        onError={onError}
        resizeMode="stretch"
        fadeDuration={0}
        style={{ position: 'absolute', left: l.x, top: l.y, width: l.width, height: l.height }}
      />
      <Overlay overlay={photo.overlay} palette={photo.palette} width={w} height={h} maxGrain={maxGrain ?? Number.MAX_SAFE_INTEGER} />
    </View>
  );
});

/**
 * Full-resolution PhotoWallpaperView parked off screen for capture with
 * useOffscreenCapture({ waitForReady: true }) from ./saveWallpaper:
 * `<OffscreenPhotoWallpaper ref={saver.ref} job={saver.job} onReady={saver.markReady} />`.
 */
export const OffscreenPhotoWallpaper = forwardRef<
  View,
  { job: { data: PhotoWallpaperData; layout: { width: number; height: number } } | null; onReady: (ok: boolean) => void }
>(function OffscreenPhotoWallpaper({ job, onReady }, ref) {
  if (!job) return null;
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ position: 'absolute', left: -10000, top: 0, width: job.layout.width, height: job.layout.height }}
    >
      <PhotoWallpaperView
        ref={ref}
        photo={job.data}
        width={job.layout.width}
        height={job.layout.height}
        onLoad={() => onReady(true)}
        onError={() => onReady(false)}
      />
    </View>
  );
});
