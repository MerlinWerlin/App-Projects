// Step indicator for multi-step flows (T83, docs/MARKET.md "Design reference 18 Oct" §3): numbered dots that turn
// into ticks when done, the current step in the accent colour with a soft halo and a springy pop, and a connecting
// line between the dots. Rows follow the layout direction (start → end), so in Arabic step 1 sits on the right.
// One accessible element reads "Step 2 of 3: Outline". Step logic is pure in src/core/steps.ts.
import { useEffect, useRef } from 'react';
import { Animated, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { segmentFilled, stepLabelParams, stepStates, type StepState } from '../../core/steps';
import { useT } from '../../i18n';
import { ltr } from '../../i18n/core';
import { popTo, useReduceMotion } from '../../theme/motion';
import { tabular } from '../../theme/tokens';
import { maxFontScaleV2, spaceV2 } from '../../theme/tokensV2';
import { useThemeV2 } from '../../theme/useTheme';

export type StepIndicatorProps = {
  /** Already translated step names, in flow order (e.g. t('common.steps.pick'), …). */
  labels: readonly string[];
  /** 0-based index of the current step; earlier steps show as done. */
  current: number;
  style?: StyleProp<ViewStyle>;
};

const DOT = 28;
const HALO = 6;
const LINE = 2;

export function StepIndicator({ labels, current, style }: StepIndicatorProps) {
  const { c, text } = useThemeV2();
  const { t, num } = useT();
  const reduce = useReduceMotion();
  const count = labels.length;
  const states = stepStates(count, current);
  const p = stepLabelParams(count, current);

  // Springy pop on the current dot whenever the current step changes (Reduce Motion: no movement).
  const pop = useRef(new Animated.Value(reduce ? 1 : 0.8)).current;
  useEffect(() => {
    if (!reduce) pop.setValue(0.8);
    const a = popTo(pop, reduce);
    a.start();
    return () => a.stop();
  }, [p.index, reduce, pop]);

  if (count === 0) return null;

  const dotFor = (state: StepState, i: number) => {
    const fill = state === 'current' ? c.ink : state === 'done' ? c.inkSoft : c.card;
    const border = state === 'todo' ? c.line : c.ink;
    const dot = (
      <View
        style={{
          width: DOT,
          height: DOT,
          borderRadius: DOT / 2,
          backgroundColor: fill,
          borderWidth: state === 'current' ? 0 : 1.5,
          borderColor: border,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {state === 'done' ? (
          <Feather name="check" size={16} color={c.ink} />
        ) : (
          <Text
            maxFontSizeMultiplier={1.2}
            style={[text('caption'), tabular, { fontWeight: '700', color: state === 'current' ? c.onInk : c.muted }]}
          >
            {ltr(num(i + 1))}
          </Text>
        )}
      </View>
    );
    if (state !== 'current') return dot;
    return (
      <Animated.View
        style={{
          padding: HALO / 2,
          margin: -HALO / 2,
          borderRadius: (DOT + HALO) / 2,
          backgroundColor: c.inkSoft,
          transform: [{ scale: pop }],
        }}
      >
        {dot}
      </Animated.View>
    );
  };

  const lineTop = DOT / 2 - LINE / 2;
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={t('common.steps.a11y', { current: p.current, total: p.total, label: labels[p.index] })}
      style={[{ flexDirection: 'row', alignItems: 'flex-start' }, style]}
    >
      {labels.map((label, i) => {
        const state = states[i];
        return (
          <View key={i} style={{ flex: 1, alignItems: 'center', minWidth: 0 }}>
            {/* Connecting line: half into this cell from the start side, half out towards the end side. */}
            {i > 0 ? (
              <View
                style={{
                  position: 'absolute',
                  top: lineTop,
                  start: 0,
                  end: '50%',
                  height: LINE,
                  borderRadius: LINE / 2,
                  backgroundColor: segmentFilled(i - 1, current, count) ? c.ink : c.line,
                }}
              />
            ) : null}
            {i < count - 1 ? (
              <View
                style={{
                  position: 'absolute',
                  top: lineTop,
                  start: '50%',
                  end: 0,
                  height: LINE,
                  borderRadius: LINE / 2,
                  backgroundColor: segmentFilled(i, current, count) ? c.ink : c.line,
                }}
              />
            ) : null}
            {dotFor(state, i)}
            <Text
              maxFontSizeMultiplier={maxFontScaleV2}
              style={[
                text('caption'),
                {
                  marginTop: spaceV2.x1 + 2,
                  paddingHorizontal: spaceV2.x1,
                  textAlign: 'center',
                  color: state === 'current' ? c.graphite : c.muted,
                  fontWeight: state === 'current' ? '700' : '500',
                },
              ]}
            >
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
