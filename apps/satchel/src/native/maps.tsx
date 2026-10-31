// Map adapter: react-native-maps with the phone's own map (Apple Maps), which loads while connected. A downloaded
// city map (T47, src/native/cityMaps.ts) is drawn on top as LocalTile raster tiles read from the phone, so that
// city works in flight mode. The module is required lazily inside try/catch, and rendering sits behind an error
// boundary, so a build without the native map shows a plain list of the same pins instead of crashing.
// Never turns on showsUserLocation: that would watch location continuously. "You are here" is a pin we place
// from a single check.
// T69 (trip on the map): a pin can carry a badge (stop number + kind icon, in its day's colour), `lines` draws
// dashed polylines between a day's stops, and `fit` frames a set of points with padding (fitToCoordinates; one
// spot zooms to it with the timed region move). With Reduce Motion the camera jumps instead of gliding.
// T72: a numbered stop is a custom-view marker. It tracks view changes only long enough to draw its first frame
// (and again briefly when its number, icon or colour changes), then stops, so a busy day doesn't redraw every pin
// on each frame while the map pans (react-native-maps' advice for custom markers).
import { Ionicons } from '@expo/vector-icons';
import { Component, useCallback, useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { FlatList, Text, View } from 'react-native';
import type MapViewType from 'react-native-maps';
import { validLatLon, type LatLon, type Region } from '../core/poi.ts';
import { useApp } from '../state/app.tsx';
import { duration, dur } from '../theme/motion.ts';
import { fonts, radius, space } from '../theme/tokens.ts';
import { Body, PressableScale } from '../ui/kit.tsx';

type MapsModule = typeof import('react-native-maps');

let cached: MapsModule | null | undefined;
function loadMaps(): MapsModule | null {
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-maps') as MapsModule & { default?: unknown };
    cached = mod && mod.default && mod.Marker ? mod : null;
  } catch {
    cached = null;
  }
  return cached;
}

export const mapAvailable = () => loadMaps() !== null;

export type MapPin = {
  id: string;
  lat: number;
  lon: number;
  title: string;
  subtitle?: string;
  /** A theme token colour. */
  color: string;
  /** Screen-reader label, already translated. */
  a11y: string;
  /** T69: drawn as a numbered disc in `color` (text and icon in the card colour) instead of a plain pin. */
  badge?: { text: string; icon?: ComponentProps<typeof Ionicons>['name'] };
};

/** A line on the map (T69: a day's stops in order). `color` is a theme token colour. */
export type MapLine = { id: string; points: LatLon[]; color: string; dashed?: boolean };

/** Changing `key` frames `points` (with `padding` points of space at each edge). */
export type MapFit = { points: LatLon[]; key: number; padding?: number };

/** Changing `key` moves the map to `region`. */
export type MapFocus = { region: Region; key: number };

type Props = {
  pins: MapPin[];
  initialRegion: Region;
  focus?: MapFocus | null;
  onPinPress: (id: string) => void;
  height: number;
  /** Translated strings for the map's label and the no-map fallback. */
  label: string;
  fallbackTitle: string;
  fallbackBody: string;
  /** Tap on the map itself (not a pin): selects that spot (FLOWS §11.1). Not offered by the no-map fallback list. */
  onMapPress?: (at: LatLon) => void;
  /** A downloaded city's raster tiles (plain file path with {z}/{x}/{y}), drawn over the system map. */
  offlineTiles?: { pathTemplate: string; maxZoom: number; minZoom: number } | null;
  /** Stop zooming in past the offline tiles' deepest level (used while the phone is offline, where nothing else draws). */
  limitZoom?: boolean;
  /** Called after the user moves the map. */
  onRegionChange?: (region: Region) => void;
  lines?: MapLine[];
  fit?: MapFit | null;
};

const FIT_PADDING = 48;
/** Span (degrees) shown around a single framed spot. */
const ONE_SPOT_DELTA = 0.012;

class Boundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function PinList({ pins, onPinPress, title, body, height }: { pins: MapPin[]; onPinPress: (id: string) => void; title: string; body: string; height: number }) {
  const { theme } = useApp();
  return (
    <View style={{ height, borderRadius: radius.m, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.card, padding: space.m, gap: space.s }}>
      <Text accessibilityRole="header" style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: theme.ink }}>
        {title}
      </Text>
      <Body muted>{body}</Body>
      <FlatList
        data={pins}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <PressableScale accessibilityRole="button" accessibilityLabel={item.a11y} onPress={() => onPinPress(item.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
            {item.badge ? (
              <View style={{ minWidth: 24, height: 24, borderRadius: 12, paddingHorizontal: space.xs, alignItems: 'center', justifyContent: 'center', backgroundColor: item.color }}>
                <Text style={{ fontFamily: fonts.bodyBold, fontSize: 12, color: theme.card }}>{item.badge.text}</Text>
              </View>
            ) : (
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: item.color }} />
            )}
            <Text style={{ flex: 1, fontFamily: fonts.body, fontSize: 15, color: theme.ink }} numberOfLines={1}>
              {item.title}
            </Text>
          </PressableScale>
        )}
      />
    </View>
  );
}

function Badge({ pin }: { pin: MapPin & { badge: NonNullable<MapPin['badge']> } }) {
  const { theme } = useApp();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        minWidth: 34,
        height: 34,
        paddingHorizontal: space.s,
        borderRadius: 17,
        borderWidth: 2,
        borderColor: theme.card,
        backgroundColor: pin.color,
      }}
    >
      {pin.badge.icon ? <Ionicons name={pin.badge.icon} size={13} color={theme.card} /> : null}
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: theme.card }}>{pin.badge.text}</Text>
    </View>
  );
}

/** How long a numbered marker tracks its view after it appears or changes: enough for the first frame. */
export const BADGE_TRACK_MS = 500;

/** True for BADGE_TRACK_MS after mount and after each change of `signature`, then false. */
function useTrackBriefly(signature: string) {
  const [tracking, setTracking] = useState(true);
  useEffect(() => {
    setTracking(true);
    const id = setTimeout(() => setTracking(false), BADGE_TRACK_MS);
    return () => clearTimeout(id);
  }, [signature]);
  return tracking;
}

function BadgeMarker({ Marker, pin, onPress }: { Marker: MapsModule['Marker']; pin: MapPin & { badge: NonNullable<MapPin['badge']> }; onPress: () => void }) {
  const { theme } = useApp();
  const tracking = useTrackBriefly(`${pin.badge.text}|${pin.badge.icon ?? ''}|${pin.color}|${theme.card}`);
  return (
    <Marker
      identifier={pin.id}
      coordinate={{ latitude: pin.lat, longitude: pin.lon }}
      title={pin.title}
      description={pin.subtitle}
      anchor={{ x: 0.5, y: 0.5 }}
      zIndex={2}
      tracksViewChanges={tracking}
      accessibilityLabel={pin.a11y}
      onPress={onPress}
    >
      <Badge pin={pin} />
    </Marker>
  );
}

