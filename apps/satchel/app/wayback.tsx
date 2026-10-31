// Find your way back (T73, owner feedback 1031: each tab deeper, less bland). An offline compass: a big arrow
// turned by the phone's heading points to the trip's hotel, a saved place or a pin you dropped where you stand
// ("I parked here", "Meeting point", or your own label), with the distance and a rough walking time. With no
// compass reading it says the way in words ("Head north-east") on a north-up dial. A note shows when GPS is rough.
// "Walking directions in Apple Maps" hands off when you want streets. Position and heading are watched only while
// this screen is focused and the app is in the foreground (src/native/compass.ts), never in the background; GPS
// and the compass need no signal, so it works in flight mode. Pins live on the phone (AsyncStorage) and can be
// deleted or kept with a trip as a saved place. Opened with ?target=<key> from the hotel address card and the map.
// The arrow and dial turn with short timed rotations (no springs), and jump straight there with Reduce Motion.
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Alert, Animated, AppState, Linking, ScrollView, Text, View } from 'react-native';
import { deviceZone, todayIn } from '../src/core/format.ts';
import { activeTrip, addPlace, saveTargets } from '../src/core/places.ts';
import { distanceParts } from '../src/core/poi.ts';
import { appleMapsWalkUrl } from '../src/core/toilets.ts';
import {
  accuracyNote,
  arrived,
  cardinal,
  cardinalKey,
  distanceTo,
  dropPin,
  initialBearing,
  needsCalibration,
  nextRotation,
  parsePins,
  pickHeading,
  pinKey,
  pinName,
  pinToPlace,
  placeKey,
  relativeAngle,
  removePin,
  resolveTarget,
  walkTime,
  waybackTargets,
  type HeadingReading,
  type PinError,
  type PinPreset,
  type Target,
  type TargetKind,
  type WaybackPin,
  WAYBACK_PINS_KEY,
} from '../src/core/wayback.ts';
import { startCompass, type CompassStatus } from '../src/native/compass.ts';
import type { Coords } from '../src/native/location.ts';
import { useApp } from '../src/state/app.tsx';
import { setPersistedChecked, usePersisted } from '../src/state/persisted.ts';
import { useTrips } from '../src/state/trips.tsx';
import { duration, timed } from '../src/theme/motion.ts';
import { fonts, radius, shadowOf, space, typeScale } from '../src/theme/tokens.ts';
import { FadeInView, IconBadge, SectionCard, type IconName, type Tone } from '../src/ui/hero.tsx';
import { Body, Button, Card, Chip, PressableScale, TextField } from '../src/ui/kit.tsx';
import { PermissionNotice } from '../src/ui/PermissionNotice.tsx';

const PINS_KEY = WAYBACK_PINS_KEY;
const NO_PINS: unknown = [];
const DIAL = 248;
/** Heading changes smaller than this are not worth a re-render. */
const HEADING_STEP = 2;
/** Without a first GPS fix after this long, say how to help it. */
const NO_FIX_MS = 20_000;

const GROUP: Record<TargetKind, { icon: IconName; tone: Tone }> = {
  hotel: { icon: 'bed-outline', tone: 'accent' },
  place: { icon: 'bookmark-outline', tone: 'warn' },
  pin: { icon: 'pin-outline', tone: 'teal' },
};

/** Rotates its children to `angle` degrees with a short timed turn the short way round (instant with Reduce Motion). */
function useRotation(angle: number | null, reduceMotion: boolean) {
  const value = useRef(new Animated.Value(0)).current;
  const at = useRef(0);
  useEffect(() => {
    if (angle == null || !Number.isFinite(angle)) return;
    const next = nextRotation(at.current, angle);
    at.current = next;
    if (reduceMotion) {
      value.setValue(next);
      return;
    }
    const a = timed(value, next, duration.base, false);
    a.start();
    return () => a.stop();
  }, [angle, reduceMotion, value]);
  return value.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] });
}

