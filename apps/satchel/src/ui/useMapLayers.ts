// T117 map layers: the Map tab's layer choices (kept on this phone under MAPLAYERS_KEY through the persisted
// helper), the pins of the families the layers added (ideas with a spot, your way-back pins, saved toilets, today's
// day plan stops), the visibility filter and where a tap on one of those pins leads (T120: a saved toilet opens the
// Toilets tab at that toilet). Pure rules in
// src/core/maplayers.ts; the sheet is src/ui/MapLayersSheet.tsx.
import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import {
  dayPlanPins,
  ideaPins,
  LAYER_SPECS,
  MAPLAYERS_KEY,
  parseLayerPrefs,
  showAllLayers,
  toggleLayer,
  toiletLayerPins,
  visiblePins,
  waybackLayerPins,
  withScope,
  type LayerPrefs,
  type MapLayerId,
  type MapScope,
} from '../core/maplayers.ts';
import type { LocalDate, Trip } from '../core/model.ts';
import { TOILET_SAVED_KEY } from '../core/toiletplus.ts';
import { pinKey, pinName, WAYBACK_PINS_KEY } from '../core/wayback.ts';
import type { MapPin } from '../native/maps.tsx';
import { useApp } from '../state/app.tsx';
import { requestToiletFocus } from '../state/focusToilet.ts';
import { usePersisted } from '../state/persisted.ts';

const NONE: unknown = null;

/**
 * `trips`: the trips the map shows (scope); `planTrip`: the trip whose day plan for `today` is drawn (the scoped
 * trip, else the one on today).
 */
export function useMapLayers({ trips, planTrip, today }: { trips: readonly Trip[]; planTrip: Trip | null; today: LocalDate }) {
  const { t, theme } = useApp();
  const router = useRouter();
  const [raw, setRaw, loaded] = usePersisted<unknown>(MAPLAYERS_KEY, NONE);
  const [rawPins] = usePersisted<unknown>(WAYBACK_PINS_KEY, NONE);
  const [rawToilets] = usePersisted<unknown>(TOILET_SAVED_KEY, NONE);
  const prefs = useMemo(() => parseLayerPrefs(raw), [raw]);

  const ideas = useMemo(() => ideaPins(trips), [trips]);
  const wayback = useMemo(() => waybackLayerPins(rawPins), [rawPins]);
  const toilets = useMemo(() => toiletLayerPins(rawToilets), [rawToilets]);
  const plan = useMemo(() => dayPlanPins(planTrip, today), [planTrip, today]);

  const colour = useCallback((id: MapLayerId) => theme[LAYER_SPECS[id].tone], [theme]);

  /** The added families' pins, in registry order (the caller adds them to its own). */
  const extra = useMemo<MapPin[]>(() => {
    const out: MapPin[] = [];
    for (const p of plan) {
      out.push({ id: p.id, lat: p.lat, lon: p.lon, title: `${p.n}. ${p.name}`, subtitle: t('maplayers.pin.dayplan', { n: p.n }), color: colour('dayplan'), a11y: t('maplayers.pin.dayplanA11y', { n: p.n, name: p.name }), badge: { text: String(p.n), icon: 'walk-outline' } });
    }
    for (const i of ideas) {
      out.push({ id: i.id, lat: i.lat, lon: i.lon, title: i.name, subtitle: t(i.done ? 'maplayers.pin.ideaDone' : 'maplayers.pin.idea', { trip: i.tripName }), color: colour('ideas'), a11y: t('maplayers.pin.ideaA11y', { name: i.name }) });
    }
    for (const w of wayback) {
      const n = pinName(w);
      const name = 'text' in n ? n.text : t(n.key);
      out.push({ id: w.id, lat: w.lat, lon: w.lon, title: name, subtitle: t('maplayers.pin.wayback'), color: colour('wayback'), a11y: t('maplayers.pin.waybackA11y', { name }) });
    }
    for (const s of toilets) {
      const name = s.name ?? t('maplayers.pin.toilet');
      out.push({ id: s.id, lat: s.lat, lon: s.lon, title: name, subtitle: s.note || t('maplayers.pin.toilet'), color: colour('toilets'), a11y: t('maplayers.pin.toiletA11y', { name }) });
    }
    return out;
  }, [plan, ideas, wayback, toilets, t, colour]);

  const filter = useCallback(<P extends MapPin>(pins: readonly P[]) => visiblePins(pins, prefs), [prefs]);

  const update = useCallback((f: (p: LayerPrefs) => LayerPrefs) => setRaw((old: unknown) => f(parseLayerPrefs(old))), [setRaw]);
  const toggle = useCallback((id: MapLayerId) => update((p) => toggleLayer(p, id)), [update]);
  const showAll = useCallback(() => update(showAllLayers), [update]);
  const setScope = useCallback((scope: MapScope) => update((p) => withScope(p, scope)), [update]);

  /** A tap on one of the added pins: true when handled. */
  const onPress = useCallback(
    (id: string): boolean => {
      const i = ideas.find((p) => p.id === id);
      if (i) {
        router.push({ pathname: '/idea-edit', params: { tripId: i.tripId, ideaId: i.ideaId } });
        return true;
      }
      const w = wayback.find((p) => p.id === id);
      if (w) {
        router.push({ pathname: '/wayback', params: { target: pinKey(w.pinId) } });
        return true;
      }
      const d = plan.find((p) => p.id === id);
      if (d) {
        router.push({ pathname: `/dayplan/${d.tripId}`, params: { day: d.day } });
        return true;
      }
      // T120: a saved toilet opens the Toilets tab at that toilet in "My toilets" (one-time token, also in memory).
      const s = toilets.find((p) => p.id === id);
      if (s) {
        router.navigate({ pathname: '/toilets', params: { focus: requestToiletFocus(s.toiletId) } });
        return true;
      }
      return false;
    },
    [ideas, wayback, plan, toilets, router],
  );

  return { prefs, loaded, extra, filter, toggle, showAll, setScope, onPress, colour };
}

export type MapLayers = ReturnType<typeof useMapLayers>;
