// T83 trip covers: original illustrated scenes (src/core/coverArt.ts) drawn with react-native-svg, coloured from the
// scene palettes in src/theme/tokens.ts (day in light mode, dusk / night in dark mode). Exports:
//   CoverArt      the scene filling its parent (decorative, memoised per scene + theme)
//   TripCover     the scene in an aspect-ratio box, announced as one image with a label; fades in (timed)
//   TripCoverHero the trip screen's cover: title + dates over a token scrim
//   CoverPicker   trip edit's grid of small previews + "Automatic"
// T152: a cover can also be the traveller's own photo (src/state/coverPhotos.ts) or bundled illustrated art
// (src/content/coverArt.ts); src/core/covers2.ts resolveCover decides photo > art > SVG. A photo whose file has gone
// is remembered for this session and the cover falls back silently. The photo fades in over the illustration (timed,
// static with Reduce Motion). The SVG scenes gained a three-step sky, a layered sun / moon glow, a crescent moon, haze
// bands, a fine grain texture and a gentle bottom scrim.
import { memo, useCallback, useEffect, useId, useMemo, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { Animated, Image, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Mask, Path, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';
import { COVER_ART_IMAGES } from '../content/coverArt.ts';
import { COVER_ART, COVER_H, COVER_W, sceneShapes, type CoverShape } from '../core/coverArt.ts';
import { COVER_SCENES, isCoverId, type CoverId } from '../core/covers.ts';
import { resolveCover, type ResolvedCover } from '../core/covers2.ts';
import { useApp } from '../state/app.tsx';
import { duration, fadeIn } from '../theme/motion.ts';
import { coverFx, coverPalettes, coverScrim, radius, shadowOf, space, typeScale, type CoverPalette } from '../theme/tokens.ts';
import { PressableScale } from './kit.tsx';

const FILL = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;

// ---- T152: photos whose file is gone (this session), so every cover showing one falls back at once ----
const missing = new Set<string>();
const missingListeners = new Set<() => void>();
function markMissing(uri: string) {
  if (missing.has(uri)) return;
  missing.add(uri);
  missingListeners.forEach((l) => l());
}
const subscribeMissing = (cb: () => void) => {
  missingListeners.add(cb);
  return () => {
    missingListeners.delete(cb);
  };
};

/** What a cover draws for this scene and photo in the current theme (photo > bundled art > SVG). */
export function useResolvedCover(scene: CoverId, photo?: string | null): ResolvedCover<number> {
  const { theme } = useApp();
  const gone = useSyncExternalStore(subscribeMissing, () => (photo ? missing.has(photo) : false));
  return useMemo(() => resolveCover({ scene, dark: theme.dark, photo, photoMissing: gone, manifest: COVER_ART_IMAGES }), [scene, theme.dark, photo, gone]);
}

/** Two hex colours mixed (t 0 = a, 1 = b), for in-between sky stops drawn from the scene's own tokens. */
function mix(a: string, b: string, t: number): string {
  const n = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  const c = [0, 1, 2].map((i) => Math.round(n(a, i) + (n(b, i) - n(a, i)) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function shapeEl(s: CoverShape, p: CoverPalette, key: number, hazeId: string) {
  const paint = {
    fill: s.fill ? p[s.fill] : 'none',
    stroke: s.stroke ? p[s.stroke] : undefined,
    strokeWidth: s.stroke ? (s.sw ?? 1) : undefined,
    strokeLinecap: s.stroke ? ('round' as const) : undefined,
    strokeLinejoin: s.stroke ? ('round' as const) : undefined,
    opacity: s.o,
  };
  if (s.k === 'circle') return <Circle key={key} cx={s.cx} cy={s.cy} r={s.r} {...paint} />;
  if (s.k === 'rect') return <Rect key={key} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.rx} {...paint} />;
  if (s.k === 'haze') return <Rect key={key} x={0} y={s.y} width={COVER_W} height={s.h} fill={`url(#${hazeId})`} opacity={s.o} />;
  return <Path key={key} d={s.d} {...paint} />;
}

/** The scene filling its parent (absolute). Decorative: the box around it names it. */
export const CoverArt = memo(function CoverArt({ scene, dark }: { scene: CoverId; dark: boolean }) {
  const uid = useId().replace(/[^A-Za-z0-9]/g, '');
  const p = (dark ? coverPalettes.dark : coverPalettes.light)[scene];
  const sun = COVER_ART[scene].sun;
  const shapes = useMemo(() => sceneShapes(scene, dark).map((s, i) => shapeEl(s, p, i, `haze${uid}`)), [scene, dark, p, uid]);
  const scrim = dark ? coverScrim.dark : coverScrim.light;
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${COVER_W} ${COVER_H}`}
      preserveAspectRatio="xMidYMax slice"
      style={FILL}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Defs>
        {/* three-step sky: deep at the top, the scene's horizon colour low down, warmed by the light near the horizon */}
        <LinearGradient id={`sky${uid}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={p.sky0} />
          <Stop offset="0.45" stopColor={mix(p.sky0, p.sky1, 0.55)} />
          <Stop offset="0.75" stopColor={p.sky1} />
          <Stop offset="1" stopColor={mix(p.sky1, p.glow, 0.25)} />
        </LinearGradient>
        <LinearGradient id={`haze${uid}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={p.sky1} stopOpacity={0} />
          <Stop offset="1" stopColor={p.sky1} stopOpacity={0.85} />
        </LinearGradient>
        <RadialGradient id={`aura${uid}`} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={p.glow} stopOpacity={dark ? 0.28 : 0.4} />
          <Stop offset="0.6" stopColor={p.glow} stopOpacity={dark ? 0.08 : 0.14} />
          <Stop offset="1" stopColor={p.glow} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id={`halo${uid}`} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={p.glow} stopOpacity={0.7} />
          <Stop offset="1" stopColor={p.glow} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id={`disc${uid}`} cx="40%" cy="38%" r="65%">
          <Stop offset="0" stopColor={mix(p.glow, coverFx.discCore, 0.55)} />
          <Stop offset="1" stopColor={p.glow} />
        </RadialGradient>
        {/* night: a crescent cut from the full moon */}
        <Mask id={`moon${uid}`}>
          <Rect x={0} y={0} width={COVER_W} height={COVER_H} fill={coverFx.maskShow} />
          <Circle cx={sun.cx + sun.r * 0.55} cy={sun.cy - sun.r * 0.3} r={sun.r * 0.9} fill={coverFx.maskHide} />
        </Mask>
        {/* fine grain so flat fills read as paper, not plastic */}
        <Pattern id={`grain${uid}`} x={0} y={0} width={7} height={7} patternUnits="userSpaceOnUse">
          <Circle cx={1.5} cy={1.5} r={0.55} fill={p.detail} />
          <Circle cx={5} cy={4.5} r={0.45} fill={p.near} />
        </Pattern>
        <LinearGradient id={`foot${uid}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={scrim.from} stopOpacity={0} />
          <Stop offset="0.6" stopColor={scrim.from} stopOpacity={0} />
          <Stop offset="1" stopColor={scrim.to} stopOpacity={dark ? 0.5 : 0.38} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={COVER_W} height={COVER_H} fill={`url(#sky${uid})`} />
      <Circle cx={sun.cx} cy={sun.cy} r={sun.r * 6} fill={`url(#aura${uid})`} />
      <Circle cx={sun.cx} cy={sun.cy} r={sun.r * 2.4} fill={`url(#halo${uid})`} />
      {dark ? (
        <G mask={`url(#moon${uid})`}>
          <Circle cx={sun.cx} cy={sun.cy} r={sun.r} fill={`url(#disc${uid})`} />
        </G>
      ) : (
        <Circle cx={sun.cx} cy={sun.cy} r={sun.r} fill={`url(#disc${uid})`} />
      )}
      {shapes}
      <Rect x={0} y={COVER_H * 0.45} width={COVER_W} height={COVER_H * 0.55} fill={`url(#grain${uid})`} opacity={dark ? 0.14 : 0.1} />
      <Rect x={0} y={0} width={COVER_W} height={COVER_H} fill={`url(#foot${uid})`} />
    </Svg>
  );
});

/** Bottom-up scrim from tokens, for text laid over a cover. */
const CoverScrim = memo(function CoverScrim({ dark }: { dark: boolean }) {
  const uid = useId().replace(/[^A-Za-z0-9]/g, '');
  const s = dark ? coverScrim.dark : coverScrim.light;
  return (
    <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={FILL} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Defs>
        <LinearGradient id={`scrim${uid}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={s.from} />
          <Stop offset="0.45" stopColor={s.mid} />
          <Stop offset="1" stopColor={s.to} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={100} height={100} fill={`url(#scrim${uid})`} />
    </Svg>
  );
});

/** T152: the traveller's photo over the illustration, fading in once it has loaded (timed; static with Reduce Motion). */
function CoverPhotoLayer({ uri }: { uri: string }) {
  const { reduceMotion } = useApp();
  const opacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const onLoad = useCallback(() => {
    fadeIn(opacity, reduceMotion, duration.slow).start();
  }, [opacity, reduceMotion]);
  const onError = useCallback(() => markMissing(uri), [uri]);
  return (
    <Animated.View style={[FILL, { opacity }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Image source={{ uri }} resizeMode="cover" onLoad={onLoad} onError={onError} style={FILL} />
    </Animated.View>
  );
}

/** The spoken name of a cover ("Trip cover: your photo" / "Trip cover: Mountains illustration"). */
export function useCoverLabel(scene: CoverId, photo?: string | null): string {
  const { t } = useApp();
  const r = useResolvedCover(scene, photo);
  return r.kind === 'photo' ? t('cover2.a11y.photo') : t('covers.a11y', { scene: t(`covers.scene.${scene}`) });
}

/**
 * A cover in a box of the given aspect ratio (width / height), announced as one image ("Trip cover: Mountains
 * illustration"). Fades in once, timed; with Reduce Motion it is simply there. `children` sit on top.
 * T152: `photo` (the trip's own cover photo, src/state/coverPhotos.ts) wins over the scene; bundled art for the
 * scene wins over the SVG drawing; a photo that fails to load falls back silently.
 */
export const TripCover = memo(function TripCover({
  scene,
  photo,
  aspectRatio = 2,
  rounded = radius.l,
  label,
  children,
  style,
}: {
  scene: CoverId;
  photo?: string | null;
  aspectRatio?: number;
  rounded?: number;
  /** Spoken label; defaults to the cover's name. null: the box is not an element of its own (a parent control names it, or children carry the text). */
  label?: string | null;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme, reduceMotion } = useApp();
  const opacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  useEffect(() => {
    const a = fadeIn(opacity, reduceMotion, duration.slow);
    a.start();
    return () => a.stop();
  }, [opacity, reduceMotion]);
  const r = useResolvedCover(scene, photo);
  const fallbackLabel = useCoverLabel(scene, photo);
  const spoken = label === undefined ? fallbackLabel : label;
  return (
    <View
      accessible={spoken !== null}
      accessibilityRole={spoken !== null ? 'image' : undefined}
      accessibilityLabel={spoken ?? undefined}
      style={[{ aspectRatio, borderRadius: rounded, overflow: 'hidden', backgroundColor: coverPalettes[theme.dark ? 'dark' : 'light'][scene].sky1 }, style]}
    >
      <Animated.View style={[FILL, { opacity }]}>
        {r.kind === 'art' ? (
          <Image source={r.source} resizeMode="cover" style={FILL} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
        ) : (
          <CoverArt scene={scene} dark={theme.dark} />
        )}
      </Animated.View>
      {r.kind === 'photo' ? <CoverPhotoLayer key={r.uri} uri={r.uri} /> : null}
      {children}
    </View>
  );
});

/**
 * The trip screen's cover: the scene (or T152 the trip's own photo) with the trip name (header) and dates over a
 * scrim. Title and dates stay readable text for screen readers; the picture itself is labelled once.
 */
export function TripCoverHero({ scene, photo, title, subtitle, children }: { scene: CoverId; photo?: string | null; title: string; subtitle?: string; children?: ReactNode }) {
  const { theme } = useApp();
  const label = useCoverLabel(scene, photo);
  return (
    <View style={[{ borderRadius: radius.xl }, shadowOf(theme, 'mid')]}>
      <TripCover scene={scene} photo={photo} aspectRatio={16 / 9} rounded={radius.xl} label={null}>
        <View accessible accessibilityRole="image" accessibilityLabel={label} style={FILL} />
        <View pointerEvents="none" style={[FILL, { top: '30%' }]}>
          <CoverScrim dark={theme.dark} />
        </View>
        <View pointerEvents="box-none" style={{ flex: 1, justifyContent: 'flex-end', padding: space.l, gap: space.xs }}>
          <Text accessibilityRole="header" numberOfLines={2} style={[typeScale.displayM, { color: theme.heroInk }]}>
            {title}
          </Text>
          {subtitle ? <Text style={[typeScale.bodyStrong, { color: theme.heroMuted, fontVariant: ['tabular-nums'] }]}>{subtitle}</Text> : null}
          {children}
        </View>
      </TripCover>
    </View>
  );
}

/** Grid of small previews: "Automatic" (shows the scene it would pick) then every scene. Radio semantics. */
export function CoverPicker({ value, auto, onChange }: { value: string | undefined; auto: CoverId; onChange: (v: CoverId | null) => void }) {
  const { theme, t } = useApp();
  const chosen = isCoverId(value) ? value : null;
  const options: Array<{ key: string; scene: CoverId; label: string; a11y: string; selected: boolean; pick: CoverId | null }> = [
    {
      key: 'auto',
      scene: auto,
      label: t('covers.picker.auto'),
      a11y: t('covers.picker.autoA11y', { scene: t(`covers.scene.${auto}`) }),
      selected: chosen === null,
      pick: null,
    },
    ...COVER_SCENES.map((id) => ({
      key: id,
      scene: id,
      label: t(`covers.scene.${id}`),
      a11y: t('covers.picker.sceneA11y', { scene: t(`covers.scene.${id}`) }),
      selected: chosen === id,
      pick: id,
    })),
  ];
  return (
    <View style={{ gap: space.s }}>
      <Text accessibilityRole="header" style={[typeScale.bodyStrong, { color: theme.ink }]}>
        {t('covers.picker.title')}
      </Text>
      <Text style={[typeScale.small, { color: theme.muted }]}>{t('covers.picker.body')}</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel={t('covers.picker.group')} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
        {options.map((o) => (
          <PressableScale
            key={o.key}
            accessibilityRole="radio"
            accessibilityLabel={o.a11y}
            accessibilityHint={t('covers.picker.hint')}
            accessibilityState={{ selected: o.selected, checked: o.selected }}
            onPress={() => onChange(o.pick)}
            style={{
              width: '31%',
              flexGrow: 1,
              gap: space.xs,
              padding: 3,
              borderRadius: radius.m,
              borderWidth: 2,
              borderColor: o.selected ? theme.accent : 'transparent',
              backgroundColor: o.selected ? theme.accentSoft : theme.cardRaised,
            }}
          >
            <TripCover scene={o.scene} aspectRatio={1.5} rounded={radius.s} label={null} />
            <Text numberOfLines={1} style={[typeScale.small, { color: o.selected ? theme.accentInk : theme.ink, textAlign: 'center', paddingBottom: 2 }]}>
              {o.label}
            </Text>
          </PressableScale>
        ))}
      </View>
    </View>
  );
}
