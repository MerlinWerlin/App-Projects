import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useT } from '../src/i18n/react';
import { PLUS_FEATURES, PLUS_FEATURE_COPY, plusPromise } from '../src/plus/entitlement';
import { applyPurchase, type PurchaseResult } from '../src/plus/purchases';
import { plusForSale } from '../src/core/forSale';
import { plusStore, purchaseProvider, usePlus } from '../src/plus/state';
import { list, space, textStyle } from '../src/theme/design';
import { FreePromise } from '../src/ui/Screen';
import { Text } from '../src/ui/Text';
import { showToast } from '../src/ui/Toast';
import { Card, LargeTitleHeader, PillButton, useDesign } from '../src/ui/v2';

function noteFor(r: PurchaseResult, t: ReturnType<typeof useT>): string {
  if (r.ok) return t('app.plus.thanksPlus');
  return r.message;
}

/**
 * Never fail silently (night 23 Oct, from Linework fb-1023 "tapping Unlock Plus did nothing"): besides the
 * line under the buttons, every Buy / Restore result also shows as a toast. The toast is felt (haptic),
 * spoken by VoiceOver (the inline line's live region is Android-only), visible wherever the page is scrolled
 * and shows again on a repeat tap even when the inline line can't change.
 */
function report(note: string, ok: boolean): void {
  showToast(note, ok ? 'success' : 'warning');
}

/**
 * Couch Plus (PLAN section 5), design v2 (market-1018 M3, docs/DESIGN_V2.md): "Couch Plus" large
 * title, a benefit Card listing the one-time extras, the purchase as a large filled stretch pill with
 * Restore as a plain pill. No tip jar (owner, 25 Oct 2026: removed). Purchases are stubbed; nothing is
 * blocked, and every TV control stays free (the footer says so). No paywall, timer or trial trap.
 */
export default function PlusScreen() {
  const p = useDesign();
  const t = useT();
  const router = useRouter();
  const { tier } = usePlus();
  const [buyNote, setBuyNote] = useState<string | null>(null);
  // Release standard 2: no store in this version, so no Buy / Restore (and no "test build" text).
  const forSale = plusForSale();

  const buy = useCallback((action: 'buy' | 'restore') => {
    applyPurchase(plusStore(), purchaseProvider(), action)
      .then((r) => {
        const note = noteFor(r, t);
        setBuyNote(note);
        report(note, r.ok);
      })
      .catch(() => {
        setBuyNote(t('app.plus.failed'));
        report(t('app.plus.failed'), false);
      });
  }, [t]);


  return (
    <>
      <LargeTitleHeader
        title={t('app.plus.title')}
        leading={<PillButton variant="plain" label={t('app.common.back')} onPress={() => router.back()} />}
      >
        <Card elevation="mid" style={styles.card}>
          <Text style={[textStyle('headline'), { color: p.label }]}>{plusPromise()}</Text>
          <Text style={[textStyle('subheadline'), { color: p.secondaryLabel }]}>{t(forSale ? 'app.plus.oneTime' : 'app.plus.later')}</Text>
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

        {forSale ? (
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
        ) : null}


        <View style={styles.bottom}>
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
