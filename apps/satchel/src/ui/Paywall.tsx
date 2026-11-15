// 1.0.0 paywall: start the 7-day free trial (a A$0 non-consumable, Guideline 3.1.1) or buy the one-time unlock.
// The price is StoreKit's localized displayPrice only: with no product loaded the unlock button is replaced by a
// line saying so and Try again (no hard-coded price). Restore purchases and the privacy policy sit on the same
// screen. Never pops up on its own: shown by RequireUnlock on a create/edit screen, or from Settings.
import { useState } from 'react';
import { Alert, Linking, Text, View } from 'react-native';
import { TRIAL_SKU, UNLOCK_SKU, unlockButton, type AccessState } from '../core/access.ts';
import type { T } from '../i18n/core.ts';
import { PRIVACY_URL } from '../core/storeLinks.ts';
import { buy, refreshProducts, restorePurchases, useAccess } from '../state/access.ts';
import { useApp } from '../state/app.tsx';
import { fonts, space } from '../theme/tokens.ts';
import { Body, Button, Card } from './kit.tsx';

export function accessLine(t: T, a: { state: AccessState; daysLeft: number }): string {
  if (a.state === 'trial') return a.daysLeft === 1 ? t('access.state.trial.one') : t('access.state.trial.many', { n: a.daysLeft });
  if (a.state === 'expired') return t('access.state.expired');
  if (a.state === 'unlocked') return t('access.state.unlocked');
  if (a.state === 'stub') return t('access.state.stub');
  return t('access.state.new');
}

export function Paywall({ title }: { title?: string }) {
  const { t, theme } = useApp();
  const a = useAccess();
  const [busy, setBusy] = useState(false);
  const ok = [{ text: t('access.ok') }];
  const unlock = unlockButton(a.products[UNLOCK_SKU]?.displayPrice);
  const canStartTrial = a.state === 'new';

  const run = async (id: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await buy(id);
      if (r.status === 'purchased') {
        if (id === TRIAL_SKU) Alert.alert(t('access.done.trialTitle'), t('access.done.trialBody'), ok);
        else Alert.alert(t('access.done.unlockTitle'), t('access.done.unlockBody'), ok);
      } else if (r.status === 'pending') Alert.alert(t('access.pendingTitle'), t('access.pendingBody'), ok);
      else if (r.status === 'failed') Alert.alert(t('access.failTitle'), t('access.failBody', { codes: r.code ? `[${r.code}]` : '' }).trim(), ok);
    } finally {
      setBusy(false);
    }
  };

  const doRestore = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await restorePurchases();
      if (r === 'found') Alert.alert(t('access.restoredTitle'), t('access.restoredBody'), ok);
      else if (r === 'none') Alert.alert(t('access.restoreNoneTitle'), t('access.restoreNoneBody'), ok);
      else Alert.alert(t('access.failTitle'), t('access.restoreFailBody'), ok);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <Text accessibilityRole="header" style={{ fontFamily: fonts.displayMedium, fontSize: 22, color: theme.ink }}>
        {title ?? t('access.title')}
      </Text>
      <Body>{accessLine(t, a)}</Body>
      <Body>{t('access.pitch')}</Body>
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: theme.ink }}>{t('access.includes')}</Text>
      <Body>{`• ${t('access.feature.plan')}\n• ${t('access.feature.share')}\n• ${t('access.feature.all')}`}</Body>
      <Body muted>{t('access.keep')}</Body>
      {a.state === 'unlocked' || a.state === 'stub' ? null : (
        <View style={{ gap: space.s }}>
          {busy ? (
            <Text accessibilityLiveRegion="polite" style={{ fontFamily: fonts.body, fontSize: 15, color: theme.muted }}>
              {t('access.working')}
            </Text>
          ) : null}
          {canStartTrial ? <Button label={t('access.startTrial')} hint={t('access.startTrialHint')} icon="time-outline" onPress={() => run(TRIAL_SKU)} /> : null}
          {unlock.enabled && unlock.price ? (
            <Button label={t('access.unlockPrice', { price: unlock.price })} hint={t('access.unlockHint')} kind={canStartTrial ? 'secondary' : 'primary'} icon="lock-open-outline" onPress={() => run(UNLOCK_SKU)} />
          ) : (
            <>
              <Body muted>{t('access.noPrice')}</Body>
              <Button label={t('access.tryAgain')} hint={t('access.tryAgainHint')} kind="quiet" icon="refresh-outline" onPress={() => void refreshProducts()} />
            </>
          )}
          <Body muted>{t('access.oneTime')}</Body>
        </View>
      )}
      <Button label={t('access.restore')} hint={t('access.restoreHint')} kind="quiet" icon="refresh-outline" onPress={doRestore} />
      <Button label={t('access.privacy')} hint={t('access.privacyHint')} kind="quiet" icon="shield-checkmark-outline" onPress={() => Linking.openURL(PRIVACY_URL).catch(() => {})} />
    </Card>
  );
}
