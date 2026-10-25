// Slot on the trip timeline header, owned by T08: link to the trip's packing list with progress.
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import type { Trip } from '../../core/model.ts';
import { EMPTY_STORE, listFor, PACKING_KEY, progress, type PackStore } from '../../core/packing.ts';
import { useApp } from '../../state/app.tsx';
import { usePersisted } from '../../state/persisted.ts';
import { fonts, radius, space } from '../../theme/tokens.ts';
import { PressableScale } from '../kit.tsx';

export function TripPackingSlot({ trip }: { trip: Trip }) {
  const { t, theme } = useApp();
  const router = useRouter();
  const [store] = usePersisted<PackStore>(PACKING_KEY, EMPTY_STORE);
  const list = listFor(store, trip.id);
  const p = progress(list);
  const label = list ? t('packing.slotOpen', { done: p.done, total: p.total }) : t('packing.slotMake');
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={t('packing.slotHint')}
      onPress={() => router.push(`/packing/${trip.id}`)}
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
        <Ionicons name={list && p.total > 0 && p.done === p.total ? 'checkmark-circle' : 'bag-handle-outline'} size={22} color={theme.accent} />
      </View>
      <Text style={{ flex: 1, fontFamily: fonts.bodyBold, fontSize: 16, color: theme.ink }}>{label}</Text>
      <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Ionicons name="chevron-forward" size={18} color={theme.muted} />
      </View>
    </PressableScale>
  );
}
