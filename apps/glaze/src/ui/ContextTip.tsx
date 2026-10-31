// One-line contextual tip shown next to a feature. Pass one id, or several to show them one at a
// time (the next appears after "Got it"). Renders nothing while loading or once dismissed; every tip
// can be brought back from the Tips library (Settings › Tips, or "?" on the Themes tab).
import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { nextTip, type TipId } from '../core/tips';
import { useT } from '../i18n';
import { useTips } from '../store/tips';
import { continuous, fontScaleCap, radiusV2, sizeV2, spaceV2, textV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import { haptic } from './haptics';
import { textStyleFor } from './i18nLayout';

type Props = {
  id?: TipId;
  ids?: readonly TipId[];
  style?: StyleProp<ViewStyle>;
};

export function ContextTip({ id, ids, style }: Props) {
  // Design v2 (T56): a tinted (tintSoft / onTintSoft, AA 7.8:1) squircle card, system type.
  const { c } = useColorsV2();
  const { t, script } = useT();
  const body1 = [textV2.subhead, textStyleFor(script, textV2.subhead)];
  const label = [textV2.subhead, textStyleFor(script, textV2.subhead), styles.semibold];
  const { dismissed, hide } = useTips();
  const tip = nextTip(ids ?? (id ? [id] : []), dismissed);
  if (!tip) return null;
  const title = t(`themeUi.tips.${tip.id}.title`);
  const body = t(`themeUi.tips.${tip.id}.body`);

  return (
    <View style={[styles.card, continuous, { backgroundColor: c.tintSoft }, style]}>
      <View
        style={styles.text}
        accessible
        accessibilityRole="text"
        accessibilityLabel={t('themeUi.tip.a11y', { title, body })}
      >
        <Feather name="info" size={18} color={c.onTintSoft} style={styles.icon} />
        <Text maxFontSizeMultiplier={fontScaleCap('subhead')} style={[...body1, styles.flex, { color: c.onTintSoft }]}>
          <Text maxFontSizeMultiplier={fontScaleCap('subhead')} style={styles.semibold}>{t('themeUi.tip.lead', { title })}</Text>
          {body}
        </Text>
      </View>
      <Pressable
        onPress={() => {
          haptic('select');
          hide(tip.id);
        }}
        accessibilityRole="button"
        accessibilityLabel={t('themeUi.tip.gotIt')}
        accessibilityHint={t('themeUi.tip.gotItHint')}
        hitSlop={4}
        style={({ pressed }) => [styles.got, { opacity: pressed ? 0.6 : 1 }]}
      >
        <Text maxFontSizeMultiplier={fontScaleCap('subhead')} style={[...label, { color: c.onTintSoft }]}>{t('themeUi.tip.gotIt')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spaceV2.xs,
    borderRadius: radiusV2.card,
    paddingStart: spaceV2.lg,
    minHeight: sizeV2.touch,
  },
  text: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: spaceV2.sm, paddingVertical: spaceV2.md },
  icon: { marginTop: 1 },
  flex: { flex: 1 },
  semibold: { fontWeight: '600' },
  got: {
    minWidth: sizeV2.touch,
    minHeight: sizeV2.touch,
    paddingHorizontal: spaceV2.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
