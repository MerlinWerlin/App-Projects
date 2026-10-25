// Crop editor for a photo background (T25, polish T37 / docs/POLISH.md G4): drag to move,
// pinch to zoom (1x..5x of cover), framed to the device aspect, with the Lock Screen
// clock (or the theme's Home Screen icons) drawn live on top so faces stay clear.
//
// Gestures run on the UI thread: Pan + Pinch (Simultaneous) drive shared values in "view
// space" (src/core/photoCrop.ts CropView). While a finger is down the photo stretches past
// its edges / zoom limits with the rubber band; on release it springs back with the shared
// spring, or glides with momentum (withDecay, clamped to the edges). The settled view is
// converted to the saved PhotoTransform and committed once via runOnJS. Reduce Motion: no
// rubber band, no momentum, hard clamp and an instant settle. All maths is in
// src/core/photoCrop.ts (tested); the zoom / reset buttons live on the hosting screen and
// the adjustable accessibility actions below keep the crop usable without gestures.

import { Feather } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, type AccessibilityActionEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDecay,
  withTiming,
} from 'react-native-reanimated';
import type { IconSpec } from '../core/iconspec';
import {
  DEFAULT_TRANSFORM,
  clampTransform,
  cropBaseSize,
  cropBounds,
  cropInBounds,
  cropPinchStep,
  cropSettle,
  cropShown,
  cropViewFor,
  panBy,
  pinchBy,
  transformForView,
  type PhotoTransform,
  type Size,
} from '../core/photoCrop';
import { Overlay as ThemeOverlay, type PhotoWallpaperData } from '../render/PhotoWallpaperView';
import { useT } from '../i18n';
import { timing, useMotionReduced } from '../theme/motion';
import { radiusV2, spaceV2, textV2 } from '../theme/tokensV2';
import { HomeMock } from './HomeMock';
import { noMirror, textStyleFor } from './i18nLayout';
import { LockMock } from './LockMock';
import { PressableScale } from './PressableScale';

type Props = {
  photo: PhotoWallpaperData;
  width: number;
  height: number;
  /** Called with the settled transform (once per gesture / action). */
  onChange: (t: PhotoTransform) => void;
  /** Gesture finished (persist here). */
  onCommit?: (t: PhotoTransform) => void;
  /** True while a finger is down (disable the parent ScrollView). */
  onGestureActive?: (active: boolean) => void;
  onImageError?: () => void;
  /**
   * The theme's icons. When given, a small toggle switches the live overlay between the
   * Lock Screen clock and these icons on the Home Screen, so the crop is judged behind them.
   */
  iconSpecs?: IconSpec[];
};

/** Which screen is drawn over the photo while cropping. */
type PreviewMode = 'lock' | 'home';
const START_PREVIEW: PreviewMode = 'lock';

/** withDecay deceleration (reanimated's default feel). */
const DECELERATION = 0.998;
/** Below this many points of spare photo an axis cannot move (no decay). */
const MIN_TRAVEL = 0.5;

