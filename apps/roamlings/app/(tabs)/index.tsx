import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type GameEvent, buddy, careReadyAt } from '../../src/core/game';
import { type CareAction, DAILY_SPARK_CAP, EGG_COST, moodFor, stageProgress } from '../../src/core/growth';
import { getSpecies } from '../../src/core/species';
import { petName, speciesName, t } from '../../src/i18n';
import { type StepsStatus, stepsPermission, stepsToday, watchSteps } from '../../src/native/steps';
import { actions, getGame, useGame } from '../../src/store/game';
import { space, type as ty, useColors } from '../../src/theme/tokens';
import { useHaptics } from '../../src/ui/haptics';
import { Button, Card, Egg, Meter, RarityBadge, formatDuration, regionTint } from '../../src/ui/kit';
import { PetView } from '../../src/ui/PetView';

const CARE: { action: CareAction; icon: keyof typeof Feather.glyphMap }[] = [
  { action: 'feed', icon: 'coffee' },
  { action: 'pet', icon: 'heart' },
  { action: 'play', icon: 'sun' },
];

export default function Home() {
  const g = useGame();
  const { c } = useColors();
  const insets = useSafeAreaInsets();
  const h = useHaptics();
  const [stepsStatus, setStepsStatus] = useState<StepsStatus | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((events: GameEvent[]) => {
    let msg: string | null = null;
    for (const e of events) {
      if (e.kind === 'egg') msg = t('home.newEgg');
      if (e.kind === 'evolved') {
        const p = getGame().pets.find((x) => x.id === e.petId);
        msg = t('home.evolved', { name: p ? petName(p) : '' });
      }
      if (!msg && e.kind === 'spark' && e.capped) msg = t('home.sparkCap');
    }
    if (!msg) return;
    h.success();
    setBanner(msg);
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    bannerTimer.current = setTimeout(() => setBanner(null), 3500);
  }, [h]);

  const readSteps = useCallback(async () => {
    actions.refresh();
    const status = await stepsPermission();
    setStepsStatus(status);
    if (status !== 'ok') return;
    const n = await stepsToday();
    if (n !== null) show(actions.steps(n));
  }, [show]);

  // Read steps whenever Home is shown or the app comes back to the front.
  useFocusEffect(
    useCallback(() => {
      readSteps().catch(() => {});
    }, [readSteps]),
  );
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') readSteps().catch(() => {});
    });
    return () => sub.remove();
  }, [readSteps]);

  // Android can't read today's history, so count live steps on top of what we already have.
  useEffect(() => {
    if (Platform.OS === 'ios' || stepsStatus !== 'ok') return;
    const base = getGame().stepsCounted;
    return watchSteps((n) => show(actions.steps(base + n)));
  }, [stepsStatus, show]);

  // Tick once a minute for cooldown labels and happiness.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const pet = buddy(g);
  const mood = moodFor(g.happiness);
  const eggPct = g.eggSpark / EGG_COST;
  const tint = regionTint[g.region] ?? '#A08C5B';

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: space.lg, paddingTop: insets.top + space.md, gap: space.lg, paddingBottom: space.xxl }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={[ty.title, { color: c.ink }]} accessibilityRole="header">{t('app.name')}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.cardAlt, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 }}>
          <Feather name="map-pin" size={14} color={c.ink2} />
          <Text style={[ty.small, { color: c.ink2 }]}>{t(`region.${g.region}`)}</Text>
        </View>
      </View>

      {banner ? (
        <View accessibilityLiveRegion="polite" style={{ backgroundColor: c.accent, borderRadius: 16, padding: space.md }}>
          <Text style={[ty.bodyBold, { color: c.accentInk, textAlign: 'center' }]}>{banner}</Text>
        </View>
      ) : null}

      {pet ? (
        <Card style={{ alignItems: 'center', gap: space.sm }}>
          <View accessible accessibilityLabel={t('a11y.pet', { name: petName(pet), species: speciesName(pet.speciesId), rarity: t(`rarity.${pet.rarity}`), stage: t(`stage.${pet.stage}`), mood: t(`mood.${mood}`) })}>
            <PetView pet={pet} size={220} mood={mood} animate />
          </View>
          <Text style={[ty.h2, { color: c.ink }]}>{petName(pet)}</Text>
          <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
            <RarityBadge rarity={pet.rarity} />
            <Text style={[ty.small, { color: c.ink2 }]}>
              {t(`stage.${pet.stage}`)} · {t(`element.${getSpecies(pet.speciesId).element}`)} · {t(`mood.${mood}`)}
            </Text>
          </View>
          <View style={{ alignSelf: 'stretch', gap: 6, marginTop: space.sm }}>
            <Text style={[ty.small, { color: c.ink2 }]}>{pet.stage === 2 && pet.branch ? `${t('home.grown')} · ${t(`branch.${pet.branch}`)}` : t('home.stage')}</Text>
            <Meter value={stageProgress(pet)} color={c.good} track={c.meterTrack} />
          </View>
          <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md, alignSelf: 'stretch' }}>
            {CARE.map(({ action, icon }) => {
              const readyAt = careReadyAt(g, action);
              const waiting = readyAt > now;
              return (
                <View key={action} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                  <Button
                    kind="soft"
                    label={t(`care.${action}`)}
                    icon={<Feather name={icon} size={16} color={c.accent} />}
                    disabled={waiting}
                    onPress={() => {
                      show(actions.care(action));
                      setNow(Date.now());
                    }}
                    style={{ alignSelf: 'stretch', paddingHorizontal: space.sm }}
                  />
                  <Text style={[ty.small, { color: c.ink3, minHeight: 16 }]}>{waiting ? formatDuration(readyAt - now) : ' '}</Text>
                </View>
              );
            })}
          </View>
        </Card>
      ) : (
        <Card style={{ alignItems: 'center', gap: space.sm }}>
          <Egg size={180} tint={tint} />
          <Text style={[ty.h2, { color: c.ink }]}>{t('home.noPet.title')}</Text>
          <Text style={[ty.body, { color: c.ink2, textAlign: 'center' }]}>{t('home.noPet.body')}</Text>
        </Card>
      )}

      <Card style={{ gap: space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <View style={{ backgroundColor: c.nest, borderRadius: 20, padding: 4 }}>
            <Egg size={64} tint={tint} />
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={[ty.bodyBold, { color: c.ink }]}>
              {g.eggsReady > 0 ? (g.eggsReady === 1 ? t('home.egg.ready.one') : t('home.egg.ready.many', { n: g.eggsReady })) : t('home.egg.meter')}
            </Text>
            <Meter value={eggPct} color={c.spark} track={c.meterTrack} label={t('a11y.meter', { pct: Math.round(eggPct * 100) })} />
            <Text style={[ty.small, { color: c.ink3 }]}>{t('home.egg.meterValue', { n: g.eggSpark, max: EGG_COST })}</Text>
          </View>
        </View>
        {g.eggsReady >= 3 ? <Text style={[ty.small, { color: c.ink2 }]}>{t('home.egg.full')}</Text> : null}
        <Button label={t('home.hatch')} disabled={g.eggsReady <= 0} onPress={() => router.push('/hatch')} />
      </Card>

      <Card style={{ gap: space.md }}>
        <Text style={[ty.bodyBold, { color: c.ink }]}>{t('home.today')}</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Stat label={t('home.steps')} value={g.stepsCounted.toLocaleString()} />
          <Stat label={t('home.spark')} value={`${g.sparkToday}/${DAILY_SPARK_CAP}`} />
          <Stat label={t('home.streak')} value={t('home.streakDays', { n: g.streak.count })} />
        </View>
        {stepsStatus === 'denied' ? (
          <View style={{ gap: space.sm }}>
            <Text style={[ty.small, { color: c.ink2 }]}>{t('settings.stepsDenied')}</Text>
            <Button kind="plain" label={t('settings.openSettings')} onPress={() => Linking.openSettings().catch(() => {})} />
          </View>
        ) : null}
        <Button kind="soft" label={t('home.focus')} icon={<Feather name="clock" size={16} color={c.accent} />} onPress={() => router.push('/focus')} />
        <Text style={[ty.small, { color: c.ink3, textAlign: 'center' }]}>{t('home.focusHint')}</Text>
      </Card>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const { c } = useColors();
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={[ty.h2, { color: c.ink, fontVariant: ['tabular-nums'] }]}>{value}</Text>
      <Text style={[ty.small, { color: c.ink3 }]}>{label}</Text>
    </View>
  );
}
