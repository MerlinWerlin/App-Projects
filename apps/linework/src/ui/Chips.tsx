import { Children, cloneElement, isValidElement, memo, useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  Text,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../theme/useTheme';
import { radius, space, touch } from '../theme/tokens';
import { springTo, useReduceMotion } from '../theme/motion';
import { useT } from '../i18n';
import { isRTL } from '../i18n/direction';
import { useTypography } from '../theme/typography';

export type ChipProps = {
  label: string;
  onPress: () => void;
  active?: boolean;
  /** Optional result count shown after the label in a muted weight. */
  count?: number;
  /** Optional leading element (e.g. an icon), decorative. */
  icon?: ReactNode;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** 'tab' for exclusive choices (category), 'button' toggles (collections, favourites). */
  role?: 'tab' | 'button';
  /** Optional layout callback (used by ChipRow's sliding underline). */
  onLayout?: (e: LayoutChangeEvent) => void;
};

// Filter chip in the app's pill style: card fill + hairline, solid ink when active. ≥ 48 pt tall.
function ChipBase({ label, onPress, active = false, count, icon, accessibilityLabel, accessibilityHint, role = 'button', onLayout }: ChipProps) {
  const ty = useTypography();
  const { c } = useTheme();
  const { t, num } = useT();
  const fg = active ? c.onInk : c.graphite;
  return (
    <Pressable
      onPress={onPress}
      onLayout={onLayout}
      accessibilityRole={role}
      accessibilityState={{ selected: active }}
      accessibilityLabel={accessibilityLabel ?? (count != null ? t('common.chip.withCount', { label, count }) : label)}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => ({
        minHeight: touch,
        paddingHorizontal: space.lg + space.xs,
        marginEnd: space.sm,
        borderRadius: radius.pill,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: active ? c.ink : pressed ? c.inkSoft : c.card,
        borderWidth: 1,
        borderColor: active ? c.ink : c.line,
      })}
    >
      {icon ? <View style={{ marginEnd: space.xs + 2 }}>{icon}</View> : null}
      <Text maxFontSizeMultiplier={1.4} style={{ ...ty.face('bodyMedium'), fontSize: 16, color: fg }}>
        {label}
      </Text>
      {count != null ? (
        <Text
          maxFontSizeMultiplier={1.4}
          style={{ ...ty.face('body'), fontSize: 14, color: active ? c.onInk : c.muted, marginStart: space.xs + 2, opacity: active ? 0.8 : 1 }}
        >
          {num(count)}
        </Text>
      ) : null}
    </Pressable>
  );
}

export const Chip = memo(ChipBase);

export type ChipRowProps = {
  children: ReactNode;
  /** Horizontal padding so the first chip lines up with the screen gutter. */
  gutter: number;
  /** Optional muted lead-in label, e.g. "Collections". */
  title?: string;
  accessibilityRole?: 'tablist' | 'none';
  style?: StyleProp<ViewStyle>;
  /**
   * Opt-in selection indicator. 'underline' draws an ink bar under the active chip that slides
   * (translateX + scaleX, native driver) to the newly selected chip. Default: none (unchanged look).
   */
  indicator?: 'none' | 'underline';
};

// Base width of the underline view; scaleX stretches it to the measured chip width.
const BAR_BASE = 100;
const BAR_HEIGHT = 3;

type ChipFrame = { x: number; width: number };

