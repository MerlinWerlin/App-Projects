import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { continuous, radiusV2, spaceV2, textV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import { useT } from '../i18n';
import { textStyleFor } from './i18nLayout';

type Props = {
  title?: string;
  subtitle?: string;
  children?: ReactNode;
  scroll?: boolean;
  /** Small control shown at the end of the title (e.g. a "?" Tips button). */
  action?: ReactNode;
};

/** Standard screen wrapper: safe areas, grouped v2 background, optional large title (T83). */
export function Screen({ title, subtitle, children, scroll = true, action }: Props) {
  const { c } = useColorsV2();
  const { script } = useT();
  const body = (
    <View style={styles.inner}>
      {title ? (
        <View style={styles.titleRow}>
          <Text accessibilityRole="header" style={[textV2.largeTitle, textStyleFor(script, textV2.largeTitle), styles.flex, { color: c.ink }]}>
            {title}
          </Text>
          {action ?? null}
        </View>
      ) : null}
      {subtitle ? <Text style={[textV2.callout, textStyleFor(script, textV2.callout), { color: c.inkSecondary }]}>{subtitle}</Text> : null}
      {children}
    </View>
  );
  const rootStyle = [styles.root, { backgroundColor: c.bg }];
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={rootStyle}>
      {scroll ? <ScrollView bounces={false} overScrollMode="never" contentContainerStyle={styles.scroll}>{body}</ScrollView> : body}
    </SafeAreaView>
  );
}

/** Card placeholder used by screens that a later task fills in. */
export function Placeholder({ text }: { text: string }) {
  const { c } = useColorsV2();
  const { script } = useT();
  return (
    <View style={[styles.card, continuous, { backgroundColor: c.surface, borderColor: c.separator }]}>
      <Text style={[textV2.body, textStyleFor(script, textV2.body), { color: c.inkSecondary }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingBottom: spaceV2.xxl },
  inner: { padding: spaceV2.lg, gap: spaceV2.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spaceV2.sm },
  flex: { flex: 1 },
  card: { borderRadius: radiusV2.card, borderWidth: StyleSheet.hairlineWidth, padding: spaceV2.lg },
});
