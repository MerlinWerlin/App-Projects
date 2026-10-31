// T83 trip covers: original illustrated scenes (src/core/coverArt.ts) drawn with react-native-svg, coloured from the
// scene palettes in src/theme/tokens.ts (day in light mode, dusk / night in dark mode). Exports:
//   CoverArt      the scene filling its parent (decorative, memoised per scene + theme)
//   TripCover     the scene in an aspect-ratio box, announced as one image with a label; fades in (timed)
//   TripCoverHero the trip screen's cover: title + dates over a token scrim
//   CoverPicker   trip edit's grid of small previews + "Automatic"
import { memo, useEffect, useId, useMemo, useRef, type ReactNode } from 'react';
import { Animated, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { COVER_ART, COVER_H, COVER_W, sceneShapes, type CoverShape } from '../core/coverArt.ts';
import { COVER_SCENES, isCoverId, type CoverId } from '../core/covers.ts';
import { useApp } from '../state/app.tsx';
import { duration, fadeIn } from '../theme/motion.ts';
import { coverPalettes, coverScrim, radius, shadowOf, space, typeScale, type CoverPalette } from '../theme/tokens.ts';
import { PressableScale } from './kit.tsx';

const FILL = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;

function shapeEl(s: CoverShape, p: CoverPalette, key: number) {
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
  return <Path key={key} d={s.d} {...paint} />;
}

/** The scene filling its parent (absolute). Decorative: the box around it names it. */
export const CoverArt = memo(function CoverArt({ scene, dark }: { scene: CoverId; dark: boolean }) {
  const uid = useId().replace(/[^A-Za-z0-9]/g, '');
  const p = (dark ? coverPalettes.dark : coverPalettes.light)[scene];
  const sun = COVER_ART[scene].sun;
  const shapes = useMemo(() => sceneShapes(scene, dark).map((s, i) => shapeEl(s, p, i)), [scene, dark, p]);
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
        <LinearGradient id={`sky${uid}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={p.sky0} />
          <Stop offset="1" stopColor={p.sky1} />
        </LinearGradient>
        <RadialGradient id={`halo${uid}`} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={p.glow} stopOpacity={0.55} />
          <Stop offset="1" stopColor={p.glow} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={COVER_W} height={COVER_H} fill={`url(#sky${uid})`} />
      <Circle cx={sun.cx} cy={sun.cy} r={sun.r * 2.6} fill={`url(#halo${uid})`} />
      <Circle cx={sun.cx} cy={sun.cy} r={sun.r} fill={p.glow} />
      {shapes}
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

/**
 * A cover in a box of the given aspect ratio (width / height), announced as one image ("Trip cover: Mountains
 * illustration"). Fades in once, timed; with Reduce Motion it is simply there. `children` sit on top.
 */
export const TripCover = memo(function TripCover({
  scene,
  aspectRatio = 2,
  rounded = radius.l,
  label,
  children,
  style,
}: {
  scene: CoverId;
  aspectRatio?: number;
  rounded?: number;
  /** Spoken label; defaults to the scene's name. null: the box is not an element of its own (a parent control names it, or children carry the text). */
  label?: string | null;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme, t, reduceMotion } = useApp();
  const opacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  useEffect(() => {
    const a = fadeIn(opacity, reduceMotion, duration.slow);
    a.start();
    return () => a.stop();
  }, [opacity, reduceMotion]);
  const spoken = label === undefined ? t('covers.a11y', { scene: t(`covers.scene.${scene}`) }) : label;
  return (
    <View
      accessible={spoken !== null}
      accessibilityRole={spoken !== null ? 'image' : undefined}
      accessibilityLabel={spoken ?? undefined}
      style={[{ aspectRatio, borderRadius: rounded, overflow: 'hidden', backgroundColor: coverPalettes[theme.dark ? 'dark' : 'light'][scene].sky1 }, style]}
    >
      <Animated.View style={[FILL, { opacity }]}>
        <CoverArt scene={scene} dark={theme.dark} />
      </Animated.View>
      {children}
    </View>
  );
});

/**
 * The trip screen's cover: the scene with the trip name (header) and dates over a scrim. Title and dates stay
 * readable text for screen readers; the picture itself is labelled once.
 */
export function TripCoverHero({ scene, title, subtitle, children }: { scene: CoverId; title: string; subtitle?: string; children?: ReactNode }) {
  const { theme, t } = useApp();
  return (
    <View style={[{ borderRadius: radius.xl }, shadowOf(theme, 'mid')]}>
      <TripCover scene={scene} aspectRatio={16 / 9} rounded={radius.xl} label={null}>
        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel={t('covers.a11y', { scene: t(`covers.scene.${scene}`) })}
          style={FILL}
        />
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
