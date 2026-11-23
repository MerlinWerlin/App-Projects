import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useApp } from '../src/state/AppState';
import { Body, Button, Card, Screen, useTap } from '../src/ui/kit';
import { font, radius, space, usePalette } from '../src/ui/theme';
import { TOOLS, toolHref } from '../src/ui/tools';
import { ART } from '../src/ui/art';
import type { ToolId } from '../src/state/data';
import type { PurchaseResult } from '../src/plus/purchases';

const PAID = TOOLS.filter(t => !t.free);

export default function Unlock() {
  const c = usePalette();
  const app = useApp();
  const tap = useTap();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const { width } = useWindowDimensions();
  const heroW = width - space.l * 2;
  const [price, setPrice] = useState<string | null>(null);
  const [priceState, setPriceState] = useState<'loading' | 'ready' | 'missing'>('loading');
  const [busy, setBusy] = useState<null | 'buy' | 'trial' | 'restore'>(null);

  const loadPrice = () => {
    setPriceState('loading');
    void app.purchases.price().then(p => { setPrice(p); setPriceState(p ? 'ready' : 'missing'); });
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(loadPrice, []);

  const done = (r: PurchaseResult, okText: string) => {
    if (r.ok) {
      tap('success');
      const tool = PAID.find(t => t.id === from);
      Alert.alert(okText, undefined, [{ text: 'OK', onPress: () => { router.back(); if (tool) setTimeout(() => router.push(toolHref(tool.id as ToolId)), 50); } }]);
    } else if (r.reason !== 'cancelled') {
      tap('warn');
      Alert.alert(r.reason === 'empty' ? 'Nothing to restore' : r.reason === 'pending' ? 'Waiting for approval' : 'Not completed', r.message);
    }
  };
  const run = async (kind: 'buy' | 'trial' | 'restore') => {
    if (busy) return;
    setBusy(kind);
    try {
      if (kind === 'buy') done(await app.buy(), 'Spigot is unlocked. Thanks!');
      else if (kind === 'trial') {
        const r = await app.startTrial();
        const start = r.ok ? r.access.trialStart : null;
        const ends = start !== null ? start + 7 * 86_400_000 : 0;
        const msg = start !== null && Date.now() - start > 120_000
          ? (ends > Date.now() ? `Your trial is already running: ${Math.ceil((ends - Date.now()) / 86_400_000)} days left` : `Your trial ended on ${new Date(ends).toLocaleDateString()}`)
          : 'Your 7-day free trial has started';
        done(r, msg);
      }
      else done(await app.restore(), 'Purchases restored');
    } finally { setBusy(null); }
  };

  const trialText = app.trial.active ? (app.trial.daysLeft === 1 ? 'Last day of your free trial.' : `${app.trial.daysLeft} days left in your free trial.`) : app.trial.started ? 'Your free trial has ended.' : null;

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Full Unlock', headerLeft: () => (
        <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={12} style={{ minHeight: 44, justifyContent: 'center' }}>
          <Text style={{ color: c.copper, fontSize: 17, fontWeight: '600' }}>Close</Text>
        </Pressable>
      ) }} />
      <View style={{ backgroundColor: c.panel, borderRadius: radius.l, overflow: 'hidden' }}>
        <Image source={ART.unlock} style={{ width: heroW, height: Math.round((heroW * 9) / 16) }} resizeMode="cover" accessible={false} />
        <View style={{ padding: space.l, gap: space.s }}>
          <Text style={{ fontFamily: font.displayHeavy, fontSize: 34, lineHeight: 36, color: c.vis }}>EVERY TOOL. ONE PAYMENT.</Text>
          <Text style={{ fontSize: 16, lineHeight: 22, color: c.onPanel2 }}>No subscription, no ads, no account. Offset, Fall and the Reference cards are free forever.</Text>
        </View>
      </View>

      {app.owned ? (
        <Card>
          <View style={{ flexDirection: 'row', gap: space.m, alignItems: 'center' }}>
            <Ionicons name="checkmark-circle" size={30} color={c.copper} />
            <Text style={{ flex: 1, fontFamily: font.display, fontSize: 24, color: c.ink }}>YOU HAVE FULL UNLOCK</Text>
          </View>
          <Body>Every tool is yours on this Apple Account. Thanks for supporting Spigot.</Body>
        </Card>
      ) : null}

      <Card>
        <Text style={{ fontFamily: font.display, fontSize: 20, color: c.ink3 }}>FULL UNLOCK ADDS</Text>
        {PAID.map(t => (
          <View key={t.id} style={{ flexDirection: 'row', gap: space.m, alignItems: 'flex-start' }}>
            <Ionicons name={t.icon} size={26} color={c.copper} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: c.ink }}>{t.title}</Text>
              <Text style={{ fontSize: 15, color: c.ink3 }}>{t.blurb}</Text>
            </View>
          </View>
        ))}
      </Card>

      {!app.owned ? (
        <View style={{ gap: space.m }}>
          {trialText ? <Body style={{ fontWeight: '700' }}>{trialText}</Body> : null}
          {!app.trial.started ? (
            <>
              <Button kind="secondary" icon="time-outline" label={busy === 'trial' ? 'Starting…' : 'Start free 7-day trial'} disabled={!!busy || priceState !== 'ready'} onPress={() => void run('trial')} />
              <Body muted style={{ fontSize: 14 }}>{`The trial is a free item from the App Store. It starts only when you confirm it with Apple, and nothing is charged when it ends. After 7 days, Cut length, Rolling offset, Volume & flow and Cut list lock until you buy Full Unlock${price ? ` for ${price}` : ''}, one time.`}</Body>
            </>
          ) : null}
          <Button icon="lock-open-outline" label={busy === 'buy' ? 'Opening the App Store…' : priceState === 'ready' ? `Unlock everything · ${price}` : 'Unlock everything'} disabled={!!busy || priceState !== 'ready'} onPress={() => void run('buy')} />
          {priceState === 'loading' ? <View style={{ flexDirection: 'row', gap: space.s, alignItems: 'center' }}><ActivityIndicator color={c.ink3} /><Body muted>Getting the price from the App Store…</Body></View> : null}
          {priceState === 'missing' ? (
            <View style={{ gap: space.s }}>
              <Body muted>Couldn’t reach the App Store to get the price. Check your connection.</Body>
              <Button kind="quiet" icon="refresh" label="Try again" onPress={loadPrice} />
            </View>
          ) : null}
          <Body muted style={{ fontSize: 14 }}>One-time purchase, not a subscription. Restore it free on your other iPhones.</Body>
        </View>
      ) : null}

      <Button kind="quiet" icon="refresh-circle-outline" label={busy === 'restore' ? 'Restoring…' : 'Restore purchases'} disabled={!!busy} onPress={() => void run('restore')} />
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: space.xl }}>
        <Pressable accessibilityRole="link" onPress={() => void Linking.openURL('https://merlinwerlin.github.io/App-Projects/spigot/privacy.html')} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: c.copper, fontSize: 15 }}>Privacy</Text></Pressable>
        <Pressable accessibilityRole="link" onPress={() => void Linking.openURL('https://www.apple.com/legal/internet-services/itunes/dev/stdeula/')} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: c.copper, fontSize: 15 }}>Terms of Use</Text></Pressable>
      </View>
    </Screen>
  );
}
