import { memo } from 'react';
import { FlatList, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type Pet, allVariantKeys } from '../../src/core/pet';
import { SPECIES, type Species } from '../../src/core/species';
import { speciesBlurb, speciesName, t } from '../../src/i18n';
import { useGame } from '../../src/store/game';
import { radius, space, type as ty, useColors } from '../../src/theme/tokens';
import { Meter } from '../../src/ui/kit';
import { PetView } from '../../src/ui/PetView';

function samplePet(s: Species, owned: Pet | undefined): Pet {
  return (
    owned ?? {
      id: `dex-${s.id}`, seed: 0, speciesId: s.id, rarity: 'common', paletteId: s.palettes.common.id, mod: null,
      trait: 'gentle', region: 'wilds', hatchedAt: 0, nickname: null, stage: 2, xp: 0,
      branchXp: { swift: 0, scholarly: 0, cozy: 0 }, branch: null,
    }
  );
}

const DexRow = memo(function DexRow({ s, found, total, owned }: { s: Species; found: number; total: number; owned: Pet | undefined }) {
  const { c } = useColors();
  const known = found > 0;
  const pet = samplePet(s, owned ? { ...owned, stage: 2, branch: null } : undefined);
  return (
    <View
      accessible
      accessibilityLabel={known ? `${speciesName(s.id)}, ${t('dex.variants', { n: found, total })}` : t('dex.unknown')}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: c.card, borderRadius: radius.md, borderWidth: 1, borderColor: c.line, padding: space.sm, marginBottom: space.sm }}
    >
      <View style={{ backgroundColor: c.cardAlt, borderRadius: radius.sm }}>
        <PetView pet={pet} size={72} silhouette={!known} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={[ty.bodyBold, { color: c.ink }]}>{known ? speciesName(s.id) : t('dex.unknown')}</Text>
        {known ? <Text numberOfLines={2} style={[ty.small, { color: c.ink2 }]}>{speciesBlurb(s.id)}</Text> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <View style={{ flex: 1 }}>
            <Meter value={found / total} color={c.accent} track={c.meterTrack} height={8} />
          </View>
          <Text style={[ty.small, { color: c.ink3, fontVariant: ['tabular-nums'] }]}>{t('dex.variants', { n: found, total })}</Text>
        </View>
      </View>
    </View>
  );
});

export default function Dex() {
  const g = useGame();
  const { c } = useColors();
  const insets = useSafeAreaInsets();
  const seen = new Set(g.dex);
  const rows = SPECIES.map((s) => {
    const keys = allVariantKeys(s.id);
    const found = keys.filter((k) => seen.has(k)).length;
    const owned = g.pets.find((p) => p.speciesId === s.id);
    return { s, found, total: keys.length, owned };
  });
  const totalFound = rows.reduce((a, r) => a + r.found, 0);
  const totalAll = rows.reduce((a, r) => a + r.total, 0);
  const speciesFound = rows.filter((r) => r.found > 0).length;
  return (
    <FlatList
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{ padding: space.lg, paddingTop: insets.top + space.md }}
      data={rows}
      keyExtractor={(r) => r.s.id}
      ListHeaderComponent={
        <View style={{ marginBottom: space.md, gap: 6 }}>
          <Text style={[ty.title, { color: c.ink }]} accessibilityRole="header">{t('dex.title')}</Text>
          <Text style={[ty.small, { color: c.ink2 }]}>{t('dex.species', { n: speciesFound, total: SPECIES.length })} · {t('dex.progress', { n: totalFound, total: totalAll })}</Text>
          <Meter value={totalFound / totalAll} color={c.spark} track={c.meterTrack} />
        </View>
      }
      renderItem={({ item }) => <DexRow s={item.s} found={item.found} total={item.total} owned={item.owned} />}
    />
  );
}
