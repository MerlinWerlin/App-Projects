// Phone frame for Live Lock previews (docs/POLISH.md G5): a rounded bezel with a Dynamic-Island-style
// pill, an optional mock Lock Screen (date + clock in tabular figures, updated each minute) and a faint
// diagonal glass reflection. `children` is the media, drawn inside the screen area and clipped to it.
// The clock timer pauses while the screen is unfocused or the app is in the background.
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AppState, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { LOCK_SAFE_AREAS } from '../core/loop';
// Brand fonts stay for the mock clock (artwork, docs/DESIGN_V2.md §3); chrome is v2 (T83).
import { fonts } from '../theme/tokens';
import { shadowV2, tabularV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import { useT } from '../i18n';
import { noMirror, noMirrorText, textStyleFor } from './i18nLayout';

/** Bezel thickness for an outer frame `width` (points). */
export function bezelFor(width: number): number {
  return Math.max(4, Math.min(12, Math.round(width * 0.03)));
}

/** Screen (media) size inside a frame of outer `width` for a screen aspect (width / height). */
export function phoneScreenSize(width: number, aspect: number): { width: number; height: number; bezel: number } {
  const bezel = bezelFor(width);
  const w = Math.max(1, width - bezel * 2);
  return { width: w, height: w / aspect, bezel };
}

/** True while this screen is focused and the app is in the foreground. */
export function useActiveScreen(): boolean {
  const [focused, setFocused] = useState(true);
  const [foreground, setForeground] = useState(AppState.currentState !== 'background');
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setForeground(s === 'active'));
    return () => sub.remove();
  }, []);
  return focused && foreground;
}

/** Current time, refreshed on each minute boundary while `active`. */
function useMinuteClock(active: boolean): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!active) return;
    setNow(new Date());
    let interval: ReturnType<typeof setInterval> | undefined;
    const msToNext = 60_000 - (Date.now() % 60_000) + 50;
    const first = setTimeout(() => {
      setNow(new Date());
      interval = setInterval(() => setNow(new Date()), 60_000);
    }, msToNext);
    return () => {
      clearTimeout(first);
      if (interval) clearInterval(interval);
    };
  }, [active]);
  return now;
}

type Props = {
  /** Outer width of the frame, bezel included (points). */
  width: number;
  /** Screen aspect, width / height (default 9 / 19.5). */
  aspect?: number;
  /** Draw the mock Lock Screen date and clock over the media. */
  showClock?: boolean;
  /** Dashed outlines around the date, clock and control areas, plus the two bottom controls. */
  showGuides?: boolean;
  /** Screen background behind the media. */
  screenColor?: string;
  /** Mock clock + date ink and text shadow (default white with a dark shadow; T97). */
  clockInk?: { ink: string; shadow: string };
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

export function PhoneFrame({
  width,
  aspect = 9 / 19.5,
  showClock = true,
  showGuides = false,
  screenColor = '#000000',
  clockInk,
  style,
  children,
}: Props) {
  const { scheme } = useColorsV2();
  const screen = phoneScreenSize(width, aspect);
  const outerH = screen.height + screen.bezel * 2;
  const outerR = Math.max(12, width * 0.14);
  const innerR = Math.max(8, outerR - screen.bezel);
  return (
    <View
      style={[
        styles.outer,
        noMirror,
        shadowV2('raised', scheme),
        { width, height: outerH, borderRadius: outerR, padding: screen.bezel },
        style,
      ]}
    >
      <View style={[styles.screen, { width: screen.width, height: screen.height, borderRadius: innerR, backgroundColor: screenColor }]}>
        {children}
        {showClock || showGuides ? (
          <LockOverlay width={screen.width} height={screen.height} showClock={showClock} showGuides={showGuides} clockInk={clockInk} />
        ) : null}
        <Reflection width={screen.width} height={screen.height} />
        <View
          pointerEvents="none"
          style={[
            styles.island,
            {
              top: Math.max(3, screen.height * 0.014),
              width: screen.width * 0.3,
              height: Math.max(5, screen.width * 0.085),
              borderRadius: screen.width * 0.05,
              left: screen.width * 0.35, // rtl-ok
            },
          ]}
        />
      </View>
      <View pointerEvents="none" style={[styles.rim, { borderRadius: outerR }]} />
    </View>
  );
}

function LockOverlay({
  width,
  height,
  showClock,
  showGuides,
  clockInk,
}: {
  width: number;
  height: number;
  showClock: boolean;
  showGuides: boolean;
  clockInk?: { ink: string; shadow: string };
}) {
  const active = useActiveScreen();
  const now = useMinuteClock(active && showClock);
  const { formatClock, formatDate, script } = useT();
  const { date, clock, controls } = LOCK_SAFE_AREAS;
  // The date reads in the phone's language (as iOS shows it); the clock stays Latin digits, LTR.
  const dateText = formatDate(now, { weekday: 'long', day: 'numeric', month: 'long' });
  const clockSize = height * clock.height * 0.85;
  const ctrl = height * controls.height;
  const guide = showGuides ? styles.guide : null;
  const ink = clockInk ? { color: clockInk.ink, textShadowColor: clockInk.shadow } : null;
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, { width, height }]}
    >
      <View style={[styles.band, guide, { top: height * date.top, height: height * date.height }]}>
        {showClock ? (
          <Text
            style={[styles.text, ink, tabularV2, { fontFamily: fonts.bodyMedium, fontSize: height * date.height * 0.6 }, textStyleFor(script)]}
            numberOfLines={1}
          >
            {dateText}
          </Text>
        ) : null}
      </View>
      <View style={[styles.band, guide, { top: height * clock.top, height: height * clock.height }]}>
        {showClock ? (
          <Text
            style={[styles.text, ink, tabularV2, noMirrorText, { fontFamily: fonts.display, fontSize: clockSize, lineHeight: clockSize * 1.1 }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {formatClock(now)}
          </Text>
        ) : null}
      </View>
      {showGuides ? (
        <View
          style={[styles.controls, guide, { bottom: height * controls.bottom, height: ctrl, paddingHorizontal: width * 0.1 }]}
        >
          {(['zap', 'camera'] as const).map((name) => (
            <View key={name} style={[styles.ctrl, { width: ctrl, height: ctrl, borderRadius: ctrl / 2 }]}>
              <Feather name={name} size={ctrl * 0.42} color="#FFFFFF" />
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Faint diagonal glass reflection: a soft white band across the upper-left of the screen. */
function Reflection({ width, height }: { width: number; height: number }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="phoneGlass" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.14} />
            <Stop offset="0.34" stopColor="#FFFFFF" stopOpacity={0.06} />
            <Stop offset="0.35" stopColor="#FFFFFF" stopOpacity={0} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#phoneGlass)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { alignSelf: 'center', backgroundColor: '#141114' },
  screen: { overflow: 'hidden' },
  rim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  island: { position: 'absolute', backgroundColor: '#000000' },
  band: { position: 'absolute', left: '8%', right: '8%', alignItems: 'center', justifyContent: 'center' }, // rtl-ok (mock never mirrors)
  guide: { borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.55)', borderRadius: 6 },
  text: {
    color: '#FFFFFF',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  controls: {
    position: 'absolute',
    left: '4%', // rtl-ok
    right: '4%', // rtl-ok
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ctrl: { backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center' },
});
