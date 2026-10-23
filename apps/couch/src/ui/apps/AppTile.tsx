import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, PixelRatio, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Polygon, Rect, Stop } from 'react-native-svg';
import { ICON_FRAME_ASPECT, fallbackTile, iconFit, stableHash, tileLabel, tileLabelScale } from '../../core/apps';
import { DEMO_ART_H, DEMO_ART_W, type DemoArt } from '../../core/demo';
import type { TvApp } from '../../core/types';
import { useT } from '../../i18n/react';
import { duration, easeOut } from '../../theme/motion';
import { boxShadow, continuous, radii, textStyle } from '../../theme/design';
import { fonts } from '../../theme/tokens';
import { useReducedMotion } from '../../theme/useReducedMotion';
import { SkeletonBlock } from '../motion/Skeleton';
import { PressableScale } from '../motion/PressableScale';
import { haptic } from '../remote/haptics';
import { Text } from '../Text';
import { useDesign } from '../v2/useDesign';
import { tileView } from './tileModel';

export interface AppTileProps {
  app: TvApp;
  /**
   * Icon exactly as the TV supplied it (LAN http URL or data: URI). undefined = still resolving
   * (shimmer), null = none (house tile).
   */
  iconUri?: string | null;
  /** Original abstract art for a demo app (demo mode only). */
  demoArt?: DemoArt | null;
  onLaunch: (app: TvApp) => void;
  onTogglePin: (app: TvApp) => void;
  /** The TV icon would not load; the caller remembers it so the tile stays on the house style. */
  onIconError?: (app: TvApp, uri: string) => void;
  /**
   * T73: long-press enters the favourites edit mode instead of pinning. While `editing`, a tap
   * adds or removes the favourite (onTogglePin) rather than opening the app.
   */
  onEnterEdit?: () => void;
  editing?: boolean;
  /** Show the small "Pinned" caption (off when the grid already has a Favourites section). */
  badge?: boolean;
  /** Overrides the default label / hint (the Apps tab passes favourite-aware copy). */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** Screen-reader custom actions (add / remove / move); names are handled by onAccessibilityAction. */
  accessibilityActions?: ReadonlyArray<{ name: string; label: string }>;
  onAccessibilityAction?: (name: string) => void;
}

/** Design v2 (T68 step 7): a v2 card with continuous corners, sized for a 3-column grid. */
const RADIUS = radii.md;
const px = (v: number) => PixelRatio.roundToNearestPixel(v);
/** Rounds up to a device pixel: a full-bleed image never leaves a hairline gap at the frame edge. */
const pxUp = (v: number) => {
  const r = PixelRatio.get() || 1;
  return Math.ceil(v * r - 1e-6) / r;
};
/** Width used before the first layout pass (a 3-column phone grid cell is about this wide). */
const GUESS_W = 104;

/**
 * One app tile. The artwork fills the top of the card edge to edge in a 4:3 frame (the Roku HD
 * icon shape), with the app name underneath.
 *
 * TV icons are shown exactly as the TV supplies them, never redrawn or recoloured:
 * - aspect within ~15% of 4:3 -> full-bleed cover (tiny centre crop);
 * - anything else (square webOS/Samsung icons, banners) -> the whole icon, contained in a small
 *   inset on a neutral backdrop, capped at 1.5x its pixel size so it stays crisp at @3x
 *   (core iconFit). A shimmer plays while it resolves/loads (static with Reduce Motion), then the
 *   image fades in (instant with Reduce Motion). On error or with no icon: the house tile.
 *
 * House tile: the app's name (or initials when long) set in Couch's display face on a gradient
 * picked from the app id. No symbol or emoji glyphs anywhere.
 * Tap opens (light haptic + press-scale), long-press pins or unpins (selection haptic), or with
 * onEnterEdit enters the favourites edit mode, where a tap adds / removes the favourite (T73).
 */
