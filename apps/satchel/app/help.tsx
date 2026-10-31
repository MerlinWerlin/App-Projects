// T59 Nearest help (owner feedback "it feels bland, deepen the tabs"), opened from the Emergency tab. "Find help near
// me" checks the location once (locateOnce, never continuous) and lists the nearest hospitals and clinics, pharmacies
// and police stations from OpenStreetMap: online via Overpass (with phone numbers and hours when tagged), else from a
// downloaded city pack (format 2 packs carry police, numbers and hours too; an older pack lists hospitals, clinics
// and pharmacies by name only, and the screen says what's missing). Each row:
// type, name, distance + walking minutes, an arrow and compass word, hours / emergency-department chips, Call (tel:)
// when a number is tagged, and Open in Apple Maps for walking directions. "Near my hotel" searches around today's
// hotel without location. Filter chips narrow the list by category. Free, no account. Timed fades only.
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Animated, FlatList, Linking, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { deviceZone, todayIn } from '../src/core/format.ts';
import { countByCategory, filterHelp, HELP_CATEGORIES, helpChips, kindKey, type HelpCategory, type HelpChip, type HelpFilter, type HelpHit } from '../src/core/help.ts';
import type { PermissionState } from '../src/core/permissions.ts';
import type { LatLon } from '../src/core/poi.ts';
import { appleMapsWalkUrl, arrowDegrees, stayFor, toiletDistance } from '../src/core/toilets.ts';
import type { Key } from '../src/i18n/en.ts';
import { findHelp, type HelpSearch } from '../src/native/help.ts';
import { locateOnce } from '../src/native/location.ts';
import { useApp } from '../src/state/app.tsx';
import { useTrips } from '../src/state/trips.tsx';
import { dur, duration } from '../src/theme/motion.ts';
import { fonts, radius, space, typeScale } from '../src/theme/tokens.ts';
import { FadeInView, HeroHeader, IconBadge, toneColours, type IconName, type Tone } from '../src/ui/hero.tsx';
import { Button, Card, Chip, EmptyState } from '../src/ui/kit.tsx';
import { PermissionNotice } from '../src/ui/PermissionNotice.tsx';

type Origin = { kind: 'here' } | { kind: 'hotel'; name: string };
type Phase =
  | { s: 'idle' }
  | { s: 'locating' }
  | { s: 'searching'; origin: Origin }
  | { s: 'done'; origin: Origin; result: HelpSearch; run: number }
  | { s: 'denied'; state: Exclude<PermissionState, 'granted'> }
  | { s: 'unavailable'; servicesOff: boolean };

const ICON: Record<HelpCategory, IconName> = { medical: 'medkit-outline', pharmacy: 'medical-outline', police: 'shield-outline' };
const TONE: Record<HelpCategory, Tone> = { medical: 'danger', pharmacy: 'ok', police: 'sea' };
const CHIP_TONE: Record<HelpChip['id'], Tone> = { emergencyDept: 'danger', open247: 'ok', hours: 'ink' };
const FILTERS: readonly HelpFilter[] = ['all', ...HELP_CATEGORIES];

