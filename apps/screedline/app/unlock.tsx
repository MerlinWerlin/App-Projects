import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';

const GROUND = require('../assets/art/welcome-ground.jpg');
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FULL_AUSTRALIA_PRICE } from '../src/plus/entitlement';
import type { PurchaseResult } from '../src/plus/purchases';
import { useApp } from '../src/state/AppState';
import { FONT, RADIUS, SPACE } from '../src/theme/theme';
import { TOOLS } from '../src/tools/registry';
import { Button, Icon, T } from '../src/ui/kit';

/** Paywall: close button from the start, plain price, Restore on the same screen, trial never automatic. */
export default function UnlockScreen() {
  const app = useApp();
  const { theme, access, trial } = app;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [busy, setBusy] = useState<null | 'buy' | 'trial' | 'restore'>(null);
  const paid = TOOLS.filter(t => !t.free);
  const act = async (kind: 'buy' | 'trial' | 'restore', fn: () => Promise<PurchaseResult>) => {
    setBusy(kind);
    const r = await fn();
    setBusy(null);
    if (r.ok) {
      Alert.alert(r.access.full ? 'Unlocked' : 'Trial started', r.access.full ? 'Every tool is yours. Thank you!' : 'Every tool is open for 7 days. Nothing is charged when it ends.', [{ text: 'OK', onPress: () => router.back() }]);
    } else if (r.reason !== 'cancelled') {
      Alert.alert(kind === 'restore' ? 'Restore purchases' : 'Not completed', r.message);
    }
  };
  return (
    <View style={{ flex: 1, backgroundColor: theme.ground }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + SPACE.xxl }}>
        <View style={{ backgroundColor: theme.slab, paddingTop: SPACE.xl, paddingHorizontal: SPACE.l, paddingBottom: SPACE.xl, gap: SPACE.m }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ width: 56, height: 6, borderRadius: 3, backgroundColor: theme.amber }} />
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => router.back()} hitSlop={12} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#2A2D31', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="close" size={26} color="#FFFFFF" />
            </Pressable>
          </View>
          <Text maxFontSizeMultiplier={1.4} style={{ fontFamily: FONT.numBold, fontSize: 44, lineHeight: 48, color: theme.onSlab }}>Full Unlock</Text>
          <Text maxFontSizeMultiplier={1.5} style={{ fontFamily: FONT.body, fontSize: 18, lineHeight: 25, color: theme.onSlab2 }}>
            {access.full ? 'You own Full Unlock. Every tool is open.' : `Every tool, unlimited jobs. One payment of ${app.price ?? FULL_AUSTRALIA_PRICE}, no subscription.`}
          </Text>
        </View>

        <View style={{ padding: SPACE.l }}>
          {!access.full ? (
            <View style={{ gap: SPACE.m, }}>
              <Button disabled={!!busy} icon="lock-open-variant" label={busy === 'buy' ? 'Opening the App Store…' : `Unlock for ${app.price ?? FULL_AUSTRALIA_PRICE}`} onPress={() => void act('buy', app.buy)} />
              {!trial.started ? (
                <Button disabled={!!busy} kind="secondary" icon="timer-sand" label={busy === 'trial' ? 'Opening the App Store…' : 'Start free 7-day trial'} onPress={() => void act('trial', app.startTrial)} />
              ) : (
                <View style={{ borderRadius: RADIUS.m, borderWidth: 2, borderColor: theme.line, padding: SPACE.l }}>
                  <T kind="label">{trial.active ? `Trial: ${trial.daysLeft} ${trial.daysLeft === 1 ? 'day' : 'days'} left` : 'Your free trial has ended'}</T>
                </View>
              )}
              <Button disabled={!!busy} kind="plain" label={busy === 'restore' ? 'Checking…' : 'Restore purchases'} onPress={() => void act('restore', app.restore)} />
              {busy ? <ActivityIndicator color={theme.ink} /> : null}
              <T kind="small" style={{ textAlign: 'center' }}>
                The trial is a free item from Apple that you start yourself. It never turns into a charge. Full Unlock is a single payment through your Apple ID.
              </T>
            </View>
          ) : (
            <Button label="Done" onPress={() => router.back()} />
          )}
        </View>
        <Image source={GROUND} accessibilityIgnoresInvertColors accessibilityLabel="Illustration of a landscaper laying pavers by a retaining wall" style={{ width, height: Math.round(width / 1.5), backgroundColor: theme.cardAlt }} resizeMode="cover" />
        <View style={{ padding: SPACE.l, gap: SPACE.m }}>
          <T kind="caps">Free forever</T>
          <T>Slab volume, truck order, premix bags, falls, tonnes ↔ m³, the pour checklist and one saved job.</T>
          <T kind="caps" style={{ marginTop: SPACE.s }}>Full Unlock adds</T>
          {paid.map(t => (
            <View key={t.id} style={{ flexDirection: 'row', gap: SPACE.m, alignItems: 'center' }}>
              <View style={{ width: 36, height: 36, borderRadius: 9, backgroundColor: theme.amber, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={t.icon} size={20} color={theme.onAmber} />
              </View>
              <View style={{ flex: 1 }}>
                <T kind="label">{t.title}</T>
                <T kind="small">{t.blurb}</T>
              </View>
            </View>
          ))}
          <View style={{ flexDirection: 'row', gap: SPACE.m, alignItems: 'center' }}>
            <View style={{ width: 36, height: 36, borderRadius: 9, backgroundColor: theme.amber, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="clipboard-multiple-outline" size={20} color={theme.onAmber} />
            </View>
            <T kind="label" style={{ flex: 1 }}>Unlimited jobs and job sheets</T>
          </View>

        </View>
      </ScrollView>
    </View>
  );
}
