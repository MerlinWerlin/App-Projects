// Pill segmented control (docs/DESIGN_V2.md §7 Templates "level as a pill segmented control"): a soft pill track
// with one ink-filled segment. Any number of options; segments share the width and long translations wrap (never
// truncate). Each segment is ≥ 44 pt tall, a radio in a radiogroup, and pops (selectPop) when chosen; the selection
// haptic follows the Haptics setting (PressableScale). Reduce Motion: no pop.
import { useEffect, useRef } from 'react';
import { Animated, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { PressableScale } from '../PressableScale';
import { useThemeV2 } from '../../theme/useTheme';
import { maxFontScaleV2, radiusV2, sizeV2, spaceV2 } from '../../theme/tokensV2';
import { popTo, pressScaleV2, useReduceMotion } from '../../theme/motion';
import { squircle } from './shared';

export type PillSegment<T extends string> = { value: T; label: string; accessibilityLabel?: string; accessibilityHint?: string };

export type PillSegmentedProps<T extends string> = {
  options: readonly PillSegment<T>[];
  value: T;
  onChange: (v: T) => void;
  /** Spoken name of the group, e.g. "Level". */
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
  /**
   * Segments per row. Unset: one row. fb-1022c: the Templates level control uses 2 (All / Beginner over
   * Intermediate / Advanced) so each word gets room instead of wrapping mid-word.
   */
  columns?: number;
};

const PAD = 3;

export function PillSegmented<T extends string>({ options, value, onChange, accessibilityLabel, style, columns }: PillSegmentedProps<T>) {
  const { c } = useThemeV2();
  const perRow = columns && columns > 0 ? columns : options.length;
  const rows: PillSegment<T>[][] = [];
  for (let i = 0; i < options.length; i += perRow) rows.push(options.slice(i, i + perRow));
  const multi = rows.length > 1;
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[
        squircle,
        {
          flexDirection: multi ? 'column' : 'row',
          gap: multi ? PAD : 0,
          padding: PAD,
          borderRadius: multi ? radiusV2.lg : radiusV2.pill,
          backgroundColor: c.card2,
          borderWidth: 1,
          borderColor: c.line,
        },
        style,
      ]}
    >
      {multi
        ? rows.map((row, ri) => (
            <View key={ri} style={{ flexDirection: 'row' }}>
              {row.map((o) => (
                <Segment key={o.value} option={o} selected={o.value === value} onPress={() => onChange(o.value)} />
              ))}
              {Array.from({ length: perRow - row.length }, (_, k) => (
                <View key={`pad-${k}`} style={{ flex: 1 }} />
              ))}
            </View>
          ))
        : options.map((o) => <Segment key={o.value} option={o} selected={o.value === value} onPress={() => onChange(o.value)} />)}
    </View>
  );
}

function Segment<T extends string>({ option, selected, onPress }: { option: PillSegment<T>; selected: boolean; onPress: () => void }) {
  const { c, text } = useThemeV2();
  const reduce = useReduceMotion();
  const pop = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!selected) return;
    const a = popTo(pop, reduce);
    a.start();
    return () => a.stop();
  }, [selected, reduce, pop]);
  return (
    <PressableScale
      onPress={() => {
        if (!selected) onPress();
      }}
      haptic={selected ? 'none' : 'select'}
      scaleTo={pressScaleV2}
      accessibilityRole="radio"
      accessibilityLabel={option.accessibilityLabel ?? option.label}
      accessibilityHint={option.accessibilityHint}
      accessibilityState={{ selected, checked: selected }}
      style={{ flex: 1 }}
    >
      <Animated.View
        style={[
          squircle,
          {
            minHeight: sizeV2.touch,
            borderRadius: radiusV2.pill,
            paddingHorizontal: spaceV2.x2,
            paddingVertical: spaceV2.x1,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: selected ? c.ink : 'transparent',
            transform: [{ scale: pop }],
          },
        ]}
      >
        <Text
          maxFontSizeMultiplier={maxFontScaleV2}
          style={[text('subhead'), { color: selected ? c.onInk : c.graphite, fontWeight: selected ? '600' : '500', textAlign: 'center' }]}
        >
          {option.label}
        </Text>
      </Animated.View>
    </PressableScale>
  );
}
