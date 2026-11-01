// T60 "Ready to go?" hero card for the trip screen, and the "Leaving soon" banner for the trips list.
// The checks are worked out in src/core/readiness.ts from what is already on this phone (vault, packing list,
// emergency card, saved city-map list and installed cities). Nothing is fetched and no document label, number or
// expiry is shown: only a status per row and a one-tap fix. Motion is timed (FadeInView, ProgressBar), never springs.
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import type { CityCatalog, CityMap } from '../core/citymaps.ts';
import { EMERGENCY_KEY, EMPTY_CARD, normaliseCard } from '../core/emergency.ts';
import type { EmergencyCard, Trip } from '../core/model.ts';
import { EMPTY_STORE, listFor, PACKING_KEY, type PackStore } from '../core/packing.ts';
import { hoursUntil, nextLeaving, readiness, showReadiness, type Check, type CheckStatus, type Fix, type LeavingSoon } from '../core/readiness.ts';
import { todosCheck } from '../core/todos.ts';
import { connectionsCheck } from '../core/layovers.ts';
import { gapsCheck } from '../core/gaps.ts';
import { formatExpiry } from '../core/vault.ts';
import { cityMapsChanged } from '../core/signal.ts';
import type { Key } from '../i18n/en.ts';
import type { T } from '../i18n/core.ts';
import { listInstalled, loadCachedCatalog } from '../native/cityMaps.ts';
import { useApp } from '../state/app.tsx';
import { usePersisted } from '../state/persisted.ts';
import { useVaultDocs } from '../state/vaultLock.ts';
import { elevated, radius, space, TOUCH, typeScale } from '../theme/tokens.ts';
import { CustomsReadRows } from './CustomsLink.tsx';
import { FadeInView, GradientFill, IconBadge, ProgressBar, toneColours, type IconName, type Tone } from './hero.tsx';
import { PressableScale } from './kit.tsx';
import { CallHomeReadyRow } from './callhome.tsx';
import { connectionsDetail, useLayoverOverrides, useLayoverPrefs } from './layovers.tsx';
import { gapsDetail, openGapAdd, useGapDismissals } from './gaps.tsx';
import { checkinDetail } from './checkin.tsx';
import { checkinCheck } from '../core/checkin.ts';

const STATUS_LOOK: Record<CheckStatus, { tone: Tone; icon: IconName }> = {
  pass: { tone: 'ok', icon: 'checkmark-circle' },
  warn: { tone: 'warn', icon: 'alert-circle' },
  fail: { tone: 'danger', icon: 'close-circle' },
  missing: { tone: 'accent', icon: 'add-circle' },
  unknown: { tone: 'ink', icon: 'help-circle-outline' },
};

/** The sentence under a row's title. Dates are the "valid until" day the trip needs, never a document's expiry. */
export function checkDetail(t: T, c: Check, lang: string): string {
  // T93: the to-dos row's words live with the other to-do strings.
  if (c.id === 'todos') return t(`todos.readiness.${c.reason}` as Key, { done: c.done ?? 0, total: c.total ?? 0 });
  // T131: the connections row's words live with the other layover strings.
  if (c.id === 'connections') return connectionsDetail(t, c);
  // T135: the gaps row's words live with the other gap strings.
  if (c.id === 'gaps') return gapsDetail(t, c);
  // T143: the check-in row's words live with the other check-in strings.
  if (c.id === 'checkin') return checkinDetail(t, c);
  const vars = { until: c.until ? formatExpiry(c.until, lang) : '', done: c.done ?? 0, total: c.total ?? 0, city: c.city ?? '' };
  if (c.id === 'map' && !c.city && (c.reason === 'catalogUnavailable' || c.reason === 'notInCatalog')) return t(`readiness.map.${c.reason}Any`, vars);
  return t(`readiness.${c.id}.${c.reason}` as Key, vars);
}

const fixKey = (f: Fix): 'vault' | 'packing' | 'emergency' | 'address' | 'map' => (f.kind === 'todos' || f.kind === 'connection' || f.kind === 'gap' || f.kind === 'checkin' ? 'packing' : f.kind);
/** T93 / T131 / T135: the to-dos, connections and gaps rows' title and fix words come from their own strings. */
const checkTitle = (t: T, id: Check['id']): string =>
  id === 'todos' ? t('todos.readiness.check') : id === 'connections' ? t('layover.readiness.check') : id === 'gaps' ? t('gaps.readiness.check') : id === 'checkin' ? t('checkin.readiness.check') : t(`readiness.check.${id}`);
const fixLabel = (t: T, f: Fix): string =>
  f.kind === 'todos' ? t('todos.readiness.fix') : f.kind === 'connection' ? t('layover.readiness.fix') : f.kind === 'gap' ? t('gaps.readiness.fix') : f.kind === 'checkin' ? t('checkin.readiness.fix') : t(`readiness.fix.${fixKey(f)}`);
const fixHint = (t: T, f: Fix): string =>
  f.kind === 'todos'
    ? t('todos.readiness.fixHint')
    : f.kind === 'connection'
      ? t('layover.readiness.fixHint')
      : f.kind === 'gap'
        ? t('gaps.readiness.fixHint')
        : f.kind === 'checkin'
          ? t('checkin.readiness.fixHint')
          : t(`readiness.fix.${fixKey(f)}Hint`);

