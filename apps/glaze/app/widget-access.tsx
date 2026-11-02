// owner-1102b T280 / T281: access for the Next event and Weather widgets. A widget can't show a
// permission prompt, so tapping either widget opens glaze://widget-access?kind=calendar|weather and
// this screen asks (only here, only after the user taps the button). Expo Go / Android / an older
// build: the bridge adapter returns 'unavailable' and the screen explains it; nothing crashes.
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useT } from '../src/i18n';
import { dataWidgetAccess, type DataWidgetAccess, type DataWidgetKind } from '../src/native/widgets';
import { spaceV2, textV2 } from '../src/theme/tokensV2';
import { useColorsV2 } from '../src/theme/useTokens';
import { textStyleFor } from '../src/ui/i18nLayout';
import { PillButton } from '../src/ui/PillButton';

export default function WidgetAccessScreen() {
  const { c } = useColorsV2();
  const { t, script } = useT();
  const params = useLocalSearchParams<{ kind?: string }>();
  const kind: DataWidgetKind = params.kind === 'weather' ? 'weather' : 'calendar';
  const [access, setAccess] = useState<DataWidgetAccess | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    setAccess(null);
    dataWidgetAccess(kind, false)
      .then((a) => {
        if (live) setAccess(a);
      })
      .catch(() => {
        if (live) setAccess('unavailable');
      });
    return () => {
      live = false;
    };
  }, [kind]);

  const ask = async () => {
    setBusy(true);
    try {
      setAccess(await dataWidgetAccess(kind, true));
    } finally {
      setBusy(false);
    }
  };

  const weather = kind === 'weather';
  const title = weather ? t('tabs.widgetAccess.weatherTitle') : t('tabs.widgetAccess.calendarTitle');
  const body = weather ? t('tabs.widgetAccess.weatherBody') : t('tabs.widgetAccess.calendarBody');
  const allow = weather ? t('tabs.widgetAccess.weatherAllow') : t('tabs.widgetAccess.calendarAllow');
  let status = '';
  if (access === 'granted') status = t('tabs.widgetAccess.granted');
  else if (access === 'denied' || access === 'restricted' || access === 'writeOnly') status = t('tabs.widgetAccess.denied');
  else if (access === 'unavailable') status = t('tabs.widgetAccess.unavailable');

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={[styles.root, { backgroundColor: c.bg }]}>
      <ScrollView bounces={false} overScrollMode="never" contentContainerStyle={styles.body}>
        <View style={styles.titleLine}>
          <Feather name={weather ? 'cloud' : 'calendar'} size={24} color={c.tint} />
          <Text style={[textV2.title2, textStyleFor(script, textV2.title2), styles.flex, { color: c.ink }]} accessibilityRole="header">
            {title}
          </Text>
        </View>
        <Text style={[textV2.body, textStyleFor(script, textV2.body), { color: c.ink }]}>{body}</Text>
        {status ? (
          <Text style={[textV2.callout, textStyleFor(script, textV2.callout), { color: c.inkSecondary }]} accessibilityLiveRegion="polite">
            {status}
          </Text>
        ) : null}
        {access === 'notDetermined' ? (
          <PillButton label={allow} icon={weather ? 'navigation' : 'calendar'} busy={busy} onPress={ask} block />
        ) : null}
        {access === 'denied' || access === 'restricted' || access === 'writeOnly' ? (
          <PillButton
            label={t('tabs.widgetAccess.openSettings')}
            icon="settings"
            variant="tinted"
            onPress={() => {
              Linking.openSettings().catch(() => {});
            }}
            block
          />
        ) : null}
        {weather ? (
          <Text
            style={[textV2.footnote, textStyleFor(script, textV2.footnote), { color: c.inkSecondary }]}
            onPress={() => {
              Linking.openURL('https://open-meteo.com/').catch(() => {});
            }}
            accessibilityRole="link"
          >
            {t('tabs.widgetAccess.credit')}
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { padding: spaceV2.lg, gap: spaceV2.lg, paddingBottom: spaceV2.xxl },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: spaceV2.sm },
  flex: { flex: 1 },
});
