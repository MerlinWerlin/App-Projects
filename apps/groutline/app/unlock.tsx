/**
 * Full Unlock. What's free first, one clear one-time price, a user-started free 7-day trial (separate free
 * non-consumable, guideline 3.1.1), Restore on the same screen, and Close always visible.
 */
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { trialState } from '../src/plus/trial.ts';
import { useApp } from '../src/state/AppState.tsx';
import { RADIUS, SPACE, useTheme } from '../src/theme/theme.ts';
import { plural } from '../src/ui/fields.tsx';
import { GroutMark } from '../src/ui/GroutMark.tsx';
import { Btn, haptic, Txt } from '../src/ui/kit.tsx';
import { Icon, type IconName } from '../src/ui/Icon.tsx';

const FEATURES: Array<[IconName, string, string]> = [
  ['setout', 'Set-out', 'Centre the grid, avoid slivers, see the plan'],
  ['materials', 'Grout, adhesive & membrane', 'Bags and packs from your local products'],
  ['falls', 'Falls to the waste', 'Perimeter heights checked against your code'],
  ['trim', 'Trim & edging', 'Lengths to buy with a cut list'],
  ['stairs', 'Stairs & steps', 'Treads, risers, nosings and the riser check'],
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
      haptic(app.prefs.haptics, 'success');
      const trialOn = trialState(r.access.trialStart, Date.now()).active;
      Alert.alert(r.access.plus ? 'Every tool is unlocked. Thanks!' : trialOn ? 'Your free week has started. Every tool is open for 7 days.' : 'Your free trial has already been used on this Apple Account.');
      if (r.access.plus || trialOn) { if (router.canGoBack()) router.back(); }
    } else if (r.reason !== 'cancelled') Alert.alert(r.message);
  };

  const trialLeft = app.trial.active && !app.owned ? `Free trial: ${app.trial.daysLeft} day${app.trial.daysLeft === 1 ? '' : 's'} left` : null;
  const offerTrial = !app.trial.started;
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  return (
    <View style={{ flex: 1, backgroundColor: t.ground }}>
      <ScrollView contentContainerStyle={{ paddingBottom: SPACE.lg }}>
        <View style={{ backgroundColor: t.accent, paddingHorizontal: SPACE.gutter, paddingTop: SPACE.xl, paddingBottom: SPACE.md, flexDirection: 'row', alignItems: 'flex-end', gap: SPACE.sm }}>
          <View style={{ flex: 1, gap: 4 }}>
            <GroutMark size={44} />
            <Txt v="large" style={{ color: t.onAccent, marginTop: SPACE.xs }} accessibilityRole="header">Full Unlock</Txt>
            <Txt v="headline" style={{ color: t.onAccent }}>{trialLeft ?? 'Every tool on the job. One payment, yours for good.'}</Txt>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={close} hitSlop={8}
            style={{ position: 'absolute', top: SPACE.md, right: SPACE.md, width: 44, height: 44, borderRadius: 22, backgroundColor: t.onAccent, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="close" size={18} color={t.accent} />
          </Pressable>
        </View>
        <View style={{ paddingHorizontal: SPACE.gutter, paddingTop: SPACE.lg }}>
          <View style={{ backgroundColor: t.sheet, borderRadius: RADIUS.card, overflow: 'hidden' }}>
            {FEATURES.map(([icon, title, sub], i) => (
              <View key={title} style={{ flexDirection: 'row', gap: SPACE.sm, alignItems: 'center', paddingLeft: SPACE.md }}>
                <Icon name={icon} size={20} color={t.ink} />
                <View style={{ flex: 1, paddingVertical: SPACE.sm, paddingRight: SPACE.md, borderBottomWidth: i < FEATURES.length - 1 ? StyleSheet.hairlineWidth : 0, borderBottomColor: t.line }}>
                  <Txt v="headline">{title}</Txt>
                  <Txt v="subhead" tone="ink2">{sub}</Txt>
                </View>
              </View>
            ))}
          </View>
          <Txt v="subhead" tone="ink2" style={{ marginTop: SPACE.sm }}>{`Always free: Tiles & boxes (counts, cut-outs, waste by layout, ${plural(app.country.terms.box, 2)} to buy) and saving those jobs.`}</Txt>
        </View>
      </ScrollView>
      <View style={{ paddingHorizontal: SPACE.gutter, paddingTop: SPACE.sm, paddingBottom: insets.bottom + SPACE.xs, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.line, backgroundColor: t.ground, gap: SPACE.xs }}>
        {app.owned ? (
          <Txt v="title2" style={{ textAlign: 'center', paddingVertical: SPACE.sm }}>Every tool is unlocked. Thanks!</Txt>
        ) : (
          <>
            {offerTrial
              ? <Btn label="Start free 7-day trial" onPress={() => void act('trial')} disabled={busy || (Platform.OS === 'ios' && price === null)} />
              : <Btn label={price ? `Unlock for ${price}` : 'Unlock'} icon="unlock" onPress={() => void act('buy')} disabled={busy} />}
            {offerTrial ? <Btn kind="plain" label={price ? `Unlock now for ${price}` : 'Unlock now'} onPress={() => void act('buy')} disabled={busy} /> : null}
            {price === null ? <Btn kind="text" label="Load the price again" onPress={() => void reloadPrice()} disabled={busy} /> : null}
          </>
        )}
        <Btn kind="text" label="Restore purchases" onPress={() => void act('restore')} disabled={busy} />
        {!app.owned ? (
          <Txt v="footnote" tone="ink2" style={{ textAlign: 'center' }}>
            {offerTrial
              ? 'The trial starts only when you confirm the free item with Apple, and nothing is charged when it ends. Full Unlock is a single payment at the price shown, not a subscription.'
              : 'One payment at the price shown. Not a subscription. No ads.'}
          </Txt>
        ) : null}
      </View>
    </View>
  );
}
