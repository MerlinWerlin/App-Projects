// HomeWallpaperView (T62): the softened Home Screen half of a Lock + Home pair. Draws a
// source image (the captured Lock PNG for export, or the user's photo for the preview)
// with React Native Image `blurRadius`, then a neutral wash and a dim layer from
// src/core/wallpaperPair.ts homeVersionFor. No SVG filters (feGaussianBlur is not
// reliable in react-native-svg) and no new native deps. forwardRef to the wrapping
// View (collapsable={false}) so view-shot can capture it at device resolution.

import { forwardRef, type ReactNode } from 'react';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { PhotoTransform } from '../core/photoCrop';
import { homeImageLayout, blurForFrame, type HomeVersion } from '../core/wallpaperPair';

export type HomeWallpaperData = {
  /** Source image: the saved Lock PNG (file://) or the user's photo copy. */
  uri: string;
  imageW: number;
  imageH: number;
  /** Crop of the source (the photo's Lock crop in a preview); omitted = centred cover. */
  transform?: PhotoTransform;
  home: HomeVersion;
  /** Fill behind the image while it loads. */
  background: string;
};

/** Wash + dim layers alone (used over a designed-wallpaper preview, which cannot be blurred live). */
export function HomeTint({ home }: { home: HomeVersion }) {
  return (
    <>
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: home.wash.colour, opacity: home.wash.opacity }]}
      />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#000000', opacity: home.dim }]} />
    </>
  );
}

export type HomeWallpaperViewProps = {
  data: HomeWallpaperData;
  /** Size in points. */
  width: number;
  height: number;
  /** Optional layer drawn between the blurred image and the wash (e.g. the theme overlay in a preview). */
  children?: ReactNode;
  onLoad?: () => void;
  onError?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export const HomeWallpaperView = forwardRef<View, HomeWallpaperViewProps>(function HomeWallpaperView(
  { data, width, height, children, onLoad, onError, accessibilityLabel, style },
  ref,
) {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const frame = { width: w, height: h };
  const l = homeImageLayout({ width: data.imageW, height: data.imageH }, frame, data.home.overscan, data.transform);
  const blur = blurForFrame(data.home, frame);
  return (
    <View
      ref={ref}
      collapsable={false}
      accessible={accessibilityLabel !== undefined}
      accessibilityRole={accessibilityLabel !== undefined ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
      style={[{ width: w, height: h, overflow: 'hidden', backgroundColor: data.background }, style]}
    >
      <Image
        source={{ uri: data.uri }}
        onLoad={onLoad}
        onError={onError}
        blurRadius={blur}
        resizeMode="stretch"
        fadeDuration={0}
        style={{ position: 'absolute', left: l.x, top: l.y, width: l.width, height: l.height }}
      />
      {children}
      <HomeTint home={data.home} />
    </View>
  );
});

/**
 * Full-resolution HomeWallpaperView parked off screen for capture with
 * useOffscreenCapture({ waitForReady: true }) from ./saveWallpaper.
 */
export const OffscreenHomeWallpaper = forwardRef<
  View,
  { job: { data: HomeWallpaperData; layout: { width: number; height: number } } | null; onReady: (ok: boolean) => void }
>(function OffscreenHomeWallpaper({ job, onReady }, ref) {
  if (!job) return null;
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ position: 'absolute', left: -10000, top: 0, width: job.layout.width, height: job.layout.height }}
    >
      <HomeWallpaperView
        ref={ref}
        data={job.data}
        width={job.layout.width}
        height={job.layout.height}
        onLoad={() => onReady(true)}
        onError={() => onReady(false)}
      />
    </View>
  );
});
