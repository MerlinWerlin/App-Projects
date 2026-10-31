// Island pets (T188, owner-1101 #6). Each pet follows its day from src/core/petLife.ts (sleep in
// quiet hours, a stretch on waking, meals, idle / wander / play), shows its state, mood and a
// caption, idles with a slow calm breath, and reacts to a tap. Settings: which pet is on the
// Island, Island on/off, quiet hours and names. The screen re-renders only at petLife boundaries
// (one timeout to the earliest `until`) and the Live Activity is updated through
// src/store/pets.ts at those boundaries only. Expo Go: everything but the Live Activity works.
// T186 re-exports this screen as the Pets tab; keep the default export.
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, AppState, Easing, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PETS, petById, type PetId, type PetStatus } from '../src/core/islandPets';
import {
  PET_NAME_MAX, cleanPetName, lifeInputFor, petDisplayName, petLife, shiftQuiet, withCare,
  type PetFrameSet, type PetLife, type PetSettings,
} from '../src/core/petLife';
import { useT } from '../src/i18n';
import { petsSupported, readPetStatus } from '../src/native/islandPets';
import { localOffset, syncIslandPet, usePetSettings } from '../src/store/pets';
import { useMotionReduced } from '../src/theme/motion';
import { continuous, onArtV2, radiusV2, sizeV2, spaceV2, textV2 } from '../src/theme/tokensV2';
import { useColorsV2 } from '../src/theme/useTokens';
import { IslandPetArt } from '../src/ui/IslandPetArt';
import { PillButton } from '../src/ui/PillButton';
import { SwitchRow } from '../src/ui/Switch';
import { haptic } from '../src/ui/haptics';
import { textStyleFor } from '../src/ui/i18nLayout';

/** Breath period per pose: slow when asleep, a little quicker when busy. Opacity-free, 1 pt rise. */
const BREATH_MS: Record<PetFrameSet, number> = { sleep: 4200, stretch: 2600, sit: 3200, eat: 1600, play: 1800, walk: 2000, cheer: 1200 };
const SPOT_STEP = 10;