export default function WaybackScreen() {
  const { t, theme, reduceMotion, lang } = useApp();
  const { trips, saveTrip } = useTrips();
  const params = useLocalSearchParams<{ target?: string }>();
  const [rawPins] = usePersisted<unknown>(PINS_KEY, NO_PINS);
  const pins = useMemo(() => parsePins(rawPins), [rawPins]);
  const today = todayIn(deviceZone());

  const pinLabel = useCallback((p: WaybackPin) => {
    const n = pinName(p);
    return 'text' in n ? n.text : t(n.key);
  }, [t]);
  const targets = useMemo(() => waybackTargets(trips, today, pins, pinLabel), [trips, today, pins, pinLabel]);
  const [selectedKey, setSelectedKey] = useState<string | null>(typeof params.target === 'string' && params.target ? params.target : null);
  useEffect(() => {
    if (typeof params.target === 'string' && params.target) setSelectedKey(params.target);
  }, [params.target]);
  const target: Target | null = useMemo(
    () => resolveTarget(selectedKey, trips, pins, pinLabel) ?? (selectedKey ? null : (targets[0] ?? null)),
    [selectedKey, trips, pins, pinLabel, targets],
  );

  // ---- position + heading, only while focused and in the foreground ----
  const [here, setHere] = useState<Coords | null>(null);
  const [heading, setHeading] = useState<HeadingReading | null>(null);
  const [noCompass, setNoCompass] = useState(false);
  const [status, setStatus] = useState<CompassStatus>({ s: 'starting' });
  const [attempt, setAttempt] = useState(0);
  const [slowFix, setSlowFix] = useState(false);
  const lastHeading = useRef<HeadingReading | null>(null);

  useFocusEffect(
    useCallback(() => {
      let stop: (() => void) | null = null;
      let timer: ReturnType<typeof setTimeout> | null = null;
      const begin = () => {
        if (stop) return;
        setSlowFix(false);
        timer = setTimeout(() => setSlowFix(true), NO_FIX_MS);
        stop = startCompass({
          onPosition: (c) => {
            setSlowFix(false);
            if (timer) clearTimeout(timer);
            setHere(c);
          },
          onHeading: (h) => {
            if (!h) {
              setNoCompass(true);
              return;
            }
            const prev = lastHeading.current;
            const a = pickHeading(h);
            const b = pickHeading(prev);
            const moved = a == null || b == null ? a !== b : Math.abs(relativeAngle(a, b) ?? 0) >= HEADING_STEP;
            if (!prev || moved || prev.accuracy !== h.accuracy) {
              lastHeading.current = h;
              setHeading(h);
            }
          },
          onStatus: setStatus,
        });
      };
      const end = () => {
        stop?.();
        stop = null;
        if (timer) clearTimeout(timer);
        timer = null;
      };
      if (AppState.currentState === 'active' || AppState.currentState === 'unknown') begin();
      const sub = AppState.addEventListener('change', (s) => (s === 'active' ? begin() : end()));
      return () => {
        sub.remove();
        end();
      };
    }, [attempt]),
  );

  const retry = () => {
    setStatus({ s: 'starting' });
    setAttempt((n) => n + 1);
  };

  // ---- derived direction ----
  const headingDeg = noCompass ? null : pickHeading(heading);
  const bearing = here && target ? initialBearing(here, target) : null;
  const meters = here && target ? distanceTo(here, target) : null;
  const rel = relativeAngle(bearing, headingDeg);
  const there = arrived(meters, here?.accuracy);
  const arrowAngle = headingDeg != null ? rel : bearing; // no compass: north-up dial, arrow at the bearing
  const arrowRot = useRotation(arrowAngle, reduceMotion);
  const dialRot = useRotation(headingDeg != null ? -headingDeg : 0, reduceMotion);
  const dir = bearing != null ? cardinal(bearing, 8) : null;
  const dirText = dir ? t(cardinalKey(dir)) : '';
  const walk = walkTime(meters);
  const distText = meters != null ? (() => {
    const d = distanceParts(meters);
    return t('wayback.distance', { n: d.n, unit: t(d.unit === 'm' ? 'wayback.unit.m' : 'wayback.unit.km') });
  })() : '';
  const walkText = walk ? (walk.h > 0 ? t('wayback.walkHours', { h: walk.h, m: walk.m }) : t('wayback.walkMin', { m: walk.minutes })) : '';
  const turnText =
    rel == null ? '' : Math.abs(rel) <= 15 ? t('wayback.turn.ahead') : Math.abs(rel) >= 165 ? t('wayback.turn.behind') : t(rel > 0 ? 'wayback.turn.right' : 'wayback.turn.left', { n: Math.round(Math.abs(rel) / 5) * 5 });
  const poor = here ? accuracyNote(here.accuracy) === 'poor' : false;

  // ---- Apple Maps hand-off ----
  const [mapsFailed, setMapsFailed] = useState(false);
  const openMaps = async () => {
    if (!target) return;
    setMapsFailed(false);
    try {
      await Linking.openURL(appleMapsWalkUrl(target.lat, target.lon, target.name));
    } catch {
      setMapsFailed(true);
    }
  };

  // ---- drop a pin ----
  const [custom, setCustom] = useState<string | null>(null);
  const [dropErr, setDropErr] = useState<PinError[]>([]);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);
  const say = (text: string, ok = true) => {
    setNotice({ text, ok });
    AccessibilityInfo.announceForAccessibility(text);
  };
  const drop = async (preset: PinPreset, label?: string) => {
    setNotice(null);
    if (!here) {
      setDropErr(['position']);
      return;
    }
    const r = dropPin(pins, { preset, label, lat: here.lat, lon: here.lon, accuracy: here.accuracy });
    if (!r.ok) {
      setDropErr(r.errors);
      return;
    }
    setDropErr([]);
    const saved = await setPersistedChecked<unknown>(PINS_KEY, r.pins, NO_PINS);
    if (!saved) return say(t('wayback.pinSaveFailed'), false);
    setCustom(null);
    setSelectedKey(pinKey(r.pin.id));
    say(t('wayback.dropped', { name: pinLabel(r.pin) }));
  };

  const confirmDelete = (pin: WaybackPin) => {
    const name = pinLabel(pin);
    Alert.alert(t('wayback.pinDeleteConfirm', { name }), t('wayback.pinDeleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('wayback.pinDelete'),
        style: 'destructive',
        onPress: async () => {
          const ok = await setPersistedChecked<unknown>(PINS_KEY, (old: unknown) => removePin(parsePins(old), pin.id), NO_PINS);
          if (!ok) return say(t('wayback.pinSaveFailed'), false);
          if (selectedKey === pinKey(pin.id)) setSelectedKey(null);
          say(t('wayback.pinDeleted', { name }));
        },
      },
    ]);
  };

  // ---- keep a pin with a trip ----
  const tripChoices = useMemo(() => saveTargets(trips, today), [trips, today]);
  const onTrip = useMemo(() => activeTrip(trips, today), [trips, today]);
  const [keeping, setKeeping] = useState<string | null>(null);
  const keep = async (pin: WaybackPin, tripId: string) => {
    const trip = trips.find((x) => x.id === tripId);
    const name = pinLabel(pin);
    const r = trip ? addPlace(trip, pinToPlace(pin, name)) : null;
    if (!trip || !r || !r.ok || !(await saveTrip(r.trip))) return say(t('wayback.pinKeepFailed'), false);
    // The spot now lives with the trip; drop the phone-only copy so it isn't listed twice.
    await setPersistedChecked<unknown>(PINS_KEY, (old: unknown) => removePin(parsePins(old), pin.id), NO_PINS);
    setKeeping(null);
    if (selectedKey === pinKey(pin.id)) setSelectedKey(placeKey(trip.id, r.place.id));
    say(t('wayback.pinKept', { name: r.place.name, trip: trip.name }));
  };
  const startKeep = (pin: WaybackPin) => {
    setNotice(null);
    if (onTrip) return keep(pin, onTrip.id);
    if (tripChoices.length === 1) return keep(pin, tripChoices[0].id);
    setKeeping(keeping === pin.id ? null : pin.id);
  };

  const when = (iso: string) => {
    try {
      return new Date(iso).toLocaleString(lang, { weekday: 'short', hour: 'numeric', minute: '2-digit' });
    } catch {
      return iso.slice(0, 16).replace('T', ' ');
    }
  };

  // ---- pieces ----
  const groupName = (k: TargetKind) => t(`wayback.group.${k}`);
  const groups = (['hotel', 'place', 'pin'] as const).map((k) => ({ k, list: targets.filter((x) => x.kind === k) })).filter((g) => g.list.length > 0);

  const arrowA11y = !target
    ? t('wayback.chooseOne')
    : meters == null
      ? t('wayback.finding')
      : there
        ? t('wayback.arrived')
        : rel != null
          ? t('wayback.arrowA11y', { name: target.name, turn: turnText, distance: distText, walk: walkText })
          : t('wayback.noHeadingA11y', { dir: dirText, distance: distText, walk: walkText });

  const dial = (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={arrowA11y}
      style={[
        { width: DIAL, height: DIAL, borderRadius: DIAL / 2, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', backgroundColor: theme.cardRaised, borderWidth: 1, borderColor: theme.line },
        shadowOf(theme, 'mid'),
      ]}
    >
      {/* the compass rose: N turns with the phone so it always points north */}
      <Animated.View
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        style={{ position: 'absolute', width: DIAL, height: DIAL, alignItems: 'center', transform: [{ rotate: dialRot }] }}
      >
        <Text style={{ marginTop: space.s, fontFamily: fonts.display, fontSize: 18, color: theme.accentInk }}>{t('wayback.north')}</Text>
        {[90, 180, 270].map((d) => (
          <View key={d} style={{ position: 'absolute', width: DIAL, height: DIAL, alignItems: 'center', transform: [{ rotate: `${d}deg` }] }}>
            <View style={{ marginTop: space.m, width: 3, height: 14, borderRadius: 2, backgroundColor: theme.line }} />
          </View>
        ))}
      </Animated.View>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: DIAL - 72, height: DIAL - 72, borderRadius: (DIAL - 72) / 2, backgroundColor: theme.paper, alignItems: 'center', justifyContent: 'center' }}>
        {there ? (
          <Ionicons name="checkmark-circle" size={120} color={theme.ok} />
        ) : bearing != null ? (
          <Animated.View style={{ transform: [{ rotate: arrowRot }] }}>
            <Ionicons name="arrow-up" size={136} color={theme.accent} />
          </Animated.View>
        ) : (
          <Ionicons name="compass-outline" size={96} color={theme.muted} />
        )}
      </View>
    </View>
  );

  const note = (icon: IconName, text: string, tone: 'warn' | 'muted' = 'warn') => (
    <View style={{ flexDirection: 'row', gap: space.s, backgroundColor: tone === 'warn' ? theme.warnSoft : theme.seaSoft, borderRadius: radius.m, padding: space.m }}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Ionicons name={icon} size={18} color={tone === 'warn' ? theme.warn : theme.sea} />
      </View>
      <Text accessibilityLiveRegion="polite" style={[typeScale.small, { flex: 1, color: theme.ink }]}>
        {text}
      </Text>
    </View>
  );

  const locationProblem =
    status.s === 'denied' ? (
      <PermissionNotice
        kind="location"
        state={status.state}
        reason={status.state === 'blocked' ? t('wayback.denied') : undefined}
        onRetry={retry}
        fallbackLabel={target ? t('wayback.fallback') : undefined}
        onFallback={target ? openMaps : undefined}
      />
    ) : status.s === 'unavailable' && status.servicesOff ? (
      <PermissionNotice kind="location" state="unavailable" onRetry={retry} fallbackLabel={target ? t('wayback.fallback') : undefined} onFallback={target ? openMaps : undefined} />
    ) : status.s === 'unavailable' ? (
      <Card>
        <Body>{t('map.unavailable')}</Body>
        <Button kind="quiet" label={t('common.tryAgain')} hint={t('permissions.retryHint')} onPress={retry} />
      </Card>
    ) : null;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.paper }} contentContainerStyle={{ padding: space.l, paddingBottom: space.xxl * 2, gap: space.l }}>
      <FadeInView style={{ gap: space.l }}>
        {target ? (
          <View style={{ gap: space.xs }}>
            <Text accessibilityRole="header" style={[typeScale.displayM, { color: theme.ink }]}>
              {t('wayback.to', { name: target.name })}
            </Text>
            {target.tripName ? <Text style={[typeScale.small, { color: theme.muted }]}>{`${groupName(target.kind)} · ${target.tripName}`}</Text> : null}
          </View>
        ) : null}

        {locationProblem}

        {status.s !== 'denied' && !(status.s === 'unavailable') ? (
          <View style={{ gap: space.m }}>
            {dial}
            {target && meters != null && !there ? (
              <View style={{ alignItems: 'center', gap: space.xs }}>
                {headingDeg == null && dir ? <Text style={[typeScale.displayM, { color: theme.ink, textAlign: 'center' }]}>{t('wayback.head', { dir: dirText })}</Text> : null}
                <Text style={[typeScale.displayL, { color: theme.ink, fontVariant: ['tabular-nums'], textAlign: 'center' }]}>{distText}</Text>
                <Text style={[typeScale.bodyStrong, { color: theme.muted, textAlign: 'center' }]}>
                  {headingDeg != null && dir ? `${t('wayback.head', { dir: dirText })} · ${walkText}` : walkText}
                </Text>
              </View>
            ) : null}
            {there && target ? (
              <Text accessibilityLiveRegion="polite" style={[typeScale.title, { color: theme.ok, textAlign: 'center' }]}>
                {t('wayback.arrived')}
              </Text>
            ) : null}
            {!here ? note('locate-outline', slowFix ? t('wayback.noFix') : t('wayback.finding'), slowFix ? 'warn' : 'muted') : null}
            {poor && here?.accuracy != null ? note('warning-outline', t('wayback.poor', { n: Math.round(here.accuracy) })) : null}
            {here && target && headingDeg == null ? note('compass-outline', t('wayback.noCompass'), 'muted') : null}
            {headingDeg != null && needsCalibration(heading) ? note('sync-outline', t('wayback.calibrate')) : null}
            {meters != null && !there ? <Text style={[typeScale.small, { color: theme.muted, textAlign: 'center' }]}>{t('wayback.walkNote')}</Text> : null}
          </View>
        ) : null}

        {target ? <Button kind="secondary" icon="walk-outline" label={t('wayback.maps')} hint={t('wayback.mapsHint')} onPress={openMaps} /> : null}
        {mapsFailed ? (
          <Text accessibilityLiveRegion="polite" style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: theme.danger }}>
            {t('wayback.mapsFailed')}
          </Text>
        ) : null}
        {notice ? (
          <Text accessibilityLiveRegion="polite" style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: notice.ok ? theme.ok : theme.danger }}>
            {notice.text}
          </Text>
        ) : null}
      </FadeInView>

      <SectionCard title={t('wayback.pick')} icon="navigate-outline" tone="sea">
        {groups.length === 0 ? <Body muted>{t('wayback.noTargets')}</Body> : null}
        {groups.map((g) => (
          <View key={g.k} accessibilityRole="radiogroup" accessibilityLabel={groupName(g.k)} style={{ gap: space.xs }}>
            <Text style={[typeScale.caption, { color: theme.muted }]}>{groupName(g.k)}</Text>
            {g.list.map((x) => {
              const sel = target?.key === x.key;
              return (
                <PressableScale
                  key={x.key}
                  accessibilityRole="radio"
                  accessibilityLabel={t('wayback.targetA11y', { name: x.name, group: groupName(x.kind) })}
                  accessibilityHint={t('wayback.targetHint')}
                  accessibilityState={{ selected: sel, checked: sel }}
                  onPress={() => {
                    setNotice(null);
                    setSelectedKey(x.key);
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: space.m,
                    paddingHorizontal: space.m,
                    borderRadius: radius.m,
                    borderWidth: sel ? 1.5 : 1,
                    borderColor: sel ? theme.accent : theme.line,
                    backgroundColor: sel ? theme.accentSoft : theme.cardRaised,
                  }}
                >
                  <IconBadge name={GROUP[x.kind].icon} tone={GROUP[x.kind].tone} size="s" />
                  <Text numberOfLines={2} style={[typeScale.bodyStrong, { flex: 1, color: sel ? theme.accentInk : theme.ink }]}>
                    {x.name}
                  </Text>
                </PressableScale>
              );
            })}
          </View>
        ))}
      </SectionCard>

      <SectionCard title={t('wayback.drop')} subtitle={t('wayback.dropIntro')} icon="pin-outline" tone="teal">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
          {(['parked', 'meeting'] as const).map((p) => (
            <Button key={p} kind="quiet" icon={p === 'parked' ? 'car-outline' : 'people-outline'} label={t(`wayback.preset.${p}`)} hint={t('wayback.presetHint')} onPress={() => drop(p)} />
          ))}
          <Chip label={t('wayback.preset.custom')} selected={custom != null} onPress={() => setCustom(custom == null ? '' : null)} />
        </View>
        {custom != null ? (
          <View style={{ gap: space.s }}>
            <TextField
              label={t('wayback.customLabel')}
              value={custom}
              onChange={(v) => {
                setCustom(v);
                setDropErr([]);
              }}
              error={dropErr.includes('label') ? t('wayback.err.label') : undefined}
              autoCapitalize="sentences"
            />
            <Button label={t('wayback.customSave')} hint={t('wayback.customSaveHint')} onPress={() => drop('custom', custom)} />
          </View>
        ) : null}
        {dropErr.includes('position') ? (
          <Text accessibilityLiveRegion="polite" style={{ fontFamily: fonts.body, fontSize: 14, color: theme.danger }}>
            {t('wayback.err.position')}
          </Text>
        ) : !here ? (
          <Text style={[typeScale.small, { color: theme.muted }]}>{t('wayback.dropWait')}</Text>
        ) : poor && here.accuracy != null ? (
          <Text style={[typeScale.small, { color: theme.muted }]}>{t('wayback.dropAccuracy', { n: Math.round(here.accuracy) })}</Text>
        ) : null}
      </SectionCard>

      <SectionCard title={t('wayback.pinsHeading')} icon="flag-outline" tone="teal">
        {pins.length === 0 ? <Body muted>{t('wayback.pinsNone')}</Body> : null}
        {pins.map((p) => {
          const name = pinLabel(p);
          return (
            <View key={p.id} style={{ gap: space.s, paddingTop: space.m, borderTopWidth: 1, borderTopColor: theme.line }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
                <IconBadge name={p.preset === 'parked' ? 'car-outline' : p.preset === 'meeting' ? 'people-outline' : 'pin-outline'} tone="teal" size="s" />
                <View style={{ flex: 1 }}>
                  <Text style={[typeScale.bodyStrong, { color: theme.ink }]}>{name}</Text>
                  {p.droppedAt ? <Text style={[typeScale.small, { color: theme.muted }]}>{t('wayback.pinMeta', { when: when(p.droppedAt) })}</Text> : null}
                </View>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={t('wayback.pinKeepA11y', { name })}
                  accessibilityHint={t('wayback.pinKeepHint')}
                  onPress={() => startKeep(p)}
                  style={{ paddingHorizontal: space.l, borderRadius: radius.pill, backgroundColor: theme.seaSoft }}
                >
                  <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: theme.sea }}>{t('wayback.pinKeep')}</Text>
                </PressableScale>
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={t('wayback.pinDeleteA11y', { name })}
                  accessibilityHint={t('wayback.pinDeleteHint')}
                  onPress={() => confirmDelete(p)}
                  style={{ paddingHorizontal: space.l, borderRadius: radius.pill, backgroundColor: theme.dangerSoft }}
                >
                  <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: theme.danger }}>{t('wayback.pinDelete')}</Text>
                </PressableScale>
              </View>
              {keeping === p.id ? (
                tripChoices.length === 0 ? (
                  <Body muted>{t('wayback.pinKeepNoTrips')}</Body>
                ) : (
                  <View style={{ gap: space.s }}>
                    <Body muted>{t('wayback.pinKeepChoose', { name })}</Body>
                    <View accessibilityRole="radiogroup" accessibilityLabel={t('places.trip')} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
                      {tripChoices.map((trip) => (
                        <Chip key={trip.id} label={trip.name} selected={false} onPress={() => keep(p, trip.id)} />
                      ))}
                    </View>
                  </View>
                )
              ) : null}
            </View>
          );
        })}
      </SectionCard>

      <Text style={[typeScale.small, { color: theme.muted }]}>{t('wayback.offlineNote')}</Text>
    </ScrollView>
  );
}
