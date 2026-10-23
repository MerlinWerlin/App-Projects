// iOS large title (docs/DESIGN_V2.md §5, §6). Two parts driven by one Animated scroll value:
//   <LargeTitleHeader>  the fixed top bar: back chevron (mirrored for RTL), inline 17 pt title and a trailing slot,
//                       on a GlassBar that fades in once the large title has collapsed;
//   <LargeTitle>        the 34 pt title at the top of the scroll content, which scales 34 → 17 over the first 52 pt
//                       of scroll (transform scale, native driver) and hands over to the inline title.
// Reduce Motion: no scaling, the two titles simply swap at the end of the distance (src/core/largeTitle.ts).
// ScreenV2 wires both; screens with a FlatList use useLargeTitleScroll() and render them themselves.
import { useRef, type ReactNode } from 'react';
import { Animated, I18nManager, Pressable, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeV2 } from '../../theme/useTheme';
import { maxFontScaleV2, sizeV2, spaceV2 } from '../../theme/tokensV2';
import { useReduceMotion } from '../../theme/motion';
import { collapseInterpolation } from '../../core/largeTitle';
import { backChevron } from '../../i18n/direction';
import { useT } from '../../i18n';
import { tap } from '../../native/haptics';
import { GlassBar } from './Glass';

/** Scroll value + native-driven onScroll handler for an Animated.ScrollView / Animated.FlatList. */
export function useLargeTitleScroll(): {
  scrollY: Animated.Value;
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
} {
  const scrollY = useRef(new Animated.Value(0)).current;
  const onScroll = useRef(
    Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true }),
  ).current as unknown as (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  return { scrollY, onScroll };
}

/** Height of the fixed bar below the safe-area inset. */
export const BAR_HEIGHT = sizeV2.bar;

export type LargeTitleHeaderProps = {
  title: string;
  scrollY: Animated.Value;
  /** Shows a back chevron when set. */
  onBack?: () => void;
  /** Spoken name of the back button; default t('common.back'). */
  backLabel?: string;
  /** Trailing controls (e.g. a settings button). */
  trailing?: ReactNode;
};

export function LargeTitleHeader({ title, scrollY, onBack, backLabel, trailing }: LargeTitleHeaderProps) {
  const { c, text } = useThemeV2();
  const { t } = useT();
  const reduce = useReduceMotion();
  const insets = useSafeAreaInsets();
  const cfg = collapseInterpolation(reduce);
  const barOpacity = scrollY.interpolate({ ...cfg.barOpacity, extrapolate: 'clamp' });
  return (
    <View style={{ position: 'absolute', top: 0, start: 0, end: 0, zIndex: 10 }}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: barOpacity }]}>
        <GlassBar style={StyleSheet.absoluteFill} />
      </Animated.View>
      <View
        style={{
          paddingTop: insets.top,
          minHeight: insets.top + BAR_HEIGHT,
          paddingHorizontal: spaceV2.x2,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <View style={{ minWidth: sizeV2.touch, alignItems: 'flex-start' }}>
          {onBack ? (
            <Pressable
              onPress={() => {
                tap();
                onBack();
              }}
              accessibilityRole="button"
              accessibilityLabel={backLabel ?? t('common.back')}
              hitSlop={6}
              style={{ width: sizeV2.touch, height: sizeV2.touch, alignItems: 'center', justifyContent: 'center' }}
            >
              <Feather name={backChevron()} size={26} color={c.ink} />
            </Pressable>
          ) : null}
        </View>
        <Animated.View style={{ flex: 1, opacity: barOpacity }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Text maxFontSizeMultiplier={1.2} style={[text('headline'), { color: c.graphite, textAlign: 'center' }]}>
            {title}
          </Text>
        </Animated.View>
        <View style={{ minWidth: sizeV2.touch, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' }}>{trailing}</View>
      </View>
    </View>
  );
}

export type LargeTitleProps = { title: string; scrollY: Animated.Value };

/** The large title inside the scroll content (place it first). */
export function LargeTitle({ title, scrollY }: LargeTitleProps) {
  const { c, text } = useThemeV2();
  const reduce = useReduceMotion();
  const cfg = collapseInterpolation(reduce);
  const scale = scrollY.interpolate({ ...cfg.largeScale, extrapolate: 'clamp' });
  const opacity = scrollY.interpolate({ ...cfg.largeOpacity, extrapolate: 'clamp' });
  return (
    <Animated.Text
      accessibilityRole="header"
      maxFontSizeMultiplier={maxFontScaleV2}
      style={[
        text('largeTitle'),
        {
          color: c.graphite,
          alignSelf: 'flex-start',
          marginBottom: spaceV2.x2,
          opacity,
          // scale from the text's start edge (physical side depends on the layout direction)
          transformOrigin: I18nManager.isRTL ? 'right center' : 'left center', // rtl-physical-ok
          transform: [{ scale }],
        },
      ]}
    >
      {title}
    </Animated.Text>
  );
}