export function AppTile({
  app,
  iconUri,
  demoArt,
  onLaunch,
  onTogglePin,
  onIconError,
  onEnterEdit,
  editing = false,
  badge = true,
  accessibilityLabel,
  accessibilityHint,
  accessibilityActions,
  onAccessibilityAction,
}: AppTileProps) {
  const p = useDesign();
  const tr = useT();
  const reduce = useReducedMotion();
  const pinned = app.pinned === true;
  const [frameW, setFrameW] = useState<number>(GUESS_W);
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const [loadedUri, setLoadedUri] = useState<string | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const frameH = frameW / ICON_FRAME_ASPECT;

  const view = tileView({
    demo: !!demoArt,
    iconUri: iconUri === '' ? null : iconUri,
    failed: typeof iconUri === 'string' && iconUri === failedUri,
    loaded: typeof iconUri === 'string' && iconUri === loadedUri,
  });
  const uri = view.image && typeof iconUri === 'string' ? iconUri : null;

  const imgOpacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    imgOpacity.setValue(0);
    setNatural(null);
  }, [uri, imgOpacity]);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w > 0 && w !== frameW) setFrameW(w);
  };

  const fit = iconFit(natural?.w ?? 0, natural?.h ?? 0, frameW, frameH, PixelRatio.get());

  return (
    <PressableScale
      onPress={() => (editing ? onTogglePin(app) : onLaunch(app))}
      onLongPress={() => {
        haptic('selection');
        if (onEnterEdit) onEnterEdit();
        else onTogglePin(app);
      }}
      delayLongPress={450}
      haptic="light"
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (pinned ? tr('ui.apps.pinnedLabel', { name: app.name }) : app.name)}
      accessibilityHint={accessibilityHint ?? tr(pinned ? 'ui.apps.hintUnpin' : 'ui.apps.hintPin')}
      accessibilityActions={accessibilityActions ? accessibilityActions.map((a) => ({ ...a })) : undefined}
      onAccessibilityAction={onAccessibilityAction ? (e) => onAccessibilityAction(e.nativeEvent.actionName) : undefined}
      style={({ pressed }) => [
        styles.app,
        continuous,
        {
          backgroundColor: pressed ? p.surfacePressed : p.card,
          boxShadow: boxShadow('low', p.scheme),
          borderColor: p.cardEdge,
          borderWidth: p.cardEdge === 'transparent' ? 0 : StyleSheet.hairlineWidth,
        },
      ]}
    >
      {/* Inner clip so the card keeps its iOS shadow. */}
      <View style={[styles.clip, continuous]}>
        <View
          style={[styles.art, { backgroundColor: p.fill }]}
          onLayout={onLayout}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        >
          {view.base === 'demo' && demoArt ? (
            <DemoArtView art={demoArt} id={app.id} name={app.name} width={frameW} />
          ) : null}
          {view.base === 'house' ? <HouseTile app={app} width={frameW} height={frameH} /> : null}
          {uri !== null ? (
            <View style={styles.center} pointerEvents="none">
              <Animated.Image
                source={{ uri }}
                style={[
                  // Snap to device pixels so the TV's bitmap is not resampled onto a half pixel.
                  fit.mode === 'cover'
                    ? { width: frameW, height: pxUp(frameH) }
                    : { width: px(fit.width), height: px(fit.height), borderRadius: 8 },
                  { opacity: imgOpacity },
                ]}
                resizeMode={fit.mode}
                fadeDuration={0}
                onLoad={(e) => {
                  const src = (e?.nativeEvent as { source?: { width?: number; height?: number } } | undefined)?.source;
                  if (src && typeof src.width === 'number' && typeof src.height === 'number') {
                    setNatural({ w: src.width, h: src.height });
                  }
                  setLoadedUri(uri);
                  if (reduce) {
                    imgOpacity.setValue(1);
                    return;
                  }
                  Animated.timing(imgOpacity, {
                    toValue: 1,
                    duration: duration.slow,
                    easing: Easing.bezier(...easeOut),
                    useNativeDriver: true,
                  }).start();
                }}
                onError={() => {
                  setFailedUri(uri);
                  onIconError?.(app, uri);
                }}
              />
            </View>
          ) : null}
          {view.shimmer ? <SkeletonBlock style={styles.shimmer} /> : null}
        </View>
        <View style={styles.caption}>
          <Text style={[textStyle('caption1'), styles.name, { color: p.label }]} numberOfLines={1}>
            {app.name}
          </Text>
          {pinned && badge ? <Text style={[textStyle('caption2'), styles.pin, { color: p.tintLabel }]}>{tr('ui.apps.pinned')}</Text> : null}
        </View>
      </View>
    </PressableScale>
  );
}

