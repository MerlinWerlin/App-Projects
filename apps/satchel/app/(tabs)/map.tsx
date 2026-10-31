// Map tab (Map v0, FLOWS §11): the phone's own map (loads while connected) with pins for bookings that have a position,
// places saved on a trip and the bundled sample points for the demo cities, category toggles, a nearest-first
// list, and "Where am I?" as one location check on tap (never continuous). Tap a pin or a spot on the map to select
// it; Save place keeps it with a trip (§11.2) and a saved place offers Remove (with a confirm). OSM attribution
// shows whenever points of interest are on screen; sample points and places saved from them stay labelled sample.
// Opened from a trip's "Trip map" (?tripId, optionally ?placeId) it shows only that trip until "Show all trips"
// (which sets ?tripId=all).
// Offline city maps (T47): a list of the city packs in the satchel-maps-v1 release (saved so it shows offline) with
// Download / progress / Cancel / Delete. When the map is over a downloaded city its raster tiles are drawn from the
// phone, so that city works in flight mode, and an "Offline map: <city>" chip says so.
// Trip on the map (T69): scoped to a trip, its bookings with a place position are numbered stops per day with a
// dashed line, filtered by day chips under the map, with a summary card (src/ui/TripRouteLayer.tsx).
// T73: "Find my way back" (the offline compass, app/wayback.tsx) under Where am I?, and for a selected saved place.
// T94: Search the map (src/ui/MapSearch.tsx) at the top of the list; a picked result is centred with its own pin.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Text, View } from 'react-native';
import kyotoData from '../../src/content/demo_pois_kyoto.json';
import tagData from '../../src/content/osm_poi_tags.json';
import tokyoData from '../../src/content/demo_pois_tokyo.json';
import { formatSize, overallProgress, pickCityFor, regionForCity, type CityCatalog, type CityMap } from '../../src/core/citymaps.ts';
import { deviceZone, todayIn } from '../../src/core/format.ts';
import type { PermissionState } from '../../src/core/permissions.ts';
import { activeTrip, addPlace, ALL_TRIPS, removePlace, SAME_SPOT_M, scopeParam, savedPins, saveTargets, scopeTrips, type PlaceError, type SavedPin } from '../../src/core/places.ts';
import {
  bookingPins,
  defaultToggles,
  distanceParts,
  filterByCategories,
  haversineMeters,
  isMapCategory,
  MAP_V0_CATEGORIES,
  parsePoiCategories,
  parsePoiSet,
  regionFor,
  sortByDistance,
  type BookingPin,
  type LatLon,
  type MapCategory,
  type Poi,
  type PoiSet,
  type Region,
} from '../../src/core/poi.ts';
import type { Key } from '../../src/i18n/en.ts';
import { deleteCity, downloadCity, fetchCatalog, listInstalled, offlineTilesFor, type CatalogFailure, type DownloadJob, type DownloadPhase } from '../../src/native/cityMaps.ts';
import { locateOnce, type Coords } from '../../src/native/location.ts';
import { mapAvailable, SatchelMap, type MapFocus, type MapPin } from '../../src/native/maps.tsx';
import { useNetworkStatus } from '../../src/native/network.ts';
import { useApp } from '../../src/state/app.tsx';
import { useTrips } from '../../src/state/trips.tsx';
import { fonts, radius, space, typeScale } from '../../src/theme/tokens.ts';
import { FadeInView, HeroHeader, IconBadge, ProgressBar, SectionCard } from '../../src/ui/hero.tsx';
import { kindKey } from '../../src/ui/kinds.tsx';
import { Body, Button, Card, Chip, Label, PressableScale, Screen, TextField } from '../../src/ui/kit.tsx';
import { ErrorNotice } from '../../src/ui/ErrorNotice.tsx';
import { PermissionNotice } from '../../src/ui/PermissionNotice.tsx';
import { TripRouteDays, TripRoutePanel, useTripRoute } from '../../src/ui/TripRouteLayer.tsx';
import { DaylightLine } from '../../src/ui/WeatherCard.tsx';
import { placeKey } from '../../src/core/wayback.ts';
import { requestNearestToilet } from '../../src/state/nearestToilet.ts';
import type { SearchHit } from '../../src/core/mapsearch.ts';
import { SEARCH_PIN_ID, searchPinTap } from '../../src/core/followups93.ts';
import { MapSearch } from '../../src/ui/MapSearch.tsx';

const CATS = parsePoiCategories(tagData);
const SETS: PoiSet[] = [parsePoiSet(tokyoData, CATS), parsePoiSet(kyotoData, CATS)].filter((s): s is PoiSet => s !== null);
const MAP_HEIGHT = 280;
/** "Nearest to you" only when you're actually in that city; otherwise distances are from the city's middle. */
const NEAR_CITY_M = 50_000;
const FALLBACK_REGION: Region = { latitude: 35.68, longitude: 139.76, latitudeDelta: 0.2, longitudeDelta: 0.2 };

type Loc =
  | { s: 'idle' }
  | { s: 'checking' }
  | { s: 'here'; coords: Coords }
  | { s: 'denied'; state: Exclude<PermissionState, 'granted'> }
  | { s: 'unavailable'; servicesOff: boolean };
