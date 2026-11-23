/**
 * Full Unlock: what stays free, what unlocks, one clear one-time price, the user-started free trial, Restore,
 * and a close button that's always visible. No dark patterns.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { success } from '../src/native/haptics.ts';
import { trialDaysText, trialState } from '../src/plus/trial.ts';
import { useApp } from '../src/state/AppState.tsx';
import { PHASE, RADIUS, SPACE } from '../src/theme/theme.ts';
import { Btn, Card, IconBtn, Stripe, Txt } from '../src/ui/kit.tsx';

type Icon = keyof typeof Ionicons.glyphMap;
const PAID: [Icon, string, string][] = [
  ['git-merge', 'Saddles, kicks and stub-ups', '3- and 4-point saddles, kicks, 90° stubs with take-up and gain'],
  ['trending-down', 'Voltage drop', 'mV/A·m method or from conductor size, 1φ and 3φ, smallest size that passes'],
  ['ellipse', 'Conduit fill', 'Mixed cables, guide limits, max count and jam-ratio check'],
  ['git-network', 'Cable runs & drums', 'What to order and a cut plan that keeps offcuts small'],
  ['folder-open', 'Jobs', 'Save any result to a job and share it'],
];

export default function Unlock() {
  const app = useApp();
  const { theme } = app;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [price, setPrice] = useState<string | null>(null);
  const [priceLoaded, setPriceLoaded] = useState(false);
  const [busy, setBusy] = useState<null | 'buy' | 'trial' | 'restore'>(null);
  const working = useRef(false);
  const reqId = useRef(0);
  const days = app.tier === 'full' ? null : trialDaysText(app.trial);

  const loadPrice = useCallback(async () => {
    const id = ++reqId.current;
    const p = await app.purchases.price().catch(() => null);
    if (id === reqId.current) { setPrice(p); setPriceLoaded(true); }
    return p;
  }, [app.purchases]);

  useEffect(() => {
    void loadPrice();
    const sub = AppState.addEventListener('change', s => { if (s === 'active' && !working.current) void loadPrice(); });
    return () => { ++reqId.current; sub.remove(); };
  }, [loadPrice]);

  const act = async (kind: 'buy' | 'trial' | 'restore') => {
    if (working.current) return;
    working.current = true;
    setBusy(kind);
    const r = kind === 'buy' ? await app.buy() : kind === 'trial' ? await app.startTrial() : await app.restore();
    working.current = false;
    setBusy(null);
    if (r.ok) {
      success(app.prefs.haptics);
      const trialOn = trialState(r.access.trialStart, Date.now()).active;
      Alert.alert(r.access.plus ? 'Unlocked. Thank you!' : trialOn ? 'Your 7-day trial has started' : 'Your trial has already ended',
        r.access.plus ? 'Every calculator is yours for good.' : trialOn ? 'Every calculator is open for 7 days. Nothing is charged when it ends.' : 'The Full Unlock keeps every calculator open.');
      if (r.access.plus || trialOn) router.back();
    } else if (r.reason !== 'cancelled') {
      Alert.alert(r.reason === 'empty' ? 'Nothing to restore' : 'Not completed', r.message);
    }
  };

  const showTrial = app.tier !== 'full' && !app.trial.started;
  return (
    <View style={{ flex: 1, backgroundColor: theme.ground }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + SPACE.xl }}>
        <View style={[st.band, { backgroundColor: theme.accent, paddingTop: insets.top + SPACE.lg }]}>
          <View style={[st.close, { top: insets.top + SPACE.xs }]}><IconBtn icon="close" label="Close" onPress={() => router.back()} /></View>
          <Stripe width={72} />
          <Txt v="largeTitle" tone="onAccent" accessibilityRole="header" maxFontSizeMultiplier={1.5}>Wattle Full Unlock</Txt>
          <Txt v="title" tone="onAccent" maxFontSizeMultiplier={1.5}>Every calculator, one payment. No subscription.</Txt>
          {days ? <View style={[st.pill, { backgroundColor: theme.onAccent }]}><Txt v="headline" style={{ color: theme.accent }}>{days}</Txt></View> : null}
        </View>
        <View style={{ padding: SPACE.md, gap: SPACE.md }}>
          <Card pad={false} style={{ paddingHorizontal: SPACE.md }}>
            {PAID.map(([icon, title, sub], i) => (
              <View key={title} style={[st.row, i < PAID.length - 1 && { borderBottomColor: theme.line, borderBottomWidth: StyleSheet.hairlineWidth * (theme.rule > 1 ? 3 : 1) }]}>
                <View style={[st.icon, { backgroundColor: i % 3 === 0 ? PHASE.active : i % 3 === 1 ? PHASE.neutral : PHASE.earth }]}><Ionicons name={icon} size={20} color="#FFFFFF" /></View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt v="headline">{title}</Txt>
                  <Txt v="footnote" tone="ink2">{sub}</Txt>
                </View>
              </View>
            ))}
          </Card>
          <Card style={{ gap: 4 }}>
            <Txt v="headline">Free for everyone</Txt>
            <Txt v="subhead" tone="ink2">Offsets, Ohm’s law, single- and three-phase power, and the unit converter.</Txt>
          </Card>
          {app.tier === 'full' ? (
            <Card style={{ alignItems: 'center', gap: SPACE.xs }}>
              <Ionicons name="checkmark-circle" size={40} color={theme.pass} />
              <Txt v="title">You have the Full Unlock</Txt>
            </Card>
          ) : (
            <View style={{ gap: SPACE.sm }}>
              {showTrial ? (
                <>
                  <Btn title={busy === 'trial' ? 'Starting…' : 'Start free 7-day trial'} icon="flash" onPress={() => void act('trial')} disabled={!!busy} />
                  <Txt v="footnote" tone="ink2" style={{ textAlign: 'center' }}>Apple asks you to confirm a free item. Nothing is charged, now or when the trial ends.</Txt>
                </>
              ) : null}
              <Btn
                title={busy === 'buy' ? 'Opening the App Store…' : price ? `Unlock for ${price}` : priceLoaded ? 'Price unavailable' : 'Loading price…'}
                kind={showTrial ? 'secondary' : 'primary'}
                icon="lock-open"
                onPress={() => void act('buy')}
                disabled={!!busy || !price}
              />
              <Txt v="footnote" tone="ink2" style={{ textAlign: 'center' }}>One-time purchase, charged to your Apple Account. Yours on every iPhone signed in to it.</Txt>
              {!price && priceLoaded ? <Btn title="Try again" kind="quiet" icon="refresh" onPress={() => void loadPrice()} /> : null}
              {busy ? <ActivityIndicator color={theme.ink} /> : null}
            </View>
          )}
          <Btn title={busy === 'restore' ? 'Restoring…' : 'Restore purchase'} kind="quiet" onPress={() => void act('restore')} disabled={!!busy} />
          <Txt v="footnote" tone="ink2" style={{ textAlign: 'center' }}>No account, no ads, no tracking. Your jobs stay on this iPhone.</Txt>
        </View>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  band: { paddingHorizontal: SPACE.md, paddingBottom: SPACE.lg, gap: SPACE.xs, borderBottomLeftRadius: RADIUS.lg, borderBottomRightRadius: RADIUS.lg },
  close: { position: 'absolute', right: SPACE.md, zIndex: 2 },
  pill: { alignSelf: 'flex-start', borderRadius: RADIUS.pill, paddingHorizontal: SPACE.sm, paddingVertical: 6, marginTop: SPACE.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, paddingVertical: SPACE.sm, minHeight: 64 },
  icon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
