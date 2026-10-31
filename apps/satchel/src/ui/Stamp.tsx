// T103 Passport stamps: one original stamp drawn with react-native-svg from src/core/stamps.ts geometry (round, oval,
// rectangle, triangle-ish pennant, hexagon), with a ring or lines of text (place, date, Arrived / Departed), its tilt
// and its ink from src/theme/tokens.ts stampInks (light + dark). No real country's stamp design, no emblems.
// Exports:
//   Stamp          the stamp (decorative SVG inside a labelled button when it opens a trip); timed fade-in only
//   PaperPage      a passport page: paper texture as a pure SVG pattern (grain dots + fibre hairlines), no images
//   usePassport    the stamp collection for the app's trips (Your travels' "Include demo trips" switch)
//   stampLabels    place name / date / mark text for a stamp in the app's language
import { memo, useEffect, useId, useMemo, useRef, type ReactNode } from 'react';
import { Animated, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, G, Path, Pattern, Rect, Text as SvgText } from 'react-native-svg';
import { deviceZone, todayIn } from '../core/format.ts';
import { recapToday } from '../core/followups91.ts';
import {
  arcGlyphs,
  fitText,
  inkSpecks,
  STAMP_BOX,
  STAMP_C,
  stampCollection,
  stampDate,
  stampGeometry,
  type PassportStamp,
  type StampCollection,
} from '../core/stamps.ts';
import type { T } from '../i18n/core.ts';
import { useApp } from '../state/app.tsx';
import { useTrips } from '../state/trips.tsx';
import { duration, fadeIn } from '../theme/motion.ts';
import { fonts, radius, space, stampInk, stampPaper, TOUCH, typeScale } from '../theme/tokens.ts';
import { PressableScale } from './kit.tsx';
import { countryName, displayCountryName, useTravelStats } from './useTravelStats.ts';

/** Room around the 120 box so a tilted stamp never clips. */
const PAD = 10;
const ARC_SIZE = 9;

export type StampText = { place: string; date: string; mark: string; a11y: string };

/** The words drawn on and read for a stamp. */
export function stampLabels(s: PassportStamp, t: T, lang: string): StampText {
  const place = s.kind === 'country' ? displayCountryName(s.iso2, lang) : (s.city ?? s.iso2);
  const date = stampDate(s.date, lang);
  const mark = t(s.mark === 'departed' ? 'stamps.mark.departed' : 'stamps.mark.arrived');
  const a11y = t('stamps.stamp.a11y', { place, kind: t(s.kind === 'country' ? 'stamps.kind.country' : 'stamps.kind.city'), mark, date, trip: s.tripName });
  return { place, date, mark, a11y };
}

/** The stamps for the saved trips; the demo trip previews its stamps before its dates, as its recap does. */
export function usePassport(): { collection: StampCollection; includeDemo: boolean; setIncludeDemo: (v: boolean) => void; hasDemo: boolean; today: string } {
  const { trips } = useTrips();
  const { includeDemo, setIncludeDemo, hasDemo } = useTravelStats();
  const today = todayIn(deviceZone());
  const collection = useMemo(() => stampCollection(trips, today, { includeDemo, countryName, todayFor: (trip) => recapToday(trip, today) }), [trips, today, includeDemo]);
  return { collection, includeDemo, setIncludeDemo, hasDemo, today };
}

function StraightText({ text, y, width, size, ink }: { text: string; y: number; width: number; size: number; ink: string }) {
  const fit = fitText(text, width, size);
  return (
    <SvgText x={STAMP_C} y={y} fontSize={fit.size} fontFamily={fonts.display} letterSpacing={0.6} textAnchor="middle" fill={ink}>
      {fit.text}
    </SvgText>
  );
}

function ArcText({ text, rx, ry, where, ink }: { text: string; rx: number; ry: number; where: 'top' | 'bottom'; ink: string }) {
  const { glyphs, size } = arcGlyphs(text, rx, ry, where, ARC_SIZE);
  // Each glyph's baseline sits a little "below" the ring in its own frame, so the letters are centred on the ring.
  const dy = size * 0.35;
  return (
    <G>
      {glyphs.map((g, i) => (
        <SvgText key={i} x={g.x} y={g.y} dy={dy} fontSize={size} fontFamily={fonts.display} textAnchor="middle" fill={ink} transform={`rotate(${g.rotate} ${g.x} ${g.y})`}>
          {g.ch}
        </SvgText>
      ))}
    </G>
  );
}