type Selected =
  | { type: 'booking'; pin: BookingPin }
  | { type: 'poi'; poi: Poi }
  | { type: 'saved'; id: string }
  | { type: 'spot'; at: LatLon }
  | null;
type SaveForm = { name: string; tripId: string | null; errors: (PlaceError | 'trip')[] };

const catKey = (id: MapCategory): Key => `map.cat.${id}`;
const coordKey = (p: LatLon) => `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`;

// ---- Offline city maps (T47) ----

type CatalogState = { s: 'loading' } | { s: 'ok'; catalog: CityCatalog; stale?: CatalogFailure } | { s: 'failed'; reason: CatalogFailure };
type Job = { id: string; phase: DownloadPhase; pct: number };

function OfflineMaps({ installed, refreshInstalled, onShow }: { installed: CityMap[]; refreshInstalled: () => Promise<void>; onShow: (city: CityMap) => void }) {
  const { t, theme } = useApp();
  const net = useNetworkStatus();
  const [cat, setCat] = useState<CatalogState>({ s: 'loading' });
  const [job, setJob] = useState<Job | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const jobRef = useRef<DownloadJob | null>(null);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    setCat((c) => (c.s === 'ok' ? c : { s: 'loading' }));
    const r = await fetchCatalog();
    if (!mounted.current) return;
    setCat(r.ok ? { s: 'ok', catalog: r.catalog, stale: r.stale } : { s: 'failed', reason: r.reason });
  }, []);

  useEffect(() => {
    mounted.current = true;
    load();
    return () => {
      mounted.current = false;
      jobRef.current?.cancel();
    };
  }, [load]);

  // Coming back online: look again if the list failed or is only the saved copy.
  const needsRefresh = cat.s === 'failed' || (cat.s === 'ok' && !!cat.stale);
  useEffect(() => {
    if (net === 'online' && needsRefresh) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [net]);

  const size = (c: CityMap) => formatSize(c.bytes);

  const start = async (city: CityMap) => {
    if (jobRef.current) return;
    setMsg(null);
    setJob({ id: city.id, phase: 'download', pct: 0 });
    const j = downloadCity(city, (phase, f) => {
      const pct = Math.floor(overallProgress(phase, f) * 100);
      setJob((cur) => (cur && cur.id === city.id && (cur.pct !== pct || cur.phase !== phase) ? { id: city.id, phase, pct } : cur));
    });
    jobRef.current = j;
    const r = await j.promise;
    jobRef.current = null;
    if (!mounted.current) return;
    setJob(null);
    await refreshInstalled();
    if (r.ok) setMsg({ text: t('citymaps.done', { city: city.name }), ok: true });
    else setMsg({ text: t(`citymaps.fail.${r.reason}`, { city: city.name, size: formatSize(city.bytes * 2) }), ok: r.reason === 'cancelled' });
  };

  const confirmDelete = (city: CityMap) =>
    Alert.alert(t('citymaps.deleteConfirm', { city: city.name }), t('citymaps.deleteBody', { size: size(city) }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('citymaps.deleteAction'),
        style: 'destructive',
        onPress: async () => {
          const r = await deleteCity(city.id);
          await refreshInstalled();
          setMsg(r.ok ? { text: t('citymaps.deleted', { city: city.name }), ok: true } : { text: t('citymaps.deleteFailed', { city: city.name }), ok: false });
        },
      },
    ]);

  // Catalog cities plus any downloaded city the list no longer has (it still works and can be deleted).
  const installedIds = new Set(installed.map((c) => c.id));
  const listed = cat.s === 'ok' ? cat.catalog.cities : [];
  const rows: CityMap[] = [...listed.map((c) => installed.find((i) => i.id === c.id) ?? c), ...installed.filter((i) => !listed.some((c) => c.id === i.id))];

  let status: string | null = null;
  if (cat.s === 'loading' && rows.length === 0) status = t('citymaps.loading');
  else if (cat.s === 'failed') status = t(cat.reason === 'not-published' ? 'citymaps.notPublished' : cat.reason === 'bad-data' ? 'citymaps.badData' : 'citymaps.unreachable');
  else if (cat.s === 'ok' && cat.stale) status = t(cat.stale === 'not-published' ? 'citymaps.notPublished' : 'citymaps.stale');
  else if (cat.s === 'ok' && rows.length === 0) status = t('citymaps.none');

  return (
    <SectionCard title={t('citymaps.heading')} subtitle={t('citymaps.intro')} icon="cloud-download-outline" tone="sea">
      {status ? (
        <Text accessibilityLiveRegion="polite" style={{ fontFamily: fonts.body, fontSize: 15, color: theme.ink }}>
          {status}
        </Text>
      ) : null}
      {cat.s === 'failed' || (cat.s === 'ok' && (cat.stale || rows.length === 0)) ? (
        <Button label={t('citymaps.retry')} hint={t('citymaps.retryHint')} kind="quiet" onPress={load} />
      ) : null}

      {rows.map((city) => {
        const isInstalled = installedIds.has(city.id);
        const mine = job?.id === city.id ? job : null;
        return (
          <View key={city.id} style={{ gap: space.s, paddingTop: space.m, borderTopWidth: 1, borderTopColor: theme.line }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
              <IconBadge name={isInstalled ? 'checkmark-circle' : 'map-outline'} tone={isInstalled ? 'ok' : 'sea'} size="s" />
              <View style={{ flex: 1 }}>
                <Text style={[typeScale.bodyStrong, { color: theme.ink }]}>{city.name}</Text>
                <Text style={[typeScale.small, { color: theme.muted }]}>{t('citymaps.meta', { country: city.country, size: size(city) })}</Text>
              </View>
            </View>
            {mine ? (
              <>
                <ProgressBar progress={mine.pct / 100} tone="sea" label={t('citymaps.progressA11y', { city: city.name })} />
                <Text accessibilityLiveRegion="polite" style={{ fontFamily: fonts.body, fontSize: 14, color: theme.muted, fontVariant: ['tabular-nums'] }}>
                  {t(mine.phase === 'download' ? 'citymaps.downloading' : 'citymaps.unpacking', { pct: mine.pct })}
                </Text>
                <Button
                  label={t('citymaps.cancel')}
                  hint={t('citymaps.cancelHint')}
                  kind="quiet"
                  onPress={() => jobRef.current?.cancel()}
                />
              </>
            ) : isInstalled ? (
              <>
                <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: space.xs, backgroundColor: theme.okSoft, borderRadius: radius.pill, paddingHorizontal: space.m, paddingVertical: space.xs }}>
                  <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: theme.ok }}>{t('citymaps.installed')}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: space.s, flexWrap: 'wrap' }}>
                  <PressableScale
                    accessibilityRole="button"
                    accessibilityLabel={t('citymaps.showA11y', { city: city.name })}
                    accessibilityHint={t('citymaps.showHint')}
                    onPress={() => onShow(city)}
                    style={{ paddingHorizontal: space.l, borderRadius: radius.pill, backgroundColor: theme.seaSoft }}
                  >
                    <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: theme.sea }}>{t('citymaps.show')}</Text>
                  </PressableScale>
                  <PressableScale
                    accessibilityRole="button"
                    accessibilityLabel={t('citymaps.deleteA11y', { city: city.name })}
                    accessibilityHint={t('citymaps.deleteHint')}
                    onPress={() => confirmDelete(city)}
                    style={{ paddingHorizontal: space.l, borderRadius: radius.pill, backgroundColor: theme.dangerSoft }}
                  >
                    <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: theme.danger }}>{t('citymaps.delete')}</Text>
                  </PressableScale>
                </View>
              </>
            ) : job ? (
              <Body muted>{t('citymaps.oneAtATime')}</Body>
            ) : (
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={t('citymaps.downloadA11y', { city: city.name, size: size(city) })}
                accessibilityHint={t('citymaps.downloadHint')}
                onPress={() => start(city)}
                style={{ paddingHorizontal: space.l, borderRadius: radius.pill, backgroundColor: theme.accentStrong, alignSelf: 'flex-start' }}
              >
                <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: theme.onAccent }}>{t('citymaps.download')}</Text>
              </PressableScale>
            )}
          </View>
        );
      })}

      {msg ? (
        <Text accessibilityLiveRegion="polite" style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: msg.ok ? theme.ok : theme.danger }}>
          {msg.text}
        </Text>
      ) : null}
      {rows.length > 0 ? <Text style={{ fontFamily: fonts.body, fontSize: 12, color: theme.muted }}>{cat.s === 'ok' ? cat.catalog.attribution : t('citymaps.osm')}</Text> : null}
    </SectionCard>
  );
}

