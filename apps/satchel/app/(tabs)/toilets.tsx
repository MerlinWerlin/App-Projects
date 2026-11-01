// Toilets tab (T49, owner feedback 1031 C: "if you're travelling with your missus, them things need toilets").
// "Find toilets near me" checks the location once (locateOnce, never continuous) and lists the nearest public
// toilets from OpenStreetMap: from the downloaded city pack when you're inside one (works in flight mode), else
// online via Overpass. Each row: name, distance + walking minutes, an arrow and compass word from where you
// searched, feature chips (fee, wheelchair, changing table, unisex, hours) and Open in Apple Maps for walking
// directions. "Near my hotel" searches around today's hotel when it has coordinates, without location. Free, no
// account. T56: "Ask for a toilet" opens the full-screen phrase card for "Where is the toilet?" in the local
// language (app/phrase-card.tsx), fully offline. Results fade in with a timed transition (skipped with Reduce Motion).
// T79 (deeper): each row says "Open now · closes 18:00" / "Closed · opens 09:00" from its opening_hours, read in the
// searched place's zone (src/core/openinghours.ts; unknown forms say nothing). Filter chips with counts (Free,
// Wheelchair, Changing table, Open now, Unisex) are remembered on the phone. A List / Map switch shows the results
// as markers around the search point (with the offline city tiles when that city is downloaded); tapping a marker
// shows its card. "My toilets": Save with a private note and thumbs up/down; saved ones near the search point come
// first. "Recently used" keeps the last 10 opened in Apple Maps. All stored on the phone only. The Map tab's
// "Nearest toilet" opens this tab with ?find=<nonce>, which starts a search once. T120: a saved toilet pin on the Map
// tab opens it with ?focus=<token> (src/core/followups99.ts): My toilets highlights that toilet and scrolls to it.
// T119: signpost hero scene (entrance on every tab focus), Find one / Yours section headers and the shared rhythm.
// T157: on the map view, wheelchair-accessible toilets get their own glyph and colour (src/core/toiletpins.ts) with a
// small legend under the map (the list view's wheelchair chip already uses the same sea colour).
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, FlatList, Linking, Text, View } from 'react-native';
import { pickCityFor, type CityMap } from '../../src/core/citymaps.ts';
import { deviceZone, todayIn } from '../../src/core/format.ts';
import type { PermissionState } from '../../src/core/permissions.ts';
import { regionFor, type LatLon, type Region } from '../../src/core/poi.ts';
import {
  applyFilters,
  arrange,
  filterCounts,
  parseFilters,
  parseRecent,
  parseSaved,
  pushRecent,
  savedOf,
  setNote,
  setVote,
  statusFor,
  toggleFilter,
  toggleSaved,
  TOILET_FILTERS_KEY,
  TOILET_RECENT_KEY,
  TOILET_SAVED_KEY,
  TOILET_VIEW_KEY,
  weekdayOf,
  type Arranged,
  type FilterId,
  type RecentToilet,
  type SavedToilet,
} from '../../src/core/toiletplus.ts';
import { appleMapsWalkUrl, stayFor, toiletDistance, type Toilet } from '../../src/core/toilets.ts';
import { fromUtc } from '../../src/core/tz.ts';
import type { HoursStatus } from '../../src/core/openinghours.ts';
import { listInstalled, offlineTilesFor } from '../../src/native/cityMaps.ts';
import { locateOnce } from '../../src/native/location.ts';
import { mapAvailable, SatchelMap, type MapPin } from '../../src/native/maps.tsx';
import { findToilets, type ToiletSearch } from '../../src/native/toilets.ts';
import { useApp } from '../../src/state/app.tsx';
import { usePersisted } from '../../src/state/persisted.ts';
import { clearNearestToilet, useNearestToiletRequest } from '../../src/state/nearestToilet.ts';
import { nextFindNonce } from '../../src/core/followups89.ts';
import { scrollTargetY } from '../../src/core/followups97.ts';
import { encodeToiletFocus, nextToiletFocus } from '../../src/core/followups99.ts';
import { clearToiletFocus, useToiletFocusRequest } from '../../src/state/focusToilet.ts';
import { useTrips } from '../../src/state/trips.tsx';
import { dur, duration } from '../../src/theme/motion.ts';
import { fonts, rhythm, space } from '../../src/theme/tokens.ts';
import { FadeInView, FocusEntrance, HeroHeader, SectionHeader } from '../../src/ui/hero.tsx';
import { Button, EmptyState, Screen } from '../../src/ui/kit.tsx';
import { PermissionNotice } from '../../src/ui/PermissionNotice.tsx';
import { FilterBar, MineSection, RecentSection, ToiletCard, ViewToggle } from '../../src/ui/toiletplus.tsx';
import { accessibleCount, accessibleFirst, accessibleOnly, setAccessibleOnly } from '../../src/core/stepfree.ts';
import { useStepFree } from '../../src/state/stepfree.ts';
import { ToiletAccessBar } from '../../src/ui/stepfree.tsx';
import { toiletLegend, toiletPinStyle } from '../../src/core/toiletpins.ts';
import { ToiletPinLegend } from '../../src/ui/toiletPinLegend.tsx';