/** House-style tile: the app's name in Couch type on a gradient chosen by the app id. */
function HouseTile({ app, width, height }: { app: TvApp; width: number; height: number }) {
  const tile = fallbackTile(app.id);
  const label = tileLabel(app.name);
  const size = Math.round(width * tileLabelScale(label.longest));
  // SVG gradient ids must be valid and distinct per tile (web shares one id namespace).
  const gid = `t${stableHash(app.id).toString(36)}`;
  return (
    <View style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} style={StyleSheet.absoluteFill}>
        <Defs>
          {/* prototype .app i: 150deg h1 -> h2 */}
          <LinearGradient id={`${gid}b`} x1="0.2" y1="0" x2="0.8" y2="1">
            <Stop offset="0" stopColor={tile.h1} stopOpacity={1} />
            <Stop offset="1" stopColor={tile.h2} stopOpacity={1} />
          </LinearGradient>
          <LinearGradient id={`${gid}s`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.2} />
            <Stop offset="0.6" stopColor="#FFFFFF" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill={`url(#${gid}b)`} />
        <Rect x={0} y={0} width={width} height={height} fill={`url(#${gid}s)`} />
      </Svg>
      <View style={styles.labelBox}>
        <Text
          style={[styles.label, { fontSize: size, lineHeight: Math.round(size * 1.12) }]}
          numberOfLines={label.lines}
          adjustsFontSizeToFit
          minimumFontScale={0.5}
        >
          {label.text}
        </Text>
      </View>
    </View>
  );
}

/** Original abstract demo art (gradient + simple shapes) with the invented name as a wordmark. */
function DemoArtView({ art, id, name, width }: { art: DemoArt; id: string; name: string; width: number }) {
  const gid = `d${stableHash(id).toString(36)}`;
  const size = Math.round(width * 0.13);
  return (
    <View style={StyleSheet.absoluteFill}>
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${DEMO_ART_W} ${DEMO_ART_H}`}
        preserveAspectRatio="xMidYMid slice"
        style={StyleSheet.absoluteFill}
      >
        <Defs>
          <LinearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={art.from} stopOpacity={1} />
            <Stop offset="1" stopColor={art.to} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={DEMO_ART_W} height={DEMO_ART_H} fill={`url(#${gid})`} />
        {art.shapes.map((s, i) => {
          const o = s.opacity ?? 1;
          switch (s.kind) {
            case 'circle':
              return <Circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill={s.fill} fillOpacity={o} />;
            case 'ring':
              return (
                <Circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill="none" stroke={s.stroke} strokeWidth={s.width} strokeOpacity={o} />
              );
            case 'rect':
              return (
                <Rect
                  key={i}
                  x={s.x}
                  y={s.y}
                  width={s.w}
                  height={s.h}
                  rx={s.r}
                  ry={s.r}
                  fill={s.fill}
                  fillOpacity={o}
                  transform={s.rotate ? `rotate(${s.rotate} ${s.x + s.w / 2} ${s.y + s.h / 2})` : undefined}
                />
              );
            case 'poly':
              return <Polygon key={i} points={s.points.map((p) => p.join(',')).join(' ')} fill={s.fill} fillOpacity={o} />;
          }
        })}
      </Svg>
      <Text style={[styles.wordmark, { fontSize: size, lineHeight: Math.round(size * 1.2) }]} numberOfLines={1}>
        {name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  app: { borderRadius: RADIUS },
  clip: { borderRadius: RADIUS, overflow: 'hidden' },
  art: { width: '100%', aspectRatio: ICON_FRAME_ASPECT, overflow: 'hidden' },
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  shimmer: { ...StyleSheet.absoluteFillObject, borderRadius: 0 },
  labelBox: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  label: {
    color: '#FFFFFF',
    fontFamily: fonts.displayBold,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.18)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  wordmark: {
    position: 'absolute',
    start: 8,
    end: 8,
    bottom: 6,
    color: '#FFFFFF',
    fontFamily: fonts.displayBold,
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  caption: { paddingTop: 8, paddingBottom: 10, paddingHorizontal: 8, alignItems: 'center', gap: 2 },
  name: { fontWeight: '600', maxWidth: '100%' },
  pin: { fontWeight: '700', textAlign: 'center' },
});