// Horizontally scrolling chip row.
export function ChipRow({ children, gutter, title, accessibilityRole = 'none', style, indicator = 'none' }: ChipRowProps) {
  const ty = useTypography();
  const { c } = useTheme();
  const underline = indicator === 'underline';
  const reduce = useReduceMotion();
  // Measured frames per chip key, relative to the scroll content (so the bar scrolls with the chips).
  const [frames, setFrames] = useState<Record<string, ChipFrame>>({});
  const handlers = useRef(new Map<string, (e: LayoutChangeEvent) => void>()).current;
  const tx = useRef(new Animated.Value(0)).current;
  const sx = useRef(new Animated.Value(0.01)).current;
  const placed = useRef(false);
  // Right-to-left: the bar is anchored at the start (physical right) edge, so its offset needs the content width.
  const rtl = isRTL();
  const [contentW, setContentW] = useState(0);

  const handlerFor = (key: string) => {
    let h = handlers.get(key);
    if (!h) {
      h = (e: LayoutChangeEvent) => {
        const { x, width } = e.nativeEvent.layout;
        setFrames((prev) => {
          const cur = prev[key];
          if (cur && cur.x === x && cur.width === width) return prev;
          return { ...prev, [key]: { x, width } };
        });
      };
      handlers.set(key, h);
    }
    return h;
  };

  const found: { key: string | null } = { key: null };
  const content = underline
    ? Children.map(children, (child, i) => {
        if (!isValidElement(child)) return child;
        const el = child as ReactElement<ChipProps>;
        const key = el.key != null ? String(el.key) : `i${i}`;
        if (el.props && el.props.active) found.key = key;
        return cloneElement(el, { onLayout: handlerFor(key) });
      })
    : children;

  const target: ChipFrame | undefined = found.key != null ? frames[found.key] : undefined;
  // Inset the bar so it sits inside the pill's rounded ends.
  const inset = target ? Math.min(space.lg, target.width / 4) : 0;
  const barX = target ? target.x + inset : 0;
  const barW = target ? Math.max(1, target.width - inset * 2) : 0;

  useEffect(() => {
    if (!underline || !target || (rtl && contentW === 0)) return;
    const toScale = barW / BAR_BASE;
    // CSS-style transform order: scale about the bar's centre, then translate. Layout x and translateX are
    // physical (left-based); the bar's resting centre is BAR_BASE/2 from the start edge.
    const restCentre = rtl ? contentW - BAR_BASE / 2 : BAR_BASE / 2;
    const toX = barX + barW / 2 - restCentre;
    if (!placed.current) {
      placed.current = true;
      tx.setValue(toX);
      sx.setValue(toScale);
      return;
    }
    const a = Animated.parallel([springTo(tx, toX, reduce), springTo(sx, toScale, reduce)]);
    a.start();
    return () => a.stop();
  }, [underline, target, barX, barW, reduce, tx, sx, rtl, contentW]);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      style={style}
      onContentSizeChange={underline && rtl ? (w) => setContentW(w) : undefined}
      contentContainerStyle={{ paddingHorizontal: gutter, paddingVertical: space.xs, alignItems: 'center' }}
      accessibilityRole={accessibilityRole === 'tablist' ? 'tablist' : undefined}
    >
      {title ? (
        <Text
          accessibilityRole="header"
          maxFontSizeMultiplier={1.4}
          style={{ ...ty.face('bodyBold'), fontSize: 13, color: c.muted, marginEnd: space.md, textTransform: 'uppercase', letterSpacing: 0.6 }}
        >
          {title}
        </Text>
      ) : null}
      {content}
      {underline ? (
        <Animated.View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            position: 'absolute',
            start: 0,
            bottom: 0,
            width: BAR_BASE,
            height: BAR_HEIGHT,
            borderRadius: BAR_HEIGHT / 2,
            backgroundColor: c.ink,
            opacity: target ? 1 : 0,
            transform: [{ translateX: tx }, { scaleX: sx }],
          }}
        />
      ) : null}
    </ScrollView>
  );
}

export type ChoiceOption<T extends string> = { value: T; label: string; accessibilityLabel?: string };

export type ChoiceBarProps<T extends string> = {
  options: readonly ChoiceOption<T>[];
  value: T;
  onChange: (v: T) => void;
  /** Read by screen readers for the group, e.g. "Level". */
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
};

// Segmented control with any number of options (pill track, filled selected segment), like Segmented.
export function ChoiceBar<T extends string>({ options, value, onChange, accessibilityLabel, style }: ChoiceBarProps<T>) {
  const ty = useTypography();
  const { c } = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[
        {
          flexDirection: 'row',
          padding: space.xs,
          borderRadius: radius.pill,
          backgroundColor: c.card,
          borderWidth: 1,
          borderColor: c.line,
        },
        style,
      ]}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => {
              if (!selected) onChange(o.value);
            }}
            accessibilityRole="radio"
            accessibilityLabel={o.accessibilityLabel ?? o.label}
            accessibilityState={{ checked: selected, selected }}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: touch,
              paddingHorizontal: space.xs,
              borderRadius: radius.pill,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: selected ? c.ink : pressed ? c.inkSoft : 'transparent',
            })}
          >
            <Text
              maxFontSizeMultiplier={1.3}
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
              style={{ ...ty.face('bodyBold'), fontSize: 15, color: selected ? c.onInk : c.graphite, textAlign: 'center' }}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