/**
 * Loads the city-map list saved on this phone and the installed cities (no network), again on each focus and
 * whenever the offline maps change (a city finished downloading or was deleted, even while this screen stays
 * mounted underneath; T63). Only the newest load may set state.
 */
export function useMapsOnPhone(): { catalog: CityCatalog | null; installed: CityMap[]; loaded: boolean } {
  const [state, setState] = useState<{ catalog: CityCatalog | null; installed: CityMap[]; loaded: boolean }>({ catalog: null, installed: [], loaded: false });
  const alive = useRef(true);
  const run = useRef(0);
  const load = useCallback(() => {
    const mine = ++run.current;
    const ok = () => alive.current && mine === run.current;
    Promise.all([loadCachedCatalog(), listInstalled()])
      .then(([catalog, installed]) => ok() && setState({ catalog, installed, loaded: true }))
      .catch(() => ok() && setState({ catalog: null, installed: [], loaded: true }));
  }, []);
  useEffect(() => {
    alive.current = true;
    const off = cityMapsChanged.subscribe(load);
    return () => {
      alive.current = false;
      off();
    };
  }, [load]);
  useFocusEffect(
    useCallback(() => {
      alive.current = true;
      load();
    }, [load]),
  );
  return state;
}

const Row = memo(function Row({ check, onFix }: { check: Check; onFix: (f: Fix) => void }) {
  const { t, theme, lang } = useApp();
  const look = STATUS_LOOK[check.status];
  const { fg, bg } = toneColours(theme, look.tone);
  const title = checkTitle(t, check.id);
  const status = t(`readiness.status.${check.status}`);
  const detail = checkDetail(t, check, lang);
  const fix = check.fix;
  const label = t('readiness.rowA11y', { check: title, status, detail });
  const body = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, paddingVertical: space.s }}>
      <IconBadge name={look.icon} tone={look.tone} size="s" />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s, flexWrap: 'wrap' }}>
          <Text style={[typeScale.bodyStrong, { color: theme.ink }]}>{title}</Text>
          <View style={{ borderRadius: radius.pill, backgroundColor: bg, paddingHorizontal: space.s, paddingVertical: 2 }}>
            <Text style={[typeScale.caption, { color: fg }]}>{status}</Text>
          </View>
        </View>
        <Text style={[typeScale.small, { color: theme.muted }]}>{detail}</Text>
        {fix ? <Text style={[typeScale.small, { fontFamily: typeScale.bodyStrong.fontFamily, color: theme.accentInk }]}>{fixLabel(t, fix)}</Text> : null}
      </View>
      {fix ? (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Ionicons name="chevron-forward" size={18} color={theme.muted} />
        </View>
      ) : null}
    </View>
  );
  if (!fix) {
    return (
      <View accessible accessibilityLabel={label} style={{ minHeight: TOUCH, justifyContent: 'center' }}>
        {body}
      </View>
    );
  }
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={label} accessibilityHint={fixHint(t, fix)} onPress={() => onFix(fix)}>
      {body}
    </PressableScale>
  );
});

