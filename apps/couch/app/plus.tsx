import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useT } from '../src/i18n/react';
import { TRIAL_DAYS, accessFor, canStartTrial, needsPurchase } from '../src/plus/access';
import { PLUS_FEATURE_COPY, plusPromise } from '../src/plus/copy';
import { PLUS_FEATURES, PLUS_PRICE } from '../src/plus/entitlement';
import { setPaywallShown } from '../src/plus/paywall';
import { usePlus } from '../src/plus/usePlus';
import { continuous, list, radii, space, textStyle } from '../src/theme/design';
import { RemoteIcon } from '../src/ui/icons/RemoteIcon';
import { FreePromise } from '../src/ui/Screen';
import { Text } from '../src/ui/Text';
import { showToast } from '../src/ui/Toast';
import { Card, LargeTitleHeader, PillButton, useDesign } from '../src/ui/v2';

/**
 * Never fail silently (night 23 Oct, from Linework fb-1023 "tapping Unlock Plus did nothing"): besides the
 * line under the buttons, every trial / Buy / Restore result also shows as a toast. The toast is felt (haptic),
 * spoken by VoiceOver (the inline line's live region is Android-only), visible wherever the page is scrolled
 * and shows again on a repeat tap even when the inline line can't change.
 */
function report(note: string, ok: boolean): void {
  showToast(note, ok ? 'success' : 'warning');
}

/**
 * Couch Plus paywall (owner decision 7 Nov 2026), design v2: "Couch Plus" large title, a Card saying what it
 * unlocks (the remote and casting) for one store-localised price, once, no subscription, and what stays free. Then
 * "Start 7-day free trial" (the free "7-day Trial" item, guideline 3.1.1; hidden once a trial was used), Buy (price)
 * and Restore purchases. During a trial it shows the days left. Opened from Settings, and by the gate
 * (src/plus/gate.tsx) whenever a locked control is pressed. Grandfathered people (they had the free Couch 1.0.3)
 * and owners see a thank-you instead of buttons.
 */
