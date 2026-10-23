import { Stack, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useT } from '../src/i18n/react';
import { PLUS_FEATURES, PLUS_FEATURE_COPY, plusPromise } from '../src/plus/entitlement';
import { applyPurchase, type PurchaseResult } from '../src/plus/purchases';
import { plusStore, purchaseProvider, usePlus } from '../src/plus/state';
import { TIP_TIERS, tipJarCopy } from '../src/plus/tipJar';
import { list, space, textStyle } from '../src/theme/design';
import { FreePromise } from '../src/ui/Screen';
import { Text } from '../src/ui/Text';
import { Card, InsetGroupedList, LargeTitleHeader, PillButton, Row, useDesign } from '../src/ui/v2';

function noteFor(r: PurchaseResult, t: ReturnType<typeof useT>): string {
  if (r.ok) return r.kind === 'plus' ? t('app.plus.thanksPlus') : t('app.plus.thanksTip');
  return r.message;
}

/**
 * Couch Plus (PLAN section 5), design v2 (market-1018 M3, docs/DESIGN_V2.md): "Couch Plus" large
 * title, a benefit Card listing the one-time extras, the purchase as a large filled stretch pill with
 * Restore as a plain pill, then the tip jar as inset-grouped rows. Purchases are stubbed; nothing is
 * blocked, and every TV control stays free (the footer says so). No paywall, timer or trial trap.
 */
export default function PlusScreen() {
  const p = useDesign();
  const t = useT();
  const router = useRouter();
  const { tier } = usePlus();
  const [buyNote, setBuyNote] = useState<string | null>(null);
  const [tipNote, setTipNote] = useState<string | null>(null);

  const buy = useCallback((action: 'buy' | 'restore') => {
    applyPurchase(plusStore(), purchaseProvider(), action)
      .then((r) => setBuyNote(noteFor(r, t)))
      .catch(() => setBuyNote(t('app.plus.failed')));
  }, [t]);

  const tip = useCallback((id: string) => {
    purchaseProvider()
      .tip(id)
      .then((r) => setTipNote(noteFor(r, t)))
      .catch(() => setTipNote(t('app.plus.failed')));
  }, [t]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <LargeTitleHeader
        title={t('app.plus.title')}
        leading={<PillButton variant="plain" label={t('app.common.back')} onPress={() => router.back()} />}
      >
        <Card elevation="mid" style={styles.card}>
          <Text style={[textStyle('headline'), { color: p.label }]}>{plusPromise()}</Text>
          <Text style={[textStyle('subheadline'), { color: p.secondaryLabel }]}>{t('app.plus.oneTime')}</Text>
          <View style={styles.features}>
            {PLUS_FEATURES.map((f) => (
              <View
                key={f}
                style={styles.feature}
                accessible
                accessibilityLabel={t('app.plus.featureLabel', { title: PLUS_FEATURE_COPY[f].title, hint: PLUS_FEATURE_COPY[f].hint })}
              >
                <Text style={[textStyle('body'), { color: p.label }]}>{PLUS_FEATURE_COPY[f].title}</Text>
                <Text style={[textStyle('footnote'), { color: p.secondaryLabel }]}>{PLUS_FEATURE_COPY[f].hint}</Text>
              </View>
            ))}
          </View>
        </Card>

        <View style={styles.actions}>
          {tier === 'plus' ? (
            <Text style={[textStyle('headline'), { color: p.success }]}>{t('app.plus.thanksPlus')}</Text>
          ) : (
            <>
              <PillButton
                size="large"
                stretch
                label={t('app.plus.buy')}
                accessibilityLabel={t('app.plus.buy')}
                accessibilityHint={t('app.plus.buyHint')}
                onPress={() => buy('buy')}
              />
              <PillButton
                variant="plain"
                label={t('app.plus.restore')}
                accessibilityLabel={t('app.plus.restore')}
                onPress={() => buy('restore')}
                style={styles.center}
              />
            </>
          )}
          {buyNote ? (
            <Text style={[textStyle('footnote'), { color: p.warning }]} accessibilityLiveRegion="polite">
              {buyNote}
            </Text>
          ) : null}
        </View>

        <InsetGroupedList header={t('app.plus.tipJar')} footer={tipJarCopy()}>
          {TIP_TIERS.map((tt) => (
            <Row
              key={tt.id}
              title={tt.label}
              subtitle={tt.note}
              accessibilityLabel={tt.label}
              accessibilityHint={tt.note}
              onPress={() => tip(tt.id)}
            />
          ))}
        </InsetGroupedList>

        <View style={styles.bottom}>
          {tipNote ? (
            <Text style={[textStyle('footnote'), { color: p.warning }]} accessibilityLiveRegion="polite">
              {tipNote}
            </Text>
          ) : null}
          <FreePromise color={p.secondaryLabel} />
        </View>
      </LargeTitleHeader>
    </>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: list.inset, marginTop: space.sm, marginBottom: space.xl },
  features: { gap: space.md, marginTop: space.sm },
  feature: { gap: space.xxs },
  actions: { marginHorizontal: list.inset, marginBottom: list.groupGap, gap: space.sm },
  center: { alignSelf: 'center' },
  bottom: { marginHorizontal: list.inset, gap: space.md },
});
