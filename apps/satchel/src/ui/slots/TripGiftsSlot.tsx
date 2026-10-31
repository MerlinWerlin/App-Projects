// Slot on the trip timeline header, owned by T107: link to the trip's gifts and souvenirs with progress.
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { giftSummary } from '../../core/gifts.ts';
import type { Trip } from '../../core/model.ts';
import { useApp } from '../../state/app.tsx';
import { fonts, radius, space } from '../../theme/tokens.ts';
import { PressableScale } from '../kit.tsx';

export function TripGiftsSlot({ trip }: { trip: Trip }) {
  const { t, theme } = useApp();
  const router = useRouter();
  const s = giftSummary(trip);
  const label = s.total
    ? t('gifts.slot.open', { got: s.got, total: s.total })
    : s.people === 1
      ? t('gifts.slot.personOne')
      : s.people
        ? t('gifts.slot.people', { count: s.people })
        : t('gifts.slot.make');
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={t('gifts.slot.hint')}
      onPress={() => router.push(`/gifts/${trip.id}`)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.m,
        backgroundColor: theme.card,
        borderWidth: 1,
        borderColor: theme.line,
        borderRadius: radius.m,
        paddingHorizontal: space.l,
        paddingVertical: space.s,
      }}
    >
      <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Ionicons name={s.total > 0 && s.got === s.total ? 'checkmark-circle' : 'gift-outline'} size={22} color={theme.accent} />
      </View>
      <Text style={{ flex: 1, fontFamily: fonts.bodyBold, fontSize: 16, color: theme.ink }}>{label}</Text>
      <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Ionicons name="chevron-forward" size={18} color={theme.muted} />
      </View>
    </PressableScale>
  );
}
