// T59: the "Nearest help" entry on the Emergency tab. Opens app/help.tsx (hospitals, pharmacies, police nearby).
// No location is read here; the help screen checks it once, only when asked.
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { useApp } from '../state/app.tsx';
import { fonts, radius, shadowOf, space, TOUCH } from '../theme/tokens.ts';
import { IconBadge } from './hero.tsx';
import { PressableScale } from './kit.tsx';

export function NearestHelpCard() {
  const { t, theme } = useApp();
  const router = useRouter();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={t('help.entry')}
      accessibilityHint={t('help.entryHint')}
      onPress={() => router.push('/help')}
      style={{
        minHeight: TOUCH,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.m,
        paddingHorizontal: space.l,
        paddingVertical: space.m,
        borderRadius: radius.l,
        borderWidth: theme.dark ? 1 : 0,
        borderColor: theme.line,
        backgroundColor: theme.cardRaised,
        ...shadowOf(theme, 'low'),
      }}
    >
      <IconBadge name="medkit-outline" tone="danger" />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 17, color: theme.ink }}>{t('help.entry')}</Text>
        <Text numberOfLines={2} style={{ fontFamily: fonts.body, fontSize: 15, color: theme.muted }}>
          {t('help.entryBody')}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={theme.muted} />
    </PressableScale>
  );
}
