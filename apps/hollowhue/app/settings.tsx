import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { currentLanguage, languageName, t } from '../src/i18n';
import { updateSettings, useSettings } from '../src/store/settings';
import { space, type as ty, useColors } from '../src/theme/tokens';
import { Card, IconButton } from '../src/ui/kit';

export default function Settings() {
  const s = useSettings();
  const { c } = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const version = Constants.expoConfig?.version ?? '0.1.0';
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{ padding: space.lg, paddingTop: insets.top + space.md, gap: space.lg, paddingBottom: space.xxl, maxWidth: 640, width: '100%', alignSelf: 'center' }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={[ty.title, { color: c.ink }]} accessibilityRole="header">
          {t('settings.title')}
        </Text>
        <IconButton icon="close" label={t('settings.back')} onPress={() => router.back()} />
      </View>

      <Card style={{ gap: space.md }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t('settings.language')}: ${languageName(currentLanguage())}`}
          onPress={() => router.push('/language')}
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 48 }}
        >
          <Text style={[ty.bodyBold, { color: c.ink }]}>{t('settings.language')}</Text>
          <Text style={[ty.body, { color: c.accent }]}>{languageName(currentLanguage())}</Text>
        </Pressable>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 48 }}>
          <Text style={[ty.bodyBold, { color: c.ink }]}>{t('settings.haptics')}</Text>
          <Switch value={s.haptics} onValueChange={(v) => updateSettings({ haptics: v })} accessibilityLabel={t('settings.haptics')} />
        </View>
        <View style={{ gap: space.xs }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 48, gap: space.md }}>
            <Text style={[ty.bodyBold, { color: c.ink, flex: 1 }]}>{t('settings.inside')}</Text>
            <Switch value={s.insideLines} onValueChange={(v) => updateSettings({ insideLines: v })} accessibilityLabel={t('settings.inside')} />
          </View>
          <Text style={[ty.small, { color: c.ink3 }]}>{t('settings.insideHint')}</Text>
        </View>
      </Card>

      <Card style={{ gap: space.sm }}>
        <Text style={[ty.bodyBold, { color: c.ink }]}>{t('settings.about')}</Text>
        <Text style={[ty.body, { color: c.ink2 }]}>{t('settings.aboutBody')}</Text>
        <Text style={[ty.small, { color: c.ink3 }]}>{t('settings.version', { v: version })}</Text>
      </Card>
    </ScrollView>
  );
}
