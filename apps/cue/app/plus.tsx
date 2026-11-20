/** Paywall without dark patterns: what stays free first, one clear one-time price, restore, close always visible. */
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t, type MessageKey } from '../src/i18n';
import { success } from '../src/native/haptics';
import { trialLabel, trialState } from '../src/plus/trial';
import { useApp } from '../src/state/AppState';
import { RADIUS, SPACE } from '../src/theme/theme';
import { Btn, IconBtn, Row, Txt } from '../src/ui/kit';

const FEATURES: [MessageKey, MessageKey][] = [
  ['plus.f.voice', 'plus.f.voice.body'],
  ['plus.f.captions', 'plus.f.captions.body'],
  ['plus.f.colors', 'plus.f.colors.body'],
  ['plus.f.import', 'plus.f.import.body'],
  ['plus.f.stats', 'plus.f.stats.body'],
];

export default function Plus() {
  const app = useApp();
  const { theme } = app;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [price, setPrice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const working = useRef(false);
  const priceRequest = useRef(0);
  const trial = app.tier === 'plus' ? null : trialLabel(app.trial);
  const reloadPrice = useCallback(async () => {
    const request = ++priceRequest.current;
    const value = await app.purchases.price().catch(() => null);
    if (request === priceRequest.current) setPrice(value);
    return value;
  }, [app.purchases]);

  useEffect(() => {
    void reloadPrice();
    const listener = AppState.addEventListener('change', state => {
      if (state === 'active' && !working.current) void reloadPrice();
    });
    return () => { ++priceRequest.current; listener.remove(); };
  }, [reloadPrice]);

  const act = async (kind: 'buy' | 'restore' | 'trial') => {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    if (kind === 'buy') {
      const currentPrice = await reloadPrice();
      if (currentPrice === null || currentPrice !== price) {
        working.current = false;
        setBusy(false);
        Alert.alert(currentPrice ? t('plus.priceChanged', { price: currentPrice }) : t('plus.unavailable'));
        return;
      }
    }
    const r = kind === 'buy' ? await app.buyPlus() : kind === 'trial' ? await app.startTrial() : await app.restorePlus();
    working.current = false;
    setBusy(false);
    void reloadPrice();
    if (r.ok) {
      success(app.prefs.haptics);
      Alert.alert(t(r.access.plus ? 'plus.thanks' : trialState(r.access.trialStart, Date.now()).active ? 'plus.trial.started' : 'plus.trial.expired'));
      if (router.canGoBack()) router.back();
    } else if (r.reason !== 'cancelled') Alert.alert(r.message);
  };

  return (
    <ScrollView style={{ backgroundColor: theme.ground }} contentContainerStyle={{ paddingHorizontal: SPACE.gutter, paddingBottom: insets.bottom + SPACE.xl }}>
      <Stack.Screen
        options={{
          headerRight: () => (router.canGoBack() ? <IconBtn icon="close" label={t('plus.close')} onPress={() => router.back()} bg={theme.field} color={theme.ink2} size={20} /> : null),
        }}
      />
      <View style={st.hero}>
        <Txt v="largeTitle" accessibilityRole="header">
          {t('plus.title')}
        </Txt>
        <Txt tone="ink2">{t('plus.lead')}</Txt>
        {trial ? (
          <View style={st.trial} accessibilityRole="text">
            <View style={[st.dot, { backgroundColor: theme.standby }]} />
            <Txt v="subhead" tone="standby" style={{ fontWeight: '600' }}>
              {t(trial.key, { n: trial.n })}
            </Txt>
          </View>
        ) : null}
      </View>

      <View style={[st.group, { backgroundColor: theme.sheet }]}>
        {FEATURES.map(([title, body], i) => (
          <Row key={title} label={t(title)} sub={t(body)} last={i === FEATURES.length - 1} />
        ))}
      </View>

      <Txt v="footnote" tone="ink2" style={st.groupTitle} accessibilityRole="header">
        {t('plus.free.title')}
      </Txt>
      <View style={[st.group, st.free, { backgroundColor: theme.sheet }]}>
        <Txt v="subhead" tone="ink2">
          {t('plus.free.body')}
        </Txt>
      </View>

      {app.tier === 'plus' ? (
        <Txt v="headline" tone="go" style={{ textAlign: 'center', marginTop: SPACE.lg }}>
          {t('plus.thanks')}
        </Txt>
      ) : (
        <View style={{ marginTop: SPACE.lg, gap: SPACE.xs + 2 }}>
          {/* Sits above the buttons: the copy says "at the price shown below". */}
          <Txt v="footnote" tone="ink2" style={{ marginBottom: SPACE.xxs }}>
            {t('plus.trial.body')}
          </Txt>
          {!app.trial.started ? <Btn label={t('plus.trial.start')} kind="plain" onPress={() => void act('trial')} disabled={busy || (Platform.OS !== 'android' && price === null)} /> : null}
          <Btn label={price ? t('plus.buy', { price }) : t('plus.buyNoPrice')} onPress={() => void act('buy')} disabled={busy} />
          {price === null ? <Btn label={t('plus.reloadPrice')} kind="plain" onPress={() => void reloadPrice()} disabled={busy} /> : null}
          <Txt v="caption" tone="ink3" style={{ textAlign: 'center' }}>
            {t('plus.once')}
          </Txt>
        </View>
      )}
      <View style={{ marginTop: SPACE.xs + 2 }}>
        <Btn label={t('plus.restore')} kind="plain" onPress={() => void act('restore')} disabled={busy} />
      </View>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  hero: { gap: SPACE.xs, paddingTop: SPACE.xxs, paddingBottom: SPACE.lg, paddingHorizontal: SPACE.xxs },
  trial: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, marginTop: SPACE.xxs },
  dot: { width: 8, height: 8, borderRadius: 4 },
  group: { borderRadius: RADIUS.group, overflow: 'hidden' },
  groupTitle: { marginTop: SPACE.lg + 4, marginBottom: 6, marginLeft: SPACE.md },
  free: { paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm },
});
