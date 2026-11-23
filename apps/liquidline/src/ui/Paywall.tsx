// Free trial and one-time unlock (house pattern from Satchel 1.0.0). The trial is a free non-consumable the person
// starts (Guideline 3.1.1). The price is StoreKit's localized displayPrice only: with no product loaded there is no
// price and no buy button, just "couldn't load" and Try again. Restore purchases and the privacy policy are on the
// same screen. Never opens on its own.
import { useState } from 'react';
import { Alert, Linking, Text, View } from 'react-native';
import { TRIAL_SKU, UNLOCK_SKU, unlockButton } from '../core/access.ts';
import { buy, refreshProducts, restorePurchases, useAccess } from '../state/access.ts';
import { FONT, SPACE, usePalette } from '../theme/tokens.ts';
import { Body, Button, Card, Small } from './kit.tsx';

export const PRIVACY_URL = 'https://merlinwerlin.github.io/App-Projects/liquidline/privacy.html';
export const SUPPORT_URL = 'https://merlinwerlin.github.io/App-Projects/liquidline/support.html';

export function accessLine(a: { state: string; daysLeft: number }): string {
  if (a.state === 'trial') return a.daysLeft === 1 ? 'Free trial: 1 day left.' : `Free trial: ${a.daysLeft} days left.`;
  if (a.state === 'expired') return 'Your free week has ended.';
  if (a.state === 'unlocked') return 'Unlocked. Thank you!';
  if (a.state === 'stub') return 'Everything is open in this preview build.';
  return 'Try every tool free for 7 days.';
}

export function Paywall() {
  const p = usePalette();
  const a = useAccess();
  const [busy, setBusy] = useState(false);
  const unlock = unlockButton(a.products[UNLOCK_SKU]?.displayPrice);
  const canStartTrial = a.state === 'new';
  const ok = [{ text: 'OK' }];

  const run = async (id: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await buy(id);
      if (r.status === 'purchased') {
        if (id === TRIAL_SKU) Alert.alert('Free trial started', 'Every tool is open for 7 days. Nothing renews and nothing is charged.', ok);
        else Alert.alert('Liquidline is unlocked', 'Every tool is yours to keep. Thank you!', ok);
      } else if (r.status === 'pending') Alert.alert('Waiting for approval', 'The purchase is pending (for example Ask to Buy). It unlocks as soon as it is approved.', ok);
      else if (r.status === 'failed') Alert.alert('That didn’t go through', `Nothing was charged. Please try again. ${r.code ? `[${r.code}]` : ''}`.trim(), ok);
    } finally {
      setBusy(false);
    }
  };

  const doRestore = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await restorePurchases();
      if (r === 'found') Alert.alert('Purchases restored', 'Your trial or unlock is back on this iPhone.', ok);
      else if (r === 'none') Alert.alert('Nothing to restore', 'No Liquidline trial or unlock was found for this Apple Account.', ok);
      else Alert.alert('Couldn’t reach the App Store', 'Check your connection and try again. Nothing was charged.', ok);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <Text accessibilityRole="header" style={{ fontFamily: FONT.display, fontSize: 34, color: p.text }}>Liquidline Full Unlock</Text>
      <Body>{accessLine(a)}</Body>
      <Body dim>One payment opens every calculator for good:</Body>
      <Body>{'• Superheat and subcooling with targets\n• Extra charge for long line sets, with cost\n• Evacuation checklist and decay test\n• Line set planner and pipe sizes\n• Room load estimate and flare torque\n• Saving readings to jobs and sharing job sheets'}</Body>
      <Small>Always free: PT lookups and charts, refrigerant facts, the converter and your saved jobs.</Small>
      {a.state === 'unlocked' || a.state === 'stub' ? null : (
        <View style={{ gap: SPACE.sm }}>
          {busy ? <Small>Talking to the App Store…</Small> : null}
          {canStartTrial ? <Button testID="start-trial" icon="time-outline" title="Start 7-day free trial" onPress={() => void run(TRIAL_SKU)} /> : null}
          {unlock.enabled && unlock.price ? (
            <Button testID="unlock" kind={canStartTrial ? 'secondary' : 'primary'} icon="lock-open-outline" title={`Unlock for ${unlock.price}`} onPress={() => void run(UNLOCK_SKU)} />
          ) : (
            <>
              <Small>{a.productsLoaded ? 'The App Store price couldn’t be loaded.' : 'Loading the App Store price…'}</Small>
              <Button kind="plain" icon="refresh-outline" title="Try again" onPress={() => void refreshProducts()} />
            </>
          )}
          <Small>One-time purchase. No subscription. The free trial never turns into a payment.</Small>
        </View>
      )}
      <Button kind="plain" icon="refresh-outline" title="Restore purchases" onPress={() => void doRestore()} />
      <Button kind="plain" icon="shield-checkmark-outline" title="Privacy policy" onPress={() => void Linking.openURL(PRIVACY_URL).catch(() => {})} />
    </Card>
  );
}
