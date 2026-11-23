// Paywall (pattern from Satchel's reviewed paywall): start the free 7-day trial (a A$0 non-consumable, Guideline
// 3.1.1) or buy the one-time Full Unlock. Price = StoreKit's localized displayPrice only; with none loaded there is
// no buy button, just Try again. Restore purchases and the privacy policy are on the same screen. Never shown on its
// own: only from a locked tool, the trial banner or Settings.
import { useState } from 'react';
import { Alert, Linking, Text, View } from 'react-native';
import { TRIAL_SKU, UNLOCK_SKU, unlockButton } from '../core/access.ts';
import { buy, refreshProducts, restorePurchases, useAccess } from '../state/access.ts';
import { fonts, space, useTheme } from '../theme/theme.ts';
import { Button, Card, P } from './kit.tsx';

export const PRIVACY_URL = 'https://merlinwerlin.github.io/App-Projects/trammel/privacy.html';

const PAID = ['Stairs with NCC checks', 'Common rafters and birdsmouths', 'Hips, valleys and creepers', 'Cornice and compound mitres', 'Stud, joist and batten layouts', 'Decking boards and fixings', 'Cut-list optimiser', 'Arch and radius', 'Save calculations to jobs'];

export function accessLine(a: { state: string; daysLeft: number }): string {
  if (a.state === 'trial') return `Free trial: ${a.daysLeft} day${a.daysLeft === 1 ? '' : 's'} left.`;
  if (a.state === 'expired') return 'Your free week has finished. Free tools and saved jobs stay open.';
  if (a.state === 'unlocked') return 'Full Unlock is on. Every tool is yours. Thanks!';
  if (a.state === 'stub') return 'Every tool is open in this version.';
  return 'Try every tool free for 7 days. Nothing is charged and nothing renews.';
}

export function Paywall() {
  const t = useTheme();
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
        if (id === TRIAL_SKU) Alert.alert('Your free week has started', 'Every tool is open for 7 days. Nothing renews and nothing is charged.', ok);
        else Alert.alert('Full Unlock is on', 'Every tool is yours for good, on every iPhone signed in to your Apple Account.', ok);
      } else if (r.status === 'pending') Alert.alert('Waiting for approval', 'The App Store is waiting for approval (for example Ask to Buy). Trammel unlocks as soon as it comes through.', ok);
      else if (r.status === 'failed') Alert.alert('That didn’t go through', `Nothing was charged. Please try again in a moment.${r.code ? ` [${r.code}]` : ''}`, ok);
    } finally {
      setBusy(false);
    }
  };

  const doRestore = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await restorePurchases();
      if (r === 'found') Alert.alert('Restored', 'Your purchase is back on this iPhone.', ok);
      else if (r === 'none') Alert.alert('Nothing to restore', 'No Trammel purchase was found for this Apple Account.', ok);
      else Alert.alert('Couldn’t reach the App Store', 'Check your connection and try Restore again. Nothing was charged.', ok);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: space.l }}>
      <View style={{ backgroundColor: t.blade, borderRadius: 18, padding: space.l, gap: space.s }}>
        <Text accessibilityRole="header" style={{ fontFamily: fonts.displayHeavy, fontSize: 40, lineHeight: 42, color: t.bladeInk }}>
          EVERY TOOL. ONE PRICE.
        </Text>
        <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 18, color: t.bladeInk }}>{accessLine(a)}</Text>
      </View>
      <Card>
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 17, color: t.ink }}>Full Unlock opens</Text>
        {PAID.map((p) => (
          <Text key={p} style={{ fontFamily: fonts.body, fontSize: 17, lineHeight: 23, color: t.ink }}>
            •  {p}
          </Text>
        ))}
        <P muted small>Always free: Fractions ↔ mm, Square check, Mitre, Roof pitch, and opening your saved jobs.</P>
      </Card>
      {a.state === 'unlocked' || a.state === 'stub' ? null : (
        <View style={{ gap: space.s }}>
          {busy ? (
            <Text accessibilityLiveRegion="polite" style={{ fontFamily: fonts.body, fontSize: 16, color: t.muted }}>
              Talking to the App Store…
            </Text>
          ) : null}
          {canStartTrial ? <Button label="Start 7-day free trial" kind="blade" icon="time-outline" hint="Free. Nothing renews." onPress={() => run(TRIAL_SKU)} /> : null}
          {unlock.enabled && unlock.price ? (
            <Button label={`Unlock everything · ${unlock.price}`} kind={canStartTrial ? 'secondary' : 'primary'} icon="lock-open-outline" onPress={() => run(UNLOCK_SKU)} />
          ) : (
            <>
              <P muted small>The App Store price couldn’t be loaded.</P>
              <Button label="Try again" kind="quiet" icon="refresh-outline" onPress={() => void refreshProducts()} />
            </>
          )}
          <P muted small>One-time purchase. No subscription.</P>
        </View>
      )}
      <Button label="Restore purchases" kind="quiet" icon="refresh-outline" onPress={doRestore} />
      <Button label="Privacy policy" kind="quiet" icon="shield-checkmark-outline" onPress={() => Linking.openURL(PRIVACY_URL).catch(() => {})} />
    </View>
  );
}