type Origin = { kind: 'here'; at: LatLon; tz: string } | { kind: 'hotel'; at: LatLon; tz: string; name: string };
type Phase =
  | { s: 'idle' }
  | { s: 'locating' }
  | { s: 'searching'; origin: Origin }
  | { s: 'done'; origin: Origin; result: ToiletSearch; run: number }
  | { s: 'denied'; state: Exclude<PermissionState, 'granted'> }
  | { s: 'unavailable'; servicesOff: boolean };

const NONE: unknown = [];
const LIST_VIEW: 'list' | 'map' = 'list';
const MAP_HEIGHT = 380;
/** Re-read open/closed each minute while results are on screen. */
const TICK_MS = 60_000;

type Row = Arranged & { status: HoursStatus };

export default function ToiletsScreen() {
  const { t, theme, reduceMotion } = useApp();
  const { trips } = useTrips();
  const router = useRouter();
  const params = useLocalSearchParams<{ find?: string; focus?: string }>();
  const [phase, setPhase] = useState<Phase>({ s: 'idle' });
  const [openFailed, setOpenFailed] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [cities, setCities] = useState<CityMap[]>([]);
  const fade = useRef(new Animated.Value(1)).current;
  const seq = useRef(0);
  const handledFind = useRef<Set<string>>(new Set());
  const requested = useNearestToiletRequest();
  // T120: a saved toilet's pin on the Map tab opens this tab at that toilet in My toilets (one-time token).
  const focusRequested = useToiletFocusRequest();
  const handledFocus = useRef<Set<string>>(new Set());
  const [focusId, setFocusId] = useState<string | null>(null);
  const [focusGone, setFocusGone] = useState(false);
  const listRef = useRef<FlatList<Row>>(null);
  const listBox = useRef<View>(null);
  const scrollY = useRef(0);

  const [rawFilters, setRawFilters] = usePersisted<unknown>(TOILET_FILTERS_KEY, NONE);
  const [rawSaved, setRawSaved, savedLoaded] = usePersisted<unknown>(TOILET_SAVED_KEY, NONE);
  const [rawRecent, setRawRecent] = usePersisted<unknown>(TOILET_RECENT_KEY, NONE);
  const [view, setView] = usePersisted<'list' | 'map'>(TOILET_VIEW_KEY, LIST_VIEW);
  const filters = useMemo(() => parseFilters(rawFilters), [rawFilters]);
  const saved = useMemo(() => parseSaved(rawSaved), [rawSaved]);
  const recent = useMemo(() => parseRecent(rawRecent), [rawRecent]);

  const stay = useMemo(() => stayFor(trips, todayIn(deviceZone())), [trips]);
  const busy = phase.s === 'locating' || phase.s === 'searching';

  const search = useCallback(
    async (origin: Origin, mine: number) => {
      setPhase({ s: 'searching', origin });
      setSelectedId(null);
      const result = await findToilets(origin.at);
      if (mine !== seq.current) return;
      setNow(Date.now());
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
    // You're standing there, so the phone's own zone is the place's zone.
    if (r.ok) await search({ kind: 'here', at: { lat: r.coords.lat, lon: r.coords.lon }, tz: deviceZone() }, mine);
    else if (r.reason === 'denied') setPhase({ s: 'denied', state: r.state });
    else setPhase({ s: 'unavailable', servicesOff: r.servicesOff });
  }, [busy, search]);

  const nearHotel = useCallback(async () => {
    if (busy || !stay) return;
    const mine = ++seq.current;
    setOpenFailed(false);
    await search({ kind: 'hotel', at: { lat: stay.lat, lon: stay.lon }, tz: stay.tz ?? deviceZone(), name: stay.name }, mine);
  }, [busy, stay, search]);

  // Map tab "Nearest toilet": each new nonce starts one search. T80: the in-memory request also reaches this tab when
  // it is already open (its params may not change); a request made during a search runs once that search ends.
  useEffect(() => {
    const f = nextFindNonce([requested, typeof params.find === 'string' ? params.find : null], handledFind.current, busy);
    if (!f) return;
    handledFind.current.add(f);
    clearNearestToilet(f);
    nearMe();
  }, [requested, params.find, nearMe, busy]);

  // Runs once the saved list is read, so a toilet saved earlier is found; one that was removed says so.
  useEffect(() => {
    if (!savedLoaded) return;
    const f = nextToiletFocus([focusRequested, params.focus], handledFocus.current);
    if (!f) return;
    handledFocus.current.add(f.nonce);
    clearToiletFocus(encodeToiletFocus(f));
    const hit = saved.find((s) => s.toilet.id === f.toiletId);
    setFocusId(hit ? f.toiletId : null);
    setFocusGone(!hit);
    AccessibilityInfo.announceForAccessibility(hit ? t('f99.toilet.fromMapA11y', { name: hit.toilet.name ?? t('toilets.unnamed') }) : t('f99.toilet.gone'));
  }, [focusRequested, params.focus, savedLoaded, saved, t]);
  const scrollToFocus = useCallback(
    (rowWindowY: number) =>
      listBox.current?.measureInWindow((_x, top) => listRef.current?.scrollToOffset({ offset: scrollTargetY(scrollY.current, rowWindowY, top, space.l), animated: !reduceMotion })),
    [reduceMotion],
  );

  const done = phase.s === 'done' ? phase : null;
  const result = done?.result ?? null;

  // Keep the open/closed lines current while results are showing.
  useEffect(() => {
    if (!result?.ok) return;
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [result]);

  // Downloaded cities, for drawing offline tiles under the markers.
  useEffect(() => {
    if (!result?.ok) return;
    let live = true;
    listInstalled()
      .then((list) => live && setCities(list))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [result]);

  const openMaps = useCallback(
    async (h: Toilet) => {
      setOpenFailed(false);
      try {
        await Linking.openURL(appleMapsWalkUrl(h.lat, h.lon, h.name));
        setRawRecent((old: unknown) => pushRecent(parseRecent(old), h, Date.now()));
      } catch {
        setOpenFailed(true);
      }
    },
    [setRawRecent],
  );

  const onToggleSave = useCallback((h: Toilet) => setRawSaved((old: unknown) => toggleSaved(parseSaved(old), h, Date.now())), [setRawSaved]);
  const onNote = useCallback((id: string, note: string) => setRawSaved((old: unknown) => setNote(parseSaved(old), id, note)), [setRawSaved]);
  const onVote = useCallback((id: string, v: 'up' | 'down') => setRawSaved((old: unknown) => setVote(parseSaved(old), id, v)), [setRawSaved]);
  const onToggleFilter = useCallback((f: FilterId) => setRawFilters((old: unknown) => toggleFilter(parseFilters(old), f)), [setRawFilters]);

  const tz = done?.origin.tz ?? deviceZone();
  const weekday = useMemo(() => weekdayOf(fromUtc(now, tz)), [now, tz]);
  const allRows: Row[] = useMemo(() => {
    if (!done || !result?.ok) return [];
    return arrange(result.toilets, saved, done.origin.at).map((h) => ({ ...h, status: statusFor(h, now, done.origin.tz) }));
  }, [done, result, saved, now]);
  const asFilterRows = useMemo(() => allRows.map((r) => ({ hit: r, status: r.status })), [allRows]);
  // T156: with access needs set (phone only), wheelchair / changing-table toilets first, plus the Accessible only filter.
  const [stepFree, changeStepFree] = useStepFree();
  const filtered = useMemo(() => accessibleFirst(applyFilters(asFilterRows, filters).map((r) => r.hit), stepFree.needs), [asFilterRows, filters, stepFree.needs]);
  const rows = useMemo(() => accessibleOnly(filtered, stepFree), [filtered, stepFree]);
  const accessibleN = useMemo(() => accessibleCount(filtered, stepFree.needs), [filtered, stepFree.needs]);
  const counts = useMemo(() => filterCounts(asFilterRows, filters), [asFilterRows, filters]);
  const anyPinned = rows.some((r) => r.pinned);
  const openNowOn = filters.includes('openNow');
  const selected = selectedId ? (rows.find((r) => r.id === selectedId) ?? null) : null;

  const backToIdle = () => setPhase({ s: 'idle' });

  const renderCard = (h: Row) => (
    <ToiletCard
      hit={h}
      status={h.status}
      weekday={weekday}
      labelUnknown={openNowOn}
      pinned={h.pinned}
      saved={savedOf(saved, h.id)}
      onToggleSave={() => onToggleSave(h)}
      onNote={(note) => onNote(h.id, note)}
      onVote={(v) => onVote(h.id, v)}
      onOpenMaps={() => openMaps(h)}
    />
  );

  // --------------------------------------------------------------------------------------------------- map view
  const originLabel = done ? (done.origin.kind === 'hotel' ? t('toiletplus.searchHotel', { name: done.origin.name }) : t('toiletplus.searchPoint')) : '';
  const pins: MapPin[] = useMemo(() => {
    if (!done) return [];
    const out: MapPin[] = rows.map((r) => {
      const name = r.name ?? t('toilets.unnamed');
      const look = toiletPinStyle(r, { saved: r.pinned, closed: r.status.state === 'closed' });
      return {
        id: `t:${r.id}`,
        lat: r.lat,
        lon: r.lon,
        title: name,
        subtitle: t('toilets.distance', { ...toiletDistance(r.meters), min: r.minutes }),
        color: theme[look.tone],
        glyph: look.icon as MapPin['glyph'],
        a11y: look.kind === 'accessible' ? t('f110.toilets.pinAccessibleA11y', { name }) : name,
      };
    });
    out.push({ id: 'origin', lat: done.origin.at.lat, lon: done.origin.at.lon, title: originLabel, color: theme.accent, a11y: originLabel });
    return out;
  }, [done, rows, theme, t, originLabel]);
  const initialRegion: Region | null = useMemo(() => (done ? regionFor([done.origin.at, ...rows.slice(0, 15)], 0.01) : null), [done, rows]);
  const offlineCity = useMemo(() => (done ? pickCityFor(done.origin.at.lat, done.origin.at.lon, cities) : null), [done, cities]);
  const offlineTiles = useMemo(() => (offlineCity ? offlineTilesFor(offlineCity) : null), [offlineCity]);
  const onPinPress = useCallback((id: string) => setSelectedId(id.startsWith('t:') ? id.slice(2) : null), []);

  const showResults = !!(result?.ok && done);
  const header = (
    <View style={{ gap: rhythm.section, paddingBottom: rhythm.tight }}>
      <HeroHeader scene="toilets" title={t('toilets.title')} subtitle={t('toilets.subtitle')} />
      <FocusEntrance delay={60} style={{ gap: rhythm.tight }}>
        <SectionHeader title={t('look2.toilets.sectionFind')} icon="navigate-outline" tone="teal" />
        <Button label={t('toilets.findNearMe')} hint={t('toilets.findNearMeHint')} onPress={nearMe} />
        {stay ? <Button kind="quiet" label={t('toilets.nearHotel')} hint={t('toilets.nearHotelHint', { name: stay.name })} onPress={nearHotel} /> : null}
        <Button
          kind="secondary"
          icon="chatbubble-ellipses-outline"
          label={t('phrases.toiletAsk')}
          hint={t('phrases.toiletAskHint')}
          onPress={() => router.push({ pathname: '/phrase-card', params: { phrase: 'toilet' } })}
        />
      </FocusEntrance>

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
          {result.reason === 'none-found' ? <EmptyState art="mapPin" title={t('toilets.noneTitle')} body={t('toilets.noneBody')} /> : null}
          {result.reason === 'offline-no-pack' ? (
            <EmptyState art="compass" title={t('toilets.offlineTitle')} body={t('toilets.offlineBody')} action={<Button kind="quiet" label={t('common.tryAgain')} onPress={done?.origin.kind === 'hotel' ? nearHotel : nearMe} />} />
          ) : null}
          {result.reason === 'network' ? (
            <EmptyState art="compass" title={t('toilets.networkTitle')} body={t('toilets.networkBody')} action={<Button kind="quiet" label={t('common.tryAgain')} onPress={done?.origin.kind === 'hotel' ? nearHotel : nearMe} />} />
          ) : null}
        </Animated.View>
      ) : null}

      {showResults && done && result?.ok ? (
        <Animated.View style={{ opacity: fade, gap: rhythm.tight }}>
          <Text accessibilityRole="header" style={{ fontFamily: fonts.displayMedium, fontSize: 20, color: theme.ink }}>
            {done.origin.kind === 'hotel' ? t('toilets.aroundHotel', { name: done.origin.name }) : t('toilets.aroundHere')}
          </Text>
          <Text accessibilityLiveRegion="polite" style={{ fontFamily: fonts.body, fontSize: 14, color: theme.muted }}>
            {filters.length || rows.length !== allRows.length ? t('toiletplus.shown', { n: rows.length, total: allRows.length }) : allRows.length === 1 ? t('toilets.count1') : t('toilets.count', { n: allRows.length })}
            {' · '}
            {result.source === 'offline' ? t('toilets.source.offline', { city: result.city }) : t('toilets.source.online')}
          </Text>
          <FilterBar active={filters} counts={counts} onToggle={onToggleFilter} />
          <ToiletAccessBar prefs={stepFree} count={accessibleN} onToggle={() => changeStepFree((p) => setAccessibleOnly(p, !p.accessibleOnly))} />
          {openNowOn ? <Text style={{ fontFamily: fonts.body, fontSize: 13, color: theme.muted }}>{t('toiletplus.openNowNote')}</Text> : null}
          <ViewToggle value={view} onChange={setView} />
          {anyPinned ? <Text style={{ fontFamily: fonts.body, fontSize: 13, color: theme.muted }}>{t('toiletplus.savedNear')}</Text> : null}
          {view === 'list' ? <Text style={{ fontFamily: fonts.body, fontSize: 13, color: theme.muted }}>{t('toilets.fromHere')}</Text> : null}
          {openFailed ? (
            <Text accessibilityLiveRegion="polite" style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: theme.danger }}>
              {t('toilets.openFailed')}
            </Text>
          ) : null}
          {rows.length === 0 && filtered.length > 0 ? (
            <EmptyState
              art="mapPin"
              title={t('stepfree.toilets.noneTitle')}
              body={t('stepfree.toilets.noneBody')}
              action={<Button kind="quiet" label={t('stepfree.toilets.showAll')} hint={t('stepfree.toilets.showAllHint')} onPress={() => changeStepFree((p) => setAccessibleOnly(p, false))} />}
            />
          ) : null}
          {filtered.length === 0 && allRows.length > 0 ? (
            <EmptyState
              art="mapPin"
              title={t('toiletplus.noneMatchTitle')}
              body={t('toiletplus.noneMatchBody')}
              action={<Button kind="quiet" label={t('toiletplus.clearFilters')} hint={t('toiletplus.clearFiltersHint')} onPress={() => setRawFilters([])} />}
            />
          ) : null}
          {view === 'map' && initialRegion ? (
            <View style={{ gap: space.s }}>
              <SatchelMap
                key={`${done.run}`}
                pins={pins}
                initialRegion={initialRegion}
                onPinPress={onPinPress}
                height={MAP_HEIGHT}
                label={t('toiletplus.mapA11y')}
                fallbackTitle={t('toiletplus.noMapTitle')}
                fallbackBody={t('toiletplus.noMapBody')}
                offlineTiles={offlineTiles}
                fit={{ points: [done.origin.at, ...rows.slice(0, 15)], key: done.run }}
              />
              <ToiletPinLegend kinds={toiletLegend(rows)} />
              <Text style={{ fontFamily: fonts.body, fontSize: 12, color: theme.muted }}>{t('toilets.attribution')}</Text>
              {offlineCity && offlineTiles ? <Text style={{ fontFamily: fonts.body, fontSize: 12, color: theme.ok }}>{t('toiletplus.mapOffline', { city: offlineCity.name })}</Text> : null}
              {mapAvailable() && !selected ? <Text style={{ fontFamily: fonts.body, fontSize: 13, color: theme.muted }}>{t('toiletplus.mapTapHint')}</Text> : null}
              {selected ? (
                <FadeInView style={{ gap: space.s }}>
                  {renderCard(selected)}
                  <Button kind="quiet" icon="close" label={t('toiletplus.closeCard')} hint={t('toiletplus.closeCardHint')} onPress={() => setSelectedId(null)} />
                </FadeInView>
              ) : null}
            </View>
          ) : null}
        </Animated.View>
      ) : null}
    </View>
  );

  const footer = (
    <View style={{ gap: rhythm.stack, paddingTop: rhythm.section, paddingBottom: space.xl }}>
      {showResults ? <Text style={{ fontFamily: fonts.body, fontSize: 12, color: theme.muted }}>{t('toiletplus.hoursNote')}</Text> : null}
      <SectionHeader title={t('look2.toilets.sectionYours')} icon="bookmark-outline" tone="warn" />
      {focusGone ? (
        <Text accessibilityLiveRegion="polite" style={{ fontFamily: fonts.body, fontSize: 14, color: theme.muted }}>
          {t('f99.toilet.gone')}
        </Text>
      ) : null}
      <MineSection saved={saved} onOpen={(s: SavedToilet) => openMaps(s.toilet)} focusId={focusId} onLocated={scrollToFocus} />
      <RecentSection recent={recent} onOpen={(r: RecentToilet) => openMaps(r.toilet)} onClear={() => setRawRecent([])} />
      <Text style={{ fontFamily: fonts.body, fontSize: 12, color: theme.muted }}>{t('toilets.attribution')}</Text>
    </View>
  );

  const run = done?.run ?? 0;
  const listData = showResults && view === 'list' ? rows : [];
  return (
    <Screen scroll={false}>
      <View ref={listBox} collapsable={false} style={{ flex: 1 }}>
      <FlatList
        ref={listRef}
        style={{ flex: 1 }}
        onScroll={(e) => (scrollY.current = e.nativeEvent.contentOffset.y)}
        scrollEventThrottle={64}
        data={listData}
        keyExtractor={(h) => `${run}:${h.id}`}
        renderItem={({ item, index }) => (
          <FadeInView delay={Math.min(index, 6) * 40} style={{ marginBottom: rhythm.stack }}>
            {renderCard(item)}
          </FadeInView>
        )}
        extraData={saved}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />
      </View>
    </Screen>
  );
}
