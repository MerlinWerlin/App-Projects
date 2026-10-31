// Search on the Map (T94): one offline search box on the Map tab over everything Satchel holds (src/core/mapsearch.ts
// does the matching and ranking). Results show a kind icon, the distance and walking direction when the position is
// known (only from Where am I?, never looked up here), and tapping one hands it to the map to centre with a pin.
// The picked result offers Open in Apple Maps (not for sample points) and, for a booking, Open booking. Recent
// searches stay on this phone (AsyncStorage through usePersisted) and can be cleared. OSM attribution shows when an
// OpenStreetMap result is listed. No network.
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { ideaEntries, bookingEntries, hitDistance, MAPSEARCH_RECENTS_KEY, needsOsmCredit, packPlaceEntries, parseRecents, pinEntries, prepare, pushRecent, sampleEntries, savedEntries, search, searchState, toiletEntries, type Labels, type SearchEntry, type SearchHit, type SearchKind } from '../core/mapsearch.ts';
import { isMapCategory, type LatLon, type PoiSet } from '../core/poi.ts';
import { appleMapsWalkUrl } from '../core/toilets.ts';
import { parseRecent as parseRecentToilets, parseSaved as parseSavedToilets } from '../core/toiletplus.ts';
import { cardinalKey, parsePins, pinName, WAYBACK_PINS_KEY } from '../core/wayback.ts';
import type { Key } from '../i18n/en.ts';
import { clearSearchPackCache, packPois, type PackPois } from '../native/searchPacks.ts';
import { useApp } from '../state/app.tsx';
import { usePersisted } from '../state/persisted.ts';
import { useTrips } from '../state/trips.tsx';
import { fonts, space, typeScale } from '../theme/tokens.ts';
import { FadeInView, IconBadge, SectionCard, type IconName, type Tone } from './hero.tsx';
import { kindKey } from './kinds.tsx';
import { Body, Button, Card, Label, PressableScale, TextField } from './kit.tsx';

const NONE: unknown = [];
/** The Toilets tab's stores (app/(tabs)/toilets.tsx): saved toilets and the recently used list, both on the phone. */
const TOILET_SAVED_KEY = 'satchel.toiletplus.saved.v1';
const TOILET_RECENT_KEY = 'satchel.toiletplus.recent.v1';
const SHOWN = 20;

const KIND_ICON: Record<SearchKind, { icon: IconName; tone: Tone }> = {
  booking: { icon: 'briefcase-outline', tone: 'accent' },
  saved: { icon: 'bookmark', tone: 'warn' },
  idea: { icon: 'bulb-outline', tone: 'teal' },
  pin: { icon: 'flag-outline', tone: 'ok' },
  toilet: { icon: 'male-female-outline', tone: 'sea' },
  place: { icon: 'location-outline', tone: 'sea' },
  sample: { icon: 'location-outline', tone: 'ink' },
};

const kindLabelKey = (k: SearchKind): Key => `mapsearch.kind.${k}`;

