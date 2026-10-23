import { StyleSheet, Text, View } from 'react-native';
import { batchFraction } from '../core/install';
import { useT } from '../i18n';
import { textStyleFor } from './i18nLayout';
import { radiusV2, spaceV2, textV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';

type Props = {
  /** 0..1 */
  progress: number;
  label?: string;
};

/** Determinate progress bar with a text label (announced as a progress bar). Design v2 (T56): fill track, tint bar. */
export function ProgressBar({ progress, label }: Props) {
  const { c } = useColorsV2();
  const { t, script } = useT();
  const p = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  const pct = t('install.progress.percent', { percent: Math.round(batchFraction(p, 1) * 100) });
  const small = [textV2.footnote, textStyleFor(script, textV2.footnote)];
  return (
    <View
      style={styles.wrap}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label ? t('install.progress.a11y', { label, percent: pct }) : pct}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(p * 100) }}
    >
      <View style={[styles.track, { backgroundColor: c.fill }]}>
        <View style={[styles.fill, { width: `${p * 100}%` as `${number}%`, backgroundColor: c.tint }]} />
      </View>
      <View style={styles.row}>
        <Text style={[...small, styles.flex, { color: c.inkSecondary }]}>
          {label ?? ''}
        </Text>
        <Text style={[...small, { color: c.inkSecondary }]}>{pct}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spaceV2.xs },
  track: { height: 8, borderRadius: radiusV2.pill, overflow: 'hidden' },
  fill: { height: 8, borderRadius: radiusV2.pill },
  row: { flexDirection: 'row', alignItems: 'center', gap: spaceV2.sm },
  flex: { flex: 1 },
});
