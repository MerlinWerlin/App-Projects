/**
 * Full Unlock: what stays free first, one clear one-time price, the free trial, Restore, and a close that is
 * always visible. Purchase logic lives in src/plus (adapted from Cue's reviewed flow).
 */
import { Icon } from '../src/ui/Icon.tsx';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { trialState } from '../src/plus/trial.ts';
import { useApp } from '../src/state/AppState.tsx';
import { Glyph } from '../src/ui/Glyph.tsx';
import { Btn, Txt } from '../src/ui/kit.tsx';
import { C, RADIUS, SPACE } from '../src/ui/theme.ts';
import type { ToolId } from '../src/plus/entitlement.ts';

const UNLOCKS: { tool: ToolId; title: string; body: string }[] = [
  { tool: 'saddle', title: 'Saddle cuts', body: 'Fishmouth templates for any angle, size and offset, printed true scale.' },
  { tool: 'lobster', title: 'Lobster-backs', body: 'Segmented bends with every length and a wrap template.' },
  { tool: 'cutlist', title: 'Cut lists', body: 'Fewest stock lengths, kerf and trim counted.' },
  { tool: 'weld', title: 'Weld metal', body: 'Wire and rods for fillet and butt welds.' },
  { tool: 'pcd', title: 'Printable templates and saved jobs', body: 'Drilling and cutting templates, and jobs you can come back to.' },
];

export default function Unlock() {
  const app = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [price, setPrice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const working = useRef(false);
  const req = useRef(0);

  const reloadPrice = useCallback(async () => {
    const id = ++req.current;
    const p = await app.purchases.price().catch(() => null);
    if (id === req.current) setPrice(p);
    return p;
  }, [app.purchases]);

  useEffect(() => {
    void reloadPrice();
    const sub = AppState.addEventListener('change', s => { if (s === 'active' && !working.current) void reloadPrice(); });
    return () => { ++req.current; sub.remove(); };
  }, [reloadPrice]);

  const act = async (kind: 'buy' | 'trial' | 'restore') => {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    const r = kind === 'buy' ? await app.buy() : kind === 'trial' ? await app.startTrial() : await app.restore();
    working.current = false;
    setBusy(false);
    void reloadPrice();
    if (r.ok) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      const msg = r.access.plus ? 'Rootpass is unlocked for good. Thank you!' : trialState(r.access.trialStart, Date.now()).active ? 'Your free 7-day trial has started. Everything is open.' : 'Your free trial has already ended. Full Unlock keeps everything open.';
      Alert.alert(r.access.plus ? 'Unlocked' : 'Trial', msg);
      if (r.access.plus || trialState(r.access.trialStart, Date.now()).active) router.back();
    } else if (r.reason !== 'cancelled') Alert.alert('Not unlocked', r.message);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.ground }}>
      <ScrollView contentContainerStyle={{ padding: SPACE.gutter, paddingTop: SPACE.xl, paddingBottom: insets.bottom + SPACE.xl, gap: SPACE.lg }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Txt v="display" accessibilityRole="header" style={{ flex: 1 }}>Full Unlock</Txt>
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} style={{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: C.raised }}>
            <Icon name="close" size={26} color={C.ink} />
          </Pressable>
        </View>
        <Txt v="body" tone="ink2">One payment, yours for good. No subscription, no account, no ads.</Txt>
        {app.trial.active && !app.owned ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, backgroundColor: C.accentDim, padding: SPACE.md, borderRadius: RADIUS.md }}>
            <Icon name="time" size={20} color={C.accent} />
            <Txt v="headline" tone="accent">Free trial: {app.trial.daysLeft} day{app.trial.daysLeft === 1 ? '' : 's'} left</Txt>
          </View>
        ) : null}

        <View style={{ backgroundColor: C.surface, borderRadius: RADIUS.lg, padding: SPACE.lg, gap: SPACE.lg }}>
          {UNLOCKS.map(u => (
            <View key={u.title} style={{ flexDirection: 'row', gap: SPACE.md, alignItems: 'center' }}>
              <Glyph tool={u.tool} size={40} />
              <View style={{ flex: 1 }}>
                <Txt v="headline">{u.title}</Txt>
                <Txt v="small" tone="ink2">{u.body}</Txt>
              </View>
            </View>
          ))}
        </View>
        <View style={{ gap: 4 }}>
          <Txt v="label" tone="ink3">Free for ever</Txt>
          <Txt v="body" tone="ink2">Steel weight, frame mitres, sheet bending and bolt-circle coordinates.</Txt>
        </View>

        {app.owned ? (
          <Txt v="title" tone="accent">Unlocked. Thank you!</Txt>
        ) : (
          <View style={{ gap: SPACE.sm }}>
            <Btn label={price ? `Unlock for ${price}` : 'Unlock'} icon="flash" onPress={() => void act('buy')} disabled={busy} />
            {!app.trial.started ? <Btn kind="secondary" label="Start free 7-day trial" onPress={() => void act('trial')} disabled={busy || price === null} /> : null}
            {price === null ? <Btn kind="plain" label="Load the price again" onPress={() => void reloadPrice()} disabled={busy} /> : null}
            <Txt v="small" tone="ink3" style={{ textAlign: 'center' }}>
              The trial is a free item from the App Store that you start yourself. It ends after 7 days and never charges you. Full Unlock is a single payment, not a subscription.
            </Txt>
          </View>
        )}
        <Btn kind="plain" label="Restore purchase" onPress={() => void act('restore')} disabled={busy} />
      </ScrollView>
    </View>
  );
}