/** A pet that breathes slowly and walks between spots with a timed ease (no spring, no bounce). */
function LivingPet({ pet, life, size }: { pet: PetId; life: PetLife; size: number }) {
  const reduced = useMotionReduced();
  const breath = useRef(new Animated.Value(0)).current;
  const x = useRef(new Animated.Value((life.spot - 2) * SPOT_STEP)).current;
  // Faces the way it last walked.
  const lastSpot = useRef(life.spot);
  const facing = useRef(false);
  if (life.spot !== lastSpot.current) { facing.current = life.spot < lastSpot.current; lastSpot.current = life.spot; }
  const facingLeft = facing.current;
  useEffect(() => {
    breath.setValue(0);
    if (reduced) return;
    const half = BREATH_MS[life.frames] / 2;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(breath, { toValue: 1, duration: half, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(breath, { toValue: 0, duration: half, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [breath, life.frames, reduced]);
  useEffect(() => {
    const to = (life.spot - 2) * SPOT_STEP;
    if (reduced) { x.setValue(to); return; }
    Animated.timing(x, { toValue: to, duration: 1200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }).start();
  }, [life.spot, reduced, x]);
  const translateY = breath.interpolate({ inputRange: [0, 1], outputRange: [0, -1.5] });
  return (
    <View style={[styles.track, { width: size + SPOT_STEP * 4, height: size }]}>
      <Animated.View style={{ transform: [{ translateX: x }, { translateY }] }}>
        <IslandPetArt pet={pet} frames={life.frames} facingLeft={facingLeft} size={size} />
      </Animated.View>
    </View>
  );
}

export default function PetsScreen() {
  const { c } = useColorsV2();
  const { t, script, formatClock } = useT();
  const available = petsSupported();
  const { settings, ready, update } = usePetSettings();
  const [now, setNow] = useState(() => Date.now());
  const [status, setStatus] = useState<PetStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const locked = useRef(false);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const lives = useMemo(() => {
    const offset = localOffset(now);
    return Object.fromEntries(PETS.map(p => [p.id, petLife(lifeInputFor(settings, p.id, now, offset))])) as Record<PetId, PetLife>;
  }, [settings, now]);

  // One timeout to the earliest boundary of any pet: sparse re-renders, no polling.
  useEffect(() => {
    const until = Math.min(...PETS.map(p => lives[p.id].until));
    const id = setTimeout(() => setNow(Date.now()), Math.min(2 ** 31 - 1, Math.max(1000, until - Date.now() + 50)));
    return () => clearTimeout(id);
  }, [lives]);

  /** Reads the Live Activity and brings it in line with the settings (full iPhone build only). */
  const reconcile = useCallback(async () => {
    if (!available || locked.current) return;
    locked.current = true; setBusy(true);
    try { setStatus(await syncIslandPet(settingsRef.current, await readPetStatus())); setError(false); }
    catch {
      // A failed response can follow an actual OS change. Reconcile, never invent a stopped pet.
      setError(true);
      try { setStatus(await readPetStatus()); } catch { /* Retain the last confirmed status. */ }
    } finally { locked.current = false; setBusy(false); }
  }, [available]);

  useFocusEffect(useCallback(() => {
    setNow(Date.now());
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') setNow(Date.now()); });
    return () => subscription.remove();
  }, []));
  // Settings changes and petLife boundaries (now) are the only triggers for a Live Activity sync.
  useEffect(() => { if (ready) void reconcile(); }, [ready, settings, now, reconcile]);

  const change = (fn: (s: PetSettings) => PetSettings) => { update(fn); setNow(Date.now()); };
  const hello = (pet: PetId) => { haptic('light'); change(s => withCare(s, pet, 'tapAt', Date.now())); };
  // PillButton gives its own haptic.
  const care = (pet: PetId, kind: 'fedAt' | 'playAt') => change(s => withCare(s, pet, kind, Date.now()));

  const label = (role: 'body' | 'footnote' | 'headline' | 'subhead') => [textV2[role], textStyleFor(script, textV2[role])];
  const nameOf = (pet: PetId) => petDisplayName(settings, pet, petById(pet).name);
  const moodText = (life: PetLife) => t(`pets.${life.mood}`);
  const stateText = (caption: PetLife['caption']) => t(`pets.${caption}`);
  const clock = (ms: number) => formatClock(new Date(ms));
  const minuteDate = (m: number) => { const d = new Date(now); d.setHours(Math.floor(m / 60), m % 60, 0, 0); return d.getTime(); };
  const island = lives[settings.pet];
  const session = status?.session;

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={[styles.root, { backgroundColor: c.bg }]}>
      <ScrollView bounces={false} overScrollMode="never" keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
        <Text style={[...label('body'), { color: c.inkSecondary }]}>{t('pets.intro')}</Text>

        <View style={[styles.preview, continuous, { backgroundColor: c.fill }]}>
          <Text style={[...label('footnote'), { color: c.inkSecondary }]}>{t('pets.preview')}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={t('pets.hello', { name: nameOf(settings.pet) })}
            accessibilityValue={{ text: stateText(island.caption) }} accessibilityHint={t('pets.moodLabel', { mood: moodText(island) })}
            onPress={() => hello(settings.pet)} style={styles.island}>
            <LivingPet pet={settings.pet} life={island} size={64} />
            <View style={styles.previewText}>
              <Text style={[...label('headline'), { color: onArtV2.ink }]}>{nameOf(settings.pet)}</Text>
              <Text style={[...label('footnote'), { color: '#E9DDF5' }]}>{stateText(island.caption)}</Text>
            </View>
          </Pressable>
          <Text style={[...label('footnote'), { color: c.inkSecondary }]}>
            {t('pets.next', { state: stateText(island.next.caption), time: clock(island.until) })}
          </Text>
        </View>

        <Text style={[...label('footnote'), { color: c.inkSecondary }]}>{t('pets.tapHint')}</Text>
        {PETS.map(pet => {
          const life = lives[pet.id];
          return (
            <View key={pet.id} style={[styles.card, continuous, { backgroundColor: c.fill }]}>
              <Pressable accessibilityRole="button" accessibilityLabel={t('pets.hello', { name: nameOf(pet.id) })}
                accessibilityValue={{ text: stateText(life.caption) }} accessibilityHint={t('pets.moodLabel', { mood: moodText(life) })}
                onPress={() => hello(pet.id)} style={styles.cardTop}>
                <LivingPet pet={pet.id} life={life} size={56} />
                <View style={styles.previewText}>
                  <Text style={[...label('headline'), { color: c.ink }]}>{nameOf(pet.id)}</Text>
                  <Text accessibilityLiveRegion="polite" style={[...label('subhead'), { color: c.ink }]}>{stateText(life.caption)}</Text>
                  <Text style={[...label('footnote'), { color: c.inkSecondary }]}>{t('pets.moodLabel', { mood: moodText(life) })}</Text>
                </View>
              </Pressable>
              <View style={styles.actions}>
                <PillButton label={t('pets.feed')} variant="tinted" icon="coffee" disabled={!life.canFeed}
                  style={styles.action} onPress={() => care(pet.id, 'fedAt')} />
                <PillButton label={t('pets.play')} variant="tinted" icon="sun" disabled={!life.canPlay}
                  style={styles.action} onPress={() => care(pet.id, 'playAt')} />
              </View>
            </View>
          );
        })}

        <Text accessibilityRole="header" style={[...label('headline'), { color: c.ink }]}>{t('pets.settings')}</Text>
        <Text style={[...label('subhead'), { color: c.inkSecondary }]}>{t('pets.choose')}</Text>
        <View style={styles.choices}>
          {PETS.map(pet => (
            <Pressable key={pet.id} accessibilityRole="button" accessibilityLabel={nameOf(pet.id)}
              accessibilityState={{ selected: settings.pet === pet.id, disabled: busy }} disabled={busy}
              onPress={() => { haptic('select'); change(s => ({ ...s, pet: pet.id })); }}
              style={[styles.choice, continuous, { backgroundColor: c.fill, borderColor: settings.pet === pet.id ? c.tint : c.separator }]}>
              <IslandPetArt pet={pet.id} frames="sit" size={48} />
              <Text style={[...label('footnote'), { color: c.ink }]}>{nameOf(pet.id)}</Text>
            </Pressable>
          ))}
        </View>

        <SwitchRow label={t('pets.island')} value={available && settings.island} disabled={!available || busy}
          onChange={on => { haptic('select'); change(s => ({ ...s, island: on })); }} />
        <Text accessibilityLiveRegion="polite" style={[...label('footnote'), { color: c.inkSecondary }]}>
          {error ? t('pets.error') : !available ? t('pets.unavailable') : status && !status.enabled ? t('pets.disabled') :
            session ? t('pets.running', { name: nameOf(session.pet) }) : t('pets.off')}
        </Text>
        {available && (error || (status && !status.enabled)) &&
          <PillButton label={t('pets.check')} variant="tinted" disabled={busy} onPress={() => void reconcile()} />}

        <Text style={[...label('subhead'), { color: c.ink }]}>{t('pets.quiet')}</Text>
        {(['quietStart', 'quietEnd'] as const).map(edge => (
          <View key={edge} style={styles.quietRow}>
            <Text style={[...label('body'), styles.quietLabel, { color: c.ink }]}>
              {t(edge === 'quietStart' ? 'pets.bedtime' : 'pets.wake')} · {clock(minuteDate(settings[edge]))}
            </Text>
            <PillButton label="" icon="minus" variant="tinted" accessibilityLabel={t('pets.earlier')} accessibilityHint={t(edge === 'quietStart' ? 'pets.bedtime' : 'pets.wake')}
              onPress={() => change(s => shiftQuiet(s, edge, -30))} />
            <PillButton label="" icon="plus" variant="tinted" accessibilityLabel={t('pets.later')} accessibilityHint={t(edge === 'quietStart' ? 'pets.bedtime' : 'pets.wake')}
              onPress={() => change(s => shiftQuiet(s, edge, 30))} />
          </View>
        ))}
        <Text style={[...label('footnote'), { color: c.inkSecondary }]}>{t('pets.quietHint')}</Text>

        <Text style={[...label('subhead'), { color: c.ink }]}>{t('pets.name')}</Text>
        {PETS.map(pet => (
          <TextInput key={pet.id} defaultValue={settings.names[pet.id] ?? ''} placeholder={pet.name}
            placeholderTextColor={c.inkSecondary} selectionColor={c.tint} maxLength={PET_NAME_MAX}
            accessibilityLabel={pet.name} accessibilityHint={t('pets.name')} autoCorrect={false} returnKeyType="done"
            onEndEditing={e => {
              const name = cleanPetName(e.nativeEvent.text);
              change(s => ({ ...s, names: { ...s.names, [pet.id]: name || undefined } }));
            }}
            style={[...label('body'), styles.input, continuous, { color: c.ink, backgroundColor: c.fill }]} />
        ))}

        <Text style={[...label('footnote'), { color: c.inkSecondary }]}>{t('pets.lifeNote')}</Text>
        <Text style={[...label('footnote'), { color: c.inkSecondary }]}>{t('pets.limits')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1 }, body: { padding: spaceV2.inset, gap: spaceV2.lg, paddingBottom: spaceV2.xxl },
  preview: { padding: spaceV2.inset, borderRadius: radiusV2.card, alignItems: 'center', gap: spaceV2.md },
  island: { backgroundColor: '#19131F', borderRadius: 36, paddingHorizontal: spaceV2.inset, paddingVertical: spaceV2.md, flexDirection: 'row', alignItems: 'center', gap: spaceV2.md, maxWidth: '100%', minHeight: sizeV2.touch },
  previewText: { flexShrink: 1, flexGrow: 1, gap: spaceV2.xs },
  track: { justifyContent: 'center', alignItems: 'center' },
  card: { padding: spaceV2.lg, borderRadius: radiusV2.card, gap: spaceV2.md },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spaceV2.md, minHeight: sizeV2.touch },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: spaceV2.md },
  choice: { flexGrow: 1, flexBasis: 88, borderWidth: 2, borderRadius: radiusV2.control, alignItems: 'center', padding: spaceV2.sm, gap: spaceV2.sm, minHeight: sizeV2.touch },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spaceV2.sm }, action: { flexGrow: 1, flexBasis: 88 },
  quietRow: { flexDirection: 'row', alignItems: 'center', gap: spaceV2.sm },
  quietLabel: { flex: 1 },
  input: { borderRadius: radiusV2.control, paddingHorizontal: spaceV2.lg, minHeight: sizeV2.touch },
});
