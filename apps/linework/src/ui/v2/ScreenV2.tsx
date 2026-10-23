// Design v2 screen shell (docs/DESIGN_V2.md §6): paper background, safe area, and an optional large title that
// collapses into the GlassBar as the content scrolls. Content gets the screen gutter (16; 20 on ≥ 400 pt).
//   <ScreenV2 title={t('settings.title')} onBack={router.back}>…</ScreenV2>
// scroll={false} renders a plain View (no large title collapse) for screens that bring their own FlatList; those
// use useLargeTitleScroll() + <LargeTitleHeader> / <LargeTitle> directly.
import type { ReactNode } from 'react';
import { Animated, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeV2 } from '../../theme/useTheme';
import { gutterFor, spaceV2 } from '../../theme/tokensV2';
import { sceneBottomPad } from '../../core/tabs';
import { BAR_HEIGHT, LargeTitle, LargeTitleHeader, useLargeTitleScroll } from './LargeTitleHeader';

export type ScreenV2Props = {
  /** Large title; omit for a screen without a header. */
  title?: string;
  onBack?: () => void;
  backLabel?: string;
  trailing?: ReactNode;
  children: ReactNode;
  /** Default true: an Animated.ScrollView wired to the large title. */
  scroll?: boolean;
  /** Apply the screen gutter to the content (default true). */
  gutter?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  /**
   * T92: the screen is a tab root (app/(tabs)/). The tab bar below already pads for the bottom safe area, so the
   * content skips it (no double gap above the bar).
   */
  inTabs?: boolean;
};

export function ScreenV2({
  title,
  onBack,
  backLabel,
  trailing,
  children,
  scroll = true,
  gutter = true,
  contentContainerStyle,
  style,
  inTabs = false,
}: ScreenV2Props) {
  const { c } = useThemeV2();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { scrollY, onScroll } = useLargeTitleScroll();
  const hasHeader = title !== undefined || !!onBack || !!trailing;
  const top = hasHeader ? insets.top + BAR_HEIGHT : insets.top;
  const pad = gutter ? gutterFor(width) : 0;
  const content: StyleProp<ViewStyle> = [
    { paddingTop: top, paddingBottom: sceneBottomPad(insets.bottom, inTabs, spaceV2.x8), paddingHorizontal: pad },
    contentContainerStyle,
  ];
  return (
    <View style={[{ flex: 1, backgroundColor: c.paper }, style]}>
      {scroll ? (
        <Animated.ScrollView
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentContainerStyle={content}
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="never"
        >
          {title !== undefined ? <LargeTitle title={title} scrollY={scrollY} /> : null}
          {children}
        </Animated.ScrollView>
      ) : (
        <View style={[{ flex: 1 }, content]}>{children}</View>
      )}
      {hasHeader ? (
        <LargeTitleHeader title={title ?? ''} scrollY={scrollY} onBack={onBack} backLabel={backLabel} trailing={trailing} />
      ) : null}
    </View>
  );
}
