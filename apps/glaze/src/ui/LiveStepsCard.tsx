// Collapsible "How to put it on your Lock Screen" card (T30). The copy comes from the tested
// src/core/liveSteps.ts for this device's iOS version, the Glaze build and the source kind.
import { Feather } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { LayoutAnimation, Platform, Pressable, StyleSheet, Text, View, type TextStyle } from 'react-native';
import type { LiveKind } from '../core/liveSteps';
import { useT } from '../i18n';
import { continuous, radiusV2, sizeV2, spaceV2, textV2, type TypeRoleV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import { Segmented } from './Segmented';
import { haptic } from './haptics';
import { textStyleFor } from './i18nLayout';
import { liveContext, localizedInstructions } from './liveContext';
import { useReduceMotion } from './useReduceMotion';

type Props = {
  /** Fixed source kind (the editor). Omit to show a Video / GIF switch (the Live tab). */
  kind?: LiveKind;
  initiallyOpen?: boolean;
};

/** Design v2 (T56): surface squircle card, system type, tint glyph and tint-soft step numbers. */
export function LiveStepsCard({ kind, initiallyOpen = false }: Props) {
  const { c } = useColorsV2();
  const { t, script } = useT();
  const ts = (role: TypeRoleV2): TextStyle[] => [textV2[role], textStyleFor(script, textV2[role])];
  const type = { body: ts('body'), heading: ts('headline'), label: ts('headline'), small: ts('footnote') };
  const reduceMotion = useReduceMotion();
  const [open, setOpen] = useState(initiallyOpen);
  const [picked, setPicked] = useState<LiveKind>('video');
  const ctx = useMemo(() => liveContext(), []);
  const k = kind ?? picked;
  const info = useMemo(() => localizedInstructions(t, { iosMajor: ctx.iosMajor, build: ctx.build, kind: k }), [t, ctx, k]);

  const toggle = () => {
    haptic('select');
    if (!reduceMotion && Platform.OS === 'ios') {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setOpen((o) => !o);
  };

  // The steps are iPhone Lock Screen steps; Android has its own live wallpaper button.
  if (!ctx.isIos) return null;

  return (
    <View style={[styles.card, continuous, { backgroundColor: c.surface }]}>
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityLabel={t('liveUi.steps.title')}
        accessibilityHint={open ? t('liveUi.steps.hintHide') : t('liveUi.steps.hintShow')}
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [styles.head, { opacity: pressed ? 0.7 : 1 }]}
      >
        <Feather name="help-circle" size={20} color={c.tint} />
        <Text style={[...type.label, styles.flex1, { color: c.ink }]}>{t('liveUi.steps.title')}</Text>
        <Feather name={open ? 'chevron-up' : 'chevron-down'} size={20} color={c.inkTertiary} />
      </Pressable>
      {open ? (
        <View style={styles.body}>
          {kind === undefined ? (
            <Segmented<LiveKind>
              label={t('liveUi.steps.source')}
              value={picked}
              onChange={setPicked}
              options={[
                { value: 'video', label: t('liveUi.steps.video') },
                { value: 'gif', label: t('liveUi.steps.gif') },
              ]}
            />
          ) : null}
          <Text accessibilityRole="header" style={[...type.heading, { color: c.ink }]}>
            {info.headline}
          </Text>
          {info.steps.map((s, i) => (
            <View key={i} style={styles.step} accessible accessibilityLabel={t('liveUi.steps.stepA11y', { n: i + 1, text: s })}>
              <View style={[styles.num, { backgroundColor: c.tintSoft }]}>
                <Text style={[...type.small, styles.numText, { color: c.onTintSoft }]}>{i + 1}</Text>
              </View>
              <Text style={[...type.body, styles.flex1, { color: c.ink }]}>{s}</Text>
            </View>
          ))}
          <View style={[styles.limits, { borderColor: c.separator }]}>
            <Text style={[...type.label, { color: c.ink }]}>{t('liveUi.steps.goodToKnow')}</Text>
            {info.limits.map((s, i) => (
              <Text key={i} style={[...type.small, { color: c.inkSecondary }]}>
                {`• ${s}`}
              </Text>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radiusV2.group, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', gap: spaceV2.md, minHeight: sizeV2.rowMin, paddingHorizontal: spaceV2.lg },
  body: { gap: spaceV2.sm, paddingHorizontal: spaceV2.lg, paddingBottom: spaceV2.lg },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: spaceV2.sm },
  num: { minWidth: 24, height: 24, borderRadius: 12, paddingHorizontal: spaceV2.xs, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  numText: { fontWeight: '600' },
  limits: { gap: spaceV2.xs, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spaceV2.sm, marginTop: spaceV2.xs },
  flex1: { flex: 1 },
});
