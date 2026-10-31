// Toilets tab (T49, owner feedback 1031 C: "if you're travelling with your missus, them things need toilets").
// "Find toilets near me" checks the location once (locateOnce, never continuous) and lists the nearest public
// toilets from OpenStreetMap: from the downloaded city pack when you're inside one (works in flight mode), else
// online via Overpass. Each row: name, distance + walking minutes, an arrow and compass word from where you
// searched, feature chips (fee, wheelchair, changing table, unisex, hours) and Open in Apple Maps for walking
// directions. "Near my hotel" searches around today's hotel when it has coordinates, without location. Free, no
// account. T56: "Ask for a toilet" opens the full-screen phrase card for "Where is the toilet?" in the local
// language (app/phrase-card.tsx), fully offline. Results fade in with a timed transition (skipped with Reduce Motion).
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Animated, FlatList, Linking, Text, View } from 'react-native';
import { deviceZone, todayIn } from '../../src/core/format.ts';
import type { PermissionState } from '../../src/core/permissions.ts';
import type { LatLon } from '../../src/core/poi.ts';
import { appleMapsWalkUrl, arrowDegrees, stayFor, toiletChips, toiletDistance, type ToiletChip, type ToiletHit } from '../../src/core/toilets.ts';
import type { Key } from '../../src/i18n/en.ts';
import { locateOnce } from '../../src/native/location.ts';
import { findToilets, type ToiletSearch } from '../../src/native/toilets.ts';
import { useApp } from '../../src/state/app.tsx';
import { useTrips } from '../../src/state/trips.tsx';
import { dur, duration } from '../../src/theme/motion.ts';
import { fonts, radius, space, typeScale } from '../../src/theme/tokens.ts';
import { FadeInView, HeroHeader, toneColours, type Tone } from '../../src/ui/hero.tsx';
import { Button, Card, EmptyState, Screen } from '../../src/ui/kit.tsx';
import { PermissionNotice } from '../../src/ui/PermissionNotice.tsx';

type Origin = { kind: 'here' } | { kind: 'hotel'; name: string };
type Phase =
  | { s: 'idle' }
  | { s: 'locating' }
  | { s: 'searching'; origin: Origin }
  | { s: 'done'; origin: Origin; result: ToiletSearch; run: number }
  | { s: 'denied'; state: Exclude<PermissionState, 'granted'> }
  | { s: 'unavailable'; servicesOff: boolean };

const chipKey = (c: ToiletChip): Key => `toilets.chip.${c.id}`;
/** T50: each feature chip is tinted by what it means (free / step-free = good, paid / limited = heads-up). */
const CHIP_TONE: Record<ToiletChip['id'], Tone> = {
  free: 'ok',
  paid: 'warn',
  feeUnknown: 'ink',
  wheelchair: 'sea',
  wheelchairLimited: 'warn',
  noWheelchair: 'danger',
  changingTable: 'teal',
  unisex: 'accent',
  customersOnly: 'warn',
  open247: 'ok',
  hours: 'ink',
};