export function MapSearch({ sets, from, installedKey, onPick }: { sets: readonly PoiSet[]; from: LatLon | null; installedKey: string; onPick: (hit: SearchHit | null) => void }) {
  const { t, theme } = useApp();
  const router = useRouter();
  const { trips } = useTrips();
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<SearchHit | null>(null);
  const [openFailed, setOpenFailed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [packs, setPacks] = useState<PackPois[] | null>(null);
  const [rawRecents, setRawRecents] = usePersisted<unknown>(MAPSEARCH_RECENTS_KEY, NONE);
  const [rawPins] = usePersisted<unknown>(WAYBACK_PINS_KEY, NONE);
  const [rawSavedToilets] = usePersisted<unknown>(TOILET_SAVED_KEY, NONE);
  const [rawRecentToilets] = usePersisted<unknown>(TOILET_RECENT_KEY, NONE);
  const recents = useMemo(() => parseRecents(rawRecents), [rawRecents]);
  const typed = query.trim() !== '';

  // City packs are read from the phone the first time something is typed, and again when the downloads change.
  useEffect(() => {
    clearSearchPackCache();
    setPacks(null);
  }, [installedKey]);
  useEffect(() => {
    if (!typed || packs) return;
    let live = true;
    packPois().then((p) => {
      if (live) setPacks(p);
    });
    return () => {
      live = false;
    };
  }, [typed, packs]);

  const labels = useMemo<Labels>(
    () => ({
      kind: (k) => t(kindLabelKey(k)),
      category: (id) => (isMapCategory(id) ? t(`map.cat.${id}`) : t('mapsearch.kind.place')),
      ideaCategory: (id) => t(`ideas.cat.${id}` as Key),
      bookingKind: (k) => t(kindKey(k)),
      pin: (p) => {
        const n = pinName(p);
        return 'text' in n ? n.text : t(n.key);
      },
    }),
    [t],
  );

  const entries = useMemo(() => {
    const toilets = [...parseSavedToilets(rawSavedToilets).map((s) => s.toilet), ...parseRecentToilets(rawRecentToilets).map((r) => r.toilet)];
    const all: SearchEntry[] = [
      ...bookingEntries(trips, labels),
      ...savedEntries(trips, labels),
      ...ideaEntries(trips, labels),
      ...pinEntries(parsePins(rawPins), labels),
      ...toiletEntries(toilets, labels, t('mapsearch.savedToilet')),
      ...(packs ?? []).flatMap((p) => [...toiletEntries(p.toilets, labels, p.city), ...packPlaceEntries(p.places, p.city, labels)]),
      ...sets.flatMap((s) => sampleEntries(s.pois, s.city, labels)),
    ];
    return prepare(all);
  }, [trips, labels, rawPins, rawSavedToilets, rawRecentToilets, packs, sets, t]);

  const hits = useMemo(() => search(entries, query, from), [entries, query, from]);
  const state = searchState(query, hits);
  const shown = hits.slice(0, SHOWN);

  const distanceLine = useCallback(
    (h: SearchHit): string | null => {
      const d = hitDistance(h);
      if (!d) return null;
      if (!h.dir || !h.walk) return t('mapsearch.distanceHere');
      const walk = h.walk.h > 0 ? t('wayback.walkHours', { h: h.walk.h, m: h.walk.m }) : t('wayback.walkMin', { m: h.walk.minutes });
      return t('mapsearch.distance', { n: d.n, unit: t(d.unit === 'm' ? 'map.unit.m' : 'map.unit.km'), dir: t(cardinalKey(h.dir)), walk });
    },
    [t],
  );

  const pick = (h: SearchHit | null) => {
    setPicked(h);
    setOpenFailed(false);
    setNotice(null);
    onPick(h);
    if (h) setRawRecents((old: unknown) => pushRecent(parseRecents(old), query));
  };

  const openMaps = async (h: SearchHit) => {
    setOpenFailed(false);
    try {
      await Linking.openURL(appleMapsWalkUrl(h.lat, h.lon, h.name));
    } catch {
      setOpenFailed(true);
    }
  };

  const clearRecents = () => {
    setRawRecents([]);
    setNotice(t('mapsearch.recentCleared'));
  };

  const small = { fontFamily: fonts.body, fontSize: 12, color: theme.muted } as const;

  return (
    <SectionCard title={t('mapsearch.heading')} subtitle={t('mapsearch.intro')} icon="search-outline" tone="sea">
      <TextField label={t('mapsearch.label')} placeholder={t('mapsearch.placeholder')} value={query} onChange={(q) => { setQuery(q); setNotice(null); }} autoCapitalize="none" />
      {typed ? <Button kind="quiet" icon="close-outline" label={t('mapsearch.clearQuery')} hint={t('mapsearch.clearQueryHint')} onPress={() => setQuery('')} /> : null}

      {picked ? (
        <FadeInView key={picked.key}>
          <Card>
            <Label>{t('mapsearch.picked')}</Label>
            <Text accessibilityRole="header" style={[typeScale.bodyStrong, { color: theme.ink }]}>
              {picked.name}
            </Text>
            <Body muted>{[t(kindLabelKey(picked.kind)), picked.detail].filter(Boolean).join(' · ')}</Body>
            {distanceLine(picked) ? <Body muted>{distanceLine(picked)}</Body> : null}
            {picked.sample ? (
              <Body muted>{t('mapsearch.sampleNoNav')}</Body>
            ) : (
              <Button icon="navigate-outline" label={t('mapsearch.openMaps')} hint={t('mapsearch.openMapsHint', { name: picked.name })} onPress={() => openMaps(picked)} />
            )}
            {openFailed ? (
              <Text accessibilityLiveRegion="polite" style={{ fontFamily: fonts.body, fontSize: 14, color: theme.danger }}>
                {t('mapsearch.openFailed')}
              </Text>
            ) : null}
            {picked.itemId ? <Button kind="secondary" label={t('mapsearch.openBooking')} hint={t('mapsearch.openBookingHint')} onPress={() => router.push(`/item/${picked.itemId}`)} /> : null}
            <Button kind="quiet" label={t('mapsearch.clearPin')} hint={t('mapsearch.clearPinHint')} onPress={() => pick(null)} />
            {picked.osm ? <Text style={small}>{t('map.attribution')}</Text> : null}
          </Card>
        </FadeInView>
      ) : null}

      {state === 'idle' ? (
        <View style={{ gap: space.xs }}>
          <Label>{t('mapsearch.recent')}</Label>
          {recents.length === 0 ? <Body muted>{t('mapsearch.recentNone')}</Body> : null}
          {recents.map((q) => (
            <PressableScale
              key={q}
              accessibilityRole="button"
              accessibilityLabel={t('mapsearch.recentA11y', { q })}
              accessibilityHint={t('mapsearch.recentHint')}
              onPress={() => setQuery(q)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, borderTopWidth: 1, borderTopColor: theme.line }}
            >
              <IconBadge name="time-outline" tone="ink" size="s" />
              <Text style={[typeScale.body, { color: theme.ink, flex: 1 }]}>{q}</Text>
            </PressableScale>
          ))}
          {recents.length > 0 ? <Button kind="quiet" label={t('mapsearch.recentClear')} hint={t('mapsearch.recentClearHint')} onPress={clearRecents} /> : null}
          {notice ? (
            <Text accessibilityLiveRegion="polite" style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: theme.ok }}>
              {notice}
            </Text>
          ) : null}
        </View>
      ) : null}

      {typed && !packs ? <Text style={small}>{t('mapsearch.loadingPacks')}</Text> : null}

      {state === 'none' ? (
        <View style={{ gap: space.xs }} accessibilityLiveRegion="polite">
          <Text style={[typeScale.bodyStrong, { color: theme.ink }]}>{t('mapsearch.noneTitle', { q: query.trim() })}</Text>
          <Body muted>{t('mapsearch.noneBody')}</Body>
        </View>
      ) : null}

      {state === 'results' ? (
        <View style={{ gap: space.xs }}>
          <Text accessibilityLiveRegion="polite" style={[typeScale.small, { color: theme.muted }]}>
            {hits.length > SHOWN ? t('mapsearch.countMore', { n: SHOWN }) : t('mapsearch.count', { n: hits.length })}
          </Text>
          {shown.map((h) => {
            const look = KIND_ICON[h.kind];
            const dist = distanceLine(h);
            const kind = t(kindLabelKey(h.kind));
            return (
              <PressableScale
                key={h.key}
                accessibilityRole="button"
                accessibilityLabel={t('mapsearch.resultA11y', { kind, name: h.name, detail: [h.detail, dist].filter(Boolean).join('. ') })}
                accessibilityHint={t('mapsearch.resultHint')}
                onPress={() => pick(h)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, paddingVertical: space.xs, borderTopWidth: 1, borderTopColor: theme.line }}
              >
                <IconBadge name={look.icon} tone={look.tone} size="s" />
                <View style={{ flex: 1 }}>
                  <Text style={[typeScale.bodyStrong, { color: theme.ink }]}>{h.name}</Text>
                  <Text style={[typeScale.small, { color: theme.muted }]}>{[kind, h.detail].filter(Boolean).join(' · ')}</Text>
                  {dist ? <Text style={[typeScale.small, { color: theme.muted, fontVariant: ['tabular-nums'] }]}>{dist}</Text> : null}
                </View>
              </PressableScale>
            );
          })}
          <Text style={small}>{from ? t('mapsearch.fromYou') : t('mapsearch.noPosition')}</Text>
          {needsOsmCredit(shown) ? <Text style={small}>{t('map.attribution')}</Text> : null}
          {shown.some((h) => h.sample) ? <Text style={small}>{t('map.sample')}</Text> : null}
        </View>
      ) : null}
    </SectionCard>
  );
}
