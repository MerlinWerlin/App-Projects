// Low-battery essentials (T07, docs/spec/FLOWS.md §9): pure black, white text, no animation, no map. Next ticket,
// hotel address card and emergency card (EssentialsSlot), the manual "keep on" switch, and Exit at the bottom.
// Opened only by the user (home banner or the Essentials button); never auto-navigated to.
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DEFAULT_ESSENTIALS, ESSENTIALS_KEY, normalisePrefs, type EssentialsPrefs } from '../src/core/battery.ts';
import { useBattery } from '../src/native/battery.ts';
import { useApp } from '../src/state/app.tsx';
import { usePersisted } from '../src/state/persisted.ts';
import { essentials, fonts, radius, space, TOUCH } from '../src/theme/tokens.ts';
import { EssentialsButton, EssentialsSlot } from '../src/ui/slots/EssentialsSlot.tsx';

export default function EssentialsScreen() {
  const { t } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reading = useBattery();
  const [stored, setStored] = usePersisted<EssentialsPrefs>(ESSENTIALS_KEY, DEFAULT_ESSENTIALS);
  const prefs = normalisePrefs(stored);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const toggleManual = () => {
    const manual = !prefs.manual;
    setStored((old) => ({ ...normalisePrefs(old), manual }));
    // Spec §9.1: switching manual mode off returns to the screen it was enabled from.
    if (!manual) close();
  };

  return (
    <View style={{ flex: 1, backgroundColor: essentials.bg }}>
      <StatusBar style="light" />
      <ScrollView
        style={{ flex: 1, backgroundColor: essentials.bg }}
        contentContainerStyle={{ paddingTop: insets.top + space.l, paddingHorizontal: space.l, paddingBottom: space.xl, gap: space.l }}
      >
        <View style={{ gap: space.s }}>
          <Text accessibilityRole="header" style={{ fontFamily: fonts.display, fontSize: 32, color: essentials.ink }}>
            {t('essentials.title')}
          </Text>
          <Text style={{ fontFamily: fonts.body, fontSize: 17, lineHeight: 24, color: essentials.muted }}>{t('battery.note')}</Text>
          {reading.level === null ? <Text style={{ fontFamily: fonts.body, fontSize: 17, lineHeight: 24, color: essentials.muted }}>{t('battery.levelUnknown')}</Text> : null}
        </View>

        <Pressable
          accessibilityRole="switch"
          accessibilityLabel={t('battery.keepOn')}
          accessibilityHint={t('battery.keepOnHint')}
          accessibilityState={{ checked: prefs.manual }}
          onPress={toggleManual}
          hitSlop={8}
          style={{
            minHeight: TOUCH,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: space.m,
            borderWidth: 1,
            borderColor: essentials.line,
            borderRadius: radius.m,
            paddingHorizontal: space.l,
            paddingVertical: space.s,
          }}
        >
          <Text style={{ flex: 1, fontFamily: fonts.bodyBold, fontSize: 18, color: essentials.ink }}>{t('battery.keepOn')}</Text>
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 18, color: prefs.manual ? essentials.ink : essentials.muted }}>{prefs.manual ? t('common.on') : t('common.off')}</Text>
        </Pressable>

        <EssentialsSlot />
      </ScrollView>
      <View style={{ paddingHorizontal: space.l, paddingTop: space.s, paddingBottom: insets.bottom + space.l, borderTopWidth: 1, borderTopColor: essentials.line, backgroundColor: essentials.bg }}>
        <EssentialsButton strong label={t('battery.exit')} hint={t('battery.exitHint')} onPress={close} />
      </View>
    </View>
  );
}