export default function ToiletsScreen() {
  const { t, theme, reduceMotion } = useApp();
  const { trips } = useTrips();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ s: 'idle' });
  const [openFailed, setOpenFailed] = useState(false);
  const fade = useRef(new Animated.Value(1)).current;
  const seq = useRef(0);

  const stay = useMemo(() => stayFor(trips, todayIn(deviceZone())), [trips]);
  const busy = phase.s === 'locating' || phase.s === 'searching';

  const search = useCallback(
    async (at: LatLon, origin: Origin, mine: number) => {
      setPhase({ s: 'searching', origin });
      const result = await findToilets(at);
      if (mine !== seq.current) return;
      fade.setValue(0);
      setPhase({ s: 'done', origin, result, run: mine });
      Animated.timing(fade, { toValue: 1, duration: dur(duration.slow, reduceMotion), useNativeDriver: true }).start();
    },
    [fade, reduceMotion],
  );

  const nearMe = useCallback(async () => {
    if (busy) return;
    const mine = ++seq.current;
    setOpenFailed(false);
    setPhase({ s: 'locating' });
    const r = await locateOnce();
    if (mine !== seq.current) return;
    if (r.ok) await search({ lat: r.coords.lat, lon: r.coords.lon }, { kind: 'here' }, mine);
    else if (r.reason === 'denied') setPhase({ s: 'denied', state: r.state });
    else setPhase({ s: 'unavailable', servicesOff: r.servicesOff });
  }, [busy, search]);

  const nearHotel = useCallback(async () => {
    if (busy || !stay) return;
    const mine = ++seq.current;
    setOpenFailed(false);
    await search({ lat: stay.lat, lon: stay.lon }, { kind: 'hotel', name: stay.name }, mine);
  }, [busy, stay, search]);

  const openMaps = async (h: ToiletHit) => {
    setOpenFailed(false);
    try {
      await Linking.openURL(appleMapsWalkUrl(h.lat, h.lon, h.name));
    } catch {
      setOpenFailed(true);
    }
  };

  const result = phase.s === 'done' ? phase.result : null;
  const hits: ToiletHit[] = result?.ok ? result.toilets : [];
  const backToIdle = () => setPhase({ s: 'idle' });

  const header = (
    <View style={{ gap: space.l, paddingBottom: space.s }}>
      <FadeInView>
        <HeroHeader tone="toilets" illustration="toilet" title={t('toilets.title')} subtitle={t('toilets.subtitle')} />
      </FadeInView>
      <View style={{ gap: space.s }}>
        <Button label={t('toilets.findNearMe')} hint={t('toilets.findNearMeHint')} onPress={nearMe} />
        {stay ? <Button kind="quiet" label={t('toilets.nearHotel')} hint={t('toilets.nearHotelHint', { name: stay.name })} onPress={nearHotel} /> : null}
        <Button
          kind="secondary"
          icon="chatbubble-ellipses-outline"
          label={t('phrases.toiletAsk')}
          hint={t('phrases.toiletAskHint')}
          onPress={() => router.push({ pathname: '/phrase-card', params: { phrase: 'toilet' } })}
        />
      </View>

      {busy ? (
        <Text accessibilityLiveRegion="polite" style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: theme.muted }}>
          {phase.s === 'locating' ? t('toilets.checking') : t('toilets.searching')}
        </Text>
      ) : null}

      {phase.s === 'denied' ? (
        <PermissionNotice
          kind="location"
          state={phase.state}
          reason={phase.state === 'blocked' ? t('toilets.locReason') : undefined}
          onRetry={nearMe}
          fallbackLabel={stay ? t('toilets.locFallback') : t('toilets.locFallbackNone')}
          onFallback={stay ? nearHotel : backToIdle}
        />
      ) : null}
      {phase.s === 'unavailable' && phase.servicesOff ? (
        <PermissionNotice
          kind="location"
          state="unavailable"
          onRetry={nearMe}
          fallbackLabel={stay ? t('toilets.locFallback') : t('toilets.locFallbackNone')}
          onFallback={stay ? nearHotel : backToIdle}
        />
      ) : null}
      {phase.s === 'unavailable' && !phase.servicesOff ? (
        <Text accessibilityLiveRegion="polite" style={{ fontFamily: fonts.body, fontSize: 15, color: theme.ink }}>
          {t('toilets.locUnavailable')}
        </Text>
      ) : null}

      {result && !result.ok ? (
        <Animated.View style={{ opacity: fade }}>
          {result.reason === 'none-found' ? <EmptyState title={t('toilets.noneTitle')} body={t('toilets.noneBody')} /> : null}
          {result.reason === 'offline-no-pack' ? (
            <EmptyState title={t('toilets.offlineTitle')} body={t('toilets.offlineBody')} action={<Button kind="quiet" label={t('common.tryAgain')} onPress={phase.s === 'done' && phase.origin.kind === 'hotel' ? nearHotel : nearMe} />} />
          ) : null}
          {result.reason === 'network' ? (
            <EmptyState title={t('toilets.networkTitle')} body={t('toilets.networkBody')} action={<Button kind="quiet" label={t('common.tryAgain')} onPress={phase.s === 'done' && phase.origin.kind === 'hotel' ? nearHotel : nearMe} />} />
          ) : null}
        </Animated.View>
      ) : null}

      {result?.ok && phase.s === 'done' ? (
        <Animated.View style={{ opacity: fade, gap: space.xs }}>
          <Text accessibilityRole="header" style={{ fontFamily: fonts.displayMedium, fontSize: 20, color: theme.ink }}>
            {phase.origin.kind === 'hotel' ? t('toilets.aroundHotel', { name: phase.origin.name }) : t('toilets.aroundHere')}
          </Text>
          <Text accessibilityLiveRegion="polite" style={{ fontFamily: fonts.body, fontSize: 14, color: theme.muted }}>
            {hits.length === 1 ? t('toilets.count1') : t('toilets.count', { n: hits.length })}
            {' · '}
            {result.source === 'offline' ? t('toilets.source.offline', { city: result.city }) : t('toilets.source.online')}
          </Text>
          <Text style={{ fontFamily: fonts.body, fontSize: 13, color: theme.muted }}>{t('toilets.fromHere')}</Text>
          {openFailed ? (
            <Text accessibilityLiveRegion="polite" style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: theme.danger }}>
              {t('toilets.openFailed')}
            </Text>
          ) : null}
        </Animated.View>
      ) : null}
    </View>
  );

  const footer = (
    <Text style={{ fontFamily: fonts.body, fontSize: 12, color: theme.muted, paddingTop: space.l }}>{t('toilets.attribution')}</Text>
  );

  const run = phase.s === 'done' ? phase.run : 0;
  const renderItem = ({ item: h, index }: { item: ToiletHit; index: number }) => {
    const name = h.name ?? t('toilets.unnamed');
    const d = toiletDistance(h.meters);
    const distance = t('toilets.distance', { n: d.n, unit: d.unit, min: h.minutes });
    const dir = t(h.dirKey);
    const chips = toiletChips(h).map((c) => ({ id: c.id, label: c.id === 'hours' ? t('toilets.chip.hours', { hours: c.text }) : t(chipKey(c)) }));
    return (
      <FadeInView delay={Math.min(index, 6) * 40} style={{ marginBottom: space.m }}>
        <Card style={{ gap: space.m }}>
          <View accessible accessibilityLabel={t('toilets.rowA11y', { name, distance, dir, features: chips.map((c) => c.label).join(', ') })} style={{ gap: space.m }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
              <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: theme.tealSoft, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ transform: [{ rotate: `${arrowDegrees(h.bearing)}deg` }] }}>
                  <Ionicons name="arrow-up" size={26} color={theme.teal} />
                </View>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[typeScale.bodyStrong, { fontSize: 17, color: theme.ink }]}>{name}</Text>
                <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: theme.ink, fontVariant: ['tabular-nums'] }}>{distance}</Text>
                <Text style={[typeScale.small, { color: theme.muted }]}>{t('toilets.direction', { dir })}</Text>
              </View>
            </View>
            {chips.length ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
                {chips.map((c) => {
                  const tone = toneColours(theme, CHIP_TONE[c.id]);
                  return (
                    <View key={c.label} style={{ backgroundColor: tone.bg, borderRadius: radius.pill, paddingHorizontal: space.m, paddingVertical: space.xs }}>
                      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 13, color: CHIP_TONE[c.id] === 'ink' ? theme.ink : tone.fg }}>{c.label}</Text>
                    </View>
                  );
                })}
              </View>
            ) : null}
          </View>
          <Button kind="secondary" icon="walk-outline" label={t('toilets.openMaps')} hint={t('toilets.openMapsHint', { name })} onPress={() => openMaps(h)} />
        </Card>
      </FadeInView>
    );
  };

  return (
    <Screen scroll={false}>
      <FlatList
        style={{ flex: 1 }}
        data={hits}
        keyExtractor={(h) => `${run}:${h.id}`}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  );
}