/** The stamp drawing itself (decorative: the button or row around it carries the label). */
export const StampArt = memo(function StampArt({ stamp, text, size = 132 }: { stamp: PassportStamp; text: StampText; size?: number }) {
  const { theme } = useApp();
  const ink = stampInk(theme, stamp.ink);
  const paper = stampPaper(theme).paper;
  const g = stampGeometry(stamp.shape);
  const specks = useMemo(() => inkSpecks(stamp.seed), [stamp.seed]);
  const country = stamp.kind === 'country';
  const mid = g.middle;
  return (
    <Svg width={size} height={size} viewBox={`${-PAD} ${-PAD} ${STAMP_BOX + PAD * 2} ${STAMP_BOX + PAD * 2}`} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <G transform={`rotate(${stamp.tilt} ${STAMP_C} ${STAMP_C})`}>
        <Path d={g.outer} fill="none" stroke={ink} strokeWidth={3.2} strokeLinejoin="round" />
        <Path d={g.inner} fill="none" stroke={ink} strokeWidth={1.3} strokeLinejoin="round" strokeDasharray={country ? undefined : [3, 2.4]} />
        {g.top.arc ? <ArcText text={text.place} rx={g.top.rx} ry={g.top.ry} where="top" ink={ink} /> : <StraightText text={text.place} y={g.top.y} width={g.top.width} size={10} ink={ink} />}
        {country ? (
          <>
            <SvgText x={STAMP_C} y={mid + 3} fontSize={22} fontFamily={fonts.display} letterSpacing={1.5} textAnchor="middle" fill={ink}>
              {stamp.iso2}
            </SvgText>
            <StraightText text={text.date} y={mid + 15} width={g.middleWidth} size={8} ink={ink} />
          </>
        ) : (
          <>
            <Path d={`M${STAMP_C - 18} ${mid - 9} H${STAMP_C - 7} M${STAMP_C + 7} ${mid - 9} H${STAMP_C + 18}`} stroke={ink} strokeWidth={1.2} strokeLinecap="round" />
            <Circle cx={STAMP_C} cy={mid - 9} r={2.2} fill={ink} />
            <StraightText text={text.date} y={mid + 5} width={g.middleWidth} size={10} ink={ink} />
            <SvgText x={STAMP_C} y={mid + 16} fontSize={7.5} fontFamily={fonts.display} letterSpacing={1.2} textAnchor="middle" fill={ink}>
              {stamp.iso2}
            </SvgText>
          </>
        )}
        {g.bottom.arc ? <ArcText text={text.mark} rx={g.bottom.rx} ry={g.bottom.ry} where="bottom" ink={ink} /> : <StraightText text={text.mark} y={g.bottom.y} width={g.bottom.width} size={8.5} ink={ink} />}
        {specks.map(([x, y, r], i) => (
          <Circle key={i} cx={x} cy={y} r={r} fill={paper} opacity={0.85} />
        ))}
      </G>
    </Svg>
  );
});

/**
 * A stamp that fades in (timed, never springs; shown at once with Reduce Motion). With `onPress` it is a 48 pt+
 * button labelled with the place, date, mark and trip; `first` adds a "First stamp" ribbon under it.
 */
export function Stamp({ stamp, size = 132, first, onPress, delay = 0 }: { stamp: PassportStamp; size?: number; first?: boolean; onPress?: () => void; delay?: number }) {
  const { t, theme, lang, reduceMotion } = useApp();
  const text = useMemo(() => stampLabels(stamp, t, lang), [stamp, t, lang]);
  const opacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  useEffect(() => {
    const a = fadeIn(opacity, reduceMotion, duration.slow, delay);
    a.start();
    return () => a.stop();
  }, [opacity, reduceMotion, delay]);
  const label = first ? `${text.a11y} ${t('stamps.stamp.firstA11y')}` : text.a11y;
  const ribbon = first ? (
    <View style={{ alignSelf: 'center', marginTop: -space.s, backgroundColor: theme.accentSoft, borderRadius: radius.pill, paddingHorizontal: space.m, paddingVertical: 2 }}>
      <Text style={[typeScale.caption, { color: theme.accentInk }]}>{t('stamps.stamp.first')}</Text>
    </View>
  ) : null;
  const body = (
    <Animated.View style={{ opacity, alignItems: 'center' }}>
      <StampArt stamp={stamp} text={text} size={size} />
      {ribbon}
    </Animated.View>
  );
  if (!onPress) {
    return (
      <View accessible accessibilityRole="image" accessibilityLabel={label} style={{ minWidth: TOUCH, minHeight: TOUCH }}>
        {body}
      </View>
    );
  }
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={label} accessibilityHint={t('stamps.stamp.hint')} onPress={onPress} style={{ minWidth: TOUCH, alignItems: 'center' }}>
      {body}
    </PressableScale>
  );
}

/** Paper texture (pure SVG pattern) filling its parent. Decorative. */
const PaperTexture = memo(function PaperTexture({ dark }: { dark: boolean }) {
  const { theme } = useApp();
  const p = stampPaper(theme);
  const uid = useId().replace(/[^A-Za-z0-9]/g, '');
  return (
    <Svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Defs>
        <Pattern id={`paper${uid}${dark ? 'd' : 'l'}`} x={0} y={0} width={36} height={36} patternUnits="userSpaceOnUse">
          <Rect x={0} y={0} width={36} height={36} fill={p.paper} />
          <Path d="M0 9 Q9 7 18 9 T36 9 M0 27 Q9 29 18 27 T36 27" fill="none" stroke={p.fibre} strokeWidth={1} />
          <Path d="M6 0 Q5 9 7 18 M25 18 Q27 27 25 36" fill="none" stroke={p.fibre} strokeWidth={0.6} />
          <Circle cx={4} cy={4} r={0.9} fill={p.grain} />
          <Circle cx={21} cy={14} r={0.7} fill={p.grain} />
          <Circle cx={30} cy={31} r={1} fill={p.grain} />
          <Circle cx={12} cy={22} r={0.6} fill={p.grain} />
        </Pattern>
      </Defs>
      <Rect x={0} y={0} width="100%" height="100%" fill={`url(#paper${uid}${dark ? 'd' : 'l'})`} />
    </Svg>
  );
});

/** A passport page: paper texture, an edge, a page label and the stamps laid out two (or more) to a row. */
export function PaperPage({ label, children, footer, style }: { label?: string; children: ReactNode; footer?: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { theme } = useApp();
  const p = stampPaper(theme);
  return (
    <View style={[{ borderRadius: radius.m, overflow: 'hidden', borderWidth: 1, borderColor: p.edge, backgroundColor: p.paper }, style]}>
      <PaperTexture dark={theme.dark} />
      <View style={{ padding: space.m, gap: space.s }}>
        {label ? <Text style={[typeScale.caption, { color: theme.muted, textAlign: 'center' }]}>{label}</Text> : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', rowGap: space.s }}>{children}</View>
        {footer}
      </View>
    </View>
  );
}