/** The "Ready to go?" card. Renders nothing once the trip has ended. */
export function ReadinessCard({ trip }: { trip: Trip }) {
  const { t, theme } = useApp();
  const router = useRouter();
  const [docs, , docsLoaded] = useVaultDocs();
  const [store, , packLoaded] = usePersisted<PackStore>(PACKING_KEY, EMPTY_STORE);
  const [rawCard, , cardLoaded] = usePersisted<EmergencyCard>(EMERGENCY_KEY, EMPTY_CARD);
  const maps = useMapsOnPhone();
  const [layoverPrefs] = useLayoverPrefs();
  // T134: a change's own limits (set on its card) decide its row too.
  const [layoverOwn] = useLayoverOverrides();
  const [gapDismissed] = useGapDismissals(trip.id);
  const [now, setNow] = useState(() => Date.now());
  useFocusEffect(useCallback(() => setNow(Date.now()), []));

  const loaded = docsLoaded && packLoaded && cardLoaded && maps.loaded;
  const r = useMemo(
    () =>
      loaded
        ? readiness({
            trip,
            docs,
            packing: listFor(store, trip.id),
            card: normaliseCard(rawCard),
            catalog: maps.catalog,
            installed: maps.installed,
            now,
            todos: todosCheck(trip, now, { catalog: maps.catalog, installed: maps.installed }),
            connections: connectionsCheck(trip, layoverPrefs, layoverOwn),
            gaps: gapsCheck(trip, gapDismissed),
            checkin: checkinCheck(trip, now),
          })
        : null,
    [loaded, trip, docs, store, rawCard, maps, now, layoverPrefs, layoverOwn, gapDismissed],
  );

  const onFix = useCallback(
    (f: Fix) => {
      switch (f.kind) {
        case 'vault':
          return router.push('/vault');
        case 'packing':
          return router.push(`/packing/${f.tripId}`);
        case 'emergency':
          return router.push('/emergency-edit');
        case 'address':
          return router.push({ pathname: '/address/[id]', params: { id: f.itemId } });
        case 'map':
          return router.navigate({ pathname: '/map', params: { tripId: f.tripId, placeId: '' } });
        case 'todos':
          return router.push(`/todos/${f.tripId}`);
        case 'connection':
          return router.push(`/item/${f.itemId}`);
        case 'gap':
          if (f.add) return openGapAdd(router, f.tripId, f.add);
          return f.itemId ? router.push(`/item/${f.itemId}`) : undefined;
        case 'checkin':
          return router.push(`/item/${f.itemId}`);
      }
    },
    [router],
  );

  if (!showReadiness(trip, now)) return null;
  const tone: Tone = r?.overall === 'ready' ? 'ok' : r?.overall === 'almost' ? 'warn' : 'accent';
  return (
    <FadeInView>
      <View
        style={[
          elevated(theme, 'mid'),
          { borderRadius: radius.l, overflow: 'hidden' },
        ]}
      >
        <View style={{ padding: space.l, gap: space.s, backgroundColor: theme.hero.trips[0] }}>
          <GradientFill tone="trips" />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: theme.heroWash, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="shield-checkmark" size={18} color={theme.heroAccent} />
            </View>
            <Text accessibilityRole="header" style={[typeScale.caption, { color: theme.heroMuted, flex: 1 }]}>
              {t('readiness.title')}
            </Text>
            {r ? (
              <View
                accessible
                accessibilityLabel={t('readiness.scoreA11y', { passed: r.passed, total: r.scored })}
                style={{ backgroundColor: theme.heroChip, borderRadius: radius.pill, paddingHorizontal: space.m, paddingVertical: space.xs }}
              >
                <Text style={[typeScale.caption, { color: theme.heroInk, fontVariant: ['tabular-nums'] }]}>{t('readiness.score', { passed: r.passed, total: r.scored })}</Text>
              </View>
            ) : null}
          </View>
          <Text style={[typeScale.displayM, { color: theme.heroInk }]}>{r ? t(`readiness.overall.${r.overall}`) : t('readiness.loading')}</Text>
          {r ? <ProgressBar progress={r.score} tone={tone} track={theme.heroWash} label={t('readiness.scoreA11y', { passed: r.passed, total: r.scored })} /> : null}
        </View>
        {r ? (
          <View style={{ paddingHorizontal: space.l, paddingVertical: space.s }}>
            {r.checks.map((c, i) => (
              <View key={c.id} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: theme.line }}>
                <Row check={c} onFix={onFix} />
              </View>
            ))}
            {/* T114: call home planner link (not scored). */}
            <CallHomeReadyRow trip={trip} />
            {/* T115: "Read the customs for Japan", one row per covered trip country (not scored). */}
            <CustomsReadRows trip={trip} />
            <Text style={[typeScale.small, { color: theme.muted, paddingVertical: space.s }]}>{t('readiness.privacy')}</Text>
          </View>
        ) : null}
      </View>
    </FadeInView>
  );
}

/** Banner body for a trip leaving soon: "Tokyo starts in 3 days." / "...tomorrow." / "...leaves in about 5 h." */
export function leavingText(t: T, s: LeavingSoon, now: number): string {
  const trip = s.trip.name;
  if (s.days === 0) {
    const h = hoursUntil(s, now);
    if (h === null) return t('readiness.leaving.today', { trip });
    return h < 1 ? t('readiness.leaving.withinHour', { trip }) : t('readiness.leaving.hours', { trip, n: h });
  }
  return s.days === 1 ? t('readiness.leaving.tomorrow', { trip }) : t('readiness.leaving.days', { trip, n: s.days });
}

/** "Leaving soon" on the trips list when a trip starts within 3 days; a tap opens it at the readiness card. */
export const LeavingSoonBanner = memo(function LeavingSoonBanner({ trips }: { trips: Trip[] }) {
  const { t, theme } = useApp();
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  useFocusEffect(useCallback(() => setNow(Date.now()), []));
  const soon = useMemo(() => nextLeaving(trips, now), [trips, now]);
  if (!soon) return null;
  const body = leavingText(t, soon, now);
  return (
    <FadeInView>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={t('readiness.leaving.a11y', { body })}
        accessibilityHint={t('readiness.leaving.hint')}
        onPress={() => router.push(`/trip/${soon.trip.id}`)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.m,
          backgroundColor: theme.accentSoft,
          borderRadius: radius.l,
          paddingHorizontal: space.l,
          paddingVertical: space.m,
        }}
      >
        <IconBadge name="airplane" tone="accent" />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[typeScale.caption, { color: theme.accentInk }]}>{t('readiness.leaving.title')}</Text>
          <Text style={[typeScale.bodyStrong, { color: theme.ink }]}>{body}</Text>
          <Text style={[typeScale.small, { color: theme.accentInk }]}>{t('readiness.leaving.cta')}</Text>
        </View>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Ionicons name="chevron-forward" size={18} color={theme.accentInk} />
        </View>
      </PressableScale>
    </FadeInView>
  );
});