export function PhotoCropEditor({
  photo,
  width,
  height,
  onChange,
  onCommit,
  onGestureActive,
  onImageError,
  iconSpecs,
}: Props) {
  const reduced = useMotionReduced();
  const { t, script, formatNumber } = useT();
  const image: Size = useMemo(() => ({ width: photo.imageW, height: photo.imageH }), [photo.imageW, photo.imageH]);
  const frame: Size = useMemo(() => ({ width, height }), [width, height]);
  const base: Size = useMemo(() => cropBaseSize(image, frame), [image, frame]);
  const [preview, setPreview] = useState(START_PREVIEW);
  const showHome = preview === 'home' && !!iconSpecs?.length;

  const current = useRef<PhotoTransform>(photo.transform);
  current.current = photo.transform;
  const cb = useRef({ onChange, onCommit, onGestureActive, image, frame });
  cb.current = { onChange, onCommit, onGestureActive, image, frame };

  // Displayed view (animated) and the raw finger-driven view it is rubber-banded from.
  const start = cropViewFor(image, frame, photo.transform);
  const z = useSharedValue(start.zoom);
  const x = useSharedValue(start.x);
  const y = useSharedValue(start.y);
  const rz = useSharedValue(start.zoom);
  const rx = useSharedValue(start.x);
  const ry = useSharedValue(start.y);
  const vx = useSharedValue(0);
  const vy = useSharedValue(0);
  const focalX = useSharedValue(width / 2);
  const focalY = useSharedValue(height / 2);
  const lastPanX = useSharedValue(0);
  const lastPanY = useSharedValue(0);
  const lastScale = useSharedValue(1);
  const touches = useSharedValue(0);
  const pending = useSharedValue(0);

  // JS side: called once per settle with the final view.
  const commitView = useCallback((zoom: number, px: number, py: number) => {
    const { image: img, frame: fr } = cb.current;
    const t = transformForView(img, fr, { zoom, x: px, y: py });
    const was = clampTransform(current.current);
    const same =
      Math.abs(t.scale - was.scale) < 1e-4 && Math.abs(t.offsetX - was.offsetX) < 1e-4 && Math.abs(t.offsetY - was.offsetY) < 1e-4;
    if (same) return;
    current.current = t;
    cb.current.onChange(t);
    cb.current.onCommit?.(t);
  }, []);
  const notifyActive = useCallback((active: boolean) => cb.current.onGestureActive?.(active), []);

  // Follow transform changes from outside (zoom / reset buttons, a new photo, a new frame).
  const lastImage = useRef(image);
  useEffect(() => {
    if (touches.value !== 0) return; // a finger is down
    const v = cropViewFor(image, frame, photo.transform);
    const imageChanged = lastImage.current !== image;
    lastImage.current = image;
    const close = Math.abs(v.zoom - z.value) < 1e-3 && Math.abs(v.x - x.value) < 0.5 && Math.abs(v.y - y.value) < 0.5;
    if (close && !imageChanged) return;
    cancelAnimation(z);
    cancelAnimation(x);
    cancelAnimation(y);
    if (reduced || imageChanged) {
      z.value = v.zoom;
      x.value = v.x;
      y.value = v.y;
    } else {
      z.value = withTiming(v.zoom, timing.base);
      x.value = withTiming(v.x, timing.base);
      y.value = withTiming(v.y, timing.base);
    }
    // Shared values are stable refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo.transform, image, frame, reduced]);

  const gesture = useMemo(() => {
    const showRaw = () => {
      'worklet';
      const d = cropShown({ zoom: rz.value, x: rx.value, y: ry.value }, base, frame, reduced);
      z.value = d.zoom;
      x.value = d.x;
      y.value = d.y;
      if (reduced) {
        // Hard clamp: no hidden overshoot to drag back through.
        rz.value = d.zoom;
        rx.value = d.x;
        ry.value = d.y;
      }
    };
    const settled = (finished?: boolean) => {
      'worklet';
      if (!finished) return; // interrupted by a new touch; that gesture commits instead
      pending.value -= 1;
      if (pending.value === 0) runOnJS(commitView)(z.value, x.value, y.value);
    };
    const settle = () => {
      'worklet';
      const d = { zoom: z.value, x: x.value, y: y.value };
      const t = cropSettle(d, base, frame, { x: focalX.value, y: focalY.value });
      if (reduced) {
        z.value = t.zoom;
        x.value = t.x;
        y.value = t.y;
        runOnJS(commitView)(t.zoom, t.x, t.y);
        return;
      }
      const b = cropBounds(base, frame, t.zoom);
      const springBack = !cropInBounds(d, base, frame);
      pending.value = 3;
      if (Math.abs(t.zoom - d.zoom) > 1e-4) z.value = withTiming(t.zoom, timing.base, settled);
      else {
        z.value = t.zoom;
        settled(true);
      }
      if (springBack || b.maxX - b.minX < MIN_TRAVEL) {
        if (Math.abs(t.x - d.x) > 0.01) x.value = withTiming(t.x, timing.base, settled);
        else settled(true);
      } else {
        x.value = withDecay({ velocity: vx.value, deceleration: DECELERATION, clamp: [b.minX, b.maxX] }, settled);
      }
      if (springBack || b.maxY - b.minY < MIN_TRAVEL) {
        if (Math.abs(t.y - d.y) > 0.01) y.value = withTiming(t.y, timing.base, settled);
        else settled(true);
      } else {
        y.value = withDecay({ velocity: vy.value, deceleration: DECELERATION, clamp: [b.minY, b.maxY] }, settled);
      }
    };
    const touchDown = () => {
      'worklet';
      if (touches.value === 0) {
        cancelAnimation(z);
        cancelAnimation(x);
        cancelAnimation(y);
        pending.value = 0;
        rz.value = z.value;
        rx.value = x.value;
        ry.value = y.value;
        vx.value = 0;
        vy.value = 0;
        runOnJS(notifyActive)(true);
      }
      touches.value += 1;
    };
    const touchUp = () => {
      'worklet';
      touches.value = Math.max(0, touches.value - 1);
      if (touches.value === 0) {
        settle();
        runOnJS(notifyActive)(false);
      }
    };

    const pan = Gesture.Pan()
      .onBegin(() => touchDown())
      .onStart(() => {
        lastPanX.value = 0;
        lastPanY.value = 0;
      })
      .onUpdate((e) => {
        rx.value += e.translationX - lastPanX.value;
        ry.value += e.translationY - lastPanY.value;
        lastPanX.value = e.translationX;
        lastPanY.value = e.translationY;
        vx.value = e.velocityX;
        vy.value = e.velocityY;
        showRaw();
      })
      .onEnd((e) => {
        vx.value = e.velocityX;
        vy.value = e.velocityY;
      })
      .onFinalize(() => touchUp());
    const pinch = Gesture.Pinch()
      .onBegin(() => touchDown())
      .onStart(() => {
        lastScale.value = 1;
      })
      .onUpdate((e) => {
        if (!(e.scale > 0) || !(lastScale.value > 0)) return;
        const ratio = e.scale / lastScale.value;
        lastScale.value = e.scale;
        focalX.value = e.focalX;
        focalY.value = e.focalY;
        const next = cropPinchStep({ zoom: rz.value, x: rx.value, y: ry.value }, ratio, { x: e.focalX, y: e.focalY }, reduced);
        rz.value = next.zoom;
        rx.value = next.x;
        ry.value = next.y;
        showRaw();
      })
      .onFinalize(() => touchUp());
    return Gesture.Simultaneous(pan, pinch);
    // Shared values and the useCallback functions are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, frame, reduced]);

  // The image is laid out at the last committed zoom (sharp after each commit) and the
  // live difference is a UI-thread transform (translate + scale about its centre).
  const layoutZoom = clampTransform(photo.transform).scale;
  const drawnW = base.width * layoutZoom;
  const drawnH = base.height * layoutZoom;
  const imageStyle = useAnimatedStyle(() => {
    const s = z.value / layoutZoom;
    return {
      transform: [
        { translateX: x.value + (drawnW * (s - 1)) / 2 },
        { translateY: y.value + (drawnH * (s - 1)) / 2 },
        { scale: s },
      ],
    };
  }, [layoutZoom, drawnW, drawnH]);

  // Accessibility actions (no gestures needed): same steps as before, committed directly.
  const commit = (t: PhotoTransform) => {
    current.current = t;
    cb.current.onChange(t);
    cb.current.onCommit?.(t);
  };
  const onA11y = (e: AccessibilityActionEvent) => {
    const step = width * 0.1;
    const t = current.current;
    switch (e.nativeEvent.actionName) {
      case 'increment':
        return commit(pinchBy(t, 1.25, image, frame));
      case 'decrement':
        return commit(pinchBy(t, 0.8, image, frame));
      case 'moveLeft':
        return commit(panBy(t, step, 0, image, frame));
      case 'moveRight':
        return commit(panBy(t, -step, 0, image, frame));
      case 'moveUp':
        return commit(panBy(t, 0, step, image, frame));
      case 'moveDown':
        return commit(panBy(t, 0, -step, image, frame));
      case 'activate':
        return commit({ ...DEFAULT_TRANSFORM });
      default:
        return undefined;
    }
  };

  return (
    // The crop canvas never mirrors (photo, Lock/Home Screen mocks and crop maths stay LTR).
    <View style={[noMirror, { width, height }]}>
      <GestureDetector gesture={gesture}>
        <View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={t('wallpaper.crop.a11y')}
          accessibilityValue={{
            text: t('wallpaper.crop.value', {
              zoom: formatNumber(photo.transform.scale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
            }),
          }}
          accessibilityActions={[
            { name: 'increment', label: t('wallpaper.crop.zoomIn') },
            { name: 'decrement', label: t('wallpaper.crop.zoomOut') },
            { name: 'moveLeft', label: t('wallpaper.crop.moveLeft') },
            { name: 'moveRight', label: t('wallpaper.crop.moveRight') },
            { name: 'moveUp', label: t('wallpaper.crop.moveUp') },
            { name: 'moveDown', label: t('wallpaper.crop.moveDown') },
            { name: 'activate', label: t('wallpaper.crop.resetPosition') },
          ]}
          onAccessibilityAction={onA11y}
          style={[styles.frame, { width, height, backgroundColor: photo.palette.bg }]}
        >
          <Animated.Image
            source={{ uri: photo.uri }}
            onError={onImageError}
            resizeMode="stretch"
            fadeDuration={0}
            style={[{ position: 'absolute', left: 0, top: 0, width: drawnW, height: drawnH }, imageStyle]}
          />
          <ThemeOverlay overlay={photo.overlay} palette={photo.palette} width={width} height={height} maxGrain={400} />
          {showHome && iconSpecs ? (
            <View
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}
            >
              <HomeMock specs={iconSpecs} width={width} backgroundColour="transparent" maxIcons={16} />
            </View>
          ) : (
            <LockMock width={width} height={height} />
          )}
        </View>
      </GestureDetector>
      {iconSpecs && iconSpecs.length > 0 ? (
        <PressableScale
          haptic="select"
          onPress={() => setPreview((p) => (p === 'lock' ? 'home' : 'lock'))}
          accessibilityRole="button"
          accessibilityLabel={showHome ? t('wallpaper.crop.showLock') : t('wallpaper.crop.showHome')}
          hitSlop={12}
          style={styles.toggle}
        >
          <Feather name={showHome ? 'lock' : 'grid'} size={12} color="#FFFFFF" />
          <Text maxFontSizeMultiplier={1.4} style={[styles.toggleText, textStyleFor(script, textV2.caption2)]}>
            {showHome ? t('wallpaper.crop.lock') : t('wallpaper.crop.home')}
          </Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden' },
  toggle: {
    position: 'absolute',
    top: 8,
    right: 8, // rtl-ok: on the never-mirrored crop canvas
    minHeight: 28,
    paddingHorizontal: 10,
    borderRadius: radiusV2.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spaceV2.xs,
    backgroundColor: 'rgba(20,16,28,0.62)',
  },
  toggleText: { ...textV2.caption2, color: '#FFFFFF', fontWeight: '600' },
});
