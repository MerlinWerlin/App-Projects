/** Paywall without dark patterns: what stays free first, one clear one-time price, restore, close always visible. */
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t, type MessageKey } from '../src/i18n';
import { success } from '../src/native/haptics';
import { PLUS_FALLBACK_PRICE } from '../src/plus/entitlement';
import { trialLabel } from '../src/plus/trial';
import { useApp } from '../src/state/AppState';
import { RADIUS } from '../src/theme/theme';
import { Btn, Txt, type IconName } from '../src/ui/kit';

const FEATURES: [IconName, MessageKey, MessageKey][] = [
  ['mic-outline', 'plus.f.voice', 'plus.f.voice.body'],
  ['text-outline', 'plus.f.captions', 'plus.f.captions.body'],
  ['color-palette-outline', 'plus.f.colors', 'plus.f.colors.body'],
  ['document-outline', 'plus.f.import', 'plus.f.import.body'],
  ['stats-chart-outline', 'plus.f.stats', 'plus.f.stats.body'],
];

export default function Plus() {
  const app = useApp();
  const { theme } = app;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [price, setPrice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const trial = app.tier === 'plus' ? null : trialLabel(app.trial);

  useEffect(() => {
    app.purchases.price().then(setPrice).catch(() => setPrice(null));
  }, [app.purchases]);

  const act = async (kind: 'buy' | 'restore') => {
    setBusy(true);
    const r = kind === 'buy' ? await app.buyPlus() : await app.restorePlus();
    setBusy(false);
    if (r.ok) {
      success(app.prefs.haptics);
      Alert.alert(t('plus.thanks'));
      router.back();
    } else if (r.reason !== 'cancelled') Alert.alert(r.message);
  };

  return (
    <ScrollView style={{ backgroundColor: theme.bg }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 30 }}>
      <View style={st.hero}>
        <View style={st.mark}>
          <LinearGradient colors={['#DDB063', '#C9973F', '#9C7028']} style={StyleSheet.absoluteFill} />
          <Ionicons name="sparkles" size={30} color="#1A1408" />
        </View>
        <Txt v="largeTitle" style={{ textAlign: 'center' }}>
          {t('plus.title')}
        </Txt>
        <Txt tone="sub" style={{ textAlign: 'center', maxWidth: 320 }}>
          {t('plus.lead')}
        </Txt>
        {trial ? (
          <View style={[st.trial, { backgroundColor: theme.accentWash }]} accessibilityRole="text">
            <Ionicons name="hourglass-outline" size={14} color={theme.accentText} />
            <Txt v="callout" tone="accent">
              {t(trial.key, { n: trial.n })}
            </Txt>
          </View>
        ) : null}
        {trial ? (
          <Txt v="caption" tone="sub" style={{ textAlign: 'center', maxWidth: 320 }}>
            {t('plus.trial.body')}
          </Txt>
        ) : null}
      </View>

      <View style={[st.card, { backgroundColor: theme.card, borderColor: theme.line }, theme.shadow]}>
        {FEATURES.map(([icon, title, body], i) => (
          <View key={title} style={[st.feat, i < FEATURES.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.line }]}>
            <View style={[st.featIcon, { backgroundColor: theme.accentWash }]}>
              <Ionicons name={icon} size={18} color={theme.accentText} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Txt v="headline">{t(title)}</Txt>
              <Txt v="callout" tone="sub">
                {t(body)}
              </Txt>
            </View>
          </View>
        ))}
      </View>

      <View style={[st.free, { borderColor: theme.line }]}>
        <Ionicons name="lock-open-outline" size={18} color={theme.sub} />
        <View style={{ flex: 1 }}>
          <Txt v="headline">{t('plus.free.title')}</Txt>
          <Txt v="callout" tone="sub">
            {t('plus.free.body')}
          </Txt>
        </View>
      </View>

      {app.tier === 'plus' ? (
        <Txt v="title" tone="accent" style={{ textAlign: 'center', marginTop: 24 }}>
          {t('plus.thanks')}
        </Txt>
      ) : (
        <View style={{ marginTop: 22, gap: 10 }}>
          <Btn label={t('plus.buy', { price: price ?? PLUS_FALLBACK_PRICE })} icon="sparkles" onPress={() => void act('buy')} disabled={busy} />
          <Txt v="caption" tone="faint" style={{ textAlign: 'center' }}>
            {t('plus.once')}
          </Txt>
          <Btn label={t('plus.restore')} kind="secondary" onPress={() => void act('restore')} disabled={busy} />
          {!app.purchases.available ? (
            <Txt v="caption" tone="sub" style={{ textAlign: 'center', marginTop: 4 }}>
              {t('plus.unavailable')}
            </Txt>
          ) : null}
        </View>
      )}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  hero: { alignItems: 'center', gap: 10, paddingTop: 12, paddingBottom: 24 },
  trial: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, marginTop: 4 },
  mark: { width: 76, height: 76, borderRadius: 26, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  card: { borderRadius: RADIUS.card, borderWidth: StyleSheet.hairlineWidth },
  feat: { flexDirection: 'row', gap: 14, alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  featIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  free: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginTop: 14, padding: 16, borderRadius: RADIUS.card, borderWidth: 1, borderStyle: 'dashed' },
});
