/**
 * Full Unlock. What's free first, one clear one-time price, a user-started free 7-day trial (separate free
 * non-consumable, guideline 3.1.1), Restore on the same screen, and Close always visible.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { trialState } from '../src/plus/trial.ts';
import { useApp } from '../src/state/AppState.tsx';
import { RADIUS, SPACE, useTheme } from '../src/theme/theme.ts';
import { plural } from '../src/ui/fields.tsx';
import { GroutMark } from '../src/ui/GroutMark.tsx';
import { Btn, haptic, Txt } from '../src/ui/kit.tsx';

const FEATURES: Array<[keyof typeof Ionicons.glyphMap, string, string]> = [
  ['scan-outline', 'Set-out', 'Centre the grid, avoid slivers, see the plan'],
  ['flask-outline', 'Grout, adhesive & membrane', 'Bags and packs from your local products'],
  ['water-outline', 'Falls to the waste', 'Perimeter heights checked against your code'],
  ['swap-horizontal-outline', 'Trim & edging', 'Lengths to buy with a cut list'],
  ['trending-up-outline', 'Stairs & steps', 'Treads, risers, nosings and the riser check'],
];

export default function Unlock() {
  const app = useApp();
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [price, setPrice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const working = useRef(false);
  const priceReq = useRef(0);
  const reloadPrice = useCallback(async () => {
    const id = ++priceReq.current;
    const v = await app.purchases.price().catch(() => null);
    if (id === priceReq.current) setPrice(v);
    return v;
  }, [app.purchases]);
  useEffect(() => {
    void reloadPrice();
    const sub = AppState.addEventListener('change', st => { if (st === 'active' && !working.current) void reloadPrice(); });
    return () => { ++priceReq.current; sub.remove(); };
  }, [reloadPrice]);

  const act = async (kind: 'buy' | 'trial' | 'restore') => {
    if (working.current) return;
    working.current = true; setBusy(true);
    if (kind === 'buy') {
      const now = await reloadPrice();
      if (now === null || now !== price) {
        working.current = false; setBusy(false);
        Alert.alert(now ? `The price is now ${now}. Tap again to buy at that price.` : 'The App Store is unavailable right now. Nothing was charged.');
        return;
      }
    }
    const r = kind === 'buy' ? await app.buy() : kind === 'trial' ? await app.startTrial() : await app.restore();
    working.current = false; setBusy(false);
    void reloadPrice();
    if (r.ok) {
      haptic(app.prefs.haptics);
      const trialOn = trialState(r.access.trialStart, Date.now()).active;
      Alert.alert(r.access.plus ? 'Every tool is unlocked. Thanks!' : trialOn ? 'Your free week has started. Every tool is open for 7 days.' : 'Your free trial has already been used on this Apple Account.');
      if (r.access.plus || trialOn) { if (router.canGoBack()) router.back(); }
    } else if (r.reason !== 'cancelled') Alert.alert(r.message);
  };

  const trialLeft = app.trial.active && !app.owned ? `Free trial: ${app.trial.daysLeft} day${app.trial.daysLeft === 1 ? '' : 's'} left` : null;
  return (
    <View style={{ flex: 1, backgroundColor: t.ground }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + SPACE.xl }}>
        <View style={{ backgroundColor: t.accent, paddingHorizontal: SPACE.gutter, paddingTop: SPACE.xxl, paddingBottom: SPACE.lg, gap: SPACE.sm }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            style={{ position: 'absolute', top: SPACE.md, right: SPACE.md, width: 44, height: 44, borderRadius: 22, backgroundColor: t.onAccent, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="close" size={24} color={t.accent} />
          </Pressable>
          <GroutMark size={52} />
          <Txt v="large" style={{ color: t.onAccent }} accessibilityRole="header">Full Unlock</Txt>
          <Txt v="title2" style={{ color: t.onAccent }}>Every tool on the job. One payment, yours for good.</Txt>
          {trialLeft ? <Txt v="headline" style={{ color: t.onAccent }}>{trialLeft}</Txt> : null}
        </View>
        <View style={{ paddingHorizontal: SPACE.gutter, paddingTop: SPACE.lg, gap: SPACE.xs }}>
          {FEATURES.map(([icon, title, sub]) => (
            <View key={title} style={{ flexDirection: 'row', gap: SPACE.sm, alignItems: 'center', backgroundColor: t.sheet, borderRadius: RADIUS.field, padding: SPACE.sm }}>
              <Ionicons name={icon} size={26} color={t.ink} />
              <View style={{ flex: 1 }}><Txt v="headline">{title}</Txt><Txt v="subhead" tone="ink2">{sub}</Txt></View>
            </View>
          ))}
          <Txt v="subhead" tone="ink2" style={{ marginTop: SPACE.sm }}>{`Always free: Tiles & boxes (counts, cut-outs, waste by layout, ${plural(app.country.terms.box, 2)} to buy) and saving those jobs.`}</Txt>

          {app.owned ? (
            <Txt v="title2" style={{ marginTop: SPACE.lg }}>Every tool is unlocked. Thanks!</Txt>
          ) : (
            <View style={{ marginTop: SPACE.lg, gap: SPACE.xs }}>
              <Txt v="footnote" tone="ink2">
                {app.trial.started
                  ? 'Full Unlock is a single payment at the price shown below. It is not a subscription.'
                  : 'The free 7-day trial starts only when you confirm the free trial item with Apple. Nothing is charged when it ends. After that, Full Unlock is a single payment at the price shown below, not a subscription.'}
              </Txt>
              {!app.trial.started ? <Btn label="Start free 7-day trial" kind="ink" onPress={() => void act('trial')} disabled={busy || (Platform.OS === 'ios' && price === null)} /> : null}
              <Btn label={price ? `Unlock for ${price}` : 'Unlock'} onPress={() => void act('buy')} disabled={busy} icon="lock-open" />
              {price === null ? <Btn label="Load price again" kind="plain" onPress={() => void reloadPrice()} disabled={busy} /> : null}
              <Txt v="footnote" tone="ink3" style={{ textAlign: 'center' }}>One-time purchase. No subscription. No ads.</Txt>
            </View>
          )}
          <Btn label="Restore purchases" kind="plain" onPress={() => void act('restore')} disabled={busy} style={{ marginTop: SPACE.xs }} />
        </View>
      </ScrollView>
    </View>
  );
}
