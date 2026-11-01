// T121: the Help cards entry on the Emergency tab, in the same look as the I'm safe and Medicine times rows. Opens
// app/helpcards.tsx. Cards come from this phone only (src/state/helpcards.ts).
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { useApp } from '../state/app.tsx';
import { useHelpPeople } from '../state/helpcards.ts';
import { fonts, radius, shadowOf, space, TOUCH } from '../theme/tokens.ts';
import { IconBadge } from './hero.tsx';
import { PressableScale } from './kit.tsx';

export function HelpCardsCard() {
  const { t, theme } = useApp();
  const router = useRouter();
  const [people] = useHelpPeople();
  const n = people.length;
  const body = n === 0 ? t('helpcards.entryBody') : n === 1 ? t('helpcards.entryBodyOne', { name: people[0].name }) : t('helpcards.entryBodyCount', { n });
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={t('helpcards.entry')}
      accessibilityHint={`${body} ${t('helpcards.entryHint')}`}
      onPress={() => router.push('/helpcards')}
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
      <IconBadge name="help-buoy-outline" tone="accent" />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 17, color: theme.ink }}>{t('helpcards.entry')}</Text>
        <Text numberOfLines={3} style={{ fontFamily: fonts.body, fontSize: 15, color: theme.muted }}>
          {body}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={theme.muted} />
    </PressableScale>
  );
}
