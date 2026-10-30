import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PETS, petById, type PetId, type PetMood, type PetStatus } from '../src/core/islandPets';
import { useT } from '../src/i18n';
import { changePetMood, petsSupported, readPetStatus, startPet, stopPet } from '../src/native/islandPets';
import { continuous, onArtV2, radiusV2, textV2 } from '../src/theme/tokensV2';
import { useColorsV2 } from '../src/theme/useTokens';
import { IslandPetArt } from '../src/ui/IslandPetArt';
import { PillButton } from '../src/ui/PillButton';
import { textStyleFor } from '../src/ui/i18nLayout';

export default function PetsScreen() {
  const { c } = useColorsV2();
  const { t, script } = useT();
  const available = petsSupported();
  const [selected, setSelected] = useState<PetId>('cat');
  const [status, setStatus] = useState<PetStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const locked = useRef(false);
  const chosen = useRef(false);
  const accept = useCallback((next: PetStatus) => {
    setStatus(next);
    if (next.session && !chosen.current) setSelected(next.session.pet);
  }, []);
  const refresh = useCallback(async () => {
    if (!available || locked.current) return;
    locked.current = true; setBusy(true);
    try { accept(await readPetStatus()); setError(false); }
    catch { setError(true); }
    finally { locked.current = false; setBusy(false); }
  }, [available, accept]);
  useFocusEffect(useCallback(() => {
    void refresh();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    return () => subscription.remove();
  }, [refresh]));
  const act = async (operation: () => Promise<PetStatus>) => {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError(false);
    try { accept(await operation()); }
    catch {
      // A failed response can follow an actual OS change. Reconcile, never invent a stopped pet.
      setError(true);
      try { accept(await readPetStatus()); } catch { /* Retain the last confirmed status. */ }
    } finally { locked.current = false; setBusy(false); }
  };
  const session = status?.session;
  const pose: PetMood = session?.pet === selected ? session.mood : 'happy';
  const same = session?.pet === selected;
  const label = (role: 'body' | 'footnote' | 'headline') => [textV2[role], textStyleFor(script, textV2[role])];

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={[styles.root, { backgroundColor: c.bg }]}>
      <ScrollView bounces={false} overScrollMode="never" contentContainerStyle={styles.body}>
        <Text style={[...label('body'), { color: c.inkSecondary }]}>{t('pets.intro')}</Text>
        <View style={[styles.preview, continuous, { backgroundColor: c.fill }]}>
          <Text style={[...label('footnote'), { color: c.inkSecondary }]}>{t('pets.preview')}</Text>
          <View style={styles.island} accessible accessibilityLabel={petById(selected).name}>
            <IslandPetArt pet={selected} mood={pose} size={80} />
            <View style={styles.previewText}>
              <Text style={[...label('headline'), { color: onArtV2.ink }]}>{petById(selected).name}</Text>
              <Text style={[...label('footnote'), { color: '#E9DDF5' }]}>{t(`pets.${pose}`)}</Text>
            </View>
          </View>
        </View>
        <Text accessibilityRole="header" style={[...label('headline'), { color: c.ink }]}>{t('pets.choose')}</Text>
        <View style={styles.choices}>
          {PETS.map(pet => (
            <Pressable key={pet.id} accessibilityRole="button" accessibilityLabel={pet.name}
              accessibilityState={{ selected: selected === pet.id, disabled: busy }} disabled={busy}
              onPress={() => { chosen.current = true; setSelected(pet.id); }}
              style={[styles.choice, continuous, { backgroundColor: c.fill, borderColor: selected === pet.id ? c.tint : c.separator }]}>
              <IslandPetArt pet={pet.id} mood="happy" size={64} />
              <Text style={[...label('footnote'), { color: c.ink }]}>{pet.name}</Text>
            </Pressable>
          ))}
        </View>
        <Text accessibilityLiveRegion="polite" style={[...label('body'), { color: c.ink }]}>
          {error ? t('pets.error') : !available ? t('pets.unavailable') : status && !status.enabled ? t('pets.disabled') :
            session ? t('pets.running', { name: petById(session.pet).name }) : t('pets.off')}
        </Text>
        {available && <>
          <PillButton label={t(session ? 'pets.switch' : 'pets.start')} block icon="heart"
            busy={busy} disabled={!status?.enabled || same || error} onPress={() => void act(() => startPet(selected))} />
          {session && <>
            <View style={styles.actions}>
              {(['happy', 'playful', 'sleepy'] as const).map((mood, i) => (
                <PillButton key={mood} label={t((['pets.cuddle', 'pets.play', 'pets.nap'] as const)[i])}
                  variant="tinted" disabled={busy || error} style={styles.action}
                  onPress={() => void act(() => changePetMood(session.id, mood))} />
              ))}
            </View>
            <PillButton label={t('pets.stop')} variant="plain" block disabled={busy} onPress={() => void act(stopPet)} />
          </>}
          {(error || !status?.enabled) && <PillButton label={t('pets.check')} variant="tinted" disabled={busy} onPress={() => void refresh()} />}
        </>}
        <Text style={[...label('footnote'), { color: c.inkSecondary }]}>{t('pets.limits')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1 }, body: { padding: 20, gap: 18, paddingBottom: 36 },
  preview: { padding: 20, borderRadius: radiusV2.card, alignItems: 'center', gap: 14 },
  island: { backgroundColor: '#19131F', borderRadius: 36, paddingHorizontal: 20, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 16, maxWidth: '100%' },
  previewText: { flexShrink: 1, gap: 4 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  choice: { flexGrow: 1, flexBasis: 88, borderWidth: 2, borderRadius: 20, alignItems: 'center', padding: 10, gap: 8 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, action: { flexGrow: 1, flexBasis: 88 },
});
