import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LANGS, languageName, t } from '../src/i18n';
import { phoneLanguage, updateSettings, useSettings } from '../src/store/settings';
import { radius, space, type as ty, useColors } from '../src/theme/tokens';
import { IconButton } from '../src/ui/kit';

export default function Language() {
  const s = useSettings();
  const { c } = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const options = [
    { code: 'system', label: t('lang.system', { name: languageName(phoneLanguage() ?? 'en') }) },
    ...LANGS.map((l) => ({ code: l.code as string, label: l.name })),
  ];
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{ padding: space.lg, paddingTop: insets.top + space.md, gap: space.md, maxWidth: 640, width: '100%', alignSelf: 'center' }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={[ty.title, { color: c.ink }]} accessibilityRole="header">
          {t('lang.title')}
        </Text>
        <IconButton icon="close" label={t('settings.back')} onPress={() => router.back()} />
      </View>
      {options.map((o) => {
        const on = s.language === o.code;
        return (
          <Pressable
            key={o.code}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={o.label}
            onPress={() => {
              updateSettings({ language: o.code, langLineDone: true });
              router.back();
            }}
            style={{
              minHeight: 52,
              paddingHorizontal: space.lg,
              borderRadius: radius.md,
              justifyContent: 'center',
              borderWidth: 1.5,
              borderColor: on ? c.accent : c.line,
              backgroundColor: on ? c.accentSoft : c.card,
            }}
          >
            <Text style={[ty.body, { color: c.ink, fontWeight: on ? '700' : '400' }]}>{o.label}</Text>
          </Pressable>
        );
      })}
      <Text style={[ty.small, { color: c.ink3 }]}>{t('lang.more')}</Text>
    </ScrollView>
  );
}
