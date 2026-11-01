import { router } from 'expo-router';
import { memo } from 'react';
import { FlatList, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Pet } from '../../src/core/pet';
import { petName, t } from '../../src/i18n';
import { useGame } from '../../src/store/game';
import { radius, rarityColor, space, type as ty, useColors } from '../../src/theme/tokens';
import { PetView } from '../../src/ui/PetView';

const COLS = 3;

const PetCell = memo(function PetCell({ pet, size, isBuddy }: { pet: Pet; size: number; isBuddy: boolean }) {
  const { c } = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${petName(pet)}, ${t(`rarity.${pet.rarity}`)}${isBuddy ? `, ${t('pets.buddy')}` : ''}`}
      onPress={() => router.push(`/pet/${pet.id}`)}
      style={{ width: size, margin: space.xs, alignItems: 'center', backgroundColor: c.card, borderRadius: radius.md, borderWidth: 2, borderColor: isBuddy ? c.accent : rarityColor[pet.rarity] + '55', paddingBottom: space.sm }}
    >
      <PetView pet={pet} size={size - 8} />
      <Text numberOfLines={1} style={[ty.small, { color: c.ink, fontWeight: '700' }]}>{petName(pet)}</Text>
      <Text style={[ty.small, { color: rarityColor[pet.rarity], fontSize: 11 }]}>{isBuddy ? t('pets.buddy') : t(`rarity.${pet.rarity}`)}</Text>
    </Pressable>
  );
});

export default function Pets() {
  const g = useGame();
  const { c } = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const size = Math.floor((width - space.lg * 2) / COLS) - space.xs * 2;
  const pets = [...g.pets].reverse();
  return (
    <FlatList
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{ padding: space.lg, paddingTop: insets.top + space.md }}
      data={pets}
      keyExtractor={(p) => p.id}
      numColumns={COLS}
      initialNumToRender={12}
      windowSize={7}
      ListHeaderComponent={
        <View style={{ marginBottom: space.md, gap: 4 }}>
          <Text style={[ty.title, { color: c.ink }]} accessibilityRole="header">{t('pets.title')}</Text>
          <Text style={[ty.small, { color: c.ink3 }]}>{t('pets.count', { n: g.pets.length })}</Text>
        </View>
      }
      ListEmptyComponent={<Text style={[ty.body, { color: c.ink2 }]}>{t('pets.empty')}</Text>}
      renderItem={({ item }) => <PetCell pet={item} size={size} isBuddy={item.id === g.buddyId} />}
    />
  );
}
