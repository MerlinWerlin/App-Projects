// T97: the "I'm safe / Share where I am" entry on the Emergency tab, in the same look as the Trouble and Nearest help
// cards. Opens app/safe.tsx. No location is read here: the check happens on that screen, only when tapped.
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { useApp } from '../state/app.tsx';
import { fonts, radius, shadowOf, space, TOUCH } from '../theme/tokens.ts';
import { IconBadge } from './hero.tsx';
import { PressableScale } from './kit.tsx';

export function SafeCheckCard() {
  const { t, theme } = useApp();
  const router = useRouter();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={t('safe.entry')}
      accessibilityHint={`${t('safe.entryBody')} ${t('safe.entryHint')}`}
      onPress={() => router.push('/safe')}
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
      <IconBadge name="chatbubble-ellipses-outline" tone="ok" />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 17, color: theme.ink }}>{t('safe.entry')}</Text>
        <Text numberOfLines={3} style={{ fontFamily: fonts.body, fontSize: 15, color: theme.muted }}>
          {t('safe.entryBody')}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={theme.muted} />
    </PressableScale>
  );
}
