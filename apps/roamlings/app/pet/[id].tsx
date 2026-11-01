import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { stageProgress } from '../../src/core/growth';
import type { RegionId } from '../../src/core/region';
import { getSpecies } from '../../src/core/species';
import { petName, speciesBlurb, speciesName, t } from '../../src/i18n';
import { actions, useGame } from '../../src/store/game';
import { radius, space, type as ty, useColors } from '../../src/theme/tokens';
import { Button, Card, Meter, RarityBadge } from '../../src/ui/kit';
import { PetView } from '../../src/ui/PetView';

export default function PetDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const g = useGame();
  const { c } = useColors();
  const insets = useSafeAreaInsets();
  const pet = g.pets.find((p) => p.id === id);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  if (!pet) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', padding: space.xl }}>
        <Button label={t('pets.cancel')} onPress={() => router.back()} />
      </View>
    );
  }
  const isBuddy = pet.id === g.buddyId;
  const sp = getSpecies(pet.speciesId);
  const date = new Date(pet.hatchedAt).toLocaleDateString();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: space.xl, paddingBottom: insets.bottom + space.xl, gap: space.lg, alignItems: 'center' }}>
      <PetView pet={pet} size={240} animate />
      {editing ? (
        <View style={{ alignSelf: 'stretch', gap: space.sm }}>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={t('pets.renamePlaceholder')}
            placeholderTextColor={c.ink3}
            maxLength={20}
            autoFocus
            accessibilityLabel={t('pets.renamePlaceholder')}
            style={[ty.h2, { color: c.ink, borderWidth: 1, borderColor: c.line, borderRadius: radius.md, padding: space.md, backgroundColor: c.card }]}
          />
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button kind="soft" label={t('pets.cancel')} onPress={() => setEditing(false)} style={{ flex: 1 }} />
            <Button label={t('pets.save')} onPress={() => { actions.rename(pet.id, name); setEditing(false); }} style={{ flex: 1 }} />
          </View>
        </View>
      ) : (
        <View style={{ alignItems: 'center', gap: space.xs }}>
          <Text style={[ty.title, { color: c.ink }]}>{petName(pet)}</Text>
          {pet.nickname ? <Text style={[ty.small, { color: c.ink3 }]}>{speciesName(pet.speciesId)}</Text> : null}
        </View>
      )}
      <RarityBadge rarity={pet.rarity} />
      <Text style={[ty.body, { color: c.ink2, textAlign: 'center' }]}>{speciesBlurb(pet.speciesId)}</Text>
      <Card style={{ alignSelf: 'stretch', gap: space.sm }}>
        <Row label={t('pets.trait')} value={t(`trait.${pet.trait}`)} />
        <Row label={t('pets.element')} value={t(`element.${sp.element}`)} />
        <Row label={t('pets.stage')} value={pet.branch ? `${t(`stage.${pet.stage}`)} · ${t(`branch.${pet.branch}`)}` : `${t(`stage.${pet.stage}`)} · ${t('pets.xp', { n: pet.xp })}`} />
        {pet.mod ? <Row label={t('pets.mod')} value={t(`part.${pet.mod.slot}`)} /> : null}
        <Row label={t('pets.hatchedIn', { region: t(`region.${pet.region as RegionId}`) })} value={t('pets.hatchedOn', { date })} />
        {pet.stage < 2 ? <Meter value={stageProgress(pet)} color={c.good} track={c.meterTrack} /> : null}
        {pet.stage < 2 ? <Text style={[ty.small, { color: c.ink3 }]}>{t('branch.hint')}</Text> : null}
      </Card>
      <View style={{ alignSelf: 'stretch', gap: space.sm }}>
        {!isBuddy ? <Button label={t('pets.makeBuddy')} onPress={() => { actions.setBuddy(pet.id); router.back(); }} /> : null}
        {!editing ? <Button kind="soft" label={t('pets.rename')} onPress={() => { setName(pet.nickname ?? ''); setEditing(true); }} /> : null}
      </View>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const { c } = useColors();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md }}>
      <Text style={[ty.small, { color: c.ink3, flexShrink: 1 }]}>{label}</Text>
      <Text style={[ty.small, { color: c.ink, fontWeight: '700', flexShrink: 1, textAlign: 'right' }]}>{value}</Text>
    </View>
  );
}
