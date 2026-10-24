/** Paywall without dark patterns: says what's free, one clear price, restore, close always visible. */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t, type MessageKey } from '../src/i18n';
import { success } from '../src/native/haptics';
import { useApp } from '../src/state/AppState';
import { Btn, type IconName } from '../src/ui/kit';

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
    <ScrollView style={{ backgroundColor: theme.bg }} contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 30 }}>
      <Text style={[st.lead, { color: theme.ink }]}>{t('plus.lead')}</Text>
      <Text style={[st.promise, { color: theme.sub }]}>{t('plus.promise')}</Text>
      {FEATURES.map(([icon, title, body]) => (
        <View key={title} style={[st.feat, { backgroundColor: theme.card, borderColor: theme.line }]}>
          <Ionicons name={icon} size={24} color={theme.accent} />
          <View style={{ flex: 1 }}>
            <Text style={[st.featTitle, { color: theme.ink }]}>{t(title)}</Text>
            <Text style={{ color: theme.sub, marginTop: 2 }}>{t(body)}</Text>
          </View>
        </View>
      ))}
      {app.tier === 'plus' ? (
        <Text style={[st.lead, { color: theme.accent, fontSize: 18, marginTop: 20 }]}>{t('plus.thanks')}</Text>
      ) : (
        <>
          <Btn label={price ? t('plus.buy', { price }) : t('plus.buyNoPrice')} onPress={() => void act('buy')} disabled={busy} style={{ marginTop: 20 }} />
          <Btn label={t('plus.restore')} kind="secondary" onPress={() => void act('restore')} disabled={busy} style={{ marginTop: 10 }} />
          {!app.purchases.available ? <Text style={{ color: theme.sub, marginTop: 12, textAlign: 'center' }}>{t('plus.unavailable')}</Text> : null}
        </>
      )}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  lead: { fontSize: 24, fontWeight: '800' },
  promise: { fontSize: 15, marginTop: 8, marginBottom: 14, lineHeight: 21 },
  feat: { flexDirection: 'row', gap: 14, alignItems: 'center', padding: 14, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, marginTop: 10 },
  featTitle: { fontSize: 16, fontWeight: '700' },
});
