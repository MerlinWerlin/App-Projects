// Language picker (design review 14 Nov 2026): moved out of Settings into its own pushed screen, the iOS Settings
// pattern (a "Language" row showing the current choice, then the list). Before, all 12 options sat inline in the
// middle of Settings and pushed About (Linework Plus, feedback, privacy, version) far down the page.
// "Phone language (<its native name>)" plus every shipped language by its own name. Picking one applies it at once;
// switching between left-to-right and right-to-left may need a restart.
import { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useThemeV2 } from '../src/theme/useTheme';
import { maxFontScaleV2, spaceV2 } from '../src/theme/tokensV2';
import { InsetGroup, InsetRow, ScreenV2 } from '../src/ui/v2';
import { setLanguage, useT, type LanguageSetting } from '../src/i18n';
import { LOCALES, localeInfo } from '../src/i18n/core';
import { applyLayoutDirection } from '../src/i18n/direction';

export default function LanguageScreen() {
  const { c, text } = useThemeV2();
  const { t, setting, deviceLocale } = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/settings');
  };

  // The check row fires the selection tick.
  const pick = async (value: LanguageSetting) => {
    if (busy || value === setting) return;
    setBusy(true);
    try {
      await setLanguage(value);
      const r = await applyLayoutDirection();
      if (r === 'restart-needed') {
        Alert.alert(t('settings.language.restartTitle'), t('settings.language.restartManual'), [{ text: t('common.ok') }]);
      }
    } catch {
      // the language still changed for this session
    } finally {
      setBusy(false);
    }
  };

  const options: { value: LanguageSetting; label: string; hint: string; subtitle?: string }[] = [
    {
      value: 'system',
      label: t('settings.language.system', { name: localeInfo(deviceLocale).nativeName }),
      hint: t('settings.language.systemHint'),
    },
    ...LOCALES.map((l) => ({
      value: l.code as LanguageSetting,
      label: l.nativeName,
      hint: l.englishName,
      subtitle: l.englishName !== l.nativeName ? l.englishName : undefined,
    })),
  ];

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenV2 title={t('settings.language.title')} onBack={goBack}>
        <View accessibilityRole="radiogroup" accessibilityLabel={t('settings.language.title')}>
        <InsetGroup footer={t('settings.language.hint')} style={{ marginBottom: 0 }}>
          {options.map((o) => (
            <InsetRow
              key={o.value}
              title={o.label}
              subtitle={o.subtitle}
              accessory="check"
              checked={setting === o.value}
              onPress={() => {
                pick(o.value).catch(() => {});
              }}
              accessibilityLabel={o.label}
              accessibilityHint={o.hint}
            />
          ))}
        </InsetGroup>
        </View>
        <Text
          maxFontSizeMultiplier={maxFontScaleV2}
          style={[text('footnote'), { color: c.muted, paddingHorizontal: spaceV2.x4, marginTop: spaceV2.x2 }]}
        >
          {t('settings.language.machineNote')}
        </Text>
      </ScreenV2>
    </>
  );
}
