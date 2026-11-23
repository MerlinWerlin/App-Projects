/**
 * Paywall without dark patterns: what's free, what the unlock adds, one clear one-time price, the free trial
 * (a free non-consumable the person starts, Guideline 3.1.1), Restore on the same screen, close always visible.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { trialState } from '../src/plus/trial';
import { useApp } from '../src/state/AppState';
import { SPACE, TYPE } from '../src/theme/theme';
import { Btn, Card, tap, Txt } from '../src/ui/kit';

export default function Unlock() {
  const app = useApp();
  const { theme, country } = app;
  const w = country.terms;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [price, setPrice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const working = useRef(false);
  const req = useRef(0);
  const reload = useCallback(async () => {
    const n = ++req.current;
    const v = await app.purchases.price().catch(() => null);
    if (n === req.current) setPrice(v);
    return v;
  }, [app.purchases]);
  useEffect(() => {
    void reload();
    const sub = AppState.addEventListener('change', s => { if (s === 'active' && !working.current) void reload(); });
    return () => { ++req.current; sub.remove(); };
  }, [reload]);

  const act = async (kind: 'buy' | 'trial' | 'restore') => {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    if (kind === 'buy') {
      const now = await reload();
      if (now === null || now !== price) {
        working.current = false;
        setBusy(false);
        Alert.alert(now ? `The current price is ${now}. Tap Unlock again to continue.` : 'The App Store is unavailable right now. Nothing was charged. Please try again when connected. [E_STORE_UNAVAILABLE]');
        return;
      }
    }
    const r = kind === 'buy' ? await app.buy() : kind === 'trial' ? await app.startTrial() : await app.restore();
    working.current = false;
    setBusy(false);
    void reload();
    if (r.ok) {
      tap(app.prefs.haptics, 'success');
      Alert.alert(r.access.plus ? 'Eaveline is unlocked. Thank you!' : trialState(r.access.trialStart, Date.now()).active ? 'Your 7-day free trial has started.' : 'Your free trial has already ended. The pitch tools and gutter fall are still free.');
      if (router.canGoBack()) router.back();
    } else if (r.reason !== 'cancelled') Alert.alert(r.message);
  };

  const FEATURES: [keyof typeof Ionicons.glyphMap, string, string][] = [
    ['home-outline', 'Roof area, rafters, hips and valleys', 'Gable, hip and skillion, with every step shown'],
    ['reorder-four-outline', 'Sheet counts and cut lists', `From ${country.guided ? `${country.name}’s` : 'your'} profiles, with laps and hip cuts`],
    ['apps-outline', `Tiles, slates and ${w.battens}`, 'Even gauge, courses and capping'],
    ['analytics-outline', 'Flashings and cappings', `${cap(w.ridge)}, hips, ${w.barge}s and ${w.valley}s in stock lengths`],
    ['rainy-outline', `${cap(w.downpipes)} estimate`, 'By the local method and rainfall'],
    ['construct-outline', 'Fixings', 'Screws, clips and nails by the box'],
    ['folder-open-outline', 'Saved jobs', 'Keep results per job and share a job sheet'],
  ];
  return (
    <ScrollView style={{ backgroundColor: theme.ground }} contentContainerStyle={{ paddingBottom: insets.bottom + SPACE.xl }}>
      <View style={[st.band, { backgroundColor: theme.accent }]}>
        {router.canGoBack() ? (
          <Pressable testID="unlock-close" accessibilityRole="button" accessibilityLabel="Close" onPress={() => router.back()} hitSlop={10} style={[st.close, { backgroundColor: theme.onAccent }]}>
            <Ionicons name="close" size={24} color={theme.accent} />
          </Pressable>
        ) : null}
        <Text style={[TYPE.display, { color: theme.onAccent }]} accessibilityRole="header" maxFontSizeMultiplier={1.4}>Eaveline Full Unlock</Text>
        <Text style={[TYPE.title2, { color: theme.onAccent }]} maxFontSizeMultiplier={1.5}>Pay once. Every calculator, for good. No subscription.</Text>
        {app.trial.active && !app.owned ? <Text style={[TYPE.headline, { color: theme.onAccent }]}>Free trial: {app.trial.daysLeft} day{app.trial.daysLeft === 1 ? '' : 's'} left</Text> : null}
      </View>
      <View style={{ padding: SPACE.gutter, gap: SPACE.md }}>
        <Card style={{ paddingVertical: SPACE.xs }}>
          {FEATURES.map(([icon, title, sub]) => (
            <View key={title} style={st.feature}>
              <Ionicons name={icon} size={26} color={theme.ink} />
              <View style={{ flex: 1 }}>
                <Txt v="headline">{title}</Txt>
                <Txt v="footnote" tone="ink2">{sub}</Txt>
              </View>
            </View>
          ))}
        </Card>
        <Card style={{ gap: SPACE.xxs }}>
          <Txt v="headline">Always free</Txt>
          <Txt v="subhead" tone="ink2">Pitch from rise and run, the phone level, the pitch converter, {w.gutter} fall, the safety card and every source.</Txt>
        </Card>
        {app.owned ? (
          <Txt v="title2">Unlocked. Thank you!</Txt>
        ) : (
          <View style={{ gap: SPACE.sm }}>
            <Txt v="footnote" tone="ink2">The free 7-day trial opens every calculator. When it ends, the unlock is a separate one-time purchase at the price below; nothing is charged automatically.</Txt>
            {!app.trial.started ? <Btn testID="start-trial" label="Start 7-day free trial" kind="ink" onPress={() => void act('trial')} disabled={busy || price === null} /> : null}
            {!app.trial.started && price ? <Txt v="footnote" tone="ink2" style={{ textAlign: 'center' }}>After the trial, Full Unlock is a one-time purchase of {price}.</Txt> : null}
            <Btn testID="buy-unlock" label={price ? `Unlock for ${price}` : 'Unlock'} onPress={() => void act('buy')} disabled={busy} />
            {price === null ? <Btn label="Load App Store price" kind="plain" onPress={() => void reload()} disabled={busy} /> : null}
            <Txt v="footnote" tone="ink3" style={{ textAlign: 'center' }}>One payment. Family Sharing included.</Txt>
          </View>
        )}
        <Btn testID="restore" label="Restore purchases" kind="plain" onPress={() => void act('restore')} disabled={busy} />
      </View>
    </ScrollView>
  );
}

const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);

const st = StyleSheet.create({
  band: { paddingHorizontal: SPACE.gutter, paddingTop: SPACE.xxl + SPACE.sm, paddingBottom: SPACE.lg, gap: SPACE.sm },
  close: { position: 'absolute', top: SPACE.md, right: SPACE.md, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  feature: { flexDirection: 'row', gap: SPACE.sm, alignItems: 'center', paddingVertical: SPACE.xs, minHeight: 52 },
});