export default function PlusScreen() {
  const p = useDesign();
  const t = useT();
  const router = useRouter();
  const { access, price: storePrice, busy, store } = usePlus();
  const [buyNote, setBuyNote] = useState<string | null>(null);
  // Whether the line under the buttons is good news (green) or a problem (amber).
  const [buyOk, setBuyOk] = useState(false);
  const price = storePrice ?? PLUS_PRICE;

  // The gate doesn't open a second paywall on top of this one.
  useEffect(() => {
    setPaywallShown(true);
    return () => setPaywallShown(false);
  }, []);

  const say = useCallback((note: string, ok: boolean) => {
    setBuyNote(note);
    report(note, ok);
    setBuyOk(ok);
  }, []);

  const buy = useCallback(
    (action: 'buy' | 'restore') => {
      (action === 'buy' ? store.purchase() : store.restore())
        .then((r) => {
          if (r === 'owned') return say(t('app.plus.thanksPlus'), true);
          if (r === 'unavailable') return say(t('core.plus.unavailable'), false);
          if (r === 'failed') return say(t('app.plus.failed'), false);
          // Not owned. A restore may still have brought back a running trial.
          const now = store.access();
          if (action === 'restore' && now.reason === 'trial') return say(t('app.plus.trialDaysLeft', { count: now.daysLeft }), true);
          say(t(action === 'buy' ? 'app.plus.notBought' : 'app.plus.restoreNone'), false);
        })
        .catch(() => say(t('app.plus.failed'), false));
    },
    [say, store, t],
  );

  const startTrial = useCallback(() => {
    store
      .startTrial()
      .then((r) => {
        if (r.status === 'cancelled') return;
        if (r.status === 'unavailable') return say(t('app.plus.trialUnavailable'), false);
        if (r.status === 'failed' || r.start === null) return say(t('app.plus.trialFailed'), false);
        // A reinstall finds the trial already owned: its original date counts, so it may already have ended.
        const a = accessFor({ owned: false, grandfathered: false, trialStart: r.start, now: Date.now() });
        if (a.reason !== 'trial') return say(t('app.plus.trialUsed'), false);
        say(r.status === 'started' ? t('app.plus.trialStarted', { days: TRIAL_DAYS }) : t('app.plus.trialDaysLeft', { count: a.daysLeft }), true);
      })
      .catch(() => say(t('app.plus.trialFailed'), false));
  }, [say, store, t]);

  const status =
    access.reason === 'grandfathered'
      ? t('app.plus.grandfathered')
      : access.reason === 'owned'
        ? t('app.plus.thanksPlus')
        : access.reason === 'trial'
          ? t('app.plus.trialDaysLeft', { count: access.daysLeft })
          : access.reason === 'expired'
            ? t('app.plus.trialEnded')
            : null;
  const done = access.reason === 'grandfathered' || access.reason === 'owned';
  // On Android the 7-day evaluation is local to this phone (src/plus/iapStore.ts); on iOS it is the free store item.
  const offerTrial = canStartTrial(access);

  return (
    <>
      <LargeTitleHeader
        title={t('app.plus.title')}
        leading={<PillButton variant="plain" label={t('app.common.back')} onPress={() => router.back()} />}
      >
        <Card elevation="mid" style={styles.card}>
          <Text style={[textStyle('title2'), { color: p.label }]} accessibilityRole="header">
            {plusPromise()}
          </Text>
          <Text style={[textStyle('headline'), { color: p.tintLabel }]}>{t('app.plus.priceLine', { price })}</Text>
          <View style={styles.features}>
            {PLUS_FEATURES.map((f) => (
              <View
                key={f}
                style={styles.feature}
                accessible
                accessibilityLabel={t('app.plus.featureLabel', { title: PLUS_FEATURE_COPY[f].title, hint: PLUS_FEATURE_COPY[f].hint })}
              >
                {/* Decorative tick in the Plus tint, like the TVs list's icon tiles; VoiceOver reads the row label. */}
                <View
                  style={[styles.tick, continuous, { backgroundColor: p.tintedFill }]}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                >
                  <RemoteIcon name="check" size={16} color={p.tintedLabel} />
                </View>
                <View style={styles.featureText}>
                  <Text style={[textStyle('headline'), { color: p.label }]}>{PLUS_FEATURE_COPY[f].title}</Text>
                  <Text style={[textStyle('footnote'), { color: p.secondaryLabel }]}>{PLUS_FEATURE_COPY[f].hint}</Text>
                </View>
              </View>
            ))}
          </View>
          <Text style={[textStyle('footnote'), { color: p.secondaryLabel }]}>{t('app.plus.freePart')}</Text>
        </Card>

        <View style={styles.actions}>
          {status ? (
            <Text style={[textStyle('headline'), { color: done ? p.success : p.label }]} accessibilityLiveRegion="polite">
              {status}
            </Text>
          ) : null}
          {needsPurchase(access) ? (
            <>
              {offerTrial ? (
                <>
                  <PillButton
                    size="large"
                    stretch
                    disabled={busy}
                    label={t('app.plus.startTrial', { days: TRIAL_DAYS })}
                    accessibilityHint={t('app.plus.trialTerms', { days: TRIAL_DAYS })}
                    onPress={startTrial}
                  />
                  <Text style={[textStyle('footnote'), { color: p.secondaryLabel }]}>
                    {t('app.plus.trialTerms', { days: TRIAL_DAYS })}
                  </Text>
                </>
              ) : null}
              <PillButton
                size="large"
                stretch
                variant={offerTrial ? 'tinted' : 'filled'}
                disabled={busy}
                label={t('app.plus.buyPrice', { price })}
                accessibilityLabel={t('app.plus.buy')}
                accessibilityHint={t('app.plus.buyHint')}
                onPress={() => buy('buy')}
              />
              <PillButton
                variant="plain"
                disabled={busy}
                label={t('app.plus.restore')}
                accessibilityLabel={t('app.plus.restore')}
                onPress={() => buy('restore')}
                style={styles.center}
              />
            </>
          ) : null}
          {buyNote ? (
            // A good result (trial started, Plus restored) reads as success, never in the warning colour.
            <Text
              style={[textStyle('footnote'), styles.centerText, { color: buyOk ? p.success : p.warning }]}
              accessibilityLiveRegion="polite"
            >
              {buyNote}
            </Text>
          ) : null}
        </View>

        <View style={styles.bottom}>
          <FreePromise color={p.secondaryLabel} />
        </View>
      </LargeTitleHeader>
    </>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: list.inset, marginTop: space.sm, marginBottom: space.xl, gap: space.xs },
  features: { gap: space.md, marginTop: space.sm, marginBottom: space.sm },
  feature: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  featureText: { flex: 1, gap: space.xxs },
  tick: { width: 28, height: 28, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  centerText: { textAlign: 'center' },
  actions: { marginHorizontal: list.inset, marginBottom: list.groupGap, gap: space.sm },
  center: { alignSelf: 'center' },
  bottom: { marginHorizontal: list.inset, gap: space.md },
});