export default function HelpScreen() {
  const { t, theme, reduceMotion } = useApp();
  const { trips } = useTrips();
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>({ s: 'idle' });
  const [filter, setFilter] = useState<HelpFilter>('all');
  const [failure, setFailure] = useState<{ kind: 'maps' } | { kind: 'call'; phone: string } | null>(null);
  const fade = useRef(new Animated.Value(1)).current;
  const seq = useRef(0);

  const stay = useMemo(() => stayFor(trips, todayIn(deviceZone())), [trips]);
  const busy = phase.s === 'locating' || phase.s === 'searching';

  const search = useCallback(
    async (at: LatLon, origin: Origin, mine: number) => {
      setPhase({ s: 'searching', origin });
      const result = await findHelp(at);
      if (mine !== seq.current) return;
      fade.setValue(0);
      setFilter('all');
      setPhase({ s: 'done', origin, result, run: mine });
      Animated.timing(fade, { toValue: 1, duration: dur(duration.slow, reduceMotion), useNativeDriver: true }).start();
    },
    [fade, reduceMotion],
  );

  const nearMe = useCallback(async () => {
    if (busy) return;
    const mine = ++seq.current;
    setFailure(null);
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
    setFailure(null);
    await search({ lat: stay.lat, lon: stay.lon }, { kind: 'hotel', name: stay.name }, mine);
  }, [busy, stay, search]);

  const openMaps = async (h: HelpHit, name: string) => {
    setFailure(null);
    try {
      await Linking.openURL(appleMapsWalkUrl(h.lat, h.lon, h.name ?? name));
    } catch {
      setFailure({ kind: 'maps' });
    }
  };

  const call = async (h: HelpHit) => {
    if (!h.tel || !h.phone) return;
    setFailure(null);
    try {
      await Linking.openURL(h.tel);
    } catch {
      setFailure({ kind: 'call', phone: h.phone });
    }
  };

  const result = phase.s === 'done' ? phase.result : null;
  const all: HelpHit[] = result?.ok ? result.places : [];
  const counts = useMemo(() => countByCategory(all), [all]);
  const hits = useMemo(() => filterHelp(all, filter), [all, filter]);
  const retry = phase.s === 'done' && phase.origin.kind === 'hotel' ? nearHotel : nearMe;
  const backToIdle = () => setPhase({ s: 'idle' });
  const filterLabel = (f: HelpFilter) => t(`help.filter.${f}`);

  const header = (
    <View style={{ gap: space.l, paddingBottom: space.s }}>
      <FadeInView>
        <HeroHeader tone="emergency" illustration="cross" compact title={t('help.heroTitle')} subtitle={t('help.subtitle')} />
      </FadeInView>
      <View style={{ flexDirection: 'row', gap: space.m, alignItems: 'flex-start' }}>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ paddingTop: 2 }}>
          <Ionicons name="call-outline" size={18} color={theme.danger} />
        </View>
        <Text style={[typeScale.small, { flex: 1, color: theme.ink }]}>{t('help.callFirst')}</Text>
      </View>
      <View style={{ gap: space.s }}>
        <Button icon="locate-outline" label={t('help.findNearMe')} hint={t('help.findNearMeHint')} onPress={nearMe} />
        {stay ? <Button kind="quiet" icon="bed-outline" label={t('help.nearHotel')} hint={t('help.nearHotelHint', { name: stay.name })} onPress={nearHotel} /> : null}
      </View>

      {busy ? (
        <Text accessibilityLiveRegion="polite" style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: theme.muted }}>
          {phase.s === 'locating' ? t('help.checking') : t('help.searching')}
        </Text>
      ) : null}

      {phase.s === 'denied' ? (
        <PermissionNotice
          kind="location"
          state={phase.state}
          reason={phase.state === 'blocked' ? t('help.locReason') : undefined}
          onRetry={nearMe}
          fallbackLabel={stay ? t('help.locFallback') : t('help.locFallbackNone')}
          onFallback={stay ? nearHotel : backToIdle}
        />
      ) : null}
      {phase.s === 'unavailable' && phase.servicesOff ? (
        <PermissionNotice
          kind="location"
          state="unavailable"
          onRetry={nearMe}
          fallbackLabel={stay ? t('help.locFallback') : t('help.locFallbackNone')}
          onFallback={stay ? nearHotel : backToIdle}
        />
      ) : null}
      {phase.s === 'unavailable' && !phase.servicesOff ? (
        <Text accessibilityLiveRegion="polite" style={{ fontFamily: fonts.body, fontSize: 15, color: theme.ink }}>
          {t('help.locUnavailable')}
        </Text>
      ) : null}

      {result && !result.ok ? (
        <Animated.View style={{ opacity: fade, gap: space.s }}>
          {result.reason === 'none-found' ? <EmptyState icon="medkit-outline" title={t('help.noneTitle')} body={t('help.noneBody')} /> : null}
          {result.reason === 'none-found' && result.packCity && result.packLimited ? <Text style={[typeScale.small, { color: theme.muted }]}>{t('help.offlineLimits')}</Text> : null}
          {result.reason === 'offline-no-pack' ? (
            <EmptyState icon="cloud-offline-outline" title={t('help.offlineTitle')} body={t('help.offlineBody')} action={<Button kind="quiet" label={t('common.tryAgain')} onPress={retry} />} />
          ) : null}
          {result.reason === 'network' ? (
            <EmptyState icon="cloud-offline-outline" title={t('help.networkTitle')} body={t('help.networkBody')} action={<Button kind="quiet" label={t('common.tryAgain')} onPress={retry} />} />
          ) : null}
        </Animated.View>
      ) : null}

      {result?.ok && phase.s === 'done' ? (
        <Animated.View style={{ opacity: fade, gap: space.s }}>
          <Text accessibilityRole="header" style={{ fontFamily: fonts.displayMedium, fontSize: 20, color: theme.ink }}>
            {phase.origin.kind === 'hotel' ? t('help.aroundHotel', { name: phase.origin.name }) : t('help.aroundHere')}
          </Text>
          <Text accessibilityLiveRegion="polite" style={{ fontFamily: fonts.body, fontSize: 14, color: theme.muted }}>
            {all.length === 1 ? t('help.count1') : t('help.count', { n: all.length })}
            {' · '}
            {result.source === 'online' ? t('help.source.online') : result.fallback ? t('help.source.fallback', { city: result.city }) : t('help.source.offline', { city: result.city })}
          </Text>
          {result.source === 'offline' ? (
            <View style={{ flexDirection: 'row', gap: space.s, backgroundColor: theme.warnSoft, borderRadius: radius.m, padding: space.m }}>
              <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <Ionicons name="information-circle-outline" size={18} color={theme.warn} />
              </View>
              <Text style={[typeScale.small, { flex: 1, color: theme.ink }]}>{result.limited ? t('help.offlineLimits') : t('help.offlinePackNote')}</Text>
            </View>
          ) : null}
          <View accessibilityRole="radiogroup" accessibilityLabel={t('help.title')} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s, paddingTop: space.xs }}>
            {FILTERS.map((f) => (
              <Chip key={f} label={t('help.filterChip', { label: filterLabel(f), n: f === 'all' ? all.length : counts[f] })} selected={filter === f} onPress={() => setFilter(f)} />
            ))}
          </View>
          <Text style={{ fontFamily: fonts.body, fontSize: 13, color: theme.muted }}>{t('help.fromHere')}</Text>
          {failure ? (
            <Text accessibilityLiveRegion="polite" style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: theme.danger }}>
              {failure.kind === 'maps' ? t('help.openFailed') : t('help.callFailed', { phone: failure.phone })}
            </Text>
          ) : null}
          {hits.length === 0 ? <Text style={[typeScale.body, { color: theme.muted }]}>{filter === 'police' && result.source === 'offline' && result.limited ? t('help.offlineLimits') : t('help.filterNone')}</Text> : null}
        </Animated.View>
      ) : null}
    </View>
  );

  const footer = <Text style={{ fontFamily: fonts.body, fontSize: 12, color: theme.muted, paddingTop: space.l }}>{t('help.attribution')}</Text>;

  const run = phase.s === 'done' ? phase.run : 0;
  const renderItem = ({ item: h, index }: { item: HelpHit; index: number }) => {
    const kind = t(kindKey(h) as Key);
    const name = h.name ?? t('help.unnamed', { kind });
    const d = toiletDistance(h.meters);
    const distance = t('help.distance', { n: d.n, unit: d.unit, min: h.minutes });
    const dir = t(h.dirKey);
    const chips = helpChips(h).map((c) => ({ id: c.id, label: c.id === 'hours' ? t('help.chip.hours', { hours: c.text }) : t(`help.chip.${c.id}`) }));
    const details = [...chips.map((c) => c.label), h.phone ?? t('help.noPhone')].join(', ');
    const tone = toneColours(theme, TONE[h.category]);
    return (
      <FadeInView delay={Math.min(index, 6) * 40} style={{ marginBottom: space.m }}>
        <Card style={{ gap: space.m }}>
          <View accessible accessibilityLabel={t('help.rowA11y', { kind, name, distance, dir, details })} style={{ gap: space.m }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
              <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: tone.bg, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ transform: [{ rotate: `${arrowDegrees(h.bearing)}deg` }] }}>
                  <Ionicons name="arrow-up" size={26} color={tone.fg} />
                </View>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
                  <Ionicons name={ICON[h.category]} size={14} color={tone.fg} />
                  <Text style={[typeScale.caption, { color: tone.fg }]}>{kind}</Text>
                </View>
                <Text style={[typeScale.bodyStrong, { fontSize: 17, color: theme.ink }]}>{name}</Text>
                <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: theme.ink, fontVariant: ['tabular-nums'] }}>{distance}</Text>
                <Text style={[typeScale.small, { color: theme.muted }]}>{t('help.direction', { dir })}</Text>
              </View>
            </View>
            {chips.length ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
                {chips.map((c) => {
                  const ct = toneColours(theme, CHIP_TONE[c.id]);
                  return (
                    <View key={c.label} style={{ backgroundColor: ct.bg, borderRadius: radius.pill, paddingHorizontal: space.m, paddingVertical: space.xs }}>
                      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 13, color: CHIP_TONE[c.id] === 'ink' ? theme.ink : ct.fg }}>{c.label}</Text>
                    </View>
                  );
                })}
              </View>
            ) : result?.ok && (result.source === 'online' || !result.limited) ? (
              <Text style={[typeScale.small, { color: theme.muted }]}>{t('help.noHours')}</Text>
            ) : null}
          </View>
          {h.tel && h.phone ? <Button icon="call-outline" label={t('help.call', { phone: h.phone })} hint={t('help.callHint', { name })} onPress={() => call(h)} /> : null}
          <Button kind="secondary" icon="walk-outline" label={t('help.openMaps')} hint={t('help.openMapsHint', { name })} onPress={() => openMaps(h, name)} />
        </Card>
      </FadeInView>
    );
  };

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: theme.paper }}
      contentContainerStyle={{ paddingTop: space.m, paddingBottom: insets.bottom + space.xxl, paddingHorizontal: space.l }}
      data={hits}
      keyExtractor={(h) => `${run}:${h.id}`}
      renderItem={renderItem}
      ListHeaderComponent={header}
      ListFooterComponent={footer}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      initialNumToRender={6}
    />
  );
}
