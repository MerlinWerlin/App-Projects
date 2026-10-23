// CollageView (T76): 2..6 of the person's own photos laid out with the tested maths in
// src/core/collage.ts over a vertical gradient from the chosen theme (it fills the gutters and
// the photo-free clock band). The same view draws the on-screen preview and, parked off screen
// at full size, the image saved to Photos, so both match exactly. Photos are read from their
// local file URIs only; nothing leaves the device.
//
// Later task: a saved collage as a Live Lock source (not wired here).
import { forwardRef, useMemo, useRef } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { collageRects, coverFit, scaleRects, spacingOptions, type CollageSize, type CollageSpacing } from '../core/collage';
import { continuous } from '../theme/tokensV2';
import { noMirror } from '../ui/i18nLayout';

export type CollagePhoto = { uri: string; width: number; height: number };

export type CollageData = {
  photos: readonly CollagePhoto[];
  layoutId: string;
  spacing: CollageSpacing;
  background: { from: string; to: string };
  /** The wallpaper's size in device pixels; the layout is computed at this size. */
  canvas: CollageSize;
};

type Props = {
  data: CollageData;
  /** Size in points (same aspect as data.canvas). */
  width: number;
  height: number;
  /** Called once per photo when it has loaded / failed. */
  onPhotoLoad?: () => void;
  onPhotoError?: () => void;
  /** Distinguishes the gradient id when several collages are mounted. */
  gradientId?: string;
};

export const CollageView = forwardRef<View, Props>(function CollageView(
  { data, width, height, onPhotoLoad, onPhotoError, gradientId = 'collageBg' },
  ref,
) {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const tiles = useMemo(() => {
    const opts = spacingOptions(data.spacing, data.canvas);
    const res = collageRects(data.photos.length, data.layoutId, data.canvas, opts);
    return scaleRects(res.rects, data.canvas.width, w);
  }, [data.photos.length, data.layoutId, data.spacing, data.canvas, w]);

  return (
    <View ref={ref} collapsable={false} style={[noMirror, { width: w, height: h, overflow: 'hidden', backgroundColor: data.background.from }]}>
      <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={data.background.from} />
            <Stop offset="1" stopColor={data.background.to} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={w} height={h} fill={`url(#${gradientId})`} />
      </Svg>
      {tiles.map((r, i) => {
        const photo = data.photos[i];
        if (!photo) return null;
        const fit = coverFit({ width: photo.width, height: photo.height }, { w: r.w, h: r.h });
        return (
          <View
            key={`${i}-${photo.uri}`}
            style={[
              continuous,
              // rtl-ok: collage tiles are artwork and never mirror
              { position: 'absolute', left: r.x, top: r.y, width: r.w, height: r.h, borderRadius: r.r, overflow: 'hidden' },
            ]}
          >
            <Image
              source={{ uri: photo.uri }}
              onLoad={onPhotoLoad}
              onError={onPhotoError}
              resizeMode="stretch"
              fadeDuration={0}
              // rtl-ok
              style={{ position: 'absolute', left: fit.draw.x, top: fit.draw.y, width: fit.draw.width, height: fit.draw.height }}
            />
          </View>
        );
      })}
    </View>
  );
});

/**
 * Full-resolution CollageView parked off screen for capture with
 * useOffscreenCapture({ waitForReady: true }) from ./saveWallpaper. Reports ready once every
 * photo has loaded, or not-ready as soon as one fails.
 */
export const OffscreenCollage = forwardRef<
  View,
  { job: { data: CollageData; layout: { width: number; height: number }; key: number } | null; onReady: (ok: boolean) => void }
>(function OffscreenCollage({ job, onReady }, ref) {
  const loaded = useRef(0);
  const settled = useRef(false);
  const lastKey = useRef(-1);
  const key = job ? job.key : -1;
  if (lastKey.current !== key) {
    // A new save job: count this job's photo loads from zero (before any of them can fire).
    lastKey.current = key;
    loaded.current = 0;
    settled.current = false;
  }
  if (!job) return null;
  const total = job.data.photos.length;
  const onLoad = () => {
    if (settled.current) return;
    loaded.current += 1;
    if (loaded.current >= total) {
      settled.current = true;
      onReady(true);
    }
  };
  const onError = () => {
    if (settled.current) return;
    settled.current = true;
    onReady(false);
  };
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      // rtl-ok: parked off screen
      style={{ position: 'absolute', left: -10000, top: 0, width: job.layout.width, height: job.layout.height }}
    >
      <CollageView
        key={job.key}
        ref={ref}
        data={job.data}
        width={job.layout.width}
        height={job.layout.height}
        onPhotoLoad={onLoad}
        onPhotoError={onError}
        gradientId={`collageBgFull${job.key}`}
      />
    </View>
  );
});
