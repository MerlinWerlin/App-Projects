// Counters: the big main counter (one huge tap target) and compact extra counters.
import { Feather } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { useEffect, useRef } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { progress, type Counter } from '../core/model';
import { t } from '../i18n';
import { getSettings, useSettings } from '../store/settings';
import { font, radius, space, useColors } from '../theme/tokens';
import { haptic } from './haptics';
import { IconButton } from './kit';

export function speakCount(label: string, v: number) {
  if (!getSettings().speakCount) return;
  try {
    Speech.stop();
    Speech.speak(`${label} ${v}`, { rate: 1.05 });
  } catch {
    // speech unavailable
  }
}

/** Pop the number when it changes (skipped with reduce motion). */
function usePop(value: number) {
  const { reduceMotion } = useSettings();
  const s = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (reduceMotion) return;
    s.setValue(1.12);
    Animated.spring(s, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }).start();
  }, [value, s, reduceMotion]);
  return s;
}

export function BigCounter({
  counter,
  onPlus,
  onMinus,
  onEdit,
  subtitle,
  compact,
}: {
  counter: Counter;
  onPlus: () => void;
  onMinus: () => void;
  onEdit: () => void;
  subtitle?: string;
  compact?: boolean;
}) {
  const { c } = useColors();
  const { leftHanded } = useSettings();
  const pop = usePop(counter.value);
  const pct = progress(counter);
  const label = counter.label || t('counter.row');

  const plus = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('counter.plusA11y', { label, value: counter.value + 1 })}
      onPress={() => {
        haptic('tap');
        onPlus();
        speakCount(label, counter.value + 1);
      }}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: compact ? 88 : 132,
        borderRadius: radius.xl,
        backgroundColor: pressed ? c.ink : c.accent,
        alignItems: 'center',
        justifyContent: 'center',
      })}
    >
      <Feather name="plus" size={compact ? 40 : 56} color={c.accentInk} />
    </Pressable>
  );
  const minus = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('counter.minusA11y', { label })}
      onPress={() => {
        haptic('select');
        onMinus();
      }}
      style={({ pressed }) => ({
        width: compact ? 64 : 84,
        minHeight: compact ? 88 : 132,
        borderRadius: radius.xl,
        backgroundColor: pressed ? c.line : c.surface2,
        alignItems: 'center',
        justifyContent: 'center',
      })}
    >
      <Feather name="minus" size={compact ? 26 : 32} color={c.ink} />
    </Pressable>
  );

  return (
    <View style={{ gap: space.m }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('counter.valueA11y', { label, value: counter.value })}
        accessibilityHint={t('counter.editHint')}
        onLongPress={onEdit}
        onPress={onEdit}
        style={{ alignItems: 'center' }}
      >
        <Text maxFontSizeMultiplier={1.2} style={{ fontFamily: font.heavy, fontSize: 14, letterSpacing: 1, textTransform: 'uppercase', color: c.ink2 }}>
          {label}
        </Text>
        <Animated.Text
          maxFontSizeMultiplier={1.1}
          style={{ fontFamily: font.display, fontSize: compact ? 72 : 108, lineHeight: compact ? 80 : 118, color: c.ink, transform: [{ scale: pop }], fontVariant: ['tabular-nums'] }}
        >
          {counter.value}
        </Animated.Text>
        {counter.every ? (
          <Text style={{ fontFamily: font.bodySemi, color: c.ink2, fontSize: 14 }}>{t('counter.ofRepeat', { every: counter.every })}</Text>
        ) : counter.target ? (
          <Text style={{ fontFamily: font.bodySemi, color: c.ink2, fontSize: 14 }}>{t('counter.ofTarget', { target: counter.target })}</Text>
        ) : null}
        {subtitle ? <Text style={{ fontFamily: font.bodySemi, color: c.ink2, fontSize: 14, marginTop: 2 }}>{subtitle}</Text> : null}
      </Pressable>
      {pct != null ? (
        <View style={{ height: 6, borderRadius: 3, backgroundColor: c.surface2, overflow: 'hidden' }}>
          <View style={{ width: `${pct * 100}%`, height: 6, backgroundColor: c.accent }} />
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', gap: space.m }}>
        {leftHanded ? plus : minus}
        {leftHanded ? minus : plus}
      </View>
    </View>
  );
}

export function MiniCounter({
  counter,
  parentLabel,
  onPlus,
  onMinus,
  onEdit,
}: {
  counter: Counter;
  parentLabel?: string;
  onPlus: () => void;
  onMinus: () => void;
  onEdit: () => void;
}) {
  const { c } = useColors();
  const pop = usePop(counter.value);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, borderRadius: radius.l, padding: space.s, paddingLeft: space.l, gap: space.s }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${counter.label}: ${counter.value}`} accessibilityHint={t('counter.editHint')} onPress={onEdit} style={{ flex: 1, minHeight: 48, justifyContent: 'center' }}>
        <Text numberOfLines={1} style={{ fontFamily: font.bodyBold, fontSize: 15, color: c.ink }}>
          {counter.label}
        </Text>
        <Text numberOfLines={1} style={{ fontFamily: font.bodySemi, fontSize: 12, color: c.ink2 }}>
          {counter.every
            ? parentLabel
              ? t('counter.repeatInfoParent', { every: counter.every, parent: parentLabel })
              : t('counter.repeatInfo', { every: counter.every })
            : counter.target
              ? t('counter.ofTarget', { target: counter.target })
              : t('counter.tapToEdit')}
        </Text>
      </Pressable>
      <IconButton icon="minus" tone="soft" size={18} label={t('counter.minusA11y', { label: counter.label })} onPress={onMinus} />
      <Animated.Text style={{ minWidth: 44, textAlign: 'center', fontFamily: font.display, fontSize: 28, color: c.ink, transform: [{ scale: pop }], fontVariant: ['tabular-nums'] }}>
        {counter.value}
      </Animated.Text>
      <IconButton
        icon="plus"
        tone="accent"
        size={18}
        label={t('counter.plusA11y', { label: counter.label, value: counter.value + 1 })}
        onPress={() => {
          onPlus();
          speakCount(counter.label, counter.value + 1);
        }}
      />
    </View>
  );
}