export default function MapScreen() {
  const { t, theme, reduceMotion } = useApp();
  const router = useRouter();
  const { trips, saveTrip } = useTrips();
  const [cityIdx, setCityIdx] = useState(0);
  const [on, setOn] = useState<Record<string, boolean>>(() => defaultToggles(CATS));
  const [selected, setSelected] = useState<Selected>(null);
  const [form, setForm] = useState<SaveForm | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [loc, setLoc] = useState<Loc>({ s: 'idle' });
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const [found, setFound] = useState<SearchHit | null>(null);
  // T96: tapping the search pin opens its result card (MapSearch) and scrolls the list to it.
  const [reveal, setReveal] = useState(0);
  const searchY = useRef(0);
  const net = useNetworkStatus();
  const [installed, setInstalled] = useState<CityMap[]>([]);
  const refreshInstalled = useCallback(async () => setInstalled(await listInstalled()), []);
  useEffect(() => {
    refreshInstalled();
  }, [refreshInstalled]);

  const set = SETS[cityIdx] ?? null;
  const catLabel = useCallback((id: string) => (isMapCategory(id) ? t(catKey(id)) : id), [t]);
  const dist = useCallback(
    (m: number, key: 'map.away' | 'map.fromHere' = 'map.away') => {
      const d = distanceParts(m);
      return t(key, { n: d.n, unit: t(d.unit === 'm' ? 'map.unit.m' : 'map.unit.km') });
    },
    [t],
  );

  // "Trip map" from a timeline opens this tab with ?tripId (and ?placeId for a saved place): only that trip's
  // bookings and saved places show, and saves go to it, until "Show all trips". Show all sets ?tripId=all (and an
  // empty ?placeId) rather than clearing them, so it works however the router treats an undefined param, and the
  // next "Trip map" for the same trip is still a change that scopes the map again.
  const params = useLocalSearchParams<{ tripId?: string; placeId?: string }>();
  const [scopeId, setScopeId] = useState<string | null>(scopeParam(params.tripId));
  useEffect(() => setScopeId(scopeParam(params.tripId)), [params.tripId]);
  const scope = useMemo(() => scopeTrips(trips, scopeId), [trips, scopeId]);
  const scoped = scope.scoped;
  const layer = useTripRoute(scoped);

  const today = todayIn(deviceZone());
  const active = useMemo(() => scoped ?? activeTrip(trips, today), [scoped, trips, today]);
  const targets = useMemo(() => (scoped ? [scoped] : saveTargets(trips, today)), [scoped, trips, today]);
  const bookings = useMemo(() => bookingPins(scope.trips), [scope]);
  const saved = useMemo(() => savedPins(scope.trips), [scope]);
  const savedSpots = useMemo(() => new Set(saved.map(coordKey)), [saved]);
  const shownPois = useMemo(() => (set ? filterByCategories(set.pois, on) : []), [set, on]);
  const here = loc.s === 'here' ? loc.coords : null;
  const origin: LatLon | null = set ? (here && haversineMeters(here, set.center) < NEAR_CITY_M ? here : set.center) : null;
  const fromYou = !!here && origin === here;
  const nearby = useMemo(() => (origin ? sortByDistance(shownPois, origin) : []), [shownPois, origin]);
  const listRef = useRef<FlatList<(typeof nearby)[number]>>(null);
  const selectedSaved = selected?.type === 'saved' ? (saved.find((p) => p.id === selected.id) ?? null) : null;
  const savedAt = useCallback((at: LatLon) => saved.find((p) => haversineMeters(p, at) <= SAME_SPOT_M) ?? null, [saved]);

  const pins = useMemo<MapPin[]>(() => {
    // Scoped to a trip, a booking's own place is its numbered stop, and so are a journey's from / to while the
    // stations chip is on (T72); its other pins follow the day chips.
    const shownBookings = scoped ? bookings.filter((b) => !layer.coversPin(b.id) && layer.showsItem(b.itemId)) : bookings;
    const out: MapPin[] = [...layer.pins];
    for (const b of shownBookings) out.push({
      id: `b:${b.id}`,
      lat: b.lat,
      lon: b.lon,
      title: b.name,
      subtitle: t(kindKey(b.kind)),
      color: theme.accent,
      a11y: t('map.pinBooking', { kind: t(kindKey(b.kind)), name: b.name }),
    });
    for (const s of saved) {
      out.push({ id: `s:${s.id}`, lat: s.lat, lon: s.lon, title: s.name, subtitle: t('places.savedTo', { trip: s.tripName }), color: theme.warn, a11y: t('places.pinA11y', { name: s.name }) });
    }
    for (const p of shownPois) {
      if (savedSpots.has(coordKey(p))) continue; // the saved pin stands in for it
      out.push({ id: `p:${p.id}`, lat: p.lat, lon: p.lon, title: p.name, subtitle: catLabel(p.category), color: theme.sea, a11y: t('map.pinPoi', { category: catLabel(p.category), name: p.name }) });
    }
    if (selected?.type === 'spot') {
      out.push({ id: 'spot', lat: selected.at.lat, lon: selected.at.lon, title: t('places.dropped'), color: theme.muted, a11y: t('places.dropped') });
    }
    if (found) out.push({ id: SEARCH_PIN_ID, lat: found.lat, lon: found.lon, title: found.name, color: theme.accentStrong, a11y: t('mapsearch.pinA11y', { name: found.name }) });
    if (here) out.push({ id: 'me', lat: here.lat, lon: here.lon, title: t('map.here'), color: theme.ok, a11y: t('map.here') });
    return out;
  }, [bookings, saved, savedSpots, shownPois, selected, found, here, theme, t, catLabel, scoped, layer.pins, layer.showsItem, layer.coversPin]);

  // The map only reads its first region; later moves go through `focus`.
  const [initialRegion] = useState<Region>(() => (set ? regionFor([set.center, ...set.pois]) : regionFor(bookings)) ?? FALLBACK_REGION);
  // Where the map is looking: picks the downloaded city whose tiles to draw.
  const [view, setView] = useState<LatLon>(() => ({ lat: initialRegion.latitude, lon: initialRegion.longitude }));
  useEffect(() => {
    if (focus) setView({ lat: focus.region.latitude, lon: focus.region.longitude });
  }, [focus]);
  // A route fit moves the map too: look at the middle of what it frames, for the offline city tiles.
  useEffect(() => {
    const pts = layer.fit?.points;
    const r = pts ? regionFor(pts) : null;
    if (r) setView({ lat: r.latitude, lon: r.longitude });
  }, [layer.fit]);
  const offlineCity = useMemo(() => pickCityFor(view.lat, view.lon, installed), [view, installed]);
  const offlineTiles = useMemo(() => (offlineCity ? offlineTilesFor(offlineCity) : null), [offlineCity]);
  const showCity = useCallback((city: CityMap) => setFocus({ region: regionForCity(city), key: Date.now() }), []);

  const select = useCallback((s: Selected) => {
    setSelected(s);
    setForm(null);
    setSaveFailed(false);
  }, []);

  const onPinPress = useCallback(
    (id: string) => {
      setNotice(null);
      const tap = searchPinTap(id, !!found, reveal);
      if (tap.open === 'result') {
        select(null);
        setReveal(tap.nonce);
        listRef.current?.scrollToOffset({ offset: searchY.current, animated: !reduceMotion });
        return;
      }
      if (id.startsWith('b:')) {
        const pin = bookings.find((b) => `b:${b.id}` === id);
        if (pin) select({ type: 'booking', pin });
      } else if (id.startsWith('r:')) {
        // A stop's id is r:<itemId>:<place|from|to>, the same as its booking pin's id after the prefix.
        const key = id.slice(2);
        const pin = bookings.find((b) => b.id === key);
        if (pin) select({ type: 'booking', pin });
        else router.push(`/item/${key.slice(0, key.lastIndexOf(':'))}`); // same spot as an earlier booking: open it directly
      } else if (id.startsWith('s:')) {
        select({ type: 'saved', id: id.slice(2) });
      } else if (id.startsWith('p:')) {
        const poi = set?.pois.find((p) => `p:${p.id}` === id);
        if (poi) {
          const s = savedAt(poi);
          select(s ? { type: 'saved', id: s.id } : { type: 'poi', poi });
        }
      }
    },
    [bookings, set, savedAt, select, router, found, reveal, reduceMotion],
  );

  const onMapPress = useCallback(
    (at: LatLon) => {
      setNotice(null);
      const s = savedAt(at);
      select(s ? { type: 'saved', id: s.id } : { type: 'spot', at });
    },
    [savedAt, select],
  );

  const chooseCity = (i: number) => {
    setCityIdx(i);
    select(null);
    const s = SETS[i];
    const region = s ? regionFor([s.center, ...s.pois]) : null;
    if (region) setFocus({ region, key: Date.now() });
  };

  const whereAmI = async () => {
    if (loc.s === 'checking') return;
    setLoc({ s: 'checking' });
    const r = await locateOnce();
    if (r.ok) {
      setLoc({ s: 'here', coords: r.coords });
      setFocus({ region: { latitude: r.coords.lat, longitude: r.coords.lon, latitudeDelta: 0.02, longitudeDelta: 0.02 }, key: Date.now() });
    } else if (r.reason === 'denied') setLoc({ s: 'denied', state: r.state });
    else setLoc({ s: 'unavailable', servicesOff: r.servicesOff });
  };

  const toggle = (id: string) => setOn((o) => ({ ...o, [id]: !o[id] }));
  // Release standard §1: a filtered list that comes out empty says why and offers a one-tap "Show all".
  const anyCatOn = Object.values(on).some(Boolean);
  const showAllCats = () => setOn((o) => Object.fromEntries(Object.keys(o).map((k) => [k, true])));

  const focusOn = (p: LatLon) => setFocus({ region: { latitude: p.lat, longitude: p.lon, latitudeDelta: 0.01, longitudeDelta: 0.01 }, key: Date.now() });

  // Opened as a Trip map: frame that trip, or the saved place that was tapped on its timeline.
  useEffect(() => {
    if (!scoped) return;
    const place = params.placeId ? saved.find((p) => p.placeId === params.placeId) : undefined;
    if (place) {
      setNotice(null);
      layer.open(false);
      select({ type: 'saved', id: place.id });
      focusOn(place);
      return;
    }
    if (layer.open(true)) return;
    const region = regionFor([...bookings, ...saved]);
    if (region) setFocus({ region, key: Date.now() });
    // Only when the requested trip or place changes, not on every save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoped?.id, params.placeId]);

  const showAll = () => {
    setScopeId(null);
    select(null);
    router.setParams({ tripId: ALL_TRIPS, placeId: '' });
  };

  // ---- Save / remove (FLOWS §11.2) ----
  const draftFor = (s: Selected): { name: string; at: LatLon; category?: string; sample?: boolean } | null => {
    if (s?.type === 'poi') return { name: s.poi.name, at: s.poi, category: s.poi.category, sample: !!set?.sample };
    if (s?.type === 'spot') return { name: t('places.dropped'), at: s.at };
    return null;
  };

  const startSave = () => {
    const d = draftFor(selected);
    if (!d) return;
    setNotice(null);
    setForm({ name: d.name, tripId: active?.id ?? (targets.length === 1 ? targets[0].id : null), errors: [] });
  };

  const confirmSave = async () => {
    const d = draftFor(selected);
    if (!form || !d) return;
    const trip = form.tripId ? trips.find((x) => x.id === form.tripId) : undefined;
    const r = trip ? addPlace(trip, { name: form.name, lat: d.at.lat, lon: d.at.lon, category: d.category, sample: d.sample }) : null;
    const errors: SaveForm['errors'] = [...(r && !r.ok ? r.errors : []), ...(trip ? [] : (['trip'] as const))];
    if (!r || !r.ok || !trip) {
      setForm({ ...form, errors });
      return;
    }
    setSaveFailed(false);
    if (!(await saveTrip(r.trip))) {
      // The form stays open with the name typed (STATES_COPY error.trips.save).
      setSaveFailed(true);
      return;
    }
    setForm(null);
    setSelected({ type: 'saved', id: `${trip.id}:${r.place.id}` });
    setNotice(t(r.updated ? 'places.updated' : 'places.saved', { name: r.place.name, trip: trip.name }));
  };

  const confirmRemove = (pin: SavedPin) =>
    Alert.alert(t('places.removeConfirm', { name: pin.name, trip: pin.tripName }), t('places.removeConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('places.removeAction'),
        style: 'destructive',
        onPress: async () => {
          const trip = trips.find((x) => x.id === pin.tripId);
          setSaveFailed(false);
          if (trip && !(await saveTrip(removePlace(trip, pin.placeId)))) {
            setSaveFailed(true);
            return;
          }
          select(null);
          setNotice(t('places.removed', { name: pin.name, trip: pin.tripName }));
        },
      },
    ]);

  const placeErr = (e: PlaceError | 'trip') => (form?.errors.includes(e) ? t(`places.err.${e}`) : undefined);

  const saveForm = form ? (
    <View style={{ gap: space.s }}>
      <Label>{t('places.saveTitle')}</Label>
      <TextField label={t('places.name')} value={form.name} onChange={(name) => setForm({ ...form, name, errors: [] })} error={placeErr('name')} autoCapitalize="words" />
      {placeErr('position') ? <Body>{placeErr('position')}</Body> : null}
      {targets.length === 0 ? (
        <Body muted>{t('places.noTrips')}</Body>
      ) : active ? (
        <Body muted>{`${t('places.trip')}: ${active.name}`}</Body>
      ) : (
        <View style={{ gap: space.s }}>
          <Label>{t('places.trip')}</Label>
          <Body muted>{t('places.chooseTrip')}</Body>
          <View accessibilityRole="radiogroup" accessibilityLabel={t('places.trip')} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
            {targets.map((trip) => (
              <Chip key={trip.id} label={trip.name} selected={form.tripId === trip.id} onPress={() => setForm({ ...form, tripId: trip.id, errors: [] })} />
            ))}
          </View>
          {placeErr('trip') ? (
            <Text accessibilityLiveRegion="polite" style={{ fontFamily: fonts.body, fontSize: 14, color: theme.danger }}>
              {placeErr('trip')}
            </Text>
          ) : null}
        </View>
      )}
      {targets.length > 0 ? <Button label={t('places.confirm')} hint={t('places.confirmHint')} onPress={confirmSave} /> : null}
      <Button label={t('common.cancel')} hint={t('places.cancelHint')} kind="quiet" onPress={() => setForm(null)} />
    </View>
  ) : null;

  const heading = (s: string) => (
    <Text accessibilityRole="header" style={{ fontFamily: fonts.displayMedium, fontSize: 20, color: theme.ink }}>
      {s}
    </Text>
  );

  let card = null;
  if (selected?.type === 'booking') {
    card = (
      <>
        {heading(selected.pin.name)}
        <Body muted>{`${t(kindKey(selected.pin.kind))} · ${selected.pin.title}`}</Body>
        {here ? <Body muted>{dist(haversineMeters(here, selected.pin), 'map.fromHere')}</Body> : null}
        <Button label={t('map.openBooking')} hint={t('map.openBookingHint')} onPress={() => router.push(`/item/${selected.pin.itemId}`)} />
      </>
    );
  } else if (selected?.type === 'poi') {
    card = (
      <>
        {heading(selected.poi.name)}
        <Body muted>{catLabel(selected.poi.category)}</Body>
        {origin ? <Body muted>{dist(haversineMeters(origin, selected.poi), fromYou ? 'map.fromHere' : 'map.away')}</Body> : null}
        {set?.sample ? <Body muted>{t('map.sample')}</Body> : null}
        {form ? saveForm : <Button label={t('places.save')} hint={t('places.saveHint')} onPress={startSave} />}
      </>
    );
  } else if (selected?.type === 'spot') {
    card = (
      <>
        {heading(t('places.dropped'))}
        <Body muted>{t('places.droppedBody')}</Body>
        <Body muted>{t('places.position', { lat: selected.at.lat.toFixed(5), lon: selected.at.lon.toFixed(5) })}</Body>
        {here ? <Body muted>{dist(haversineMeters(here, selected.at), 'map.fromHere')}</Body> : null}
        {form ? saveForm : <Button label={t('places.save')} hint={t('places.saveHint')} onPress={startSave} />}
      </>
    );
  } else if (selectedSaved) {
    const s = selectedSaved;
    card = (
      <>
        {heading(s.name)}
        <Body muted>{[s.category ? catLabel(s.category) : null, t('places.savedTo', { trip: s.tripName })].filter(Boolean).join(' · ')}</Body>
        {here ? <Body muted>{dist(haversineMeters(here, s), 'map.fromHere')}</Body> : null}
        {s.sample ? <Body muted>{t('map.sample')}</Body> : null}
        <Button kind="secondary" icon="compass-outline" label={t('wayback.openTo')} hint={t('wayback.openToHint', { name: s.name })} onPress={() => router.push({ pathname: '/wayback', params: { target: placeKey(s.tripId, s.placeId) } })} />
        <Button label={t('places.remove')} hint={t('places.removeHint')} kind="quiet" onPress={() => confirmRemove(s)} />
      </>
    );
  }

  const header = (
    <View style={{ gap: space.l, paddingBottom: space.s }}>
      {scoped ? (
        <Card>
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: theme.ink }}>{t('map.scoped', { trip: scoped.name })}</Text>
          <Button label={t('map.showAll')} hint={t('map.showAllHint')} kind="quiet" onPress={showAll} />
        </Card>
      ) : null}
      {scoped ? (
        <TripRoutePanel
          layer={layer}
          onOpenItem={(itemId) => router.push(`/item/${itemId}`)}
          onBackToTrip={() => router.push(`/trip/${scoped.id}`)}
        />
      ) : null}
      <View onLayout={(e) => (searchY.current = e.nativeEvent.layout.y)}>
        <MapSearch
          sets={SETS}
          reveal={reveal}
          from={here}
          installedKey={installed.map((c) => c.id).join(',')}
          onPick={(h) => {
            setFound(h);
            if (h) focusOn(h);
          }}
        />
      </View>
      <Body muted>{t('map.online')}</Body>
      <OfflineMaps installed={installed} refreshInstalled={refreshInstalled} onShow={showCity} />

      <View style={{ gap: space.s }}>
        <Button label={t('map.whereAmI')} hint={t('map.whereHint')} onPress={whereAmI} />
        <Button kind="secondary" icon="compass-outline" label={t('wayback.open')} hint={t('wayback.openHint')} onPress={() => router.push('/wayback')} />
        {/* T79: opens the Toilets tab and starts one "near me" search (the nonce makes each tap a new search). T80: the
            nonce also goes through src/state/nearestToilet.ts, so it works when the Toilets tab is already open. */}
        <Button kind="secondary" icon="male-female-outline" label={t('toiletplus.nearestToilet')} hint={t('toiletplus.nearestToiletHint')} onPress={() => router.navigate({ pathname: '/toilets', params: { find: requestNearestToilet() } })} />
        <Body muted>{t('map.whereExplain')}</Body>
        {loc.s === 'checking' ? (
          <Text accessibilityLiveRegion="polite" style={{ fontFamily: fonts.body, fontSize: 15, color: theme.muted }}>
            {t('map.checking')}
          </Text>
        ) : null}
        {loc.s === 'here' ? (
          <Text accessibilityLiveRegion="polite" style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: theme.ok }}>
            {loc.coords.accuracy != null ? t('map.hereAccuracy', { n: Math.round(loc.coords.accuracy) }) : t('map.here')}
          </Text>
        ) : null}
        {loc.s === 'unavailable' && !loc.servicesOff ? (
          <Text accessibilityLiveRegion="polite" style={{ fontFamily: fonts.body, fontSize: 15, color: theme.ink }}>
            {t('map.unavailable')}
          </Text>
        ) : null}
        {loc.s === 'unavailable' && loc.servicesOff ? (
          <PermissionNotice kind="location" state="unavailable" onRetry={whereAmI} onFallback={() => setLoc({ s: 'idle' })} />
        ) : null}
        {loc.s === 'denied' ? (
          <PermissionNotice
            kind="location"
            state={loc.state}
            reason={loc.state === 'blocked' ? t('map.denied') : undefined}
            onRetry={whereAmI}
            onFallback={() => setLoc({ s: 'idle' })}
          />
        ) : null}
      </View>

      {notice ? (
        <Text accessibilityLiveRegion="polite" style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: theme.ok }}>
          {notice}
        </Text>
      ) : null}

      {card ? (
        <Card>
          <Label>{t('map.selected')}</Label>
          {card}
          {saveFailed ? <ErrorNotice title={t('error.trips.save.title')} body={t('error.trips.save.body')} /> : null}
          <Button label={t('map.clear')} hint={t('map.clearHint')} kind="quiet" onPress={() => select(null)} />
        </Card>
      ) : null}

      <SectionCard title={t('places.heading')} icon="bookmark-outline" tone="warn">
        {saved.length === 0 ? <Body muted>{t('places.none')}</Body> : null}
        {saved.map((s) => (
          <PressableScale
            key={s.id}
            accessibilityRole="button"
            accessibilityLabel={t('places.open', { name: s.name, trip: s.tripName })}
            accessibilityHint={t('places.openHint')}
            onPress={() => {
              setNotice(null);
              select({ type: 'saved', id: s.id });
              focusOn(s);
            }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, paddingVertical: space.xs, borderTopWidth: 1, borderTopColor: theme.line }}
          >
            <IconBadge name="bookmark" tone="warn" size="s" />
            <View style={{ flex: 1 }}>
              <Text style={[typeScale.bodyStrong, { color: theme.ink }]}>{s.name}</Text>
              <Text style={[typeScale.small, { color: theme.muted }]}>{t('places.savedTo', { trip: s.tripName })}</Text>
            </View>
          </PressableScale>
        ))}
      </SectionCard>

      {SETS.length > 1 ? (
        <View style={{ gap: space.s }}>
          <Label>{t('map.city')}</Label>
          <View accessibilityRole="radiogroup" accessibilityLabel={t('map.city')} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
            {SETS.map((s, i) => (
              <Chip key={s.city} label={s.city} selected={i === cityIdx} onPress={() => chooseCity(i)} />
            ))}
          </View>
        </View>
      ) : null}

      <View style={{ gap: space.s }}>
        <Label>{t('map.categories')}</Label>
        <FlatList
          horizontal
          data={MAP_V0_CATEGORIES as readonly MapCategory[]}
          keyExtractor={(id) => id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: space.s }}
          extraData={on}
          renderItem={({ item: id }) => {
            const isOn = on[id] === true;
            return (
              <PressableScale
                accessibilityRole="checkbox"
                accessibilityLabel={t('map.toggleA11y', { label: t(catKey(id)), state: t(isOn ? 'map.shown' : 'map.hidden') })}
                accessibilityHint={t('map.toggleHint')}
                accessibilityState={{ checked: isOn }}
                onPress={() => toggle(id)}
                style={{
                  paddingHorizontal: space.m,
                  borderRadius: radius.pill,
                  borderWidth: 1,
                  borderColor: isOn ? theme.sea : theme.line,
                  backgroundColor: isOn ? theme.seaSoft : theme.paper,
                }}
              >
                <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: isOn ? theme.sea : theme.muted }}>{t(catKey(id))}</Text>
              </PressableScale>
            );
          }}
        />
      </View>

      {bookings.length === 0 ? <Body muted>{t('map.noBookingPins')}</Body> : null}

      {set ? heading(fromYou ? t('map.nearbyFromYou') : t('map.nearbyFromCity', { city: set.city })) : null}
    </View>
  );

  return (
    <Screen scroll={false}>
      <FadeInView>
        <HeroHeader compact tone="map" illustration="map" title={t('map.title')} />
      </FadeInView>
      <View style={{ gap: space.xs }}>
        <SatchelMap
          pins={pins}
          initialRegion={initialRegion}
          focus={focus}
          onPinPress={onPinPress}
          onMapPress={onMapPress}
          height={MAP_HEIGHT}
          label={t('map.a11yMap')}
          fallbackTitle={t('map.noMapTitle')}
          fallbackBody={t('map.noMapBody')}
          offlineTiles={offlineTiles}
          limitZoom={net === 'offline'}
          onRegionChange={(r) => setView({ lat: r.latitude, lon: r.longitude })}
          lines={layer.lines}
          fit={layer.fit}
        />
        {scoped ? <TripRouteDays layer={layer} /> : null}
        {offlineCity && offlineTiles ? (
          <View
            accessible
            accessibilityLabel={t('citymaps.chipA11y', { city: offlineCity.name })}
            style={{ alignSelf: 'flex-start', paddingHorizontal: space.m, paddingVertical: space.xs, borderRadius: radius.pill, backgroundColor: theme.okSoft }}
          >
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 13, color: theme.ok }}>{t('citymaps.chip', { city: offlineCity.name })}</Text>
          </View>
        ) : net === 'offline' ? (
          <Text accessibilityLiveRegion="polite" style={{ fontFamily: fonts.body, fontSize: 12, color: theme.muted }}>
            {t('citymaps.offlineNoCity')}
          </Text>
        ) : null}
        <DaylightLine trip={active} />
        {mapAvailable() ? <Text style={{ fontFamily: fonts.body, fontSize: 12, color: theme.muted }}>{t('places.tapHint')}</Text> : null}
        {shownPois.length > 0 ? (
          <>
            <Text style={{ fontFamily: fonts.body, fontSize: 12, color: theme.muted }}>{t('map.attribution')}</Text>
            {set?.sample ? <Text style={{ fontFamily: fonts.body, fontSize: 12, color: theme.muted }}>{t('map.sample')}</Text> : null}
          </>
        ) : null}
      </View>
      <FlatList
        ref={listRef}
        style={{ flex: 1 }}
        data={nearby}
        keyExtractor={(p) => p.id}
        ListHeaderComponent={header}
        ListEmptyComponent={
          set && origin ? (
            <View style={{ gap: space.xs }}>
              <Body muted>{t(anyCatOn ? 'map.noneInCats' : 'map.noneOn')}</Body>
              <Button label={t('map.catsShowAll')} hint={t('map.catsShowAllHint')} kind="quiet" onPress={showAllCats} />
            </View>
          ) : undefined
        }
        contentContainerStyle={{ gap: space.xs, paddingBottom: space.xl }}
        renderItem={({ item }) => {
          const d = dist(item.meters, fromYou ? 'map.fromHere' : 'map.away');
          const cat = catLabel(item.category);
          return (
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={t('map.placeA11y', { name: item.name, category: cat, distance: d })}
              onPress={() => {
                setNotice(null);
                const s = savedAt(item);
                select(s ? { type: 'saved', id: s.id } : { type: 'poi', poi: item });
                focusOn(item);
              }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, paddingVertical: space.xs, borderBottomWidth: 1, borderBottomColor: theme.line }}
            >
              <IconBadge name="location-outline" tone="sea" size="s" />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: theme.ink }}>{item.name}</Text>
                <Text style={{ fontFamily: fonts.body, fontSize: 14, color: theme.muted }}>{cat}</Text>
              </View>
              <Text style={{ fontFamily: fonts.body, fontSize: 14, color: theme.muted, fontVariant: ['tabular-nums'] }}>{d}</Text>
            </PressableScale>
          );
        }}
      />
    </Screen>
  );
}