export function SatchelMap({ pins, initialRegion, focus, onPinPress, height, label, fallbackTitle, fallbackBody, onMapPress, offlineTiles, limitZoom, onRegionChange, lines, fit }: Props) {
  const { theme, t, reduceMotion } = useApp();
  const ref = useRef<MapViewType | null>(null);
  const ready = useRef(false);
  const maps = loadMaps();

  const applyFit = useCallback(
    (f: MapFit) => {
      const map = ref.current;
      if (!map || f.points.length === 0) return;
      try {
        if (f.points.length === 1) {
          const [p] = f.points;
          map.animateToRegion({ latitude: p.lat, longitude: p.lon, latitudeDelta: ONE_SPOT_DELTA, longitudeDelta: ONE_SPOT_DELTA }, dur(duration.slow, reduceMotion));
          return;
        }
        const pad = f.padding ?? FIT_PADDING;
        map.fitToCoordinates(
          f.points.map((p) => ({ latitude: p.lat, longitude: p.lon })),
          { edgePadding: { top: pad, right: pad, bottom: pad, left: pad }, animated: !reduceMotion },
        );
      } catch {
        // map not ready; onMapReady tries again
      }
    },
    [reduceMotion],
  );

  useEffect(() => {
    if (fit && ready.current) applyFit(fit);
    // Only when a new fit is asked for.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fit?.key]);

  useEffect(() => {
    if (!focus) return;
    try {
      ref.current?.animateToRegion(focus.region, 320);
    } catch {
      // map not ready; the pins are still there
    }
  }, [focus]);

  const fallback = <PinList pins={pins} onPinPress={onPinPress} title={fallbackTitle} body={fallbackBody} height={height} />;
  if (!maps) return fallback;
  const MapView = maps.default;
  const { Marker, LocalTile } = maps;
  const Polyline = typeof maps.Polyline === 'function' ? maps.Polyline : null;
  const tiles = offlineTiles && typeof LocalTile === 'function' ? offlineTiles : null;
  return (
    <Boundary fallback={fallback}>
      <View style={{ height, borderRadius: radius.m, overflow: 'hidden', borderWidth: 1, borderColor: theme.line }}>
        <MapView
          ref={ref}
          style={{ flex: 1 }}
          accessibilityLabel={label}
          initialRegion={initialRegion}
          showsUserLocation={false}
          showsMyLocationButton={false}
          toolbarEnabled={false}
          pitchEnabled={false}
          userInterfaceStyle={theme.dark ? 'dark' : 'light'}
          maxZoomLevel={tiles && limitZoom ? tiles.maxZoom : undefined}
          onRegionChangeComplete={onRegionChange ? (r) => onRegionChange(r) : undefined}
          onMapReady={() => {
            ready.current = true;
            if (fit) applyFit(fit);
          }}
          onPress={
            onMapPress
              ? (e) => {
                  // iOS also reports marker taps here; those are handled by the marker's own onPress.
                  const ev = e?.nativeEvent;
                  if (!ev || ev.action === 'marker-press' || !ev.coordinate) return;
                  const { latitude, longitude } = ev.coordinate;
                  if (validLatLon(latitude, longitude)) onMapPress({ lat: latitude, lon: longitude });
                }
              : undefined
          }
        >
          {tiles ? <LocalTile pathTemplate={tiles.pathTemplate} tileSize={256} /> : null}
          {Polyline && lines
            ? lines.map((l) =>
                l.points.length > 1 ? (
                  <Polyline
                    key={l.id}
                    coordinates={l.points.map((p) => ({ latitude: p.lat, longitude: p.lon }))}
                    strokeColor={l.color}
                    strokeWidth={3}
                    lineDashPattern={l.dashed ? [8, 6] : undefined}
                    lineCap="round"
                    lineJoin="round"
                  />
                ) : null,
              )
            : null}
          {pins.map((p) =>
            p.badge ? (
              <BadgeMarker key={p.id} Marker={Marker} pin={{ ...p, badge: p.badge }} onPress={() => onPinPress(p.id)} />
            ) : (
              <Marker
                key={p.id}
                identifier={p.id}
                coordinate={{ latitude: p.lat, longitude: p.lon }}
                title={p.title}
                description={p.subtitle}
                pinColor={p.color}
                tracksViewChanges={false}
                accessibilityLabel={p.a11y}
                onPress={() => onPinPress(p.id)}
              />
            ),
          )}
        </MapView>
        {tiles ? (
          <View pointerEvents="none" style={{ position: 'absolute', right: 0, bottom: 0, paddingHorizontal: space.xs, borderTopLeftRadius: radius.s, backgroundColor: theme.card, opacity: 0.85 }}>
            <Text style={{ fontFamily: fonts.body, fontSize: 11, color: theme.ink }}>{t('citymaps.osm')}</Text>
          </View>
        ) : null}
      </View>
    </Boundary>
  );
}
